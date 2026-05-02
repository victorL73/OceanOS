<?php
declare(strict_types=1);

class InvoceanPrestashopException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $statusCode,
        public readonly string $resource
    ) {
        parent::__construct($message, $statusCode);
    }
}

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function invocean_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config;
}

function invocean_load_vendor_autoload(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }

    $autoload = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
    if (is_file($autoload)) {
        require_once $autoload;
    }
    $loaded = true;
}

function invocean_json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    invocean_send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function invocean_read_json_request(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('Requete JSON invalide.');
    }

    return $data;
}

function invocean_is_https_request(): bool
{
    if (function_exists('oceanos_is_https_request')) {
        return oceanos_is_https_request();
    }

    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));

    return $https === 'on' || $https === '1' || $forwardedProto === 'https';
}

function invocean_send_security_headers(): void
{
    if (headers_sent()) {
        return;
    }

    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: SAMEORIGIN');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    if (invocean_is_https_request()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function invocean_pdo_root(): PDO
{
    $config = invocean_config();

    return new PDO(
        sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $config['db_host'], $config['db_port']),
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
}

function invocean_pdo(): PDO
{
    $config = invocean_config();
    $root = invocean_pdo_root();
    $dbName = str_replace('`', '``', (string) $config['db_name']);
    $root->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']),
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    invocean_ensure_schema($pdo);
    oceanos_ensure_schema($pdo);

    return $pdo;
}

function invocean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            display_name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member',
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    invocean_ensure_column($pdo, 'users', 'role', "ALTER TABLE users ADD COLUMN role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member' AFTER password_hash");
    invocean_ensure_column($pdo, 'users', 'is_active', "ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role");

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS invocean_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            shop_url VARCHAR(255) NULL,
            webservice_key_cipher TEXT NULL,
            webservice_key_hint VARCHAR(24) NULL,
            pdf_url_template TEXT NULL,
            nautisign_api_url TEXT NULL,
            nautisign_api_token_cipher TEXT NULL,
            nautisign_api_token_hint VARCHAR(24) NULL,
            sync_window_days INT UNSIGNED NOT NULL DEFAULT 30,
            seller_name VARCHAR(190) NULL,
            seller_vat_number VARCHAR(64) NULL,
            seller_siret VARCHAR(32) NULL,
            seller_street VARCHAR(190) NULL,
            seller_postcode VARCHAR(24) NULL,
            seller_city VARCHAR(120) NULL,
            seller_country_iso VARCHAR(2) NOT NULL DEFAULT 'FR',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS invocean_invoices (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prestashop_invoice_id BIGINT UNSIGNED NOT NULL,
            order_id BIGINT UNSIGNED NOT NULL,
            invoice_number VARCHAR(80) NULL,
            invoice_date DATE NULL,
            order_reference VARCHAR(80) NULL,
            customer_name VARCHAR(190) NULL,
            customer_email VARCHAR(190) NULL,
            customer_company VARCHAR(190) NULL,
            vat_number VARCHAR(64) NULL,
            currency_iso VARCHAR(8) NULL,
            total_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            total_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
            status ENUM('received', 'ready', 'sent', 'accepted', 'rejected', 'archived') NOT NULL DEFAULT 'received',
            channel ENUM('prestashop', 'manual', 'nautisign', 'pdp', 'chorus') NOT NULL DEFAULT 'prestashop',
            e_invoice_format ENUM('pdf', 'facturx', 'ubl', 'cii', 'unknown') NOT NULL DEFAULT 'pdf',
            pdf_url TEXT NULL,
            pdf_file_path VARCHAR(500) NULL,
            pdf_hash CHAR(64) NULL,
            pdf_downloaded_at DATETIME NULL,
            xml_payload LONGTEXT NULL,
            facturx_file_path VARCHAR(500) NULL,
            facturx_profile VARCHAR(40) NULL,
            facturx_generated_at DATETIME NULL,
            raw_json LONGTEXT NULL,
            source_hash CHAR(64) NOT NULL,
            synced_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_invocean_prestashop_invoice (prestashop_invoice_id),
            KEY idx_invocean_invoice_date (invoice_date),
            KEY idx_invocean_status (status),
            KEY idx_invocean_order (order_id),
            KEY idx_invocean_customer_email (customer_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS invocean_sync_runs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME NULL,
            invoices_seen INT UNSIGNED NOT NULL DEFAULT 0,
            invoices_created INT UNSIGNED NOT NULL DEFAULT 0,
            invoices_updated INT UNSIGNED NOT NULL DEFAULT 0,
            message TEXT NULL,
            raw_summary_json LONGTEXT NULL,
            CONSTRAINT fk_invocean_sync_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS invocean_signed_quotes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            source ENUM('nautisign', 'manual') NOT NULL DEFAULT 'nautisign',
            external_id VARCHAR(120) NOT NULL,
            quote_number VARCHAR(80) NULL,
            quote_date DATE NULL,
            signed_at DATETIME NULL,
            customer_name VARCHAR(190) NULL,
            customer_email VARCHAR(190) NULL,
            customer_company VARCHAR(190) NULL,
            vat_number VARCHAR(64) NULL,
            currency_iso VARCHAR(8) NULL,
            total_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            total_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
            status ENUM('signed', 'converted', 'ignored') NOT NULL DEFAULT 'signed',
            raw_json LONGTEXT NULL,
            invoice_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_invocean_quote_source_external (source, external_id),
            KEY idx_invocean_quote_status (status),
            KEY idx_invocean_quote_signed_at (signed_at),
            CONSTRAINT fk_invocean_quote_invoice FOREIGN KEY (invoice_id) REFERENCES invocean_invoices(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    invocean_ensure_column($pdo, 'invocean_settings', 'pdf_url_template', "ALTER TABLE invocean_settings ADD COLUMN pdf_url_template TEXT NULL AFTER webservice_key_hint");
    invocean_ensure_column($pdo, 'invocean_settings', 'nautisign_api_url', "ALTER TABLE invocean_settings ADD COLUMN nautisign_api_url TEXT NULL AFTER pdf_url_template");
    invocean_ensure_column($pdo, 'invocean_settings', 'nautisign_api_token_cipher', "ALTER TABLE invocean_settings ADD COLUMN nautisign_api_token_cipher TEXT NULL AFTER nautisign_api_url");
    invocean_ensure_column($pdo, 'invocean_settings', 'nautisign_api_token_hint', "ALTER TABLE invocean_settings ADD COLUMN nautisign_api_token_hint VARCHAR(24) NULL AFTER nautisign_api_token_cipher");
    invocean_ensure_column($pdo, 'invocean_settings', 'sync_window_days', "ALTER TABLE invocean_settings ADD COLUMN sync_window_days INT UNSIGNED NOT NULL DEFAULT 30 AFTER pdf_url_template");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_name', "ALTER TABLE invocean_settings ADD COLUMN seller_name VARCHAR(190) NULL AFTER sync_window_days");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_vat_number', "ALTER TABLE invocean_settings ADD COLUMN seller_vat_number VARCHAR(64) NULL AFTER seller_name");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_siret', "ALTER TABLE invocean_settings ADD COLUMN seller_siret VARCHAR(32) NULL AFTER seller_vat_number");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_street', "ALTER TABLE invocean_settings ADD COLUMN seller_street VARCHAR(190) NULL AFTER seller_siret");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_postcode', "ALTER TABLE invocean_settings ADD COLUMN seller_postcode VARCHAR(24) NULL AFTER seller_street");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_city', "ALTER TABLE invocean_settings ADD COLUMN seller_city VARCHAR(120) NULL AFTER seller_postcode");
    invocean_ensure_column($pdo, 'invocean_settings', 'seller_country_iso', "ALTER TABLE invocean_settings ADD COLUMN seller_country_iso VARCHAR(2) NOT NULL DEFAULT 'FR' AFTER seller_city");
    invocean_ensure_column($pdo, 'invocean_invoices', 'source_hash', "ALTER TABLE invocean_invoices ADD COLUMN source_hash CHAR(64) NOT NULL DEFAULT '' AFTER raw_json");
    invocean_ensure_column($pdo, 'invocean_invoices', 'pdf_file_path', "ALTER TABLE invocean_invoices ADD COLUMN pdf_file_path VARCHAR(500) NULL AFTER pdf_url");
    invocean_ensure_column($pdo, 'invocean_invoices', 'pdf_hash', "ALTER TABLE invocean_invoices ADD COLUMN pdf_hash CHAR(64) NULL AFTER pdf_file_path");
    invocean_ensure_column($pdo, 'invocean_invoices', 'pdf_downloaded_at', "ALTER TABLE invocean_invoices ADD COLUMN pdf_downloaded_at DATETIME NULL AFTER pdf_hash");
    invocean_ensure_column($pdo, 'invocean_invoices', 'xml_payload', "ALTER TABLE invocean_invoices ADD COLUMN xml_payload LONGTEXT NULL AFTER pdf_url");
    invocean_ensure_column($pdo, 'invocean_invoices', 'facturx_file_path', "ALTER TABLE invocean_invoices ADD COLUMN facturx_file_path VARCHAR(500) NULL AFTER xml_payload");
    invocean_ensure_column($pdo, 'invocean_invoices', 'facturx_profile', "ALTER TABLE invocean_invoices ADD COLUMN facturx_profile VARCHAR(40) NULL AFTER facturx_file_path");
    invocean_ensure_column($pdo, 'invocean_invoices', 'facturx_generated_at', "ALTER TABLE invocean_invoices ADD COLUMN facturx_generated_at DATETIME NULL AFTER facturx_profile");
    invocean_ensure_invoice_channel_values($pdo);

    $pdo->exec('INSERT IGNORE INTO invocean_settings (id, sync_window_days) VALUES (1, 30)');
    oceanos_ensure_schema($pdo);
}

function invocean_ensure_column(PDO $pdo, string $table, string $column, string $alterSql): void
{
    $config = invocean_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $statement->execute([
        'db_name' => $config['db_name'],
        'table_name' => $table,
        'column_name' => $column,
    ]);

    if ((int) $statement->fetchColumn() === 0) {
        $pdo->exec($alterSql);
    }
}

function invocean_table_exists(PDO $pdo, string $table): bool
{
    if (function_exists('oceanos_table_exists')) {
        return oceanos_table_exists($pdo, $table);
    }

    $config = invocean_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name'
    );
    $statement->execute([
        'db_name' => (string) $config['db_name'],
        'table_name' => $table,
    ]);

    return (int) $statement->fetchColumn() > 0;
}

function invocean_ensure_invoice_channel_values(PDO $pdo): void
{
    $config = invocean_config();
    $statement = $pdo->prepare(
        'SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = "invocean_invoices" AND COLUMN_NAME = "channel"
         LIMIT 1'
    );
    $statement->execute(['db_name' => $config['db_name']]);
    $columnType = (string) ($statement->fetchColumn() ?: '');
    if ($columnType !== '' && !str_contains($columnType, "'nautisign'")) {
        $pdo->exec("ALTER TABLE invocean_invoices MODIFY channel ENUM('prestashop', 'manual', 'nautisign', 'pdp', 'chorus') NOT NULL DEFAULT 'prestashop'");
    }
}

function invocean_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');

    $config = invocean_config();
    session_name((string) $config['session_name']);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 8,
        'path' => '/',
        'secure' => invocean_is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function invocean_user_count(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

function invocean_needs_bootstrap(PDO $pdo): bool
{
    return invocean_user_count($pdo) === 0;
}

function invocean_normalize_role(string $role): string
{
    $normalized = strtolower(trim($role));
    return in_array($normalized, ['super', 'admin', 'member'], true) ? $normalized : 'member';
}

function invocean_user_permissions(array $user): array
{
    $role = (string) ($user['role'] ?? 'member');

    return [
        'canManageUsers' => in_array($role, ['super', 'admin'], true),
        'canManageInvocean' => in_array($role, ['super', 'admin'], true),
        'canSyncInvoices' => in_array($role, ['super', 'admin'], true),
    ];
}

function invocean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? ''), ['super', 'admin'], true);
}

function invocean_public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'displayName' => (string) $user['display_name'],
        'role' => (string) $user['role'],
        'isActive' => (bool) $user['is_active'],
        'createdAt' => (string) $user['created_at'],
        'permissions' => invocean_user_permissions($user),
    ];
}

function invocean_find_user_by_id(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function invocean_find_user_by_email(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => mb_strtolower(trim($email))]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function invocean_oceanos_session_id(): string
{
    $sessionId = (string) ($_COOKIE['OCEANOSESSID'] ?? '');
    return preg_match('/^[A-Za-z0-9,-]{16,128}$/', $sessionId) === 1 ? $sessionId : '';
}

function invocean_find_oceanos_user_by_id(PDO $pdo, int $userId): ?array
{
    if ($userId <= 0) {
        return null;
    }

    try {
        $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $userId]);
        $row = $statement->fetch();
    } catch (Throwable) {
        return null;
    }

    return is_array($row) ? $row : null;
}

function invocean_sync_oceanos_user(PDO $pdo, array $oceanosUser): ?array
{
    $email = mb_strtolower(trim((string) ($oceanosUser['email'] ?? '')));
    $displayName = trim((string) ($oceanosUser['display_name'] ?? ''));
    $passwordHash = (string) ($oceanosUser['password_hash'] ?? '');

    if ($email === '' || $displayName === '' || $passwordHash === '') {
        return null;
    }

    $params = [
        'email' => $email,
        'display_name' => $displayName,
        'password_hash' => $passwordHash,
        'role' => invocean_normalize_role((string) ($oceanosUser['role'] ?? 'member')),
        'is_active' => !empty($oceanosUser['is_active']) ? 1 : 0,
    ];

    $existingByEmail = invocean_find_user_by_email($pdo, $email);
    if ($existingByEmail !== null) {
        $statement = $pdo->prepare(
            'UPDATE users
             SET email = :email,
                 display_name = :display_name,
                 password_hash = :password_hash,
                 role = :role,
                 is_active = :is_active
             WHERE id = :id'
        );
        $statement->execute($params + ['id' => (int) $existingByEmail['id']]);
        return invocean_find_user_by_id($pdo, (int) $existingByEmail['id']);
    }

    $oceanosUserId = (int) ($oceanosUser['id'] ?? 0);
    $existingById = $oceanosUserId > 0 ? invocean_find_user_by_id($pdo, $oceanosUserId) : null;

    if ($existingById === null && $oceanosUserId > 0) {
        $statement = $pdo->prepare(
            'INSERT INTO users (id, email, display_name, password_hash, role, is_active)
             VALUES (:id, :email, :display_name, :password_hash, :role, :is_active)'
        );
        $statement->execute($params + ['id' => $oceanosUserId]);
    } else {
        $statement = $pdo->prepare(
            'INSERT INTO users (email, display_name, password_hash, role, is_active)
             VALUES (:email, :display_name, :password_hash, :role, :is_active)'
        );
        $statement->execute($params);
    }

    return invocean_find_user_by_email($pdo, $email);
}

