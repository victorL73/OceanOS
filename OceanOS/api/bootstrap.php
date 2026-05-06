<?php
declare(strict_types=1);

class OceanosPrestashopException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $statusCode,
        public readonly string $resource
    ) {
        parent::__construct($message, $statusCode);
    }
}

function oceanos_config(): array
{
    static $config = null;
    if ($config === null) {
        $configDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config';
        $localConfig = $configDirectory . DIRECTORY_SEPARATOR . 'server.local.php';
        $defaultConfig = $configDirectory . DIRECTORY_SEPARATOR . 'server.php';
        $config = require (is_file($localConfig) ? $localConfig : $defaultConfig);
    }

    return $config;
}

function oceanos_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    oceanos_send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function oceanos_read_json_request(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function oceanos_is_https_request(): bool
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));

    return $https === 'on' || $https === '1' || $forwardedProto === 'https';
}

function oceanos_send_security_headers(): void
{
    if (headers_sent()) {
        return;
    }

    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: SAMEORIGIN');
    header('Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()');
    if (oceanos_is_https_request()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

function oceanos_pdo_root(): PDO
{
    $config = oceanos_config();
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

function oceanos_pdo(): PDO
{
    $config = oceanos_config();
    $dbName = str_replace('`', '``', (string) $config['db_name']);
    oceanos_pdo_root()->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']),
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    oceanos_ensure_schema($pdo);
    return $pdo;
}

function oceanos_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            display_name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member',
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            visible_modules_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!oceanos_column_exists($pdo, 'oceanos_users', 'visible_modules_json')) {
        $pdo->exec('ALTER TABLE oceanos_users ADD COLUMN visible_modules_json LONGTEXT NULL AFTER is_active');
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_user_ai_settings (
            user_id BIGINT UNSIGNED PRIMARY KEY,
            provider VARCHAR(40) NOT NULL DEFAULT 'groq',
            model VARCHAR(120) NOT NULL DEFAULT 'llama-3.3-70b-versatile',
            api_key_cipher TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_oceanos_ai_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_prestashop_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            shop_url VARCHAR(255) NULL,
            webservice_key_cipher TEXT NULL,
            webservice_key_hint VARCHAR(24) NULL,
            sync_window_days INT UNSIGNED NOT NULL DEFAULT 30,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_company_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            company_name VARCHAR(190) NULL,
            company_phone VARCHAR(80) NULL,
            company_address VARCHAR(255) NULL,
            company_city VARCHAR(190) NULL,
            company_email VARCHAR(190) NULL,
            company_siret VARCHAR(80) NULL,
            company_vat_number VARCHAR(80) NULL,
            company_country_iso VARCHAR(2) NOT NULL DEFAULT 'FR',
            payment_terms VARCHAR(255) NULL,
            quote_validity_days INT UNSIGNED NOT NULL DEFAULT 30,
            footer_note VARCHAR(500) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!oceanos_column_exists($pdo, 'oceanos_company_settings', 'company_vat_number')) {
        $pdo->exec("ALTER TABLE oceanos_company_settings ADD COLUMN company_vat_number VARCHAR(80) NULL AFTER company_siret");
    }
    if (!oceanos_column_exists($pdo, 'oceanos_company_settings', 'company_country_iso')) {
        $pdo->exec("ALTER TABLE oceanos_company_settings ADD COLUMN company_country_iso VARCHAR(2) NOT NULL DEFAULT 'FR' AFTER company_vat_number");
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_notifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            module VARCHAR(80) NOT NULL DEFAULT 'OceanOS',
            type VARCHAR(80) NOT NULL DEFAULT 'info',
            severity VARCHAR(20) NOT NULL DEFAULT 'info',
            title VARCHAR(190) NOT NULL,
            body TEXT NULL,
            action_url VARCHAR(500) NULL,
            dedupe_key VARCHAR(190) NULL,
            payload_json LONGTEXT NULL,
            read_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_oceanos_notification_dedupe (user_id, dedupe_key),
            KEY idx_oceanos_notifications_user_created (user_id, created_at),
            KEY idx_oceanos_notifications_user_read (user_id, read_at),
            CONSTRAINT fk_oceanos_notifications_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE,
            CONSTRAINT fk_oceanos_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_push_subscriptions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            endpoint_hash CHAR(64) NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            user_agent VARCHAR(500) NULL,
            failure_count INT UNSIGNED NOT NULL DEFAULT 0,
            last_success_at DATETIME NULL,
            failed_at DATETIME NULL,
            last_error VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_oceanos_push_endpoint_hash (endpoint_hash),
            KEY idx_oceanos_push_user (user_id),
            CONSTRAINT fk_oceanos_push_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nautipost_history (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            network VARCHAR(40) NOT NULL,
            post_text LONGTEXT NOT NULL,
            image_data LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_nautipost_history_user_created (user_id, created_at),
            CONSTRAINT fk_nautipost_history_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    oceanos_import_legacy_flowcean_users($pdo);
    oceanos_migrate_legacy_prestashop_settings($pdo);
    oceanos_company_settings_row($pdo);
    oceanos_cleanup_removed_mobywork($pdo);
}

function oceanos_table_exists(PDO $pdo, string $table): bool
{
    $config = oceanos_config();
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

function oceanos_column_exists(PDO $pdo, string $table, string $column): bool
{
    $config = oceanos_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $statement->execute([
        'db_name' => (string) $config['db_name'],
        'table_name' => $table,
        'column_name' => $column,
    ]);

    return (int) $statement->fetchColumn() > 0;
}

function oceanos_cleanup_removed_mobywork(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    try {
        if (oceanos_table_exists($pdo, 'oceanos_notifications')) {
            $pdo->exec(
                "DELETE FROM oceanos_notifications
                 WHERE module = 'Mobywork'
                    OR type LIKE 'mobywork%'
                    OR dedupe_key LIKE 'mobywork%'
                    OR action_url LIKE '/Mobywork/%'
                    OR payload_json LIKE '%Mobywork%'
                    OR title LIKE '%Mobywork%'
                    OR body LIKE '%Mobywork%'"
            );
        }

        if (oceanos_table_exists($pdo, 'oceanos_users') && oceanos_column_exists($pdo, 'oceanos_users', 'visible_modules_json')) {
            $rows = $pdo->query('SELECT id, visible_modules_json FROM oceanos_users')->fetchAll();
            $update = $pdo->prepare('UPDATE oceanos_users SET visible_modules_json = :modules WHERE id = :id');
            foreach ($rows as $row) {
                $json = trim((string) ($row['visible_modules_json'] ?? ''));
                if ($json === '') {
                    continue;
                }
                $modules = json_decode($json, true);
                if (!is_array($modules)) {
                    continue;
                }
                $filtered = array_values(array_filter(
                    $modules,
                    static fn(mixed $module): bool => strtolower(trim((string) $module)) !== 'mobywork'
                ));
                if ($filtered !== $modules) {
                    $update->execute([
                        'modules' => json_encode($filtered, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        'id' => (int) $row['id'],
                    ]);
                }
            }
        }

        $config = oceanos_config();
        $statement = $pdo->prepare(
            "SELECT TABLE_NAME
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = :db_name
               AND TABLE_NAME LIKE 'mobywork\\_%' ESCAPE '\\\\'"
        );
        $statement->execute(['db_name' => (string) $config['db_name']]);
        foreach ($statement->fetchAll(PDO::FETCH_COLUMN) ?: [] as $table) {
            if (preg_match('/^mobywork_[A-Za-z0-9_]+$/', (string) $table) !== 1) {
                continue;
            }
            $pdo->exec('DROP TABLE IF EXISTS `' . str_replace('`', '``', (string) $table) . '`');
        }
    } catch (Throwable) {
        // Le nettoyage sera retente lors d'une prochaine initialisation OceanOS.
    }
}

function oceanos_import_legacy_flowcean_users(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM oceanos_users')->fetchColumn() > 0) {
        return;
    }

    try {
        $config = oceanos_config();
        $candidateDatabases = array_values(array_unique(array_filter([
            (string) ($config['db_name'] ?? 'OceanOS'),
            (string) (getenv('FLOWCEAN_DB_NAME') ?: 'flowcean'),
        ])));

        foreach ($candidateDatabases as $legacyDb) {
            $statement = $pdo->prepare(
                'SELECT COUNT(*) FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name'
            );
            $statement->execute([
                'db_name' => $legacyDb,
                'table_name' => 'users',
            ]);
            if ((int) $statement->fetchColumn() === 0) {
                continue;
            }

            $legacyName = str_replace('`', '``', $legacyDb);
            $pdo->exec(
                "INSERT IGNORE INTO oceanos_users (id, email, display_name, password_hash, role, is_active, created_at, updated_at)
                 SELECT id, email, display_name, password_hash, role, is_active, created_at, updated_at
                 FROM `{$legacyName}`.`users`"
            );
            return;
        }
    } catch (Throwable) {
        // L'import est un confort de migration; OceanOS reste initialisable sans ancienne base.
    }
}

function oceanos_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');

    session_name('OCEANOSESSID');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 8,
        'path' => '/',
        'secure' => oceanos_is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function oceanos_user_count(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM oceanos_users')->fetchColumn();
}

function oceanos_needs_bootstrap(PDO $pdo): bool
{
    return oceanos_user_count($pdo) === 0;
}

function oceanos_normalize_role(?string $role): string
{
    $normalized = strtolower(trim((string) $role));
    return in_array($normalized, ['super', 'admin'], true) ? $normalized : 'member';
}

function oceanos_is_super_user(array $user): bool
{
    return (string) ($user['role'] ?? 'member') === 'super';
}

function oceanos_store_session_user(array $user): void
{
    $_SESSION['oceanos_user_id'] = (int) $user['id'];
    $_SESSION['oceanos_user_role'] = (string) ($user['role'] ?? 'member');
    $_SESSION['oceanos_user_email'] = (string) ($user['email'] ?? '');
    $_SESSION['oceanos_user_name'] = (string) ($user['display_name'] ?? '');
}

function oceanos_user_permissions(array $user): array
{
    $isSuper = oceanos_is_super_user($user);
    $isAdmin = $isSuper || (($user['role'] ?? 'member') === 'admin');

    return [
        'canManageUsers' => $isAdmin,
        'canCreateAdmins' => $isAdmin,
        'canManageModuleAccess' => $isAdmin,
        'canManageWorkspace' => $isAdmin,
        'canManagePrestashop' => $isAdmin,
        'canManageCompany' => $isAdmin,
        'canManageServices' => $isAdmin,
        'canAccessAllWorkspaces' => $isSuper,
        'canSuperviseEverything' => $isSuper,
    ];
}

function oceanos_available_module_ids(): array
{
    return [
        'pilotocean',
        'agenda',
        'flowcean',
        'invocean',
        'devis',
        'commandes',
        'portailclient',
        'pimcean',
        'sav',
        'stockcean',
        'contratocean',
        'qualiocean',
        'tresorcean',
        'dataocean',
        'nauticrm',
        'prospection',
        'nautimail',
        'nautipost',
        'nauticloud',
        'formcean',
        'nautisign',
        'naviplan',
        'visiocean',
        'meetocean',
    ];
}

function oceanos_normalize_visible_modules(mixed $modules, ?array $fallback = null): array
{
    if (!is_array($modules)) {
        return $fallback ?? oceanos_available_module_ids();
    }

    $selected = [];
    foreach ($modules as $module) {
        $moduleId = strtolower(trim((string) $module));
        if ($moduleId !== '') {
            $selected[$moduleId] = true;
        }
    }

    return array_values(array_filter(
        oceanos_available_module_ids(),
        static fn(string $moduleId): bool => isset($selected[$moduleId])
    ));
}

function oceanos_decode_visible_modules(?string $json): array
{
    $json = trim((string) $json);
    if ($json === '') {
        return oceanos_available_module_ids();
    }

    $decoded = json_decode($json, true);
    $modules = oceanos_normalize_visible_modules($decoded);
    $legacyModules = ['flowcean', 'invocean', 'stockcean', 'nautipost'];
    if (!in_array('nauticloud', $modules, true) && count(array_diff($legacyModules, $modules)) === 0) {
        $modules[] = 'nauticloud';
    }
    $legacyModulesWithCloud = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud'];
    if (!in_array('formcean', $modules, true) && count(array_diff($legacyModulesWithCloud, $modules)) === 0) {
        $modules[] = 'formcean';
    }
    $legacyModulesWithFormcean = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean'];
    if (!in_array('nautisign', $modules, true) && count(array_diff($legacyModulesWithFormcean, $modules)) === 0) {
        $modules[] = 'nautisign';
    }
    $legacyModulesWithNautisign = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign'];
    if (!in_array('naviplan', $modules, true) && count(array_diff($legacyModulesWithNautisign, $modules)) === 0) {
        $modules[] = 'naviplan';
    }
    $legacyModulesWithNaviplan = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan'];
    if (!in_array('visiocean', $modules, true) && count(array_diff($legacyModulesWithNaviplan, $modules)) === 0) {
        $modules[] = 'visiocean';
    }
    $legacyModulesWithVisiocean = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean'];
    if (!in_array('meetocean', $modules, true) && count(array_diff($legacyModulesWithVisiocean, $modules)) === 0) {
        $modules[] = 'meetocean';
    }
    $legacyModulesWithMeetOcean = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean'];
    if (!in_array('agenda', $modules, true) && count(array_diff($legacyModulesWithMeetOcean, $modules)) === 0) {
        $modules[] = 'agenda';
    }
    $legacyModulesWithAgenda = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda'];
    if (!in_array('nauticrm', $modules, true) && count(array_diff($legacyModulesWithAgenda, $modules)) === 0) {
        $modules[] = 'nauticrm';
    }
    $legacyModulesWithNautiCRM = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm'];
    if (!in_array('prospection', $modules, true) && count(array_diff($legacyModulesWithNautiCRM, $modules)) === 0) {
        $modules[] = 'prospection';
    }
    $legacyModulesWithProspection = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'prospection'];
    if (!in_array('nautimail', $modules, true) && (count(array_diff($legacyModulesWithNautiCRM, $modules)) === 0 || count(array_diff($legacyModulesWithProspection, $modules)) === 0)) {
        $modules[] = 'nautimail';
    }
    $legacyModulesWithNautiMail = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'prospection', 'nautimail'];
    if (!in_array('devis', $modules, true) && count(array_diff($legacyModulesWithNautiMail, $modules)) === 0) {
        $modules[] = 'devis';
    }
    $legacyModulesWithDevis = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'nautimail', 'devis'];
    if (!in_array('commandes', $modules, true) && count(array_diff($legacyModulesWithDevis, $modules)) === 0) {
        $modules[] = 'commandes';
    }
    $legacyModulesWithCommandes = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'nautimail', 'devis', 'commandes'];
    if (!in_array('sav', $modules, true) && count(array_diff($legacyModulesWithCommandes, $modules)) === 0) {
        $modules[] = 'sav';
    }
    $legacyModulesWithSav = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'nautimail', 'devis', 'commandes', 'sav'];
    if (!in_array('tresorcean', $modules, true) && count(array_diff($legacyModulesWithSav, $modules)) === 0) {
        $modules[] = 'tresorcean';
    }
    $legacyModulesWithTresorcean = ['flowcean', 'invocean', 'stockcean', 'nautipost', 'nauticloud', 'formcean', 'nautisign', 'naviplan', 'visiocean', 'meetocean', 'agenda', 'nauticrm', 'nautimail', 'devis', 'commandes', 'sav', 'tresorcean'];
    if (count(array_diff($legacyModulesWithTresorcean, $modules)) === 0) {
        foreach (['pilotocean', 'portailclient', 'pimcean', 'contratocean', 'qualiocean', 'dataocean'] as $moduleId) {
            if (!in_array($moduleId, $modules, true)) {
                $modules[] = $moduleId;
            }
        }
    }

    return oceanos_normalize_visible_modules($modules);
}

