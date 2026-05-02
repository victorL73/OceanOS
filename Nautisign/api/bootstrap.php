<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

$nautisignDevisBootstrap = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Devis' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';
if (is_file($nautisignDevisBootstrap)) {
    require_once $nautisignDevisBootstrap;
}

const NAUTISIGN_MODULE_ID = 'nautisign';

function nautisign_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function nautisign_read_json_request(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Requete JSON invalide.');
    }

    return $decoded;
}

function nautisign_pdo(): PDO
{
    $pdo = oceanos_pdo();
    nautisign_ensure_schema($pdo);
    return $pdo;
}

function nautisign_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautisign_requests (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            owner_user_id BIGINT UNSIGNED NOT NULL,
            token VARCHAR(120) NOT NULL UNIQUE,
            quote_filename VARCHAR(255) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            signer_name VARCHAR(190) NULL,
            signer_email VARCHAR(190) NULL,
            signer_ip_hash VARCHAR(64) NULL,
            signer_user_agent VARCHAR(500) NULL,
            original_pdf_hash CHAR(64) NULL,
            signature_hash CHAR(64) NULL,
            signed_pdf_hash CHAR(64) NULL,
            signed_pdf_path VARCHAR(500) NULL,
            expires_at DATETIME NULL,
            signed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_nautisign_owner_updated (owner_user_id, updated_at),
            INDEX idx_nautisign_status_updated (status, updated_at),
            CONSTRAINT fk_nautisign_owner FOREIGN KEY (owner_user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    nautisign_ensure_column($pdo, 'nautisign_requests', 'original_pdf_hash', 'CHAR(64) NULL AFTER signer_user_agent');
    nautisign_ensure_column($pdo, 'nautisign_requests', 'signature_hash', 'CHAR(64) NULL AFTER original_pdf_hash');
    nautisign_ensure_column($pdo, 'nautisign_requests', 'signed_pdf_hash', 'CHAR(64) NULL AFTER signature_hash');
    nautisign_ensure_column($pdo, 'nautisign_requests', 'signed_pdf_path', 'VARCHAR(500) NULL AFTER signed_pdf_hash');
    nautisign_ensure_column($pdo, 'nautisign_requests', 'expires_at', 'DATETIME NULL AFTER signed_pdf_path');
    nautisign_ensure_column($pdo, 'nautisign_requests', 'signed_at', 'DATETIME NULL AFTER expires_at');
}

function nautisign_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    if (!oceanos_column_exists($pdo, $table, $column)) {
        $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    }
}