function invocean_bridge_oceanos_session(PDO $pdo): ?array
{
    $oceanosSessionId = invocean_oceanos_session_id();
    if ($oceanosSessionId === '') {
        return null;
    }

    $config = invocean_config();
    $invoceanSessionName = (string) $config['session_name'];
    $invoceanSessionId = session_id();
    session_write_close();

    $_SESSION = [];
    session_name('OCEANOSESSID');
    session_id($oceanosSessionId);
    session_start(['read_and_close' => true]);
    $oceanosUserId = isset($_SESSION['oceanos_user_id']) ? (int) $_SESSION['oceanos_user_id'] : 0;

    $_SESSION = [];
    session_name($invoceanSessionName);
    if ($invoceanSessionId !== '') {
        session_id($invoceanSessionId);
    }
    session_start();

    $oceanosUser = invocean_find_oceanos_user_by_id($pdo, $oceanosUserId);
    if ($oceanosUser === null || !(bool) $oceanosUser['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    $user = invocean_sync_oceanos_user($pdo, $oceanosUser);
    if ($user === null || !(bool) $user['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    $_SESSION['user_id'] = (int) $user['id'];
    return $user;
}

function invocean_current_user(PDO $pdo): ?array
{
    invocean_start_session();
    $bridgedUser = invocean_bridge_oceanos_session($pdo);
    if ($bridgedUser !== null) {
        return $bridgedUser;
    }

    $userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    if ($userId <= 0) {
        return null;
    }

    $user = invocean_find_user_by_id($pdo, $userId);
    if ($user === null || !(bool) $user['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    return $user;
}

function invocean_require_auth(PDO $pdo): array
{
    $user = invocean_current_user($pdo);
    if ($user === null) {
        invocean_json_response([
            'ok' => false,
            'error' => 'unauthenticated',
            'message' => 'Connexion requise.',
        ], 401);
    }

    return $user;
}

function invocean_require_admin(PDO $pdo): array
{
    $user = invocean_require_auth($pdo);
    if (!invocean_is_admin($user)) {
        invocean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function invocean_login_user(PDO $pdo, string $email, string $password): ?array
{
    $user = invocean_find_user_by_email($pdo, $email);
    if ($user === null || !(bool) $user['is_active']) {
        return null;
    }

    if (!password_verify($password, (string) $user['password_hash'])) {
        return null;
    }

    invocean_start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    return $user;
}

function invocean_logout_user(): void
{
    invocean_start_session();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'] ?? '/',
            $params['domain'] ?? '',
            (bool) ($params['secure'] ?? false),
            (bool) ($params['httponly'] ?? true)
        );
    }

    session_destroy();
}

function invocean_create_user(PDO $pdo, string $displayName, string $email, string $password, string $role = 'admin'): array
{
    $displayName = trim($displayName);
    $email = mb_strtolower(trim($email));
    $role = invocean_normalize_role($role);

    if ($displayName === '' || $email === '' || $password === '') {
        throw new InvalidArgumentException('Nom, email et mot de passe sont obligatoires.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }
    if (mb_strlen($password) < 8) {
        throw new InvalidArgumentException('Le mot de passe doit contenir au moins 8 caracteres.');
    }
    if (invocean_find_user_by_email($pdo, $email) !== null) {
        throw new InvalidArgumentException('Un compte existe deja avec cet email.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO users (email, display_name, password_hash, role, is_active)
         VALUES (:email, :display_name, :password_hash, :role, 1)'
    );
    $statement->execute([
        'email' => $email,
        'display_name' => $displayName,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
    ]);

    $user = invocean_find_user_by_id($pdo, (int) $pdo->lastInsertId());
    if ($user === null) {
        throw new RuntimeException('Impossible de creer le compte.');
    }

    return $user;
}

function invocean_bootstrap_admin(PDO $pdo, string $displayName, string $email, string $password): array
{
    if (!invocean_needs_bootstrap($pdo)) {
        throw new RuntimeException('Le bootstrap initial a deja ete effectue.');
    }

    $user = invocean_create_user($pdo, $displayName, $email, $password, 'admin');
    invocean_start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    return $user;
}

function invocean_secret_file(): string
{
    return __DIR__ . '/.invocean_secret';
}

function invocean_secret_key(): string
{
    $config = invocean_config();
    $secret = trim((string) ($config['secret'] ?? ''));
    if ($secret === '') {
        $file = invocean_secret_file();
        if (!is_file($file)) {
            $created = base64_encode(random_bytes(32));
            @file_put_contents($file, $created, LOCK_EX);
        }
        $secret = is_file($file) ? trim((string) file_get_contents($file)) : '';
    }

    if ($secret === '') {
        $config = invocean_config();
        $secret = implode('|', [
            (string) $config['db_host'],
            (string) $config['db_name'],
            (string) $config['db_user'],
            __DIR__,
        ]);
    }

    return hash('sha256', $secret, true);
}

function invocean_encrypt_secret(?string $plain): ?string
{
    $plain = trim((string) $plain);
    if ($plain === '') {
        return null;
    }

    if (!function_exists('openssl_encrypt')) {
        return 'plain:' . base64_encode($plain);
    }

    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', invocean_secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) {
        throw new RuntimeException('Impossible de chiffrer la cle PrestaShop.');
    }

    return 'gcm:' . base64_encode($iv . $tag . $cipher);
}

function invocean_decrypt_secret(?string $cipher): string
{
    $cipher = trim((string) $cipher);
    if ($cipher === '') {
        return '';
    }

    if (str_starts_with($cipher, 'plain:')) {
        return (string) base64_decode(substr($cipher, 6), true);
    }

    if (!str_starts_with($cipher, 'gcm:') || !function_exists('openssl_decrypt')) {
        return '';
    }

    $raw = base64_decode(substr($cipher, 4), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }

    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $encrypted = substr($raw, 28);
    $plain = openssl_decrypt($encrypted, 'aes-256-gcm', invocean_secret_key(), OPENSSL_RAW_DATA, $iv, $tag);

    return $plain === false ? '' : $plain;
}

function invocean_key_hint(string $key): string
{
    $key = trim($key);
    if ($key === '') {
        return '';
    }

    return substr($key, 0, 4) . '...' . substr($key, -4);
}

function invocean_normalize_shop_url(string $shopUrl): string
{
    $shopUrl = rtrim(trim($shopUrl), '/');
    if ($shopUrl === '') {
        return '';
    }

    if (preg_match('~/api$~i', $shopUrl)) {
        $shopUrl = preg_replace('~/api$~i', '', $shopUrl) ?? $shopUrl;
    }

    return rtrim($shopUrl, '/');
}

function invocean_get_settings(PDO $pdo, bool $includeSecret = false): array
{
    $pdo->exec('INSERT IGNORE INTO invocean_settings (id, sync_window_days) VALUES (1, 30)');
    $statement = $pdo->query('SELECT * FROM invocean_settings WHERE id = 1 LIMIT 1');
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration Invocean introuvable.');
    }

    $prestashopSettings = oceanos_prestashop_private_settings($pdo);
    $secret = $includeSecret ? (string) ($prestashopSettings['webserviceKey'] ?? '') : '';
    $nautisignToken = invocean_decrypt_secret((string) ($row['nautisign_api_token_cipher'] ?? ''));
    $sellerSettings = invocean_company_seller_settings($pdo, $row);

    return array_merge([
        'shopUrl' => invocean_normalize_shop_url((string) ($prestashopSettings['shopUrl'] ?? '')),
        'webserviceKey' => $secret,
        'webserviceKeyHint' => (string) ($prestashopSettings['webserviceKeyHint'] ?? ''),
        'hasWebserviceKey' => (bool) ($prestashopSettings['hasWebserviceKey'] ?? false),
        'pdfUrlTemplate' => (string) ($row['pdf_url_template'] ?? ''),
        'nautisignApiUrl' => (string) ($row['nautisign_api_url'] ?? ''),
        'nautisignApiToken' => $includeSecret ? $nautisignToken : '',
        'nautisignApiTokenHint' => (string) ($row['nautisign_api_token_hint'] ?? ''),
        'hasNautisignApiToken' => $nautisignToken !== '',
        'syncWindowDays' => (int) ($prestashopSettings['syncWindowDays'] ?? 30),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'managedBy' => 'OceanOS',
    ], $sellerSettings);
}

function invocean_public_settings(array $settings, bool $canManage): array
{
    unset($settings['webserviceKey']);
    unset($settings['nautisignApiToken']);
    $settings['canManage'] = $canManage;

    return $settings;
}

function invocean_company_seller_settings(PDO $pdo, array $legacyRow): array
{
    try {
        $company = oceanos_company_private_settings($pdo);
    } catch (Throwable) {
        $company = [];
    }

    $postcode = trim((string) ($company['companyPostcode'] ?? ''));
    $city = trim((string) ($company['companyCityName'] ?? ''));
    if ($postcode === '' && $city === '') {
        $city = trim((string) ($company['companyCity'] ?? ''));
    }

    return [
        'sellerName' => trim((string) ($company['companyName'] ?? '')) ?: (string) ($legacyRow['seller_name'] ?? ''),
        'sellerVatNumber' => (string) ($legacyRow['seller_vat_number'] ?? ''),
        'sellerSiret' => trim((string) ($company['companySiret'] ?? '')) ?: (string) ($legacyRow['seller_siret'] ?? ''),
        'sellerStreet' => trim((string) ($company['companyAddress'] ?? '')) ?: (string) ($legacyRow['seller_street'] ?? ''),
        'sellerPostcode' => $postcode !== '' ? $postcode : (string) ($legacyRow['seller_postcode'] ?? ''),
        'sellerCity' => $city !== '' ? $city : (string) ($legacyRow['seller_city'] ?? ''),
        'sellerCountryIso' => strtoupper((string) ($legacyRow['seller_country_iso'] ?? 'FR')) ?: 'FR',
        'companyManagedBy' => 'OceanOS',
    ];
}

function invocean_save_settings(PDO $pdo, array $input): array
{
    $shopUrl = invocean_normalize_shop_url((string) ($input['shopUrl'] ?? ''));
    $pdfUrlTemplate = trim((string) ($input['pdfUrlTemplate'] ?? ''));
    $nautisignApiUrl = rtrim(trim((string) ($input['nautisignApiUrl'] ?? '')), '/');
    $syncWindowDays = max(1, min(365, (int) ($input['syncWindowDays'] ?? 30)));
    $sellerCountryIso = strtoupper(trim((string) ($input['sellerCountryIso'] ?? 'FR')));
    if (!preg_match('/^[A-Z]{2}$/', $sellerCountryIso)) {
        $sellerCountryIso = 'FR';
    }
    $webserviceKey = array_key_exists('webserviceKey', $input) ? trim((string) $input['webserviceKey']) : null;
    $clearKey = !empty($input['clearWebserviceKey']);
    $nautisignApiToken = array_key_exists('nautisignApiToken', $input) ? trim((string) $input['nautisignApiToken']) : null;
    $clearNautisignApiToken = !empty($input['clearNautisignApiToken']);

    if ($shopUrl !== '' && !preg_match('~^https?://~i', $shopUrl)) {
        throw new InvalidArgumentException('URL PrestaShop invalide.');
    }
    if ($pdfUrlTemplate !== '' && !preg_match('~^https?://~i', $pdfUrlTemplate)) {
        throw new InvalidArgumentException('Modele de lien PDF invalide.');
    }
    if ($nautisignApiUrl !== '' && !preg_match('~^https?://~i', $nautisignApiUrl)) {
        throw new InvalidArgumentException('URL API Nautisign invalide.');
    }

    $sharedPrestashopInput = [
        'shopUrl' => $shopUrl,
        'syncWindowDays' => $syncWindowDays,
        'clearWebserviceKey' => $clearKey,
    ];
    if ($webserviceKey !== null && $webserviceKey !== '') {
        $sharedPrestashopInput['webserviceKey'] = $webserviceKey;
    }
    oceanos_save_prestashop_settings($pdo, $sharedPrestashopInput);

    $fields = [
        'shop_url = :shop_url',
        'pdf_url_template = :pdf_url_template',
        'nautisign_api_url = :nautisign_api_url',
        'sync_window_days = :sync_window_days',
        'seller_vat_number = :seller_vat_number',
        'seller_country_iso = :seller_country_iso',
    ];
    $params = [
        'shop_url' => $shopUrl !== '' ? rtrim($shopUrl, '/') : null,
        'pdf_url_template' => $pdfUrlTemplate !== '' ? $pdfUrlTemplate : null,
        'nautisign_api_url' => $nautisignApiUrl !== '' ? $nautisignApiUrl : null,
        'sync_window_days' => $syncWindowDays,
        'seller_vat_number' => strtoupper(str_replace(' ', '', trim((string) ($input['sellerVatNumber'] ?? '')))) ?: null,
        'seller_country_iso' => $sellerCountryIso,
    ];

    if ($webserviceKey !== null && $webserviceKey !== '') {
        $fields[] = 'webservice_key_cipher = :webservice_key_cipher';
        $fields[] = 'webservice_key_hint = :webservice_key_hint';
        $params['webservice_key_cipher'] = invocean_encrypt_secret($webserviceKey);
        $params['webservice_key_hint'] = invocean_key_hint($webserviceKey);
    } elseif ($clearKey) {
        $fields[] = 'webservice_key_cipher = NULL';
        $fields[] = 'webservice_key_hint = NULL';
    }

    if ($nautisignApiToken !== null && $nautisignApiToken !== '') {
        $fields[] = 'nautisign_api_token_cipher = :nautisign_api_token_cipher';
        $fields[] = 'nautisign_api_token_hint = :nautisign_api_token_hint';
        $params['nautisign_api_token_cipher'] = invocean_encrypt_secret($nautisignApiToken);
        $params['nautisign_api_token_hint'] = invocean_key_hint($nautisignApiToken);
    } elseif ($clearNautisignApiToken) {
        $fields[] = 'nautisign_api_token_cipher = NULL';
        $fields[] = 'nautisign_api_token_hint = NULL';
    }

    $statement = $pdo->prepare('UPDATE invocean_settings SET ' . implode(', ', $fields) . ' WHERE id = 1');
    $statement->execute($params);

    return invocean_get_settings($pdo);
}

function invocean_require_prestashop_settings(array $settings): array
{
    $shopUrl = invocean_normalize_shop_url((string) ($settings['shopUrl'] ?? ''));
    $key = trim((string) ($settings['webserviceKey'] ?? ''));

    if ($shopUrl === '' || $key === '') {
        throw new InvalidArgumentException('Configurez l URL PrestaShop et la cle Webservice avant de synchroniser.');
    }

    return [$shopUrl, $key];
}

function invocean_ca_bundle_path(): string
{
    $config = invocean_config();
    $candidates = [
        (string) ($config['ca_bundle'] ?? ''),
        (string) ini_get('curl.cainfo'),
        (string) ini_get('openssl.cafile'),
        'C:\\wamp64\\apps\\phpmyadmin5.2.3\\vendor\\composer\\ca-bundle\\res\\cacert.pem',
        dirname(__DIR__, 2) . '\\apps\\phpmyadmin5.2.3\\vendor\\composer\\ca-bundle\\res\\cacert.pem',
    ];

    foreach ($candidates as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '' && is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    return '';
}

function invocean_extract_prestashop_error(string $body): string
{
    $body = trim($body);
    if ($body === '') {
        return '';
    }

    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($body);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    if ($xml instanceof SimpleXMLElement) {
        $messages = $xml->xpath('//message');
        if (is_array($messages) && isset($messages[0])) {
            $message = trim((string) $messages[0]);
            if ($message !== '') {
                return mb_substr($message, 0, 240);
            }
        }
    }

    $plain = trim(preg_replace('/\s+/', ' ', strip_tags($body)) ?? '');
    return mb_substr($plain, 0, 240);
}

function invocean_prestashop_get(string $shopUrl, string $apiKey, string $resource, array $query = []): string
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('L extension PHP cURL est requise pour appeler PrestaShop.');
    }

    $url = rtrim($shopUrl, '/') . '/api/' . ltrim($resource, '/');
    if ($query !== []) {
        $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $apiKey . ':',
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Accept: application/xml',
            'Output-Format: XML',
        ],
    ];

    $caBundle = invocean_ca_bundle_path();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }

    curl_setopt_array($curl, $options);

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($body === false) {
        if (str_contains($error, 'unable to get local issuer certificate')) {
            throw new RuntimeException('Certificat SSL non verifie par PHP/cURL. Configurez INVOCEAN_CA_BUNDLE avec un fichier cacert.pem lisible.');
        }

        throw new RuntimeException($error !== '' ? $error : 'PrestaShop n a retourne aucune donnee.');
    }
    if ($status >= 400) {
        $details = invocean_extract_prestashop_error((string) $body);
        $message = 'PrestaShop a refuse ' . $resource . ' HTTP ' . $status . '.';
        if ($details !== '') {
            $message .= ' Detail: ' . $details;
        }
        throw new InvoceanPrestashopException($message, $status, $resource);
    }
    if ($body === '') {
        throw new RuntimeException('PrestaShop n a retourne aucune donnee.');
    }

    return (string) $body;
}

function invocean_load_xml(string $body): SimpleXMLElement
{
    $previous = libxml_use_internal_errors(true);
    $xml = simplexml_load_string($body);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    if (!$xml instanceof SimpleXMLElement) {
        throw new RuntimeException('Reponse XML PrestaShop invalide.');
    }

    return $xml;
}

function invocean_xml_text(SimpleXMLElement $node, string $field): string
{
    return isset($node->{$field}) ? trim((string) $node->{$field}) : '';
}

function invocean_xml_to_array(SimpleXMLElement $xml): array|string
{
    $children = $xml->children();
    if ($children->count() === 0) {
        return trim((string) $xml);
    }

    $result = [];
    foreach ($children as $key => $child) {
        $value = invocean_xml_to_array($child);
        if (array_key_exists($key, $result)) {
            if (!is_array($result[$key]) || !array_is_list($result[$key])) {
                $result[$key] = [$result[$key]];
            }
            $result[$key][] = $value;
        } else {
            $result[$key] = $value;
        }
    }

    return $result;
}

function invocean_fetch_resource(string $shopUrl, string $apiKey, string $resource, string $nodeName): array
{
    $xml = invocean_load_xml(invocean_prestashop_get($shopUrl, $apiKey, $resource));
    if (!isset($xml->{$nodeName})) {
        return [];
    }

    $data = invocean_xml_to_array($xml->{$nodeName});
    return is_array($data) ? $data : [];
}

function invocean_fetch_invoice_nodes(string $shopUrl, string $apiKey, ?string $dateFrom, ?string $dateTo, int $limit): array
{
    $dateFrom = $dateFrom !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)
        ? $dateFrom . ' 00:00:00'
        : $dateFrom;
    $dateTo = $dateTo !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)
        ? $dateTo . ' 23:59:59'
        : $dateTo;

    $limitValue = '0,' . max(1, min(250, $limit));
    $fieldList = '[id,id_order,number,date_add,total_paid_tax_excl,total_paid_tax_incl]';
    $query = [
        'display' => $fieldList,
        'sort' => '[date_add_DESC]',
        'limit' => $limitValue,
    ];

    if ($dateFrom !== null && $dateTo !== null) {
        $query['filter[date_add]'] = '[' . $dateFrom . ',' . $dateTo . ']';
    } elseif ($dateFrom !== null) {
        $query['filter[date_add]'] = '[' . $dateFrom . ',]';
    } elseif ($dateTo !== null) {
        $query['filter[date_add]'] = '[,' . $dateTo . ']';
    }
    if (isset($query['filter[date_add]'])) {
        $query['date'] = 1;
    }

    $fallbackQueries = [$query];
    $fullQuery = $query;
    $fullQuery['display'] = 'full';
    $fallbackQueries[] = $fullQuery;

    $noDateQuery = [
        'display' => $fieldList,
        'sort' => '[date_add_DESC]',
        'limit' => $limitValue,
    ];
    $fallbackQueries[] = $noDateQuery;
    $fallbackQueries[] = [
        'display' => $fieldList,
        'limit' => $limitValue,
    ];

    $lastException = null;
    foreach ($fallbackQueries as $fallbackQuery) {
        try {
            $xml = invocean_load_xml(invocean_prestashop_get($shopUrl, $apiKey, 'order_invoices', $fallbackQuery));
            if (!isset($xml->order_invoices->order_invoice)) {
                return [];
            }

            $nodes = [];
            foreach ($xml->order_invoices->order_invoice as $node) {
                $nodes[] = $node;
            }

            return $nodes;
        } catch (InvoceanPrestashopException $exception) {
            $lastException = $exception;
            if (!in_array($exception->statusCode, [400, 500], true)) {
                throw $exception;
            }
        }
    }

    if ($lastException !== null) {
        throw new RuntimeException($lastException->getMessage() . ' La requete a aussi echoue en mode simplifie.');
    }

    throw new RuntimeException('Impossible de lire les factures PrestaShop.');
}

function invocean_money(string $value): string
{
    $normalized = str_replace(',', '.', trim($value));
    if ($normalized === '' || !is_numeric($normalized)) {
        return '0';
    }

    return number_format((float) $normalized, 6, '.', '');
}

function invocean_date_only(string $value): ?string
{
    $value = trim($value);
    if ($value === '' || $value === '0000-00-00 00:00:00' || $value === '0000-00-00') {
        return null;
    }

    try {
        return (new DateTimeImmutable($value))->format('Y-m-d');
    } catch (Throwable) {
        return null;
    }
}

function invocean_build_pdf_url(string $template, array $data): string
{
    $template = trim($template);
    if ($template === '') {
        return '';
    }

    return strtr($template, [
        '{order_id}' => (string) ($data['orderId'] ?? ''),
        '{invoice_id}' => (string) ($data['prestashopInvoiceId'] ?? ''),
        '{invoice_number}' => rawurlencode((string) ($data['invoiceNumber'] ?? '')),
        '{order_reference}' => rawurlencode((string) ($data['orderReference'] ?? '')),
    ]);
}

function invocean_normalize_remote_invoice(SimpleXMLElement $invoiceNode, string $shopUrl, string $apiKey, string $pdfTemplate, array &$cache): array
{
    $invoiceId = (int) invocean_xml_text($invoiceNode, 'id');
    $orderId = (int) invocean_xml_text($invoiceNode, 'id_order');
    if ($invoiceId <= 0 || $orderId <= 0) {
        throw new RuntimeException('Facture PrestaShop invalide.');
    }

    $order = $cache['orders'][$orderId] ?? null;
    if ($order === null) {
        $order = invocean_fetch_resource($shopUrl, $apiKey, 'orders/' . $orderId, 'order');
        $cache['orders'][$orderId] = $order;
    }

    $customerId = (int) ($order['id_customer'] ?? 0);
    $addressId = (int) ($order['id_address_invoice'] ?? 0);
    $currencyId = (int) ($order['id_currency'] ?? 0);

    $customer = [];
    if ($customerId > 0) {
        $customer = $cache['customers'][$customerId] ?? null;
        if ($customer === null) {
            $customer = invocean_fetch_resource($shopUrl, $apiKey, 'customers/' . $customerId, 'customer');
            $cache['customers'][$customerId] = $customer;
        }
    }

    $address = [];
    if ($addressId > 0) {
        $address = $cache['addresses'][$addressId] ?? null;
        if ($address === null) {
            $address = invocean_fetch_resource($shopUrl, $apiKey, 'addresses/' . $addressId, 'address');
            $cache['addresses'][$addressId] = $address;
        }
    }

    $currency = [];
    if ($currencyId > 0) {
        $currency = $cache['currencies'][$currencyId] ?? null;
        if ($currency === null) {
            $currency = invocean_fetch_resource($shopUrl, $apiKey, 'currencies/' . $currencyId, 'currency');
            $cache['currencies'][$currencyId] = $currency;
        }
    }

    $countryId = (int) ($address['id_country'] ?? 0);
    $country = [];
    if ($countryId > 0) {
        $country = $cache['countries'][$countryId] ?? null;
        if ($country === null) {
            $country = invocean_fetch_resource($shopUrl, $apiKey, 'countries/' . $countryId, 'country');
            $cache['countries'][$countryId] = $country;
        }
    }

    $invoiceNumber = invocean_xml_text($invoiceNode, 'number');
    if ($invoiceNumber === '' || $invoiceNumber === '0') {
        $invoiceNumber = 'PS-' . $invoiceId;
    }

    $customerName = trim(implode(' ', array_filter([
        (string) ($address['firstname'] ?? $customer['firstname'] ?? ''),
        (string) ($address['lastname'] ?? $customer['lastname'] ?? ''),
    ])));

    $payload = [
        'prestashopInvoiceId' => $invoiceId,
        'orderId' => $orderId,
        'invoiceNumber' => $invoiceNumber,
        'invoiceDate' => invocean_date_only(invocean_xml_text($invoiceNode, 'date_add')),
        'orderReference' => (string) ($order['reference'] ?? ''),
        'customerName' => $customerName,
        'customerEmail' => (string) ($customer['email'] ?? ''),
        'customerCompany' => (string) ($address['company'] ?? ''),
        'vatNumber' => (string) ($address['vat_number'] ?? ''),
        'currencyIso' => (string) ($currency['iso_code'] ?? ''),
        'totalTaxExcl' => invocean_money(invocean_xml_text($invoiceNode, 'total_paid_tax_excl') ?: (string) ($order['total_paid_tax_excl'] ?? '0')),
        'totalTaxIncl' => invocean_money(invocean_xml_text($invoiceNode, 'total_paid_tax_incl') ?: (string) ($order['total_paid_tax_incl'] ?? '0')),
        'channel' => 'prestashop',
        'eInvoiceFormat' => 'pdf',
        'raw' => [
            'invoice' => invocean_xml_to_array($invoiceNode),
            'order' => $order,
            'customer' => $customer,
            'address' => $address,
            'currency' => $currency,
            'country' => $country,
        ],
    ];
    $payload['pdfUrl'] = invocean_build_pdf_url($pdfTemplate, $payload);
    $payload['sourceHash'] = hash('sha256', json_encode($payload['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    return $payload;
}

function invocean_storage_dir(): string
{
    $root = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    $dir = $root . DIRECTORY_SEPARATOR . 'facturx';

    if (!is_dir($root) && !mkdir($root, 0775, true) && !is_dir($root)) {
        throw new RuntimeException('Impossible de creer le dossier de stockage Invocean.');
    }
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de creer le dossier Factur-X.');
    }

    return $dir;
}

function invocean_pdf_storage_dir(): string
{
    $root = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    $dir = $root . DIRECTORY_SEPARATOR . 'pdf';

    if (!is_dir($root) && !mkdir($root, 0775, true) && !is_dir($root)) {
        throw new RuntimeException('Impossible de creer le dossier de stockage Invocean.');
    }
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de creer le dossier PDF.');
    }

    return $dir;
}

function invocean_safe_filename(string $value, string $fallback): string
{
    $value = trim($value);
    if ($value === '') {
        $value = $fallback;
    }

    $value = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $value) ?? $fallback;
    $value = trim($value, '.-');

    return $value !== '' ? $value : $fallback;
}

function invocean_facturx_filename(array $row): string
{
    $number = (string) ($row['invoice_number'] ?? '');
    $id = (int) ($row['prestashop_invoice_id'] ?? $row['id'] ?? 0);

    return invocean_safe_filename($number, 'facture-' . $id) . '-factur-x.pdf';
}

function invocean_facturx_xml_filename(array $row): string
{
    $number = (string) ($row['invoice_number'] ?? '');
    $id = (int) ($row['prestashop_invoice_id'] ?? $row['id'] ?? 0);

    return invocean_safe_filename($number, 'facture-' . $id) . '-factur-x.xml';
}

function invocean_pdf_filename(array $row): string
{
    $number = (string) ($row['invoice_number'] ?? '');
    $id = (int) ($row['prestashop_invoice_id'] ?? $row['id'] ?? 0);

    return invocean_safe_filename($number, 'facture-' . $id) . '.pdf';
}

function invocean_build_pdf_url_from_row(string $template, array $row): string
{
    $template = trim($template);
    if ($template === '') {
        return '';
    }

    return strtr($template, [
        '{order_id}' => (string) ($row['order_id'] ?? ''),
        '{invoice_id}' => (string) ($row['prestashop_invoice_id'] ?? ''),
        '{invoice_number}' => rawurlencode((string) ($row['invoice_number'] ?? '')),
        '{order_reference}' => rawurlencode((string) ($row['order_reference'] ?? '')),
    ]);
}

function invocean_download_remote_pdf(string $url, string $apiKey = ''): string
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('L extension PHP cURL est requise pour recuperer les PDFs.');
    }

    $url = trim($url);
    if ($url === '' || !preg_match('~^https?://~i', $url)) {
        throw new InvalidArgumentException('Lien PDF invalide.');
    }

    $attempts = [false];
    if (trim($apiKey) !== '') {
        $attempts[] = true;
    }

    $lastMessage = '';
    foreach ($attempts as $useBasicAuth) {
        $curl = curl_init($url);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 4,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => ['Accept: application/pdf,*/*'],
        ];
        if ($useBasicAuth) {
            $options[CURLOPT_USERPWD] = $apiKey . ':';
            $options[CURLOPT_HTTPAUTH] = CURLAUTH_BASIC;
        }
        $caBundle = invocean_ca_bundle_path();
        if ($caBundle !== '') {
            $options[CURLOPT_CAINFO] = $caBundle;
        }
        curl_setopt_array($curl, $options);

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($body === false) {
            $lastMessage = $error !== '' ? $error : 'telechargement impossible';
            continue;
        }

        if ($status >= 400) {
            $lastMessage = 'HTTP ' . $status;
            continue;
        }

        $body = (string) $body;
        if (strncmp($body, '%PDF-', 5) !== 0) {
            $snippet = mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags($body)) ?? ''), 0, 180);
            $lastMessage = $snippet !== '' ? 'reponse non PDF: ' . $snippet : 'reponse non PDF (' . $contentType . ')';
            continue;
        }

        return $body;
    }

    throw new RuntimeException('PDF PrestaShop non recuperable: ' . ($lastMessage ?: 'reponse invalide') . '.');
}

