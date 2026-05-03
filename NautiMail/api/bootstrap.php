<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const NAUTIMAIL_MODULE_ID = 'nautimail';

function nautimail_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    oceanos_send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function nautimail_read_json_request(): array
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

function nautimail_pdo(): PDO
{
    $pdo = oceanos_pdo();
    nautimail_ensure_schema($pdo);
    return $pdo;
}

function nautimail_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautimail_accounts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(120) NOT NULL,
            email_address VARCHAR(190) NOT NULL,
            display_name VARCHAR(160) NULL,
            imap_host VARCHAR(190) NOT NULL,
            imap_port INT UNSIGNED NOT NULL DEFAULT 993,
            imap_encryption ENUM('ssl', 'tls', 'none') NOT NULL DEFAULT 'ssl',
            imap_folder VARCHAR(120) NOT NULL DEFAULT 'INBOX',
            smtp_host VARCHAR(190) NULL,
            smtp_port INT UNSIGNED NOT NULL DEFAULT 587,
            smtp_encryption ENUM('ssl', 'tls', 'none') NOT NULL DEFAULT 'tls',
            username VARCHAR(190) NOT NULL,
            password_cipher TEXT NULL,
            reply_to VARCHAR(190) NULL,
            signature TEXT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_by_user_id BIGINT UNSIGNED NULL,
            updated_by_user_id BIGINT UNSIGNED NULL,
            last_sync_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_nautimail_accounts_email (email_address),
            KEY idx_nautimail_accounts_active (is_active),
            CONSTRAINT fk_nautimail_accounts_created_by FOREIGN KEY (created_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL,
            CONSTRAINT fk_nautimail_accounts_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautimail_account_users (
            account_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            can_manage TINYINT(1) NOT NULL DEFAULT 0,
            can_reply TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, user_id),
            KEY idx_nautimail_account_users_user (user_id),
            CONSTRAINT fk_nautimail_account_users_account FOREIGN KEY (account_id) REFERENCES nautimail_accounts(id) ON DELETE CASCADE,
            CONSTRAINT fk_nautimail_account_users_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautimail_messages (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            account_id BIGINT UNSIGNED NOT NULL,
            mailbox VARCHAR(120) NOT NULL DEFAULT 'INBOX',
            imap_uid BIGINT UNSIGNED NOT NULL,
            message_id VARCHAR(255) NULL,
            thread_key VARCHAR(255) NULL,
            subject VARCHAR(255) NULL,
            sender_name VARCHAR(190) NULL,
            sender_email VARCHAR(190) NULL,
            recipient_text TEXT NULL,
            cc_text TEXT NULL,
            bcc_text TEXT NULL,
            received_at DATETIME NULL,
            preview TEXT NULL,
            body_text LONGTEXT NULL,
            body_html LONGTEXT NULL,
            attachments_json LONGTEXT NULL,
            category ENUM('client', 'vente', 'gestion', 'support', 'finance', 'spam', 'autre') NOT NULL DEFAULT 'autre',
            priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
            status ENUM('new', 'triaged', 'read', 'replied', 'archived') NOT NULL DEFAULT 'new',
            ai_summary TEXT NULL,
            ai_actions TEXT NULL,
            assigned_user_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_nautimail_message_uid (account_id, mailbox, imap_uid),
            KEY idx_nautimail_messages_received (received_at),
            KEY idx_nautimail_messages_category (category),
            KEY idx_nautimail_messages_status (status),
            KEY idx_nautimail_messages_sender (sender_email),
            KEY idx_nautimail_messages_assigned (assigned_user_id),
            CONSTRAINT fk_nautimail_messages_account FOREIGN KEY (account_id) REFERENCES nautimail_accounts(id) ON DELETE CASCADE,
            CONSTRAINT fk_nautimail_messages_assigned FOREIGN KEY (assigned_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautimail_replies (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            message_id BIGINT UNSIGNED NOT NULL,
            account_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NULL,
            to_email TEXT NOT NULL,
            cc_email TEXT NULL,
            bcc_email TEXT NULL,
            subject VARCHAR(255) NOT NULL,
            body_text LONGTEXT NOT NULL,
            status ENUM('draft', 'sent', 'failed') NOT NULL DEFAULT 'sent',
            error_message TEXT NULL,
            sent_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_nautimail_replies_message (message_id),
            KEY idx_nautimail_replies_account (account_id),
            KEY idx_nautimail_replies_user (user_id),
            CONSTRAINT fk_nautimail_replies_message FOREIGN KEY (message_id) REFERENCES nautimail_messages(id) ON DELETE CASCADE,
            CONSTRAINT fk_nautimail_replies_account FOREIGN KEY (account_id) REFERENCES nautimail_accounts(id) ON DELETE CASCADE,
            CONSTRAINT fk_nautimail_replies_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!oceanos_column_exists($pdo, 'nautimail_messages', 'bcc_text')) {
        $pdo->exec('ALTER TABLE nautimail_messages ADD COLUMN bcc_text TEXT NULL AFTER cc_text');
    }
    if (!oceanos_column_exists($pdo, 'nautimail_messages', 'attachments_json')) {
        $pdo->exec('ALTER TABLE nautimail_messages ADD COLUMN attachments_json LONGTEXT NULL AFTER body_html');
    }
    if (!oceanos_column_exists($pdo, 'nautimail_replies', 'cc_email')) {
        $pdo->exec('ALTER TABLE nautimail_replies ADD COLUMN cc_email TEXT NULL AFTER to_email');
    }
    if (!oceanos_column_exists($pdo, 'nautimail_replies', 'bcc_email')) {
        $pdo->exec('ALTER TABLE nautimail_replies ADD COLUMN bcc_email TEXT NULL AFTER cc_email');
    }
}

function nautimail_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(NAUTIMAIL_MODULE_ID, $visibleModules, true)) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'NautiMail n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function nautimail_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function nautimail_clean_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): string
{
    $text = trim((string) $value);
    $text = str_replace("\0", '', $text);
    if ($singleLine) {
        $text = preg_replace('/\s+/u', ' ', $text) ?: '';
    }

    return mb_substr($text, 0, $maxLength);
}

function nautimail_nullable_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): ?string
{
    $text = nautimail_clean_text($value, $maxLength, $singleLine);
    return $text !== '' ? $text : null;
}

function nautimail_email(mixed $value, bool $required = false): ?string
{
    $email = mb_strtolower(nautimail_clean_text($value, 190, true));
    if ($email === '') {
        if ($required) {
            throw new InvalidArgumentException('Adresse email obligatoire.');
        }
        return null;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }

    return $email;
}

function nautimail_enum(mixed $value, array $allowed, string $fallback): string
{
    $candidate = strtolower(trim((string) $value));
    return in_array($candidate, $allowed, true) ? $candidate : $fallback;
}

function nautimail_port(mixed $value, int $fallback): int
{
    $port = (int) $value;
    if ($port <= 0 || $port > 65535) {
        return $fallback;
    }

    return $port;
}

function nautimail_host(mixed $value): string
{
    $host = nautimail_clean_text($value, 190, true);
    if ($host === '' || str_contains($host, '{') || str_contains($host, '}') || str_contains($host, '/')) {
        throw new InvalidArgumentException('Serveur mail invalide.');
    }

    return $host;
}

function nautimail_folder(mixed $value): string
{
    $folder = nautimail_clean_text($value, 120, true);
    if ($folder === '') {
        return 'INBOX';
    }
    if (str_contains($folder, '{') || str_contains($folder, '}') || str_contains($folder, "\r") || str_contains($folder, "\n")) {
        throw new InvalidArgumentException('Dossier IMAP invalide.');
    }

    return $folder;
}

function nautimail_public_user_option(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'displayName' => (string) $row['display_name'],
        'role' => (string) $row['role'],
    ];
}

function nautimail_user_options(PDO $pdo): array
{
    $rows = $pdo->query("SELECT id, email, display_name, role FROM oceanos_users WHERE is_active = 1 ORDER BY display_name ASC, email ASC")->fetchAll();
    return array_map('nautimail_public_user_option', $rows);
}

function nautimail_accessible_account_ids(PDO $pdo, array $user): array
{
    if (nautimail_is_admin($user)) {
        $rows = $pdo->query('SELECT id FROM nautimail_accounts ORDER BY email_address ASC, id ASC')->fetchAll();
        return array_map(static fn(array $row): int => (int) $row['id'], $rows);
    }

    $statement = $pdo->prepare(
        'SELECT DISTINCT a.id
         FROM nautimail_accounts a
         LEFT JOIN nautimail_account_users au ON au.account_id = a.id
         WHERE a.created_by_user_id = :user_id OR au.user_id = :user_id
         ORDER BY a.email_address ASC, a.id ASC'
    );
    $statement->execute(['user_id' => (int) $user['id']]);

    return array_map(static fn(array $row): int => (int) $row['id'], $statement->fetchAll());
}