function nautisign_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(NAUTISIGN_MODULE_ID, $visibleModules, true)) {
        nautisign_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Nautisign n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function nautisign_public_user(array $user): array
{
    return oceanos_public_user($user);
}

function nautisign_is_manager(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function nautisign_can_manage_request(array $request, array $user): bool
{
    return nautisign_is_manager($user) || (int) ($request['owner_user_id'] ?? 0) === (int) ($user['id'] ?? 0);
}

function nautisign_module_root(): string
{
    return dirname(__DIR__);
}

function nautisign_www_root(): string
{
    return dirname(__DIR__, 2);
}

function nautisign_quotes_dir(): string
{
    return nautisign_www_root()
        . DIRECTORY_SEPARATOR . 'Devis'
        . DIRECTORY_SEPARATOR . 'storage'
        . DIRECTORY_SEPARATOR . 'quotes';
}

function nautisign_quote_sources(): array
{
    return [
        'devis' => [
            'label' => 'Devis',
            'relativePath' => 'Devis/storage/quotes',
            'dir' => nautisign_quotes_dir(),
        ],
    ];
}

function nautisign_default_quote_source(): string
{
    return 'devis';
}

function nautisign_devis_available(PDO $pdo): bool
{
    return oceanos_table_exists($pdo, 'devis_quotes');
}

function nautisign_devis_pdf_path_from_relative(mixed $relativePath): string
{
    $relativePath = trim((string) $relativePath);
    if ($relativePath === '') {
        return '';
    }

    $relativePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    $path = nautisign_www_root()
        . DIRECTORY_SEPARATOR . 'Devis'
        . DIRECTORY_SEPARATOR . ltrim($relativePath, DIRECTORY_SEPARATOR);
    $quotesRoot = realpath(nautisign_quotes_dir());
    $realPath = is_file($path) ? realpath($path) : false;
    if ($quotesRoot === false || $realPath === false || strpos($realPath, $quotesRoot . DIRECTORY_SEPARATOR) !== 0) {
        return '';
    }

    return $realPath;
}

function nautisign_devis_quote_rows(PDO $pdo, array $user, int $limit = 200): array
{
    if (!nautisign_devis_available($pdo)) {
        return [];
    }

    $limit = max(1, min(500, $limit));
    if (nautisign_is_manager($user)) {
        $statement = $pdo->query('SELECT * FROM devis_quotes ORDER BY date_updated DESC, id DESC LIMIT ' . $limit);
    } else {
        $statement = $pdo->prepare('SELECT * FROM devis_quotes WHERE user_id = :user_id ORDER BY date_updated DESC, id DESC LIMIT ' . $limit);
        $statement->execute(['user_id' => (int) $user['id']]);
    }

    $rows = $statement ? $statement->fetchAll() : [];
    return is_array($rows) ? array_values(array_filter($rows, 'is_array')) : [];
}

function nautisign_devis_metadata_from_row(array $row, string $filename): array
{
    return [
        'quoteId' => (int) ($row['id'] ?? 0),
        'quoteReference' => (string) ($row['reference'] ?? ''),
        'clientName' => (string) ($row['client_name'] ?? ''),
        'clientEmail' => (string) ($row['client_email'] ?? ''),
        'quoteStatus' => (string) ($row['status'] ?? ''),
        'filename' => $filename,
    ];
}

function nautisign_devis_reference_from_filename(string $filename): string
{
    $stem = preg_replace('/\.pdf$/i', '', nautisign_safe_basename($filename)) ?: '';
    if (preg_match('/^(DEV-\d{4}-\d+)/i', $stem, $matches)) {
        return strtoupper((string) $matches[1]);
    }

    return '';
}

function nautisign_devis_quote_metadata(PDO $pdo, array $user): array
{
    $metadata = [];
    if (!nautisign_devis_available($pdo)) {
        return $metadata;
    }

    foreach (nautisign_devis_quote_rows($pdo, $user) as $row) {
        $path = nautisign_devis_pdf_path_from_relative($row['pdf_file_path'] ?? '');
        if ($path === '') {
            continue;
        }
        $filename = basename($path);
        $rowMetadata = nautisign_devis_metadata_from_row($row, $filename);
        $metadata[$filename] = $rowMetadata;
        if ((string) ($row['reference'] ?? '') !== '') {
            $metadata['ref:' . strtoupper((string) $row['reference'])] = $rowMetadata;
        }
    }

    return $metadata;
}

function nautisign_devis_quote_contact(PDO $pdo, array $user, string $reference): array
{
    $parsed = nautisign_parse_quote_reference($reference);
    if ((string) ($parsed['source'] ?? '') !== 'devis') {
        return [];
    }

    $filename = (string) ($parsed['filename'] ?? '');
    if ($filename === '') {
        return [];
    }

    foreach (nautisign_devis_quote_rows($pdo, $user) as $row) {
        $path = nautisign_devis_pdf_path_from_relative($row['pdf_file_path'] ?? '');
        if ($path !== '' && basename($path) === $filename) {
            return nautisign_devis_metadata_from_row($row, $filename);
        }
        if (strtoupper((string) ($row['reference'] ?? '')) === nautisign_devis_reference_from_filename($filename)) {
            return nautisign_devis_metadata_from_row($row, $filename);
        }
    }

    return [];
}

function nautisign_signed_dir(): string
{
    return nautisign_module_root() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'signed';
}

function nautisign_signature_dir(): string
{
    return nautisign_module_root() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'signatures';
}

function nautisign_ensure_dir(string $dir): void
{
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de creer le dossier Nautisign.');
    }
}

function nautisign_clean_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): string
{
    $text = trim((string) $value);
    $text = str_replace("\0", '', $text);
    if ($singleLine) {
        $text = preg_replace('/\s+/u', ' ', $text) ?: '';
    }

    return mb_substr($text, 0, $maxLength);
}

function nautisign_safe_basename(mixed $value): string
{
    $name = basename(str_replace('\\', '/', (string) $value));
    $name = preg_replace('/[^\pL\pN._ -]/u', '', $name) ?: '';
    return mb_substr($name, 0, 255);
}

