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
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

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

function visiocean_normalize_url(string $url, bool $allowSearchConsoleDomain = false): string
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

    return rtrim($url, '/');
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
    $clientEmail = trim((string) ($decoded['client_email'] ?? ''));
    $privateKey = trim((string) ($decoded['private_key'] ?? ''));
    if ($clientEmail === '' || $privateKey === '') {
        throw new InvalidArgumentException('Le compte de service doit contenir client_email et private_key.');
    }

    return mb_substr($clientEmail, 0, 190);
}

function visiocean_save_settings(PDO $pdo, array $input): array
{
    $settings = is_array($input['settings'] ?? null) ? $input['settings'] : $input;
    $existing = visiocean_settings_row($pdo);

    $siteUrl = visiocean_normalize_url((string) ($settings['siteUrl'] ?? ''));
    $searchConsoleUrl = visiocean_normalize_url((string) ($settings['searchConsoleSiteUrl'] ?? $siteUrl), true);
    $measurementId = visiocean_validate_measurement_id((string) ($settings['gaMeasurementId'] ?? ''));
    $propertyId = visiocean_normalize_property_id((string) ($settings['gaPropertyId'] ?? ''));
    $targetCountry = strtoupper(mb_substr(preg_replace('/[^a-z]/i', '', (string) ($settings['targetCountry'] ?? 'FR')) ?? 'FR', 0, 2));
    $targetLanguage = strtolower(mb_substr(preg_replace('/[^a-z-]/i', '', (string) ($settings['targetLanguage'] ?? 'fr')) ?? 'fr', 0, 8));
    $keywords = visiocean_normalize_list($settings['targetKeywords'] ?? [], 80);
    $competitors = visiocean_normalize_list($settings['competitors'] ?? [], 20);

    $serviceAccountCipher = $existing['service_account_cipher'] ?? null;
    $serviceAccountHint = $existing['service_account_hint'] ?? null;
    $serviceAccountJson = trim((string) ($settings['serviceAccountJson'] ?? ''));
    if (!empty($settings['clearServiceAccount'])) {
        $serviceAccountCipher = null;
        $serviceAccountHint = null;
    } elseif ($serviceAccountJson !== '') {
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
        'site_url' => $siteUrl !== '' ? $siteUrl : null,
        'ga_measurement_id' => $measurementId !== '' ? $measurementId : null,
        'ga_property_id' => $propertyId !== '' ? $propertyId : null,
        'search_console_site_url' => $searchConsoleUrl !== '' ? $searchConsoleUrl : null,
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
        CURLOPT_HEADER => false,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = $body;
    }

    $caBundle = oceanos_ca_bundle_path();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }

    curl_setopt_array($curl, $options);
    $responseBody = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    $durationMs = (int) round(((float) curl_getinfo($curl, CURLINFO_TOTAL_TIME)) * 1000);
    $error = curl_error($curl);
    curl_close($curl);

    if ($responseBody === false) {
        throw new RuntimeException($error !== '' ? $error : 'Requete HTTP impossible.');
    }

    return [
        'status' => $status,
        'body' => (string) $responseBody,
        'contentType' => $contentType,
        'durationMs' => $durationMs,
    ];
}

