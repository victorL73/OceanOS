<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const VISIOCEAN_MODULE_ID = 'visiocean';
const VISIOCEAN_USER_AGENT = 'OceanOS SeoCean/1.0 (+https://oceanos.local)';

function visiocean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    visiocean_ensure_schema($pdo);
    return $pdo;
}

function visiocean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            site_url VARCHAR(255) NULL,
            ga_measurement_id VARCHAR(40) NULL,
            ga_property_id VARCHAR(80) NULL,
            search_console_site_url VARCHAR(255) NULL,
            target_country VARCHAR(2) NOT NULL DEFAULT 'FR',
            target_language VARCHAR(8) NOT NULL DEFAULT 'fr',
            target_keywords_json LONGTEXT NULL,
            competitors_json LONGTEXT NULL,
            service_account_cipher LONGTEXT NULL,
            service_account_hint VARCHAR(190) NULL,
            oauth_client_id VARCHAR(255) NULL,
            oauth_client_secret_cipher TEXT NULL,
            oauth_refresh_token_cipher TEXT NULL,
            oauth_connected_email VARCHAR(190) NULL,
            oauth_scopes VARCHAR(500) NULL,
            oauth_connected_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $columns = [
        'oauth_client_id' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_client_id VARCHAR(255) NULL AFTER service_account_hint',
        'oauth_client_secret_cipher' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_client_secret_cipher TEXT NULL AFTER oauth_client_id',
        'oauth_refresh_token_cipher' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_refresh_token_cipher TEXT NULL AFTER oauth_client_secret_cipher',
        'oauth_connected_email' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_connected_email VARCHAR(190) NULL AFTER oauth_refresh_token_cipher',
        'oauth_scopes' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_scopes VARCHAR(500) NULL AFTER oauth_connected_email',
        'oauth_connected_at' => 'ALTER TABLE visiocean_settings ADD COLUMN oauth_connected_at DATETIME NULL AFTER oauth_scopes',
    ];
    foreach ($columns as $column => $sql) {
        if (!oceanos_column_exists($pdo, 'visiocean_settings', $column)) {
            $pdo->exec($sql);
        }
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_page_audits (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            url VARCHAR(500) NOT NULL,
            status_code INT UNSIGNED NOT NULL DEFAULT 0,
            title VARCHAR(255) NULL,
            meta_description VARCHAR(500) NULL,
            h1 VARCHAR(255) NULL,
            canonical VARCHAR(500) NULL,
            word_count INT UNSIGNED NOT NULL DEFAULT 0,
            image_count INT UNSIGNED NOT NULL DEFAULT 0,
            images_missing_alt INT UNSIGNED NOT NULL DEFAULT 0,
            internal_links INT UNSIGNED NOT NULL DEFAULT 0,
            external_links INT UNSIGNED NOT NULL DEFAULT 0,
            load_ms INT UNSIGNED NOT NULL DEFAULT 0,
            score INT UNSIGNED NOT NULL DEFAULT 0,
            issues_json LONGTEXT NULL,
            checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_visiocean_page_audit_url (url(190)),
            KEY idx_visiocean_page_audits_checked (checked_at),
            KEY idx_visiocean_page_audits_score (score)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function visiocean_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(VISIOCEAN_MODULE_ID, $visibleModules, true)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'SeoCean n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function visiocean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function visiocean_public_user(array $user): array
{
    return [
        'id' => (int) ($user['id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'displayName' => (string) ($user['display_name'] ?? $user['email'] ?? 'Utilisateur'),
        'role' => (string) ($user['role'] ?? 'member'),
    ];
}

function visiocean_settings_row(PDO $pdo): array
{
    $defaults = [
        'target_keywords_json' => json_encode(['bateau occasion', 'nautisme', 'equipement bateau'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'competitors_json' => json_encode([], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ];

    $statement = $pdo->prepare(
        'INSERT IGNORE INTO visiocean_settings
            (id, target_keywords_json, competitors_json)
         VALUES
            (1, :target_keywords_json, :competitors_json)'
    );
    $statement->execute($defaults);

    $row = $pdo->query('SELECT * FROM visiocean_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration SeoCean introuvable.');
    }

    return $row;
}

function visiocean_decode_list(?string $json): array
{
    $decoded = json_decode((string) $json, true);
    if (!is_array($decoded)) {
        return [];
    }

    $items = [];
    foreach ($decoded as $item) {
        $value = trim((string) $item);
        if ($value !== '') {
            $items[$value] = true;
        }
    }

    return array_keys($items);
}

function visiocean_normalize_list(mixed $value, int $limit = 50): array
{
    if (is_string($value)) {
        $value = preg_split('/[\r\n,;]+/', $value) ?: [];
    }
    if (!is_array($value)) {
        return [];
    }

    $items = [];
    foreach ($value as $item) {
        if (!is_scalar($item)) {
            continue;
        }
        $text = trim(preg_replace('/\s+/', ' ', (string) $item) ?? '');
        if ($text !== '') {
            $items[mb_substr($text, 0, 140)] = true;
        }
        if (count($items) >= $limit) {
            break;
        }
    }

    return array_keys($items);
}

function visiocean_normalize_url(string $url, bool $allowSearchConsoleDomain = false, bool $preserveTrailingSlash = false): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    if ($allowSearchConsoleDomain && str_starts_with($url, 'sc-domain:')) {
        $domain = trim(substr($url, 10));
        if ($domain === '' || str_contains($domain, '/')) {
            throw new InvalidArgumentException('Propriete Search Console sc-domain invalide.');
        }
        return 'sc-domain:' . mb_strtolower($domain);
    }
    if (!preg_match('/^https?:\/\//i', $url)) {
        $url = 'https://' . $url;
    }
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        throw new InvalidArgumentException('URL de site invalide.');
    }

    if ($preserveTrailingSlash) {
        $parts = parse_url($url);
        if (is_array($parts) && empty($parts['path'])) {
            return $url . '/';
        }

        return $url;
    }

    return rtrim($url, '/');
}

function visiocean_origin_url(): string
{
    $scheme = oceanos_is_https_request() ? 'https' : 'http';
    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    if ($host === '') {
        $host = 'localhost';
    }

    return $scheme . '://' . $host;
}

function visiocean_oauth_redirect_uri(): string
{
    return visiocean_origin_url() . '/SeoCean/api/oauth-callback.php';
}

function visiocean_google_scopes(): array
{
    return [
        'openid',
        'email',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
    ];
}

function visiocean_public_settings(PDO $pdo, bool $canManage): array
{
    $row = visiocean_settings_row($pdo);

    return [
        'siteUrl' => (string) ($row['site_url'] ?? ''),
        'gaMeasurementId' => (string) ($row['ga_measurement_id'] ?? ''),
        'gaPropertyId' => (string) ($row['ga_property_id'] ?? ''),
        'searchConsoleSiteUrl' => (string) ($row['search_console_site_url'] ?? ''),
        'targetCountry' => (string) ($row['target_country'] ?? 'FR'),
        'targetLanguage' => (string) ($row['target_language'] ?? 'fr'),
        'targetKeywords' => visiocean_decode_list($row['target_keywords_json'] ?? null),
        'competitors' => visiocean_decode_list($row['competitors_json'] ?? null),
        'hasServiceAccount' => trim((string) ($row['service_account_cipher'] ?? '')) !== '',
        'serviceAccountHint' => (string) ($row['service_account_hint'] ?? ''),
        'oauthClientId' => (string) ($row['oauth_client_id'] ?? ''),
        'hasOAuthClientSecret' => trim((string) ($row['oauth_client_secret_cipher'] ?? '')) !== '',
        'hasOAuthConnection' => trim((string) ($row['oauth_refresh_token_cipher'] ?? '')) !== '',
        'oauthConnectedEmail' => (string) ($row['oauth_connected_email'] ?? ''),
        'oauthConnectedAt' => (string) ($row['oauth_connected_at'] ?? ''),
        'oauthRedirectUri' => visiocean_oauth_redirect_uri(),
        'oauthScopes' => visiocean_google_scopes(),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'canManage' => $canManage,
        'managedBy' => 'OceanOS',
    ];
}

function visiocean_private_settings(PDO $pdo): array
{
    $row = visiocean_settings_row($pdo);

    return [
        ...visiocean_public_settings($pdo, true),
        'serviceAccountJson' => oceanos_decrypt_secret($row['service_account_cipher'] ?? ''),
        'oauthClientSecret' => oceanos_decrypt_secret($row['oauth_client_secret_cipher'] ?? ''),
        'oauthRefreshToken' => oceanos_decrypt_secret($row['oauth_refresh_token_cipher'] ?? ''),
    ];
}

function visiocean_validate_measurement_id(string $measurementId): string
{
    $measurementId = strtoupper(trim($measurementId));
    if ($measurementId !== '' && !preg_match('/^G-[A-Z0-9]+$/', $measurementId)) {
        throw new InvalidArgumentException('ID de mesure GA4 invalide. Format attendu : G-XXXXXXXX.');
    }

    return $measurementId;
}

function visiocean_normalize_property_id(string $propertyId): string
{
    $propertyId = trim($propertyId);
    if ($propertyId === '') {
        return '';
    }
    $propertyId = preg_replace('/^properties\//', '', $propertyId) ?? $propertyId;
    if (!preg_match('/^\d+$/', $propertyId)) {
        throw new InvalidArgumentException('ID de propriete GA4 invalide. Utilisez uniquement le numero de propriete.');
    }

    return $propertyId;
}

function visiocean_service_account_hint(string $json): string
{
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('JSON de compte de service Google invalide.');
    }
    if (($decoded['type'] ?? '') !== 'service_account' || trim((string) ($decoded['client_email'] ?? '')) === '') {
        throw new InvalidArgumentException('Le compte de service Google doit contenir type=service_account et client_email.');
    }

    return (string) $decoded['client_email'];
}

function visiocean_save_settings(PDO $pdo, array $input): array
{
    $settings = is_array($input['settings'] ?? null) ? $input['settings'] : [];
    $existing = visiocean_settings_row($pdo);

    $siteUrl = visiocean_normalize_url((string) ($settings['siteUrl'] ?? ''));
    $searchConsoleUrl = visiocean_normalize_url((string) ($settings['searchConsoleSiteUrl'] ?? $siteUrl), true, true);
    $measurementId = visiocean_validate_measurement_id((string) ($settings['gaMeasurementId'] ?? ''));
    $propertyId = visiocean_normalize_property_id((string) ($settings['gaPropertyId'] ?? ''));
    $targetCountry = strtoupper(substr(preg_replace('/[^a-z]/i', '', (string) ($settings['targetCountry'] ?? 'FR')) ?? 'FR', 0, 2));
    $targetLanguage = strtolower(mb_substr(preg_replace('/[^a-z-]/i', '', (string) ($settings['targetLanguage'] ?? 'fr')) ?? 'fr', 0, 8));
    $keywords = visiocean_normalize_list($settings['targetKeywords'] ?? [], 80);
    $competitors = visiocean_normalize_list($settings['competitors'] ?? [], 20);

    $serviceAccountJson = trim((string) ($settings['serviceAccountJson'] ?? ''));
    $serviceAccountCipher = $existing['service_account_cipher'] ?? null;
    $serviceAccountHint = (string) ($existing['service_account_hint'] ?? '');
    if (!empty($settings['clearServiceAccount'])) {
        $serviceAccountCipher = null;
        $serviceAccountHint = '';
    }
    if ($serviceAccountJson !== '') {
        $serviceAccountHint = visiocean_service_account_hint($serviceAccountJson);
        $serviceAccountCipher = oceanos_encrypt_secret($serviceAccountJson);
    }

    $oauthClientId = trim((string) ($settings['oauthClientId'] ?? $existing['oauth_client_id'] ?? ''));
    $oauthClientSecretInput = trim((string) ($settings['oauthClientSecret'] ?? ''));
    $oauthClientSecretCipher = $existing['oauth_client_secret_cipher'] ?? null;
    $oauthRefreshTokenCipher = $existing['oauth_refresh_token_cipher'] ?? null;
    $oauthConnectedEmail = (string) ($existing['oauth_connected_email'] ?? '');
    $oauthScopes = (string) ($existing['oauth_scopes'] ?? '');
    $oauthConnectedAt = $existing['oauth_connected_at'] ?? null;
    if (!empty($settings['clearOAuthConnection'])) {
        $oauthRefreshTokenCipher = null;
        $oauthConnectedEmail = '';
        $oauthScopes = '';
        $oauthConnectedAt = null;
    }
    if (!empty($settings['clearOAuthClientSecret'])) {
        $oauthClientSecretCipher = null;
        $oauthRefreshTokenCipher = null;
        $oauthConnectedEmail = '';
        $oauthScopes = '';
        $oauthConnectedAt = null;
    }
    if ($oauthClientSecretInput !== '') {
        $oauthClientSecretCipher = oceanos_encrypt_secret($oauthClientSecretInput);
    }

    $statement = $pdo->prepare(
        'UPDATE visiocean_settings
         SET site_url = :site_url,
             ga_measurement_id = :ga_measurement_id,
             ga_property_id = :ga_property_id,
             search_console_site_url = :search_console_site_url,
             target_country = :target_country,
             target_language = :target_language,
             target_keywords_json = :target_keywords_json,
             competitors_json = :competitors_json,
             service_account_cipher = :service_account_cipher,
             service_account_hint = :service_account_hint,
             oauth_client_id = :oauth_client_id,
             oauth_client_secret_cipher = :oauth_client_secret_cipher,
             oauth_refresh_token_cipher = :oauth_refresh_token_cipher,
             oauth_connected_email = :oauth_connected_email,
             oauth_scopes = :oauth_scopes,
             oauth_connected_at = :oauth_connected_at
         WHERE id = 1'
    );
    $statement->execute([
        'site_url' => $siteUrl,
        'ga_measurement_id' => $measurementId,
        'ga_property_id' => $propertyId,
        'search_console_site_url' => $searchConsoleUrl,
        'target_country' => $targetCountry !== '' ? $targetCountry : 'FR',
        'target_language' => $targetLanguage !== '' ? $targetLanguage : 'fr',
        'target_keywords_json' => json_encode($keywords, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'competitors_json' => json_encode($competitors, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'service_account_cipher' => $serviceAccountCipher,
        'service_account_hint' => $serviceAccountHint,
        'oauth_client_id' => $oauthClientId !== '' ? $oauthClientId : null,
        'oauth_client_secret_cipher' => $oauthClientSecretCipher,
        'oauth_refresh_token_cipher' => $oauthRefreshTokenCipher,
        'oauth_connected_email' => $oauthConnectedEmail !== '' ? $oauthConnectedEmail : null,
        'oauth_scopes' => $oauthScopes !== '' ? $oauthScopes : null,
        'oauth_connected_at' => $oauthConnectedAt,
    ]);

    return visiocean_public_settings($pdo, true);
}

function visiocean_http_request(string $method, string $url, array $headers = [], ?string $body = null, int $timeout = 35): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('L extension PHP cURL est requise pour Visiocean.');
    }

    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 4,
        CURLOPT_USERAGENT => VISIOCEAN_USER_AGENT,
        CURLOPT_HTTPHEADER => $headers,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = $body;
    }
    $caBundle = function_exists('oceanos_ca_bundle_path') ? oceanos_ca_bundle_path() : '';
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }

    curl_setopt_array($curl, $options);
    $started = microtime(true);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($raw === false) {
        throw new RuntimeException($error !== '' ? $error : 'Reponse HTTP vide.');
    }

    return [
        'status' => $status,
        'body' => (string) $raw,
        'loadMs' => (int) round((microtime(true) - $started) * 1000),
    ];
}

function visiocean_json_request(string $url, string $accessToken, array $payload): array
{
    $response = visiocean_http_request('POST', $url, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
        'Accept: application/json',
    ], json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 40);

    $decoded = json_decode($response['body'], true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Reponse Google illisible.');
    }
    if (($response['status'] < 200 || $response['status'] >= 300) || isset($decoded['error'])) {
        $message = is_array($decoded['error'] ?? null)
            ? (string) ($decoded['error']['message'] ?? 'Erreur Google.')
            : 'Erreur Google.';
        throw new RuntimeException($message);
    }

    return $decoded;
}