function nautisign_safe_filename_stem(string $value, string $fallback): string
{
    $value = preg_replace('/\.[^.]+$/', '', $value) ?: $value;
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (is_string($ascii) && trim($ascii) !== '') {
        $value = $ascii;
    }
    $stem = preg_replace('/[^a-zA-Z0-9._-]+/', '-', strtolower($value)) ?: $fallback;
    $stem = trim($stem, '-_.');
    return mb_substr($stem !== '' ? $stem : $fallback, 0, 80);
}

function nautisign_quote_display_label(mixed $value): string
{
    $filename = nautisign_safe_basename($value);
    $reference = nautisign_devis_reference_from_filename($filename);
    if ($reference !== '') {
        return $reference;
    }

    $label = basename($filename, '.pdf');
    return $label !== '' ? $label : 'Devis';
}

function nautisign_quote_path(string $filename): string
{
    $quote = nautisign_find_quote_file($filename);
    if ($quote === null) {
        $safe = nautisign_safe_basename($filename);
        if ($safe === '' || !preg_match('/\.pdf$/i', $safe)) {
            throw new InvalidArgumentException('Devis PDF invalide.');
        }
        throw new InvalidArgumentException('Devis PDF introuvable.');
    }

    return $quote['path'];
}

function nautisign_parse_quote_reference(string $reference): array
{
    $reference = trim(str_replace('\\', '/', $reference));
    $parts = explode('/', $reference, 2);
    $sources = nautisign_quote_sources();
    if (count($parts) === 2 && isset($sources[$parts[0]])) {
        return [
            'source' => $parts[0],
            'filename' => nautisign_safe_basename($parts[1]),
        ];
    }

    return [
        'source' => '',
        'filename' => nautisign_safe_basename($reference),
    ];
}

function nautisign_quote_token(string $source, string $filename): string
{
    return $source . '/' . nautisign_safe_basename($filename);
}

function nautisign_find_quote_file(string $reference): ?array
{
    $parsed = nautisign_parse_quote_reference($reference);
    $filename = (string) ($parsed['filename'] ?? '');
    if ($filename === '' || !preg_match('/\.pdf$/i', $filename)) {
        return null;
    }

    $sources = nautisign_quote_sources();
    $sourceKeys = (string) ($parsed['source'] ?? '') !== ''
        ? [(string) $parsed['source']]
        : array_keys($sources);

    foreach ($sourceKeys as $sourceKey) {
        if (!isset($sources[$sourceKey])) {
            continue;
        }
        $root = realpath((string) $sources[$sourceKey]['dir']);
        if ($root === false) {
            continue;
        }
        $path = $root . DIRECTORY_SEPARATOR . $filename;
        $realPath = realpath($path);
        if ($realPath === false || !is_file($realPath)) {
            continue;
        }
        if (strpos($realPath, $root . DIRECTORY_SEPARATOR) !== 0 && $realPath !== $root) {
            continue;
        }

        return [
            'source' => $sourceKey,
            'sourceLabel' => (string) $sources[$sourceKey]['label'],
            'sourcePath' => (string) $sources[$sourceKey]['relativePath'],
            'filename' => $filename,
            'token' => nautisign_quote_token($sourceKey, $filename),
            'path' => $realPath,
        ];
    }

    return null;
}

function nautisign_quote_file_payload(string $filename): array
{
    $quote = nautisign_find_quote_file($filename);
    if ($quote === null) {
        throw new InvalidArgumentException('Devis PDF introuvable.');
    }
    $path = $quote['path'];
    return [
        'filename' => $quote['token'],
        'basename' => $quote['filename'],
        'label' => basename((string) $quote['filename'], '.pdf'),
        'source' => $quote['source'],
        'sourceLabel' => $quote['sourceLabel'],
        'sourcePath' => $quote['sourcePath'],
        'size' => filesize($path) ?: 0,
        'modifiedAt' => date('Y-m-d H:i:s', filemtime($path) ?: time()),
        'hash' => hash_file('sha256', $path) ?: '',
    ];
}