function visiocean_json_request(string $url, string $accessToken, array $payload): array
{
    $response = visiocean_http_request('POST', $url, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
        'Accept: application/json',
    ], json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 45);

    $decoded = json_decode((string) $response['body'], true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Reponse Google invalide.');
    }
    if ((int) $response['status'] >= 400) {
        $message = (string) ($decoded['error']['message'] ?? 'Google a refuse la requete.');
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
    static $cache = [];

    $json = trim((string) ($settings['serviceAccountJson'] ?? ''));
    if ($json === '') {
        throw new RuntimeException('Compte de service Google non configure.');
    }
    $account = json_decode($json, true);
    if (!is_array($account)) {
        throw new RuntimeException('Compte de service Google invalide.');
    }
    $clientEmail = trim((string) ($account['client_email'] ?? ''));
    $privateKey = (string) ($account['private_key'] ?? '');
    $tokenUri = trim((string) ($account['token_uri'] ?? 'https://oauth2.googleapis.com/token'));
    if ($clientEmail === '' || $privateKey === '') {
        throw new RuntimeException('Compte de service Google incomplet.');
    }
    if (!function_exists('openssl_sign')) {
        throw new RuntimeException('L extension OpenSSL est requise pour Google.');
    }

    $scope = implode(' ', array_values(array_unique($scopes)));
    $cacheKey = sha1($clientEmail . '|' . $scope);
    if (isset($cache[$cacheKey]) && $cache[$cacheKey]['expiresAt'] > time() + 60) {
        return (string) $cache[$cacheKey]['token'];
    }

    $now = time();
    $header = visiocean_base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
    $claims = visiocean_base64url(json_encode([
        'iss' => $clientEmail,
        'scope' => $scope,
        'aud' => $tokenUri,
        'iat' => $now,
        'exp' => $now + 3600,
    ], JSON_UNESCAPED_SLASHES));
    $unsigned = $header . '.' . $claims;
    $signature = '';
    $signed = openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$signed) {
        throw new RuntimeException('Signature Google impossible avec cette cle privee.');
    }

    $assertion = $unsigned . '.' . visiocean_base64url($signature);
    $response = visiocean_http_request('POST', $tokenUri, [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json',
    ], http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $assertion,
    ], '', '&', PHP_QUERY_RFC3986), 30);

    $decoded = json_decode((string) $response['body'], true);
    if (!is_array($decoded) || (int) $response['status'] >= 400) {
        $message = is_array($decoded) ? (string) ($decoded['error_description'] ?? $decoded['error'] ?? '') : '';
        throw new RuntimeException($message !== '' ? $message : 'Authentification Google refusee.');
    }

    $token = (string) ($decoded['access_token'] ?? '');
    if ($token === '') {
        throw new RuntimeException('Google n a pas retourne de jeton d acces.');
    }

    $cache[$cacheKey] = [
        'token' => $token,
        'expiresAt' => $now + (int) ($decoded['expires_in'] ?? 3600),
    ];

    return $token;
}

function visiocean_date_range(int $days): array
{
    $days = in_array($days, [7, 30, 90], true) ? $days : 30;

    return [
        'days' => $days,
        'startDate' => (new DateTimeImmutable('today'))->modify('-' . $days . ' days')->format('Y-m-d'),
        'endDate' => (new DateTimeImmutable('yesterday'))->format('Y-m-d'),
        'gaStartDate' => $days . 'daysAgo',
        'gaEndDate' => 'yesterday',
    ];
}

function visiocean_metric_value(array $row, int $index, float $fallback = 0.0): float
{
    $values = is_array($row['metricValues'] ?? null) ? $row['metricValues'] : [];
    return isset($values[$index]['value']) ? (float) $values[$index]['value'] : $fallback;
}