function oceanos_encode_visible_modules(array $modules): string
{
    return json_encode(oceanos_normalize_visible_modules($modules), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function oceanos_public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'displayName' => (string) $user['display_name'],
        'role' => (string) $user['role'],
        'isActive' => (bool) $user['is_active'],
        'visibleModules' => oceanos_decode_visible_modules($user['visible_modules_json'] ?? null),
        'createdAt' => (string) $user['created_at'],
        'permissions' => oceanos_user_permissions($user),
    ];
}

function oceanos_find_user_by_id(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function oceanos_find_user_by_email(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => mb_strtolower(trim($email))]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function oceanos_current_user(PDO $pdo): ?array
{
    oceanos_start_session();
    $userId = isset($_SESSION['oceanos_user_id']) ? (int) $_SESSION['oceanos_user_id'] : 0;
    if ($userId <= 0) {
        return null;
    }

    $user = oceanos_find_user_by_id($pdo, $userId);
    if ($user === null || !(bool) $user['is_active']) {
        unset(
            $_SESSION['oceanos_user_id'],
            $_SESSION['oceanos_user_role'],
            $_SESSION['oceanos_user_email'],
            $_SESSION['oceanos_user_name']
        );
        return null;
    }

    oceanos_store_session_user($user);
    return $user;
}

function oceanos_require_auth(PDO $pdo): array
{
    $user = oceanos_current_user($pdo);
    if ($user === null) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'unauthenticated',
            'message' => 'Connexion requise.',
        ], 401);
    }

    return $user;
}