function nautisign_list_quote_files(?PDO $pdo = null, ?array $user = null): array
{
    $files = [];
    $devisMetadata = ($pdo !== null && $user !== null) ? nautisign_devis_quote_metadata($pdo, $user) : [];
    foreach (nautisign_quote_sources() as $source => $sourceConfig) {
        $dir = (string) ($sourceConfig['dir'] ?? '');
        if (!is_dir($dir)) {
            continue;
        }
        foreach (scandir($dir) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..' || !preg_match('/\.pdf$/i', $entry)) {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (!is_file($path)) {
                continue;
            }
            $metadata = [];
            if ((string) $source === 'devis') {
                $metadata = $devisMetadata[$entry] ?? [];
            }
            if ((string) $source === 'devis' && $pdo !== null && $user !== null && $metadata === []) {
                continue;
            }
            $files[] = [
                'filename' => nautisign_quote_token((string) $source, $entry),
                'basename' => $entry,
                'label' => (string) ($metadata['quoteReference'] ?? '') !== ''
                    ? (string) $metadata['quoteReference']
                    : basename($entry, '.pdf'),
                'source' => (string) $source,
                'sourceLabel' => (string) ($sourceConfig['label'] ?? $source),
                'sourcePath' => (string) ($sourceConfig['relativePath'] ?? ''),
                'size' => filesize($path) ?: 0,
                'modifiedAt' => date('Y-m-d H:i:s', filemtime($path) ?: time()),
                'hash' => hash_file('sha256', $path) ?: '',
                'quoteId' => (int) ($metadata['quoteId'] ?? 0),
                'quoteReference' => (string) ($metadata['quoteReference'] ?? ''),
                'clientName' => (string) ($metadata['clientName'] ?? ''),
                'clientEmail' => (string) ($metadata['clientEmail'] ?? ''),
                'quoteStatus' => (string) ($metadata['quoteStatus'] ?? ''),
            ];
        }
    }

    usort($files, static fn(array $a, array $b): int => strcmp((string) $b['modifiedAt'], (string) $a['modifiedAt']));
    return $files;
}

function nautisign_make_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function nautisign_request_ip_hash(): string
{
    $ip = nautisign_clean_text($_SERVER['REMOTE_ADDR'] ?? '', 90, true);
    if ($ip === '') {
        return '';
    }

    return hash_hmac('sha256', 'nautisign-ip|' . $ip, oceanos_secret_key());
}

function nautisign_request_user_agent(): string
{
    return nautisign_clean_text($_SERVER['HTTP_USER_AGENT'] ?? '', 500, true);
}

function nautisign_expiration_from_input(mixed $value): ?string
{
    $days = (int) $value;
    if ($days <= 0) {
        return null;
    }
    $days = min($days, 365);
    return gmdate('Y-m-d H:i:s', time() + ($days * 86400));
}

function nautisign_is_expired(array $request): bool
{
    $expiresAt = trim((string) ($request['expires_at'] ?? ''));
    return $expiresAt !== '' && strtotime($expiresAt . ' UTC') !== false && strtotime($expiresAt . ' UTC') < time();
}