function visiocean_dimension_value(array $row, int $index, string $fallback = ''): string
{
    $values = is_array($row['dimensionValues'] ?? null) ? $row['dimensionValues'] : [];
    return isset($values[$index]['value']) ? (string) $values[$index]['value'] : $fallback;
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
        $dateRanges = [[
            'startDate' => $range['gaStartDate'],
            'endDate' => $range['gaEndDate'],
        ]];

        $summaryResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => $dateRanges,
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
                ['name' => 'eventCount'],
                ['name' => 'engagementRate'],
                ['name' => 'averageSessionDuration'],
            ],
        ]);
        $summaryRow = is_array($summaryResponse['rows'][0] ?? null) ? $summaryResponse['rows'][0] : [];

        $channelResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => $dateRanges,
            'dimensions' => [['name' => 'sessionDefaultChannelGroup']],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
            ],
            'limit' => 8,
            'orderBys' => [[
                'metric' => ['metricName' => 'sessions'],
                'desc' => true,
            ]],
        ]);

        $pageResponse = visiocean_json_request($baseUrl, $token, [
            'dateRanges' => $dateRanges,
            'dimensions' => [['name' => 'pagePathPlusQueryString']],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'keyEvents'],
                ['name' => 'engagementRate'],
            ],
            'limit' => 12,
            'orderBys' => [[
                'metric' => ['metricName' => 'sessions'],
                'desc' => true,
            ]],
        ]);

        return [
            'available' => true,
            'message' => 'Donnees Google Analytics chargees.',
            'summary' => [
                'sessions' => (int) round(visiocean_metric_value($summaryRow, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($summaryRow, 1)),
                'conversions' => (float) visiocean_metric_value($summaryRow, 2),
                'eventCount' => (int) round(visiocean_metric_value($summaryRow, 3)),
                'engagementRate' => visiocean_metric_value($summaryRow, 4),
                'averageSessionDuration' => visiocean_metric_value($summaryRow, 5),
            ],
            'channels' => array_map(static fn(array $row): array => [
                'name' => visiocean_dimension_value($row, 0, 'Non defini'),
                'sessions' => (int) round(visiocean_metric_value($row, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($row, 1)),
                'conversions' => (float) visiocean_metric_value($row, 2),
            ], is_array($channelResponse['rows'] ?? null) ? $channelResponse['rows'] : []),
            'pages' => array_map(static fn(array $row): array => [
                'path' => visiocean_dimension_value($row, 0, '/'),
                'sessions' => (int) round(visiocean_metric_value($row, 0)),
                'activeUsers' => (int) round(visiocean_metric_value($row, 1)),
                'conversions' => (float) visiocean_metric_value($row, 2),
                'engagementRate' => visiocean_metric_value($row, 3),
            ], is_array($pageResponse['rows'] ?? null) ? $pageResponse['rows'] : []),
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
            'rowLimit' => 12,
            'dataState' => 'final',
        ];

        $summaryResponse = visiocean_json_request($baseUrl, $token, [
            ...$basePayload,
            'rowLimit' => 1,
        ]);
        $queryResponse = visiocean_json_request($baseUrl, $token, [
            ...$basePayload,
            'dimensions' => ['query'],
        ]);
        $pageResponse = visiocean_json_request($baseUrl, $token, [
            ...$basePayload,
            'dimensions' => ['page'],
        ]);

        $summaryRow = is_array($summaryResponse['rows'][0] ?? null) ? $summaryResponse['rows'][0] : [];

        $normalizeSearchRow = static fn(array $row): array => [
            'key' => (string) (($row['keys'][0] ?? '') ?: 'Non defini'),
            'clicks' => (int) round((float) ($row['clicks'] ?? 0)),
            'impressions' => (int) round((float) ($row['impressions'] ?? 0)),
            'ctr' => (float) ($row['ctr'] ?? 0),
            'position' => (float) ($row['position'] ?? 0),
        ];

        return [
            'available' => true,
            'message' => 'Donnees Search Console chargees.',
            'summary' => [
                'clicks' => (int) round((float) ($summaryRow['clicks'] ?? 0)),
                'impressions' => (int) round((float) ($summaryRow['impressions'] ?? 0)),
                'ctr' => (float) ($summaryRow['ctr'] ?? 0),
                'position' => (float) ($summaryRow['position'] ?? 0),
            ],
            'queries' => array_map($normalizeSearchRow, is_array($queryResponse['rows'] ?? null) ? $queryResponse['rows'] : []),
            'pages' => array_map($normalizeSearchRow, is_array($pageResponse['rows'] ?? null) ? $pageResponse['rows'] : []),
        ];
    } catch (Throwable $exception) {
        return visiocean_empty_search($exception->getMessage());
    }
}

function visiocean_text_from_nodes(DOMXPath $xpath, string $query): string
{
    $nodes = $xpath->query($query);
    $node = $nodes instanceof DOMNodeList ? $nodes->item(0) : null;
    return $node ? trim(preg_replace('/\s+/', ' ', $node->textContent) ?? '') : '';
}

function visiocean_attr_from_nodes(DOMXPath $xpath, string $query, string $attribute): string
{
    $nodes = $xpath->query($query);
    $node = $nodes instanceof DOMNodeList ? $nodes->item(0) : null;
    return $node instanceof DOMElement ? trim($node->getAttribute($attribute)) : '';
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

    $parts = parse_url($baseUrl);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return '';
    }
    $root = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (str_starts_with($href, '//')) {
        return $parts['scheme'] . ':' . $href;
    }
    if (str_starts_with($href, '/')) {
        return strtok($root . $href, '#') ?: '';
    }

    $path = (string) ($parts['path'] ?? '/');
    $dir = preg_replace('#/[^/]*$#', '/', $path) ?: '/';
    $absolute = $root . $dir . $href;
    $segments = [];
    foreach (explode('/', parse_url($absolute, PHP_URL_PATH) ?: '') as $segment) {
        if ($segment === '' || $segment === '.') {
            continue;
        }
        if ($segment === '..') {
            array_pop($segments);
            continue;
        }
        $segments[] = $segment;
    }

    return $root . '/' . implode('/', $segments);
}

