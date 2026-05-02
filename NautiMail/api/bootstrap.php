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
            received_at DATETIME NULL,
            preview TEXT NULL,
            body_text LONGTEXT NULL,
            body_html LONGTEXT NULL,
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

function nautimail_public_message(array $row): array
{
    return [
        'id' => (int) $row['id'],
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
        'receivedAt' => $row['received_at'] ? (string) $row['received_at'] : null,
        'preview' => (string) ($row['preview'] ?? ''),
        'bodyText' => (string) ($row['body_text'] ?? ''),
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
        return (string) base64_decode($body, true);
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

function nautimail_collect_body_parts($imap, int $uid, mixed $structure, string $partNumber = ''): array
{
    $plain = [];
    $html = [];

    if (!is_object($structure)) {
        return ['plain' => '', 'html' => ''];
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
        }
    }

    $type = (int) ($structure->type ?? -1);
    $subtype = strtoupper((string) ($structure->subtype ?? ''));
    if ($type === 0 && in_array($subtype, ['PLAIN', 'HTML'], true)) {
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
            (account_id, mailbox, imap_uid, message_id, thread_key, subject, sender_name, sender_email, recipient_text, cc_text, received_at, preview, body_text, body_html, category, priority)
         VALUES
            (:account_id, :mailbox, :imap_uid, :message_id, :thread_key, :subject, :sender_name, :sender_email, :recipient_text, :cc_text, :received_at, :preview, :body_text, :body_html, :category, :priority)
         ON DUPLICATE KEY UPDATE
            message_id = VALUES(message_id),
            thread_key = VALUES(thread_key),
            subject = VALUES(subject),
            sender_name = VALUES(sender_name),
            sender_email = VALUES(sender_email),
            recipient_text = VALUES(recipient_text),
            cc_text = VALUES(cc_text),
            received_at = VALUES(received_at),
            preview = VALUES(preview),
            body_text = VALUES(body_text),
            body_html = VALUES(body_html),
            updated_at = CURRENT_TIMESTAMP'
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
        'received_at' => $payload['receivedAt'] ?? null,
        'preview' => nautimail_message_preview((string) ($payload['bodyText'] ?? '')),
        'body_text' => nautimail_nullable_text($payload['bodyText'] ?? '', 120000, false),
        'body_html' => nautimail_nullable_text($payload['bodyHtml'] ?? '', 120000, false),
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
                'receivedAt' => $receivedAt,
                'bodyText' => $body['text'],
                'bodyHtml' => $body['html'],
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
    $prompt = mb_substr(
        "Ton: {$tone}\n" .
        "Adresse de reponse: " . (string) $account['email_address'] . "\n" .
        "Signature: " . (string) ($account['signature'] ?? '') . "\n\n" .
        "Mail recu\nSujet: " . (string) $message['subject'] . "\n" .
        "De: " . (string) $message['sender_email'] . "\n" .
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
        'toEmail' => (string) ($message['sender_email'] ?? ''),
        'subject' => nautimail_reply_subject((string) $message['subject']),
        'body' => $body,
    ];
}

function nautimail_parse_recipients(string $value): array
{
    $parts = preg_split('/[,;]+/', $value) ?: [];
    $emails = [];
    foreach ($parts as $part) {
        $email = nautimail_email($part, false);
        if ($email !== null) {
            $emails[$email] = true;
        }
    }
    if ($emails === []) {
        throw new InvalidArgumentException('Destinataire obligatoire.');
    }

    return array_slice(array_keys($emails), 0, 10);
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

function nautimail_smtp_send(array $account, array $recipients, string $subject, string $body): void
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
        $toHeader = implode(', ', $recipients);

        nautimail_smtp_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        foreach ($recipients as $recipient) {
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

    $recipients = nautimail_parse_recipients((string) ($input['toEmail'] ?? $message['sender_email'] ?? ''));
    $subject = nautimail_clean_text($input['subject'] ?? nautimail_reply_subject((string) $message['subject']), 255, true);
    $body = nautimail_clean_text($input['body'] ?? '', 120000, false);
    if ($subject === '' || $body === '') {
        throw new InvalidArgumentException('Sujet et message sont obligatoires.');
    }

    $replyId = null;
    try {
        nautimail_smtp_send($account, $recipients, $subject, $body);
        $statement = $pdo->prepare(
            'INSERT INTO nautimail_replies (message_id, account_id, user_id, to_email, subject, body_text, status, sent_at)
             VALUES (:message_id, :account_id, :user_id, :to_email, :subject, :body_text, "sent", NOW())'
        );
        $statement->execute([
            'message_id' => $messageId,
            'account_id' => (int) $account['id'],
            'user_id' => (int) $user['id'],
            'to_email' => implode(', ', $recipients),
            'subject' => $subject,
            'body_text' => $body,
        ]);
        $replyId = (int) $pdo->lastInsertId();

        $update = $pdo->prepare('UPDATE nautimail_messages SET status = "replied" WHERE id = :id');
        $update->execute(['id' => $messageId]);
    } catch (Throwable $exception) {
        $statement = $pdo->prepare(
            'INSERT INTO nautimail_replies (message_id, account_id, user_id, to_email, subject, body_text, status, error_message)
             VALUES (:message_id, :account_id, :user_id, :to_email, :subject, :body_text, "failed", :error_message)'
        );
        $statement->execute([
            'message_id' => $messageId,
            'account_id' => (int) $account['id'],
            'user_id' => (int) $user['id'],
            'to_email' => implode(', ', $recipients),
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