function nautisign_find_request_by_id(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT r.*, u.display_name AS owner_display_name, u.email AS owner_email
         FROM nautisign_requests r
         INNER JOIN oceanos_users u ON u.id = r.owner_user_id
         WHERE r.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function nautisign_find_request_by_token(PDO $pdo, string $token): ?array
{
    $token = preg_replace('/[^a-zA-Z0-9_-]/', '', $token) ?: '';
    if ($token === '') {
        return null;
    }

    $statement = $pdo->prepare(
        'SELECT r.*, u.display_name AS owner_display_name, u.email AS owner_email
         FROM nautisign_requests r
         INNER JOIN oceanos_users u ON u.id = r.owner_user_id
         WHERE r.token = :token
         LIMIT 1'
    );
    $statement->execute(['token' => mb_substr($token, 0, 120)]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function nautisign_require_request(PDO $pdo, int $id, array $user): array
{
    $request = nautisign_find_request_by_id($pdo, $id);
    if ($request === null) {
        throw new InvalidArgumentException('Demande de signature introuvable.');
    }
    if (!nautisign_can_manage_request($request, $user)) {
        nautisign_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Vous ne pouvez pas gerer cette demande.',
        ], 403);
    }

    return $request;
}

function nautisign_signed_absolute_path(?string $relativePath): string
{
    $relativePath = trim((string) $relativePath);
    if ($relativePath === '') {
        return '';
    }
    $relativePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    $path = nautisign_module_root() . DIRECTORY_SEPARATOR . ltrim($relativePath, DIRECTORY_SEPARATOR);
    $root = realpath(nautisign_module_root() . DIRECTORY_SEPARATOR . 'storage');
    $realPath = is_file($path) ? realpath($path) : $path;
    if ($root === false || $realPath === false || strpos($realPath, $root . DIRECTORY_SEPARATOR) !== 0) {
        return '';
    }

    return $realPath;
}

function nautisign_public_request(array $request, bool $includeToken = true): array
{
    $status = (string) ($request['status'] ?? 'pending');
    if ($status === 'pending' && nautisign_is_expired($request)) {
        $status = 'expired';
    }

    $payload = [
        'id' => (int) $request['id'],
        'quoteFilename' => (string) $request['quote_filename'],
        'quoteLabel' => nautisign_quote_display_label($request['quote_filename'] ?? ''),
        'status' => $status,
        'signerName' => (string) ($request['signer_name'] ?? ''),
        'signerEmail' => (string) ($request['signer_email'] ?? ''),
        'shareUrl' => '/Nautisign/?sign=' . rawurlencode((string) $request['token']),
        'documentUrl' => '/Nautisign/api/document.php?token=' . rawurlencode((string) $request['token']),
        'signedDocumentUrl' => (string) ($request['signed_pdf_path'] ?? '') !== ''
            ? '/Nautisign/api/document.php?token=' . rawurlencode((string) $request['token']) . '&variant=signed'
            : '',
        'downloadSignedUrl' => (string) ($request['signed_pdf_path'] ?? '') !== ''
            ? '/Nautisign/api/document.php?id=' . (int) $request['id'] . '&variant=signed&download=1'
            : '',
        'expiresAt' => (string) ($request['expires_at'] ?? ''),
        'signedAt' => (string) ($request['signed_at'] ?? ''),
        'createdAt' => (string) ($request['created_at'] ?? ''),
        'updatedAt' => (string) ($request['updated_at'] ?? ''),
        'owner' => [
            'id' => (int) ($request['owner_user_id'] ?? 0),
            'displayName' => (string) ($request['owner_display_name'] ?? ''),
            'email' => (string) ($request['owner_email'] ?? ''),
        ],
    ];

    if ($includeToken) {
        $payload['token'] = (string) $request['token'];
    } else {
        unset($payload['owner']['email'], $payload['downloadSignedUrl']);
    }

    return $payload;
}

function nautisign_list_requests(PDO $pdo, array $user): array
{
    if (nautisign_is_manager($user)) {
        $statement = $pdo->query(
            'SELECT r.*, u.display_name AS owner_display_name, u.email AS owner_email
             FROM nautisign_requests r
             INNER JOIN oceanos_users u ON u.id = r.owner_user_id
             ORDER BY r.updated_at DESC, r.id DESC'
        );
    } else {
        $statement = $pdo->prepare(
            'SELECT r.*, u.display_name AS owner_display_name, u.email AS owner_email
             FROM nautisign_requests r
             INNER JOIN oceanos_users u ON u.id = r.owner_user_id
             WHERE r.owner_user_id = :user_id
             ORDER BY r.updated_at DESC, r.id DESC'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
    }

    $rows = $statement->fetchAll() ?: [];
    return array_map(static fn(array $row): array => nautisign_public_request($row, true), $rows);
}

function nautisign_create_request(PDO $pdo, array $user, array $input): array
{
    $quote = nautisign_quote_file_payload((string) ($input['quoteFilename'] ?? ''));
    $signerName = nautisign_clean_text($input['signerName'] ?? '', 190, true);
    $signerEmail = strtolower(nautisign_clean_text($input['signerEmail'] ?? '', 190, true));
    if ($signerName === '' || $signerEmail === '') {
        $contact = nautisign_devis_quote_contact($pdo, $user, $quote['filename']);
        if ($signerName === '') {
            $signerName = nautisign_clean_text($contact['clientName'] ?? '', 190, true);
        }
        if ($signerEmail === '') {
            $signerEmail = strtolower(nautisign_clean_text($contact['clientEmail'] ?? '', 190, true));
        }
    }
    if ($signerEmail !== '' && !filter_var($signerEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email signataire invalide.');
    }

    $token = nautisign_make_token();
    $expiresAt = nautisign_expiration_from_input($input['expiresInDays'] ?? 30);

    $statement = $pdo->prepare(
        'INSERT INTO nautisign_requests
         (owner_user_id, token, quote_filename, status, signer_name, signer_email, original_pdf_hash, expires_at)
         VALUES (:owner_user_id, :token, :quote_filename, :status, :signer_name, :signer_email, :original_pdf_hash, :expires_at)'
    );
    $statement->execute([
        'owner_user_id' => (int) $user['id'],
        'token' => $token,
        'quote_filename' => $quote['filename'],
        'status' => 'pending',
        'signer_name' => $signerName !== '' ? $signerName : null,
        'signer_email' => $signerEmail !== '' ? $signerEmail : null,
        'original_pdf_hash' => $quote['hash'],
        'expires_at' => $expiresAt,
    ]);

    $request = nautisign_find_request_by_id($pdo, (int) $pdo->lastInsertId());
    if ($request === null) {
        throw new RuntimeException('Impossible de creer le lien Nautisign.');
    }

    return $request;
}

function nautisign_update_status(PDO $pdo, array $request, string $status): array
{
    if (!in_array($status, ['pending', 'revoked'], true)) {
        throw new InvalidArgumentException('Statut Nautisign invalide.');
    }
    if ((string) ($request['status'] ?? '') === 'signed') {
        throw new InvalidArgumentException('Un devis deja signe ne peut pas etre modifie.');
    }

    $statement = $pdo->prepare('UPDATE nautisign_requests SET status = :status WHERE id = :id');
    $statement->execute([
        'id' => (int) $request['id'],
        'status' => $status,
    ]);

    return nautisign_find_request_by_id($pdo, (int) $request['id']) ?? $request;
}

function nautisign_delete_request(PDO $pdo, array $request): void
{
    $statement = $pdo->prepare('DELETE FROM nautisign_requests WHERE id = :id');
    $statement->execute(['id' => (int) $request['id']]);
}

function nautisign_decode_signature_data(mixed $value): array
{
    $dataUrl = trim((string) $value);
    if (!preg_match('/^data:image\/(png|jpeg);base64,([a-zA-Z0-9+\/=\r\n]+)$/', $dataUrl, $matches)) {
        throw new InvalidArgumentException('Signature invalide.');
    }

    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]) ?: '', true);
    if ($binary === false || strlen($binary) < 200) {
        throw new InvalidArgumentException('Signature vide ou invalide.');
    }
    if (strlen($binary) > 2 * 1024 * 1024) {
        throw new InvalidArgumentException('Signature trop volumineuse.');
    }

    return [
        'extension' => $matches[1] === 'jpeg' ? 'jpg' : 'png',
        'binary' => $binary,
        'hash' => hash('sha256', $binary),
    ];
}