function visiocean_same_host(string $a, string $b): bool
{
    return mb_strtolower((string) parse_url($a, PHP_URL_HOST)) === mb_strtolower((string) parse_url($b, PHP_URL_HOST));
}

function visiocean_audit_page(string $url, string $siteUrl): array
{
    $response = visiocean_http_request('GET', $url, ['Accept: text/html,application/xhtml+xml'], null, 25);
    $body = (string) $response['body'];
    $status = (int) $response['status'];
    $issues = [];
    $links = [];

    $title = '';
    $description = '';
    $h1 = '';
    $h1Count = 0;
    $canonical = '';
    $wordCount = 0;
    $imageCount = 0;
    $imagesMissingAlt = 0;
    $internalLinks = 0;
    $externalLinks = 0;

    if ($status < 200 || $status >= 400) {
        $issues[] = 'Code HTTP ' . $status;
    }

    if (class_exists('DOMDocument') && trim($body) !== '') {
        $previous = libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $loaded = $dom->loadHTML($body, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if ($loaded) {
            $xpath = new DOMXPath($dom);
            $title = visiocean_text_from_nodes($xpath, '//title');
            $description = visiocean_attr_from_nodes($xpath, '//meta[translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="description"]', 'content');
            $h1 = visiocean_text_from_nodes($xpath, '//h1');
            $h1Nodes = $xpath->query('//h1');
            $h1Count = $h1Nodes instanceof DOMNodeList ? $h1Nodes->length : 0;
            $canonical = visiocean_attr_from_nodes($xpath, '//link[translate(@rel, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="canonical"]', 'href');
            $text = trim(preg_replace('/\s+/', ' ', $dom->textContent) ?? '');
            $wordCount = $text === '' ? 0 : count(preg_split('/\s+/', $text) ?: []);

            $images = $xpath->query('//img') ?: [];
            $imageCount = $images instanceof DOMNodeList ? $images->length : 0;
            if ($images instanceof DOMNodeList) {
                foreach ($images as $image) {
                    if ($image instanceof DOMElement && trim($image->getAttribute('alt')) === '') {
                        $imagesMissingAlt++;
                    }
                }
            }

            $anchors = $xpath->query('//a[@href]') ?: [];
            if ($anchors instanceof DOMNodeList) {
                foreach ($anchors as $anchor) {
                    if (!$anchor instanceof DOMElement) {
                        continue;
                    }
                    $absolute = visiocean_absolute_url($url, $anchor->getAttribute('href'));
                    if ($absolute === '') {
                        continue;
                    }
                    if (visiocean_same_host($absolute, $siteUrl)) {
                        $internalLinks++;
                        if (!preg_match('/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|css|js)$/i', parse_url($absolute, PHP_URL_PATH) ?: '')) {
                            $links[$absolute] = true;
                        }
                    } else {
                        $externalLinks++;
                    }
                }
            }
        }
    } else {
        $issues[] = 'Analyse HTML indisponible';
    }

    $titleLength = mb_strlen($title);
    $descriptionLength = mb_strlen($description);
    if ($titleLength < 30 || $titleLength > 65) {
        $issues[] = 'Title a optimiser';
    }
    if ($descriptionLength < 80 || $descriptionLength > 170) {
        $issues[] = 'Meta description a optimiser';
    }
    if ($h1Count !== 1) {
        $issues[] = 'Un seul H1 attendu';
    }
    if ($canonical === '') {
        $issues[] = 'Canonical manquant';
    }
    if ($imagesMissingAlt > 0) {
        $issues[] = $imagesMissingAlt . ' image(s) sans alt';
    }
    if ($wordCount > 0 && $wordCount < 250) {
        $issues[] = 'Contenu trop court';
    }
    if ((int) $response['durationMs'] > 2500) {
        $issues[] = 'Chargement lent';
    }
    if ((string) parse_url($url, PHP_URL_SCHEME) !== 'https') {
        $issues[] = 'HTTPS recommande';
    }

    $score = 100;
    foreach ($issues as $issue) {
        if (str_starts_with($issue, 'Code HTTP')) {
            $score -= 35;
        } elseif ($issue === 'Title a optimiser' || $issue === 'Meta description a optimiser') {
            $score -= 12;
        } elseif ($issue === 'Un seul H1 attendu') {
            $score -= 10;
        } elseif ($issue === 'Canonical manquant') {
            $score -= 6;
        } elseif (str_contains($issue, 'image')) {
            $score -= min(12, max(3, $imagesMissingAlt * 3));
        } else {
            $score -= 8;
        }
    }
    $score = max(0, min(100, $score));

    return [
        'url' => $url,
        'statusCode' => $status,
        'title' => mb_substr($title, 0, 255),
        'metaDescription' => mb_substr($description, 0, 500),
        'h1' => mb_substr($h1, 0, 255),
        'canonical' => mb_substr($canonical, 0, 500),
        'wordCount' => $wordCount,
        'imageCount' => $imageCount,
        'imagesMissingAlt' => $imagesMissingAlt,
        'internalLinks' => $internalLinks,
        'externalLinks' => $externalLinks,
        'loadMs' => (int) $response['durationMs'],
        'score' => $score,
        'issues' => array_values(array_unique($issues)),
        'discoveredLinks' => array_keys($links),
    ];
}

function visiocean_store_audit(PDO $pdo, array $page): void
{
    $statement = $pdo->prepare(
        'INSERT INTO visiocean_page_audits
            (url, status_code, title, meta_description, h1, canonical, word_count, image_count, images_missing_alt, internal_links, external_links, load_ms, score, issues_json, checked_at)
         VALUES
            (:url, :status_code, :title, :meta_description, :h1, :canonical, :word_count, :image_count, :images_missing_alt, :internal_links, :external_links, :load_ms, :score, :issues_json, CURRENT_TIMESTAMP)
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
        'url' => mb_substr((string) $page['url'], 0, 500),
        'status_code' => (int) $page['statusCode'],
        'title' => (string) $page['title'],
        'meta_description' => (string) $page['metaDescription'],
        'h1' => (string) $page['h1'],
        'canonical' => (string) $page['canonical'],
        'word_count' => (int) $page['wordCount'],
        'image_count' => (int) $page['imageCount'],
        'images_missing_alt' => (int) $page['imagesMissingAlt'],
        'internal_links' => (int) $page['internalLinks'],
        'external_links' => (int) $page['externalLinks'],
        'load_ms' => (int) $page['loadMs'],
        'score' => (int) $page['score'],
        'issues_json' => json_encode($page['issues'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function visiocean_run_audit(PDO $pdo, array $settings, int $limit = 12): array
{
    $siteUrl = visiocean_normalize_url((string) ($settings['siteUrl'] ?? ''));
    if ($siteUrl === '') {
        throw new InvalidArgumentException('Configurez l URL du site avant de lancer un audit.');
    }

    $queue = [$siteUrl];
    $seen = [];
    $audited = 0;
    while ($queue !== [] && $audited < $limit) {
        $url = array_shift($queue);
        $url = rtrim((string) $url, '/');
        if ($url === '' || isset($seen[$url])) {
            continue;
        }
        $seen[$url] = true;

        try {
            $page = visiocean_audit_page($url, $siteUrl);
            visiocean_store_audit($pdo, $page);
            $audited++;
            foreach ($page['discoveredLinks'] as $link) {
                $link = rtrim((string) $link, '/');
                if (!isset($seen[$link]) && count($queue) < $limit * 3) {
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
            $audited++;
        }
    }

    return visiocean_audit_payload($pdo);
}

function visiocean_audit_payload(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT *
         FROM visiocean_page_audits
         ORDER BY checked_at DESC, score ASC
         LIMIT 50'
    )->fetchAll();

    $pages = array_map(static fn(array $row): array => [
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
    ], is_array($rows) ? $rows : []);

    $averageScore = $pages === [] ? 0 : array_sum(array_map(static fn(array $page): int => (int) $page['score'], $pages)) / count($pages);
    $issueCount = array_sum(array_map(static fn(array $page): int => count($page['issues']), $pages));

    return [
        'available' => $pages !== [],
        'summary' => [
            'pageCount' => count($pages),
            'averageScore' => round($averageScore, 1),
            'issueCount' => $issueCount,
            'lastCheckedAt' => $pages[0]['checkedAt'] ?? null,
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

    return '<script async src="https://www.googletagmanager.com/gtag/js?id=' . htmlspecialchars($measurementId, ENT_QUOTES, 'UTF-8') . '"></script>' . "\n"
        . '<script>' . "\n"
        . '  window.dataLayer = window.dataLayer || [];' . "\n"
        . '  function gtag(){dataLayer.push(arguments);}' . "\n"
        . "  gtag('js', new Date());" . "\n"
        . "  gtag('config', '" . htmlspecialchars($measurementId, ENT_QUOTES, 'UTF-8') . "');" . "\n"
        . '</script>';
}

function visiocean_recommendations(array $settings, array $analytics, array $search, array $audit): array
{
    $items = [];
    $push = static function (string $priority, string $area, string $title, string $body) use (&$items): void {
        $items[] = [
            'priority' => $priority,
            'area' => $area,
            'title' => $title,
            'body' => $body,
        ];
    };

    if (trim((string) ($settings['siteUrl'] ?? '')) === '') {
        $push('high', 'Configuration', 'Declarer le site a suivre', 'Ajoutez l URL principale pour activer le crawl SEO et centraliser les recommandations.');
    }
    if (trim((string) ($settings['gaMeasurementId'] ?? '')) === '') {
        $push('medium', 'Analytics', 'Installer le tag GA4', 'Ajoutez l ID de mesure pour generer le script a placer sur le site public.');
    }
    if (!$analytics['available']) {
        $push('medium', 'Analytics', 'Brancher la lecture GA4', (string) ($analytics['message'] ?? 'Ajoutez une propriete GA4 et un compte de service Google.'));
    } elseif ((int) ($analytics['summary']['sessions'] ?? 0) < 100) {
        $push('medium', 'Acquisition', 'Augmenter le volume de sessions', 'Les sessions restent faibles sur la periode. Priorisez SEO local, contenus longue traine et campagnes email/social.');
    }
    if (!$search['available']) {
        $push('medium', 'SEO', 'Relier Search Console', (string) ($search['message'] ?? 'Ajoutez la propriete Search Console pour suivre requetes et pages.'));
    } else {
        $ctr = (float) ($search['summary']['ctr'] ?? 0);
        $impressions = (int) ($search['summary']['impressions'] ?? 0);
        if ($impressions > 500 && $ctr < 0.025) {
            $push('high', 'SEO', 'Ameliorer les titres SERP', 'Beaucoup d impressions mais un CTR bas : retravaillez title, meta description et promesse des pages qui apparaissent.');
        }
        foreach (array_slice($search['queries'] ?? [], 0, 5) as $query) {
            if ((float) ($query['position'] ?? 0) > 8 && (int) ($query['impressions'] ?? 0) > 80) {
                $push('medium', 'Contenu', 'Renforcer "' . (string) $query['key'] . '"', 'La requete a des impressions mais reste loin du top 3. Creez ou enrichissez une page ciblee.');
                break;
            }
        }
    }
    if (!$audit['available']) {
        $push('medium', 'Technique', 'Lancer le premier audit SEO', 'Le crawler Visiocean verifiera title, meta description, H1, canonical, images alt, HTTPS et temps de chargement.');
    } else {
        foreach ($audit['pages'] as $page) {
            if ((int) ($page['score'] ?? 100) < 75) {
                $push('high', 'Technique', 'Corriger ' . parse_url((string) $page['url'], PHP_URL_PATH), implode(', ', array_slice($page['issues'] ?? [], 0, 3)));
                break;
            }
        }
    }

    if ($items === []) {
        $push('low', 'Suivi', 'Maintenir le rythme', 'Les indicateurs principaux sont en place. Continuez a suivre les pages faibles et les requetes proches du top 3.');
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
        'currentUser' => oceanos_public_user($user),
        'canManage' => $canManage,
        'periodDays' => in_array($days, [7, 30, 90], true) ? $days : 30,
        'settings' => $publicSettings,
        'analytics' => $analytics,
        'search' => $search,
        'audit' => $audit,
        'recommendations' => visiocean_recommendations($publicSettings, $analytics, $search, $audit),
        'trackingSnippet' => visiocean_tracking_snippet($publicSettings),
    ];
}