function invocean_xml_add(DOMDocument $doc, DOMElement $parent, string $namespace, string $name, ?string $text = null, array $attributes = []): DOMElement
{
    $element = $doc->createElementNS($namespace, $name);
    foreach ($attributes as $attribute => $value) {
        $element->setAttribute((string) $attribute, (string) $value);
    }
    if ($text !== null) {
        $element->appendChild($doc->createTextNode($text));
    }
    $parent->appendChild($element);

    return $element;
}

function invocean_facturx_amount(float|int|string $value): string
{
    return number_format((float) $value, 2, '.', '');
}

function invocean_facturx_date(string $value): string
{
    try {
        return (new DateTimeImmutable($value))->format('Ymd');
    } catch (Throwable) {
        return (new DateTimeImmutable())->format('Ymd');
    }
}

function invocean_invoice_raw(array $row): array
{
    $raw = json_decode((string) ($row['raw_json'] ?? ''), true);
    return is_array($raw) ? $raw : [];
}

function invocean_row_text(array $data, string $key): string
{
    return trim((string) ($data[$key] ?? ''));
}

function invocean_invoice_country_iso(array $raw): string
{
    $country = $raw['country'] ?? [];
    if (is_array($country)) {
        $iso = strtoupper(trim((string) ($country['iso_code'] ?? '')));
        if (preg_match('/^[A-Z]{2}$/', $iso)) {
            return $iso;
        }
    }

    return 'FR';
}

function invocean_display_invoice_number(array $row): string
{
    $number = trim((string) ($row['invoice_number'] ?? ''));
    if ($number === '' || $number === '0') {
        $number = (string) ($row['prestashop_invoice_id'] ?? $row['id'] ?? '');
    }

    if (preg_match('/^\d+$/', $number)) {
        return '#' . str_pad($number, 7, '0', STR_PAD_LEFT);
    }

    return str_starts_with($number, '#') ? $number : $number;
}

function invocean_facturx_decimal(float|int|string $value, int $decimals = 4): string
{
    $formatted = number_format((float) $value, $decimals, '.', '');
    $formatted = rtrim(rtrim($formatted, '0'), '.');

    return $formatted !== '' ? $formatted : '0';
}

function invocean_facturx_tax_info(float|int|string $amountExcl, float|int|string $amountIncl): array
{
    $excl = (float) $amountExcl;
    $incl = (float) $amountIncl;
    $tax = $incl - $excl;
    if (abs($tax) <= 0.004 || abs($excl) <= 0.004) {
        return [
            'category' => 'Z',
            'rate' => 0.0,
        ];
    }

    return [
        'category' => 'S',
        'rate' => round(($tax / $excl) * 100, 2),
    ];
}

function invocean_facturx_tax_key(string $category, float $rate): string
{
    return $category . '|' . number_format($rate, 2, '.', '');
}

function invocean_facturx_add_tax_group(array &$groups, float $basis, float $tax, string $category, float $rate): void
{
    if (abs($basis) <= 0.004 && abs($tax) <= 0.004) {
        return;
    }

    $key = invocean_facturx_tax_key($category, $rate);
    if (!isset($groups[$key])) {
        $groups[$key] = [
            'basis' => 0.0,
            'tax' => 0.0,
            'category' => $category,
            'rate' => $rate,
        ];
    }
    $groups[$key]['basis'] += $basis;
    $groups[$key]['tax'] += $tax;
}

function invocean_facturx_add_trade_tax(DOMDocument $doc, DOMElement $parent, string $nsRam, string $category, float $rate, ?float $basis = null, ?float $calculated = null): DOMElement
{
    $tax = invocean_xml_add($doc, $parent, $nsRam, 'ram:ApplicableTradeTax');
    if ($calculated !== null) {
        invocean_xml_add($doc, $tax, $nsRam, 'ram:CalculatedAmount', invocean_facturx_amount($calculated));
    }
    invocean_xml_add($doc, $tax, $nsRam, 'ram:TypeCode', 'VAT');
    if ($basis !== null) {
        invocean_xml_add($doc, $tax, $nsRam, 'ram:BasisAmount', invocean_facturx_amount($basis));
    }
    invocean_xml_add($doc, $tax, $nsRam, 'ram:CategoryCode', $category);
    invocean_xml_add($doc, $tax, $nsRam, 'ram:RateApplicablePercent', invocean_facturx_decimal($rate, 2));

    return $tax;
}

function invocean_facturx_add_indicator(DOMDocument $doc, DOMElement $parent, string $nsUdt, bool $value): void
{
    $indicator = invocean_xml_add($doc, $parent, $nsUdt, 'udt:Indicator');
    $indicator->nodeValue = $value ? 'true' : 'false';
}

function invocean_facturx_add_allowance_charge(DOMDocument $doc, DOMElement $parent, string $nsRam, string $nsUdt, bool $charge, float $amount, string $reason, string $category, float $rate): void
{
    if ($amount <= 0.004) {
        return;
    }

    $node = invocean_xml_add($doc, $parent, $nsRam, 'ram:SpecifiedTradeAllowanceCharge');
    $chargeIndicator = invocean_xml_add($doc, $node, $nsRam, 'ram:ChargeIndicator');
    invocean_facturx_add_indicator($doc, $chargeIndicator, $nsUdt, $charge);
    invocean_xml_add($doc, $node, $nsRam, 'ram:ActualAmount', invocean_facturx_amount($amount));
    invocean_xml_add($doc, $node, $nsRam, 'ram:Reason', $reason);
    $tax = invocean_xml_add($doc, $node, $nsRam, 'ram:CategoryTradeTax');
    invocean_xml_add($doc, $tax, $nsRam, 'ram:TypeCode', 'VAT');
    invocean_xml_add($doc, $tax, $nsRam, 'ram:CategoryCode', $category);
    invocean_xml_add($doc, $tax, $nsRam, 'ram:RateApplicablePercent', invocean_facturx_decimal($rate, 2));
}

function invocean_facturx_add_line_item(DOMDocument $doc, DOMElement $transaction, string $nsRam, int $lineId, array $item, string $orderReference): array
{
    $quantity = max(0.0001, (float) ($item['quantity'] ?? 1));
    $unitExcl = (float) ($item['unitExcl'] ?? 0);
    $unitIncl = (float) ($item['unitIncl'] ?? $unitExcl);
    $totalExcl = round((float) ($item['totalExcl'] ?? ($unitExcl * $quantity)), 2);
    $totalIncl = round((float) ($item['totalIncl'] ?? ($unitIncl * $quantity)), 2);
    $taxInfo = invocean_facturx_tax_info($totalExcl, $totalIncl);

    $line = invocean_xml_add($doc, $transaction, $nsRam, 'ram:IncludedSupplyChainTradeLineItem');
    $document = invocean_xml_add($doc, $line, $nsRam, 'ram:AssociatedDocumentLineDocument');
    invocean_xml_add($doc, $document, $nsRam, 'ram:LineID', (string) $lineId);

    $product = invocean_xml_add($doc, $line, $nsRam, 'ram:SpecifiedTradeProduct');
    if (trim((string) ($item['reference'] ?? '')) !== '') {
        invocean_xml_add($doc, $product, $nsRam, 'ram:SellerAssignedID', trim((string) $item['reference']));
    }
    invocean_xml_add($doc, $product, $nsRam, 'ram:Name', trim((string) ($item['label'] ?? 'Produit')) ?: 'Produit');

    $agreement = invocean_xml_add($doc, $line, $nsRam, 'ram:SpecifiedLineTradeAgreement');
    if ($orderReference !== '') {
        $buyerOrder = invocean_xml_add($doc, $agreement, $nsRam, 'ram:BuyerOrderReferencedDocument');
        invocean_xml_add($doc, $buyerOrder, $nsRam, 'ram:LineID', (string) $lineId);
    }
    $netPrice = invocean_xml_add($doc, $agreement, $nsRam, 'ram:NetPriceProductTradePrice');
    invocean_xml_add($doc, $netPrice, $nsRam, 'ram:ChargeAmount', invocean_facturx_decimal($unitExcl, 4));
    invocean_xml_add($doc, $netPrice, $nsRam, 'ram:BasisQuantity', '1', ['unitCode' => 'C62']);

    $delivery = invocean_xml_add($doc, $line, $nsRam, 'ram:SpecifiedLineTradeDelivery');
    invocean_xml_add($doc, $delivery, $nsRam, 'ram:BilledQuantity', invocean_facturx_decimal($quantity), ['unitCode' => 'C62']);

    $settlement = invocean_xml_add($doc, $line, $nsRam, 'ram:SpecifiedLineTradeSettlement');
    invocean_facturx_add_trade_tax($doc, $settlement, $nsRam, $taxInfo['category'], $taxInfo['rate']);
    $summation = invocean_xml_add($doc, $settlement, $nsRam, 'ram:SpecifiedTradeSettlementLineMonetarySummation');
    invocean_xml_add($doc, $summation, $nsRam, 'ram:LineTotalAmount', invocean_facturx_amount($totalExcl));

    return [
        'basis' => $totalExcl,
        'tax' => $totalIncl - $totalExcl,
        'category' => $taxInfo['category'],
        'rate' => $taxInfo['rate'],
    ];
}