function nautisign_fpdf_text(mixed $value): string
{
    $text = (string) $value;
    $converted = @iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $text);
    return is_string($converted) ? $converted : preg_replace('/[^\x20-\x7E]/', '', $text);
}

function nautisign_load_pdf_vendor(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }

    $autoload = nautisign_www_root() . DIRECTORY_SEPARATOR . 'Invocean' . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
    if (is_file($autoload)) {
        require_once $autoload;
    }
    $loaded = true;
}

function nautisign_draw_signature_stamp($pdf, float $pageWidth, float $pageHeight, string $signaturePath, array $request): void
{
    $boxWidth = max(58.0, min(88.0, $pageWidth - 28.0));
    $boxHeight = 38.0;
    $x = 14.0;
    if ($x + $boxWidth > $pageWidth - 10.0) {
        $x = max(8.0, $pageWidth - $boxWidth - 10.0);
    }
    $y = max(8.0, $pageHeight - $boxHeight - 23.0);

    $pdf->SetDrawColor(14, 126, 118);
    $pdf->SetFillColor(255, 255, 255);
    $pdf->Rect($x, $y, $boxWidth, $boxHeight, 'DF');
    $pdf->SetTextColor(8, 55, 53);
    $pdf->SetFont('Arial', 'B', 8);
    $pdf->SetXY($x + 4, $y + 4);
    $pdf->Cell($boxWidth - 8, 4, nautisign_fpdf_text('Signe electroniquement'), 0, 2, 'L');
    $pdf->SetFont('Arial', '', 7);
    $pdf->SetTextColor(68, 83, 82);
    $pdf->Cell($boxWidth - 8, 4, nautisign_fpdf_text((string) ($request['signer_name'] ?? 'Client')), 0, 2, 'L');
    $pdf->Cell($boxWidth - 8, 4, nautisign_fpdf_text(date('d/m/Y H:i')), 0, 2, 'L');
    $pdf->Image($signaturePath, $x + 4, $y + 19, min(48.0, $boxWidth - 10.0), 13);
}