function visiocean_base64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function visiocean_oauth_token_request(array $params): array
{
    $response = visiocean_http_request('POST', 'https://oauth2.googleapis.com/token', [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ], http_build_query($params, '', '&', PHP_QUERY_RFC3986), 35);

    $decoded = json_decode($response['body'], true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Reponse OAuth Google illisible.');
    }
    if (($response['status'] < 200 || $response['status'] >= 300) || isset($decoded['error'])) {
        throw new RuntimeException((string) ($decoded['error_description'] ?? $decoded['error'] ?? 'Authentification Google refusee.'));
    }

    return $decoded;
}

function visiocean_oauth_access_token(array $settings): string
{
    $clientId = trim((string) ($settings['oauthClientId'] ?? ''));
    $clientSecret = trim((string) ($settings['oauthClientSecret'] ?? ''));
    $refreshToken = trim((string) ($settings['oauthRefreshToken'] ?? ''));
    if ($clientId === '' || $clientSecret === '' || $refreshToken === '') {
        throw new RuntimeException('Connectez Google OAuth dans Visiocean.');
    }

    $decoded = visiocean_oauth_token_request([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refreshToken,
        'grant_type' => 'refresh_token',
    ]);

    $accessToken = trim((string) ($decoded['access_token'] ?? ''));
    if ($accessToken === '') {
        throw new RuntimeException('Jeton OAuth Google non obtenu.');
    }

    return $accessToken;
}