function nautimail_account_by_id(PDO $pdo, int $accountId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM nautimail_accounts WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $accountId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function nautimail_account_shared_user_ids(PDO $pdo, int $accountId): array
{
    $statement = $pdo->prepare('SELECT user_id FROM nautimail_account_users WHERE account_id = :account_id ORDER BY user_id ASC');
    $statement->execute(['account_id' => $accountId]);
    return array_map(static fn(array $row): int => (int) $row['user_id'], $statement->fetchAll());
}

function nautimail_public_account(PDO $pdo, array $account): array
{
    return [
        'id' => (int) $account['id'],
        'label' => (string) $account['label'],
        'emailAddress' => (string) $account['email_address'],
        'displayName' => (string) ($account['display_name'] ?? ''),
        'imapHost' => (string) $account['imap_host'],
        'imapPort' => (int) $account['imap_port'],
        'imapEncryption' => (string) $account['imap_encryption'],
        'imapFolder' => (string) $account['imap_folder'],
        'smtpHost' => (string) ($account['smtp_host'] ?? ''),
        'smtpPort' => (int) $account['smtp_port'],
        'smtpEncryption' => (string) $account['smtp_encryption'],
        'username' => (string) $account['username'],
        'hasPassword' => trim((string) ($account['password_cipher'] ?? '')) !== '',
        'replyTo' => (string) ($account['reply_to'] ?? ''),
        'signature' => (string) ($account['signature'] ?? ''),
        'isActive' => (bool) $account['is_active'],
        'createdByUserId' => isset($account['created_by_user_id']) ? (int) $account['created_by_user_id'] : null,
        'lastSyncAt' => $account['last_sync_at'] ? (string) $account['last_sync_at'] : null,
        'sharedUserIds' => nautimail_account_shared_user_ids($pdo, (int) $account['id']),
        'createdAt' => (string) $account['created_at'],
        'updatedAt' => (string) $account['updated_at'],
    ];
}

function nautimail_can_manage_account(PDO $pdo, array $user, int $accountId): bool
{
    if (nautimail_is_admin($user)) {
        return true;
    }

    $account = nautimail_account_by_id($pdo, $accountId);
    if ($account !== null && (int) ($account['created_by_user_id'] ?? 0) === (int) $user['id']) {
        return true;
    }

    $statement = $pdo->prepare('SELECT can_manage FROM nautimail_account_users WHERE account_id = :account_id AND user_id = :user_id LIMIT 1');
    $statement->execute([
        'account_id' => $accountId,
        'user_id' => (int) $user['id'],
    ]);

    return (int) ($statement->fetchColumn() ?: 0) === 1;
}

function nautimail_can_reply_account(PDO $pdo, array $user, int $accountId): bool
{
    if (nautimail_can_manage_account($pdo, $user, $accountId)) {
        return true;
    }

    $statement = $pdo->prepare('SELECT can_reply FROM nautimail_account_users WHERE account_id = :account_id AND user_id = :user_id LIMIT 1');
    $statement->execute([
        'account_id' => $accountId,
        'user_id' => (int) $user['id'],
    ]);

    return (int) ($statement->fetchColumn() ?: 0) === 1;
}

function nautimail_require_account_access(PDO $pdo, array $user, int $accountId): array
{
    $account = nautimail_account_by_id($pdo, $accountId);
    if ($account === null) {
        throw new InvalidArgumentException('Adresse mail introuvable.');
    }

    if (!in_array($accountId, nautimail_accessible_account_ids($pdo, $user), true)) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Adresse mail non partagee avec ce compte.',
        ], 403);
    }

    return $account;
}

function nautimail_private_account(array $account): array
{
    $account['password'] = oceanos_decrypt_secret($account['password_cipher'] ?? '');
    return $account;
}

function nautimail_save_account(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    if ($id > 0 && !nautimail_can_manage_account($pdo, $user, $id)) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Modification reservee aux gestionnaires de cette adresse.',
        ], 403);
    }

    $email = nautimail_email($input['emailAddress'] ?? '', true);
    $label = nautimail_clean_text($input['label'] ?? '', 120, true);
    if ($label === '') {
        $label = (string) $email;
    }

    $passwordInput = array_key_exists('password', $input) ? trim((string) $input['password']) : '';
    $existing = $id > 0 ? nautimail_account_by_id($pdo, $id) : null;
    if ($id > 0 && $existing === null) {
        throw new InvalidArgumentException('Adresse mail introuvable.');
    }
    if ($id <= 0 && $passwordInput === '') {
        throw new InvalidArgumentException('Mot de passe IMAP/SMTP obligatoire pour une nouvelle adresse.');
    }

    $passwordCipher = $passwordInput !== ''
        ? oceanos_encrypt_secret($passwordInput)
        : ($existing['password_cipher'] ?? null);

    $params = [
        'label' => $label,
        'email_address' => $email,
        'display_name' => nautimail_nullable_text($input['displayName'] ?? '', 160, true),
        'imap_host' => nautimail_host($input['imapHost'] ?? ''),
        'imap_port' => nautimail_port($input['imapPort'] ?? 993, 993),
        'imap_encryption' => nautimail_enum($input['imapEncryption'] ?? 'ssl', ['ssl', 'tls', 'none'], 'ssl'),
        'imap_folder' => nautimail_folder($input['imapFolder'] ?? 'INBOX'),
        'smtp_host' => nautimail_nullable_text($input['smtpHost'] ?? '', 190, true),
        'smtp_port' => nautimail_port($input['smtpPort'] ?? 587, 587),
        'smtp_encryption' => nautimail_enum($input['smtpEncryption'] ?? 'tls', ['ssl', 'tls', 'none'], 'tls'),
        'username' => nautimail_clean_text($input['username'] ?? $email, 190, true),
        'password_cipher' => $passwordCipher,
        'reply_to' => nautimail_email($input['replyTo'] ?? '', false),
        'signature' => nautimail_nullable_text($input['signature'] ?? '', 5000, false),
        'is_active' => !empty($input['isActive']) ? 1 : 0,
        'updated_by_user_id' => (int) $user['id'],
    ];
    if ($params['username'] === '') {
        $params['username'] = (string) $email;
    }

    if ($id > 0) {
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE nautimail_accounts
             SET label = :label,
                 email_address = :email_address,
                 display_name = :display_name,
                 imap_host = :imap_host,
                 imap_port = :imap_port,
                 imap_encryption = :imap_encryption,
                 imap_folder = :imap_folder,
                 smtp_host = :smtp_host,
                 smtp_port = :smtp_port,
                 smtp_encryption = :smtp_encryption,
                 username = :username,
                 password_cipher = :password_cipher,
                 reply_to = :reply_to,
                 signature = :signature,
                 is_active = :is_active,
                 updated_by_user_id = :updated_by_user_id
             WHERE id = :id'
        );
        $statement->execute($params);
        $accountId = $id;
    } else {
        $params['created_by_user_id'] = (int) $user['id'];
        $statement = $pdo->prepare(
            'INSERT INTO nautimail_accounts
                (label, email_address, display_name, imap_host, imap_port, imap_encryption, imap_folder, smtp_host, smtp_port, smtp_encryption, username, password_cipher, reply_to, signature, is_active, created_by_user_id, updated_by_user_id)
             VALUES
                (:label, :email_address, :display_name, :imap_host, :imap_port, :imap_encryption, :imap_folder, :smtp_host, :smtp_port, :smtp_encryption, :username, :password_cipher, :reply_to, :signature, :is_active, :created_by_user_id, :updated_by_user_id)'
        );
        $statement->execute($params);
        $accountId = (int) $pdo->lastInsertId();
    }

    nautimail_save_account_shares($pdo, $accountId, $user, $input['sharedUserIds'] ?? []);
    $account = nautimail_account_by_id($pdo, $accountId);
    if ($account === null) {
        throw new RuntimeException('Impossible de relire l adresse mail.');
    }

    return nautimail_public_account($pdo, $account);
}