function nautisign_generate_signed_pdf(string $sourcePath, string $destinationPath, string $signaturePath, array $request): void
{
    nautisign_load_pdf_vendor();
    if (!class_exists('\\setasign\\Fpdi\\Fpdi')) {
        throw new RuntimeException('La librairie PDF FPDI est indisponible.');
    }

    $pdf = new \setasign\Fpdi\Fpdi();
    $pdf->SetAutoPageBreak(false);
    $pageCount = $pdf->setSourceFile($sourcePath);

    for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
        $templateId = $pdf->importPage($pageNo);
        $size = $pdf->getTemplateSize($templateId);
        $width = (float) ($size['width'] ?? 210);
        $height = (float) ($size['height'] ?? 297);
        $orientation = $width > $height ? 'L' : 'P';
        $pdf->AddPage($orientation, [$width, $height]);
        $pdf->useTemplate($templateId, 0, 0, $width, $height, true);
        if ($pageNo === $pageCount) {
            nautisign_draw_signature_stamp($pdf, $width, $height, $signaturePath, $request);
        }
    }

    $pdf->AddPage('P', 'A4');
    $pdf->SetMargins(18, 18, 18);
    $pdf->SetAutoPageBreak(true, 18);
    $pdf->SetTextColor(7, 27, 30);
    $pdf->SetFont('Arial', 'B', 22);
    $pdf->Cell(0, 12, nautisign_fpdf_text('Certificat Nautisign'), 0, 1);
    $pdf->SetFont('Arial', '', 10);
    $pdf->SetTextColor(81, 95, 96);
    $pdf->MultiCell(0, 6, nautisign_fpdf_text('Ce certificat atteste la validation electronique du devis PDF joint dans ce document.'));
    $pdf->Ln(8);

    $rows = [
        ['Devis', (string) ($request['quote_filename'] ?? '')],
        ['Signataire', (string) ($request['signer_name'] ?? '')],
        ['Email', (string) ($request['signer_email'] ?? '')],
        ['Date de signature', date('d/m/Y H:i')],
        ['Empreinte signature', (string) ($request['signature_hash'] ?? '')],
        ['Empreinte PDF original', (string) ($request['original_pdf_hash'] ?? '')],
    ];

    foreach ($rows as [$label, $value]) {
        $pdf->SetFont('Arial', 'B', 9);
        $pdf->SetTextColor(9, 72, 70);
        $pdf->Cell(52, 8, nautisign_fpdf_text($label), 0, 0);
        $pdf->SetFont('Arial', '', 9);
        $pdf->SetTextColor(31, 44, 46);
        $pdf->MultiCell(0, 8, nautisign_fpdf_text($value !== '' ? $value : '-'));
    }

    $pdf->Ln(8);
    $pdf->SetDrawColor(14, 126, 118);
    $pdf->SetFillColor(247, 251, 250);
    $pdf->Rect(18, $pdf->GetY(), 174, 54, 'DF');
    $pdf->SetXY(26, $pdf->GetY() + 7);
    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetTextColor(9, 72, 70);
    $pdf->Cell(0, 7, nautisign_fpdf_text('Signature client'), 0, 1);
    $pdf->Image($signaturePath, 26, $pdf->GetY() + 2, 72, 22);
    $pdf->SetXY(106, $pdf->GetY() + 4);
    $pdf->SetFont('Arial', '', 9);
    $pdf->SetTextColor(31, 44, 46);
    $pdf->MultiCell(74, 6, nautisign_fpdf_text('Validation realisee depuis le lien public securise Nautisign.'));

    nautisign_ensure_dir(dirname($destinationPath));
    $pdf->Output('F', $destinationPath);
}