function oceanos_require_admin(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    if (!in_array(($user['role'] ?? 'member'), ['super', 'admin'], true)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function oceanos_login_user(PDO $pdo, string $email, string $password): ?array
{
    $user = oceanos_find_user_by_email($pdo, $email);
    if ($user === null || !(bool) $user['is_active'] || !password_verify($password, (string) $user['password_hash'])) {
        return null;
    }

    oceanos_start_session();
    session_regenerate_id(true);
    oceanos_store_session_user($user);
    return $user;
}

function oceanos_logout_user(): void
{
    oceanos_start_session();
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

function oceanos_create_user(PDO $pdo, string $displayName, string $email, string $password, string $role = 'member', ?array $visibleModules = null): array
{
    $displayName = trim($displayName);
    $email = mb_strtolower(trim($email));
    $role = oceanos_normalize_role($role);
    $visibleModulesJson = oceanos_encode_visible_modules($visibleModules ?? oceanos_available_module_ids());

    if ($displayName === '' || $email === '' || $password === '') {
        throw new InvalidArgumentException('Nom, email et mot de passe sont obligatoires.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }
    if (mb_strlen($password) < 8) {
        throw new InvalidArgumentException('Le mot de passe doit contenir au moins 8 caracteres.');
    }
    if (oceanos_find_user_by_email($pdo, $email) !== null) {
        throw new InvalidArgumentException('Un compte existe deja avec cet email.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO oceanos_users (email, display_name, password_hash, role, is_active, visible_modules_json)
         VALUES (:email, :display_name, :password_hash, :role, 1, :visible_modules_json)'
    );
    $statement->execute([
        'email' => $email,
        'display_name' => $displayName,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
        'visible_modules_json' => $visibleModulesJson,
    ]);

    $user = oceanos_find_user_by_id($pdo, (int) $pdo->lastInsertId());
    if ($user === null) {
        throw new RuntimeException('Impossible de creer le compte.');
    }

    return $user;
}

function oceanos_bootstrap_admin(PDO $pdo, string $displayName, string $email, string $password): array
{
    if (!oceanos_needs_bootstrap($pdo)) {
        throw new RuntimeException('Le bootstrap initial a deja ete effectue.');
    }

    $user = oceanos_create_user($pdo, $displayName, $email, $password, 'super');
    oceanos_start_session();
    session_regenerate_id(true);
    oceanos_store_session_user($user);
    return $user;
}

function oceanos_active_admin_count(PDO $pdo, ?int $excludeUserId = null): int
{
    if ($excludeUserId !== null) {
        $statement = $pdo->prepare("SELECT COUNT(*) FROM oceanos_users WHERE role IN ('super', 'admin') AND is_active = 1 AND id <> :user_id");
        $statement->execute(['user_id' => $excludeUserId]);
        return (int) $statement->fetchColumn();
    }

    return (int) $pdo->query("SELECT COUNT(*) FROM oceanos_users WHERE role IN ('super', 'admin') AND is_active = 1")->fetchColumn();
}

function oceanos_update_user(PDO $pdo, int $targetUserId, array $input, array $actorUser): array
{
    $target = oceanos_find_user_by_id($pdo, $targetUserId);
    if ($target === null) {
        throw new InvalidArgumentException('Utilisateur introuvable.');
    }

    $displayName = array_key_exists('displayName', $input) ? trim((string) $input['displayName']) : (string) $target['display_name'];
    $email = array_key_exists('email', $input) ? mb_strtolower(trim((string) $input['email'])) : (string) $target['email'];
    $role = array_key_exists('role', $input) ? oceanos_normalize_role((string) $input['role']) : (string) $target['role'];
    $isActive = array_key_exists('isActive', $input) ? (bool) $input['isActive'] : (bool) $target['is_active'];
    $visibleModules = array_key_exists('visibleModules', $input)
        ? oceanos_normalize_visible_modules($input['visibleModules'], oceanos_decode_visible_modules($target['visible_modules_json'] ?? null))
        : oceanos_decode_visible_modules($target['visible_modules_json'] ?? null);

    if ($displayName === '' || $email === '') {
        throw new InvalidArgumentException('Nom et email sont obligatoires.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }
    if ($role === 'super' && !oceanos_is_super_user($actorUser)) {
        throw new InvalidArgumentException('Seul un super-utilisateur peut attribuer le role super.');
    }
    if (array_key_exists('visibleModules', $input) && !oceanos_is_super_user($actorUser) && in_array((string) $target['role'], ['super', 'admin'], true)) {
        throw new InvalidArgumentException('Seul un super-utilisateur peut modifier les modules visibles d un administrateur.');
    }
    if (!$isActive && in_array((string) $target['role'], ['super', 'admin'], true) && oceanos_active_admin_count($pdo, $targetUserId) === 0) {
        throw new InvalidArgumentException('Impossible de desactiver le dernier administrateur actif.');
    }

    $statement = $pdo->prepare(
        'UPDATE oceanos_users
         SET display_name = :display_name,
             email = :email,
             role = :role,
             is_active = :is_active,
             visible_modules_json = :visible_modules_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $targetUserId,
        'display_name' => $displayName,
        'email' => $email,
        'role' => $role,
        'is_active' => $isActive ? 1 : 0,
        'visible_modules_json' => oceanos_encode_visible_modules($visibleModules),
    ]);

    $user = oceanos_find_user_by_id($pdo, $targetUserId);
    if ($user === null) {
        throw new RuntimeException('Impossible de relire le compte.');
    }
    return $user;
}

function oceanos_delete_user(PDO $pdo, int $targetUserId, array $actorUser): void
{
    if ($targetUserId === (int) $actorUser['id']) {
        throw new InvalidArgumentException('Vous ne pouvez pas supprimer votre propre compte.');
    }

    $target = oceanos_find_user_by_id($pdo, $targetUserId);
    if ($target === null) {
        throw new InvalidArgumentException('Utilisateur introuvable.');
    }
    if (in_array((string) $target['role'], ['super', 'admin'], true) && oceanos_active_admin_count($pdo, $targetUserId) === 0) {
        throw new InvalidArgumentException('Impossible de supprimer le dernier administrateur actif.');
    }

    $statement = $pdo->prepare('DELETE FROM oceanos_users WHERE id = :id');
    $statement->execute(['id' => $targetUserId]);
}

function oceanos_list_users(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM oceanos_users ORDER BY created_at ASC, id ASC')->fetchAll();
    return array_map(static fn(array $row): array => oceanos_public_user($row), $rows);
}

function oceanos_active_user_ids(PDO $pdo, array $roles = []): array
{
    $roles = array_values(array_filter(array_map(static fn($role): string => oceanos_normalize_role((string) $role), $roles)));
    if ($roles === []) {
        $rows = $pdo->query('SELECT id FROM oceanos_users WHERE is_active = 1 ORDER BY id ASC')->fetchAll();
        return array_map(static fn(array $row): int => (int) $row['id'], $rows);
    }

    $placeholders = [];
    $params = [];
    foreach ($roles as $index => $role) {
        $key = 'role_' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $role;
    }

    $statement = $pdo->prepare(
        'SELECT id
         FROM oceanos_users
         WHERE is_active = 1 AND role IN (' . implode(',', $placeholders) . ')
         ORDER BY id ASC'
    );
    $statement->execute($params);

    return array_map(static fn(array $row): int => (int) $row['id'], $statement->fetchAll());
}

function oceanos_normalize_notification_severity(string $severity): string
{
    $severity = strtolower(trim($severity));
    return in_array($severity, ['info', 'success', 'warning', 'danger'], true) ? $severity : 'info';
}

function oceanos_create_notification(
    PDO $pdo,
    int $userId,
    ?int $actorUserId,
    string $module,
    string $type,
    string $severity,
    string $title,
    ?string $body = null,
    ?string $actionUrl = null,
    array $payload = [],
    ?string $dedupeKey = null
): ?int {
    if ($userId <= 0) {
        return null;
    }

    $module = mb_substr(trim($module) !== '' ? trim($module) : 'OceanOS', 0, 80);
    $type = mb_substr(trim($type) !== '' ? trim($type) : 'info', 0, 80);
    $severity = oceanos_normalize_notification_severity($severity);
    $title = mb_substr(trim($title) !== '' ? trim($title) : 'Notification', 0, 190);
    $body = $body !== null && trim($body) !== '' ? trim($body) : null;
    $actionUrl = $actionUrl !== null && trim($actionUrl) !== '' ? mb_substr(trim($actionUrl), 0, 500) : null;
    $dedupeKey = $dedupeKey !== null && trim($dedupeKey) !== '' ? mb_substr(trim($dedupeKey), 0, 190) : null;
    $payloadJson = $payload !== [] ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
    $fingerprint = oceanos_notification_fingerprint($module, $type, $severity, $title, $body, $actionUrl, $payloadJson);
    $shouldPush = true;

    if ($dedupeKey !== null) {
        $existingStatement = $pdo->prepare(
            'SELECT module, type, severity, title, body, action_url, payload_json
             FROM oceanos_notifications
             WHERE user_id = :user_id AND dedupe_key = :dedupe_key
             LIMIT 1'
        );
        $existingStatement->execute([
            'user_id' => $userId,
            'dedupe_key' => $dedupeKey,
        ]);
        $existing = $existingStatement->fetch();
        if (is_array($existing)) {
            $shouldPush = $fingerprint !== oceanos_notification_fingerprint(
                (string) ($existing['module'] ?? 'OceanOS'),
                (string) ($existing['type'] ?? 'info'),
                oceanos_normalize_notification_severity((string) ($existing['severity'] ?? 'info')),
                (string) ($existing['title'] ?? 'Notification'),
                $existing['body'] !== null ? (string) $existing['body'] : null,
                $existing['action_url'] !== null ? (string) $existing['action_url'] : null,
                $existing['payload_json'] !== null ? (string) $existing['payload_json'] : null
            );
        }
    }

    $statement = $pdo->prepare(
        'INSERT INTO oceanos_notifications
            (user_id, actor_user_id, module, type, severity, title, body, action_url, dedupe_key, payload_json)
         VALUES
            (:user_id, :actor_user_id, :module, :type, :severity, :title, :body, :action_url, :dedupe_key, :payload_json)
         ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            actor_user_id = VALUES(actor_user_id),
            module = VALUES(module),
            type = VALUES(type),
            severity = VALUES(severity),
            title = VALUES(title),
            body = VALUES(body),
            action_url = VALUES(action_url),
            payload_json = VALUES(payload_json),
            read_at = NULL,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'actor_user_id' => $actorUserId !== null && $actorUserId > 0 ? $actorUserId : null,
        'module' => $module,
        'type' => $type,
        'severity' => $severity,
        'title' => $title,
        'body' => $body,
        'action_url' => $actionUrl,
        'dedupe_key' => $dedupeKey,
        'payload_json' => $payloadJson,
    ]);

    $notificationId = (int) $pdo->lastInsertId();
    if ($shouldPush) {
        try {
            oceanos_dispatch_push_notification($pdo, $userId, [
                'id' => $notificationId,
                'module' => $module,
                'type' => $type,
                'severity' => $severity,
                'title' => $title,
                'body' => $body,
                'action_url' => $actionUrl,
                'payload' => $payload,
            ]);
        } catch (Throwable) {
            // Une erreur push ne doit jamais bloquer la notification OceanOS.
        }
    }

    return $notificationId > 0 ? $notificationId : null;
}

function oceanos_public_notification(array $row): array
{
    $payload = json_decode((string) ($row['payload_json'] ?? ''), true);

    return [
        'id' => (int) $row['id'],
        'module' => (string) ($row['module'] ?? 'OceanOS'),
        'type' => (string) ($row['type'] ?? 'info'),
        'severity' => oceanos_normalize_notification_severity((string) ($row['severity'] ?? 'info')),
        'title' => (string) ($row['title'] ?? 'Notification'),
        'body' => $row['body'] !== null ? (string) $row['body'] : '',
        'actionUrl' => $row['action_url'] !== null ? (string) $row['action_url'] : '',
        'payload' => is_array($payload) ? $payload : [],
        'actorUserId' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
        'actorDisplayName' => $row['actor_display_name'] ?: null,
        'actorEmail' => $row['actor_email'] ?: null,
        'read' => $row['read_at'] !== null,
        'readAt' => $row['read_at'] !== null ? (string) $row['read_at'] : null,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function oceanos_list_notifications(PDO $pdo, int $userId, int $limit = 40): array
{
    $statement = $pdo->prepare(
        'SELECT
            n.*,
            u.display_name AS actor_display_name,
            u.email AS actor_email
         FROM oceanos_notifications n
         LEFT JOIN oceanos_users u ON u.id = n.actor_user_id
         WHERE n.user_id = :user_id
         ORDER BY n.updated_at DESC, n.id DESC
         LIMIT :limit'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $statement->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
    $statement->execute();

    return array_map(static fn(array $row): array => oceanos_public_notification($row), $statement->fetchAll());
}

function oceanos_unread_notification_count(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM oceanos_notifications WHERE user_id = :user_id AND read_at IS NULL'
    );
    $statement->execute(['user_id' => $userId]);

    return (int) $statement->fetchColumn();
}

function oceanos_mark_notification_read(PDO $pdo, int $userId, int $notificationId): void
{
    $statement = $pdo->prepare(
        'UPDATE oceanos_notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = :id AND user_id = :user_id'
    );
    $statement->execute([
        'id' => $notificationId,
        'user_id' => $userId,
    ]);
}

function oceanos_mark_all_notifications_read(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare(
        'UPDATE oceanos_notifications
         SET read_at = COALESCE(read_at, NOW())
         WHERE user_id = :user_id AND read_at IS NULL'
    );
    $statement->execute(['user_id' => $userId]);
}

function oceanos_notification_fingerprint(
    string $module,
    string $type,
    string $severity,
    string $title,
    ?string $body,
    ?string $actionUrl,
    ?string $payloadJson
): string {
    return hash('sha256', json_encode([
        'module' => $module,
        'type' => $type,
        'severity' => $severity,
        'title' => $title,
        'body' => $body,
        'actionUrl' => $actionUrl,
        'payload' => $payloadJson,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function oceanos_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function oceanos_base64url_decode(string $data): string
{
    $data = strtr(trim($data), '-_', '+/');
    $padding = strlen($data) % 4;
    if ($padding > 0) {
        $data .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode($data, true);
    return $decoded === false ? '' : $decoded;
}

function oceanos_push_is_available(): bool
{
    $ciphers = function_exists('openssl_get_cipher_methods')
        ? array_map('strtolower', openssl_get_cipher_methods(true))
        : [];

    return function_exists('curl_init')
        && function_exists('openssl_pkey_new')
        && function_exists('openssl_pkey_derive')
        && function_exists('openssl_sign')
        && function_exists('openssl_encrypt')
        && in_array('aes-128-gcm', $ciphers, true);
}

function oceanos_push_config_file(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'push.local.php';
}

function oceanos_push_default_subject(): string
{
    $subject = trim((string) (getenv('OCEANOS_VAPID_SUBJECT') ?: ''));
    if ($subject !== '') {
        return $subject;
    }

    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? 'localhost')));
    $host = preg_replace('/:\d+$/', '', $host) ?: 'localhost';
    if (preg_match('/^[a-z0-9.-]+$/', $host) === 1 && $host !== 'localhost') {
        return 'mailto:admin@' . $host;
    }

    return 'mailto:admin@localhost';
}

function oceanos_push_normalize_config(array $config): array
{
    $publicKey = trim((string) ($config['publicKey'] ?? $config['public_key'] ?? ''));
    $privateKey = trim((string) ($config['privateKey'] ?? $config['private_key'] ?? ''));
    $subject = trim((string) ($config['subject'] ?? ''));

    if ($privateKey !== '') {
        $privateKey = str_replace('\\n', "\n", $privateKey);
        $decodedPrivateKey = base64_decode($privateKey, true);
        if (is_string($decodedPrivateKey) && str_contains($decodedPrivateKey, 'BEGIN')) {
            $privateKey = $decodedPrivateKey;
        }
    }

    if ($subject === '') {
        $subject = oceanos_push_default_subject();
    }
    if ($publicKey === '' || $privateKey === '' || strlen(oceanos_base64url_decode($publicKey)) !== 65) {
        return [];
    }

    return [
        'publicKey' => $publicKey,
        'privateKey' => $privateKey,
        'subject' => $subject,
    ];
}

function oceanos_openssl_config_path(): string
{
    $candidates = array_filter([
        (string) (getenv('OPENSSL_CONF') ?: ''),
        dirname(PHP_BINARY) . DIRECTORY_SEPARATOR . 'extras' . DIRECTORY_SEPARATOR . 'ssl' . DIRECTORY_SEPARATOR . 'openssl.cnf',
    ]);

    foreach (glob(str_replace('\\', '/', dirname(PHP_BINARY, 3)) . '/apache/*/conf/openssl.cnf') ?: [] as $path) {
        $candidates[] = $path;
    }

    foreach ($candidates as $candidate) {
        if ($candidate !== '' && is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    return '';
}

function oceanos_openssl_options(array $options): array
{
    $configPath = oceanos_openssl_config_path();
    if ($configPath !== '') {
        $options['config'] = $configPath;
    }

    return $options;
}

function oceanos_push_generate_vapid_config(): array
{
    if (!oceanos_push_is_available()) {
        return [];
    }

    $key = openssl_pkey_new(oceanos_openssl_options([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]));
    if ($key === false) {
        return [];
    }

    $privateKey = '';
    if (!openssl_pkey_export($key, $privateKey, null, oceanos_openssl_options([]))) {
        return [];
    }

    $details = openssl_pkey_get_details($key);
    $x = is_array($details) ? (string) ($details['ec']['x'] ?? '') : '';
    $y = is_array($details) ? (string) ($details['ec']['y'] ?? '') : '';
    if (strlen($x) !== 32 || strlen($y) !== 32) {
        return [];
    }

    return [
        'publicKey' => oceanos_base64url_encode("\x04" . $x . $y),
        'privateKey' => $privateKey,
        'subject' => oceanos_push_default_subject(),
    ];
}

function oceanos_push_vapid_config(bool $allowGenerate = true): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $envConfig = oceanos_push_normalize_config([
        'publicKey' => getenv('OCEANOS_VAPID_PUBLIC_KEY') ?: '',
        'privateKey' => getenv('OCEANOS_VAPID_PRIVATE_KEY') ?: '',
        'subject' => getenv('OCEANOS_VAPID_SUBJECT') ?: '',
    ]);
    if ($envConfig !== []) {
        $config = $envConfig;
        return $config;
    }

    $file = oceanos_push_config_file();
    if (is_file($file)) {
        $loaded = require $file;
        $fileConfig = is_array($loaded) ? oceanos_push_normalize_config($loaded) : [];
        if ($fileConfig !== []) {
            $config = $fileConfig;
            return $config;
        }
    }

    if ($allowGenerate && is_dir(dirname($file)) && is_writable(dirname($file))) {
        $generated = oceanos_push_generate_vapid_config();
        if ($generated !== []) {
            $export = "<?php\nreturn " . var_export($generated, true) . ";\n";
            @file_put_contents($file, $export, LOCK_EX);
            $config = $generated;
            return $config;
        }
    }

    $config = [];
    return $config;
}

function oceanos_push_public_status(PDO $pdo, int $userId): array
{
    $config = oceanos_push_vapid_config();
    $available = oceanos_push_is_available() && $config !== [];
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM oceanos_push_subscriptions
         WHERE user_id = :user_id AND failure_count < 5'
    );
    $statement->execute(['user_id' => $userId]);

    return [
        'available' => $available,
        'publicKey' => $available ? $config['publicKey'] : '',
        'subscribed' => (int) $statement->fetchColumn() > 0,
        'secureRequest' => oceanos_is_https_request(),
    ];
}

function oceanos_store_push_subscription(PDO $pdo, int $userId, array $subscription): array
{
    $endpoint = trim((string) ($subscription['endpoint'] ?? ''));
    $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
    $p256dh = trim((string) ($keys['p256dh'] ?? ''));
    $auth = trim((string) ($keys['auth'] ?? ''));

    if ($userId <= 0 || $endpoint === '' || filter_var($endpoint, FILTER_VALIDATE_URL) === false || !str_starts_with($endpoint, 'https://')) {
        throw new InvalidArgumentException('Abonnement push invalide.');
    }
    if (strlen(oceanos_base64url_decode($p256dh)) !== 65 || strlen(oceanos_base64url_decode($auth)) < 16) {
        throw new InvalidArgumentException('Cles push invalides.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO oceanos_push_subscriptions
            (user_id, endpoint_hash, endpoint, p256dh, auth, user_agent)
         VALUES
            (:user_id, :endpoint_hash, :endpoint, :p256dh, :auth, :user_agent)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            endpoint = VALUES(endpoint),
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            user_agent = VALUES(user_agent),
            failure_count = 0,
            failed_at = NULL,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'endpoint_hash' => hash('sha256', $endpoint),
        'endpoint' => $endpoint,
        'p256dh' => $p256dh,
        'auth' => $auth,
        'user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
    ]);

    return oceanos_push_public_status($pdo, $userId);
}

function oceanos_delete_push_subscription(PDO $pdo, int $userId, string $endpoint = ''): array
{
    if (trim($endpoint) === '') {
        $statement = $pdo->prepare('DELETE FROM oceanos_push_subscriptions WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
        return oceanos_push_public_status($pdo, $userId);
    }

    $statement = $pdo->prepare(
        'DELETE FROM oceanos_push_subscriptions
         WHERE user_id = :user_id AND endpoint_hash = :endpoint_hash'
    );
    $statement->execute([
        'user_id' => $userId,
        'endpoint_hash' => hash('sha256', trim($endpoint)),
    ]);

    return oceanos_push_public_status($pdo, $userId);
}

function oceanos_push_subscription_rows(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT *
         FROM oceanos_push_subscriptions
         WHERE user_id = :user_id AND failure_count < 5
         ORDER BY updated_at DESC'
    );
    $statement->execute(['user_id' => $userId]);

    return $statement->fetchAll() ?: [];
}

function oceanos_push_target_url(array $notification): string
{
    $payload = is_array($notification['payload'] ?? null) ? $notification['payload'] : [];
    $messageId = (int) ($payload['messageId'] ?? 0);
    $module = (string) ($notification['module'] ?? 'OceanOS');
    $type = (string) ($notification['type'] ?? 'info');
    if (($module === 'NautiMail' || $type === 'new_mail') && $messageId > 0) {
        return '/NautiMail/?messageId=' . rawurlencode((string) $messageId);
    }

    $actionUrl = trim((string) ($notification['action_url'] ?? ''));
    return $actionUrl !== '' ? $actionUrl : '/OceanOS/';
}

function oceanos_dispatch_push_notification(PDO $pdo, int $userId, array $notification): void
{
    $config = oceanos_push_vapid_config();
    if ($userId <= 0 || !oceanos_push_is_available() || $config === []) {
        return;
    }

    $notificationId = (int) ($notification['id'] ?? 0);
    $badgeCount = oceanos_unread_notification_count($pdo, $userId);
    $payload = [
        'title' => mb_substr((string) ($notification['title'] ?? 'OceanOS'), 0, 120),
        'body' => mb_substr((string) ($notification['body'] ?? ''), 0, 240),
        'module' => (string) ($notification['module'] ?? 'OceanOS'),
        'severity' => oceanos_normalize_notification_severity((string) ($notification['severity'] ?? 'info')),
        'url' => oceanos_push_target_url($notification),
        'notificationId' => $notificationId,
        'badgeCount' => $badgeCount,
        'tag' => $notificationId > 0 ? 'oceanos-' . $notificationId : 'oceanos-' . hash('sha256', serialize($notification)),
        'icon' => '/OceanOS/assets/favicons/oceanos-192.png',
        'badge' => '/OceanOS/assets/favicons/oceanos-192.png',
    ];
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || $json === '') {
        return;
    }

    foreach (oceanos_push_subscription_rows($pdo, $userId) as $subscription) {
        oceanos_send_push_payload($pdo, $subscription, $config, $json);
    }
}

function oceanos_push_public_key_pem(string $rawPublicKey): string
{
    $prefix = hex2bin('3059301306072A8648CE3D020106082A8648CE3D030107034200');
    $der = ($prefix === false ? '' : $prefix) . $rawPublicKey;

    return "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
}

function oceanos_hkdf_sha256(string $ikm, int $length, string $info, string $salt): string
{
    if ($salt === '') {
        $salt = str_repeat("\x00", 32);
    }

    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $okm = '';
    $previous = '';
    $counter = 1;
    while (strlen($okm) < $length) {
        $previous = hash_hmac('sha256', $previous . $info . chr($counter), $prk, true);
        $okm .= $previous;
        $counter++;
    }

    return substr($okm, 0, $length);
}

function oceanos_encrypt_push_payload(string $payloadJson, string $p256dh, string $auth): ?string
{
    $userPublicKey = oceanos_base64url_decode($p256dh);
    $authSecret = oceanos_base64url_decode($auth);
    if (strlen($userPublicKey) !== 65 || strlen($authSecret) < 16) {
        return null;
    }

    $userKey = openssl_pkey_get_public(oceanos_push_public_key_pem($userPublicKey));
    if ($userKey === false) {
        return null;
    }

    $ephemeralKey = openssl_pkey_new(oceanos_openssl_options([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]));
    if ($ephemeralKey === false) {
        return null;
    }

    $details = openssl_pkey_get_details($ephemeralKey);
    $x = is_array($details) ? (string) ($details['ec']['x'] ?? '') : '';
    $y = is_array($details) ? (string) ($details['ec']['y'] ?? '') : '';
    if (strlen($x) !== 32 || strlen($y) !== 32) {
        return null;
    }

    $ephemeralPublicKey = "\x04" . $x . $y;
    $sharedSecret = openssl_pkey_derive($userKey, $ephemeralKey, 32);
    if (!is_string($sharedSecret) || strlen($sharedSecret) === 0) {
        return null;
    }

    $salt = random_bytes(16);
    $keyInfo = "WebPush: info\x00" . $userPublicKey . $ephemeralPublicKey;
    $ikm = oceanos_hkdf_sha256($sharedSecret, 32, $keyInfo, $authSecret);
    $cek = oceanos_hkdf_sha256($ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
    $nonce = oceanos_hkdf_sha256($ikm, 12, "Content-Encoding: nonce\x00", $salt);
    $tag = '';
    $ciphertext = openssl_encrypt($payloadJson . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if (!is_string($ciphertext) || strlen($tag) !== 16) {
        return null;
    }

    return $salt . pack('N', 4096) . chr(strlen($ephemeralPublicKey)) . $ephemeralPublicKey . $ciphertext . $tag;
}

function oceanos_der_read_length(string $der, int &$offset): int
{
    if ($offset >= strlen($der)) {
        return 0;
    }

    $length = ord($der[$offset]);
    $offset++;
    if (($length & 0x80) === 0) {
        return $length;
    }

    $bytes = $length & 0x7f;
    $value = 0;
    for ($i = 0; $i < $bytes && $offset < strlen($der); $i++) {
        $value = ($value << 8) + ord($der[$offset]);
        $offset++;
    }

    return $value;
}

function oceanos_ecdsa_part_to_32(string $value): string
{
    $value = ltrim($value, "\x00");
    if (strlen($value) > 32) {
        $value = substr($value, -32);
    }

    return str_pad($value, 32, "\x00", STR_PAD_LEFT);
}

function oceanos_ecdsa_der_to_jose(string $der): string
{
    $offset = 0;
    if ($der === '' || ord($der[$offset]) !== 0x30) {
        return '';
    }
    $offset++;
    oceanos_der_read_length($der, $offset);
    if ($offset >= strlen($der) || ord($der[$offset]) !== 0x02) {
        return '';
    }
    $offset++;
    $rLength = oceanos_der_read_length($der, $offset);
    $r = substr($der, $offset, $rLength);
    $offset += $rLength;
    if ($offset >= strlen($der) || ord($der[$offset]) !== 0x02) {
        return '';
    }
    $offset++;
    $sLength = oceanos_der_read_length($der, $offset);
    $s = substr($der, $offset, $sLength);

    return oceanos_ecdsa_part_to_32($r) . oceanos_ecdsa_part_to_32($s);
}

function oceanos_push_endpoint_origin(string $endpoint): string
{
    $parts = parse_url($endpoint);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return '';
    }

    $origin = strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host']);
    if (!empty($parts['port'])) {
        $origin .= ':' . (int) $parts['port'];
    }

    return $origin;
}

function oceanos_vapid_jwt(string $audience, array $config): string
{
    $headerJson = json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES);
    $claimsJson = json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => (string) $config['subject'],
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($headerJson) || !is_string($claimsJson)) {
        return '';
    }

    $header = oceanos_base64url_encode($headerJson);
    $claims = oceanos_base64url_encode($claimsJson);
    $input = $header . '.' . $claims;
    $signature = '';
    $privateKey = openssl_pkey_get_private((string) $config['privateKey']);
    if ($privateKey === false || !openssl_sign($input, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
        return '';
    }

    $joseSignature = oceanos_ecdsa_der_to_jose($signature);
    return $joseSignature !== '' ? $input . '.' . oceanos_base64url_encode($joseSignature) : '';
}

function oceanos_push_mark_success(PDO $pdo, int $subscriptionId): void
{
    $statement = $pdo->prepare(
        'UPDATE oceanos_push_subscriptions
         SET failure_count = 0, last_success_at = NOW(), failed_at = NULL, last_error = NULL
         WHERE id = :id'
    );
    $statement->execute(['id' => $subscriptionId]);
}

function oceanos_push_mark_failure(PDO $pdo, int $subscriptionId, string $message): void
{
    $statement = $pdo->prepare(
        'UPDATE oceanos_push_subscriptions
         SET failure_count = failure_count + 1, failed_at = NOW(), last_error = :last_error
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $subscriptionId,
        'last_error' => mb_substr($message, 0, 255),
    ]);
}

function oceanos_push_delete_row(PDO $pdo, int $subscriptionId): void
{
    $statement = $pdo->prepare('DELETE FROM oceanos_push_subscriptions WHERE id = :id');
    $statement->execute(['id' => $subscriptionId]);
}

function oceanos_send_push_payload(PDO $pdo, array $subscription, array $config, string $payloadJson): void
{
    $subscriptionId = (int) ($subscription['id'] ?? 0);
    $endpoint = (string) ($subscription['endpoint'] ?? '');
    $audience = oceanos_push_endpoint_origin($endpoint);
    $jwt = $audience !== '' ? oceanos_vapid_jwt($audience, $config) : '';
    $body = oceanos_encrypt_push_payload(
        $payloadJson,
        (string) ($subscription['p256dh'] ?? ''),
        (string) ($subscription['auth'] ?? '')
    );
    if ($subscriptionId <= 0 || $endpoint === '' || $jwt === '' || $body === null) {
        if ($subscriptionId > 0) {
            oceanos_push_mark_failure($pdo, $subscriptionId, 'Push payload invalide.');
        }
        return;
    }

    $headers = [
        'Authorization: vapid t=' . $jwt . ', k=' . $config['publicKey'],
        'Content-Encoding: aes128gcm',
        'Content-Type: application/octet-stream',
        'Content-Length: ' . strlen($body),
        'TTL: 86400',
        'Urgency: normal',
    ];

    $curl = curl_init($endpoint);
    $options = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 15,
    ];
    $caBundle = oceanos_ca_bundle_path();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }
    curl_setopt_array($curl, $options);

    $responseBody = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($responseBody !== false && in_array($status, [200, 201, 202, 204], true)) {
        oceanos_push_mark_success($pdo, $subscriptionId);
        return;
    }
    if (in_array($status, [404, 410], true)) {
        oceanos_push_delete_row($pdo, $subscriptionId);
        return;
    }

    $message = $error !== '' ? $error : ('HTTP ' . $status . ' ' . trim((string) $responseBody));
    oceanos_push_mark_failure($pdo, $subscriptionId, $message);
}

function oceanos_secret_key(): string
{
    $secret = trim((string) (getenv('OCEANOS_SECRET') ?: getenv('FLOWCEAN_AI_SECRET') ?: ''));
    if ($secret === '') {
        $config = oceanos_config();
        $secret = implode('|', [
            (string) $config['db_host'],
            (string) $config['db_name'],
            (string) $config['db_user'],
            dirname(__DIR__),
        ]);
    }

    return hash('sha256', $secret, true);
}

function oceanos_encrypt_secret(?string $plain): ?string
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
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', oceanos_secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) {
        throw new RuntimeException('Impossible de chiffrer la cle API.');
    }

    return 'gcm:' . base64_encode($iv . $tag . $cipher);
}

function oceanos_decrypt_secret(?string $cipher): string
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

    $plain = openssl_decrypt(
        substr($raw, 28),
        'aes-256-gcm',
        oceanos_secret_key(),
        OPENSSL_RAW_DATA,
        substr($raw, 0, 12),
        substr($raw, 12, 16)
    );

    return $plain === false ? '' : $plain;
}

function oceanos_key_hint(string $key): string
{
    $key = trim($key);
    if ($key === '') {
        return '';
    }

    return substr($key, 0, 4) . '...' . substr($key, -4);
}

function oceanos_normalize_shop_url(string $shopUrl): string
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

function oceanos_migrate_legacy_prestashop_settings(PDO $pdo): void
{
    try {
        $pdo->exec('INSERT IGNORE INTO oceanos_prestashop_settings (id, sync_window_days) VALUES (1, 30)');
        $current = $pdo->query('SELECT shop_url, webservice_key_cipher FROM oceanos_prestashop_settings WHERE id = 1 LIMIT 1')->fetch();
        if (is_array($current) && trim((string) ($current['webservice_key_cipher'] ?? '')) !== '') {
            return;
        }
        if (!oceanos_table_exists($pdo, 'invocean_settings')) {
            return;
        }

        $legacy = $pdo->query('SELECT shop_url, webservice_key_cipher, webservice_key_hint, sync_window_days FROM invocean_settings WHERE id = 1 LIMIT 1')->fetch();
        if (!is_array($legacy)) {
            return;
        }

        $shopUrl = oceanos_normalize_shop_url((string) ($legacy['shop_url'] ?? ''));
        $syncWindowDays = max(1, min(365, (int) ($legacy['sync_window_days'] ?? 30)));
        $legacyCipher = trim((string) ($legacy['webservice_key_cipher'] ?? ''));
        $webserviceKey = str_starts_with($legacyCipher, 'plain:')
            ? (string) base64_decode(substr($legacyCipher, 6), true)
            : oceanos_decrypt_legacy_invocean_secret($legacyCipher);

        if ($shopUrl === '' && $webserviceKey === '') {
            return;
        }

        $statement = $pdo->prepare(
            'UPDATE oceanos_prestashop_settings
             SET shop_url = :shop_url,
                 webservice_key_cipher = :webservice_key_cipher,
                 webservice_key_hint = :webservice_key_hint,
                 sync_window_days = :sync_window_days
             WHERE id = 1'
        );
        $statement->execute([
            'shop_url' => $shopUrl !== '' ? $shopUrl : null,
            'webservice_key_cipher' => $webserviceKey !== '' ? oceanos_encrypt_secret($webserviceKey) : null,
            'webservice_key_hint' => $webserviceKey !== ''
                ? oceanos_key_hint($webserviceKey)
                : ((string) ($legacy['webservice_key_hint'] ?? '') ?: null),
            'sync_window_days' => $syncWindowDays,
        ]);
    } catch (Throwable) {
        // La migration est un confort. OceanOS reste utilisable si l'ancien connecteur est illisible.
    }
}

function oceanos_decrypt_legacy_invocean_secret(?string $cipher): string
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

    $secrets = [];
    foreach ([getenv('INVOCEAN_SECRET') ?: '', getenv('FLOWCEAN_AI_SECRET') ?: ''] as $secret) {
        $secret = trim((string) $secret);
        if ($secret !== '') {
            $secrets[] = $secret;
        }
    }

    $legacySecretFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Invocean' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . '.invocean_secret';
    if (is_file($legacySecretFile)) {
        $fileSecret = trim((string) file_get_contents($legacySecretFile));
        if ($fileSecret !== '') {
            $secrets[] = $fileSecret;
        }
    }

    $config = oceanos_config();
    $secrets[] = implode('|', [
        (string) $config['db_host'],
        (string) $config['db_name'],
        (string) $config['db_user'],
        dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Invocean' . DIRECTORY_SEPARATOR . 'api',
    ]);

    foreach (array_values(array_unique($secrets)) as $secret) {
        $plain = openssl_decrypt(
            substr($raw, 28),
            'aes-256-gcm',
            hash('sha256', $secret, true),
            OPENSSL_RAW_DATA,
            substr($raw, 0, 12),
            substr($raw, 12, 16)
        );
        if ($plain !== false && trim($plain) !== '') {
            return $plain;
        }
    }

    return '';
}

function oceanos_prestashop_settings_row(PDO $pdo): array
{
    $pdo->exec('INSERT IGNORE INTO oceanos_prestashop_settings (id, sync_window_days) VALUES (1, 30)');
    $row = $pdo->query('SELECT * FROM oceanos_prestashop_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration PrestaShop OceanOS introuvable.');
    }

    return $row;
}

function oceanos_prestashop_private_settings(PDO $pdo): array
{
    $row = oceanos_prestashop_settings_row($pdo);

    return [
        'shopUrl' => oceanos_normalize_shop_url((string) ($row['shop_url'] ?? '')),
        'webserviceKey' => oceanos_decrypt_secret($row['webservice_key_cipher'] ?? ''),
        'webserviceKeyHint' => (string) ($row['webservice_key_hint'] ?? ''),
        'hasWebserviceKey' => trim((string) ($row['webservice_key_cipher'] ?? '')) !== '',
        'syncWindowDays' => (int) ($row['sync_window_days'] ?? 30),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function oceanos_prestashop_public_settings(PDO $pdo, bool $canManage = false): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    unset($settings['webserviceKey']);
    $settings['canManage'] = $canManage;
    $settings['managedBy'] = 'OceanOS';

    return $settings;
}

function oceanos_save_prestashop_settings(PDO $pdo, array $input): array
{
    oceanos_prestashop_settings_row($pdo);

    $shopUrl = oceanos_normalize_shop_url((string) ($input['shopUrl'] ?? ''));
    $syncWindowDays = max(1, min(365, (int) ($input['syncWindowDays'] ?? 30)));
    $webserviceKey = array_key_exists('webserviceKey', $input) ? trim((string) $input['webserviceKey']) : null;
    $clearKey = !empty($input['clearWebserviceKey']);

    if ($shopUrl !== '' && !preg_match('~^https?://~i', $shopUrl)) {
        throw new InvalidArgumentException('URL PrestaShop invalide.');
    }

    $fields = [
        'shop_url = :shop_url',
        'sync_window_days = :sync_window_days',
    ];
    $params = [
        'shop_url' => $shopUrl !== '' ? $shopUrl : null,
        'sync_window_days' => $syncWindowDays,
    ];

    if ($webserviceKey !== null && $webserviceKey !== '') {
        $fields[] = 'webservice_key_cipher = :webservice_key_cipher';
        $fields[] = 'webservice_key_hint = :webservice_key_hint';
        $params['webservice_key_cipher'] = oceanos_encrypt_secret($webserviceKey);
        $params['webservice_key_hint'] = oceanos_key_hint($webserviceKey);
    } elseif ($clearKey) {
        $fields[] = 'webservice_key_cipher = NULL';
        $fields[] = 'webservice_key_hint = NULL';
    }

    $statement = $pdo->prepare('UPDATE oceanos_prestashop_settings SET ' . implode(', ', $fields) . ' WHERE id = 1');
    $statement->execute($params);

    return oceanos_prestashop_public_settings($pdo, true);
}

function oceanos_delete_prestashop_settings(PDO $pdo): void
{
    $pdo->exec('INSERT IGNORE INTO oceanos_prestashop_settings (id, sync_window_days) VALUES (1, 30)');
    $pdo->exec('UPDATE oceanos_prestashop_settings SET shop_url = NULL, webservice_key_cipher = NULL, webservice_key_hint = NULL WHERE id = 1');
}

function oceanos_company_defaults(): array
{
    return [
        'companyName' => 'RenovBoat SAS',
        'companyPhone' => '+33 6 XX XX XX XX',
        'companyAddress' => '12 Rue du Port',
        'companyCity' => '13600 La Ciotat',
        'companyEmail' => 'contact@renovboat.fr',
        'companySiret' => '123 456 789 00010',
        'companyVatNumber' => '',
        'companyCountryIso' => 'FR',
        'paymentTerms' => 'Virement bancaire a 30 jours',
        'quoteValidityDays' => 30,
        'footerNote' => 'Merci de votre confiance.',
    ];
}

function oceanos_company_settings_row(PDO $pdo): array
{
    $defaults = oceanos_company_defaults();
    $statement = $pdo->prepare(
        'INSERT IGNORE INTO oceanos_company_settings
            (id, company_name, company_phone, company_address, company_city, company_email, company_siret, company_vat_number, company_country_iso, payment_terms, quote_validity_days, footer_note)
         VALUES
            (1, :company_name, :company_phone, :company_address, :company_city, :company_email, :company_siret, :company_vat_number, :company_country_iso, :payment_terms, :quote_validity_days, :footer_note)'
    );
    $statement->execute([
        'company_name' => $defaults['companyName'],
        'company_phone' => $defaults['companyPhone'],
        'company_address' => $defaults['companyAddress'],
        'company_city' => $defaults['companyCity'],
        'company_email' => $defaults['companyEmail'],
        'company_siret' => $defaults['companySiret'],
        'company_vat_number' => $defaults['companyVatNumber'],
        'company_country_iso' => $defaults['companyCountryIso'],
        'payment_terms' => $defaults['paymentTerms'],
        'quote_validity_days' => $defaults['quoteValidityDays'],
        'footer_note' => $defaults['footerNote'],
    ]);

    $row = $pdo->query('SELECT * FROM oceanos_company_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration entreprise OceanOS introuvable.');
    }

    return $row;
}

function oceanos_company_city_parts(string $companyCity): array
{
    $companyCity = trim($companyCity);
    if (preg_match('/^(\d{4,6})\s+(.+)$/u', $companyCity, $matches)) {
        return [
            'postcode' => (string) $matches[1],
            'city' => trim((string) $matches[2]),
        ];
    }

    return [
        'postcode' => '',
        'city' => $companyCity,
    ];
}

function oceanos_company_private_settings(PDO $pdo): array
{
    $row = oceanos_company_settings_row($pdo);
    $cityParts = oceanos_company_city_parts((string) ($row['company_city'] ?? ''));

    return [
        'companyName' => (string) ($row['company_name'] ?? ''),
        'companyPhone' => (string) ($row['company_phone'] ?? ''),
        'companyAddress' => (string) ($row['company_address'] ?? ''),
        'companyCity' => (string) ($row['company_city'] ?? ''),
        'companyEmail' => (string) ($row['company_email'] ?? ''),
        'companySiret' => (string) ($row['company_siret'] ?? ''),
        'companyPostcode' => $cityParts['postcode'],
        'companyCityName' => $cityParts['city'],
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function oceanos_company_public_settings(PDO $pdo, bool $canManage = false): array
{
    $settings = oceanos_company_private_settings($pdo);
    $settings['canManage'] = $canManage;
    $settings['managedBy'] = 'OceanOS';

    return $settings;
}

function oceanos_save_company_settings(PDO $pdo, array $input): array
{
    oceanos_company_settings_row($pdo);

    $companyEmail = trim((string) ($input['companyEmail'] ?? ''));
    if ($companyEmail !== '' && !filter_var($companyEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email entreprise invalide.');
    }

    $statement = $pdo->prepare(
        'UPDATE oceanos_company_settings
         SET company_name = :company_name,
             company_phone = :company_phone,
             company_address = :company_address,
             company_city = :company_city,
             company_email = :company_email,
             company_siret = :company_siret
         WHERE id = 1'
    );
    $statement->execute([
        'company_name' => trim((string) ($input['companyName'] ?? '')) ?: null,
        'company_phone' => trim((string) ($input['companyPhone'] ?? '')) ?: null,
        'company_address' => trim((string) ($input['companyAddress'] ?? '')) ?: null,
        'company_city' => trim((string) ($input['companyCity'] ?? '')) ?: null,
        'company_email' => $companyEmail !== '' ? $companyEmail : null,
        'company_siret' => trim((string) ($input['companySiret'] ?? '')) ?: null,
    ]);

    return oceanos_company_public_settings($pdo, true);
}

function oceanos_reset_company_settings(PDO $pdo): array
{
    $defaults = oceanos_company_defaults();
    return oceanos_save_company_settings($pdo, $defaults);
}

function oceanos_require_prestashop_settings(array $settings): array
{
    $shopUrl = oceanos_normalize_shop_url((string) ($settings['shopUrl'] ?? ''));
    $key = trim((string) ($settings['webserviceKey'] ?? ''));

    if ($shopUrl === '' || $key === '') {
        throw new InvalidArgumentException('Configurez l URL PrestaShop et la cle Webservice dans OceanOS avant de synchroniser.');
    }

    return [$shopUrl, $key];
}

function oceanos_ca_bundle_path(): string
{
    $config = oceanos_config();
    $candidates = [
        (string) ($config['ca_bundle'] ?? ''),
        (string) (getenv('OCEANOS_CA_BUNDLE') ?: ''),
        (string) (getenv('INVOCEAN_CA_BUNDLE') ?: ''),
        (string) (getenv('FLOWCEAN_CA_BUNDLE') ?: ''),
        (string) ini_get('curl.cainfo'),
        (string) ini_get('openssl.cafile'),
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'cacert.pem',
        'C:\\wamp64\\apps\\phpmyadmin5.2.3\\vendor\\composer\\ca-bundle\\res\\cacert.pem',
        dirname(__DIR__, 2) . '\\apps\\phpmyadmin5.2.3\\vendor\\composer\\ca-bundle\\res\\cacert.pem',
    ];

    foreach (glob(dirname(__DIR__, 3) . '/apps/phpmyadmin*/vendor/composer/ca-bundle/res/cacert.pem') ?: [] as $path) {
        $candidates[] = $path;
    }

    foreach ($candidates as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '' && is_file($candidate) && is_readable($candidate)) {
            return $candidate;
        }
    }

    return '';
}

function oceanos_extract_prestashop_error(string $body): string
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

function oceanos_prestashop_get(string $shopUrl, string $apiKey, string $resource, array $query = []): string
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

    $caBundle = oceanos_ca_bundle_path();
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
            throw new RuntimeException('Certificat SSL non verifie par PHP/cURL. Configurez OCEANOS_CA_BUNDLE avec un fichier cacert.pem lisible.');
        }

        throw new RuntimeException($error !== '' ? $error : 'PrestaShop n a retourne aucune donnee.');
    }
    if ($status >= 400) {
        $details = oceanos_extract_prestashop_error((string) $body);
        $message = 'PrestaShop a refuse ' . $resource . ' HTTP ' . $status . '.';
        if ($details !== '') {
            $message .= ' Detail: ' . $details;
        }
        throw new OceanosPrestashopException($message, $status, $resource);
    }
    if ($body === '') {
        throw new RuntimeException('PrestaShop n a retourne aucune donnee.');
    }

    return (string) $body;
}