function invocean_generate_facturx_xml(array $row, array $settings): string
{
    $raw = invocean_invoice_raw($row);
    $address = is_array($raw['address'] ?? null) ? $raw['address'] : [];
    $customer = is_array($raw['customer'] ?? null) ? $raw['customer'] : [];
    $order = is_array($raw['order'] ?? null) ? $raw['order'] : [];

    $currency = strtoupper(trim((string) ($row['currency_iso'] ?? ''))) ?: 'EUR';
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        $currency = 'EUR';
    }

    $invoiceNumber = invocean_display_invoice_number($row);
    $invoiceDate = (string) ($row['invoice_date'] ?? '');
    $sellerName = trim((string) ($settings['sellerName'] ?? ''));
    if ($sellerName === '') {
        $host = parse_url((string) ($settings['shopUrl'] ?? ''), PHP_URL_HOST);
        $sellerName = $host ? (string) $host : 'Vendeur PrestaShop';
    }

    $sellerCountry = strtoupper(trim((string) ($settings['sellerCountryIso'] ?? 'FR')));
    if (!preg_match('/^[A-Z]{2}$/', $sellerCountry)) {
        $sellerCountry = 'FR';
    }

    $buyerName = trim((string) ($row['customer_company'] ?? ''));
    if ($buyerName === '') {
        $buyerName = trim((string) ($row['customer_name'] ?? ''));
    }
    if ($buyerName === '') {
        $buyerName = trim((string) ($row['customer_email'] ?? 'Client ' . (((string) ($row['channel'] ?? 'prestashop')) === 'nautisign' ? 'Nautisign' : 'PrestaShop')));
    }

    $buyerStreet = trim(implode(' ', array_filter([
        invocean_row_text($address, 'address1'),
        invocean_row_text($address, 'address2'),
    ])));
    $buyerPostcode = invocean_row_text($address, 'postcode');
    $buyerCity = invocean_row_text($address, 'city');
    $buyerCountry = invocean_invoice_country_iso($raw);

    $totalExcl = round((float) ($row['total_tax_excl'] ?? 0), 2);
    $totalIncl = round((float) ($row['total_tax_incl'] ?? 0), 2);
    $taxAmount = round(max(0.0, $totalIncl - $totalExcl), 2);
    $profile = 'urn:factur-x.eu:1p0:en16931';
    $productLines = invocean_invoice_product_line_items($row);
    $orderReference = trim((string) ($row['order_reference'] ?? $order['reference'] ?? ''));
    $shippingExcl = round((float) ($order['total_shipping_tax_excl'] ?? 0), 2);
    $shippingIncl = round((float) ($order['total_shipping_tax_incl'] ?? 0), 2);
    $discountExcl = round((float) ($order['total_discounts_tax_excl'] ?? 0), 2);
    $discountIncl = round((float) ($order['total_discounts_tax_incl'] ?? 0), 2);
    $shippingTax = invocean_facturx_tax_info($shippingExcl, $shippingIncl);
    $discountTax = invocean_facturx_tax_info($discountExcl, $discountIncl);
    $taxGroups = [];
    $lineTotalExcl = 0.0;

    $doc = new DOMDocument('1.0', 'UTF-8');
    $doc->formatOutput = true;

    $nsRsm = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100';
    $nsRam = 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100';
    $nsUdt = 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100';
    $nsQdt = 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100';

    $root = $doc->createElementNS($nsRsm, 'rsm:CrossIndustryInvoice');
    $root->setAttribute('xmlns:qdt', $nsQdt);
    $root->setAttribute('xmlns:ram', $nsRam);
    $root->setAttribute('xmlns:udt', $nsUdt);
    $doc->appendChild($root);

    $context = invocean_xml_add($doc, $root, $nsRsm, 'rsm:ExchangedDocumentContext');
    $guideline = invocean_xml_add($doc, $context, $nsRam, 'ram:GuidelineSpecifiedDocumentContextParameter');
    invocean_xml_add($doc, $guideline, $nsRam, 'ram:ID', $profile);

    $document = invocean_xml_add($doc, $root, $nsRsm, 'rsm:ExchangedDocument');
    invocean_xml_add($doc, $document, $nsRam, 'ram:ID', $invoiceNumber);
    invocean_xml_add($doc, $document, $nsRam, 'ram:TypeCode', '380');
    $issueDate = invocean_xml_add($doc, $document, $nsRam, 'ram:IssueDateTime');
    invocean_xml_add($doc, $issueDate, $nsUdt, 'udt:DateTimeString', invocean_facturx_date($invoiceDate), ['format' => '102']);

    $transaction = invocean_xml_add($doc, $root, $nsRsm, 'rsm:SupplyChainTradeTransaction');
    foreach ($productLines as $lineIndex => $item) {
        $lineTax = invocean_facturx_add_line_item($doc, $transaction, $nsRam, $lineIndex + 1, $item, $orderReference);
        $lineTotalExcl += $lineTax['basis'];
        invocean_facturx_add_tax_group($taxGroups, $lineTax['basis'], $lineTax['tax'], $lineTax['category'], $lineTax['rate']);
    }
    if ($shippingExcl > 0.004 || $shippingIncl > 0.004) {
        invocean_facturx_add_tax_group($taxGroups, $shippingExcl, $shippingIncl - $shippingExcl, $shippingTax['category'], $shippingTax['rate']);
    }
    if ($discountExcl > 0.004 || $discountIncl > 0.004) {
        invocean_facturx_add_tax_group($taxGroups, -$discountExcl, -($discountIncl - $discountExcl), $discountTax['category'], $discountTax['rate']);
    }
    if ($taxGroups === []) {
        $fallbackTax = invocean_facturx_tax_info($totalExcl, $totalIncl);
        invocean_facturx_add_tax_group($taxGroups, $totalExcl, $taxAmount, $fallbackTax['category'], $fallbackTax['rate']);
    }

    $agreement = invocean_xml_add($doc, $transaction, $nsRam, 'ram:ApplicableHeaderTradeAgreement');
    if ($orderReference !== '') {
        invocean_xml_add($doc, $agreement, $nsRam, 'ram:BuyerReference', $orderReference);
    }

    $seller = invocean_xml_add($doc, $agreement, $nsRam, 'ram:SellerTradeParty');
    invocean_xml_add($doc, $seller, $nsRam, 'ram:Name', $sellerName);
    $sellerSiret = preg_replace('/\D+/', '', (string) ($settings['sellerSiret'] ?? ''));
    if ($sellerSiret !== '') {
        $legal = invocean_xml_add($doc, $seller, $nsRam, 'ram:SpecifiedLegalOrganization');
        invocean_xml_add($doc, $legal, $nsRam, 'ram:ID', $sellerSiret, ['schemeID' => '0002']);
    }
    $sellerAddress = invocean_xml_add($doc, $seller, $nsRam, 'ram:PostalTradeAddress');
    if (trim((string) ($settings['sellerPostcode'] ?? '')) !== '') {
        invocean_xml_add($doc, $sellerAddress, $nsRam, 'ram:PostcodeCode', trim((string) $settings['sellerPostcode']));
    }
    if (trim((string) ($settings['sellerStreet'] ?? '')) !== '') {
        invocean_xml_add($doc, $sellerAddress, $nsRam, 'ram:LineOne', trim((string) $settings['sellerStreet']));
    }
    if (trim((string) ($settings['sellerCity'] ?? '')) !== '') {
        invocean_xml_add($doc, $sellerAddress, $nsRam, 'ram:CityName', trim((string) $settings['sellerCity']));
    }
    invocean_xml_add($doc, $sellerAddress, $nsRam, 'ram:CountryID', $sellerCountry);
    $sellerVat = strtoupper(str_replace(' ', '', (string) ($settings['sellerVatNumber'] ?? '')));
    if ($sellerVat !== '') {
        $sellerTax = invocean_xml_add($doc, $seller, $nsRam, 'ram:SpecifiedTaxRegistration');
        invocean_xml_add($doc, $sellerTax, $nsRam, 'ram:ID', $sellerVat, ['schemeID' => 'VA']);
    }

    $buyer = invocean_xml_add($doc, $agreement, $nsRam, 'ram:BuyerTradeParty');
    invocean_xml_add($doc, $buyer, $nsRam, 'ram:Name', $buyerName);
    $buyerAddress = invocean_xml_add($doc, $buyer, $nsRam, 'ram:PostalTradeAddress');
    if ($buyerPostcode !== '') {
        invocean_xml_add($doc, $buyerAddress, $nsRam, 'ram:PostcodeCode', $buyerPostcode);
    }
    if ($buyerStreet !== '') {
        invocean_xml_add($doc, $buyerAddress, $nsRam, 'ram:LineOne', $buyerStreet);
    }
    if ($buyerCity !== '') {
        invocean_xml_add($doc, $buyerAddress, $nsRam, 'ram:CityName', $buyerCity);
    }
    invocean_xml_add($doc, $buyerAddress, $nsRam, 'ram:CountryID', $buyerCountry);
    if (trim((string) ($row['customer_email'] ?? '')) !== '') {
        $email = invocean_xml_add($doc, $buyer, $nsRam, 'ram:URIUniversalCommunication');
        invocean_xml_add($doc, $email, $nsRam, 'ram:URIID', (string) $row['customer_email'], ['schemeID' => 'EM']);
    }
    $buyerVat = strtoupper(str_replace(' ', '', (string) ($row['vat_number'] ?? '')));
    if ($buyerVat !== '') {
        $buyerTax = invocean_xml_add($doc, $buyer, $nsRam, 'ram:SpecifiedTaxRegistration');
        invocean_xml_add($doc, $buyerTax, $nsRam, 'ram:ID', $buyerVat, ['schemeID' => 'VA']);
    }
    if ($orderReference !== '') {
        $buyerOrder = invocean_xml_add($doc, $agreement, $nsRam, 'ram:BuyerOrderReferencedDocument');
        invocean_xml_add($doc, $buyerOrder, $nsRam, 'ram:IssuerAssignedID', $orderReference);
    }

    $delivery = invocean_xml_add($doc, $transaction, $nsRam, 'ram:ApplicableHeaderTradeDelivery');
    $deliveryEvent = invocean_xml_add($doc, $delivery, $nsRam, 'ram:ActualDeliverySupplyChainEvent');
    $deliveryDate = invocean_xml_add($doc, $deliveryEvent, $nsRam, 'ram:OccurrenceDateTime');
    invocean_xml_add($doc, $deliveryDate, $nsUdt, 'udt:DateTimeString', invocean_facturx_date($invoiceDate), ['format' => '102']);

    $settlement = invocean_xml_add($doc, $transaction, $nsRam, 'ram:ApplicableHeaderTradeSettlement');
    invocean_xml_add($doc, $settlement, $nsRam, 'ram:PaymentReference', $invoiceNumber);
    invocean_xml_add($doc, $settlement, $nsRam, 'ram:InvoiceCurrencyCode', $currency);

    foreach ($taxGroups as $group) {
        invocean_facturx_add_trade_tax(
            $doc,
            $settlement,
            $nsRam,
            (string) $group['category'],
            (float) $group['rate'],
            round((float) $group['basis'], 2),
            round((float) $group['tax'], 2)
        );
    }
    invocean_facturx_add_allowance_charge($doc, $settlement, $nsRam, $nsUdt, true, $shippingExcl, 'Frais de port', $shippingTax['category'], $shippingTax['rate']);
    invocean_facturx_add_allowance_charge($doc, $settlement, $nsRam, $nsUdt, false, $discountExcl, 'Remise', $discountTax['category'], $discountTax['rate']);
    $terms = invocean_xml_add($doc, $settlement, $nsRam, 'ram:SpecifiedTradePaymentTerms');
    invocean_xml_add($doc, $terms, $nsRam, 'ram:Description', 'Paiement selon les conditions de vente');

    $summation = invocean_xml_add($doc, $settlement, $nsRam, 'ram:SpecifiedTradeSettlementHeaderMonetarySummation');
    invocean_xml_add($doc, $summation, $nsRam, 'ram:LineTotalAmount', invocean_facturx_amount($lineTotalExcl));
    if ($shippingExcl > 0.004) {
        invocean_xml_add($doc, $summation, $nsRam, 'ram:ChargeTotalAmount', invocean_facturx_amount($shippingExcl));
    }
    if ($discountExcl > 0.004) {
        invocean_xml_add($doc, $summation, $nsRam, 'ram:AllowanceTotalAmount', invocean_facturx_amount($discountExcl));
    }
    invocean_xml_add($doc, $summation, $nsRam, 'ram:TaxBasisTotalAmount', invocean_facturx_amount($totalExcl));
    invocean_xml_add($doc, $summation, $nsRam, 'ram:TaxTotalAmount', invocean_facturx_amount($taxAmount), ['currencyID' => $currency]);
    invocean_xml_add($doc, $summation, $nsRam, 'ram:GrandTotalAmount', invocean_facturx_amount($totalIncl));
    invocean_xml_add($doc, $summation, $nsRam, 'ram:DuePayableAmount', invocean_facturx_amount($totalIncl));

    return $doc->saveXML() ?: '';
}

function invocean_pdf_literal(string $value): string
{
    if (function_exists('mb_convert_encoding')) {
        $converted = @mb_convert_encoding($value, 'Windows-1252', 'UTF-8');
        if (is_string($converted) && $converted !== '') {
            $value = $converted;
        }
    }
    $value = str_replace(["\\", "(", ")", "\r"], ["\\\\", "\\(", "\\)", ""], $value);
    $value = str_replace("\n", " ", $value);

    return '(' . $value . ')';
}

function invocean_pdf_name(string $value): string
{
    return str_replace(['#', '/', ' '], ['#23', '#2F', '#20'], $value);
}

function invocean_pdf_date(): string
{
    $offset = date('O');
    $offset = substr($offset, 0, 3) . "'" . substr($offset, 3, 2) . "'";

    return 'D:' . date('YmdHis') . $offset;
}

function invocean_facturx_xmp(string $xmlFilename, string $profile): string
{
    $escapedFilename = htmlspecialchars($xmlFilename, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $escapedProfile = htmlspecialchars($profile, ENT_XML1 | ENT_QUOTES, 'UTF-8');

    return '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>' . "\n"
        . '<x:xmpmeta xmlns:x="adobe:ns:meta/">' . "\n"
        . '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' . "\n"
        . '    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" pdfaid:part="3" pdfaid:conformance="B"/>' . "\n"
        . '    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"'
        . ' fx:DocumentType="INVOICE"'
        . ' fx:DocumentFileName="' . $escapedFilename . '"'
        . ' fx:Version="1.0"'
        . ' fx:ConformanceLevel="' . $escapedProfile . '"/>' . "\n"
        . '  </rdf:RDF>' . "\n"
        . '</x:xmpmeta>' . "\n"
        . '<?xpacket end="w"?>';
}

function invocean_facturx_pdf_content_stream(array $row, array $settings): string
{
    return invocean_invoice_pdf_content_stream($row, $settings, true);
}

function invocean_pdf_text(float $x, float $y, string $text, int $size = 10, string $font = 'F1'): string
{
    return "BT /" . $font . ' ' . $size . ' Tf 1 0 0 1 ' . number_format($x, 2, '.', '') . ' ' . number_format($y, 2, '.', '') . ' Tm ' . invocean_pdf_literal($text) . " Tj ET\n";
}

function invocean_pdf_line(float $x1, float $y1, float $x2, float $y2): string
{
    return number_format($x1, 2, '.', '') . ' ' . number_format($y1, 2, '.', '') . ' m ' . number_format($x2, 2, '.', '') . ' ' . number_format($y2, 2, '.', '') . " l S\n";
}

function invocean_pdf_rect(float $x, float $y, float $w, float $h, bool $fill = false): string
{
    return number_format($x, 2, '.', '') . ' ' . number_format($y, 2, '.', '') . ' ' . number_format($w, 2, '.', '') . ' ' . number_format($h, 2, '.', '') . ' re ' . ($fill ? "f\n" : "S\n");
}

function invocean_pdf_fit(string $text, int $maxChars): string
{
    $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');
    if (mb_strlen($text) <= $maxChars) {
        return $text;
    }

    return mb_substr($text, 0, max(1, $maxChars - 1)) . '…';
}

function invocean_pdf_money(float|int|string $value, string $currency): string
{
    return number_format((float) $value, 2, ',', ' ') . ' ' . $currency;
}

function invocean_fpdf_text(string|int|float|null $value): string
{
    $text = trim(preg_replace('/\s+/', ' ', (string) $value) ?? '');
    if ($text === '') {
        return '';
    }

    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        if (is_string($converted) && $converted !== '') {
            return $converted;
        }
    }

    return $text;
}

function invocean_logo_path(): string
{
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'renovboat-logo-pdf.jpg';
    if (is_file($path)) {
        return $path;
    }

    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'renovboat-logo.png';

    return is_file($path) ? $path : '';
}

function invocean_invoice_display_date(string $value): string
{
    try {
        return (new DateTimeImmutable($value))->format('d/m/Y');
    } catch (Throwable) {
        return $value;
    }
}

function invocean_status_label(string $status): string
{
    return match ($status) {
        'ready' => 'A traiter',
        'sent' => 'Envoyee',
        'accepted' => 'Acceptee',
        'rejected' => 'Rejetee',
        'archived' => 'Archivee',
        default => 'Recue',
    };
}

function invocean_invoice_product_line_items(array $row): array
{
    $raw = invocean_invoice_raw($row);
    $order = is_array($raw['order'] ?? null) ? $raw['order'] : [];
    $rows = $order['associations']['order_rows']['order_row'] ?? [];
    if (is_array($rows) && isset($rows['product_id'])) {
        $rows = [$rows];
    }
    if (!is_array($rows)) {
        $rows = [];
    }

    $currency = (string) ($row['currency_iso'] ?? 'EUR') ?: 'EUR';
    $items = [];
    foreach ($rows as $orderRow) {
        if (!is_array($orderRow)) {
            continue;
        }
        $quantity = (float) ($orderRow['product_quantity'] ?? 1);
        $unitExcl = (float) ($orderRow['unit_price_tax_excl'] ?? $orderRow['product_price'] ?? 0);
        $unitIncl = (float) ($orderRow['unit_price_tax_incl'] ?? 0);
        $items[] = [
            'label' => (string) ($orderRow['product_name'] ?? 'Produit'),
            'reference' => (string) ($orderRow['product_reference'] ?? ''),
            'quantity' => $quantity,
            'unitExcl' => $unitExcl,
            'unitIncl' => $unitIncl > 0 ? $unitIncl : $unitExcl,
            'totalExcl' => $unitExcl * $quantity,
            'totalIncl' => ($unitIncl > 0 ? $unitIncl : $unitExcl) * $quantity,
            'currency' => $currency,
        ];
    }

    if ($items === []) {
        $items[] = [
            'label' => 'Commande ' . (string) ($row['order_reference'] ?? $row['order_id'] ?? ''),
            'reference' => '',
            'quantity' => 1,
            'unitExcl' => (float) ($row['total_tax_excl'] ?? 0),
            'unitIncl' => (float) ($row['total_tax_incl'] ?? 0),
            'totalExcl' => (float) ($row['total_tax_excl'] ?? 0),
            'totalIncl' => (float) ($row['total_tax_incl'] ?? 0),
            'currency' => $currency,
        ];
    }

    return $items;
}

function invocean_invoice_line_items(array $row): array
{
    $raw = invocean_invoice_raw($row);
    $order = is_array($raw['order'] ?? null) ? $raw['order'] : [];
    $currency = (string) ($row['currency_iso'] ?? 'EUR') ?: 'EUR';
    $items = invocean_invoice_product_line_items($row);

    $shippingExcl = (float) ($order['total_shipping_tax_excl'] ?? 0);
    $shippingIncl = (float) ($order['total_shipping_tax_incl'] ?? 0);
    if ($shippingIncl > 0.004 || $shippingExcl > 0.004) {
        $items[] = [
            'label' => 'Frais de port',
            'reference' => '',
            'quantity' => 1,
            'unitExcl' => $shippingExcl,
            'unitIncl' => $shippingIncl,
            'totalExcl' => $shippingExcl,
            'totalIncl' => $shippingIncl,
            'currency' => $currency,
        ];
    }

    $discountExcl = (float) ($order['total_discounts_tax_excl'] ?? 0);
    $discountIncl = (float) ($order['total_discounts_tax_incl'] ?? 0);
    if ($discountIncl > 0.004 || $discountExcl > 0.004) {
        $items[] = [
            'label' => 'Remise',
            'reference' => '',
            'quantity' => 1,
            'unitExcl' => -$discountExcl,
            'unitIncl' => -$discountIncl,
            'totalExcl' => -$discountExcl,
            'totalIncl' => -$discountIncl,
            'currency' => $currency,
        ];
    }

    return $items;
}

function invocean_invoice_pdf_content_stream(array $row, array $settings, bool $facturx): string
{
    $raw = invocean_invoice_raw($row);
    $address = is_array($raw['address'] ?? null) ? $raw['address'] : [];
    $sourceLabel = ((string) ($row['channel'] ?? 'prestashop')) === 'nautisign' ? 'Nautisign' : 'PrestaShop';
    $seller = trim((string) ($settings['sellerName'] ?? ''));
    if ($seller === '') {
        $seller = 'Renovboat';
    }
    $sellerLines = array_values(array_filter([
        $seller,
        trim((string) ($settings['sellerStreet'] ?? '')),
        trim(implode(' ', array_filter([
            (string) ($settings['sellerPostcode'] ?? ''),
            (string) ($settings['sellerCity'] ?? ''),
        ]))),
        trim((string) ($settings['sellerVatNumber'] ?? '')),
        trim((string) ($settings['sellerSiret'] ?? '')) !== '' ? 'SIRET ' . trim((string) $settings['sellerSiret']) : '',
    ]));

    $buyer = trim((string) ($row['customer_company'] ?? '')) ?: trim((string) ($row['customer_name'] ?? ''));
    if ($buyer === '') {
        $buyer = trim((string) ($row['customer_email'] ?? 'Client ' . $sourceLabel));
    }
    $buyerLines = array_values(array_filter([
        $buyer,
        trim((string) ($address['address1'] ?? '')),
        trim((string) ($address['address2'] ?? '')),
        trim(implode(' ', array_filter([
            (string) ($address['postcode'] ?? ''),
            (string) ($address['city'] ?? ''),
        ]))),
        trim((string) ($row['customer_email'] ?? '')),
        trim((string) ($row['vat_number'] ?? '')) !== '' ? 'TVA ' . trim((string) $row['vat_number']) : '',
    ]));

    $currency = (string) ($row['currency_iso'] ?? 'EUR') ?: 'EUR';
    $invoiceNumber = invocean_display_invoice_number($row);
    $items = invocean_invoice_line_items($row);

    $content = "q\n0.04 0.09 0.08 rg 0 792 595 50 re f\nQ\n";
    $content .= invocean_pdf_text(40, 810, $seller, 18, 'F2');
    $content .= invocean_pdf_text(405, 810, $facturx ? 'FACTURE FACTUR-X' : 'FACTURE', 18, 'F2');
    $content .= invocean_pdf_text(405, 790, 'N° ' . $invoiceNumber, 11, 'F2');
    $content .= invocean_pdf_text(405, 774, 'Date: ' . (string) ($row['invoice_date'] ?? ''), 10);
    $content .= invocean_pdf_text(405, 758, 'Commande: ' . (string) ($row['order_reference'] ?? $row['order_id'] ?? ''), 10);

    $content .= "0.86 0.89 0.88 RG 0.96 0.98 0.97 rg\n";
    $content .= invocean_pdf_rect(40, 625, 235, 105, true);
    $content .= invocean_pdf_rect(320, 625, 235, 105, true);
    $content .= "0 0 0 RG 0 0 0 rg\n";
    $content .= invocean_pdf_text(52, 710, 'Vendeur', 11, 'F2');
    $content .= invocean_pdf_text(332, 710, 'Client', 11, 'F2');
    $y = 692;
    foreach ($sellerLines as $line) {
        $content .= invocean_pdf_text(52, $y, invocean_pdf_fit($line, 42), 9);
        $y -= 14;
    }
    $y = 692;
    foreach ($buyerLines as $line) {
        $content .= invocean_pdf_text(332, $y, invocean_pdf_fit($line, 42), 9);
        $y -= 14;
    }

    $tableTop = 570;
    $content .= "0.04 0.09 0.08 rg 40 " . ($tableTop - 22) . " 515 24 re f\n0 0 0 rg\n";
    $content .= invocean_pdf_text(50, $tableTop - 14, 'Designation', 9, 'F2');
    $content .= invocean_pdf_text(305, $tableTop - 14, 'Qté', 9, 'F2');
    $content .= invocean_pdf_text(350, $tableTop - 14, 'PU HT', 9, 'F2');
    $content .= invocean_pdf_text(425, $tableTop - 14, 'Total HT', 9, 'F2');
    $content .= invocean_pdf_text(495, $tableTop - 14, 'Total TTC', 9, 'F2');

    $y = $tableTop - 44;
    foreach ($items as $item) {
        if ($y < 165) {
            break;
        }
        $label = invocean_pdf_fit((string) $item['label'], 46);
        if ((string) $item['reference'] !== '') {
            $label .= ' - Ref. ' . invocean_pdf_fit((string) $item['reference'], 12);
        }
        $content .= invocean_pdf_text(50, $y, $label, 9);
        $content .= invocean_pdf_text(307, $y, rtrim(rtrim(number_format((float) $item['quantity'], 2, ',', ' '), '0'), ','), 9);
        $content .= invocean_pdf_text(350, $y, invocean_pdf_money($item['unitExcl'], $currency), 9);
        $content .= invocean_pdf_text(425, $y, invocean_pdf_money($item['totalExcl'], $currency), 9);
        $content .= invocean_pdf_text(495, $y, invocean_pdf_money($item['totalIncl'], $currency), 9);
        $content .= "0.86 0.89 0.88 RG " . invocean_pdf_line(40, $y - 9, 555, $y - 9);
        $content .= "0 0 0 RG\n";
        $y -= 24;
    }

    $taxAmount = max(0.0, (float) ($row['total_tax_incl'] ?? 0) - (float) ($row['total_tax_excl'] ?? 0));
    $content .= "0.96 0.98 0.97 rg 345 85 210 78 re f\n0 0 0 rg\n";
    $content .= invocean_pdf_text(360, 145, 'Total HT', 10);
    $content .= invocean_pdf_text(470, 145, invocean_pdf_money($row['total_tax_excl'] ?? 0, $currency), 10, 'F2');
    $content .= invocean_pdf_text(360, 123, 'TVA', 10);
    $content .= invocean_pdf_text(470, 123, invocean_pdf_money($taxAmount, $currency), 10, 'F2');
    $content .= invocean_pdf_text(360, 100, 'Total TTC', 12, 'F2');
    $content .= invocean_pdf_text(470, 100, invocean_pdf_money($row['total_tax_incl'] ?? 0, $currency), 12, 'F2');
    $content .= invocean_pdf_text(40, 90, $facturx ? 'PDF hybride: fichier factur-x.xml embarque.' : 'PDF genere par Invocean depuis les donnees ' . $sourceLabel . '.', 8);

    return $content;
}