function visiocean_google_access_token(array $settings, array $scopes): string
{
    if (trim((string) ($settings['oauthRefreshToken'] ?? '')) !== '') {
        return visiocean_oauth_access_token($settings);
    }

    $json = trim((string) ($settings['serviceAccountJson'] ?? ''));
    if ($json === '') {
        throw new RuntimeException('Connectez Google OAuth ou ajoutez un compte de service Google autorise.');
    }
    $service = json_decode($json, true);
    if (!is_array($service)) {
        throw new RuntimeException('Compte de service Google invalide.');
    }

    $clientEmail = (string) ($service['client_email'] ?? '');
    $privateKey = (string) ($service['private_key'] ?? '');
    $tokenUri = (string) ($service['token_uri'] ?? 'https://oauth2.googleapis.com/token');
    if ($clientEmail === '' || $privateKey === '') {
        throw new RuntimeException('Compte de service Google incomplet.');
    }

    $now = time();
    $header = visiocean_base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
    $claims = visiocean_base64url(json_encode([
        'iss' => $clientEmail,
        'scope' => implode(' ', $scopes),
        'aud' => $tokenUri,
        'iat' => $now,
        'exp' => $now + 3600,
    ], JSON_UNESCAPED_SLASHES));
    $unsigned = $header . '.' . $claims;

    $signature = '';
    if (!openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Signature Google impossible.');
    }
    $assertion = $unsigned . '.' . visiocean_base64url($signature);
    $response = visiocean_http_request('POST', $tokenUri, [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ], http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $assertion,
    ]), 35);

    $decoded = json_decode($response['body'], true);
    if (!is_array($decoded) || empty($decoded['access_token'])) {
        throw new RuntimeException('Jeton Google non obtenu.');
    }

    return (string) $decoded['access_token'];
}

function visiocean_oauth_authorization_url(PDO $pdo): string
{
    $settings = visiocean_private_settings($pdo);
    $clientId = trim((string) ($settings['oauthClientId'] ?? ''));
    $clientSecret = trim((string) ($settings['oauthClientSecret'] ?? ''));
    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Renseignez le Client ID et le Client secret OAuth dans Visiocean avant de connecter Google.');
    }

    oceanos_start_session();
    $state = bin2hex(random_bytes(24));
    $_SESSION['visiocean_oauth_state'] = $state;

    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => visiocean_oauth_redirect_uri(),
        'response_type' => 'code',
        'scope' => implode(' ', visiocean_google_scopes()),
        'access_type' => 'offline',
        'prompt' => 'consent',
        'include_granted_scopes' => 'true',
        'state' => $state,
    ], '', '&', PHP_QUERY_RFC3986);
}

function visiocean_oauth_user_email(string $accessToken): string
{
    $response = visiocean_http_request('GET', 'https://openidconnect.googleapis.com/v1/userinfo', [
        'Authorization: Bearer ' . $accessToken,
        'Accept: application/json',
    ], null, 25);
    $decoded = json_decode($response['body'], true);
    if (!is_array($decoded)) {
        return '';
    }

    return trim((string) ($decoded['email'] ?? ''));
}