function oceanos_prestashop_put_xml(string $shopUrl, string $apiKey, string $resource, string $xmlBody, array $query = []): string
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
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $xmlBody,
        CURLOPT_USERPWD => $apiKey . ':',
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Accept: application/xml',
            'Content-Type: application/xml',
            'Output-Format: XML',
        ],
    ];

    $caBundle = oceanos_ca_bundle_path();
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
            throw new RuntimeException('Certificat SSL non verifie par PHP/cURL. Configurez OCEANOS_CA_BUNDLE avec un fichier cacert.pem lisible.');
        }

        throw new RuntimeException($error !== '' ? $error : 'PrestaShop n a retourne aucune donnee.');
    }
    if ($status >= 400) {
        $details = oceanos_extract_prestashop_error((string) $body);
        $message = 'PrestaShop a refuse ' . $resource . ' HTTP ' . $status . '.';
        if ($details !== '') {
            $message .= ' Detail: ' . $details;
        }
        throw new OceanosPrestashopException($message, $status, $resource);
    }

    return (string) $body;
}

function oceanos_prestashop_post_xml(string $shopUrl, string $apiKey, string $resource, string $xmlBody, array $query = []): string
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
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $xmlBody,
        CURLOPT_USERPWD => $apiKey . ':',
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Accept: application/xml',
            'Content-Type: application/xml',
            'Output-Format: XML',
        ],
    ];

    $caBundle = oceanos_ca_bundle_path();
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
            throw new RuntimeException('Certificat SSL non verifie par PHP/cURL. Configurez OCEANOS_CA_BUNDLE avec un fichier cacert.pem lisible.');
        }

        throw new RuntimeException($error !== '' ? $error : 'PrestaShop n a retourne aucune donnee.');
    }
    if ($status >= 400) {
        $details = oceanos_extract_prestashop_error((string) $body);
        $message = 'PrestaShop a refuse ' . $resource . ' HTTP ' . $status . '.';
        if ($details !== '') {
            $message .= ' Detail: ' . $details;
        }
        throw new OceanosPrestashopException($message, $status, $resource);
    }

    return (string) $body;
}