function invocean_plain_invoice_pdf_content_stream(array $row, array $settings): string
{
    return invocean_invoice_pdf_content_stream($row, $settings, false);
}

function invocean_pdf_stream_object(string $dictionary, string $stream): string
{
    return '<< ' . trim($dictionary) . ' /Length ' . strlen($stream) . " >>\nstream\n" . $stream . "\nendstream";
}

function invocean_generate_plain_invoice_pdf(array $row, array $settings): string
{
    invocean_load_vendor_autoload();
    if (class_exists('FPDF')) {
        return invocean_generate_plain_invoice_pdf_fpdf($row, $settings);
    }

    return invocean_generate_plain_invoice_pdf_fallback($row, $settings);
}

function invocean_fpdf_write_cell($pdf, float $w, float $h, string|int|float|null $text = '', int|string $border = 0, int $ln = 0, string $align = '', bool $fill = false): void
{
    $pdf->Cell($w, $h, invocean_fpdf_text($text), $border, $ln, $align, $fill);
}

function invocean_fpdf_write_multicell($pdf, float $w, float $h, string|int|float|null $text = '', int|string $border = 0, string $align = 'L', bool $fill = false): void
{
    $pdf->MultiCell($w, $h, invocean_fpdf_text($text), $border, $align, $fill);
}

function invocean_fpdf_line_count($pdf, float $width, string $text): int
{
    $text = invocean_fpdf_text($text);
    if ($text === '') {
        return 1;
    }

    $max = max(8.0, $width - 4.0);
    $lines = 1;
    $current = '';
    foreach (preg_split('/\s+/', $text) ?: [] as $word) {
        $candidate = $current === '' ? $word : $current . ' ' . $word;
        if ($pdf->GetStringWidth($candidate) > $max && $current !== '') {
            $lines++;
            $current = $word;
        } else {
            $current = $candidate;
        }
    }

    return max(1, $lines);
}

function invocean_fpdf_quantity(float|int|string $value): string
{
    return rtrim(rtrim(number_format((float) $value, 2, ',', ' '), '0'), ',');
}

function invocean_fpdf_draw_invoice_header($pdf, array $row, array $settings, string $invoiceNumber): void
{
    $sourceLabel = ((string) ($row['channel'] ?? 'prestashop')) === 'nautisign' ? 'NAUTISIGN' : 'PRESTASHOP';
    $logo = invocean_logo_path();
    if ($logo !== '') {
        $pdf->Image($logo, 14, 11, 78);
    }

    $pdf->SetDrawColor(14, 59, 83);
    $pdf->SetLineWidth(0.8);
    $pdf->Line(15, 43, 195, 43);

    $pdf->SetTextColor(12, 38, 48);
    $pdf->SetFont('Arial', 'B', 25);
    $pdf->SetXY(118, 13);
    invocean_fpdf_write_cell($pdf, 77, 10, 'FACTURE', 0, 2, 'R');
    $pdf->SetTextColor(249, 86, 20);
    $pdf->SetFont('Arial', 'B', 10);
    invocean_fpdf_write_cell($pdf, 77, 6, $sourceLabel, 0, 2, 'R');

    $pdf->SetTextColor(84, 100, 106);
    $pdf->SetFont('Arial', '', 8);
    invocean_fpdf_write_cell($pdf, 77, 5, 'Document genere par Invocean', 0, 2, 'R');

    $pdf->SetXY(120, 48);
    $pdf->SetFillColor(243, 248, 249);
    $pdf->SetDrawColor(218, 229, 231);
    $pdf->Rect(120, 48, 75, 33, 'DF');
    $pdf->SetTextColor(11, 55, 78);
    $pdf->SetFont('Arial', 'B', 9);
    $pdf->SetXY(126, 54);
    invocean_fpdf_write_cell($pdf, 22, 5, 'Numero', 0, 0);
    $pdf->SetFont('Arial', 'B', 12);
    invocean_fpdf_write_cell($pdf, 41, 5, $invoiceNumber, 0, 1, 'R');
    $pdf->SetFont('Arial', '', 8);
    $pdf->SetX(126);
    invocean_fpdf_write_cell($pdf, 22, 5, 'Date', 0, 0);
    invocean_fpdf_write_cell($pdf, 41, 5, invocean_invoice_display_date((string) ($row['invoice_date'] ?? '')), 0, 1, 'R');
    $pdf->SetX(126);
    invocean_fpdf_write_cell($pdf, 22, 5, 'Commande', 0, 0);
    invocean_fpdf_write_cell($pdf, 41, 5, (string) ($row['order_reference'] ?? $row['order_id'] ?? ''), 0, 1, 'R');
    $pdf->SetX(126);
    invocean_fpdf_write_cell($pdf, 22, 5, 'Statut', 0, 0);
    invocean_fpdf_write_cell($pdf, 41, 5, invocean_status_label((string) ($row['status'] ?? 'received')), 0, 1, 'R');
}

function invocean_fpdf_draw_party_box($pdf, float $x, float $y, string $title, array $lines): void
{
    $pdf->SetFillColor(249, 251, 251);
    $pdf->SetDrawColor(218, 229, 231);
    $pdf->Rect($x, $y, 84, 45, 'DF');
    $pdf->SetXY($x + 5, $y + 5);
    $pdf->SetTextColor(11, 55, 78);
    $pdf->SetFont('Arial', 'B', 9);
    invocean_fpdf_write_cell($pdf, 74, 5, strtoupper($title), 0, 2);
    $pdf->SetTextColor(24, 37, 42);
    $pdf->SetFont('Arial', '', 8.5);
    foreach (array_slice($lines, 0, 5) as $line) {
        invocean_fpdf_write_cell($pdf, 74, 5, $line, 0, 2);
    }
}

function invocean_fpdf_draw_table_header($pdf, float $x, float $y, array $widths): void
{
    $pdf->SetXY($x, $y);
    $pdf->SetFillColor(11, 55, 78);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->SetFont('Arial', 'B', 8);
    $headers = ['Designation', 'Qte', 'PU HT', 'Total HT', 'Total TTC'];
    foreach ($headers as $index => $label) {
        invocean_fpdf_write_cell($pdf, $widths[$index], 8, $label, 0, 0, $index === 0 ? 'L' : 'R', true);
    }
    $pdf->Ln();
}

function invocean_generate_plain_invoice_pdf_fpdf(array $row, array $settings): string
{
    $raw = invocean_invoice_raw($row);
    $address = is_array($raw['address'] ?? null) ? $raw['address'] : [];
    $sourceLabel = ((string) ($row['channel'] ?? 'prestashop')) === 'nautisign' ? 'Nautisign' : 'PrestaShop';
    $seller = trim((string) ($settings['sellerName'] ?? '')) ?: 'RenovBoat';
    $sellerLines = array_values(array_filter([
        $seller,
        trim((string) ($settings['sellerStreet'] ?? '')),
        trim(implode(' ', array_filter([
            (string) ($settings['sellerPostcode'] ?? ''),
            (string) ($settings['sellerCity'] ?? ''),
        ]))),
        trim((string) ($settings['sellerVatNumber'] ?? '')) !== '' ? 'TVA ' . trim((string) $settings['sellerVatNumber']) : '',
        trim((string) ($settings['sellerSiret'] ?? '')) !== '' ? 'SIRET ' . trim((string) $settings['sellerSiret']) : '',
    ]));

    $buyer = trim((string) ($row['customer_company'] ?? '')) ?: trim((string) ($row['customer_name'] ?? ''));
    if ($buyer === '') {
        $buyer = trim((string) ($row['customer_email'] ?? 'Client ' . $sourceLabel));
    }
    $buyerLines = array_values(array_filter([
        $buyer,
        trim((string) ($address['address1'] ?? '')),
        trim((string) ($address['address2'] ?? '')),
        trim(implode(' ', array_filter([
            (string) ($address['postcode'] ?? ''),
            (string) ($address['city'] ?? ''),
        ]))),
        trim((string) ($row['customer_email'] ?? '')),
        trim((string) ($row['vat_number'] ?? '')) !== '' ? 'TVA ' . trim((string) $row['vat_number']) : '',
    ]));

    $currency = (string) ($row['currency_iso'] ?? 'EUR') ?: 'EUR';
    $invoiceNumber = invocean_display_invoice_number($row);
    $items = invocean_invoice_line_items($row);

    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->SetTitle(invocean_fpdf_text('Facture ' . $invoiceNumber));
    $pdf->SetAuthor(invocean_fpdf_text($seller));
    $pdf->SetCreator('Invocean');
    $pdf->SetMargins(15, 12, 15);
    $pdf->SetAutoPageBreak(true, 20);
    $pdf->AddPage();

    invocean_fpdf_draw_invoice_header($pdf, $row, $settings, $invoiceNumber);
    invocean_fpdf_draw_party_box($pdf, 15, 92, 'Vendeur', $sellerLines);
    invocean_fpdf_draw_party_box($pdf, 111, 92, 'Client facture', $buyerLines);

    $x = 15.0;
    $widths = [82.0, 16.0, 26.0, 28.0, 28.0];
    $y = 150.0;
    invocean_fpdf_draw_table_header($pdf, $x, $y, $widths);
    $y += 8;
    $pdf->SetTextColor(26, 36, 40);
    $pdf->SetDrawColor(222, 231, 232);
    $lineHeight = 5.0;

    foreach ($items as $index => $item) {
        $label = trim((string) $item['label']);
        if ((string) $item['reference'] !== '') {
            $label .= ' - Ref. ' . trim((string) $item['reference']);
        }
        $rowHeight = max(10.0, invocean_fpdf_line_count($pdf, $widths[0], $label) * $lineHeight + 4.0);
        if ($y + $rowHeight > 244) {
            $pdf->AddPage();
            invocean_fpdf_draw_invoice_header($pdf, $row, $settings, $invoiceNumber);
            $y = 92.0;
            invocean_fpdf_draw_table_header($pdf, $x, $y, $widths);
            $y += 8;
        }

        $fill = $index % 2 === 0;
        $pdf->SetFillColor($fill ? 248 : 255, $fill ? 251 : 255, $fill ? 251 : 255);
        $pdf->Rect($x, $y, array_sum($widths), $rowHeight, $fill ? 'F' : '');
        $pdf->Line($x, $y + $rowHeight, $x + array_sum($widths), $y + $rowHeight);

        $pdf->SetXY($x + 2, $y + 2.5);
        $pdf->SetFont('Arial', '', 8.2);
        invocean_fpdf_write_multicell($pdf, $widths[0] - 4, $lineHeight, $label);

        $pdf->SetFont('Arial', '', 8.2);
        $pdf->SetXY($x + $widths[0], $y + 3);
        invocean_fpdf_write_cell($pdf, $widths[1] - 2, 5, invocean_fpdf_quantity($item['quantity']), 0, 0, 'R');
        invocean_fpdf_write_cell($pdf, $widths[2], 5, invocean_pdf_money($item['unitExcl'], $currency), 0, 0, 'R');
        invocean_fpdf_write_cell($pdf, $widths[3], 5, invocean_pdf_money($item['totalExcl'], $currency), 0, 0, 'R');
        $pdf->SetFont('Arial', 'B', 8.2);
        invocean_fpdf_write_cell($pdf, $widths[4], 5, invocean_pdf_money($item['totalIncl'], $currency), 0, 0, 'R');

        $y += $rowHeight;
    }

    $taxAmount = max(0.0, (float) ($row['total_tax_incl'] ?? 0) - (float) ($row['total_tax_excl'] ?? 0));
    $totalY = max($y + 12, 220.0);
    if ($totalY > 244) {
        $pdf->AddPage();
        invocean_fpdf_draw_invoice_header($pdf, $row, $settings, $invoiceNumber);
        $totalY = 92.0;
    }

    $pdf->SetTextColor(74, 91, 97);
    $pdf->SetFont('Arial', '', 8);
    $pdf->SetXY(15, $totalY + 2);
    invocean_fpdf_write_multicell($pdf, 88, 4.5, 'Facture recreee localement depuis les donnees ' . $sourceLabel . ' synchronisees par Invocean.', 0, 'L');

    $pdf->SetFillColor(243, 248, 249);
    $pdf->SetDrawColor(218, 229, 231);
    $pdf->Rect(118, $totalY, 77, 40, 'DF');
    $pdf->SetXY(124, $totalY + 7);
    $pdf->SetTextColor(29, 45, 50);
    $pdf->SetFont('Arial', '', 9);
    invocean_fpdf_write_cell($pdf, 34, 6, 'Total HT', 0, 0);
    invocean_fpdf_write_cell($pdf, 30, 6, invocean_pdf_money($row['total_tax_excl'] ?? 0, $currency), 0, 1, 'R');
    $pdf->SetX(124);
    invocean_fpdf_write_cell($pdf, 34, 6, 'TVA', 0, 0);
    invocean_fpdf_write_cell($pdf, 30, 6, invocean_pdf_money($taxAmount, $currency), 0, 1, 'R');
    $pdf->SetX(124);
    $pdf->SetTextColor(11, 55, 78);
    $pdf->SetFont('Arial', 'B', 12);
    invocean_fpdf_write_cell($pdf, 34, 8, 'Total TTC', 0, 0);
    $pdf->SetTextColor(249, 86, 20);
    invocean_fpdf_write_cell($pdf, 30, 8, invocean_pdf_money($row['total_tax_incl'] ?? 0, $currency), 0, 1, 'R');

    $pdf->SetY(-16);
    $pdf->SetDrawColor(222, 231, 232);
    $pdf->Line(15, $pdf->GetY() - 2, 195, $pdf->GetY() - 2);
    $pdf->SetTextColor(102, 115, 120);
    $pdf->SetFont('Arial', '', 7.5);
    invocean_fpdf_write_cell($pdf, 180, 5, 'RenovBoat - Reparation nautique - Donnees source ' . $sourceLabel, 0, 0, 'C');

    return $pdf->Output('S');
}

function invocean_generate_plain_invoice_pdf_fallback(array $row, array $settings): string
{
    $content = invocean_plain_invoice_pdf_content_stream($row, $settings);
    $modDate = invocean_pdf_date();

    $objects = [];
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    $objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
    $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    $objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    $objects[6] = invocean_pdf_stream_object('', $content);
    $objects[7] = '<< /Producer ' . invocean_pdf_literal('Invocean') . ' /CreationDate ' . invocean_pdf_literal($modDate) . ' /ModDate ' . invocean_pdf_literal($modDate) . ' >>';

    $pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [0];
    foreach ($objects as $id => $body) {
        $offsets[$id] = strlen($pdf);
        $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
    }

    $xrefOffset = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf('%010d 00000 n ', $offsets[$i]) . "\n";
    }
    $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R /Info 7 0 R >>\n";
    $pdf .= "startxref\n" . $xrefOffset . "\n%%EOF\n";

    return $pdf;
}

function invocean_nautisign_signed_pdf_path(array $row): string
{
    $raw = invocean_invoice_raw($row);
    $quote = is_array($raw['nautisign_quote'] ?? null) ? $raw['nautisign_quote'] : [];
    $nautisign = is_array($quote['nautisign'] ?? null) ? $quote['nautisign'] : [];
    $path = trim((string) ($nautisign['signed_pdf_path'] ?? ''));
    if ($path === '') {
        return '';
    }

    $moduleRoot = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Nautisign';
    $storageRoot = realpath($moduleRoot . DIRECTORY_SEPARATOR . 'storage');
    if (!is_string($storageRoot)) {
        return '';
    }

    $isAbsolute = preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1 || str_starts_with($path, DIRECTORY_SEPARATOR);
    $candidate = $isAbsolute
        ? $path
        : $moduleRoot . DIRECTORY_SEPARATOR . ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path), DIRECTORY_SEPARATOR);
    $realPath = is_file($candidate) ? realpath($candidate) : false;
    if (!is_string($realPath)) {
        return '';
    }

    $storagePrefix = rtrim($storageRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    $realLower = strtolower($realPath);
    $storageLower = strtolower($storagePrefix);
    if (!str_starts_with($realLower, $storageLower)) {
        return '';
    }

    return $realPath;
}

function invocean_facturx_additional_attachments(array $row): array
{
    $signedPdfPath = invocean_nautisign_signed_pdf_path($row);
    if ($signedPdfPath === '') {
        return [];
    }

    $raw = invocean_invoice_raw($row);
    $quote = is_array($raw['nautisign_quote'] ?? null) ? $raw['nautisign_quote'] : [];
    $quoteNumber = trim((string) ($quote['quote_number'] ?? ''));
    if ($quoteNumber === '') {
        $quoteNumber = trim((string) ($row['order_reference'] ?? 'devis-signe'));
    }

    return [[
        'path' => $signedPdfPath,
        'name' => invocean_safe_filename($quoteNumber, 'devis-signe') . '-devis-signe.pdf',
        'desc' => 'Devis signe Nautisign',
        'mime' => 'application/pdf',
    ]];
}

function invocean_generate_facturx_pdf(array $row, string $xml, array $settings): string
{
    $basePdf = invocean_generate_plain_invoice_pdf($row, $settings);
    $additionalAttachments = invocean_facturx_additional_attachments($row);
    invocean_load_vendor_autoload();

    if (class_exists(\Atgp\FacturX\Writer::class)) {
        $writer = new \Atgp\FacturX\Writer();

        return $writer->generate($basePdf, $xml, null, true, $additionalAttachments);
    }

    return invocean_generate_facturx_pdf_fallback($row, $xml, $settings, $additionalAttachments);
}

