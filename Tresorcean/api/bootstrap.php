<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const TRESORCEAN_MODULE_ID = 'tresorcean';
const TRESORCEAN_ATTACHMENT_MAX_BYTES = 10485760;
const TRESORCEAN_ATTACHMENT_MAX_FILES = 6;
const TRESORCEAN_ATTACHMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'ods', 'zip'];

function tresorcean_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    oceanos_send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tresorcean_read_json_request(): array
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

function tresorcean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    tresorcean_ensure_schema($pdo);
    return $pdo;
}

function tresorcean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            default_sales_tax_rate DECIMAL(6,3) NOT NULL DEFAULT 20,
            default_purchase_tax_rate DECIMAL(6,3) NOT NULL DEFAULT 20,
            prestashop_order_limit INT UNSIGNED NOT NULL DEFAULT 80,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_entries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            entry_type ENUM('fund', 'income', 'expense', 'supplier', 'tax_adjustment') NOT NULL DEFAULT 'fund',
            direction ENUM('in', 'out') NOT NULL DEFAULT 'in',
            tax_scope ENUM('neutral', 'collected', 'deductible') NOT NULL DEFAULT 'neutral',
            label VARCHAR(190) NOT NULL,
            counterparty VARCHAR(190) NULL,
            amount_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(14,6) NOT NULL DEFAULT 0,
            amount_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
            occurred_at DATE NOT NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tresorcean_entries_date (occurred_at),
            KEY idx_tresorcean_entries_type (entry_type),
            KEY idx_tresorcean_entries_user (user_id),
            CONSTRAINT fk_tresorcean_entries_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_user_preferences (
            user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            period_start DATE NULL,
            period_end DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_tresorcean_preferences_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_entry_attachments (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            entry_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NULL,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(190) NOT NULL,
            storage_mode ENUM('file', 'database') NOT NULL DEFAULT 'file',
            mime_type VARCHAR(120) NULL,
            file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
            file_content LONGBLOB NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_tresorcean_attachment_file (stored_name),
            KEY idx_tresorcean_attachment_entry (entry_id),
            KEY idx_tresorcean_attachment_user (user_id),
            CONSTRAINT fk_tresorcean_attachment_entry FOREIGN KEY (entry_id) REFERENCES tresorcean_entries(id) ON DELETE CASCADE,
            CONSTRAINT fk_tresorcean_attachment_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!oceanos_column_exists($pdo, 'tresorcean_entry_attachments', 'storage_mode')) {
        $pdo->exec("ALTER TABLE tresorcean_entry_attachments ADD COLUMN storage_mode ENUM('file', 'database') NOT NULL DEFAULT 'file' AFTER stored_name");
    }
    if (!oceanos_column_exists($pdo, 'tresorcean_entry_attachments', 'file_content')) {
        $pdo->exec('ALTER TABLE tresorcean_entry_attachments ADD COLUMN file_content LONGBLOB NULL AFTER file_size');
    }

    $pdo->exec('INSERT IGNORE INTO tresorcean_settings (id) VALUES (1)');
}

function tresorcean_require_access(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $modules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(TRESORCEAN_MODULE_ID, $modules, true)) {
        tresorcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Module Tresorcean non autorise pour ce compte.',
        ], 403);
    }

    return $user;
}

function tresorcean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function tresorcean_require_admin(PDO $pdo): array
{
    $user = tresorcean_require_access($pdo);
    if (!tresorcean_is_admin($user)) {
        tresorcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function tresorcean_decimal(mixed $value): float
{
    $normalized = str_replace(',', '.', trim((string) $value));
    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function tresorcean_storage_path(string ...$parts): string
{
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    foreach ($parts as $part) {
        $path .= DIRECTORY_SEPARATOR . trim($part, "\\/");
    }

    return $path;
}

function tresorcean_attachment_dir(): string
{
    return tresorcean_storage_path('attachments');
}

function tresorcean_ensure_attachment_storage(): string
{
    $storage = tresorcean_storage_path();
    $attachments = tresorcean_attachment_dir();
    foreach ([$storage, $attachments] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Dossier pieces jointes inaccessible.');
        }
    }
    if (!is_writable($attachments)) {
        throw new RuntimeException('Dossier pieces jointes non accessible en ecriture.');
    }

    return $attachments;
}

function tresorcean_attachment_path(string $storedName): string
{
    return tresorcean_attachment_dir() . DIRECTORY_SEPARATOR . basename($storedName);
}

function tresorcean_safe_attachment_name(string $name): string
{
    $safe = trim(basename(str_replace('\\', '/', $name)));
    $safe = preg_replace('/[\x00-\x1F\x7F]+/', '', $safe) ?: '';
    if ($safe === '' || $safe === '.' || $safe === '..') {
        return 'piece-jointe';
    }

    return substr($safe, 0, 180);
}

function tresorcean_public_attachment(array $row): array
{
    $id = (int) $row['id'];
    return [
        'id' => $id,
        'entryId' => (int) $row['entry_id'],
        'name' => (string) ($row['original_name'] ?? 'piece-jointe'),
        'mimeType' => (string) ($row['mime_type'] ?? ''),
        'fileSize' => (int) ($row['file_size'] ?? 0),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'downloadUrl' => 'api/finance.php?action=attachment&id=' . $id,
    ];
}

function tresorcean_entry_attachments(PDO $pdo, array $entryIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $entryIds), static fn(int $id): bool => $id > 0)));
    if ($ids === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = $pdo->prepare(
        "SELECT *
         FROM tresorcean_entry_attachments
         WHERE entry_id IN ({$placeholders})
         ORDER BY created_at ASC, id ASC"
    );
    $statement->execute($ids);

    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $entryId = (int) $row['entry_id'];
        $grouped[$entryId][] = tresorcean_public_attachment($row);
    }

    return $grouped;
}

function tresorcean_normalize_uploaded_files(array $files): array
{
    if (!isset($files['name'])) {
        return [];
    }

    if (!is_array($files['name'])) {
        return [[
            'name' => $files['name'] ?? '',
            'type' => $files['type'] ?? '',
            'tmp_name' => $files['tmp_name'] ?? '',
            'error' => $files['error'] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'] ?? 0,
        ]];
    }

    $normalized = [];
    $count = count($files['name']);
    for ($index = 0; $index < $count; $index++) {
        $normalized[] = [
            'name' => $files['name'][$index] ?? '',
            'type' => $files['type'][$index] ?? '',
            'tmp_name' => $files['tmp_name'][$index] ?? '',
            'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$index] ?? 0,
        ];
    }

    return $normalized;
}