function oceanos_load_xml(string $body): SimpleXMLElement
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

function oceanos_xml_text(SimpleXMLElement $node, string $field): string
{
    return isset($node->{$field}) ? trim((string) $node->{$field}) : '';
}

function oceanos_xml_language_value(SimpleXMLElement $node, string $field): string
{
    if (!isset($node->{$field})) {
        return '';
    }

    $fieldNode = $node->{$field};
    if (isset($fieldNode->language)) {
        foreach ($fieldNode->language as $language) {
            $value = trim((string) $language);
            if ($value !== '') {
                return $value;
            }
        }
    }

    return trim((string) $fieldNode);
}

function oceanos_test_prestashop(PDO $pdo, array $input = []): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    if (isset($input['shopUrl'])) {
        $settings['shopUrl'] = trim((string) $input['shopUrl']);
    }
    if (!empty($input['webserviceKey'])) {
        $settings['webserviceKey'] = trim((string) $input['webserviceKey']);
    }

    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'products', [
        'display' => '[id]',
        'limit' => '0,1',
    ]));

    $sampleProducts = isset($xml->products->product) ? count($xml->products->product) : 0;

    return [
        'ok' => true,
        'message' => 'Connexion PrestaShop valide.',
        'sampleProducts' => $sampleProducts,
        'settings' => oceanos_prestashop_public_settings($pdo, true),
    ];
}