function nautimail_save_account_shares(PDO $pdo, int $accountId, array $user, mixed $sharedUserIds): void
{
    $account = nautimail_account_by_id($pdo, $accountId);
    $ownerId = (int) ($account['created_by_user_id'] ?? $user['id']);
    $selected = [];
    if (is_array($sharedUserIds)) {
        foreach ($sharedUserIds as $value) {
            $userId = (int) $value;
            if ($userId > 0) {
                $selected[$userId] = true;
            }
        }
    }
    $selected[$ownerId] = true;
    $selected[(int) $user['id']] = true;

    $pdo->beginTransaction();
    try {
        $delete = $pdo->prepare('DELETE FROM nautimail_account_users WHERE account_id = :account_id');
        $delete->execute(['account_id' => $accountId]);

        $insert = $pdo->prepare(
            'INSERT INTO nautimail_account_users (account_id, user_id, can_manage, can_reply)
             SELECT :account_id, id, :can_manage, 1
             FROM oceanos_users
             WHERE id = :user_id AND is_active = 1'
        );
        foreach (array_keys($selected) as $userId) {
            $canManage = ($userId === $ownerId || $userId === (int) $user['id']) ? 1 : 0;
            $insert->execute([
                'account_id' => $accountId,
                'user_id' => $userId,
                'can_manage' => $canManage,
            ]);
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function nautimail_sanitize_html_for_display(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    $styleBlocks = [];
    if (preg_match_all('~<style\b[^>]*>(.*?)</style>~is', $html, $styleMatches)) {
        foreach ($styleMatches[1] ?? [] as $style) {
            $style = preg_replace('~@import\b[^;]+;?~iu', '', (string) $style) ?: '';
            $style = preg_replace('~url\s*\(\s*([\'"]?)\s*javascript:[^)]+\1\s*\)~iu', 'none', $style) ?: $style;
            $style = preg_replace('~expression\s*\([^)]*\)~iu', '', $style) ?: $style;
            $style = trim($style);
            if ($style !== '') {
                $styleBlocks[] = '<style>' . $style . '</style>';
            }
        }
    }

    if (preg_match('~<body\b[^>]*>(.*?)</body>~is', $html, $matches)) {
        $html = (string) $matches[1];
    }

    $html = preg_replace('~<!doctype\b[^>]*>~i', '', $html) ?: $html;
    $html = preg_replace('~<(script|iframe|object|embed|form|meta|link|base)\b[^>]*>.*?</\1>~is', '', $html) ?: $html;
    $html = preg_replace('~<(script|iframe|object|embed|form|meta|link|base)\b[^>]*?/?>~is', '', $html) ?: $html;
    $html = preg_replace('/\s+on[a-z]+\s*=\s*"[^"]*"/iu', '', $html) ?: $html;
    $html = preg_replace("/\s+on[a-z]+\s*=\s*'[^']*'/iu", '', $html) ?: $html;
    $html = preg_replace('/\s+on[a-z]+\s*=\s*[^\s>]+/iu', '', $html) ?: $html;
    $html = preg_replace('/\s+(href|src)\s*=\s*(["\'])\s*javascript:[^"\']*\2/iu', '', $html) ?: $html;
    $html = preg_replace('/\s+(href|src)\s*=\s*javascript:[^\s>]+/iu', '', $html) ?: $html;
    $html = preg_replace('/\s+srcdoc\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/iu', '', $html) ?: $html;
    $html = preg_replace('~url\s*\(\s*([\'"]?)\s*javascript:[^)]+\1\s*\)~iu', 'none', $html) ?: $html;
    $html = preg_replace('~expression\s*\([^)]*\)~iu', '', $html) ?: $html;

    return trim(implode("\n", $styleBlocks) . "\n" . trim($html));
}

function nautimail_normalize_content_id(string $value): string
{
    $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = trim(rawurldecode(nautimail_decode_mime_text($value)));
    $value = preg_replace('/^cid:/i', '', $value) ?: $value;
    $value = trim($value, " <>{}\t\r\n\"'");

    return mb_strtolower($value);
}

function nautimail_content_id_candidates(string $value): array
{
    $normalized = nautimail_normalize_content_id($value);
    if ($normalized === '') {
        return [];
    }

    $withoutQuery = preg_replace('/[?#].*$/', '', $normalized) ?: $normalized;
    $basename = basename(str_replace('\\', '/', $withoutQuery));
    $beforeAt = preg_replace('/@.*$/', '', $withoutQuery) ?: $withoutQuery;
    $basenameBeforeAt = basename(str_replace('\\', '/', $beforeAt));

    return array_values(array_unique(array_filter([
        $normalized,
        $withoutQuery,
        $basename,
        $beforeAt,
        $basenameBeforeAt,
    ], static fn(string $candidate): bool => $candidate !== '')));
}

function nautimail_attachment_url(int $messageId, int $index, bool $inline = false): string
{
    $url = 'api/messages.php?action=attachment&id=' . rawurlencode((string) $messageId) . '&index=' . rawurlencode((string) $index);
    return $inline ? $url . '&inline=1' : $url;
}

function nautimail_inline_cid_url(int $messageId, string $contentId): string
{
    return 'api/messages.php?action=inline&id=' . rawurlencode((string) $messageId) . '&cid=' . rawurlencode(nautimail_normalize_content_id($contentId));
}

function nautimail_remote_image_url(string $url): string
{
    return 'api/messages.php?action=remote_image&url=' . rawurlencode($url);
}

function nautimail_rewrite_inline_sources(string $html, int $messageId, array $attachments): string
{
    if ($html === '' || stripos($html, 'cid:') === false) {
        return $html;
    }

    $quoted = static function (array $matches) use ($messageId): string {
        $contentId = nautimail_normalize_content_id((string) ($matches[3] ?? ''));
        if ($contentId === '') {
            return $matches[0];
        }

        return ' ' . $matches[1] . '=' . $matches[2] . nautimail_inline_cid_url($messageId, $contentId) . $matches[2];
    };

    $html = preg_replace_callback('/\s(src|background)\s*=\s*(["\'])cid:([^"\']+)\2/iu', $quoted, $html) ?: $html;
    $html = preg_replace_callback(
        '/\s(src|background)\s*=\s*cid:([^\s>]+)/iu',
        static function (array $matches) use ($messageId): string {
            $contentId = nautimail_normalize_content_id((string) ($matches[2] ?? ''));
            if ($contentId === '') {
                return $matches[0];
            }

            return ' ' . $matches[1] . '="' . nautimail_inline_cid_url($messageId, $contentId) . '"';
        },
        $html
    ) ?: $html;
    $html = preg_replace_callback(
        '/url\(\s*(["\']?)cid:([^)"\']+)\1\s*\)/iu',
        static function (array $matches) use ($messageId): string {
            $contentId = nautimail_normalize_content_id((string) ($matches[2] ?? ''));
            if ($contentId === '') {
                return $matches[0];
            }

            return 'url("' . nautimail_inline_cid_url($messageId, $contentId) . '")';
        },
        $html
    ) ?: $html;

    return $html;
}

function nautimail_rewrite_remote_image_sources(string $html): string
{
    if ($html === '' || !preg_match('~https?://~i', $html)) {
        return $html;
    }

    $html = preg_replace_callback(
        '/\s(src|background)\s*=\s*(["\'])(https?:\/\/[^"\']+)\2/iu',
        static function (array $matches): string {
            return ' ' . $matches[1] . '=' . $matches[2] . nautimail_remote_image_url(html_entity_decode((string) $matches[3], ENT_QUOTES | ENT_HTML5, 'UTF-8')) . $matches[2];
        },
        $html
    ) ?: $html;

    $html = preg_replace_callback(
        '/url\(\s*(["\']?)(https?:\/\/[^)"\']+)\1\s*\)/iu',
        static function (array $matches): string {
            return 'url("' . nautimail_remote_image_url(html_entity_decode((string) $matches[2], ENT_QUOTES | ENT_HTML5, 'UTF-8')) . '")';
        },
        $html
    ) ?: $html;

    return $html;
}

function nautimail_stored_attachments(mixed $value): array
{
    $decoded = is_array($value) ? $value : json_decode((string) $value, true);
    if (!is_array($decoded)) {
        return [];
    }

    $attachments = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) {
            continue;
        }
        $filename = nautimail_clean_text($item['filename'] ?? '', 255, true);
        if ($filename === '') {
            $filename = 'piece-jointe';
        }
        $attachments[] = [
            'part' => nautimail_clean_text($item['part'] ?? '', 40, true),
            'filename' => $filename,
            'contentType' => nautimail_clean_text($item['contentType'] ?? 'application/octet-stream', 120, true),
            'size' => max(0, (int) ($item['size'] ?? 0)),
            'encoding' => max(0, (int) ($item['encoding'] ?? 0)),
            'disposition' => nautimail_clean_text($item['disposition'] ?? 'attachment', 40, true),
            'contentId' => nautimail_normalize_content_id((string) ($item['contentId'] ?? '')),
            'contentLocation' => nautimail_normalize_content_id((string) ($item['contentLocation'] ?? '')),
            'xAttachmentId' => nautimail_normalize_content_id((string) ($item['xAttachmentId'] ?? '')),
            'isInline' => !empty($item['isInline']) || strtolower((string) ($item['disposition'] ?? '')) === 'inline',
        ];
    }

    return array_slice($attachments, 0, 50);
}

function nautimail_public_attachments(mixed $value, int $messageId): array
{
    $attachments = [];
    foreach (nautimail_stored_attachments($value) as $index => $item) {
        $attachments[] = [
            'index' => $index,
            'filename' => $item['filename'],
            'contentType' => $item['contentType'],
            'size' => $item['size'],
            'disposition' => $item['disposition'],
            'isInline' => (bool) $item['isInline'],
            'url' => nautimail_attachment_url($messageId, $index, false),
            'inlineUrl' => nautimail_attachment_url($messageId, $index, true),
        ];
    }

    return $attachments;
}

function nautimail_attachment_lookup_keys(array $attachment): array
{
    $keys = [];
    foreach (['contentId', 'contentLocation', 'xAttachmentId', 'filename'] as $field) {
        foreach (nautimail_content_id_candidates((string) ($attachment[$field] ?? '')) as $candidate) {
            $keys[$candidate] = true;
        }
    }

    return array_keys($keys);
}

function nautimail_find_attachment_index_by_cid(array $attachments, string $contentId): ?int
{
    $wanted = [];
    foreach (nautimail_content_id_candidates($contentId) as $candidate) {
        $wanted[$candidate] = true;
    }
    if ($wanted === []) {
        return null;
    }

    foreach ($attachments as $index => $attachment) {
        if (!is_array($attachment)) {
            continue;
        }
        foreach (nautimail_attachment_lookup_keys($attachment) as $key) {
            if (isset($wanted[$key])) {
                return (int) $index;
            }
        }
    }

    return null;
}

function nautimail_attachment_content_type(string $filename, string $contentType): string
{
    $contentType = nautimail_clean_text($contentType, 120, true);
    $generic = $contentType === '' || in_array(strtolower($contentType), ['application/octet-stream', 'application/binary'], true);
    if (!$generic && preg_match('~^[a-z0-9.+-]+/[a-z0-9.+-]+$~i', $contentType)) {
        return $contentType;
    }

    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return match ($extension) {
        'jpg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'bmp' => 'image/bmp',
        'pdf' => 'application/pdf',
        default => 'application/octet-stream',
    };
}

function nautimail_public_remote_host(string $host): bool
{
    $host = trim(mb_strtolower($host), " \t\r\n.");
    if ($host === '' || in_array($host, ['localhost', 'localhost.localdomain'], true)) {
        return false;
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return (bool) filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }

    $ips = @gethostbynamel($host);
    if (!is_array($ips) || $ips === []) {
        return false;
    }

    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
    }

    return true;
}

function nautimail_validate_remote_image_url(string $url): string
{
    $url = trim(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($url === '' || strlen($url) > 2000) {
        throw new InvalidArgumentException('Image distante invalide.');
    }

    $parts = parse_url($url);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    if (!in_array($scheme, ['http', 'https'], true) || !nautimail_public_remote_host($host)) {
        throw new InvalidArgumentException('Image distante non autorisee.');
    }

    return $url;
}

function nautimail_resolve_remote_url(string $baseUrl, string $location): string
{
    $location = trim($location);
    if (preg_match('~^https?://~i', $location)) {
        return $location;
    }

    $base = parse_url($baseUrl);
    if (!is_array($base) || empty($base['scheme']) || empty($base['host'])) {
        return $location;
    }

    if (str_starts_with($location, '//')) {
        return (string) $base['scheme'] . ':' . $location;
    }
    if (str_starts_with($location, '/')) {
        return (string) $base['scheme'] . '://' . (string) $base['host'] . $location;
    }

    $path = (string) ($base['path'] ?? '/');
    $dir = preg_replace('~/[^/]*$~', '/', $path) ?: '/';
    return (string) $base['scheme'] . '://' . (string) $base['host'] . $dir . $location;
}

function nautimail_fetch_remote_image(string $url, int $redirects = 0): array
{
    $url = nautimail_validate_remote_image_url($url);
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Extension PHP cURL inactive.');
    }

    $curl = curl_init($url);
    if ($curl === false) {
        throw new RuntimeException('Image distante inaccessible.');
    }

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_USERAGENT => 'OceanOS NautiMail image proxy',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ]);
    $response = curl_exec($curl);
    if (!is_string($response)) {
        $error = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException($error !== '' ? $error : 'Image distante inaccessible.');
    }

    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    curl_close($curl);

    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    if ($status >= 300 && $status < 400 && $redirects < 3 && preg_match('/^Location:\s*(.+)$/im', $headers, $matches)) {
        return nautimail_fetch_remote_image(nautimail_resolve_remote_url($url, trim((string) $matches[1])), $redirects + 1);
    }

    if ($status < 200 || $status >= 300 || strlen($body) > 6 * 1024 * 1024) {
        throw new RuntimeException('Image distante non disponible.');
    }

    $contentType = strtolower(trim(explode(';', $contentType)[0] ?? ''));
    if (!str_starts_with($contentType, 'image/')) {
        $contentType = nautimail_attachment_content_type(parse_url($url, PHP_URL_PATH) ?: 'image', $contentType);
    }
    if (!str_starts_with($contentType, 'image/')) {
        throw new RuntimeException('Ressource distante non image.');
    }

    return ['contentType' => $contentType, 'body' => $body];
}

function nautimail_proxy_remote_image(string $url): void
{
    $image = nautimail_fetch_remote_image($url);
    oceanos_send_security_headers();
    header('Content-Type: ' . $image['contentType']);
    header('Content-Length: ' . strlen((string) $image['body']));
    header('Cache-Control: private, max-age=3600');
    echo (string) $image['body'];
    exit;
}