function tresorcean_upload_error_label(int $error): string
{
    return match ($error) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux.',
        UPLOAD_ERR_PARTIAL => 'Envoi du fichier incomplet.',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant.',
        UPLOAD_ERR_CANT_WRITE => 'Ecriture du fichier impossible.',
        UPLOAD_ERR_EXTENSION => 'Envoi bloque par une extension PHP.',
        default => 'Envoi du fichier impossible.',
    };
}

function tresorcean_save_entry_attachments(PDO $pdo, array $user, int $entryId, array $files): array
{
    $entry = tresorcean_get_entry_row($pdo, $entryId);
    if (!tresorcean_is_admin($user) && (int) ($entry['user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez ajouter des pieces jointes que sur vos mouvements.');
    }

    $uploads = array_values(array_filter(
        tresorcean_normalize_uploaded_files($files),
        static fn(array $file): bool => (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE
    ));
    if ($uploads === []) {
        return tresorcean_entry_attachments($pdo, [$entryId])[$entryId] ?? [];
    }
    if (count($uploads) > TRESORCEAN_ATTACHMENT_MAX_FILES) {
        throw new InvalidArgumentException('Maximum ' . TRESORCEAN_ATTACHMENT_MAX_FILES . ' pieces jointes par envoi.');
    }

    try {
        $dir = tresorcean_ensure_attachment_storage();
    } catch (Throwable) {
        $dir = null;
    }
    $statement = $pdo->prepare(
        'INSERT INTO tresorcean_entry_attachments
            (entry_id, user_id, original_name, stored_name, storage_mode, mime_type, file_size, file_content)
         VALUES
            (:entry_id, :user_id, :original_name, :stored_name, :storage_mode, :mime_type, :file_size, :file_content)'
    );

    foreach ($uploads as $upload) {
        $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException(tresorcean_upload_error_label($error));
        }

        $size = (int) ($upload['size'] ?? 0);
        if ($size <= 0 || $size > TRESORCEAN_ATTACHMENT_MAX_BYTES) {
            throw new InvalidArgumentException('Chaque piece jointe doit faire entre 1 octet et 10 Mo.');
        }

        $tmpName = (string) ($upload['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new InvalidArgumentException('Piece jointe invalide.');
        }

        $originalName = tresorcean_safe_attachment_name((string) ($upload['name'] ?? 'piece-jointe'));
        $extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($extension, TRESORCEAN_ATTACHMENT_EXTENSIONS, true)) {
            throw new InvalidArgumentException('Type de fichier non autorise.');
        }

        $storedName = bin2hex(random_bytes(16)) . '.' . $extension;
        $target = $dir ? $dir . DIRECTORY_SEPARATOR . $storedName : null;
        $storageMode = 'file';
        $fileContent = null;
        if ($target === null || !move_uploaded_file($tmpName, $target)) {
            $fileContent = file_get_contents($tmpName);
            if ($fileContent === false) {
                throw new RuntimeException('Impossible d enregistrer la piece jointe.');
            }
            $storageMode = 'database';
            $target = null;
        }

        $mimeType = (string) ($upload['type'] ?? '');
        if ($storageMode === 'file' && function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $detected = finfo_file($finfo, $target);
                if (is_string($detected) && $detected !== '') {
                    $mimeType = $detected;
                }
                finfo_close($finfo);
            }
        }

        try {
            $statement->bindValue(':entry_id', $entryId, PDO::PARAM_INT);
            $statement->bindValue(':user_id', (int) $user['id'], PDO::PARAM_INT);
            $statement->bindValue(':original_name', $originalName);
            $statement->bindValue(':stored_name', $storedName);
            $statement->bindValue(':storage_mode', $storageMode);
            $statement->bindValue(':mime_type', substr($mimeType, 0, 120) ?: null);
            $statement->bindValue(':file_size', $size, PDO::PARAM_INT);
            if ($fileContent === null) {
                $statement->bindValue(':file_content', null, PDO::PARAM_NULL);
            } else {
                $statement->bindValue(':file_content', $fileContent, PDO::PARAM_LOB);
            }
            $statement->execute();
        } catch (Throwable $exception) {
            if ($target !== null) {
                @unlink($target);
            }
            throw $exception;
        }
    }

    return tresorcean_entry_attachments($pdo, [$entryId])[$entryId] ?? [];
}

function tresorcean_get_attachment_row(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT a.*, e.user_id AS entry_user_id
         FROM tresorcean_entry_attachments a
         INNER JOIN tresorcean_entries e ON e.id = a.entry_id
         WHERE a.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Piece jointe introuvable.');
    }

    return $row;
}

function tresorcean_delete_attachment_file(array $row): void
{
    if ((string) ($row['storage_mode'] ?? 'file') !== 'file') {
        return;
    }
    $path = tresorcean_attachment_path((string) ($row['stored_name'] ?? ''));
    if (is_file($path)) {
        @unlink($path);
    }
}

function tresorcean_delete_attachment(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_attachment_row($pdo, $id);
    if (!tresorcean_is_admin($user) && (int) ($row['entry_user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez supprimer que vos pieces jointes.');
    }

    $statement = $pdo->prepare('DELETE FROM tresorcean_entry_attachments WHERE id = :id');
    $statement->execute(['id' => $id]);
    tresorcean_delete_attachment_file($row);
}

function tresorcean_delete_entry_attachment_files(PDO $pdo, int $entryId): void
{
    $statement = $pdo->prepare('SELECT * FROM tresorcean_entry_attachments WHERE entry_id = :entry_id');
    $statement->execute(['entry_id' => $entryId]);
    foreach ($statement->fetchAll() as $row) {
        tresorcean_delete_attachment_file($row);
    }
}

function tresorcean_download_attachment(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_attachment_row($pdo, $id);
    $name = tresorcean_safe_attachment_name((string) ($row['original_name'] ?? 'piece-jointe'));
    $asciiName = str_replace(['\\', '"'], '_', $name);
    $mimeType = trim((string) ($row['mime_type'] ?? '')) ?: 'application/octet-stream';
    $content = null;
    $path = null;
    if ((string) ($row['storage_mode'] ?? 'file') === 'database') {
        $content = $row['file_content'] ?? null;
        if (!is_string($content)) {
            throw new InvalidArgumentException('Fichier introuvable.');
        }
    } else {
        $path = tresorcean_attachment_path((string) ($row['stored_name'] ?? ''));
        if (!is_file($path)) {
            throw new InvalidArgumentException('Fichier introuvable.');
        }
    }

    http_response_code(200);
    oceanos_send_security_headers();
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . ($content !== null ? strlen($content) : filesize($path)));
    header('Content-Disposition: attachment; filename="' . $asciiName . '"; filename*=UTF-8\'\'' . rawurlencode($name));
    header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0');
    if ($content !== null) {
        echo $content;
    } else {
        readfile($path);
    }
    exit;
}