function nautisign_sign_request(PDO $pdo, array $request, array $input): array
{
    if ((string) ($request['status'] ?? '') !== 'pending') {
        throw new InvalidArgumentException('Ce lien de signature n est plus disponible.');
    }
    if (nautisign_is_expired($request)) {
        throw new InvalidArgumentException('Ce lien de signature a expire.');
    }
    if (empty($input['accepted'])) {
        throw new InvalidArgumentException('La validation du devis est obligatoire.');
    }

    $signerName = nautisign_clean_text($input['signerName'] ?? $request['signer_name'] ?? '', 190, true);
    if ($signerName === '') {
        throw new InvalidArgumentException('Le nom du signataire est obligatoire.');
    }
    $signerEmail = strtolower(nautisign_clean_text($input['signerEmail'] ?? $request['signer_email'] ?? '', 190, true));
    if ($signerEmail !== '' && !filter_var($signerEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email signataire invalide.');
    }

    $sourcePath = nautisign_quote_path((string) $request['quote_filename']);
    $signature = nautisign_decode_signature_data($input['signatureData'] ?? '');
    nautisign_ensure_dir(nautisign_signature_dir());
    nautisign_ensure_dir(nautisign_signed_dir());

    $token = (string) $request['token'];
    $signatureFilename = nautisign_safe_filename_stem((string) $request['quote_filename'], 'signature') . '-' . $token . '.' . $signature['extension'];
    $signaturePath = nautisign_signature_dir() . DIRECTORY_SEPARATOR . $signatureFilename;
    if (file_put_contents($signaturePath, $signature['binary']) === false) {
        throw new RuntimeException('Impossible d enregistrer la signature.');
    }

    $signedFilename = 'signe-' . nautisign_safe_filename_stem((string) $request['quote_filename'], 'devis') . '-' . $token . '.pdf';
    $signedPath = nautisign_signed_dir() . DIRECTORY_SEPARATOR . $signedFilename;
    $relativeSignedPath = 'storage/signed/' . $signedFilename;

    $requestForPdf = array_merge($request, [
        'signer_name' => $signerName,
        'signer_email' => $signerEmail,
        'signature_hash' => $signature['hash'],
        'original_pdf_hash' => hash_file('sha256', $sourcePath) ?: '',
    ]);
    nautisign_generate_signed_pdf($sourcePath, $signedPath, $signaturePath, $requestForPdf);
    $signedHash = hash_file('sha256', $signedPath) ?: '';

    $statement = $pdo->prepare(
        'UPDATE nautisign_requests
         SET status = :status,
             signer_name = :signer_name,
             signer_email = :signer_email,
             signer_ip_hash = :signer_ip_hash,
             signer_user_agent = :signer_user_agent,
             original_pdf_hash = :original_pdf_hash,
             signature_hash = :signature_hash,
             signed_pdf_hash = :signed_pdf_hash,
             signed_pdf_path = :signed_pdf_path,
             signed_at = :signed_at
         WHERE id = :id'
    );
    $statement->execute([
        'id' => (int) $request['id'],
        'status' => 'signed',
        'signer_name' => $signerName,
        'signer_email' => $signerEmail !== '' ? $signerEmail : null,
        'signer_ip_hash' => nautisign_request_ip_hash() ?: null,
        'signer_user_agent' => nautisign_request_user_agent() ?: null,
        'original_pdf_hash' => $requestForPdf['original_pdf_hash'],
        'signature_hash' => $signature['hash'],
        'signed_pdf_hash' => $signedHash,
        'signed_pdf_path' => $relativeSignedPath,
        'signed_at' => gmdate('Y-m-d H:i:s'),
    ]);

    return nautisign_find_request_by_id($pdo, (int) $request['id']) ?? $request;
}

function nautisign_serve_pdf(string $path, string $filename, bool $download = false): void
{
    if (!is_file($path)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'PDF introuvable.';
        exit;
    }

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    header('Content-Type: application/pdf');
    header('Content-Length: ' . (string) filesize($path));
    header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . str_replace('"', '', $filename) . '"');
    readfile($path);
    exit;
}