function nautimail_public_message(array $row): array
{
    $messageId = (int) $row['id'];
    $storedAttachments = nautimail_stored_attachments($row['attachments_json'] ?? null);
    $bodyHtml = nautimail_sanitize_html_for_display((string) ($row['body_html'] ?? ''));
    $bodyHtml = nautimail_rewrite_inline_sources($bodyHtml, $messageId, $storedAttachments);
    $bodyHtml = nautimail_rewrite_remote_image_sources($bodyHtml);

    return [
        'id' => $messageId,
        'accountId' => (int) $row['account_id'],
        'accountLabel' => (string) ($row['account_label'] ?? ''),
        'accountEmail' => (string) ($row['account_email'] ?? ''),
        'mailbox' => (string) $row['mailbox'],
        'imapUid' => (int) $row['imap_uid'],
        'messageId' => (string) ($row['message_id'] ?? ''),
        'subject' => (string) ($row['subject'] ?? ''),
        'senderName' => (string) ($row['sender_name'] ?? ''),
        'senderEmail' => (string) ($row['sender_email'] ?? ''),
        'recipientText' => (string) ($row['recipient_text'] ?? ''),
        'ccText' => (string) ($row['cc_text'] ?? ''),
        'bccText' => (string) ($row['bcc_text'] ?? ''),
        'receivedAt' => $row['received_at'] ? (string) $row['received_at'] : null,
        'preview' => (string) ($row['preview'] ?? ''),
        'bodyText' => (string) ($row['body_text'] ?? ''),
        'bodyHtml' => $bodyHtml,
        'attachments' => nautimail_public_attachments($storedAttachments, $messageId),
        'category' => (string) $row['category'],
        'priority' => (string) $row['priority'],
        'status' => (string) $row['status'],
        'aiSummary' => (string) ($row['ai_summary'] ?? ''),
        'aiActions' => (string) ($row['ai_actions'] ?? ''),
        'assignedUserId' => isset($row['assigned_user_id']) ? (int) $row['assigned_user_id'] : null,
        'assignedUserDisplayName' => (string) ($row['assigned_user_display_name'] ?? ''),
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function nautimail_dashboard(PDO $pdo, array $query, array $user): array
{
    $accountIds = nautimail_accessible_account_ids($pdo, $user);
    $accounts = [];
    if ($accountIds !== []) {
        $placeholders = implode(',', array_fill(0, count($accountIds), '?'));
        $statement = $pdo->prepare("SELECT * FROM nautimail_accounts WHERE id IN ({$placeholders}) ORDER BY email_address ASC, id ASC");
        $statement->execute($accountIds);
        $accounts = array_map(static fn(array $row): array => nautimail_public_account($pdo, $row), $statement->fetchAll());
    }

    $selectedAccountId = (int) ($query['accountId'] ?? 0);
    if ($selectedAccountId <= 0 || !in_array($selectedAccountId, $accountIds, true)) {
        $selectedAccountId = $accountIds[0] ?? 0;
    }

    $messages = [];
    $stats = [
        'accountCount' => count($accounts),
        'messageCount' => 0,
        'newCount' => 0,
        'urgentCount' => 0,
        'aiCount' => 0,
        'repliedCount' => 0,
    ];

    if ($accountIds !== []) {
        $messageWhere = ['m.account_id IN (' . implode(',', array_fill(0, count($accountIds), '?')) . ')'];
        $messageParams = $accountIds;

        if ($selectedAccountId > 0) {
            $messageWhere[] = 'm.account_id = ?';
            $messageParams[] = $selectedAccountId;
        }

        $search = nautimail_clean_text($query['search'] ?? '', 120, true);
        if ($search !== '') {
            $messageWhere[] = '(m.subject LIKE ? OR m.sender_email LIKE ? OR m.sender_name LIKE ? OR m.preview LIKE ?)';
            $like = '%' . $search . '%';
            array_push($messageParams, $like, $like, $like, $like);
        }

        $category = nautimail_enum($query['category'] ?? '', ['client', 'vente', 'gestion', 'support', 'finance', 'spam', 'autre'], '');
        if ($category !== '') {
            $messageWhere[] = 'm.category = ?';
            $messageParams[] = $category;
        }

        $status = nautimail_enum($query['status'] ?? '', ['new', 'triaged', 'read', 'replied', 'archived'], '');
        if ($status !== '') {
            $messageWhere[] = 'm.status = ?';
            $messageParams[] = $status;
        } else {
            $messageWhere[] = "m.status <> 'archived'";
        }

        $sql = 'SELECT m.*, a.label AS account_label, a.email_address AS account_email, u.display_name AS assigned_user_display_name
                FROM nautimail_messages m
                INNER JOIN nautimail_accounts a ON a.id = m.account_id
                LEFT JOIN oceanos_users u ON u.id = m.assigned_user_id
                WHERE ' . implode(' AND ', $messageWhere) . '
                ORDER BY COALESCE(m.received_at, m.created_at) DESC, m.id DESC
                LIMIT 140';
        $statement = $pdo->prepare($sql);
        $statement->execute($messageParams);
        $messages = array_map('nautimail_public_message', $statement->fetchAll());

        $statsWhere = 'account_id IN (' . implode(',', array_fill(0, count($accountIds), '?')) . ')';
        $statsStatement = $pdo->prepare(
            "SELECT
                COUNT(*) AS message_count,
                SUM(status = 'new') AS new_count,
                SUM(priority = 'urgent') AS urgent_count,
                SUM(ai_summary IS NOT NULL AND ai_summary <> '') AS ai_count,
                SUM(status = 'replied') AS replied_count
             FROM nautimail_messages
             WHERE {$statsWhere}"
        );
        $statsStatement->execute($accountIds);
        $row = $statsStatement->fetch();
        if (is_array($row)) {
            $stats = [
                'accountCount' => count($accounts),
                'messageCount' => (int) $row['message_count'],
                'newCount' => (int) $row['new_count'],
                'urgentCount' => (int) $row['urgent_count'],
                'aiCount' => (int) $row['ai_count'],
                'repliedCount' => (int) $row['replied_count'],
            ];
        }
    }

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'users' => nautimail_user_options($pdo),
        'accounts' => $accounts,
        'selectedAccountId' => $selectedAccountId,
        'messages' => $messages,
        'stats' => $stats,
        'imapAvailable' => function_exists('imap_open'),
        'aiSettings' => oceanos_ai_public_settings($pdo, (int) $user['id']),
    ];
}

function nautimail_message_by_id(PDO $pdo, int $messageId): ?array
{
    $statement = $pdo->prepare(
        'SELECT m.*, a.label AS account_label, a.email_address AS account_email, u.display_name AS assigned_user_display_name
         FROM nautimail_messages m
         INNER JOIN nautimail_accounts a ON a.id = m.account_id
         LEFT JOIN oceanos_users u ON u.id = m.assigned_user_id
         WHERE m.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $messageId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function nautimail_require_message_access(PDO $pdo, array $user, int $messageId): array
{
    $message = nautimail_message_by_id($pdo, $messageId);
    if ($message === null) {
        throw new InvalidArgumentException('Mail introuvable.');
    }
    nautimail_require_account_access($pdo, $user, (int) $message['account_id']);

    return $message;
}

function nautimail_html_cid_values(string $html): array
{
    if ($html === '' || stripos($html, 'cid:') === false) {
        return [];
    }

    preg_match_all('/cid:([^"\'\s>]+)/iu', $html, $matches);
    $values = [];
    foreach ($matches[1] ?? [] as $value) {
        $contentId = nautimail_normalize_content_id((string) $value);
        if ($contentId !== '') {
            $values[$contentId] = true;
        }
    }

    return array_keys($values);
}

function nautimail_message_missing_inline_sources(array $message): bool
{
    $contentIds = nautimail_html_cid_values((string) ($message['body_html'] ?? ''));
    if ($contentIds === []) {
        return false;
    }

    $attachments = nautimail_stored_attachments($message['attachments_json'] ?? null);

    foreach ($contentIds as $contentId) {
        if (nautimail_find_attachment_index_by_cid($attachments, $contentId) === null) {
            return true;
        }
    }

    return false;
}

function nautimail_refresh_message_parts(PDO $pdo, array $user, array $message): array
{
    if (!function_exists('imap_open')) {
        return $message;
    }

    $account = nautimail_private_account(nautimail_require_account_access($pdo, $user, (int) $message['account_id']));
    $imap = @imap_open(nautimail_imap_mailbox($account), (string) $account['username'], (string) ($account['password'] ?? ''));
    if (!$imap) {
        return $message;
    }

    try {
        $body = nautimail_fetch_message_body($imap, (int) $message['imap_uid']);
    } finally {
        @imap_close($imap);
    }

    $attachmentsJson = json_encode(
        nautimail_stored_attachments($body['attachments'] ?? []),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    $statement = $pdo->prepare(
        'UPDATE nautimail_messages
         SET preview = :preview,
             body_text = :body_text,
             body_html = :body_html,
             attachments_json = :attachments_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => (int) $message['id'],
        'preview' => nautimail_message_preview((string) ($body['text'] ?? '')),
        'body_text' => nautimail_nullable_text($body['text'] ?? '', 120000, false),
        'body_html' => nautimail_nullable_text($body['html'] ?? '', 120000, false),
        'attachments_json' => $attachmentsJson !== false && $attachmentsJson !== '[]' ? $attachmentsJson : null,
    ]);

    return nautimail_message_by_id($pdo, (int) $message['id']) ?: $message;
}

function nautimail_output_attachment_content(PDO $pdo, array $user, array $message, array $attachment, bool $inline): void
{
    $account = nautimail_private_account(nautimail_require_account_access($pdo, $user, (int) $message['account_id']));
    $imap = @imap_open(nautimail_imap_mailbox($account), (string) $account['username'], (string) ($account['password'] ?? ''));
    if (!$imap) {
        throw new RuntimeException('Connexion IMAP impossible: ' . imap_last_error());
    }

    try {
        $part = (string) ($attachment['part'] ?? '');
        $raw = $part === ''
            ? (string) @imap_body($imap, (int) $message['imap_uid'], FT_UID | FT_PEEK)
            : (string) @imap_fetchbody($imap, (int) $message['imap_uid'], $part, FT_UID | FT_PEEK);
        $content = nautimail_decode_part_body($raw, (int) ($attachment['encoding'] ?? 0));
    } finally {
        @imap_close($imap);
    }

    $filename = nautimail_clean_text($attachment['filename'] ?? 'piece-jointe', 255, true);
    if ($filename === '') {
        $filename = 'piece-jointe';
    }
    $contentType = nautimail_attachment_content_type($filename, (string) ($attachment['contentType'] ?? 'application/octet-stream'));
    if (!preg_match('~^[a-z0-9.+-]+/[a-z0-9.+-]+$~i', $contentType)) {
        $contentType = 'application/octet-stream';
    }

    oceanos_send_security_headers();
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . addcslashes($filename, "\\\"") . '"; filename*=UTF-8\'\'' . rawurlencode($filename));
    header('Content-Length: ' . strlen($content));
    header('Cache-Control: private, max-age=3600');
    echo $content;
    exit;
}

function nautimail_download_attachment(PDO $pdo, array $user, int $messageId, int $index, bool $inline = false): void
{
    if (!function_exists('imap_open')) {
        throw new RuntimeException('Extension PHP IMAP inactive.');
    }

    $message = nautimail_require_message_access($pdo, $user, $messageId);
    $attachments = nautimail_stored_attachments($message['attachments_json'] ?? null);
    if (!isset($attachments[$index])) {
        $message = nautimail_refresh_message_parts($pdo, $user, $message);
        $attachments = nautimail_stored_attachments($message['attachments_json'] ?? null);
    }
    if (!isset($attachments[$index])) {
        throw new InvalidArgumentException('Piece jointe introuvable.');
    }

    nautimail_output_attachment_content($pdo, $user, $message, $attachments[$index], $inline);
}

function nautimail_download_inline_content_id(PDO $pdo, array $user, int $messageId, string $contentId): void
{
    if (!function_exists('imap_open')) {
        throw new RuntimeException('Extension PHP IMAP inactive.');
    }

    $message = nautimail_require_message_access($pdo, $user, $messageId);
    $attachments = nautimail_stored_attachments($message['attachments_json'] ?? null);
    $index = nautimail_find_attachment_index_by_cid($attachments, $contentId);
    if ($index === null) {
        $message = nautimail_refresh_message_parts($pdo, $user, $message);
        $attachments = nautimail_stored_attachments($message['attachments_json'] ?? null);
        $index = nautimail_find_attachment_index_by_cid($attachments, $contentId);
    }
    if ($index === null || !isset($attachments[$index])) {
        $account = nautimail_private_account(nautimail_require_account_access($pdo, $user, (int) $message['account_id']));
        $imap = @imap_open(nautimail_imap_mailbox($account), (string) $account['username'], (string) ($account['password'] ?? ''));
        if ($imap) {
            try {
                $structure = @imap_fetchstructure($imap, (int) $message['imap_uid'], FT_UID);
                $attachment = nautimail_find_mime_part_by_cid($structure, $contentId);
            } finally {
                @imap_close($imap);
            }
            if (isset($attachment) && is_array($attachment)) {
                nautimail_output_attachment_content($pdo, $user, $message, $attachment, true);
            }
        }

        throw new InvalidArgumentException('Image integree introuvable.');
    }

    nautimail_output_attachment_content($pdo, $user, $message, $attachments[$index], true);
}

function nautimail_imap_mailbox(array $account): string
{
    $flags = '/imap';
    $encryption = (string) ($account['imap_encryption'] ?? 'ssl');
    if ($encryption === 'ssl') {
        $flags .= '/ssl/novalidate-cert';
    } elseif ($encryption === 'tls') {
        $flags .= '/tls/novalidate-cert';
    } else {
        $flags .= '/notls';
    }

    return sprintf(
        '{%s:%d%s}%s',
        (string) $account['imap_host'],
        (int) $account['imap_port'],
        $flags,
        nautimail_folder($account['imap_folder'] ?? 'INBOX')
    );
}

function nautimail_decode_mime_text(?string $value): string
{
    $value = (string) $value;
    if ($value === '') {
        return '';
    }
    if (!function_exists('imap_mime_header_decode')) {
        return $value;
    }

    $parts = @imap_mime_header_decode($value);
    if (!is_array($parts)) {
        return $value;
    }

    $decoded = '';
    foreach ($parts as $part) {
        $text = (string) ($part->text ?? '');
        $charset = strtoupper((string) ($part->charset ?? 'UTF-8'));
        if ($charset !== 'DEFAULT' && $charset !== 'UTF-8' && function_exists('mb_convert_encoding')) {
            $converted = @mb_convert_encoding($text, 'UTF-8', $charset);
            if (is_string($converted)) {
                $text = $converted;
            }
        }
        $decoded .= $text;
    }

    return trim($decoded);
}

function nautimail_address_from_header_object(mixed $address): array
{
    if (!is_object($address)) {
        return ['', ''];
    }

    $mailbox = (string) ($address->mailbox ?? '');
    $host = (string) ($address->host ?? '');
    $email = $mailbox !== '' && $host !== '' ? mb_strtolower($mailbox . '@' . $host) : '';
    $name = nautimail_decode_mime_text((string) ($address->personal ?? ''));

    return [$name, filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : ''];
}

function nautimail_decode_part_body(string $body, int $encoding): string
{
    if ($encoding === 3) {
        $decoded = base64_decode($body, true);
        if ($decoded === false) {
            $decoded = base64_decode(preg_replace('/\s+/', '', $body) ?: $body, true);
        }
        return $decoded !== false ? $decoded : '';
    }
    if ($encoding === 4) {
        return quoted_printable_decode($body);
    }

    return $body;
}

function nautimail_convert_charset(string $body, mixed $parameters): string
{
    $charset = '';
    if (is_array($parameters)) {
        foreach ($parameters as $parameter) {
            if (is_object($parameter) && strtolower((string) ($parameter->attribute ?? '')) === 'charset') {
                $charset = (string) ($parameter->value ?? '');
                break;
            }
        }
    }

    if ($charset !== '' && strtoupper($charset) !== 'UTF-8' && function_exists('mb_convert_encoding')) {
        $converted = @mb_convert_encoding($body, 'UTF-8', $charset);
        if (is_string($converted)) {
            return $converted;
        }
    }

    return $body;
}

function nautimail_part_parameter(mixed $parameters, string $attribute): string
{
    if (!is_array($parameters)) {
        return '';
    }

    foreach ($parameters as $parameter) {
        if (!is_object($parameter)) {
            continue;
        }
        if (strtolower((string) ($parameter->attribute ?? '')) === strtolower($attribute)) {
            return nautimail_decode_mime_text((string) ($parameter->value ?? ''));
        }
    }

    return '';
}

function nautimail_part_parameter_first(mixed $parameters, array $attributes): string
{
    foreach ($attributes as $attribute) {
        $value = nautimail_part_parameter($parameters, (string) $attribute);
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function nautimail_part_filename(mixed $structure): string
{
    if (!is_object($structure)) {
        return '';
    }

    $filename = nautimail_part_parameter($structure->dparameters ?? [], 'filename');
    if ($filename === '') {
        $filename = nautimail_part_parameter($structure->parameters ?? [], 'name');
    }

    return nautimail_clean_text($filename, 255, true);
}

function nautimail_part_content_id(mixed $structure): string
{
    if (!is_object($structure)) {
        return '';
    }

    $contentId = (string) ($structure->id ?? '');
    if ($contentId === '') {
        $contentId = nautimail_part_parameter($structure->parameters ?? [], 'content-id');
    }
    if ($contentId === '') {
        $contentId = nautimail_part_parameter($structure->dparameters ?? [], 'content-id');
    }

    return nautimail_normalize_content_id($contentId);
}

function nautimail_part_content_location(mixed $structure): string
{
    if (!is_object($structure)) {
        return '';
    }

    $location = (string) ($structure->location ?? '');
    if ($location === '') {
        $location = nautimail_part_parameter_first($structure->parameters ?? [], ['content-location', 'location']);
    }
    if ($location === '') {
        $location = nautimail_part_parameter_first($structure->dparameters ?? [], ['content-location', 'location']);
    }

    return nautimail_normalize_content_id($location);
}

function nautimail_part_x_attachment_id(mixed $structure): string
{
    if (!is_object($structure)) {
        return '';
    }

    $value = nautimail_part_parameter_first($structure->parameters ?? [], ['x-attachment-id', 'xattachmentid']);
    if ($value === '') {
        $value = nautimail_part_parameter_first($structure->dparameters ?? [], ['x-attachment-id', 'xattachmentid']);
    }

    return nautimail_normalize_content_id($value);
}

function nautimail_part_content_type(mixed $structure): string
{
    if (!is_object($structure)) {
        return 'application/octet-stream';
    }

    $types = [
        0 => 'text',
        1 => 'multipart',
        2 => 'message',
        3 => 'application',
        4 => 'audio',
        5 => 'image',
        6 => 'video',
        7 => 'application',
    ];
    $type = $types[(int) ($structure->type ?? 7)] ?? 'application';
    $subtype = strtolower((string) ($structure->subtype ?? 'octet-stream'));
    $subtype = preg_replace('/[^a-z0-9.+-]/i', '', $subtype) ?: 'octet-stream';

    return $type . '/' . $subtype;
}

function nautimail_part_attachment_payload(mixed $structure, string $partNumber): array
{
    $filename = nautimail_part_filename($structure);
    $contentId = nautimail_part_content_id($structure);
    $contentLocation = nautimail_part_content_location($structure);
    $xAttachmentId = nautimail_part_x_attachment_id($structure);
    $disposition = strtolower((string) ($structure->disposition ?? ''));
    $contentType = nautimail_part_content_type($structure);
    $isInline = $disposition === 'inline' || (($contentId !== '' || $contentLocation !== '' || $xAttachmentId !== '') && str_starts_with($contentType, 'image/'));

    return [
        'part' => $partNumber,
        'filename' => $filename !== '' ? $filename : 'piece-jointe-' . ($partNumber !== '' ? str_replace('.', '-', $partNumber) : 'mail'),
        'contentType' => $contentType,
        'size' => max(0, (int) ($structure->bytes ?? 0)),
        'encoding' => max(0, (int) ($structure->encoding ?? 0)),
        'disposition' => $disposition !== '' ? $disposition : ($isInline ? 'inline' : 'attachment'),
        'contentId' => $contentId,
        'contentLocation' => $contentLocation,
        'xAttachmentId' => $xAttachmentId,
        'isInline' => $isInline,
    ];
}

function nautimail_find_mime_part_by_cid(mixed $structure, string $contentId, string $partNumber = ''): ?array
{
    if (!is_object($structure)) {
        return null;
    }

    $payload = nautimail_part_attachment_payload($structure, $partNumber);
    foreach (nautimail_attachment_lookup_keys($payload) as $key) {
        foreach (nautimail_content_id_candidates($contentId) as $candidate) {
            if ($key === $candidate) {
                return $payload;
            }
        }
    }

    if (isset($structure->parts) && is_array($structure->parts)) {
        foreach ($structure->parts as $index => $part) {
            $childPartNumber = $partNumber === '' ? (string) ($index + 1) : $partNumber . '.' . ($index + 1);
            $found = nautimail_find_mime_part_by_cid($part, $contentId, $childPartNumber);
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}

function nautimail_collect_body_parts($imap, int $uid, mixed $structure, string $partNumber = ''): array
{
    $plain = [];
    $html = [];
    $attachments = [];

    if (!is_object($structure)) {
        return ['plain' => '', 'html' => '', 'attachments' => []];
    }

    if (isset($structure->parts) && is_array($structure->parts)) {
        foreach ($structure->parts as $index => $part) {
            $childPartNumber = $partNumber === '' ? (string) ($index + 1) : $partNumber . '.' . ($index + 1);
            $child = nautimail_collect_body_parts($imap, $uid, $part, $childPartNumber);
            if ($child['plain'] !== '') {
                $plain[] = $child['plain'];
            }
            if ($child['html'] !== '') {
                $html[] = $child['html'];
            }
            foreach ($child['attachments'] as $attachment) {
                $attachments[] = $attachment;
            }
        }
    }

    $type = (int) ($structure->type ?? -1);
    $subtype = strtoupper((string) ($structure->subtype ?? ''));
    $filename = nautimail_part_filename($structure);
    $contentId = nautimail_part_content_id($structure);
    $contentLocation = nautimail_part_content_location($structure);
    $xAttachmentId = nautimail_part_x_attachment_id($structure);
    $disposition = strtolower((string) ($structure->disposition ?? ''));
    $isBodyTextPart = $type === 0 && in_array($subtype, ['PLAIN', 'HTML'], true) && $filename === '';
    $isAttachment = !$isBodyTextPart && (
        $filename !== ''
        || in_array($disposition, ['attachment', 'inline'], true)
        || (($contentId !== '' || $contentLocation !== '' || $xAttachmentId !== '') && in_array($type, [3, 4, 5, 6, 7], true))
    );

    if ($isAttachment) {
        $attachments[] = nautimail_part_attachment_payload($structure, $partNumber);
    }

    if ($isBodyTextPart) {
        $raw = $partNumber === ''
            ? (string) @imap_body($imap, $uid, FT_UID | FT_PEEK)
            : (string) @imap_fetchbody($imap, $uid, $partNumber, FT_UID | FT_PEEK);
        $decoded = nautimail_decode_part_body($raw, (int) ($structure->encoding ?? 0));
        $decoded = nautimail_convert_charset($decoded, $structure->parameters ?? []);
        if ($subtype === 'PLAIN') {
            $plain[] = $decoded;
        } else {
            $html[] = $decoded;
        }
    }

    return [
        'plain' => trim(implode("\n\n", array_filter($plain))),
        'html' => trim(implode("\n\n", array_filter($html))),
        'attachments' => array_slice($attachments, 0, 50),
    ];
}

function nautimail_html_to_text(string $html): string
{
    $html = preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is', ' ', $html) ?: $html;
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/[ \t]+/u', ' ', $text) ?: $text;
    $text = preg_replace('/\n{3,}/u', "\n\n", $text) ?: $text;

    return trim($text);
}

function nautimail_fetch_message_body($imap, int $uid): array
{
    $structure = @imap_fetchstructure($imap, $uid, FT_UID);
    $parts = nautimail_collect_body_parts($imap, $uid, $structure);
    $plain = trim((string) $parts['plain']);
    $html = trim((string) $parts['html']);

    if ($plain === '' && $html !== '') {
        $plain = nautimail_html_to_text($html);
    }

    return [
        'text' => $plain,
        'html' => $html,
        'attachments' => $parts['attachments'] ?? [],
    ];
}

function nautimail_message_preview(string $body): string
{
    $text = preg_replace('/\s+/u', ' ', trim($body)) ?: '';
    return mb_substr($text, 0, 260);
}

function nautimail_heuristic_triage(string $subject, string $sender, string $body): array
{
    $haystack = mb_strtolower($subject . ' ' . $sender . ' ' . mb_substr($body, 0, 3000));
    $category = 'autre';

    $keywordMap = [
        'finance' => ['facture', 'paiement', 'reglement', 'virement', 'impaye', 'comptable', 'comptabilite', 'tva', 'banque'],
        'vente' => ['devis', 'tarif', 'prix', 'commande', 'achat', 'panier', 'offre', 'proposition', 'commercial'],
        'support' => ['probleme', 'erreur', 'panne', 'bug', 'aide', 'support', 'sav', 'remboursement', 'incident'],
        'gestion' => ['contrat', 'administratif', 'document', 'juridique', 'dossier', 'rendez-vous', 'reunion', 'rh'],
        'client' => ['client', 'livraison', 'reservation', 'avis', 'demande', 'contact'],
        'spam' => ['unsubscribe', 'newsletter', 'promotion', 'casino', 'gagnez', 'gratuit', 'black friday'],
    ];

    foreach ($keywordMap as $candidate => $keywords) {
        foreach ($keywords as $keyword) {
            if (str_contains($haystack, $keyword)) {
                $category = $candidate;
                break 2;
            }
        }
    }

    $priority = 'normal';
    foreach (['urgent', 'asap', 'bloque', 'retard', 'litige', 'mise en demeure', 'impaye'] as $keyword) {
        if (str_contains($haystack, $keyword)) {
            $priority = 'urgent';
            break;
        }
    }
    if ($priority === 'normal') {
        foreach (['devis', 'commande', 'paiement', 'contrat', 'client'] as $keyword) {
            if (str_contains($haystack, $keyword)) {
                $priority = 'high';
                break;
            }
        }
    }
    if ($category === 'spam') {
        $priority = 'low';
    }

    return [$category, $priority];
}

function nautimail_thread_key(?string $messageId, string $subject, string $senderEmail): string
{
    $messageId = trim((string) $messageId);
    if ($messageId !== '') {
        return mb_substr($messageId, 0, 255);
    }

    $normalizedSubject = preg_replace('/^(re|fw|fwd)\s*:\s*/iu', '', mb_strtolower($subject)) ?: $subject;
    return mb_substr(hash('sha256', $senderEmail . '|' . $normalizedSubject), 0, 64);
}

function nautimail_upsert_message(PDO $pdo, int $accountId, string $mailbox, int $uid, array $payload): bool
{
    [$category, $priority] = nautimail_heuristic_triage(
        (string) ($payload['subject'] ?? ''),
        (string) ($payload['senderEmail'] ?? ''),
        (string) ($payload['bodyText'] ?? '')
    );

    $statement = $pdo->prepare(
        'INSERT INTO nautimail_messages
            (account_id, mailbox, imap_uid, message_id, thread_key, subject, sender_name, sender_email, recipient_text, cc_text, bcc_text, received_at, preview, body_text, body_html, attachments_json, category, priority)
         VALUES
            (:account_id, :mailbox, :imap_uid, :message_id, :thread_key, :subject, :sender_name, :sender_email, :recipient_text, :cc_text, :bcc_text, :received_at, :preview, :body_text, :body_html, :attachments_json, :category, :priority)
         ON DUPLICATE KEY UPDATE
            message_id = VALUES(message_id),
            thread_key = VALUES(thread_key),
            subject = VALUES(subject),
            sender_name = VALUES(sender_name),
            sender_email = VALUES(sender_email),
            recipient_text = VALUES(recipient_text),
            cc_text = VALUES(cc_text),
            bcc_text = VALUES(bcc_text),
            received_at = VALUES(received_at),
            preview = VALUES(preview),
            body_text = VALUES(body_text),
            body_html = VALUES(body_html),
            attachments_json = VALUES(attachments_json),
            updated_at = CURRENT_TIMESTAMP'
    );
    $attachmentsJson = json_encode(
        nautimail_stored_attachments($payload['attachments'] ?? []),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    $statement->execute([
        'account_id' => $accountId,
        'mailbox' => $mailbox,
        'imap_uid' => $uid,
        'message_id' => nautimail_nullable_text($payload['messageId'] ?? '', 255, true),
        'thread_key' => nautimail_thread_key($payload['messageId'] ?? '', (string) ($payload['subject'] ?? ''), (string) ($payload['senderEmail'] ?? '')),
        'subject' => nautimail_nullable_text($payload['subject'] ?? '', 255, true),
        'sender_name' => nautimail_nullable_text($payload['senderName'] ?? '', 190, true),
        'sender_email' => nautimail_nullable_text($payload['senderEmail'] ?? '', 190, true),
        'recipient_text' => nautimail_nullable_text($payload['recipientText'] ?? '', 4000, true),
        'cc_text' => nautimail_nullable_text($payload['ccText'] ?? '', 4000, true),
        'bcc_text' => nautimail_nullable_text($payload['bccText'] ?? '', 4000, true),
        'received_at' => $payload['receivedAt'] ?? null,
        'preview' => nautimail_message_preview((string) ($payload['bodyText'] ?? '')),
        'body_text' => nautimail_nullable_text($payload['bodyText'] ?? '', 120000, false),
        'body_html' => nautimail_nullable_text($payload['bodyHtml'] ?? '', 120000, false),
        'attachments_json' => $attachmentsJson !== false && $attachmentsJson !== '[]' ? $attachmentsJson : null,
        'category' => $category,
        'priority' => $priority,
    ]);

    return $statement->rowCount() === 1;
}

function nautimail_sync_account(PDO $pdo, array $user, array $input): array
{
    if (!function_exists('imap_open')) {
        throw new RuntimeException('Extension PHP IMAP non active. Activez imap dans WAMP/PHP pour synchroniser les mails.');
    }

    $accountId = (int) ($input['accountId'] ?? 0);
    $limit = max(1, min(100, (int) ($input['limit'] ?? 50)));
    $account = nautimail_private_account(nautimail_require_account_access($pdo, $user, $accountId));
    if (!(bool) $account['is_active']) {
        throw new InvalidArgumentException('Cette adresse mail est desactivee.');
    }
    if (trim((string) ($account['password'] ?? '')) === '') {
        throw new InvalidArgumentException('Mot de passe mail manquant.');
    }

    $mailbox = nautimail_imap_mailbox($account);
    $imap = @imap_open($mailbox, (string) $account['username'], (string) $account['password'], OP_READONLY, 1);
    if ($imap === false) {
        $error = function_exists('imap_last_error') ? (string) imap_last_error() : '';
        throw new RuntimeException($error !== '' ? $error : 'Connexion IMAP impossible.');
    }

    $seen = 0;
    $created = 0;
    $updated = 0;
    try {
        $uids = @imap_search($imap, 'ALL', SE_UID);
        if (!is_array($uids)) {
            $uids = [];
        }
        rsort($uids, SORT_NUMERIC);
        $uids = array_slice($uids, 0, $limit);

        foreach ($uids as $uidValue) {
            $uid = (int) $uidValue;
            if ($uid <= 0) {
                continue;
            }
            $overviewList = @imap_fetch_overview($imap, (string) $uid, FT_UID);
            $overview = is_array($overviewList) && isset($overviewList[0]) ? $overviewList[0] : null;
            $messageNumber = (int) @imap_msgno($imap, $uid);
            $header = $messageNumber > 0 ? @imap_headerinfo($imap, $messageNumber) : null;
            $body = nautimail_fetch_message_body($imap, $uid);

            [$senderName, $senderEmail] = ['', ''];
            if (is_object($header) && is_array($header->from ?? null) && isset($header->from[0])) {
                [$senderName, $senderEmail] = nautimail_address_from_header_object($header->from[0]);
            }

            $subject = nautimail_decode_mime_text((string) ($overview->subject ?? $header->subject ?? ''));
            $dateText = (string) ($overview->date ?? $header->date ?? '');
            $timestamp = $dateText !== '' ? strtotime($dateText) : false;
            $receivedAt = $timestamp !== false ? date('Y-m-d H:i:s', $timestamp) : null;

            $wasInserted = nautimail_upsert_message($pdo, (int) $account['id'], (string) $account['imap_folder'], $uid, [
                'messageId' => (string) ($overview->message_id ?? $header->message_id ?? ''),
                'subject' => $subject !== '' ? $subject : '(Sans objet)',
                'senderName' => $senderName,
                'senderEmail' => $senderEmail,
                'recipientText' => nautimail_decode_mime_text((string) ($header->toaddress ?? '')),
                'ccText' => nautimail_decode_mime_text((string) ($header->ccaddress ?? '')),
                'bccText' => nautimail_decode_mime_text((string) ($header->bccaddress ?? '')),
                'receivedAt' => $receivedAt,
                'bodyText' => $body['text'],
                'bodyHtml' => $body['html'],
                'attachments' => $body['attachments'] ?? [],
            ]);

            $seen++;
            if ($wasInserted) {
                $created++;
            } else {
                $updated++;
            }
        }

        $statement = $pdo->prepare('UPDATE nautimail_accounts SET last_sync_at = NOW(), updated_by_user_id = :user_id WHERE id = :id');
        $statement->execute([
            'id' => (int) $account['id'],
            'user_id' => (int) $user['id'],
        ]);
    } finally {
        @imap_close($imap);
    }

    return [
        'seen' => $seen,
        'created' => $created,
        'updated' => $updated,
        'message' => sprintf('%d mail(s) lus, %d ajoute(s), %d mis a jour.', $seen, $created, $updated),
    ];
}

function nautimail_extract_json_object(string $answer): array
{
    $decoded = json_decode($answer, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    $start = strpos($answer, '{');
    $end = strrpos($answer, '}');
    if ($start === false || $end === false || $end <= $start) {
        return [];
    }

    $decoded = json_decode(substr($answer, $start, $end - $start + 1), true);
    return is_array($decoded) ? $decoded : [];
}

function nautimail_analyze_message(PDO $pdo, array $user, int $messageId): array
{
    $message = nautimail_require_message_access($pdo, $user, $messageId);
    $settings = oceanos_ai_private_settings($pdo, (int) $user['id']);
    if (trim((string) $settings['apiKey']) === '') {
        throw new InvalidArgumentException('Aucune cle Groq n est configuree dans OceanOS.');
    }

    $content = mb_substr(
        "Sujet: " . (string) $message['subject'] . "\n" .
        "De: " . (string) $message['sender_name'] . ' <' . (string) $message['sender_email'] . ">\n" .
        "Recu: " . (string) $message['received_at'] . "\n\n" .
        (string) $message['body_text'],
        0,
        9000
    );

    $answer = oceanos_groq_chat_completion(
        (string) $settings['apiKey'],
        (string) $settings['model'],
        [
            [
                'role' => 'system',
                'content' => 'Tu classes des emails pour une entreprise nautique. Reponds uniquement en JSON valide avec les cles summary, category, priority, actions. category vaut client, vente, gestion, support, finance, spam ou autre. priority vaut low, normal, high ou urgent. summary fait 2 phrases maximum. actions est une courte liste de prochaines actions separees par des points-virgules.',
            ],
            ['role' => 'user', 'content' => $content],
        ],
        0.2,
        800
    );

    $data = nautimail_extract_json_object($answer);
    $summary = nautimail_clean_text($data['summary'] ?? $answer, 1600, false);
    $category = nautimail_enum($data['category'] ?? $message['category'], ['client', 'vente', 'gestion', 'support', 'finance', 'spam', 'autre'], (string) $message['category']);
    $priority = nautimail_enum($data['priority'] ?? $message['priority'], ['low', 'normal', 'high', 'urgent'], (string) $message['priority']);
    $actions = nautimail_clean_text($data['actions'] ?? '', 1600, false);

    $statement = $pdo->prepare(
        'UPDATE nautimail_messages
         SET ai_summary = :ai_summary,
             ai_actions = :ai_actions,
             category = :category,
             priority = :priority,
             status = IF(status = "new", "triaged", status)
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $messageId,
        'ai_summary' => $summary,
        'ai_actions' => $actions !== '' ? $actions : null,
        'category' => $category,
        'priority' => $priority,
    ]);

    $updated = nautimail_message_by_id($pdo, $messageId);
    if ($updated === null) {
        throw new RuntimeException('Impossible de relire le mail analyse.');
    }

    return nautimail_public_message($updated);
}

function nautimail_analyze_pending(PDO $pdo, array $user, array $input): array
{
    $accountIds = nautimail_accessible_account_ids($pdo, $user);
    if ($accountIds === []) {
        return ['count' => 0, 'messages' => []];
    }

    $limit = max(1, min(10, (int) ($input['limit'] ?? 5)));
    $where = 'account_id IN (' . implode(',', array_fill(0, count($accountIds), '?')) . ') AND (ai_summary IS NULL OR ai_summary = "") AND status <> "archived"';
    $params = $accountIds;
    $accountId = (int) ($input['accountId'] ?? 0);
    if ($accountId > 0 && in_array($accountId, $accountIds, true)) {
        $where .= ' AND account_id = ?';
        $params[] = $accountId;
    }

    $statement = $pdo->prepare("SELECT id FROM nautimail_messages WHERE {$where} ORDER BY COALESCE(received_at, created_at) DESC LIMIT {$limit}");
    $statement->execute($params);
    $ids = array_map(static fn(array $row): int => (int) $row['id'], $statement->fetchAll());

    $messages = [];
    foreach ($ids as $id) {
        $messages[] = nautimail_analyze_message($pdo, $user, $id);
    }

    return [
        'count' => count($messages),
        'messages' => $messages,
    ];
}

function nautimail_update_message(PDO $pdo, array $user, array $input): array
{
    $messageId = (int) ($input['messageId'] ?? 0);
    nautimail_require_message_access($pdo, $user, $messageId);

    $assignedUserId = (int) ($input['assignedUserId'] ?? 0);
    $statement = $pdo->prepare(
        'UPDATE nautimail_messages
         SET category = :category,
             priority = :priority,
             status = :status,
             assigned_user_id = :assigned_user_id
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $messageId,
        'category' => nautimail_enum($input['category'] ?? 'autre', ['client', 'vente', 'gestion', 'support', 'finance', 'spam', 'autre'], 'autre'),
        'priority' => nautimail_enum($input['priority'] ?? 'normal', ['low', 'normal', 'high', 'urgent'], 'normal'),
        'status' => nautimail_enum($input['status'] ?? 'triaged', ['new', 'triaged', 'read', 'replied', 'archived'], 'triaged'),
        'assigned_user_id' => $assignedUserId > 0 ? $assignedUserId : null,
    ]);

    $message = nautimail_message_by_id($pdo, $messageId);
    if ($message === null) {
        throw new RuntimeException('Impossible de relire le mail.');
    }

    return nautimail_public_message($message);
}

function nautimail_reply_subject(string $subject): string
{
    $subject = trim($subject) !== '' ? trim($subject) : '(Sans objet)';
    return preg_match('/^re\s*:/i', $subject) ? $subject : 'Re: ' . $subject;
}

function nautimail_extract_email_list(string $value, bool $required = false, int $limit = 20): array
{
    preg_match_all('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $value, $matches);
    $emails = [];
    foreach ($matches[0] ?? [] as $match) {
        $email = nautimail_email($match, false);
        if ($email !== null) {
            $emails[$email] = true;
        }
    }

    if ($emails === [] && $required) {
        throw new InvalidArgumentException('Destinataire obligatoire.');
    }

    return array_slice(array_keys($emails), 0, $limit);
}

function nautimail_reply_recipients(array $message, array $account, bool $replyAll): array
{
    $sender = nautimail_extract_email_list((string) ($message['sender_email'] ?? ''), false, 1);
    $to = $sender;
    $cc = [];

    if ($replyAll) {
        $excluded = [];
        foreach ([
            (string) ($account['email_address'] ?? ''),
            (string) ($account['reply_to'] ?? ''),
            (string) ($message['account_email'] ?? ''),
            ...$to,
        ] as $email) {
            foreach (nautimail_extract_email_list($email, false, 5) as $parsed) {
                $excluded[$parsed] = true;
            }
        }

        $candidates = array_merge(
            nautimail_extract_email_list((string) ($message['recipient_text'] ?? ''), false, 30),
            nautimail_extract_email_list((string) ($message['cc_text'] ?? ''), false, 30)
        );
        foreach ($candidates as $email) {
            if (!isset($excluded[$email])) {
                $cc[$email] = true;
            }
        }
    }

    return [
        'toEmail' => implode(', ', array_slice(array_values($to), 0, 10)),
        'ccEmail' => implode(', ', array_slice(array_keys($cc), 0, 20)),
        'bccEmail' => '',
    ];
}

function nautimail_generate_reply(PDO $pdo, array $user, array $input): array
{
    $messageId = (int) ($input['messageId'] ?? 0);
    $message = nautimail_require_message_access($pdo, $user, $messageId);
    $account = nautimail_require_account_access($pdo, $user, (int) $message['account_id']);
    if (!nautimail_can_reply_account($pdo, $user, (int) $account['id'])) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Reponse non autorisee pour cette adresse.',
        ], 403);
    }

    $settings = oceanos_ai_private_settings($pdo, (int) $user['id']);
    if (trim((string) $settings['apiKey']) === '') {
        throw new InvalidArgumentException('Aucune cle Groq n est configuree dans OceanOS.');
    }

    $tone = nautimail_enum($input['tone'] ?? 'pro', ['pro', 'court', 'commercial', 'support'], 'pro');
    $replyAll = !empty($input['replyAll']);
    $recipients = nautimail_reply_recipients($message, $account, $replyAll);
    $prompt = mb_substr(
        "Ton: {$tone}\n" .
        "Adresse de reponse: " . (string) $account['email_address'] . "\n" .
        "Mode: " . ($replyAll ? "repondre a tous" : "repondre a l expediteur") . "\n" .
        "Signature: " . (string) ($account['signature'] ?? '') . "\n\n" .
        "Mail recu\nSujet: " . (string) $message['subject'] . "\n" .
        "De: " . (string) $message['sender_email'] . "\n" .
        "A: " . (string) ($message['recipient_text'] ?? '') . "\n" .
        "Cc: " . (string) ($message['cc_text'] ?? '') . "\n" .
        "Synthese IA: " . (string) ($message['ai_summary'] ?? '') . "\n\n" .
        (string) $message['body_text'],
        0,
        9000
    );

    $answer = oceanos_groq_chat_completion(
        (string) $settings['apiKey'],
        (string) $settings['model'],
        [
            [
                'role' => 'system',
                'content' => 'Redige une reponse email en francais professionnel. Ne mets ni objet, ni markdown, ni guillemets autour du message. Reste concret, utile et pret a envoyer.',
            ],
            ['role' => 'user', 'content' => $prompt],
        ],
        0.35,
        900
    );

    $body = trim($answer);
    if ((string) ($account['signature'] ?? '') !== '' && !str_contains($body, (string) $account['signature'])) {
        $body .= "\n\n" . trim((string) $account['signature']);
    }

    return [
        'toEmail' => $recipients['toEmail'],
        'ccEmail' => $recipients['ccEmail'],
        'bccEmail' => $recipients['bccEmail'],
        'subject' => nautimail_reply_subject((string) $message['subject']),
        'body' => $body,
    ];
}

function nautimail_parse_recipients(string $value, bool $required = true, int $limit = 20): array
{
    return nautimail_extract_email_list($value, $required, $limit);
}

function nautimail_header_encode(string $value): string
{
    if (function_exists('iconv_mime_encode')) {
        $encoded = @iconv_mime_encode('', $value, [
            'scheme' => 'B',
            'input-charset' => 'UTF-8',
            'output-charset' => 'UTF-8',
            'line-length' => 76,
        ]);
        if (is_string($encoded)) {
            return trim(substr($encoded, 2));
        }
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function nautimail_smtp_read($socket): string
{
    $response = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }
        $response .= $line;
        if (preg_match('/^\d{3}\s/', $line)) {
            break;
        }
    }

    return $response;
}

function nautimail_smtp_command($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    $response = nautimail_smtp_read($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('Erreur SMTP: ' . trim($response));
    }

    return $response;
}

function nautimail_smtp_send(array $account, array $toRecipients, array $ccRecipients, array $bccRecipients, string $subject, string $body): void
{
    $host = trim((string) ($account['smtp_host'] ?? ''));
    if ($host === '') {
        throw new InvalidArgumentException('Serveur SMTP manquant.');
    }
    $password = (string) ($account['password'] ?? '');
    if ($password === '') {
        throw new InvalidArgumentException('Mot de passe SMTP manquant.');
    }

    $port = (int) ($account['smtp_port'] ?? 587);
    $encryption = (string) ($account['smtp_encryption'] ?? 'tls');
    $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT);
    if (!is_resource($socket)) {
        throw new RuntimeException($errstr !== '' ? $errstr : 'Connexion SMTP impossible.');
    }

    stream_set_timeout($socket, 30);
    try {
        $hello = nautimail_smtp_read($socket);
        if ((int) substr($hello, 0, 3) !== 220) {
            throw new RuntimeException('Serveur SMTP indisponible: ' . trim($hello));
        }

        nautimail_smtp_command($socket, 'EHLO localhost', [250]);
        if ($encryption === 'tls') {
            nautimail_smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Demarrage TLS SMTP impossible.');
            }
            nautimail_smtp_command($socket, 'EHLO localhost', [250]);
        }

        $username = (string) ($account['username'] ?? $account['email_address']);
        if ($username !== '' && $password !== '') {
            nautimail_smtp_command($socket, 'AUTH LOGIN', [334]);
            nautimail_smtp_command($socket, base64_encode($username), [334]);
            nautimail_smtp_command($socket, base64_encode($password), [235]);
        }

        $fromEmail = (string) $account['email_address'];
        $fromName = trim((string) ($account['display_name'] ?? ''));
        $fromHeader = $fromName !== '' ? nautimail_header_encode($fromName) . ' <' . $fromEmail . '>' : $fromEmail;
        $toHeader = implode(', ', $toRecipients);
        $ccHeader = implode(', ', $ccRecipients);
        $allRecipients = array_values(array_unique(array_merge($toRecipients, $ccRecipients, $bccRecipients)));

        nautimail_smtp_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        foreach ($allRecipients as $recipient) {
            nautimail_smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        }
        nautimail_smtp_command($socket, 'DATA', [354]);

        $body = str_replace(["\r\n", "\r"], "\n", $body);
        $body = preg_replace('/^\./m', '..', $body) ?: $body;
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $fromHeader,
            'To: ' . $toHeader,
            'Subject: ' . nautimail_header_encode($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        if ($ccHeader !== '') {
            array_splice($headers, 3, 0, ['Cc: ' . $ccHeader]);
        }
        if (filter_var((string) ($account['reply_to'] ?? ''), FILTER_VALIDATE_EMAIL)) {
            array_splice($headers, 3, 0, ['Reply-To: ' . (string) $account['reply_to']]);
        }
        fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $body) . "\r\n.\r\n");
        $response = nautimail_smtp_read($socket);
        if (!in_array((int) substr($response, 0, 3), [250], true)) {
            throw new RuntimeException('Erreur SMTP: ' . trim($response));
        }

        @fwrite($socket, "QUIT\r\n");
    } finally {
        @fclose($socket);
    }
}

function nautimail_send_reply(PDO $pdo, array $user, array $input): array
{
    $messageId = (int) ($input['messageId'] ?? 0);
    $message = nautimail_require_message_access($pdo, $user, $messageId);
    $account = nautimail_private_account(nautimail_require_account_access($pdo, $user, (int) $message['account_id']));
    if (!nautimail_can_reply_account($pdo, $user, (int) $account['id'])) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Reponse non autorisee pour cette adresse.',
        ], 403);
    }

    $toRecipients = nautimail_parse_recipients((string) ($input['toEmail'] ?? $message['sender_email'] ?? ''), true, 20);
    $ccRecipients = nautimail_parse_recipients((string) ($input['ccEmail'] ?? ''), false, 30);
    $bccRecipients = nautimail_parse_recipients((string) ($input['bccEmail'] ?? ''), false, 30);
    $subject = nautimail_clean_text($input['subject'] ?? nautimail_reply_subject((string) $message['subject']), 255, true);
    $body = nautimail_clean_text($input['body'] ?? '', 120000, false);
    if ($subject === '' || $body === '') {
        throw new InvalidArgumentException('Sujet et message sont obligatoires.');
    }

    $replyId = null;
    try {
        nautimail_smtp_send($account, $toRecipients, $ccRecipients, $bccRecipients, $subject, $body);
        $statement = $pdo->prepare(
            'INSERT INTO nautimail_replies (message_id, account_id, user_id, to_email, cc_email, bcc_email, subject, body_text, status, sent_at)
             VALUES (:message_id, :account_id, :user_id, :to_email, :cc_email, :bcc_email, :subject, :body_text, "sent", NOW())'
        );
        $statement->execute([
            'message_id' => $messageId,
            'account_id' => (int) $account['id'],
            'user_id' => (int) $user['id'],
            'to_email' => implode(', ', $toRecipients),
            'cc_email' => $ccRecipients !== [] ? implode(', ', $ccRecipients) : null,
            'bcc_email' => $bccRecipients !== [] ? implode(', ', $bccRecipients) : null,
            'subject' => $subject,
            'body_text' => $body,
        ]);
        $replyId = (int) $pdo->lastInsertId();

        $update = $pdo->prepare('UPDATE nautimail_messages SET status = "replied" WHERE id = :id');
        $update->execute(['id' => $messageId]);
    } catch (Throwable $exception) {
        $statement = $pdo->prepare(
            'INSERT INTO nautimail_replies (message_id, account_id, user_id, to_email, cc_email, bcc_email, subject, body_text, status, error_message)
             VALUES (:message_id, :account_id, :user_id, :to_email, :cc_email, :bcc_email, :subject, :body_text, "failed", :error_message)'
        );
        $statement->execute([
            'message_id' => $messageId,
            'account_id' => (int) $account['id'],
            'user_id' => (int) $user['id'],
            'to_email' => implode(', ', $toRecipients),
            'cc_email' => $ccRecipients !== [] ? implode(', ', $ccRecipients) : null,
            'bcc_email' => $bccRecipients !== [] ? implode(', ', $bccRecipients) : null,
            'subject' => $subject,
            'body_text' => $body,
            'error_message' => $exception->getMessage(),
        ]);
        throw $exception;
    }

    $updated = nautimail_message_by_id($pdo, $messageId);
    if ($updated === null) {
        throw new RuntimeException('Impossible de relire le mail.');
    }

    return [
        'replyId' => $replyId,
        'message' => nautimail_public_message($updated),
    ];
}

function nautimail_deactivate_account(PDO $pdo, array $user, array $input): array
{
    $accountId = (int) ($input['accountId'] ?? 0);
    if (!nautimail_can_manage_account($pdo, $user, $accountId)) {
        nautimail_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Desactivation reservee aux gestionnaires.',
        ], 403);
    }

    $statement = $pdo->prepare('UPDATE nautimail_accounts SET is_active = 0, updated_by_user_id = :user_id WHERE id = :id');
    $statement->execute([
        'id' => $accountId,
        'user_id' => (int) $user['id'],
    ]);

    $account = nautimail_account_by_id($pdo, $accountId);
    if ($account === null) {
        throw new RuntimeException('Impossible de relire l adresse.');
    }

    return nautimail_public_account($pdo, $account);
}