function invocean_generate_facturx_pdf_fallback(array $row, string $xml, array $settings, array $additionalAttachments = []): string
{
    $profile = 'EN 16931';
    $xmlFilename = 'factur-x.xml';
    $xmp = invocean_facturx_xmp($xmlFilename, $profile);
    $content = invocean_facturx_pdf_content_stream($row, $settings);
    $modDate = invocean_pdf_date();
    $checksum = md5($xml);
    $embeddedFiles = [];
    $associatedFiles = [];

    $objects = [];
    $objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    $objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
    $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    $objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    $objects[6] = invocean_pdf_stream_object('', $content);
    $objects[7] = invocean_pdf_stream_object('/Type /Metadata /Subtype /XML', $xmp);
    $objects[8] = invocean_pdf_stream_object('/Type /EmbeddedFile /Subtype /' . invocean_pdf_name('text/xml') . ' /Params << /Size ' . strlen($xml) . ' /ModDate ' . invocean_pdf_literal($modDate) . ' /CheckSum <' . $checksum . '> >>', $xml);
    $objects[9] = '<< /Type /Filespec /F ' . invocean_pdf_literal($xmlFilename) . ' /UF ' . invocean_pdf_literal($xmlFilename) . ' /Desc ' . invocean_pdf_literal('Factur-X invoice data') . ' /AFRelationship /Alternative /EF << /F 8 0 R /UF 8 0 R >> >>';
    $embeddedFiles[] = invocean_pdf_literal($xmlFilename) . ' 9 0 R';
    $associatedFiles[] = '9 0 R';

    $nextObjectId = 10;
    foreach ($additionalAttachments as $attachment) {
        $attachmentPath = (string) ($attachment['path'] ?? '');
        if ($attachmentPath === '' || !is_file($attachmentPath)) {
            continue;
        }

        $attachmentContent = file_get_contents($attachmentPath);
        if (!is_string($attachmentContent)) {
            continue;
        }

        $attachmentFilename = invocean_safe_filename((string) ($attachment['name'] ?? basename($attachmentPath)), 'devis-signe.pdf');
        if (!str_ends_with(strtolower($attachmentFilename), '.pdf')) {
            $attachmentFilename .= '.pdf';
        }
        $attachmentDesc = trim((string) ($attachment['desc'] ?? 'Devis signe Nautisign')) ?: 'Devis signe Nautisign';
        $attachmentMime = trim((string) ($attachment['mime'] ?? 'application/pdf')) ?: 'application/pdf';
        $streamObjectId = $nextObjectId++;
        $fileSpecObjectId = $nextObjectId++;

        $objects[$streamObjectId] = invocean_pdf_stream_object('/Type /EmbeddedFile /Subtype /' . invocean_pdf_name($attachmentMime) . ' /Params << /Size ' . strlen($attachmentContent) . ' /ModDate ' . invocean_pdf_literal($modDate) . ' /CheckSum <' . md5($attachmentContent) . '> >>', $attachmentContent);
        $objects[$fileSpecObjectId] = '<< /Type /Filespec /F ' . invocean_pdf_literal($attachmentFilename) . ' /UF ' . invocean_pdf_literal($attachmentFilename) . ' /Desc ' . invocean_pdf_literal($attachmentDesc) . ' /AFRelationship /Supplement /EF << /F ' . $streamObjectId . ' 0 R /UF ' . $streamObjectId . ' 0 R >> >>';
        $embeddedFiles[] = invocean_pdf_literal($attachmentFilename) . ' ' . $fileSpecObjectId . ' 0 R';
        $associatedFiles[] = $fileSpecObjectId . ' 0 R';
    }

    $infoObjectId = $nextObjectId++;
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R /Names << /EmbeddedFiles << /Names [' . implode(' ', $embeddedFiles) . '] >> >> /AF [' . implode(' ', $associatedFiles) . '] >>';
    $objects[$infoObjectId] = '<< /Producer ' . invocean_pdf_literal('Invocean') . ' /CreationDate ' . invocean_pdf_literal($modDate) . ' /ModDate ' . invocean_pdf_literal($modDate) . ' >>';
    ksort($objects);

    $pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [0];
    foreach ($objects as $id => $body) {
        $offsets[$id] = strlen($pdf);
        $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
    }

    $xrefOffset = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf('%010d 00000 n ', $offsets[$i]) . "\n";
    }
    $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R /Info " . $infoObjectId . " 0 R >>\n";
    $pdf .= "startxref\n" . $xrefOffset . "\n%%EOF\n";

    return $pdf;
}

function invocean_get_invoice_row(PDO $pdo, int $invoiceId): array
{
    $statement = $pdo->prepare('SELECT * FROM invocean_invoices WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $invoiceId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Facture introuvable.');
    }

    return $row;
}

function invocean_get_invoice_row_by_prestashop_id(PDO $pdo, int $prestashopInvoiceId): array
{
    $statement = $pdo->prepare('SELECT * FROM invocean_invoices WHERE prestashop_invoice_id = :id LIMIT 1');
    $statement->execute(['id' => $prestashopInvoiceId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Facture introuvable.');
    }

    return $row;
}

function invocean_save_facturx(PDO $pdo, array $row): array
{
    $settings = invocean_get_settings($pdo);
    $xml = invocean_generate_facturx_xml($row, $settings);
    if (trim($xml) === '') {
        throw new RuntimeException('Impossible de generer le fichier Factur-X.');
    }

    $pdf = invocean_generate_facturx_pdf($row, $xml, $settings);
    $filename = invocean_facturx_filename($row);
    $path = invocean_storage_dir() . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($path, $pdf, LOCK_EX) === false) {
        throw new RuntimeException('Impossible d ecrire la sauvegarde Factur-X.');
    }

    $statement = $pdo->prepare(
        "UPDATE invocean_invoices
         SET xml_payload = :xml_payload,
             e_invoice_format = 'facturx',
             facturx_file_path = :facturx_file_path,
             facturx_profile = 'EN16931',
             facturx_generated_at = NOW()
         WHERE id = :id"
    );
    $statement->execute([
        'id' => (int) $row['id'],
        'xml_payload' => $xml,
        'facturx_file_path' => $path,
    ]);

    return [
        'xml' => $xml,
        'pdf' => $pdf,
        'filename' => $filename,
        'xmlFilename' => invocean_facturx_xml_filename($row),
        'path' => $path,
        'profile' => 'EN16931',
    ];
}

function invocean_save_invoice_pdf(PDO $pdo, array $row): array
{
    $settings = invocean_get_settings($pdo, true);
    $pdf = invocean_generate_plain_invoice_pdf($row, $settings);

    $filename = invocean_pdf_filename($row);
    $path = invocean_pdf_storage_dir() . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($path, $pdf, LOCK_EX) === false) {
        throw new RuntimeException('Impossible d ecrire la sauvegarde PDF.');
    }

    $hash = hash('sha256', $pdf);
    $statement = $pdo->prepare(
        'UPDATE invocean_invoices
         SET pdf_url = :pdf_url,
             pdf_file_path = :pdf_file_path,
             pdf_hash = :pdf_hash,
             pdf_downloaded_at = NOW()
         WHERE id = :id'
    );
    $statement->execute([
        'id' => (int) $row['id'],
        'pdf_url' => trim((string) ($row['pdf_url'] ?? '')) ?: null,
        'pdf_file_path' => $path,
        'pdf_hash' => $hash,
    ]);

    return [
        'pdf' => $pdf,
        'filename' => $filename,
        'path' => $path,
        'hash' => $hash,
        'url' => trim((string) ($row['pdf_url'] ?? '')),
    ];
}

function invocean_upsert_invoice(PDO $pdo, array $invoice): string
{
    $existingStatement = $pdo->prepare('SELECT id, source_hash FROM invocean_invoices WHERE prestashop_invoice_id = :prestashop_invoice_id LIMIT 1');
    $existingStatement->execute(['prestashop_invoice_id' => $invoice['prestashopInvoiceId']]);
    $existing = $existingStatement->fetch();

    $statement = $pdo->prepare(
        "INSERT INTO invocean_invoices (
            prestashop_invoice_id, order_id, invoice_number, invoice_date, order_reference,
            customer_name, customer_email, customer_company, vat_number, currency_iso,
            total_tax_excl, total_tax_incl, channel, e_invoice_format, pdf_url,
            raw_json, source_hash, synced_at
         ) VALUES (
            :prestashop_invoice_id, :order_id, :invoice_number, :invoice_date, :order_reference,
            :customer_name, :customer_email, :customer_company, :vat_number, :currency_iso,
            :total_tax_excl, :total_tax_incl, :channel, :e_invoice_format, :pdf_url,
            :raw_json, :source_hash, NOW()
         )
         ON DUPLICATE KEY UPDATE
            order_id = VALUES(order_id),
            invoice_number = VALUES(invoice_number),
            invoice_date = VALUES(invoice_date),
            order_reference = VALUES(order_reference),
            customer_name = VALUES(customer_name),
            customer_email = VALUES(customer_email),
            customer_company = VALUES(customer_company),
            vat_number = VALUES(vat_number),
            currency_iso = VALUES(currency_iso),
            total_tax_excl = VALUES(total_tax_excl),
            total_tax_incl = VALUES(total_tax_incl),
            channel = VALUES(channel),
            e_invoice_format = VALUES(e_invoice_format),
            pdf_url = VALUES(pdf_url),
            raw_json = VALUES(raw_json),
            source_hash = VALUES(source_hash),
            synced_at = NOW()"
    );

    $statement->execute([
        'prestashop_invoice_id' => $invoice['prestashopInvoiceId'],
        'order_id' => $invoice['orderId'],
        'invoice_number' => $invoice['invoiceNumber'],
        'invoice_date' => $invoice['invoiceDate'],
        'order_reference' => $invoice['orderReference'],
        'customer_name' => $invoice['customerName'],
        'customer_email' => $invoice['customerEmail'],
        'customer_company' => $invoice['customerCompany'],
        'vat_number' => $invoice['vatNumber'],
        'currency_iso' => $invoice['currencyIso'],
        'total_tax_excl' => $invoice['totalTaxExcl'],
        'total_tax_incl' => $invoice['totalTaxIncl'],
        'channel' => $invoice['channel'],
        'e_invoice_format' => $invoice['eInvoiceFormat'],
        'pdf_url' => $invoice['pdfUrl'] !== '' ? $invoice['pdfUrl'] : null,
        'raw_json' => json_encode($invoice['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'source_hash' => $invoice['sourceHash'],
    ]);

    if (!is_array($existing)) {
        return 'created';
    }

    return hash_equals((string) $existing['source_hash'], (string) $invoice['sourceHash']) ? 'unchanged' : 'updated';
}

function invocean_create_sync_run(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare('INSERT INTO invocean_sync_runs (user_id, status) VALUES (:user_id, "running")');
    $statement->execute(['user_id' => $userId]);

    return (int) $pdo->lastInsertId();
}

function invocean_finish_sync_run(PDO $pdo, int $runId, string $status, int $seen, int $created, int $updated, string $message, array $summary = []): array
{
    $statement = $pdo->prepare(
        'UPDATE invocean_sync_runs
         SET status = :status,
             finished_at = NOW(),
             invoices_seen = :invoices_seen,
             invoices_created = :invoices_created,
             invoices_updated = :invoices_updated,
             message = :message,
             raw_summary_json = :raw_summary_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $runId,
        'status' => $status,
        'invoices_seen' => $seen,
        'invoices_created' => $created,
        'invoices_updated' => $updated,
        'message' => $message,
        'raw_summary_json' => json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $run = invocean_get_sync_run($pdo, $runId);
    if ($run === null) {
        throw new RuntimeException('Journal de synchronisation introuvable.');
    }

    return $run;
}

function invocean_sync_prestashop(PDO $pdo, array $user, array $options = []): array
{
    $settings = invocean_get_settings($pdo, true);
    [$shopUrl, $apiKey] = invocean_require_prestashop_settings($settings);

    $limit = max(1, min(250, (int) ($options['limit'] ?? invocean_config()['default_sync_limit'])));
    $dateFrom = trim((string) ($options['dateFrom'] ?? ''));
    $dateTo = trim((string) ($options['dateTo'] ?? ''));
    if ($dateFrom === '') {
        $days = max(1, (int) ($settings['syncWindowDays'] ?? 30));
        $dateFrom = (new DateTimeImmutable('today'))->modify('-' . $days . ' days')->format('Y-m-d');
    }
    if ($dateTo === '') {
        $dateTo = (new DateTimeImmutable('today'))->format('Y-m-d');
    }

    $runId = invocean_create_sync_run($pdo, (int) $user['id']);
    $seen = 0;
    $created = 0;
    $updated = 0;

    try {
        $nodes = invocean_fetch_invoice_nodes($shopUrl, $apiKey, $dateFrom, $dateTo, $limit);
        $cache = [
            'orders' => [],
            'customers' => [],
            'addresses' => [],
            'currencies' => [],
            'countries' => [],
        ];

        foreach ($nodes as $node) {
            $seen++;
            $invoice = invocean_normalize_remote_invoice($node, $shopUrl, $apiKey, (string) $settings['pdfUrlTemplate'], $cache);
            $result = invocean_upsert_invoice($pdo, $invoice);
            $savedRow = invocean_get_invoice_row_by_prestashop_id($pdo, (int) $invoice['prestashopInvoiceId']);
            invocean_save_facturx($pdo, $savedRow);
            try {
                invocean_save_invoice_pdf($pdo, $savedRow);
            } catch (Throwable) {
                // La synchronisation des donnees reste prioritaire; le PDF peut etre regenere ensuite depuis la ligne.
            }
            if ($result === 'created') {
                $created++;
            } elseif ($result === 'updated') {
                $updated++;
            }
        }

        $message = sprintf('%d facture(s) lue(s), %d creee(s), %d mise(s) a jour.', $seen, $created, $updated);
        return invocean_finish_sync_run($pdo, $runId, 'success', $seen, $created, $updated, $message, [
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'limit' => $limit,
        ]);
    } catch (Throwable $exception) {
        invocean_finish_sync_run($pdo, $runId, 'failed', $seen, $created, $updated, $exception->getMessage(), [
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'limit' => $limit,
        ]);
        throw $exception;
    }
}

function invocean_test_prestashop(PDO $pdo, array $input = []): array
{
    $settings = invocean_get_settings($pdo, true);
    if (isset($input['shopUrl'])) {
        $settings['shopUrl'] = trim((string) $input['shopUrl']);
    }
    if (!empty($input['webserviceKey'])) {
        $settings['webserviceKey'] = trim((string) $input['webserviceKey']);
    }
    [$shopUrl, $apiKey] = invocean_require_prestashop_settings($settings);

    $nodes = invocean_fetch_invoice_nodes($shopUrl, $apiKey, null, null, 1);

    return [
        'ok' => true,
        'message' => 'Connexion PrestaShop valide.',
        'sampleInvoices' => count($nodes),
    ];
}

function invocean_quote_value(array $data, array $paths): mixed
{
    foreach ($paths as $path) {
        $current = $data;
        foreach (explode('.', $path) as $segment) {
            if (!is_array($current) || !array_key_exists($segment, $current)) {
                $current = null;
                break;
            }
            $current = $current[$segment];
        }
        if ($current !== null && (!is_string($current) || trim($current) !== '')) {
            return $current;
        }
    }

    return null;
}

function invocean_quote_text(mixed $value): string
{
    if (is_bool($value)) {
        return $value ? '1' : '0';
    }
    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return '';
}

function invocean_quote_number(mixed $value): float
{
    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }

    $normalized = str_replace(["\xc2\xa0", ' '], '', invocean_quote_text($value));
    $normalized = str_replace(',', '.', $normalized);

    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function invocean_quote_date_value(mixed $value): ?string
{
    $value = invocean_quote_text($value);
    if ($value === '') {
        return null;
    }

    try {
        return (new DateTimeImmutable($value))->format('Y-m-d');
    } catch (Throwable) {
        return null;
    }
}

function invocean_quote_datetime_value(mixed $value): ?string
{
    $value = invocean_quote_text($value);
    if ($value === '') {
        return null;
    }

    try {
        return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
    } catch (Throwable) {
        return null;
    }
}

function invocean_quote_array_value(array $data, array $paths): array
{
    $value = invocean_quote_value($data, $paths);
    if (is_array($value)) {
        return $value;
    }

    return [];
}

function invocean_quote_list_value(array $data, array $paths): array
{
    $value = invocean_quote_value($data, $paths);
    if (!is_array($value)) {
        return [];
    }
    if (array_is_list($value)) {
        return $value;
    }
    if (isset($value['0'])) {
        return array_values($value);
    }
    if (isset($value['line']) && is_array($value['line'])) {
        return array_is_list($value['line']) ? $value['line'] : [$value['line']];
    }

    return [$value];
}

function invocean_nautisign_status_is_signed(array $quote): bool
{
    $explicit = invocean_quote_value($quote, ['signed', 'is_signed', 'isSigned', 'signature.signed']);
    if (is_bool($explicit)) {
        return $explicit;
    }
    $explicitText = strtolower(invocean_quote_text($explicit));
    if (in_array($explicitText, ['1', 'true', 'yes', 'oui', 'signed', 'signe'], true)) {
        return true;
    }
    if (in_array($explicitText, ['0', 'false', 'no', 'non'], true)) {
        return false;
    }

    $status = strtolower(invocean_quote_text(invocean_quote_value($quote, [
        'status',
        'state',
        'document_status',
        'signature.status',
        'workflow.status',
    ])));
    $status = strtr($status, [
        'é' => 'e',
        'è' => 'e',
        'ê' => 'e',
        'à' => 'a',
        'ç' => 'c',
    ]);
    if ($status === '') {
        return true;
    }
    foreach (['draft', 'brouillon', 'cancel', 'annul', 'reject', 'refus', 'expire'] as $blocked) {
        if (str_contains($status, $blocked)) {
            return false;
        }
    }
    foreach (['signed', 'signe', 'accepted', 'accepte', 'valid', 'complete'] as $accepted) {
        if (str_contains($status, $accepted)) {
            return true;
        }
    }

    return false;
}

function invocean_quote_line_items(array $quote): array
{
    $rows = invocean_quote_list_value($quote, [
        'lines',
        'items',
        'products',
        'services',
        'details',
        'document.lines',
        'quote.lines',
        'devis.lines',
    ]);
    $items = [];

    foreach ($rows as $index => $row) {
        if (!is_array($row)) {
            continue;
        }
        $quantity = invocean_quote_number(invocean_quote_value($row, [
            'quantity',
            'qty',
            'product_quantity',
            'qte',
        ]));
        if ($quantity <= 0) {
            $quantity = 1.0;
        }

        $totalExcl = invocean_quote_number(invocean_quote_value($row, [
            'total_tax_excl',
            'total_excl_tax',
            'total_ht',
            'totalExcl',
            'amount_excl_tax',
            'line_total_ht',
            'net_amount',
        ]));
        $totalIncl = invocean_quote_number(invocean_quote_value($row, [
            'total_tax_incl',
            'total_incl_tax',
            'total_ttc',
            'totalIncl',
            'amount_incl_tax',
            'line_total_ttc',
            'gross_amount',
        ]));
        $unitExcl = invocean_quote_number(invocean_quote_value($row, [
            'unit_price_tax_excl',
            'unit_excl_tax',
            'unit_ht',
            'unitExcl',
            'price_ht',
            'unit_price',
            'price',
        ]));
        $unitIncl = invocean_quote_number(invocean_quote_value($row, [
            'unit_price_tax_incl',
            'unit_incl_tax',
            'unit_ttc',
            'unitIncl',
            'price_ttc',
        ]));
        if ($unitExcl <= 0 && abs($totalExcl) > 0.004) {
            $unitExcl = $totalExcl / $quantity;
        }
        if ($unitIncl <= 0 && abs($totalIncl) > 0.004) {
            $unitIncl = $totalIncl / $quantity;
        }
        if (abs($totalExcl) <= 0.004 && abs($unitExcl) > 0.004) {
            $totalExcl = $unitExcl * $quantity;
        }
        if (abs($totalIncl) <= 0.004) {
            $totalIncl = (abs($unitIncl) > 0.004 ? $unitIncl : $unitExcl) * $quantity;
        }
        if (abs($unitIncl) <= 0.004) {
            $unitIncl = $totalIncl / $quantity;
        }

        $label = invocean_quote_text(invocean_quote_value($row, [
            'name',
            'label',
            'description',
            'product_name',
            'title',
        ]));
        if ($label === '') {
            $label = 'Ligne ' . ($index + 1);
        }

        $items[] = [
            'label' => $label,
            'reference' => invocean_quote_text(invocean_quote_value($row, ['reference', 'sku', 'product_reference', 'code'])),
            'quantity' => $quantity,
            'unitExcl' => $unitExcl,
            'unitIncl' => $unitIncl,
            'totalExcl' => $totalExcl,
            'totalIncl' => $totalIncl,
        ];
    }

    return $items;
}

function invocean_normalize_quote_payload(array $payload, string $source = 'nautisign'): array
{
    if ($source === 'nautisign' && !invocean_nautisign_status_is_signed($payload)) {
        throw new InvalidArgumentException('Ce devis Nautisign n est pas signe.');
    }

    $customer = invocean_quote_array_value($payload, ['customer', 'client', 'buyer', 'recipient', 'signer']);
    $address = invocean_quote_array_value($customer, ['address', 'billing_address']);
    if ($address === []) {
        $address = invocean_quote_array_value($payload, ['address', 'billing_address', 'customer.address', 'client.address']);
    }

    $externalId = invocean_quote_text(invocean_quote_value($payload, [
        'id',
        'uuid',
        'external_id',
        'quote_id',
        'devis_id',
        'document_id',
        'reference',
        'number',
    ]));
    if ($externalId === '') {
        $externalId = hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $quoteNumber = invocean_quote_text(invocean_quote_value($payload, [
        'quote_number',
        'devis_number',
        'number',
        'reference',
        'document_number',
    ]));
    $quoteDate = invocean_quote_date_value(invocean_quote_value($payload, [
        'quote_date',
        'devis_date',
        'date',
        'created_at',
        'createdAt',
        'document_date',
    ]));
    $signedAt = invocean_quote_datetime_value(invocean_quote_value($payload, [
        'signed_at',
        'signedAt',
        'signature_date',
        'signature.signed_at',
        'completed_at',
        'validated_at',
    ]));

    $company = invocean_quote_text(invocean_quote_value($customer, ['company', 'company_name', 'organization', 'societe']));
    if ($company === '') {
        $company = invocean_quote_text(invocean_quote_value($payload, ['customer_company', 'client_company', 'company']));
    }
    $name = invocean_quote_text(invocean_quote_value($customer, ['name', 'full_name', 'display_name']));
    if ($name === '') {
        $name = trim(implode(' ', array_filter([
            invocean_quote_text(invocean_quote_value($customer, ['firstname', 'first_name'])),
            invocean_quote_text(invocean_quote_value($customer, ['lastname', 'last_name'])),
        ])));
    }
    if ($name === '') {
        $name = invocean_quote_text(invocean_quote_value($payload, ['customer_name', 'client_name', 'name']));
    }
    $email = invocean_quote_text(invocean_quote_value($customer, ['email', 'mail']));
    if ($email === '') {
        $email = invocean_quote_text(invocean_quote_value($payload, ['customer_email', 'client_email', 'email']));
    }

    $lines = invocean_quote_line_items($payload);
    $totalExcl = invocean_quote_number(invocean_quote_value($payload, [
        'total_tax_excl',
        'total_excl_tax',
        'total_ht',
        'amount_excl_tax',
        'subtotal',
    ]));
    $totalIncl = invocean_quote_number(invocean_quote_value($payload, [
        'total_tax_incl',
        'total_incl_tax',
        'total_ttc',
        'amount_incl_tax',
        'total',
    ]));
    if (abs($totalExcl) <= 0.004 && $lines !== []) {
        $totalExcl = array_sum(array_map(static fn(array $line): float => (float) $line['totalExcl'], $lines));
    }
    if (abs($totalIncl) <= 0.004 && $lines !== []) {
        $totalIncl = array_sum(array_map(static fn(array $line): float => (float) $line['totalIncl'], $lines));
    }
    if (abs($totalExcl) <= 0.004 && $lines === [] && abs($totalIncl) > 0.004) {
        $totalExcl = $totalIncl;
    }
    if (abs($totalIncl) <= 0.004) {
        $totalIncl = $totalExcl;
    }

    $currency = strtoupper(invocean_quote_text(invocean_quote_value($payload, [
        'currency_iso',
        'currency',
        'currency.code',
        'currency.iso_code',
    ])));
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        $currency = 'EUR';
    }

    $raw = $payload;
    $raw['_invocean'] = [
        'source' => $source,
        'lines' => $lines,
        'address' => $address,
    ];

    return [
        'source' => $source,
        'externalId' => mb_substr($externalId, 0, 120),
        'quoteNumber' => mb_substr($quoteNumber, 0, 80),
        'quoteDate' => $quoteDate,
        'signedAt' => $signedAt,
        'customerName' => mb_substr($name, 0, 190),
        'customerEmail' => mb_substr($email, 0, 190),
        'customerCompany' => mb_substr($company, 0, 190),
        'vatNumber' => mb_substr(strtoupper(str_replace(' ', '', invocean_quote_text(invocean_quote_value($payload, [
            'vat_number',
            'customer.vat_number',
            'client.vat_number',
            'buyer.vat_number',
            'tva_intracommunautaire',
        ])))), 0, 64),
        'currencyIso' => $currency,
        'totalTaxExcl' => number_format($totalExcl, 6, '.', ''),
        'totalTaxIncl' => number_format($totalIncl, 6, '.', ''),
        'status' => 'signed',
        'raw' => $raw,
        'lines' => $lines,
    ];
}

function invocean_upsert_signed_quote(PDO $pdo, array $quote): string
{
    $existingStatement = $pdo->prepare(
        'SELECT id, raw_json
         FROM invocean_signed_quotes
         WHERE source = :source AND external_id = :external_id
         LIMIT 1'
    );
    $existingStatement->execute([
        'source' => $quote['source'],
        'external_id' => $quote['externalId'],
    ]);
    $existing = $existingStatement->fetch();
    $rawJson = json_encode($quote['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $statement = $pdo->prepare(
        "INSERT INTO invocean_signed_quotes (
            source, external_id, quote_number, quote_date, signed_at,
            customer_name, customer_email, customer_company, vat_number, currency_iso,
            total_tax_excl, total_tax_incl, status, raw_json
         ) VALUES (
            :source, :external_id, :quote_number, :quote_date, :signed_at,
            :customer_name, :customer_email, :customer_company, :vat_number, :currency_iso,
            :total_tax_excl, :total_tax_incl, :status, :raw_json
         )
         ON DUPLICATE KEY UPDATE
            quote_number = VALUES(quote_number),
            quote_date = VALUES(quote_date),
            signed_at = VALUES(signed_at),
            customer_name = VALUES(customer_name),
            customer_email = VALUES(customer_email),
            customer_company = VALUES(customer_company),
            vat_number = VALUES(vat_number),
            currency_iso = VALUES(currency_iso),
            total_tax_excl = VALUES(total_tax_excl),
            total_tax_incl = VALUES(total_tax_incl),
            status = IF(status = 'converted', status, VALUES(status)),
            raw_json = VALUES(raw_json)"
    );
    $statement->execute([
        'source' => $quote['source'],
        'external_id' => $quote['externalId'],
        'quote_number' => $quote['quoteNumber'] !== '' ? $quote['quoteNumber'] : null,
        'quote_date' => $quote['quoteDate'],
        'signed_at' => $quote['signedAt'],
        'customer_name' => $quote['customerName'] !== '' ? $quote['customerName'] : null,
        'customer_email' => $quote['customerEmail'] !== '' ? $quote['customerEmail'] : null,
        'customer_company' => $quote['customerCompany'] !== '' ? $quote['customerCompany'] : null,
        'vat_number' => $quote['vatNumber'] !== '' ? $quote['vatNumber'] : null,
        'currency_iso' => $quote['currencyIso'],
        'total_tax_excl' => $quote['totalTaxExcl'],
        'total_tax_incl' => $quote['totalTaxIncl'],
        'status' => $quote['status'],
        'raw_json' => $rawJson,
    ]);

    if (!is_array($existing)) {
        return 'created';
    }

    return hash_equals((string) ($existing['raw_json'] ?? ''), (string) $rawJson) ? 'unchanged' : 'updated';
}

function invocean_require_nautisign_settings(array $settings): array
{
    $url = rtrim(trim((string) ($settings['nautisignApiUrl'] ?? '')), '/');
    $token = trim((string) ($settings['nautisignApiToken'] ?? ''));
    if ($url === '') {
        throw new InvalidArgumentException('Configurez l URL API Nautisign avant de recuperer les devis signes.');
    }
    if (!preg_match('~^https?://~i', $url)) {
        throw new InvalidArgumentException('URL API Nautisign invalide.');
    }

    return [$url, $token];
}

function invocean_http_get_json(string $url, string $token = ''): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('L extension PHP cURL est requise pour appeler Nautisign.');
    }

    $headers = ['Accept: application/json'];
    if ($token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
        $headers[] = 'X-API-Key: ' . $token;
    }

    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 4,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => $headers,
    ];
    $caBundle = invocean_ca_bundle_path();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }
    curl_setopt_array($curl, $options);

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($body === false) {
        throw new RuntimeException($error !== '' ? $error : 'Nautisign n a retourne aucune donnee.');
    }
    if ($status >= 400) {
        throw new RuntimeException('Nautisign a refuse la requete HTTP ' . $status . '.');
    }

    $decoded = json_decode((string) $body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Reponse JSON Nautisign invalide.');
    }

    return $decoded;
}