function tresorcean_money_value(mixed $value): string
{
    return number_format(tresorcean_decimal($value), 6, '.', '');
}

function tresorcean_settings(PDO $pdo): array
{
    $pdo->exec('INSERT IGNORE INTO tresorcean_settings (id) VALUES (1)');
    $row = $pdo->query('SELECT * FROM tresorcean_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration Tresorcean introuvable.');
    }

    return [
        'defaultSalesTaxRate' => (float) ($row['default_sales_tax_rate'] ?? 20),
        'defaultPurchaseTaxRate' => (float) ($row['default_purchase_tax_rate'] ?? 20),
        'prestashopOrderLimit' => (int) ($row['prestashop_order_limit'] ?? 80),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_save_settings(PDO $pdo, array $input): array
{
    $salesRate = max(0, min(100, tresorcean_decimal($input['defaultSalesTaxRate'] ?? 20)));
    $purchaseRate = max(0, min(100, tresorcean_decimal($input['defaultPurchaseTaxRate'] ?? 20)));
    $limit = max(10, min(250, (int) ($input['prestashopOrderLimit'] ?? 80)));

    $statement = $pdo->prepare(
        'UPDATE tresorcean_settings
         SET default_sales_tax_rate = :sales_rate,
             default_purchase_tax_rate = :purchase_rate,
             prestashop_order_limit = :order_limit
         WHERE id = 1'
    );
    $statement->execute([
        'sales_rate' => number_format($salesRate, 3, '.', ''),
        'purchase_rate' => number_format($purchaseRate, 3, '.', ''),
        'order_limit' => $limit,
    ]);

    return tresorcean_settings($pdo);
}

function tresorcean_valid_date(string $value): bool
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
}

