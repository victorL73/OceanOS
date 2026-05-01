<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const VISIOCEAN_MODULE_ID = 'visiocean';
const VISIOCEAN_USER_AGENT = 'OceanOS Visiocean/1.0 (+https://oceanos.local)';

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
            'message' => 'Visiocean n est pas active pour ce compte.',
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
        throw new RuntimeException('Configuration Visiocean introuvable.');
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
    return visiocean_origin_url() . '/Visiocean/api/oauth-callback.php';
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
             service_account_hint = :service_account_hint
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

function visiocean_google_access_token(array $settings, array $scopes): string
{
    $json = trim((string) ($settings['serviceAccountJson'] ?? ''));
    if ($json === '') {
        throw new RuntimeException('Ajoutez un compte de service Google autorise.');
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
    if (trim((string) ($settings['serviceAccountJson'] ?? '')) === '') {
        return visiocean_empty_analytics('Ajoutez un compte de service Google autorise sur la propriete GA4.');
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
    if (trim((string) ($settings['serviceAccountJson'] ?? '')) === '') {
        return visiocean_empty_search('Ajoutez un compte de service Google autorise sur Search Console.');
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

function visiocean_recommendations(array $settings, array $analytics, array $search, array $audit): array
{
    $items = [];
    $push = static function (string $priority, string $area, string $title, string $body) use (&$items): void {
        $items[] = compact('priority', 'area', 'title', 'body');
    };

    if (trim((string) ($settings['siteUrl'] ?? '')) === '') {
        $push('high', 'Configuration', 'Renseigner l URL du site', 'Elle sert a generer la balise GA4 et a lancer les audits techniques.');
    }
    if (trim((string) ($settings['gaMeasurementId'] ?? '')) === '') {
        $push('medium', 'Analytics', 'Installer la balise GA4', 'Ajoutez l ID de mesure pour suivre les sessions et evenements cles.');
    }
    if (!$analytics['available']) {
        $push('medium', 'Analytics', 'Connecter Google Analytics', (string) ($analytics['message'] ?? 'GA4 non disponible.'));
    } elseif ((int) ($analytics['summary']['sessions'] ?? 0) === 0) {
        $push('medium', 'Acquisition', 'Verifier le tracking', 'Aucune session GA4 detectee sur la periode selectionnee.');
    }
    if (!$search['available']) {
        $push('medium', 'SEO', 'Connecter Search Console', (string) ($search['message'] ?? 'Search Console non disponible.'));
    } elseif ((int) ($search['summary']['impressions'] ?? 0) > 0 && (float) ($search['summary']['ctr'] ?? 0) < 0.02) {
        $push('high', 'SEO', 'Ameliorer les titres dans Google', 'Le CTR organique est faible par rapport aux impressions.');
    }
    if (!$audit['available']) {
        $push('medium', 'Technique', 'Lancer le premier audit SEO', 'Le crawler Visiocean verifiera title, meta description, H1, canonical, images alt, HTTPS et temps de chargement.');
    } elseif ((float) ($audit['summary']['averageScore'] ?? 0) < 80) {
        $push('high', 'Technique', 'Corriger les pages a faible score', 'Priorisez les pages avec title, meta description, H1 ou canonical manquants.');
    }

    return array_slice($items, 0, 8);
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
        'recommendations' => visiocean_recommendations($publicSettings, $analytics, $search, $audit),
        'trackingSnippet' => visiocean_tracking_snippet($publicSettings),
    ];
}