function invocean_extract_quote_payloads(array $decoded): array
{
    if (array_is_list($decoded)) {
        return $decoded;
    }

    foreach (['quotes', 'devis', 'documents', 'data', 'items', 'results'] as $key) {
        if (isset($decoded[$key]) && is_array($decoded[$key])) {
            $value = $decoded[$key];
            if (array_is_list($value)) {
                return $value;
            }
            foreach (['quotes', 'devis', 'documents', 'items', 'results'] as $nestedKey) {
                if (isset($value[$nestedKey]) && is_array($value[$nestedKey])) {
                    return array_is_list($value[$nestedKey]) ? $value[$nestedKey] : array_values($value[$nestedKey]);
                }
            }
            foreach (['id', 'uuid', 'quote_id', 'devis_id', 'number', 'quote_number', 'status', 'signed', 'lines'] as $quoteKey) {
                if (array_key_exists($quoteKey, $value)) {
                    return [$value];
                }
            }
            return array_values($value);
        }
    }

    return [$decoded];
}

function invocean_path_basename(mixed $path): string
{
    $path = trim(str_replace('\\', '/', (string) $path));
    if ($path === '') {
        return '';
    }

    return basename($path);
}

function invocean_devis_lines_to_quote_lines(mixed $linesJson): array
{
    $decoded = json_decode((string) ($linesJson ?? '[]'), true);
    if (!is_array($decoded)) {
        return [];
    }

    $lines = [];
    foreach ($decoded as $line) {
        if (!is_array($line)) {
            continue;
        }

        $quantity = max(0.0001, invocean_quote_number($line['quantity'] ?? 1));
        $unitHt = invocean_quote_number($line['unit_price_ht'] ?? $line['unit_ht'] ?? 0);
        $taxRate = invocean_quote_number($line['tax_rate'] ?? 0);
        $unitTtc = $unitHt * (1 + ($taxRate / 100));
        $totalHt = $unitHt * $quantity;
        $totalTtc = $unitTtc * $quantity;
        $label = trim((string) ($line['name'] ?? 'Prestation'));
        if ((string) ($line['line_type'] ?? '') === 'fee' && $label !== '') {
            $label = 'Frais annexes - ' . $label;
        }

        $lines[] = [
            'name' => $label !== '' ? $label : 'Prestation',
            'reference' => (string) ($line['product_reference'] ?? $line['reference'] ?? ''),
            'quantity' => $quantity,
            'unit_ht' => $unitHt,
            'unit_ttc' => $unitTtc,
            'total_ht' => $totalHt,
            'total_ttc' => $totalTtc,
            'tax_rate' => $taxRate,
        ];
    }

    return $lines;
}

function invocean_nautisign_internal_payload(array $request, ?array $quote): array
{
    $quoteFilename = (string) ($request['quote_filename'] ?? '');
    $filename = invocean_path_basename($quoteFilename);
    $quoteNumber = trim((string) ($quote['reference'] ?? ''));
    if ($quoteNumber === '') {
        $quoteNumber = preg_replace('/\.pdf$/i', '', $filename) ?: 'Nautisign-' . (int) ($request['id'] ?? 0);
    }

    $clientName = trim((string) ($quote['client_name'] ?? ''));
    if ($clientName === '') {
        $clientName = trim((string) ($request['signer_name'] ?? ''));
    }
    $clientEmail = trim((string) ($quote['client_email'] ?? ''));
    if ($clientEmail === '') {
        $clientEmail = trim((string) ($request['signer_email'] ?? ''));
    }

    return [
        'id' => 'nautisign-request-' . (int) ($request['id'] ?? 0),
        'status' => 'signed',
        'quote_number' => $quoteNumber,
        'quote_date' => (string) ($quote['date_created'] ?? $request['created_at'] ?? ''),
        'signed_at' => (string) ($request['signed_at'] ?? ''),
        'customer' => [
            'name' => $clientName,
            'email' => $clientEmail,
        ],
        'total_ht' => (string) ($quote['total_ht'] ?? '0'),
        'total_ttc' => (string) ($quote['total_ttc'] ?? '0'),
        'currency' => 'EUR',
        'lines' => invocean_devis_lines_to_quote_lines($quote['lines_json'] ?? null),
        'nautisign' => [
            'request_id' => (int) ($request['id'] ?? 0),
            'token' => (string) ($request['token'] ?? ''),
            'quote_filename' => $quoteFilename,
            'signed_pdf_path' => (string) ($request['signed_pdf_path'] ?? ''),
            'signed_pdf_hash' => (string) ($request['signed_pdf_hash'] ?? ''),
            'signed_at' => (string) ($request['signed_at'] ?? ''),
            'signer_name' => (string) ($request['signer_name'] ?? ''),
            'signer_email' => (string) ($request['signer_email'] ?? ''),
        ],
        'devis' => is_array($quote) ? [
            'quote_id' => (int) ($quote['id'] ?? 0),
            'reference' => (string) ($quote['reference'] ?? ''),
            'status' => (string) ($quote['status'] ?? ''),
            'pdf_file_path' => (string) ($quote['pdf_file_path'] ?? ''),
        ] : [],
    ];
}

function invocean_sync_nautisign_internal_quotes(PDO $pdo): ?array
{
    if (!invocean_table_exists($pdo, 'nautisign_requests')) {
        return null;
    }

    $hasDevis = invocean_table_exists($pdo, 'devis_quotes');
    $quoteByFilename = [];
    if ($hasDevis) {
        $quoteRows = $pdo->query('SELECT * FROM devis_quotes ORDER BY date_updated DESC, id DESC')->fetchAll() ?: [];
        foreach ($quoteRows as $quoteRow) {
            if (!is_array($quoteRow)) {
                continue;
            }
            $filename = invocean_path_basename($quoteRow['pdf_file_path'] ?? '');
            if ($filename !== '' && !isset($quoteByFilename[$filename])) {
                $quoteByFilename[$filename] = $quoteRow;
            }
        }
    }

    $requests = $pdo->query(
        "SELECT *
         FROM nautisign_requests
         WHERE status = 'signed'
           AND signed_at IS NOT NULL
         ORDER BY signed_at DESC, id DESC
         LIMIT 300"
    )->fetchAll() ?: [];

    $seen = 0;
    $created = 0;
    $updated = 0;
    $ignored = 0;

    foreach ($requests as $request) {
        if (!is_array($request)) {
            $ignored++;
            continue;
        }
        $filename = invocean_path_basename($request['quote_filename'] ?? '');
        $quoteRow = $filename !== '' ? ($quoteByFilename[$filename] ?? null) : null;
        try {
            $payload = invocean_nautisign_internal_payload($request, is_array($quoteRow) ? $quoteRow : null);
            $quote = invocean_normalize_quote_payload($payload, 'nautisign');
            $seen++;
            $result = invocean_upsert_signed_quote($pdo, $quote);
            if ($result === 'created') {
                $created++;
            } elseif ($result === 'updated') {
                $updated++;
            }
        } catch (InvalidArgumentException) {
            $ignored++;
        }
    }

    return [
        'seen' => $seen,
        'created' => $created,
        'updated' => $updated,
        'ignored' => $ignored,
        'message' => sprintf('%d devis Nautisign signe(s) lu(s), %d cree(s), %d mis a jour.', $seen, $created, $updated),
        'mode' => 'internal',
    ];
}

function invocean_sync_nautisign_quotes(PDO $pdo): array
{
    $internal = invocean_sync_nautisign_internal_quotes($pdo);
    if ($internal !== null) {
        return $internal;
    }

    $settings = invocean_get_settings($pdo, true);
    [$url, $token] = invocean_require_nautisign_settings($settings);
    $decoded = invocean_http_get_json($url, $token);
    $payloads = invocean_extract_quote_payloads($decoded);
    $seen = 0;
    $created = 0;
    $updated = 0;
    $ignored = 0;

    foreach ($payloads as $payload) {
        if (!is_array($payload)) {
            $ignored++;
            continue;
        }
        try {
            $quote = invocean_normalize_quote_payload($payload, 'nautisign');
            $seen++;
            $result = invocean_upsert_signed_quote($pdo, $quote);
            if ($result === 'created') {
                $created++;
            } elseif ($result === 'updated') {
                $updated++;
            }
        } catch (InvalidArgumentException) {
            $ignored++;
        }
    }

    return [
        'seen' => $seen,
        'created' => $created,
        'updated' => $updated,
        'ignored' => $ignored,
        'message' => sprintf('%d devis signe(s) lu(s), %d cree(s), %d mis a jour.', $seen, $created, $updated),
    ];
}

function invocean_public_signed_quote(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'source' => (string) $row['source'],
        'externalId' => (string) $row['external_id'],
        'quoteNumber' => (string) ($row['quote_number'] ?? ''),
        'quoteDate' => (string) ($row['quote_date'] ?? ''),
        'signedAt' => (string) ($row['signed_at'] ?? ''),
        'customerName' => (string) ($row['customer_name'] ?? ''),
        'customerEmail' => (string) ($row['customer_email'] ?? ''),
        'customerCompany' => (string) ($row['customer_company'] ?? ''),
        'vatNumber' => (string) ($row['vat_number'] ?? ''),
        'currencyIso' => (string) ($row['currency_iso'] ?? 'EUR'),
        'totalTaxExcl' => (float) ($row['total_tax_excl'] ?? 0),
        'totalTaxIncl' => (float) ($row['total_tax_incl'] ?? 0),
        'status' => (string) ($row['status'] ?? 'signed'),
        'invoiceId' => isset($row['invoice_id']) ? (int) $row['invoice_id'] : null,
        'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function invocean_list_signed_quotes(PDO $pdo): array
{
    $stats = $pdo->query(
        "SELECT
            COUNT(*) AS quote_count,
            COALESCE(SUM(status = 'signed'), 0) AS signed_count,
            COALESCE(SUM(status = 'converted'), 0) AS converted_count,
            COALESCE(SUM(status = 'ignored'), 0) AS ignored_count,
            COALESCE(SUM(total_tax_incl), 0) AS total_tax_incl
         FROM invocean_signed_quotes"
    )->fetch() ?: [];

    $statement = $pdo->query(
        'SELECT q.*, i.invoice_number
         FROM invocean_signed_quotes q
         LEFT JOIN invocean_invoices i ON i.id = q.invoice_id
         ORDER BY COALESCE(q.signed_at, q.quote_date, q.created_at) DESC, q.id DESC
         LIMIT 200'
    );

    return [
        'quotes' => array_map(static fn(array $row): array => invocean_public_signed_quote($row), $statement->fetchAll()),
        'stats' => [
            'quoteCount' => (int) ($stats['quote_count'] ?? 0),
            'signedCount' => (int) ($stats['signed_count'] ?? 0),
            'convertedCount' => (int) ($stats['converted_count'] ?? 0),
            'ignoredCount' => (int) ($stats['ignored_count'] ?? 0),
            'totalTaxIncl' => (float) ($stats['total_tax_incl'] ?? 0),
        ],
    ];
}

function invocean_get_signed_quote(PDO $pdo, int $quoteId): array
{
    $statement = $pdo->prepare('SELECT * FROM invocean_signed_quotes WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $quoteId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Devis signe introuvable.');
    }

    return $row;
}

function invocean_next_invoice_number(PDO $pdo): int
{
    $statement = $pdo->query(
        "SELECT invoice_number
         FROM invocean_invoices
         WHERE invoice_number REGEXP '^[0-9]+$'
         ORDER BY CAST(invoice_number AS UNSIGNED) DESC
         LIMIT 1"
    );
    $last = (int) ($statement->fetchColumn() ?: 0);

    return max(1, $last + 1);
}