function tresorcean_user_preferences(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT period_start, period_end, updated_at FROM tresorcean_user_preferences WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return [
            'periodStart' => '',
            'periodEnd' => '',
            'updatedAt' => '',
        ];
    }

    return [
        'periodStart' => (string) ($row['period_start'] ?? ''),
        'periodEnd' => (string) ($row['period_end'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_period_requested(array $query): bool
{
    return array_key_exists('start', $query) || array_key_exists('end', $query);
}

function tresorcean_save_user_period(PDO $pdo, int $userId, array $period): array
{
    $statement = $pdo->prepare(
        'INSERT INTO tresorcean_user_preferences (user_id, period_start, period_end)
         VALUES (:user_id, :period_start, :period_end)
         ON DUPLICATE KEY UPDATE
            period_start = VALUES(period_start),
            period_end = VALUES(period_end),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'period_start' => $period['start'],
        'period_end' => $period['end'],
    ]);

    return tresorcean_user_preferences($pdo, $userId);
}

function tresorcean_period(array $query, array $preferences = []): array
{
    $today = new DateTimeImmutable('today');
    $defaultStart = $today->modify('first day of this month');

    $preferredStart = trim((string) ($preferences['periodStart'] ?? ''));
    $preferredEnd = trim((string) ($preferences['periodEnd'] ?? ''));
    $startFallback = tresorcean_valid_date($preferredStart) ? $preferredStart : $defaultStart->format('Y-m-d');
    $endFallback = tresorcean_valid_date($preferredEnd) ? $preferredEnd : $today->format('Y-m-d');

    $start = trim((string) ($query['start'] ?? $startFallback));
    $end = trim((string) ($query['end'] ?? $endFallback));

    if (!tresorcean_valid_date($start)) {
        $start = $startFallback;
    }
    if (!tresorcean_valid_date($end)) {
        $end = $endFallback;
    }
    if ($start > $end) {
        [$start, $end] = [$end, $start];
    }

    return [
        'start' => $start,
        'end' => $end,
        'startDateTime' => $start . ' 00:00:00',
        'endDateTime' => $end . ' 23:59:59',
    ];
}

function tresorcean_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (isset($xml->{$container}->{$nodeName})) {
        $nodes = [];
        foreach ($xml->{$container}->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    if (isset($xml->{$nodeName})) {
        $nodes = [];
        foreach ($xml->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    return [];
}

function tresorcean_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return tresorcean_collect_nodes($xml, $container, $nodeName);
}

function tresorcean_float_xml(SimpleXMLElement $node, string $field): float
{
    return tresorcean_decimal(oceanos_xml_text($node, $field));
}

function tresorcean_fetch_order_states(string $shopUrl, string $apiKey): array
{
    $query = [
        'display' => '[id,name,color,paid,shipped,delivery,logable,invoice,deleted]',
        'sort' => '[id_ASC]',
        'limit' => '0,200',
    ];

    try {
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
    }

    $states = [];
    foreach ($nodes as $node) {
        $id = (int) oceanos_xml_text($node, 'id');
        if ($id <= 0) {
            continue;
        }
        $name = oceanos_xml_language_value($node, 'name');
        $states[$id] = [
            'id' => $id,
            'name' => $name !== '' ? $name : 'Statut #' . $id,
            'color' => oceanos_xml_text($node, 'color') ?: '#8fa7b0',
            'paid' => oceanos_xml_text($node, 'paid') === '1',
            'shipped' => oceanos_xml_text($node, 'shipped') === '1',
            'delivery' => oceanos_xml_text($node, 'delivery') === '1',
            'logable' => oceanos_xml_text($node, 'logable') === '1',
            'invoice' => oceanos_xml_text($node, 'invoice') === '1',
            'deleted' => oceanos_xml_text($node, 'deleted') === '1',
        ];
    }

    return $states;
}

function tresorcean_revenue_state(array $state): bool
{
    if (!empty($state['deleted'])) {
        return false;
    }

    $stateName = strtolower((string) ($state['name'] ?? ''));
    foreach (['rembours', 'refund', 'annul', 'cancel'] as $excludedStatus) {
        if (str_contains($stateName, $excludedStatus)) {
            return false;
        }
    }

    return !empty($state['paid']) || !empty($state['invoice']) || !empty($state['logable']);
}

function tresorcean_order_lines(SimpleXMLElement $order, array $costMap): array
{
    $lines = [];
    if (!isset($order->associations->order_rows->order_row)) {
        return $lines;
    }

    foreach ($order->associations->order_rows->order_row as $row) {
        $productId = (int) oceanos_xml_text($row, 'product_id');
        $quantity = max(0, (int) oceanos_xml_text($row, 'product_quantity'));
        $unitHt = tresorcean_float_xml($row, 'unit_price_tax_excl');
        if ($unitHt <= 0) {
            $unitHt = tresorcean_float_xml($row, 'product_price');
        }
        $unitTtc = tresorcean_float_xml($row, 'unit_price_tax_incl');
        $totalHt = tresorcean_float_xml($row, 'total_price_tax_excl');
        $totalTtc = tresorcean_float_xml($row, 'total_price_tax_incl');
        if ($totalHt <= 0 && $unitHt > 0) {
            $totalHt = $unitHt * $quantity;
        }
        if ($totalTtc <= 0 && $unitTtc > 0) {
            $totalTtc = $unitTtc * $quantity;
        }

        $unitCost = (float) ($costMap[$productId] ?? 0);
        $estimatedCost = $unitCost * $quantity;

        $lines[] = [
            'productId' => $productId,
            'reference' => oceanos_xml_text($row, 'product_reference'),
            'name' => oceanos_xml_text($row, 'product_name') ?: 'Produit',
            'quantity' => $quantity,
            'unitPriceTaxExcl' => $unitHt,
            'unitPriceTaxIncl' => $unitTtc,
            'totalTaxExcl' => $totalHt,
            'totalTaxIncl' => $totalTtc,
            'estimatedUnitCostTaxExcl' => $unitCost,
            'estimatedCostTaxExcl' => $estimatedCost,
            'missingCost' => $unitCost <= 0,
        ];
    }

    return $lines;
}

function tresorcean_product_cost_map(PDO $pdo, float $purchaseTaxRate = 0): array
{
    if (
        !oceanos_table_exists($pdo, 'stockcean_products')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_orders')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_order_lines')
    ) {
        return [];
    }

    $rows = $pdo->query(
        "SELECT
            p.prestashop_product_id,
            COALESCE(
                SUM(CASE WHEN po.status IN ('ordered', 'received') THEN l.quantity_ordered * l.unit_price_tax_excl ELSE 0 END)
                / NULLIF(SUM(CASE WHEN po.status IN ('ordered', 'received') THEN l.quantity_ordered ELSE 0 END), 0),
                0
            ) AS average_cost
         FROM stockcean_products p
         LEFT JOIN stockcean_purchase_order_lines l ON l.product_id = p.id
         LEFT JOIN stockcean_purchase_orders po ON po.id = l.purchase_order_id
         GROUP BY p.prestashop_product_id"
    )->fetchAll();

    $map = [];
    $rateMultiplier = 1 + (max(0, $purchaseTaxRate) / 100);
    foreach ($rows as $row) {
        $productId = (int) ($row['prestashop_product_id'] ?? 0);
        if ($productId > 0) {
            $averageCostTtc = (float) ($row['average_cost'] ?? 0);
            $map[$productId] = $rateMultiplier > 0 ? $averageCostTtc / $rateMultiplier : $averageCostTtc;
        }
    }

    return $map;
}

function tresorcean_public_order(SimpleXMLElement $node, array $states, array $costMap, string $shopUrl, string $apiKey): array
{
    $id = (int) oceanos_xml_text($node, 'id');
    $stateId = (int) oceanos_xml_text($node, 'current_state');
    $state = $states[$stateId] ?? [
        'id' => $stateId,
        'name' => $stateId > 0 ? 'Statut #' . $stateId : 'Sans statut',
        'color' => '#8fa7b0',
        'paid' => false,
        'shipped' => false,
        'delivery' => false,
        'logable' => false,
        'invoice' => false,
        'deleted' => false,
    ];

    $totalIncl = tresorcean_float_xml($node, 'total_paid_tax_incl');
    if ($totalIncl <= 0) {
        $totalIncl = tresorcean_float_xml($node, 'total_paid');
    }
    $totalExcl = tresorcean_float_xml($node, 'total_paid_tax_excl');
    if ($totalExcl <= 0) {
        $products = tresorcean_float_xml($node, 'total_products');
        $shipping = tresorcean_float_xml($node, 'total_shipping_tax_excl');
        $discounts = tresorcean_float_xml($node, 'total_discounts_tax_excl');
        $totalExcl = max(0, $products + $shipping - $discounts);
    }

    $lines = [];
    $detailWarning = '';
    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'orders/' . $id));
        $detail = $xml->order ?? null;
        if ($detail instanceof SimpleXMLElement) {
            $lines = tresorcean_order_lines($detail, $costMap);
            $detailIncl = tresorcean_float_xml($detail, 'total_paid_tax_incl') ?: tresorcean_float_xml($detail, 'total_paid');
            $detailExcl = tresorcean_float_xml($detail, 'total_paid_tax_excl');
            if ($detailIncl > 0) {
                $totalIncl = $detailIncl;
            }
            if ($detailExcl > 0) {
                $totalExcl = $detailExcl;
            }
        }
    } catch (Throwable $exception) {
        $detailWarning = $exception->getMessage();
    }

    $estimatedCost = array_sum(array_map(static fn(array $line): float => (float) $line['estimatedCostTaxExcl'], $lines));
    $missingCostLines = count(array_filter($lines, static fn(array $line): bool => !empty($line['missingCost']) && (int) $line['productId'] > 0));
    $included = tresorcean_revenue_state($state);

    return [
        'id' => $id,
        'reference' => oceanos_xml_text($node, 'reference') ?: ('Commande #' . $id),
        'currentStateId' => $stateId,
        'currentState' => $state,
        'includedInRevenue' => $included,
        'totalTaxExcl' => $totalExcl,
        'totalTaxIncl' => $totalIncl,
        'vatAmount' => max(0, $totalIncl - $totalExcl),
        'estimatedCostTaxExcl' => $estimatedCost,
        'estimatedMarginTaxExcl' => $totalExcl - $estimatedCost,
        'missingCostLines' => $missingCostLines,
        'dateAdd' => oceanos_xml_text($node, 'date_add'),
        'dateUpd' => oceanos_xml_text($node, 'date_upd'),
        'payment' => oceanos_xml_text($node, 'payment'),
        'lines' => $lines,
        'detailWarning' => $detailWarning,
    ];
}