function visiocean_complete_oauth(PDO $pdo, string $code, string $state): array
{
    oceanos_start_session();
    $expectedState = (string) ($_SESSION['visiocean_oauth_state'] ?? '');
    unset($_SESSION['visiocean_oauth_state']);
    if ($expectedState === '' || !hash_equals($expectedState, $state)) {
        throw new RuntimeException('Connexion Google expiree ou invalide.');
    }

    $settings = visiocean_private_settings($pdo);
    $clientId = trim((string) ($settings['oauthClientId'] ?? ''));
    $clientSecret = trim((string) ($settings['oauthClientSecret'] ?? ''));
    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('Client OAuth Visiocean incomplet.');
    }

    $token = visiocean_oauth_token_request([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'code' => $code,
        'redirect_uri' => visiocean_oauth_redirect_uri(),
        'grant_type' => 'authorization_code',
    ]);

    $refreshToken = trim((string) ($token['refresh_token'] ?? ''));
    if ($refreshToken === '') {
        throw new RuntimeException('Google n a pas retourne de refresh token. Relancez la connexion avec prompt=consent ou revoquez l acces OAuth existant.');
    }
    $accessToken = trim((string) ($token['access_token'] ?? ''));
    $email = $accessToken !== '' ? visiocean_oauth_user_email($accessToken) : '';
    $scopes = trim((string) ($token['scope'] ?? implode(' ', visiocean_google_scopes())));

    $statement = $pdo->prepare(
        'UPDATE visiocean_settings
         SET oauth_refresh_token_cipher = :refresh_token,
             oauth_connected_email = :email,
             oauth_scopes = :scopes,
             oauth_connected_at = CURRENT_TIMESTAMP
         WHERE id = 1'
    );
    $statement->execute([
        'refresh_token' => oceanos_encrypt_secret($refreshToken),
        'email' => $email !== '' ? $email : null,
        'scopes' => $scopes !== '' ? $scopes : null,
    ]);

    return visiocean_public_settings($pdo, true);
}

function visiocean_date_range(int $days): array
{
    $days = max(1, min(180, $days));
    $end = new DateTimeImmutable('yesterday');
    $start = $end->modify('-' . max(0, $days - 1) . ' days');

    return [
        'startDate' => $start->format('Y-m-d'),
        'endDate' => $end->format('Y-m-d'),
    ];
}

function visiocean_metric_value(array $row, int $index, float $fallback = 0.0): float
{
    return isset($row['metricValues'][$index]['value']) ? (float) $row['metricValues'][$index]['value'] : $fallback;
}

function visiocean_dimension_value(array $row, int $index, string $fallback = ''): string
{
    return isset($row['dimensionValues'][$index]['value']) ? (string) $row['dimensionValues'][$index]['value'] : $fallback;
}

function visiocean_empty_analytics(string $message): array
{
    return [
        'available' => false,
        'message' => $message,
        'summary' => [
            'sessions' => 0,
            'activeUsers' => 0,
            'conversions' => 0,
            'eventCount' => 0,
            'engagementRate' => 0,
            'averageSessionDuration' => 0,
        ],
        'channels' => [],
        'pages' => [],
    ];
}

function visiocean_google_analytics(array $settings, int $days): array
{
    $propertyId = visiocean_normalize_property_id((string) ($settings['gaPropertyId'] ?? ''));
    if ($propertyId === '') {
        return visiocean_empty_analytics('Ajoutez l ID de propriete GA4 pour lire Google Analytics.');
    }
    if (trim((string) ($settings['oauthRefreshToken'] ?? '')) === '' && trim((string) ($settings['serviceAccountJson'] ?? '')) === '') {
        return visiocean_empty_analytics('Connectez Google OAuth dans Visiocean pour lire la propriete GA4.');
    }

    try {
        $range = visiocean_date_range($days);
        $token = visiocean_google_access_token($settings, ['https://www.googleapis.com/auth/analytics.readonly']);
        $baseUrl = 'https://analyticsdata.googleapis.com/v1beta/properties/' . rawurlencode($propertyId) . ':runReport';

        $summaryResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => [$range],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
                ['name' => 'eventCount'],
                ['name' => 'engagementRate'],
                ['name' => 'averageSessionDuration'],
            ],
        ]);
        $channelResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => [$range],
            'dimensions' => [['name' => 'sessionDefaultChannelGroup']],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
            ],
            'limit' => 8,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);
        $pageResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => [$range],
            'dimensions' => [['name' => 'pagePath']],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
                ['name' => 'engagementRate'],
            ],
            'limit' => 12,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);

        $summaryRow = $summaryResponse['rows'][0] ?? [];
        return [
            'available' => true,
            'message' => '',
            'summary' => [
                'sessions' => (int) round(visiocean_metric_value($summaryRow, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($summaryRow, 1)),
                'conversions' => visiocean_metric_value($summaryRow, 2),
                'eventCount' => (int) round(visiocean_metric_value($summaryRow, 3)),
                'engagementRate' => visiocean_metric_value($summaryRow, 4),
                'averageSessionDuration' => visiocean_metric_value($summaryRow, 5),
            ],
            'channels' => array_map(static fn(array $row): array => [
                'name' => visiocean_dimension_value($row, 0, 'Non defini'),
                'sessions' => (int) round(visiocean_metric_value($row, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($row, 1)),
                'conversions' => visiocean_metric_value($row, 2),
            ], $channelResponse['rows'] ?? []),
            'pages' => array_map(static fn(array $row): array => [
                'path' => visiocean_dimension_value($row, 0, '/'),
                'sessions' => (int) round(visiocean_metric_value($row, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($row, 1)),
                'conversions' => visiocean_metric_value($row, 2),
                'engagementRate' => visiocean_metric_value($row, 3),
            ], $pageResponse['rows'] ?? []),
        ];
    } catch (Throwable $exception) {
        return visiocean_empty_analytics($exception->getMessage());
    }
}

function visiocean_empty_search(string $message): array
{
    return [
        'available' => false,
        'message' => $message,
        'summary' => [
            'clicks' => 0,
            'impressions' => 0,
            'ctr' => 0,
            'position' => 0,
        ],
        'queries' => [],
        'pages' => [],
    ];
}

function visiocean_search_console(array $settings, int $days): array
{
    $siteUrl = trim((string) ($settings['searchConsoleSiteUrl'] ?? ''));
    if ($siteUrl === '') {
        return visiocean_empty_search('Ajoutez la propriete Search Console du site.');
    }
    if (trim((string) ($settings['oauthRefreshToken'] ?? '')) === '' && trim((string) ($settings['serviceAccountJson'] ?? '')) === '') {
        return visiocean_empty_search('Connectez Google OAuth dans Visiocean pour lire Search Console.');
    }

    try {
        $range = visiocean_date_range($days);
        $token = visiocean_google_access_token($settings, ['https://www.googleapis.com/auth/webmasters.readonly']);
        $baseUrl = 'https://www.googleapis.com/webmasters/v3/sites/' . rawurlencode($siteUrl) . '/searchAnalytics/query';
        $basePayload = [
            'startDate' => $range['startDate'],
            'endDate' => $range['endDate'],
            'rowLimit' => 20,
        ];

        $summaryResponse = visiocean_json_request($baseUrl, $token, $basePayload + ['rowLimit' => 1]);
        $queryResponse = visiocean_json_request($baseUrl, $token, $basePayload + ['dimensions' => ['query']]);
        $pageResponse = visiocean_json_request($baseUrl, $token, $basePayload + ['dimensions' => ['page']]);
        $summary = $summaryResponse['rows'][0] ?? [];

        $mapRow = static function (array $row): array {
            return [
                'key' => (string) (($row['keys'][0] ?? '') ?: 'Non defini'),
                'clicks' => (float) ($row['clicks'] ?? 0),
                'impressions' => (float) ($row['impressions'] ?? 0),
                'ctr' => (float) ($row['ctr'] ?? 0),
                'position' => (float) ($row['position'] ?? 0),
            ];
        };

        return [
            'available' => true,
            'message' => '',
            'summary' => [
                'clicks' => (float) ($summary['clicks'] ?? 0),
                'impressions' => (float) ($summary['impressions'] ?? 0),
                'ctr' => (float) ($summary['ctr'] ?? 0),
                'position' => (float) ($summary['position'] ?? 0),
            ],
            'queries' => array_map($mapRow, $queryResponse['rows'] ?? []),
            'pages' => array_map($mapRow, $pageResponse['rows'] ?? []),
        ];
    } catch (Throwable $exception) {
        return visiocean_empty_search($exception->getMessage());
    }
}

function visiocean_text_from_nodes(DOMXPath $xpath, string $query): string
{
    $nodes = $xpath->query($query);
    if (!$nodes || $nodes->length === 0) {
        return '';
    }

    return trim(preg_replace('/\s+/', ' ', $nodes->item(0)?->textContent ?? '') ?? '');
}

function visiocean_attr_from_nodes(DOMXPath $xpath, string $query, string $attribute): string
{
    $nodes = $xpath->query($query);
    if (!$nodes || $nodes->length === 0 || !($nodes->item(0) instanceof DOMElement)) {
        return '';
    }

    return trim($nodes->item(0)->getAttribute($attribute));
}

function visiocean_absolute_url(string $baseUrl, string $href): string
{
    $href = trim($href);
    if ($href === '' || str_starts_with($href, '#') || preg_match('/^(mailto|tel|javascript):/i', $href)) {
        return '';
    }
    if (preg_match('/^https?:\/\//i', $href)) {
        return strtok($href, '#') ?: $href;
    }
    $base = parse_url($baseUrl);
    if (!is_array($base) || empty($base['scheme']) || empty($base['host'])) {
        return '';
    }
    $root = $base['scheme'] . '://' . $base['host'] . (isset($base['port']) ? ':' . $base['port'] : '');
    if (str_starts_with($href, '//')) {
        return $base['scheme'] . ':' . $href;
    }
    if (str_starts_with($href, '/')) {
        return strtok($root . $href, '#') ?: '';
    }

    $path = $base['path'] ?? '/';
    $directory = preg_replace('~/[^/]*$~', '/', $path) ?: '/';
    $parts = [];
    foreach (explode('/', $directory . $href) as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            array_pop($parts);
            continue;
        }
        $parts[] = $part;
    }

    return strtok($root . '/' . implode('/', $parts), '#') ?: '';
}