function invocean_quote_country_iso(array $raw, array $address): string
{
    $country = strtoupper(invocean_quote_text(invocean_quote_value($address, ['country_iso', 'countryIso', 'country_code', 'country'])));
    if (!preg_match('/^[A-Z]{2}$/', $country)) {
        $country = strtoupper(invocean_quote_text(invocean_quote_value($raw, ['country_iso', 'country.code', 'customer.country_iso', 'client.country_iso'])));
    }

    return preg_match('/^[A-Z]{2}$/', $country) ? $country : 'FR';
}

function invocean_quote_order_rows(array $lines): array
{
    $rows = [];
    foreach ($lines as $line) {
        $rows[] = [
            'product_id' => '0',
            'product_attribute_id' => '0',
            'product_quantity' => (string) ($line['quantity'] ?? 1),
            'product_name' => (string) ($line['label'] ?? 'Prestation'),
            'product_reference' => (string) ($line['reference'] ?? ''),
            'product_price' => (string) ($line['unitExcl'] ?? 0),
            'unit_price_tax_excl' => (string) ($line['unitExcl'] ?? 0),
            'unit_price_tax_incl' => (string) ($line['unitIncl'] ?? $line['unitExcl'] ?? 0),
        ];
    }

    return $rows;
}

function invocean_convert_quote_to_invoice(PDO $pdo, int $quoteId): array
{
    $quote = invocean_get_signed_quote($pdo, $quoteId);
    if ((string) ($quote['status'] ?? '') === 'converted' && (int) ($quote['invoice_id'] ?? 0) > 0) {
        return invocean_public_invoice(invocean_get_invoice_row($pdo, (int) $quote['invoice_id']));
    }

    $raw = json_decode((string) ($quote['raw_json'] ?? ''), true);
    if (!is_array($raw)) {
        $raw = [];
    }
    $meta = is_array($raw['_invocean'] ?? null) ? $raw['_invocean'] : [];
    $lines = is_array($meta['lines'] ?? null) ? $meta['lines'] : invocean_quote_line_items($raw);
    if ($lines === []) {
        $lines = [[
            'label' => 'Devis ' . ((string) ($quote['quote_number'] ?? '') ?: (string) $quote['id']),
            'reference' => '',
            'quantity' => 1,
            'unitExcl' => (float) ($quote['total_tax_excl'] ?? 0),
            'unitIncl' => (float) ($quote['total_tax_incl'] ?? 0),
            'totalExcl' => (float) ($quote['total_tax_excl'] ?? 0),
            'totalIncl' => (float) ($quote['total_tax_incl'] ?? 0),
        ]];
    }

    $address = is_array($meta['address'] ?? null) ? $meta['address'] : [];
    $customerName = trim((string) ($quote['customer_name'] ?? ''));
    $parts = preg_split('/\s+/', $customerName) ?: [];
    $firstName = (string) ($parts[0] ?? '');
    $lastName = trim(implode(' ', array_slice($parts, 1)));
    $countryIso = invocean_quote_country_iso($raw, $address);
    $syntheticId = 900000000000 + (int) $quote['id'];

    $existingInvoice = null;
    try {
        $existingInvoice = invocean_get_invoice_row_by_prestashop_id($pdo, $syntheticId);
    } catch (InvalidArgumentException) {
        $existingInvoice = null;
    }
    $invoiceNumber = is_array($existingInvoice) && trim((string) ($existingInvoice['invoice_number'] ?? '')) !== ''
        ? (string) $existingInvoice['invoice_number']
        : (string) invocean_next_invoice_number($pdo);

    $invoiceDate = (new DateTimeImmutable('today'))->format('Y-m-d');
    $quoteReference = trim((string) ($quote['quote_number'] ?? '')) ?: 'DEVIS-' . (int) $quote['id'];
    $customerPayload = [
        'firstname' => $firstName,
        'lastname' => $lastName,
        'email' => (string) ($quote['customer_email'] ?? ''),
    ];
    $addressPayload = [
        'firstname' => $firstName,
        'lastname' => $lastName,
        'company' => (string) ($quote['customer_company'] ?? ''),
        'address1' => invocean_quote_text(invocean_quote_value($address, ['address1', 'street', 'line1', 'address'])),
        'address2' => invocean_quote_text(invocean_quote_value($address, ['address2', 'line2'])),
        'postcode' => invocean_quote_text(invocean_quote_value($address, ['postcode', 'postal_code', 'zip'])),
        'city' => invocean_quote_text(invocean_quote_value($address, ['city', 'ville'])),
        'vat_number' => (string) ($quote['vat_number'] ?? ''),
    ];

    $invoiceRaw = [
        'invoice' => [
            'id' => (string) $syntheticId,
            'number' => $invoiceNumber,
            'date_add' => $invoiceDate,
        ],
        'order' => [
            'id' => (string) $syntheticId,
            'reference' => $quoteReference,
            'total_paid_tax_excl' => (string) ($quote['total_tax_excl'] ?? 0),
            'total_paid_tax_incl' => (string) ($quote['total_tax_incl'] ?? 0),
            'total_shipping_tax_excl' => '0',
            'total_shipping_tax_incl' => '0',
            'total_discounts_tax_excl' => '0',
            'total_discounts_tax_incl' => '0',
            'associations' => [
                'order_rows' => [
                    'order_row' => invocean_quote_order_rows($lines),
                ],
            ],
        ],
        'customer' => $customerPayload,
        'address' => $addressPayload,
        'currency' => ['iso_code' => (string) ($quote['currency_iso'] ?? 'EUR')],
        'country' => ['iso_code' => $countryIso],
        'nautisign_quote' => $raw,
    ];

    $invoice = [
        'prestashopInvoiceId' => $syntheticId,
        'orderId' => $syntheticId,
        'invoiceNumber' => $invoiceNumber,
        'invoiceDate' => $invoiceDate,
        'orderReference' => $quoteReference,
        'customerName' => (string) ($quote['customer_name'] ?? ''),
        'customerEmail' => (string) ($quote['customer_email'] ?? ''),
        'customerCompany' => (string) ($quote['customer_company'] ?? ''),
        'vatNumber' => (string) ($quote['vat_number'] ?? ''),
        'currencyIso' => (string) ($quote['currency_iso'] ?? 'EUR'),
        'totalTaxExcl' => invocean_money((string) ($quote['total_tax_excl'] ?? '0')),
        'totalTaxIncl' => invocean_money((string) ($quote['total_tax_incl'] ?? '0')),
        'channel' => 'nautisign',
        'eInvoiceFormat' => 'facturx',
        'pdfUrl' => '',
        'raw' => $invoiceRaw,
        'sourceHash' => hash('sha256', json_encode($invoiceRaw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
    ];

    invocean_upsert_invoice($pdo, $invoice);
    $savedRow = invocean_get_invoice_row_by_prestashop_id($pdo, $syntheticId);
    invocean_save_invoice_pdf($pdo, $savedRow);
    invocean_save_facturx($pdo, $savedRow);
    $savedRow = invocean_get_invoice_row_by_prestashop_id($pdo, $syntheticId);

    $statement = $pdo->prepare(
        "UPDATE invocean_signed_quotes
         SET status = 'converted', invoice_id = :invoice_id
         WHERE id = :id"
    );
    $statement->execute([
        'id' => (int) $quote['id'],
        'invoice_id' => (int) $savedRow['id'],
    ]);

    return invocean_public_invoice($savedRow);
}

function invocean_invoice_statuses(): array
{
    return ['received', 'ready', 'sent', 'accepted', 'rejected', 'archived'];
}

function invocean_build_invoice_filters(array $input): array
{
    $where = [];
    $params = [];

    $search = trim((string) ($input['search'] ?? ''));
    if ($search !== '') {
        $where[] = '(invoice_number LIKE :search OR order_reference LIKE :search OR customer_name LIKE :search OR customer_email LIKE :search OR customer_company LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $status = trim((string) ($input['status'] ?? ''));
    if ($status !== '' && in_array($status, invocean_invoice_statuses(), true)) {
        $where[] = 'status = :status';
        $params['status'] = $status;
    }

    $dateFrom = trim((string) ($input['dateFrom'] ?? ''));
    if ($dateFrom !== '') {
        $where[] = 'invoice_date >= :date_from';
        $params['date_from'] = $dateFrom;
    }

    $dateTo = trim((string) ($input['dateTo'] ?? ''));
    if ($dateTo !== '') {
        $where[] = 'invoice_date <= :date_to';
        $params['date_to'] = $dateTo;
    }

    return [
        'sql' => $where === [] ? '1 = 1' : implode(' AND ', $where),
        'params' => $params,
    ];
}

function invocean_public_invoice(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'prestashopInvoiceId' => (int) $row['prestashop_invoice_id'],
        'orderId' => (int) $row['order_id'],
        'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
        'invoiceDate' => (string) ($row['invoice_date'] ?? ''),
        'orderReference' => (string) ($row['order_reference'] ?? ''),
        'customerName' => (string) ($row['customer_name'] ?? ''),
        'customerEmail' => (string) ($row['customer_email'] ?? ''),
        'customerCompany' => (string) ($row['customer_company'] ?? ''),
        'vatNumber' => (string) ($row['vat_number'] ?? ''),
        'currencyIso' => (string) ($row['currency_iso'] ?? ''),
        'totalTaxExcl' => (float) ($row['total_tax_excl'] ?? 0),
        'totalTaxIncl' => (float) ($row['total_tax_incl'] ?? 0),
        'status' => (string) ($row['status'] ?? 'received'),
        'channel' => (string) ($row['channel'] ?? 'prestashop'),
        'eInvoiceFormat' => (string) ($row['e_invoice_format'] ?? 'pdf'),
        'pdfUrl' => (string) ($row['pdf_url'] ?? ''),
        'pdfReady' => trim((string) ($row['pdf_file_path'] ?? '')) !== '' && is_file((string) ($row['pdf_file_path'] ?? '')),
        'pdfDownloadedAt' => (string) ($row['pdf_downloaded_at'] ?? ''),
        'facturxReady' => trim((string) ($row['xml_payload'] ?? '')) !== '',
        'facturxProfile' => (string) ($row['facturx_profile'] ?? ''),
        'facturxGeneratedAt' => (string) ($row['facturx_generated_at'] ?? ''),
        'syncedAt' => (string) ($row['synced_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function invocean_list_invoices(PDO $pdo, array $input): array
{
    $page = max(1, (int) ($input['page'] ?? 1));
    $limit = max(10, min(100, (int) ($input['limit'] ?? 30)));
    $offset = ($page - 1) * $limit;
    $filters = invocean_build_invoice_filters($input);

    $countStatement = $pdo->prepare('SELECT COUNT(*) FROM invocean_invoices WHERE ' . $filters['sql']);
    $countStatement->execute($filters['params']);
    $total = (int) $countStatement->fetchColumn();

    $statsStatement = $pdo->prepare(
        "SELECT
            COUNT(*) AS invoice_count,
            COALESCE(SUM(total_tax_incl), 0) AS total_tax_incl,
            COALESCE(SUM(status = 'received'), 0) AS received_count,
            COALESCE(SUM(status IN ('ready', 'sent')), 0) AS in_progress_count,
            COALESCE(SUM(status = 'accepted'), 0) AS accepted_count,
            COALESCE(SUM(status = 'rejected'), 0) AS rejected_count
         FROM invocean_invoices
         WHERE " . $filters['sql']
    );
    $statsStatement->execute($filters['params']);
    $stats = $statsStatement->fetch() ?: [];

    $statement = $pdo->prepare(
        'SELECT *
         FROM invocean_invoices
         WHERE ' . $filters['sql'] . '
         ORDER BY invoice_date DESC, id DESC
         LIMIT :limit OFFSET :offset'
    );
    foreach ($filters['params'] as $key => $value) {
        $statement->bindValue(':' . $key, $value);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    return [
        'invoices' => array_map(static fn(array $row): array => invocean_public_invoice($row), $statement->fetchAll()),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit),
        ],
        'stats' => [
            'invoiceCount' => (int) ($stats['invoice_count'] ?? 0),
            'totalTaxIncl' => (float) ($stats['total_tax_incl'] ?? 0),
            'receivedCount' => (int) ($stats['received_count'] ?? 0),
            'inProgressCount' => (int) ($stats['in_progress_count'] ?? 0),
            'acceptedCount' => (int) ($stats['accepted_count'] ?? 0),
            'rejectedCount' => (int) ($stats['rejected_count'] ?? 0),
        ],
    ];
}

function invocean_update_invoice_status(PDO $pdo, int $invoiceId, string $status): array
{
    if (!in_array($status, invocean_invoice_statuses(), true)) {
        throw new InvalidArgumentException('Statut de facture invalide.');
    }

    $statement = $pdo->prepare('UPDATE invocean_invoices SET status = :status WHERE id = :id');
    $statement->execute([
        'id' => $invoiceId,
        'status' => $status,
    ]);

    $fetch = $pdo->prepare('SELECT * FROM invocean_invoices WHERE id = :id LIMIT 1');
    $fetch->execute(['id' => $invoiceId]);
    $row = $fetch->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Facture introuvable.');
    }

    return invocean_public_invoice($row);
}

function invocean_get_sync_run(PDO $pdo, int $runId): ?array
{
    $statement = $pdo->prepare(
        'SELECT r.*, u.display_name AS user_display_name, u.email AS user_email
         FROM invocean_sync_runs r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $runId]);
    $row = $statement->fetch();

    return is_array($row) ? invocean_public_sync_run($row) : null;
}

function invocean_public_sync_run(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'status' => (string) $row['status'],
        'startedAt' => (string) $row['started_at'],
        'finishedAt' => $row['finished_at'] !== null ? (string) $row['finished_at'] : null,
        'invoicesSeen' => (int) $row['invoices_seen'],
        'invoicesCreated' => (int) $row['invoices_created'],
        'invoicesUpdated' => (int) $row['invoices_updated'],
        'message' => (string) ($row['message'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'userEmail' => (string) ($row['user_email'] ?? ''),
    ];
}

function invocean_list_sync_runs(PDO $pdo, int $limit = 8): array
{
    $statement = $pdo->prepare(
        'SELECT r.*, u.display_name AS user_display_name, u.email AS user_email
         FROM invocean_sync_runs r
         LEFT JOIN users u ON u.id = r.user_id
         ORDER BY r.started_at DESC, r.id DESC
         LIMIT :limit'
    );
    $statement->bindValue(':limit', max(1, min(30, $limit)), PDO::PARAM_INT);
    $statement->execute();

    return array_map(static fn(array $row): array => invocean_public_sync_run($row), $statement->fetchAll());
}

function invocean_export_csv(PDO $pdo, array $input): never
{
    $filters = invocean_build_invoice_filters($input);
    $statement = $pdo->prepare(
        'SELECT *
         FROM invocean_invoices
         WHERE ' . $filters['sql'] . '
         ORDER BY invoice_date DESC, id DESC'
    );
    $statement->execute($filters['params']);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="invocean-factures-' . date('Ymd-His') . '.csv"');

    $output = fopen('php://output', 'wb');
    fputcsv($output, [
        'invoice_number',
        'invoice_date',
        'order_reference',
        'order_id',
        'customer_name',
        'customer_email',
        'customer_company',
        'vat_number',
        'currency_iso',
        'total_tax_excl',
        'total_tax_incl',
        'status',
        'channel',
        'e_invoice_format',
        'pdf_url',
        'synced_at',
    ]);

    while (($row = $statement->fetch()) !== false) {
        fputcsv($output, [
            $row['invoice_number'],
            $row['invoice_date'],
            $row['order_reference'],
            $row['order_id'],
            $row['customer_name'],
            $row['customer_email'],
            $row['customer_company'],
            $row['vat_number'],
            $row['currency_iso'],
            $row['total_tax_excl'],
            $row['total_tax_incl'],
            $row['status'],
            $row['channel'],
            $row['e_invoice_format'],
            $row['pdf_url'],
            $row['synced_at'],
        ]);
    }

    fclose($output);
    exit;
}

function invocean_filtered_invoice_rows(PDO $pdo, array $input): array
{
    $filters = invocean_build_invoice_filters($input);
    $statement = $pdo->prepare(
        'SELECT *
         FROM invocean_invoices
         WHERE ' . $filters['sql'] . '
         ORDER BY invoice_date DESC, id DESC'
    );
    $statement->execute($filters['params']);

    return $statement->fetchAll();
}

function invocean_download_facturx_pdf(PDO $pdo, int $invoiceId): never
{
    $export = invocean_save_facturx($pdo, invocean_get_invoice_row($pdo, $invoiceId));

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '"');
    header('Content-Length: ' . strlen($export['pdf']));
    echo $export['pdf'];
    exit;
}

function invocean_download_facturx_xml(PDO $pdo, int $invoiceId): never
{
    $export = invocean_save_facturx($pdo, invocean_get_invoice_row($pdo, $invoiceId));

    header('Content-Type: application/xml; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $export['xmlFilename'] . '"');
    echo $export['xml'];
    exit;
}

function invocean_download_invoice_pdf(PDO $pdo, int $invoiceId): never
{
    $row = invocean_get_invoice_row($pdo, $invoiceId);
    $export = invocean_save_invoice_pdf($pdo, $row);
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $export['filename'] . '"');
    header('Content-Length: ' . strlen($export['pdf']));
    echo $export['pdf'];
    exit;
}

function invocean_export_pdf_zip(PDO $pdo, array $input): never
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('L extension PHP ZipArchive est requise pour exporter les PDFs.');
    }

    $rows = invocean_filtered_invoice_rows($pdo, $input);
    if ($rows === []) {
        throw new InvalidArgumentException('Aucune facture a exporter en PDF.');
    }

    $zipFilename = 'invocean-pdf-' . date('Ymd-His') . '.zip';
    $zipPath = invocean_pdf_storage_dir() . DIRECTORY_SEPARATOR . $zipFilename;
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Impossible de creer l archive PDF.');
    }

    $errors = [];
    $files = [];
    foreach ($rows as $row) {
        try {
            $export = invocean_save_invoice_pdf($pdo, $row);
            $path = $export['path'];
            $filename = basename($path);
            $zip->addFile($path, $filename);
            $files[] = $filename;
        } catch (Throwable $exception) {
            $errors[] = [
                'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
                'prestashopInvoiceId' => (int) ($row['prestashop_invoice_id'] ?? 0),
                'message' => $exception->getMessage(),
            ];
        }
    }

    $zip->addFromString('manifest.json', json_encode([
        'generatedAt' => date(DATE_ATOM),
        'count' => count($files),
        'files' => $files,
        'errors' => $errors,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $zip->close();

    if ($files === []) {
        @unlink($zipPath);
        $firstError = $errors[0]['message'] ?? 'aucun PDF recuperable';
        throw new RuntimeException('Aucun PDF n a pu etre recupere. ' . $firstError);
    }

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
    header('Content-Length: ' . filesize($zipPath));
    readfile($zipPath);
    exit;
}

function invocean_export_facturx_zip(PDO $pdo, array $input): never
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('L extension PHP ZipArchive est requise pour exporter les sauvegardes Factur-X.');
    }

    $rows = invocean_filtered_invoice_rows($pdo, $input);
    if ($rows === []) {
        throw new InvalidArgumentException('Aucune facture a exporter en Factur-X.');
    }

    $zipFilename = 'invocean-factur-x-' . date('Ymd-His') . '.zip';
    $zipPath = invocean_storage_dir() . DIRECTORY_SEPARATOR . $zipFilename;
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Impossible de creer l archive Factur-X.');
    }

    $manifest = [
        'generatedAt' => date(DATE_ATOM),
        'count' => count($rows),
        'profile' => 'EN16931',
        'files' => [],
    ];

    foreach ($rows as $row) {
        $export = invocean_save_facturx($pdo, $row);
        $zip->addFile($export['path'], $export['filename']);
        $manifest['files'][] = [
            'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
            'prestashopInvoiceId' => (int) ($row['prestashop_invoice_id'] ?? 0),
            'filename' => $export['filename'],
            'profile' => $export['profile'],
        ];
    }

    $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $zip->close();

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
    header('Content-Length: ' . filesize($zipPath));
    readfile($zipPath);
    exit;
}
