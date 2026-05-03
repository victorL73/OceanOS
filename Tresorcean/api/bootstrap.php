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

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_expense_notes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            employee_name VARCHAR(190) NOT NULL,
            status ENUM('received', 'approved', 'reimbursed', 'rejected') NOT NULL DEFAULT 'received',
            label VARCHAR(190) NOT NULL,
            merchant VARCHAR(190) NULL,
            amount_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(14,6) NOT NULL DEFAULT 0,
            amount_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
            tax_scope ENUM('neutral', 'deductible') NOT NULL DEFAULT 'deductible',
            expense_at DATE NOT NULL,
            reimbursed_at DATE NULL,
            notes TEXT NULL,
            attachment_original_name VARCHAR(255) NULL,
            attachment_stored_name VARCHAR(190) NULL,
            attachment_storage_mode ENUM('file', 'database') NOT NULL DEFAULT 'file',
            attachment_mime_type VARCHAR(120) NULL,
            attachment_file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
            attachment_file_content LONGBLOB NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tresorcean_expense_status (status),
            KEY idx_tresorcean_expense_dates (expense_at, reimbursed_at),
            KEY idx_tresorcean_expense_user (user_id),
            CONSTRAINT fk_tresorcean_expense_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_vat_payments (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            paid_at DATE NOT NULL,
            amount DECIMAL(14,6) NOT NULL DEFAULT 0,
            label VARCHAR(190) NOT NULL DEFAULT 'Paiement TVA',
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tresorcean_vat_payment_period (period_start, period_end),
            KEY idx_tresorcean_vat_payment_paid_at (paid_at),
            KEY idx_tresorcean_vat_payment_user (user_id),
            CONSTRAINT fk_tresorcean_vat_payment_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

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

function tresorcean_store_uploaded_file(array $upload): array
{
    $error = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException(tresorcean_upload_error_label($error));
    }

    $size = (int) ($upload['size'] ?? 0);
    if ($size <= 0 || $size > TRESORCEAN_ATTACHMENT_MAX_BYTES) {
        throw new InvalidArgumentException('Chaque justificatif doit faire entre 1 octet et 10 Mo.');
    }

    $tmpName = (string) ($upload['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new InvalidArgumentException('Justificatif invalide.');
    }

    $originalName = tresorcean_safe_attachment_name((string) ($upload['name'] ?? 'justificatif'));
    $extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, TRESORCEAN_ATTACHMENT_EXTENSIONS, true)) {
        throw new InvalidArgumentException('Type de fichier non autorise.');
    }

    try {
        $dir = tresorcean_ensure_attachment_storage();
    } catch (Throwable) {
        $dir = null;
    }

    $storedName = bin2hex(random_bytes(16)) . '.' . $extension;
    $target = $dir ? $dir . DIRECTORY_SEPARATOR . $storedName : null;
    $storageMode = 'file';
    $fileContent = null;
    if ($target === null || !move_uploaded_file($tmpName, $target)) {
        $fileContent = file_get_contents($tmpName);
        if ($fileContent === false) {
            throw new RuntimeException('Impossible d enregistrer le justificatif.');
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

    return [
        'originalName' => $originalName,
        'storedName' => $storedName,
        'storageMode' => $storageMode,
        'mimeType' => substr($mimeType, 0, 120) ?: null,
        'fileSize' => $size,
        'fileContent' => $fileContent,
        'filePath' => $target,
    ];
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
    $recordKind = (string) ($row['record_kind'] ?? 'quote');
    $id = (int) ($row['quote_id'] ?? $row['id'] ?? 0);
    $invoiceId = isset($row['invoice_id']) ? (int) $row['invoice_id'] : null;
    $totalHt = (float) ($row['total_tax_excl'] ?? 0);
    $totalTtc = (float) ($row['total_tax_incl'] ?? 0);
    $targetUrl = (string) ($row['target_url'] ?? '');
    if ($targetUrl === '') {
        $targetUrl = $recordKind === 'invoice' && $invoiceId !== null
            ? '/Invocean/?invoice=' . $invoiceId
            : '/Invocean/?tab=quotes&quote=' . $id;
    }

    return [
        'id' => $id,
        'recordKind' => $recordKind,
        'source' => (string) ($row['source'] ?? 'invocean'),
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
        'status' => (string) ($row['quote_status'] ?? $row['status'] ?? 'converted'),
        'invoiceId' => $invoiceId,
        'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
        'invoiceDate' => (string) ($row['invoice_date'] ?? ''),
        'targetUrl' => $targetUrl,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_invocean_converted_quotes(PDO $pdo, array $period): array
{
    $hasQuotes = oceanos_table_exists($pdo, 'invocean_signed_quotes');
    $hasInvoices = oceanos_table_exists($pdo, 'invocean_invoices');
    if (!$hasQuotes && !$hasInvoices) {
        return [];
    }

    $converted = [];

    if ($hasQuotes && $hasInvoices) {
        $accountingDate = "COALESCE(i.invoice_date, DATE(q.updated_at), DATE(q.signed_at), q.quote_date, DATE(q.created_at))";
        $statement = $pdo->prepare(
            "SELECT q.*,
                    q.id AS quote_id,
                    q.status AS quote_status,
                    i.invoice_number,
                    i.invoice_date,
                    {$accountingDate} AS accounting_date,
                    'quote' AS record_kind
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
        foreach ($statement->fetchAll() as $row) {
            $converted[] = tresorcean_public_converted_quote($row);
        }
    }

    if ($hasInvoices && oceanos_column_exists($pdo, 'invocean_invoices', 'channel')) {
        $accountingDate = "COALESCE(i.invoice_date, DATE(i.updated_at), DATE(i.created_at))";
        $deletedFilter = oceanos_column_exists($pdo, 'invocean_invoices', 'deleted_at') ? 'AND i.deleted_at IS NULL' : '';
        $linkedQuoteFilter = $hasQuotes
            ? "AND NOT EXISTS (
                SELECT 1
                FROM invocean_signed_quotes q
                WHERE q.invoice_id = i.id
                  AND q.status = 'converted'
              )"
            : '';
        $statement = $pdo->prepare(
            "SELECT i.id,
                    i.id AS quote_id,
                    i.channel AS source,
                    CAST(i.id AS CHAR) AS external_id,
                    COALESCE(NULLIF(i.order_reference, ''), NULLIF(i.invoice_number, ''), CONCAT('Facture ', i.id)) AS quote_number,
                    i.invoice_date AS quote_date,
                    i.created_at AS signed_at,
                    'converted' AS quote_status,
                    i.customer_name,
                    i.customer_email,
                    i.customer_company,
                    i.vat_number,
                    i.currency_iso,
                    i.total_tax_excl,
                    i.total_tax_incl,
                    i.id AS invoice_id,
                    i.invoice_number,
                    i.invoice_date,
                    {$accountingDate} AS accounting_date,
                    i.created_at,
                    i.updated_at,
                    'invoice' AS record_kind
             FROM invocean_invoices i
             WHERE i.channel <> 'prestashop'
               AND i.status NOT IN ('rejected', 'archived')
               {$deletedFilter}
               {$linkedQuoteFilter}
               AND {$accountingDate} BETWEEN :invoice_start_date AND :invoice_end_date
             ORDER BY accounting_date DESC, i.id DESC
             LIMIT 200"
        );
        $statement->execute([
            'invoice_start_date' => $period['start'],
            'invoice_end_date' => $period['end'],
        ]);
        foreach ($statement->fetchAll() as $row) {
            $converted[] = tresorcean_public_converted_quote($row);
        }
    }

    usort($converted, static function (array $left, array $right): int {
        $dateCompare = strcmp((string) ($right['accountingDate'] ?? ''), (string) ($left['accountingDate'] ?? ''));
        if ($dateCompare !== 0) {
            return $dateCompare;
        }

        return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
    });

    return array_slice($converted, 0, 200);
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

function tresorcean_expense_status(string $status): string
{
    return in_array($status, ['received', 'approved', 'reimbursed', 'rejected'], true) ? $status : 'received';
}

function tresorcean_public_expense_attachment(array $row): ?array
{
    if (trim((string) ($row['attachment_stored_name'] ?? '')) === '') {
        return null;
    }

    $id = (int) $row['id'];
    return [
        'id' => $id,
        'name' => (string) ($row['attachment_original_name'] ?? 'justificatif'),
        'mimeType' => (string) ($row['attachment_mime_type'] ?? ''),
        'fileSize' => (int) ($row['attachment_file_size'] ?? 0),
        'downloadUrl' => 'api/finance.php?action=expense_attachment&id=' . $id,
    ];
}

function tresorcean_public_expense_note(array $row): array
{
    $status = tresorcean_expense_status((string) ($row['status'] ?? 'received'));
    $expenseAt = (string) ($row['expense_at'] ?? '');
    $reimbursedAt = (string) ($row['reimbursed_at'] ?? '');

    return [
        'id' => (int) $row['id'],
        'userId' => isset($row['user_id']) ? (int) $row['user_id'] : null,
        'employeeName' => (string) ($row['employee_name'] ?? ''),
        'status' => $status,
        'label' => (string) ($row['label'] ?? ''),
        'merchant' => (string) ($row['merchant'] ?? ''),
        'amountTaxExcl' => (float) ($row['amount_tax_excl'] ?? 0),
        'taxAmount' => (float) ($row['tax_amount'] ?? 0),
        'amountTaxIncl' => (float) ($row['amount_tax_incl'] ?? 0),
        'taxRate' => (float) ($row['tax_rate'] ?? 0),
        'taxScope' => (string) ($row['tax_scope'] ?? 'deductible'),
        'expenseAt' => $expenseAt,
        'reimbursedAt' => $reimbursedAt,
        'accountingAt' => $status === 'reimbursed' ? ($reimbursedAt ?: $expenseAt) : '',
        'includedInMovements' => $status === 'reimbursed',
        'notes' => (string) ($row['notes'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'attachment' => tresorcean_public_expense_attachment($row),
    ];
}

function tresorcean_expense_notes(PDO $pdo, array $period): array
{
    $statement = $pdo->prepare(
        'SELECT n.*, u.display_name AS user_display_name
         FROM tresorcean_expense_notes n
         LEFT JOIN oceanos_users u ON u.id = n.user_id
         WHERE n.expense_at BETWEEN :expense_start AND :expense_end
            OR n.reimbursed_at BETWEEN :reimbursed_start AND :reimbursed_end
         ORDER BY COALESCE(n.reimbursed_at, n.expense_at) DESC, n.id DESC
         LIMIT 240'
    );
    $statement->execute([
        'expense_start' => $period['start'],
        'expense_end' => $period['end'],
        'reimbursed_start' => $period['start'],
        'reimbursed_end' => $period['end'],
    ]);

    return array_map(static fn(array $row): array => tresorcean_public_expense_note($row), $statement->fetchAll());
}

function tresorcean_get_expense_note_row(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT n.*, u.display_name AS user_display_name
         FROM tresorcean_expense_notes n
         LEFT JOIN oceanos_users u ON u.id = n.user_id
         WHERE n.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Note de frais introuvable.');
    }

    return $row;
}

function tresorcean_delete_expense_attachment_file(array $row): void
{
    if ((string) ($row['attachment_storage_mode'] ?? 'file') !== 'file') {
        return;
    }
    $storedName = (string) ($row['attachment_stored_name'] ?? '');
    if ($storedName === '') {
        return;
    }
    $path = tresorcean_attachment_path($storedName);
    if (is_file($path)) {
        @unlink($path);
    }
}

function tresorcean_expense_upload_from_request(array $files): ?array
{
    if (!isset($files['receipt'])) {
        return null;
    }

    $uploads = tresorcean_normalize_uploaded_files($files['receipt']);
    foreach ($uploads as $upload) {
        if ((int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            return $upload;
        }
    }

    return null;
}

function tresorcean_save_expense_note(PDO $pdo, array $user, array $input, array $files = []): array
{
    $id = (int) ($input['id'] ?? 0);
    $existing = null;
    if ($id > 0) {
        $existing = tresorcean_get_expense_note_row($pdo, $id);
        if (!tresorcean_is_admin($user) && (int) ($existing['user_id'] ?? 0) !== (int) $user['id']) {
            throw new InvalidArgumentException('Vous ne pouvez modifier que vos notes de frais.');
        }
    }

    $employeeName = trim((string) ($input['employeeName'] ?? ''));
    if ($employeeName === '') {
        throw new InvalidArgumentException('Nom de l equipe obligatoire.');
    }
    $label = trim((string) ($input['label'] ?? ''));
    if ($label === '') {
        throw new InvalidArgumentException('Libelle obligatoire.');
    }

    $expenseAt = trim((string) ($input['expenseAt'] ?? date('Y-m-d')));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseAt)) {
        throw new InvalidArgumentException('Date de depense invalide.');
    }

    $status = tresorcean_expense_status((string) ($input['status'] ?? 'received'));
    $reimbursedAt = trim((string) ($input['reimbursedAt'] ?? ''));
    if ($status === 'reimbursed') {
        if ($reimbursedAt === '') {
            $reimbursedAt = $expenseAt;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $reimbursedAt)) {
            throw new InvalidArgumentException('Date de remboursement invalide.');
        }
    } else {
        $reimbursedAt = null;
    }

    $taxScope = in_array((string) ($input['taxScope'] ?? 'deductible'), ['neutral', 'deductible'], true)
        ? (string) $input['taxScope']
        : 'deductible';
    $amounts = tresorcean_normalize_entry_amounts([
        ...$input,
        'taxScope' => $taxScope,
    ]);

    $upload = tresorcean_expense_upload_from_request($files);
    $stored = null;
    if ($upload !== null) {
        $stored = tresorcean_store_uploaded_file($upload);
    } elseif ($id <= 0) {
        throw new InvalidArgumentException('Facture ou ticket de caisse obligatoire.');
    }

    $base = [
        'user_id' => (int) $user['id'],
        'employee_name' => $employeeName,
        'status' => $status,
        'label' => $label,
        'merchant' => trim((string) ($input['merchant'] ?? '')) ?: null,
        'amount_tax_excl' => number_format($amounts['amountTaxExcl'], 6, '.', ''),
        'tax_amount' => number_format($amounts['taxAmount'], 6, '.', ''),
        'amount_tax_incl' => number_format($amounts['amountTaxIncl'], 6, '.', ''),
        'tax_rate' => number_format($amounts['taxRate'], 3, '.', ''),
        'tax_scope' => $amounts['taxScope'],
        'expense_at' => $expenseAt,
        'reimbursed_at' => $reimbursedAt,
        'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
    ];

    try {
        if ($id > 0) {
            if ($stored !== null) {
                $statement = $pdo->prepare(
                    'UPDATE tresorcean_expense_notes
                     SET user_id = :user_id,
                         employee_name = :employee_name,
                         status = :status,
                         label = :label,
                         merchant = :merchant,
                         amount_tax_excl = :amount_tax_excl,
                         tax_amount = :tax_amount,
                         amount_tax_incl = :amount_tax_incl,
                         tax_rate = :tax_rate,
                         tax_scope = :tax_scope,
                         expense_at = :expense_at,
                         reimbursed_at = :reimbursed_at,
                         notes = :notes,
                         attachment_original_name = :attachment_original_name,
                         attachment_stored_name = :attachment_stored_name,
                         attachment_storage_mode = :attachment_storage_mode,
                         attachment_mime_type = :attachment_mime_type,
                         attachment_file_size = :attachment_file_size,
                         attachment_file_content = :attachment_file_content
                     WHERE id = :id'
                );
                foreach ($base as $key => $value) {
                    $statement->bindValue(':' . $key, $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                }
                $statement->bindValue(':attachment_original_name', $stored['originalName']);
                $statement->bindValue(':attachment_stored_name', $stored['storedName']);
                $statement->bindValue(':attachment_storage_mode', $stored['storageMode']);
                $statement->bindValue(':attachment_mime_type', $stored['mimeType']);
                $statement->bindValue(':attachment_file_size', $stored['fileSize'], PDO::PARAM_INT);
                $statement->bindValue(':attachment_file_content', $stored['fileContent'], $stored['fileContent'] === null ? PDO::PARAM_NULL : PDO::PARAM_LOB);
                $statement->bindValue(':id', $id, PDO::PARAM_INT);
                $statement->execute();
                tresorcean_delete_expense_attachment_file($existing);
            } else {
                $base['id'] = $id;
                $statement = $pdo->prepare(
                    'UPDATE tresorcean_expense_notes
                     SET user_id = :user_id,
                         employee_name = :employee_name,
                         status = :status,
                         label = :label,
                         merchant = :merchant,
                         amount_tax_excl = :amount_tax_excl,
                         tax_amount = :tax_amount,
                         amount_tax_incl = :amount_tax_incl,
                         tax_rate = :tax_rate,
                         tax_scope = :tax_scope,
                         expense_at = :expense_at,
                         reimbursed_at = :reimbursed_at,
                         notes = :notes
                     WHERE id = :id'
                );
                $statement->execute($base);
            }
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO tresorcean_expense_notes
                    (user_id, employee_name, status, label, merchant, amount_tax_excl, tax_amount, amount_tax_incl, tax_rate, tax_scope, expense_at, reimbursed_at, notes, attachment_original_name, attachment_stored_name, attachment_storage_mode, attachment_mime_type, attachment_file_size, attachment_file_content)
                 VALUES
                    (:user_id, :employee_name, :status, :label, :merchant, :amount_tax_excl, :tax_amount, :amount_tax_incl, :tax_rate, :tax_scope, :expense_at, :reimbursed_at, :notes, :attachment_original_name, :attachment_stored_name, :attachment_storage_mode, :attachment_mime_type, :attachment_file_size, :attachment_file_content)'
            );
            foreach ($base as $key => $value) {
                $statement->bindValue(':' . $key, $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            }
            $statement->bindValue(':attachment_original_name', $stored['originalName']);
            $statement->bindValue(':attachment_stored_name', $stored['storedName']);
            $statement->bindValue(':attachment_storage_mode', $stored['storageMode']);
            $statement->bindValue(':attachment_mime_type', $stored['mimeType']);
            $statement->bindValue(':attachment_file_size', $stored['fileSize'], PDO::PARAM_INT);
            $statement->bindValue(':attachment_file_content', $stored['fileContent'], $stored['fileContent'] === null ? PDO::PARAM_NULL : PDO::PARAM_LOB);
            $statement->execute();
            $id = (int) $pdo->lastInsertId();
        }
    } catch (Throwable $exception) {
        if ($stored !== null && $stored['filePath'] !== null) {
            @unlink((string) $stored['filePath']);
        }
        throw $exception;
    }

    return tresorcean_public_expense_note(tresorcean_get_expense_note_row($pdo, $id));
}

function tresorcean_delete_expense_note(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_expense_note_row($pdo, $id);
    if (!tresorcean_is_admin($user) && (int) ($row['user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez supprimer que vos notes de frais.');
    }

    $statement = $pdo->prepare('DELETE FROM tresorcean_expense_notes WHERE id = :id');
    $statement->execute(['id' => $id]);
    tresorcean_delete_expense_attachment_file($row);
}

function tresorcean_download_expense_attachment(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_expense_note_row($pdo, $id);
    $storedName = (string) ($row['attachment_stored_name'] ?? '');
    if ($storedName === '') {
        throw new InvalidArgumentException('Justificatif introuvable.');
    }

    $name = tresorcean_safe_attachment_name((string) ($row['attachment_original_name'] ?? 'justificatif'));
    $asciiName = str_replace(['\\', '"'], '_', $name);
    $mimeType = trim((string) ($row['attachment_mime_type'] ?? '')) ?: 'application/octet-stream';
    $content = null;
    $path = null;
    if ((string) ($row['attachment_storage_mode'] ?? 'file') === 'database') {
        $content = $row['attachment_file_content'] ?? null;
        if (!is_string($content)) {
            throw new InvalidArgumentException('Justificatif introuvable.');
        }
    } else {
        $path = tresorcean_attachment_path($storedName);
        if (!is_file($path)) {
            throw new InvalidArgumentException('Justificatif introuvable.');
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

function tresorcean_public_vat_payment(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'userId' => isset($row['user_id']) ? (int) $row['user_id'] : null,
        'periodStart' => (string) ($row['period_start'] ?? ''),
        'periodEnd' => (string) ($row['period_end'] ?? ''),
        'paidAt' => (string) ($row['paid_at'] ?? ''),
        'amount' => (float) ($row['amount'] ?? 0),
        'label' => (string) ($row['label'] ?? 'Paiement TVA'),
        'notes' => (string) ($row['notes'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
    ];
}

function tresorcean_vat_payments(PDO $pdo, array $period): array
{
    $statement = $pdo->prepare(
        'SELECT p.*, u.display_name AS user_display_name
         FROM tresorcean_vat_payments p
         LEFT JOIN oceanos_users u ON u.id = p.user_id
         WHERE p.paid_at BETWEEN :paid_start AND :paid_end
            OR p.period_start BETWEEN :period_start_a AND :period_end_a
            OR p.period_end BETWEEN :period_start_b AND :period_end_b
            OR (p.period_start <= :period_start_c AND p.period_end >= :period_end_c)
         ORDER BY p.paid_at DESC, p.id DESC
         LIMIT 120'
    );
    $statement->execute([
        'paid_start' => $period['start'],
        'paid_end' => $period['end'],
        'period_start_a' => $period['start'],
        'period_end_a' => $period['end'],
        'period_start_b' => $period['start'],
        'period_end_b' => $period['end'],
        'period_start_c' => $period['start'],
        'period_end_c' => $period['end'],
    ]);

    return array_map(static fn(array $row): array => tresorcean_public_vat_payment($row), $statement->fetchAll());
}

function tresorcean_get_vat_payment_row(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT p.*, u.display_name AS user_display_name
         FROM tresorcean_vat_payments p
         LEFT JOIN oceanos_users u ON u.id = p.user_id
         WHERE p.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Paiement TVA introuvable.');
    }

    return $row;
}

function tresorcean_save_vat_payment(PDO $pdo, array $user, array $input): array
{
    $amount = round(abs(tresorcean_decimal($input['amount'] ?? 0)), 2);
    if ($amount <= 0) {
        throw new InvalidArgumentException('Montant TVA invalide.');
    }

    $periodStart = trim((string) ($input['periodStart'] ?? ''));
    $periodEnd = trim((string) ($input['periodEnd'] ?? ''));
    $paidAt = trim((string) ($input['paidAt'] ?? date('Y-m-d')));
    foreach ([$periodStart, $periodEnd, $paidAt] as $date) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new InvalidArgumentException('Date TVA invalide.');
        }
    }
    if ($periodEnd < $periodStart) {
        [$periodStart, $periodEnd] = [$periodEnd, $periodStart];
    }

    $statement = $pdo->prepare(
        'INSERT INTO tresorcean_vat_payments
            (user_id, period_start, period_end, paid_at, amount, label, notes)
         VALUES
            (:user_id, :period_start, :period_end, :paid_at, :amount, :label, :notes)'
    );
    $statement->execute([
        'user_id' => (int) $user['id'],
        'period_start' => $periodStart,
        'period_end' => $periodEnd,
        'paid_at' => $paidAt,
        'amount' => number_format($amount, 6, '.', ''),
        'label' => trim((string) ($input['label'] ?? 'Paiement TVA')) ?: 'Paiement TVA',
        'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
    ]);

    return tresorcean_public_vat_payment(tresorcean_get_vat_payment_row($pdo, (int) $pdo->lastInsertId()));
}

function tresorcean_delete_vat_payment(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_vat_payment_row($pdo, $id);
    if (!tresorcean_is_admin($user) && (int) ($row['user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez annuler que vos paiements TVA.');
    }

    $statement = $pdo->prepare('DELETE FROM tresorcean_vat_payments WHERE id = :id');
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

function tresorcean_summarize(array $orders, array $supplierOrders, array $convertedQuotes, array $entries, array $expenseNotes, array $vatPayments, array $settings, array $period): array
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
        'expenseNotesTaxExcl' => 0.0,
        'expenseNotesTaxIncl' => 0.0,
        'expenseNotesVatDeductible' => 0.0,
        'vatDueBeforePayments' => 0.0,
        'vatPaid' => 0.0,
        'vatPaymentCashOut' => 0.0,
        'vatCollected' => 0.0,
        'vatDeductible' => 0.0,
        'vatDue' => 0.0,
        'estimatedProfitTaxExcl' => 0.0,
        'includedOrders' => 0,
        'loadedOrders' => count($orders),
        'supplierOrders' => count($supplierOrders),
        'convertedQuotes' => count($convertedQuotes),
        'manualEntries' => count($entries),
        'expenseNotes' => count($expenseNotes),
        'reimbursedExpenseNotes' => 0,
        'vatPayments' => count($vatPayments),
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

    foreach ($expenseNotes as $note) {
        if (empty($note['includedInMovements'])) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($note['accountingAt'] ?? $note['expenseAt'] ?? ''));
        $scope = (string) ($note['taxScope'] ?? 'deductible');
        $amountHt = (float) ($note['amountTaxExcl'] ?? 0);
        $tax = (float) ($note['taxAmount'] ?? 0);
        $amountTtc = (float) ($note['amountTaxIncl'] ?? 0);

        $summary['reimbursedExpenseNotes']++;
        $summary['expenseNotesTaxExcl'] += $amountHt;
        $summary['expenseNotesTaxIncl'] += $amountTtc;
        $summary['manualCashOut'] += $amountTtc;
        $summary['manualExpenseTaxExcl'] += $amountHt;
        if ($scope === 'deductible') {
            $summary['expenseNotesVatDeductible'] += $tax;
            $summary['manualVatDeductible'] += $tax;
        }

        if (isset($series[$key])) {
            $series[$key]['cashOut'] += $amountTtc;
            $series[$key]['manualExpenseTaxExcl'] += $amountHt;
            if ($scope === 'deductible') {
                $series[$key]['vatDeductible'] += $tax;
            }
        }
    }

    foreach ($vatPayments as $payment) {
        $amount = (float) ($payment['amount'] ?? 0);
        if ($amount <= 0) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($payment['paidAt'] ?? ''));
        $summary['vatPaid'] += $amount;
        $summary['vatPaymentCashOut'] += $amount;
        if (isset($series[$key])) {
            $series[$key]['cashOut'] += $amount;
        }
    }

    $summary['cashIn'] = $summary['revenueTaxIncl'] + $summary['manualCashIn'];
    $summary['cashOut'] = $summary['supplierOrdersTaxIncl'] + $summary['manualCashOut'] + $summary['vatPaymentCashOut'];
    $summary['cashBalance'] = $summary['cashIn'] - $summary['cashOut'];
    $summary['grossMarginTaxExcl'] = $summary['revenueTaxExcl'] - $summary['estimatedCostOfGoodsTaxExcl'];
    $summary['estimatedProfitTaxExcl'] =
        $summary['revenueTaxExcl']
        + $summary['manualIncomeTaxExcl']
        - $summary['supplierOrdersTaxExcl']
        - $summary['manualExpenseTaxExcl'];
    $summary['vatCollected'] = $summary['prestashopVatCollected'] + $summary['invoceanVatCollected'] + $summary['manualVatCollected'];
    $summary['vatDeductible'] = $summary['supplierVatDeductible'] + $summary['manualVatDeductible'];
    $summary['vatDueBeforePayments'] = $summary['vatCollected'] - $summary['vatDeductible'];
    $summary['vatDue'] = $summary['vatDueBeforePayments'] > 0
        ? max(0, $summary['vatDueBeforePayments'] - $summary['vatPaid'])
        : $summary['vatDueBeforePayments'];

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
                'expenseNotes' => $summary['expenseNotesVatDeductible'],
            ],
            'beforePayments' => $summary['vatDueBeforePayments'],
            'paid' => $summary['vatPaid'],
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
    $expenseNotes = tresorcean_expense_notes($pdo, $period);
    $vatPayments = tresorcean_vat_payments($pdo, $period);
    $computed = tresorcean_summarize($orders, $supplierOrders, $convertedQuotes, $entries, $expenseNotes, $vatPayments, $settings, $period);

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
        'expenseNotes' => $expenseNotes,
        'vatPayments' => $vatPayments,
        'summary' => $computed['summary'],
        'series' => $computed['series'],
        'vat' => $computed['vat'],
    ];
}