function oceanos_ai_public_settings(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT provider, model, api_key_cipher, updated_at FROM oceanos_user_ai_settings WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return [
            'provider' => 'groq',
            'model' => 'llama-3.3-70b-versatile',
            'hasApiKey' => false,
            'updatedAt' => null,
        ];
    }

    return [
        'provider' => (string) ($row['provider'] ?: 'groq'),
        'model' => (string) ($row['model'] ?: 'llama-3.3-70b-versatile'),
        'hasApiKey' => trim((string) ($row['api_key_cipher'] ?? '')) !== '',
        'updatedAt' => $row['updated_at'] ? (string) $row['updated_at'] : null,
    ];
}

function oceanos_ai_private_settings(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT provider, model, api_key_cipher FROM oceanos_user_ai_settings WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return [
            'provider' => 'groq',
            'model' => 'llama-3.3-70b-versatile',
            'apiKey' => '',
        ];
    }

    return [
        'provider' => (string) ($row['provider'] ?: 'groq'),
        'model' => (string) ($row['model'] ?: 'llama-3.3-70b-versatile'),
        'apiKey' => oceanos_decrypt_secret($row['api_key_cipher'] ?? ''),
    ];
}

function oceanos_save_ai_settings(PDO $pdo, int $userId, string $model, ?string $apiKey = null, string $provider = 'groq'): array
{
    $existing = oceanos_ai_private_settings($pdo, $userId);
    $cipher = $apiKey !== null && trim($apiKey) !== ''
        ? oceanos_encrypt_secret($apiKey)
        : ($existing['apiKey'] !== '' ? oceanos_encrypt_secret($existing['apiKey']) : null);

    $statement = $pdo->prepare(
        'INSERT INTO oceanos_user_ai_settings (user_id, provider, model, api_key_cipher)
         VALUES (:user_id, :provider, :model, :api_key_cipher)
         ON DUPLICATE KEY UPDATE
            provider = VALUES(provider),
            model = VALUES(model),
            api_key_cipher = VALUES(api_key_cipher),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'provider' => $provider,
        'model' => trim($model) !== '' ? trim($model) : 'llama-3.3-70b-versatile',
        'api_key_cipher' => $cipher,
    ]);

    return oceanos_ai_public_settings($pdo, $userId);
}