function visiocean_same_host(string $a, string $b): bool
{
    return strtolower((string) parse_url($a, PHP_URL_HOST)) === strtolower((string) parse_url($b, PHP_URL_HOST));
}

function visiocean_audit_page(string $url, string $siteUrl): array
{
    $response = visiocean_http_request('GET', $url, ['Accept: text/html,application/xhtml+xml'], null, 25);
    $html = $response['body'];
    $statusCode = (int) $response['status'];
    $loadMs = (int) $response['loadMs'];

    $title = '';
    $description = '';
    $h1 = '';
    $canonical = '';
    $wordCount = 0;
    $imageCount = 0;
    $imagesMissingAlt = 0;
    $internalLinks = 0;
    $externalLinks = 0;
    $links = [];

    if ($html !== '') {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();
        $xpath = new DOMXPath($dom);

        $title = visiocean_text_from_nodes($xpath, '//title');
        $description = visiocean_attr_from_nodes($xpath, '//meta[translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="description"]', 'content');
        $h1 = visiocean_text_from_nodes($xpath, '//h1');
        $canonical = visiocean_attr_from_nodes($xpath, '//link[translate(@rel, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="canonical"]', 'href');
        $text = visiocean_text_from_nodes($xpath, '//body');
        $wordCount = str_word_count($text);

        $images = $xpath->query('//img');
        $imageCount = $images ? $images->length : 0;
        if ($images) {
            foreach ($images as $image) {
                if ($image instanceof DOMElement && trim($image->getAttribute('alt')) === '') {
                    $imagesMissingAlt++;
                }
            }
        }

        $anchors = $xpath->query('//a[@href]');
        if ($anchors) {
            foreach ($anchors as $anchor) {
                if (!($anchor instanceof DOMElement)) {
                    continue;
                }
                $absolute = visiocean_absolute_url($url, $anchor->getAttribute('href'));
                if ($absolute === '') {
                    continue;
                }
                if (visiocean_same_host($absolute, $siteUrl)) {
                    $internalLinks++;
                    $links[$absolute] = true;
                } else {
                    $externalLinks++;
                }
            }
        }
    }

    $issues = [];
    $score = 100;
    $deduct = static function (int $points, string $issue) use (&$score, &$issues): void {
        $score -= $points;
        $issues[] = $issue;
    };

    if ($statusCode < 200 || $statusCode >= 400) {
        $deduct(25, 'Code HTTP ' . $statusCode);
    }
    if ($title === '') {
        $deduct(18, 'Title manquant');
    } elseif (mb_strlen($title) < 25 || mb_strlen($title) > 65) {
        $deduct(8, 'Longueur title a ajuster');
    }
    if ($description === '') {
        $deduct(14, 'Meta description manquante');
    } elseif (mb_strlen($description) < 70 || mb_strlen($description) > 170) {
        $deduct(6, 'Longueur meta description a ajuster');
    }
    if ($h1 === '') {
        $deduct(10, 'H1 manquant');
    }
    if ($canonical === '') {
        $deduct(8, 'Canonical manquant');
    }
    if ($imageCount > 0 && $imagesMissingAlt > 0) {
        $deduct(min(12, $imagesMissingAlt * 2), $imagesMissingAlt . ' image(s) sans alt');
    }
    if (!str_starts_with($url, 'https://')) {
        $deduct(8, 'HTTPS non detecte');
    }
    if ($loadMs > 2500) {
        $deduct(8, 'Temps de chargement eleve');
    }
    if ($wordCount > 0 && $wordCount < 250) {
        $deduct(6, 'Contenu trop court');
    }

    return [
        'url' => $url,
        'statusCode' => $statusCode,
        'title' => mb_substr($title, 0, 255),
        'metaDescription' => mb_substr($description, 0, 500),
        'h1' => mb_substr($h1, 0, 255),
        'canonical' => mb_substr($canonical, 0, 500),
        'wordCount' => $wordCount,
        'imageCount' => $imageCount,
        'imagesMissingAlt' => $imagesMissingAlt,
        'internalLinks' => $internalLinks,
        'externalLinks' => $externalLinks,
        'loadMs' => $loadMs,
        'score' => max(0, min(100, $score)),
        'issues' => array_values(array_unique($issues)),
        'links' => array_keys($links),
    ];
}