function tresorcean_fetch_orders(PDO $pdo, array $period, array $settings): array
{
    $private = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($private);
    $limit = max(10, min(250, (int) ($settings['prestashopOrderLimit'] ?? 80)));
    $states = tresorcean_fetch_order_states($shopUrl, $apiKey);
    $costMap = tresorcean_product_cost_map($pdo, (float) ($settings['defaultPurchaseTaxRate'] ?? 20));

    $query = [
        'display' => '[id,reference,current_state,payment,total_paid,total_paid_tax_excl,total_paid_tax_incl,total_products,total_shipping_tax_excl,total_discounts_tax_excl,date_add,date_upd]',
        'sort' => '[date_add_DESC]',
        'limit' => '0,' . $limit,
        'filter[date_add]' => '[' . $period['startDateTime'] . ',' . $period['endDateTime'] . ']',
        'date' => '1',
    ];

    try {
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        unset($query['filter[date_add]'], $query['date']);
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', $query);
    }

    $orders = [];
    foreach ($nodes as $node) {
        $orders[] = tresorcean_public_order($node, $states, $costMap, $shopUrl, $apiKey);
    }

    return [
        'orders' => $orders,
        'states' => array_values($states),
        'settings' => oceanos_prestashop_public_settings($pdo, tresorcean_is_admin(oceanos_current_user($pdo) ?? [])),
    ];
}