function oceanos_delete_ai_settings(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare('DELETE FROM oceanos_user_ai_settings WHERE user_id = :user_id');
    $statement->execute(['user_id' => $userId]);
}

function oceanos_ai_post_json(string $url, string $apiKey, array $payload): array
{
    $ch = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 45,
    ];

    $caBundle = oceanos_ca_bundle_path();
    if ($caBundle !== '') {
        $options[CURLOPT_CAINFO] = $caBundle;
    }

    curl_setopt_array($ch, $options);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $raw === '') {
        if (str_contains($error, 'unable to get local issuer certificate')) {
            throw new RuntimeException('Certificat SSL non verifie par PHP/cURL. Le bundle CA OceanOS est introuvable ou illisible.');
        }

        throw new RuntimeException($error !== '' ? $error : 'Reponse IA vide.');
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Reponse IA invalide.');
    }
    if ($status >= 400) {
        $message = (string) ($decoded['error']['message'] ?? $decoded['message'] ?? 'Erreur IA.');
        throw new RuntimeException($message);
    }

    return $decoded;
}

function oceanos_groq_chat_completion(string $apiKey, string $model, array $messages, float $temperature = 0.2, int $maxTokens = 128): string
{
    $result = oceanos_ai_post_json('https://api.groq.com/openai/v1/chat/completions', $apiKey, [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => max(32, min(2048, $maxTokens)),
    ]);

    return (string) ($result['choices'][0]['message']['content'] ?? '');
}