function visiocean_store_audit(PDO $pdo, array $page): void
{
    $statement = $pdo->prepare(
        'INSERT INTO visiocean_page_audits
            (url, status_code, title, meta_description, h1, canonical, word_count, image_count, images_missing_alt, internal_links, external_links, load_ms, score, issues_json)
         VALUES
            (:url, :status_code, :title, :meta_description, :h1, :canonical, :word_count, :image_count, :images_missing_alt, :internal_links, :external_links, :load_ms, :score, :issues_json)
         ON DUPLICATE KEY UPDATE
            status_code = VALUES(status_code),
            title = VALUES(title),
            meta_description = VALUES(meta_description),
            h1 = VALUES(h1),
            canonical = VALUES(canonical),
            word_count = VALUES(word_count),
            image_count = VALUES(image_count),
            images_missing_alt = VALUES(images_missing_alt),
            internal_links = VALUES(internal_links),
            external_links = VALUES(external_links),
            load_ms = VALUES(load_ms),
            score = VALUES(score),
            issues_json = VALUES(issues_json),
            checked_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'url' => (string) $page['url'],
        'status_code' => (int) ($page['statusCode'] ?? 0),
        'title' => (string) ($page['title'] ?? ''),
        'meta_description' => (string) ($page['metaDescription'] ?? ''),
        'h1' => (string) ($page['h1'] ?? ''),
        'canonical' => (string) ($page['canonical'] ?? ''),
        'word_count' => (int) ($page['wordCount'] ?? 0),
        'image_count' => (int) ($page['imageCount'] ?? 0),
        'images_missing_alt' => (int) ($page['imagesMissingAlt'] ?? 0),
        'internal_links' => (int) ($page['internalLinks'] ?? 0),
        'external_links' => (int) ($page['externalLinks'] ?? 0),
        'load_ms' => (int) ($page['loadMs'] ?? 0),
        'score' => (int) ($page['score'] ?? 0),
        'issues_json' => json_encode($page['issues'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function visiocean_run_audit(PDO $pdo, array $settings, int $limit = 12): array
{
    $siteUrl = visiocean_normalize_url((string) ($settings['siteUrl'] ?? ''));
    if ($siteUrl === '') {
        throw new InvalidArgumentException('Configurez l URL du site avant de lancer l audit.');
    }

    $limit = max(1, min(30, $limit));
    $queue = [$siteUrl];
    $seen = [];

    while ($queue !== [] && count($seen) < $limit) {
        $url = array_shift($queue);
        if (!is_string($url) || isset($seen[$url])) {
            continue;
        }
        $seen[$url] = true;

        try {
            $page = visiocean_audit_page($url, $siteUrl);
            visiocean_store_audit($pdo, $page);
            foreach (($page['links'] ?? []) as $link) {
                if (count($seen) + count($queue) >= $limit) {
                    break;
                }
                if (is_string($link) && !isset($seen[$link])) {
                    $queue[] = $link;
                }
            }
        } catch (Throwable $exception) {
            visiocean_store_audit($pdo, [
                'url' => $url,
                'statusCode' => 0,
                'title' => '',
                'metaDescription' => '',
                'h1' => '',
                'canonical' => '',
                'wordCount' => 0,
                'imageCount' => 0,
                'imagesMissingAlt' => 0,
                'internalLinks' => 0,
                'externalLinks' => 0,
                'loadMs' => 0,
                'score' => 0,
                'issues' => [$exception->getMessage()],
            ]);
        }
    }

    return visiocean_audit_payload($pdo);
}

function visiocean_audit_payload(PDO $pdo): array
{
    $statement = $pdo->query(
        'SELECT url, status_code, title, meta_description, h1, canonical, word_count,
                image_count, images_missing_alt, internal_links, external_links, load_ms,
                score, issues_json, checked_at
         FROM visiocean_page_audits
         ORDER BY checked_at DESC, score ASC
         LIMIT 80'
    );
    $pages = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $pages[] = [
            'url' => (string) $row['url'],
            'statusCode' => (int) $row['status_code'],
            'title' => (string) ($row['title'] ?? ''),
            'metaDescription' => (string) ($row['meta_description'] ?? ''),
            'h1' => (string) ($row['h1'] ?? ''),
            'canonical' => (string) ($row['canonical'] ?? ''),
            'wordCount' => (int) $row['word_count'],
            'imageCount' => (int) $row['image_count'],
            'imagesMissingAlt' => (int) $row['images_missing_alt'],
            'internalLinks' => (int) $row['internal_links'],
            'externalLinks' => (int) $row['external_links'],
            'loadMs' => (int) $row['load_ms'],
            'score' => (int) $row['score'],
            'issues' => visiocean_decode_list($row['issues_json'] ?? null),
            'checkedAt' => (string) $row['checked_at'],
        ];
    }

    $pageCount = count($pages);
    $scoreTotal = array_sum(array_map(static fn(array $page): int => (int) $page['score'], $pages));
    $issueCount = array_sum(array_map(static fn(array $page): int => count($page['issues'] ?? []), $pages));

    return [
        'available' => $pageCount > 0,
        'message' => $pageCount > 0 ? '' : 'Lancez un audit SEO pour analyser les pages du site.',
        'summary' => [
            'pageCount' => $pageCount,
            'averageScore' => $pageCount > 0 ? round($scoreTotal / $pageCount, 1) : 0,
            'issueCount' => $issueCount,
        ],
        'pages' => $pages,
    ];
}

function visiocean_tracking_snippet(array $settings): string
{
    $measurementId = visiocean_validate_measurement_id((string) ($settings['gaMeasurementId'] ?? ''));
    if ($measurementId === '') {
        return '';
    }

    return '<script async src="https://www.googletagmanager.com/gtag/js?id=' . htmlspecialchars($measurementId, ENT_QUOTES) . '"></script>' . "\n"
        . '<script>' . "\n"
        . '  window.dataLayer = window.dataLayer || [];' . "\n"
        . '  function gtag(){dataLayer.push(arguments);}' . "\n"
        . "  gtag('js', new Date());" . "\n"
        . "  gtag('config', '" . addslashes($measurementId) . "');" . "\n"
        . '</script>';
}

function visiocean_format_metric(float $value, int $digits = 0): string
{
    $formatted = number_format($value, $digits, ',', ' ');
    if ($digits > 0) {
        $formatted = rtrim(rtrim($formatted, '0'), ',');
    }

    return $formatted;
}

function visiocean_channel_sessions(array $analytics, array $names): int
{
    $needle = array_map(static fn(string $name): string => mb_strtolower($name), $names);
    foreach (($analytics['channels'] ?? []) as $channel) {
        $name = mb_strtolower((string) ($channel['name'] ?? ''));
        if (in_array($name, $needle, true)) {
            return (int) round((float) ($channel['sessions'] ?? 0));
        }
    }

    return 0;
}

function visiocean_action_item(string $priority, string $area, string $title, string $body, array $steps = [], string $impact = ''): array
{
    $cleanSteps = [];
    foreach ($steps as $step) {
        $step = trim((string) $step);
        if ($step !== '') {
            $cleanSteps[] = $step;
        }
    }

    return [
        'priority' => $priority,
        'area' => $area,
        'title' => $title,
        'body' => $body,
        'steps' => $cleanSteps,
        'impact' => $impact,
    ];
}

function visiocean_novice_summary(array $analytics, array $search, array $audit, int $days): array
{
    $sessions = (int) round((float) ($analytics['summary']['sessions'] ?? 0));
    $activeUsers = (int) round((float) ($analytics['summary']['activeUsers'] ?? 0));
    $keyEvents = (float) ($analytics['summary']['conversions'] ?? 0);
    $clicks = (int) round((float) ($search['summary']['clicks'] ?? 0));
    $impressions = (int) round((float) ($search['summary']['impressions'] ?? 0));
    $ctr = (float) ($search['summary']['ctr'] ?? 0);
    $score = (float) ($audit['summary']['averageScore'] ?? 0);
    $pageCount = (int) ($audit['summary']['pageCount'] ?? 0);
    $conversionRate = $sessions > 0 ? $keyEvents / $sessions : 0;

    if (!$analytics['available'] && !$search['available']) {
        $status = 'setup';
        $headline = 'Les sources Google doivent encore etre reliees.';
        $body = 'SeoCean peut deja auditer le site, mais il manque les donnees de trafic pour expliquer d ou viennent les visiteurs et ce qu ils font.';
        $nextFocus = 'Priorite: terminer la connexion GA4 et Search Console.';
    } elseif ($sessions > 0 && $score >= 90) {
        $status = 'good';
        $headline = 'Bonne base: le site est visible et les mesures fonctionnent.';
        $body = 'Sur les ' . $days . ' derniers jours, le site a recu ' . visiocean_format_metric((float) $sessions) . ' visites et ' . visiocean_format_metric((float) $clicks) . ' clics depuis Google. Le socle SEO audite est sain avec ' . visiocean_format_metric($score, 1) . '/100.';
        $nextFocus = $conversionRate < 0.03
            ? 'Priorite: transformer davantage ces visites en demandes de contact.'
            : 'Priorite: amplifier les pages et recherches qui generent deja du trafic.';
    } else {
        $status = 'watch';
        $headline = 'Les donnees arrivent, il reste des leviers simples.';
        $body = 'SeoCean mesure maintenant le trafic, la recherche Google et l audit SEO. Les actions ci-dessous indiquent quoi faire en premier.';
        $nextFocus = 'Priorite: traiter les recommandations dans l ordre.';
    }

    return [
        'status' => $status,
        'headline' => $headline,
        'body' => $body,
        'nextFocus' => $nextFocus,
        'highlights' => [
            [
                'label' => 'Visites',
                'value' => $analytics['available'] ? visiocean_format_metric((float) $sessions) : '-',
                'meaning' => $analytics['available']
                    ? 'Nombre de passages sur le site pendant la periode.'
                    : 'GA4 doit etre connecte pour lire les visites.',
            ],
            [
                'label' => 'Visiteurs',
                'value' => $analytics['available'] ? visiocean_format_metric((float) $activeUsers) : '-',
                'meaning' => 'Estimation des personnes differentes qui ont visite le site.',
            ],
            [
                'label' => 'Actions',
                'value' => $analytics['available'] ? visiocean_format_metric($keyEvents, 1) : '-',
                'meaning' => 'Actions importantes mesurees par GA4: contact, appel, achat ou autre objectif.',
            ],
            [
                'label' => 'Google',
                'value' => $search['available'] ? visiocean_format_metric((float) $clicks) . ' clics' : '-',
                'meaning' => $search['available']
                    ? visiocean_format_metric((float) $impressions) . ' affichages dans les resultats, CTR ' . visiocean_format_metric($ctr * 100, 1) . '%.'
                    : 'Search Console doit etre connecte pour lire Google.',
            ],
            [
                'label' => 'SEO',
                'value' => $audit['available'] ? visiocean_format_metric($score, 1) . '/100' : '-',
                'meaning' => $audit['available']
                    ? visiocean_format_metric((float) $pageCount) . ' pages verifiees techniquement.'
                    : 'Lancez un audit pour obtenir le score technique.',
            ],
        ],
    ];
}

function visiocean_recommendations(array $settings, array $analytics, array $search, array $audit): array
{
    $items = [];
    $push = static function (string $priority, string $area, string $title, string $body, array $steps = [], string $impact = '') use (&$items): void {
        $items[] = visiocean_action_item($priority, $area, $title, $body, $steps, $impact);
    };

    if (trim((string) ($settings['siteUrl'] ?? '')) === '') {
        $push('high', 'Configuration', 'Renseigner l URL du site', 'Sans l adresse du site, Visiocean ne sait pas quelle presence en ligne analyser.', [
            'Ouvrez Configuration.',
            'Ajoutez l URL publique du site, par exemple https://renovboat.com.',
            'Enregistrez puis relancez un audit.',
        ], 'Permet de controler les pages et de relier les donnees au bon site.');
    }
    if (trim((string) ($settings['gaMeasurementId'] ?? '')) === '') {
        $push('medium', 'Analytics', 'Installer la balise GA4', 'La balise sert a compter les visites et les actions importantes.', [
            'Copiez la balise GA4 depuis Visiocean.',
            'Ajoutez-la dans le head du site public.',
            'Actualisez SeoCean apres quelques visites de test.',
        ], 'Sans balise, les decisions reposent sur trop peu de donnees.');
    }
    if (!$analytics['available']) {
        $push('medium', 'Analytics', 'Connecter Google Analytics', (string) ($analytics['message'] ?? 'GA4 non disponible.'), [
            'Verifiez que l ID de propriete GA4 est le bon numero de propriete.',
            'Connectez Google avec le compte qui a acces a cette propriete.',
            'Cliquez sur Actualiser.',
        ], 'GA4 explique combien de personnes viennent et si elles passent a l action.');
    } elseif ((int) ($analytics['summary']['sessions'] ?? 0) === 0) {
        $push('medium', 'Acquisition', 'Verifier le tracking', 'GA4 est connecte, mais aucune visite n apparait sur la periode.', [
            'Ouvrez le site public dans un autre onglet.',
            'Naviguez sur deux ou trois pages.',
            'Revenez ici et actualisez.',
        ], 'Confirme que la mesure fonctionne avant d analyser les chiffres.');
    }
    if (!$search['available']) {
        $push('medium', 'SEO', 'Connecter Search Console', (string) ($search['message'] ?? 'Search Console non disponible.'), [
            'Dans Configuration, utilisez la propriete Search Console exacte.',
            'Pour une propriete domaine, utilisez le format sc-domain:renovboat.com.',
            'Connectez Google avec un compte proprietaire ou utilisateur de cette propriete.',
        ], 'Search Console montre les mots recherches et les pages vues dans Google.');
    } elseif ((int) ($search['summary']['impressions'] ?? 0) > 0 && (float) ($search['summary']['ctr'] ?? 0) < 0.02) {
        $push('high', 'SEO', 'Rendre le resultat Google plus attirant', 'Google affiche deja le site, mais trop peu de personnes cliquent.', [
            'Ouvrez l onglet Recherches.',
            'Reperez les requetes avec beaucoup d impressions et peu de clics.',
            'Reecrivez le title et la meta description des pages concernees avec une promesse claire.',
        ], 'Un meilleur CTR peut apporter plus de visites sans creer de nouvelle page.');
    }
    if (!$audit['available']) {
        $push('medium', 'Technique', 'Lancer le premier audit SEO', 'L audit verifie les bases visibles par Google: title, meta description, H1, canonical, images alt, HTTPS et temps de chargement.', [
            'Cliquez sur Auditer.',
            'Ouvrez Pages SEO.',
            'Corrigez d abord les pages avec le score le plus bas.',
        ], 'Donne une liste simple de corrections page par page.');
    } elseif ((float) ($audit['summary']['averageScore'] ?? 0) < 80) {
        $push('high', 'Technique', 'Corriger les pages a faible score', 'Certaines bases SEO manquent encore sur les pages auditees.', [
            'Ouvrez Pages SEO.',
            'Commencez par les pages sous 80/100.',
            'Corrigez title, meta description, H1, canonical et images sans texte alternatif.',
        ], 'Ameliore la comprehension des pages par Google et les visiteurs.');
    }

    if ($analytics['available']) {
        $sessions = (int) round((float) ($analytics['summary']['sessions'] ?? 0));
        $keyEvents = (float) ($analytics['summary']['conversions'] ?? 0);
        $conversionRate = $sessions > 0 ? $keyEvents / $sessions : 0;
        if ($sessions > 0 && $keyEvents <= 0) {
            $push('high', 'Conversion', 'Definir ce qu est une bonne visite', 'Le site recoit des visites, mais aucune action importante n est mesuree.', [
                'Choisissez les objectifs utiles: formulaire, clic telephone, demande de devis, achat.',
                'Marquez ces actions comme evenements cles dans GA4.',
                'Ajoutez un bouton de contact visible sur les pages importantes.',
            ], 'Permet de savoir si le trafic apporte des prospects reels.');
        } elseif ($sessions > 0 && $conversionRate < 0.03) {
            $push('medium', 'Conversion', 'Transformer plus de visiteurs en contacts', 'Les visites existent, mais la part d actions importantes reste a surveiller.', [
                'Ajoutez un appel a l action clair en haut des pages fortes.',
                'Simplifiez le formulaire de contact.',
                'Mettez le telephone ou la demande de devis en evidence sur mobile.',
            ], 'Augmente les demandes sans dependre uniquement de plus de trafic.');
        }

        $direct = visiocean_channel_sessions($analytics, ['Direct']);
        $organic = visiocean_channel_sessions($analytics, ['Organic Search']);
        if ($direct > 0 && $direct >= $organic) {
            $push('low', 'Mesure', 'Mieux reconnaitre les sources des visiteurs', 'Une grande partie des visites arrive en direct. Cela peut inclure de vrais acces directs, mais aussi des liens non etiquetes.', [
                'Ajoutez des liens UTM dans les posts sociaux, emails et campagnes.',
                'Gardez le meme format de lien pour chaque source.',
                'Comparez ensuite Direct avec les autres canaux.',
            ], 'Aide a savoir quelles actions marketing apportent vraiment des visites.');
        }
    }

    if ($search['available']) {
        $queries = is_array($search['queries'] ?? null) ? $search['queries'] : [];
        $topQuery = $queries[0]['key'] ?? '';
        if (is_string($topQuery) && trim($topQuery) !== '') {
            $push('medium', 'SEO', 'Renforcer la recherche qui marche deja', 'La requete "' . trim($topQuery) . '" apporte deja des signaux Google.', [
                'Ouvrez la page qui ressort pour cette requete.',
                'Ajoutez un paragraphe utile qui repond mieux a l intention du visiteur.',
                'Ajoutez des liens internes depuis les pages proches du sujet.',
            ], 'Consolide les positions existantes avant de viser de nouveaux mots-cles.');
        }

        $summaryPosition = (float) ($search['summary']['position'] ?? 0);
        if ($summaryPosition > 8) {
            $push('medium', 'SEO', 'Gagner quelques places sur Google', 'La position moyenne indique que plusieurs resultats sont encore en bas de premiere page ou en page suivante.', [
                'Ciblez une requete avec impressions mais peu de clics.',
                'Ameliorez le contenu de la page correspondante.',
                'Ajoutez deux ou trois liens internes vers cette page.',
            ], 'Quelques places gagnees peuvent fortement augmenter les clics.');
        }
    }

    if ($audit['available'] && (float) ($audit['summary']['averageScore'] ?? 0) >= 90) {
        $issueCount = (int) ($audit['summary']['issueCount'] ?? 0);
        if ($issueCount > 0) {
            $push('low', 'SEO', 'Nettoyer les derniers points techniques', 'Le score global est bon, mais il reste des petites corrections page par page.', [
                'Ouvrez Pages SEO.',
                'Corrigez les titres trop courts ou trop longs.',
                'Ajoutez les textes alternatifs manquants sur les images importantes.',
            ], 'Protège les bons resultats et evite que les petites erreurs s accumulent.');
        } else {
            $push('low', 'Routine', 'Garder le rythme de suivi', 'Le socle audite est propre. Le plus utile est maintenant de suivre l evolution.', [
                'Lancez un audit apres chaque grosse modification du site.',
                'Comparez les donnees sur 30 jours puis 90 jours.',
                'Ajoutez de nouvelles pages seulement quand elles repondent a une recherche claire.',
            ], 'Maintient la qualite sans creer de travail inutile.');
        }
    }

    return array_slice($items, 0, 6);
}

function visiocean_dashboard(PDO $pdo, array $user, int $days): array
{
    $canManage = visiocean_is_admin($user);
    $settings = visiocean_private_settings($pdo);
    $publicSettings = visiocean_public_settings($pdo, $canManage);
    $analytics = visiocean_google_analytics($settings, $days);
    $search = visiocean_search_console($settings, $days);
    $audit = visiocean_audit_payload($pdo);

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'currentUser' => visiocean_public_user($user),
        'canManage' => $canManage,
        'periodDays' => max(1, min(180, $days)),
        'settings' => $publicSettings,
        'analytics' => $analytics,
        'search' => $search,
        'audit' => $audit,
        'noviceSummary' => visiocean_novice_summary($analytics, $search, $audit, max(1, min(180, $days))),
        'recommendations' => visiocean_recommendations($publicSettings, $analytics, $search, $audit),
        'trackingSnippet' => visiocean_tracking_snippet($publicSettings),
    ];
}