function tresorcean_supplier_orders(PDO $pdo, array $period, float $purchaseTaxRate): array
{
    if (
        !oceanos_table_exists($pdo, 'stockcean_purchase_orders')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_order_lines')
        || !oceanos_table_exists($pdo, 'stockcean_suppliers')
    ) {
        return [];
    }

    $statement = $pdo->prepare(
        "SELECT o.*, s.name AS supplier_name, COUNT(l.id) AS line_count
         FROM stockcean_purchase_orders o
         LEFT JOIN stockcean_suppliers s ON s.id = o.supplier_id
         LEFT JOIN stockcean_purchase_order_lines l ON l.purchase_order_id = o.id
         WHERE o.created_at BETWEEN :start_date AND :end_date
           AND o.status <> 'cancelled'
         GROUP BY o.id
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 120"
    );
    $statement->execute([
        'start_date' => $period['startDateTime'],
        'end_date' => $period['endDateTime'],
    ]);

    $orders = [];
    foreach ($statement->fetchAll() as $row) {
        $totalTtc = (float) ($row['total_tax_excl'] ?? 0);
        $rateMultiplier = 1 + ($purchaseTaxRate / 100);
        $totalHt = $rateMultiplier > 0 ? $totalTtc / $rateMultiplier : $totalTtc;
        $tax = max(0, $totalTtc - $totalHt);
        $included = in_array((string) ($row['status'] ?? ''), ['ordered', 'received'], true);
        $orders[] = [
            'id' => (int) $row['id'],
            'orderNumber' => (string) ($row['order_number'] ?? ''),
            'supplierName' => (string) ($row['supplier_name'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'includedInExpenses' => $included,
            'totalTaxExcl' => $totalHt,
            'taxAmount' => $tax,
            'totalTaxIncl' => $totalTtc,
            'lineCount' => (int) ($row['line_count'] ?? 0),
            'expectedAt' => (string) ($row['expected_at'] ?? ''),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    return $orders;
}

function tresorcean_public_converted_quote(array $row): array
{
    $totalHt = (float) ($row['total_tax_excl'] ?? 0);
    $totalTtc = (float) ($row['total_tax_incl'] ?? 0);

    return [
        'id' => (int) $row['id'],
        'source' => (string) ($row['source'] ?? ''),
        'externalId' => (string) ($row['external_id'] ?? ''),
        'quoteNumber' => (string) ($row['quote_number'] ?? ''),
        'quoteDate' => (string) ($row['quote_date'] ?? ''),
        'signedAt' => (string) ($row['signed_at'] ?? ''),
        'convertedAt' => (string) ($row['updated_at'] ?? ''),
        'accountingDate' => (string) ($row['accounting_date'] ?? ''),
        'customerName' => (string) ($row['customer_name'] ?? ''),
        'customerEmail' => (string) ($row['customer_email'] ?? ''),
        'customerCompany' => (string) ($row['customer_company'] ?? ''),
        'vatNumber' => (string) ($row['vat_number'] ?? ''),
        'currencyIso' => (string) ($row['currency_iso'] ?? 'EUR'),
        'totalTaxExcl' => $totalHt,
        'vatAmount' => max(0, $totalTtc - $totalHt),
        'totalTaxIncl' => $totalTtc,
        'status' => (string) ($row['status'] ?? 'converted'),
        'invoiceId' => isset($row['invoice_id']) ? (int) $row['invoice_id'] : null,
        'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
        'invoiceDate' => (string) ($row['invoice_date'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_invocean_converted_quotes(PDO $pdo, array $period): array
{
    if (
        !oceanos_table_exists($pdo, 'invocean_signed_quotes')
        || !oceanos_table_exists($pdo, 'invocean_invoices')
    ) {
        return [];
    }

    $accountingDate = "COALESCE(i.invoice_date, DATE(q.updated_at), DATE(q.signed_at), q.quote_date, DATE(q.created_at))";
    $statement = $pdo->prepare(
        "SELECT q.*,
                i.invoice_number,
                i.invoice_date,
                {$accountingDate} AS accounting_date
         FROM invocean_signed_quotes q
         LEFT JOIN invocean_invoices i ON i.id = q.invoice_id
         WHERE q.status = 'converted'
           AND {$accountingDate} BETWEEN :start_date AND :end_date
         ORDER BY accounting_date DESC, q.id DESC
         LIMIT 200"
    );
    $statement->execute([
        'start_date' => $period['start'],
        'end_date' => $period['end'],
    ]);

    return array_map(static fn(array $row): array => tresorcean_public_converted_quote($row), $statement->fetchAll());
}

function tresorcean_public_entry(array $row, array $attachments = []): array
{
    return [
        'id' => (int) $row['id'],
        'userId' => isset($row['user_id']) ? (int) $row['user_id'] : null,
        'entryType' => (string) ($row['entry_type'] ?? 'fund'),
        'direction' => (string) ($row['direction'] ?? 'in'),
        'taxScope' => (string) ($row['tax_scope'] ?? 'neutral'),
        'label' => (string) ($row['label'] ?? ''),
        'counterparty' => (string) ($row['counterparty'] ?? ''),
        'amountTaxExcl' => (float) ($row['amount_tax_excl'] ?? 0),
        'taxAmount' => (float) ($row['tax_amount'] ?? 0),
        'amountTaxIncl' => (float) ($row['amount_tax_incl'] ?? 0),
        'taxRate' => (float) ($row['tax_rate'] ?? 0),
        'occurredAt' => (string) ($row['occurred_at'] ?? ''),
        'notes' => (string) ($row['notes'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'attachments' => $attachments,
    ];
}

function tresorcean_entries(PDO $pdo, array $period): array
{
    $statement = $pdo->prepare(
        'SELECT e.*, u.display_name AS user_display_name
         FROM tresorcean_entries e
         LEFT JOIN oceanos_users u ON u.id = e.user_id
         WHERE e.occurred_at BETWEEN :start_date AND :end_date
         ORDER BY e.occurred_at DESC, e.id DESC
         LIMIT 220'
    );
    $statement->execute([
        'start_date' => $period['start'],
        'end_date' => $period['end'],
    ]);

    $rows = $statement->fetchAll();
    $attachments = tresorcean_entry_attachments($pdo, array_map(static fn(array $row): int => (int) $row['id'], $rows));

    return array_map(
        static fn(array $row): array => tresorcean_public_entry($row, $attachments[(int) $row['id']] ?? []),
        $rows
    );
}

function tresorcean_normalize_entry_amounts(array $input): array
{
    $taxRate = max(0, min(100, tresorcean_decimal($input['taxRate'] ?? 0)));
    $amountHt = abs(tresorcean_decimal($input['amountTaxExcl'] ?? 0));
    $taxAmount = abs(tresorcean_decimal($input['taxAmount'] ?? 0));
    $amountTtc = abs(tresorcean_decimal($input['amountTaxIncl'] ?? 0));
    $taxScope = in_array((string) ($input['taxScope'] ?? 'neutral'), ['neutral', 'collected', 'deductible'], true)
        ? (string) $input['taxScope']
        : 'neutral';

    if ($amountTtc > 0 && $amountHt <= 0) {
        if ($taxScope !== 'neutral' && $taxRate > 0) {
            $amountHt = $amountTtc / (1 + ($taxRate / 100));
            $taxAmount = $amountTtc - $amountHt;
        } else {
            $amountHt = $amountTtc;
            $taxAmount = 0;
        }
    } elseif ($amountHt > 0 && $amountTtc <= 0) {
        if ($taxScope !== 'neutral' && $taxRate > 0 && $taxAmount <= 0) {
            $taxAmount = $amountHt * ($taxRate / 100);
        }
        $amountTtc = $amountHt + ($taxScope === 'neutral' ? 0 : $taxAmount);
    } elseif ($amountHt > 0 && $amountTtc > 0 && $taxAmount <= 0) {
        $taxAmount = max(0, $amountTtc - $amountHt);
    }

    if ($taxScope === 'neutral') {
        $taxAmount = 0;
        if ($amountTtc <= 0) {
            $amountTtc = $amountHt;
        }
    }

    if ($amountTtc <= 0) {
        throw new InvalidArgumentException('Montant invalide.');
    }

    return [
        'amountTaxExcl' => $amountHt,
        'taxAmount' => $taxAmount,
        'amountTaxIncl' => $amountTtc,
        'taxRate' => $taxRate,
        'taxScope' => $taxScope,
    ];
}

function tresorcean_save_entry(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $entryType = (string) ($input['entryType'] ?? 'fund');
    if (!in_array($entryType, ['fund', 'income', 'expense', 'supplier', 'tax_adjustment'], true)) {
        $entryType = 'fund';
    }
    $direction = (string) ($input['direction'] ?? 'in');
    if (!in_array($direction, ['in', 'out'], true)) {
        $direction = 'in';
    }
    $label = trim((string) ($input['label'] ?? ''));
    if ($label === '') {
        throw new InvalidArgumentException('Libelle obligatoire.');
    }
    $occurredAt = trim((string) ($input['occurredAt'] ?? date('Y-m-d')));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurredAt)) {
        throw new InvalidArgumentException('Date invalide.');
    }

    $amounts = tresorcean_normalize_entry_amounts($input);
    $params = [
        'user_id' => (int) $user['id'],
        'entry_type' => $entryType,
        'direction' => $direction,
        'tax_scope' => $amounts['taxScope'],
        'label' => $label,
        'counterparty' => trim((string) ($input['counterparty'] ?? '')) ?: null,
        'amount_tax_excl' => number_format($amounts['amountTaxExcl'], 6, '.', ''),
        'tax_amount' => number_format($amounts['taxAmount'], 6, '.', ''),
        'amount_tax_incl' => number_format($amounts['amountTaxIncl'], 6, '.', ''),
        'tax_rate' => number_format($amounts['taxRate'], 3, '.', ''),
        'occurred_at' => $occurredAt,
        'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
    ];

    if ($id > 0) {
        $existing = tresorcean_get_entry_row($pdo, $id);
        if (!tresorcean_is_admin($user) && (int) ($existing['user_id'] ?? 0) !== (int) $user['id']) {
            throw new InvalidArgumentException('Vous ne pouvez modifier que vos mouvements.');
        }
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE tresorcean_entries
             SET user_id = :user_id,
                 entry_type = :entry_type,
                 direction = :direction,
                 tax_scope = :tax_scope,
                 label = :label,
                 counterparty = :counterparty,
                 amount_tax_excl = :amount_tax_excl,
                 tax_amount = :tax_amount,
                 amount_tax_incl = :amount_tax_incl,
                 tax_rate = :tax_rate,
                 occurred_at = :occurred_at,
                 notes = :notes
             WHERE id = :id'
        );
        $statement->execute($params);
    } else {
        $statement = $pdo->prepare(
            'INSERT INTO tresorcean_entries
                (user_id, entry_type, direction, tax_scope, label, counterparty, amount_tax_excl, tax_amount, amount_tax_incl, tax_rate, occurred_at, notes)
             VALUES
                (:user_id, :entry_type, :direction, :tax_scope, :label, :counterparty, :amount_tax_excl, :tax_amount, :amount_tax_incl, :tax_rate, :occurred_at, :notes)'
        );
        $statement->execute($params);
        $id = (int) $pdo->lastInsertId();
    }

    $attachments = tresorcean_entry_attachments($pdo, [$id]);

    return tresorcean_public_entry(tresorcean_get_entry_row($pdo, $id), $attachments[$id] ?? []);
}

function tresorcean_get_entry_row(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT e.*, u.display_name AS user_display_name
         FROM tresorcean_entries e
         LEFT JOIN oceanos_users u ON u.id = e.user_id
         WHERE e.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Mouvement introuvable.');
    }

    return $row;
}

function tresorcean_delete_entry(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_entry_row($pdo, $id);
    if (!tresorcean_is_admin($user) && (int) ($row['user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez supprimer que vos mouvements.');
    }

    tresorcean_delete_entry_attachment_files($pdo, $id);
    $statement = $pdo->prepare('DELETE FROM tresorcean_entries WHERE id = :id');
    $statement->execute(['id' => $id]);
}

function tresorcean_month_buckets(string $start, string $end): array
{
    $cursor = (new DateTimeImmutable($start))->modify('first day of this month');
    $endDate = (new DateTimeImmutable($end))->modify('first day of this month');
    $buckets = [];
    $guard = 0;
    while ($cursor <= $endDate && $guard < 18) {
        $key = $cursor->format('Y-m');
        $buckets[$key] = [
            'month' => $key,
            'label' => $cursor->format('m/Y'),
            'cashIn' => 0.0,
            'cashOut' => 0.0,
            'revenueTaxExcl' => 0.0,
            'supplierTaxExcl' => 0.0,
            'manualIncomeTaxExcl' => 0.0,
            'manualExpenseTaxExcl' => 0.0,
            'vatCollected' => 0.0,
            'vatDeductible' => 0.0,
            'profitTaxExcl' => 0.0,
        ];
        $cursor = $cursor->modify('+1 month');
        $guard++;
    }

    return $buckets;
}

function tresorcean_bucket_key(string $date): string
{
    if (preg_match('/^\d{4}-\d{2}/', $date, $matches)) {
        return $matches[0];
    }

    return date('Y-m');
}

function tresorcean_summarize(array $orders, array $supplierOrders, array $convertedQuotes, array $entries, array $settings, array $period): array
{
    $summary = [
        'cashIn' => 0.0,
        'cashOut' => 0.0,
        'cashBalance' => 0.0,
        'revenueTaxExcl' => 0.0,
        'revenueTaxIncl' => 0.0,
        'prestashopRevenueTaxExcl' => 0.0,
        'prestashopRevenueTaxIncl' => 0.0,
        'prestashopVatCollected' => 0.0,
        'invoceanQuotesTaxExcl' => 0.0,
        'invoceanQuotesTaxIncl' => 0.0,
        'invoceanVatCollected' => 0.0,
        'estimatedCostOfGoodsTaxExcl' => 0.0,
        'grossMarginTaxExcl' => 0.0,
        'supplierOrdersTaxExcl' => 0.0,
        'supplierOrdersTaxIncl' => 0.0,
        'supplierVatDeductible' => 0.0,
        'manualCashIn' => 0.0,
        'manualCashOut' => 0.0,
        'manualIncomeTaxExcl' => 0.0,
        'manualExpenseTaxExcl' => 0.0,
        'manualVatCollected' => 0.0,
        'manualVatDeductible' => 0.0,
        'vatCollected' => 0.0,
        'vatDeductible' => 0.0,
        'vatDue' => 0.0,
        'estimatedProfitTaxExcl' => 0.0,
        'includedOrders' => 0,
        'loadedOrders' => count($orders),
        'supplierOrders' => count($supplierOrders),
        'convertedQuotes' => count($convertedQuotes),
        'manualEntries' => count($entries),
        'missingCostLines' => 0,
    ];
    $series = tresorcean_month_buckets($period['start'], $period['end']);

    foreach ($orders as $order) {
        if (empty($order['includedInRevenue'])) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($order['dateAdd'] ?? ''));
        $summary['includedOrders']++;
        $summary['revenueTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
        $summary['revenueTaxIncl'] += (float) ($order['totalTaxIncl'] ?? 0);
        $summary['prestashopRevenueTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
        $summary['prestashopRevenueTaxIncl'] += (float) ($order['totalTaxIncl'] ?? 0);
        $summary['prestashopVatCollected'] += (float) ($order['vatAmount'] ?? 0);
        $summary['estimatedCostOfGoodsTaxExcl'] += (float) ($order['estimatedCostTaxExcl'] ?? 0);
        $summary['missingCostLines'] += (int) ($order['missingCostLines'] ?? 0);
        if (isset($series[$key])) {
            $series[$key]['cashIn'] += (float) ($order['totalTaxIncl'] ?? 0);
            $series[$key]['revenueTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
            $series[$key]['vatCollected'] += (float) ($order['vatAmount'] ?? 0);
        }
    }

    foreach ($convertedQuotes as $quote) {
        $key = tresorcean_bucket_key((string) ($quote['accountingDate'] ?? $quote['convertedAt'] ?? ''));
        $amountHt = (float) ($quote['totalTaxExcl'] ?? 0);
        $amountTtc = (float) ($quote['totalTaxIncl'] ?? 0);
        $tax = (float) ($quote['vatAmount'] ?? 0);

        $summary['revenueTaxExcl'] += $amountHt;
        $summary['revenueTaxIncl'] += $amountTtc;
        $summary['invoceanQuotesTaxExcl'] += $amountHt;
        $summary['invoceanQuotesTaxIncl'] += $amountTtc;
        $summary['invoceanVatCollected'] += $tax;
        if (isset($series[$key])) {
            $series[$key]['cashIn'] += $amountTtc;
            $series[$key]['revenueTaxExcl'] += $amountHt;
            $series[$key]['vatCollected'] += $tax;
        }
    }

    foreach ($supplierOrders as $order) {
        if (empty($order['includedInExpenses'])) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($order['createdAt'] ?? ''));
        $summary['supplierOrdersTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
        $summary['supplierVatDeductible'] += (float) ($order['taxAmount'] ?? 0);
        $summary['supplierOrdersTaxIncl'] += (float) ($order['totalTaxIncl'] ?? 0);
        if (isset($series[$key])) {
            $series[$key]['cashOut'] += (float) ($order['totalTaxIncl'] ?? 0);
            $series[$key]['supplierTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
            $series[$key]['vatDeductible'] += (float) ($order['taxAmount'] ?? 0);
        }
    }

    foreach ($entries as $entry) {
        $key = tresorcean_bucket_key((string) ($entry['occurredAt'] ?? ''));
        $direction = (string) ($entry['direction'] ?? 'in');
        $entryType = (string) ($entry['entryType'] ?? 'fund');
        $scope = (string) ($entry['taxScope'] ?? 'neutral');
        $amountHt = (float) ($entry['amountTaxExcl'] ?? 0);
        $tax = (float) ($entry['taxAmount'] ?? 0);
        $amountTtc = (float) ($entry['amountTaxIncl'] ?? 0);

        if ($direction === 'in') {
            $summary['manualCashIn'] += $amountTtc;
            if ($entryType !== 'fund') {
                $summary['manualIncomeTaxExcl'] += $amountHt;
            }
            if (isset($series[$key])) {
                $series[$key]['cashIn'] += $amountTtc;
                if ($entryType !== 'fund') {
                    $series[$key]['manualIncomeTaxExcl'] += $amountHt;
                }
            }
        } else {
            $summary['manualCashOut'] += $amountTtc;
            if ($entryType !== 'fund') {
                $summary['manualExpenseTaxExcl'] += $amountHt;
            }
            if (isset($series[$key])) {
                $series[$key]['cashOut'] += $amountTtc;
                if ($entryType !== 'fund') {
                    $series[$key]['manualExpenseTaxExcl'] += $amountHt;
                }
            }
        }

        if ($scope === 'collected') {
            $summary['manualVatCollected'] += $tax;
            if (isset($series[$key])) {
                $series[$key]['vatCollected'] += $tax;
            }
        } elseif ($scope === 'deductible') {
            $summary['manualVatDeductible'] += $tax;
            if (isset($series[$key])) {
                $series[$key]['vatDeductible'] += $tax;
            }
        }
    }

    $summary['cashIn'] = $summary['revenueTaxIncl'] + $summary['manualCashIn'];
    $summary['cashOut'] = $summary['supplierOrdersTaxIncl'] + $summary['manualCashOut'];
    $summary['cashBalance'] = $summary['cashIn'] - $summary['cashOut'];
    $summary['grossMarginTaxExcl'] = $summary['revenueTaxExcl'] - $summary['estimatedCostOfGoodsTaxExcl'];
    $summary['estimatedProfitTaxExcl'] =
        $summary['revenueTaxExcl']
        + $summary['manualIncomeTaxExcl']
        - $summary['supplierOrdersTaxExcl']
        - $summary['manualExpenseTaxExcl'];
    $summary['vatCollected'] = $summary['prestashopVatCollected'] + $summary['invoceanVatCollected'] + $summary['manualVatCollected'];
    $summary['vatDeductible'] = $summary['supplierVatDeductible'] + $summary['manualVatDeductible'];
    $summary['vatDue'] = $summary['vatCollected'] - $summary['vatDeductible'];

    foreach ($series as &$bucket) {
        $bucket['profitTaxExcl'] =
            $bucket['revenueTaxExcl']
            + $bucket['manualIncomeTaxExcl']
            - $bucket['supplierTaxExcl']
            - $bucket['manualExpenseTaxExcl'];
    }
    unset($bucket);

    return [
        'summary' => $summary,
        'series' => array_values($series),
        'vat' => [
            'collected' => [
                'total' => $summary['vatCollected'],
                'prestashop' => $summary['prestashopVatCollected'],
                'invocean' => $summary['invoceanVatCollected'],
                'manual' => $summary['manualVatCollected'],
            ],
            'deductible' => [
                'total' => $summary['vatDeductible'],
                'supplierOrders' => $summary['supplierVatDeductible'],
                'manual' => $summary['manualVatDeductible'],
            ],
            'due' => $summary['vatDue'],
            'defaultPurchaseTaxRate' => (float) ($settings['defaultPurchaseTaxRate'] ?? 20),
        ],
    ];
}

function tresorcean_dashboard(PDO $pdo, array $query, array $user): array
{
    $preferences = tresorcean_user_preferences($pdo, (int) $user['id']);
    $period = tresorcean_period($query, $preferences);
    if (tresorcean_period_requested($query)) {
        $preferences = tresorcean_save_user_period($pdo, (int) $user['id'], $period);
    }
    $settings = tresorcean_settings($pdo);
    $orders = [];
    $states = [];
    $warnings = [];
    $prestashopStatus = [
        'connected' => false,
        'message' => 'PrestaShop non configure.',
        'settings' => oceanos_prestashop_public_settings($pdo, tresorcean_is_admin($user)),
    ];

    try {
        $orderPayload = tresorcean_fetch_orders($pdo, $period, $settings);
        $orders = $orderPayload['orders'];
        $states = $orderPayload['states'];
        $prestashopStatus = [
            'connected' => true,
            'message' => count($orders) . ' commande(s) PrestaShop chargee(s).',
            'settings' => $orderPayload['settings'],
        ];
    } catch (InvalidArgumentException $exception) {
        $warnings[] = $exception->getMessage();
    } catch (Throwable $exception) {
        $warnings[] = 'Lecture PrestaShop impossible: ' . $exception->getMessage();
    }

    $supplierOrders = tresorcean_supplier_orders($pdo, $period, (float) $settings['defaultPurchaseTaxRate']);
    $convertedQuotes = [];
    try {
        $convertedQuotes = tresorcean_invocean_converted_quotes($pdo, $period);
    } catch (Throwable $exception) {
        $warnings[] = 'Lecture Invocean impossible: ' . $exception->getMessage();
    }
    $entries = tresorcean_entries($pdo, $period);
    $computed = tresorcean_summarize($orders, $supplierOrders, $convertedQuotes, $entries, $settings, $period);

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'period' => [
            'start' => $period['start'],
            'end' => $period['end'],
        ],
        'preferences' => [
            'periodStart' => $preferences['periodStart'],
            'periodEnd' => $preferences['periodEnd'],
            'updatedAt' => $preferences['updatedAt'],
        ],
        'settings' => $settings,
        'prestashop' => $prestashopStatus,
        'warnings' => $warnings,
        'states' => $states,
        'orders' => $orders,
        'supplierOrders' => $supplierOrders,
        'convertedQuotes' => $convertedQuotes,
        'entries' => $entries,
        'summary' => $computed['summary'],
        'series' => $computed['series'],
        'vat' => $computed['vat'],
    ];
}
