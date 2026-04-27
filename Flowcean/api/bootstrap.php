<?php
declare(strict_types=1);

require_once __DIR__ . '/default_state.php';

$oceanosBootstrapPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';
if (is_file($oceanosBootstrapPath)) {
    require_once $oceanosBootstrapPath;
}

final class FlowceanConflictException extends RuntimeException
{
    public array $workspace;
    public array $meta;

    public function __construct(array $workspace, array $meta)
    {
        parent::__construct('Workspace version conflict.');
        $this->workspace = $workspace;
        $this->meta = $meta;
    }
}

function flowcean_config(): array
{
    static $config;

    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config;
}

function flowcean_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function flowcean_read_json_request(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function flowcean_now_iso(): string
{
    return gmdate('Y-m-d H:i:s');
}

function flowcean_pdo_root(): PDO
{
    $config = flowcean_config();

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

function flowcean_pdo(): PDO
{
    $config = flowcean_config();
    $root = flowcean_pdo_root();
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

    flowcean_ensure_schema($pdo);

    return $pdo;
}

function flowcean_ensure_schema(PDO $pdo): void
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

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspaces (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(120) NOT NULL UNIQUE,
            name VARCHAR(190) NOT NULL,
            owner_user_id BIGINT UNSIGNED NULL,
            is_personal TINYINT(1) NOT NULL DEFAULT 0,
            data_json LONGTEXT NOT NULL,
            version INT UNSIGNED NOT NULL DEFAULT 1,
            deleted_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspace_members (
            workspace_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            role ENUM('owner', 'admin', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (workspace_id, user_id),
            CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
            CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspace_invitations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            workspace_id BIGINT UNSIGNED NOT NULL,
            email VARCHAR(190) NOT NULL,
            invited_user_id BIGINT UNSIGNED NULL,
            invited_by_user_id BIGINT UNSIGNED NOT NULL,
            role ENUM('admin', 'editor', 'viewer') NOT NULL DEFAULT 'editor',
            status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
            accepted_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_workspace_invite_email (workspace_id, email),
            INDEX idx_workspace_invites_user_status (invited_user_id, status),
            CONSTRAINT fk_workspace_invites_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
            CONSTRAINT fk_workspace_invites_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_workspace_invites_sender FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspace_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            workspace_id BIGINT UNSIGNED NOT NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            event_type VARCHAR(80) NOT NULL,
            payload_json LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_workspace_events_workspace_created (workspace_id, created_at),
            CONSTRAINT fk_workspace_events_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
            CONSTRAINT fk_workspace_events_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspace_presence (
            workspace_id BIGINT UNSIGNED NOT NULL,
            client_id VARCHAR(80) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            active_page_id VARCHAR(120) NULL,
            active_page_title VARCHAR(190) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (workspace_id, client_id),
            INDEX idx_workspace_presence_workspace_updated (workspace_id, updated_at),
            CONSTRAINT fk_workspace_presence_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
            CONSTRAINT fk_workspace_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_workspace_user_preferences (
            workspace_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            preferences_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (workspace_id, user_id),
            CONSTRAINT fk_workspace_user_preferences_workspace FOREIGN KEY (workspace_id) REFERENCES flowcean_workspaces(id) ON DELETE CASCADE,
            CONSTRAINT fk_workspace_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS flowcean_user_notifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            type VARCHAR(80) NOT NULL,
            title VARCHAR(190) NOT NULL,
            body TEXT NULL,
            payload_json LONGTEXT NULL,
            read_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_notifications_user_created (user_id, created_at),
            INDEX idx_user_notifications_user_read (user_id, read_at),
            CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS user_ai_settings (
            user_id BIGINT UNSIGNED PRIMARY KEY,
            provider VARCHAR(40) NOT NULL DEFAULT 'groq',
            model VARCHAR(120) NOT NULL DEFAULT 'llama-3.3-70b-versatile',
            api_key_cipher TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_user_ai_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    flowcean_ensure_column(
        $pdo,
        'users',
        'role',
        "ALTER TABLE users ADD COLUMN role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member' AFTER password_hash"
    );
    $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('super', 'admin', 'member') NOT NULL DEFAULT 'member'");
    flowcean_ensure_column(
        $pdo,
        'users',
        'is_active',
        "ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role"
    );
    flowcean_ensure_column(
        $pdo,
        'flowcean_workspaces',
        'is_personal',
        "ALTER TABLE flowcean_workspaces ADD COLUMN is_personal TINYINT(1) NOT NULL DEFAULT 0 AFTER owner_user_id"
    );
    flowcean_ensure_column(
        $pdo,
        'flowcean_workspaces',
        'deleted_at',
        "ALTER TABLE flowcean_workspaces ADD COLUMN deleted_at DATETIME NULL AFTER version"
    );
}

function flowcean_ensure_column(PDO $pdo, string $table, string $column, string $sql): void
{
    $config = flowcean_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :schema_name AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $statement->execute([
        'schema_name' => $config['db_name'],
        'table_name' => $table,
        'column_name' => $column,
    ]);

    if ((int) $statement->fetchColumn() === 0) {
        $pdo->exec($sql);
    }
}

function flowcean_slugify(string $value, string $fallback = 'workspace'): string
{
    $candidate = trim(mb_strtolower($value));
    if ($candidate === '') {
        $candidate = $fallback;
    }

    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $candidate);
    if (is_string($ascii) && $ascii !== '') {
        $candidate = $ascii;
    }

    $candidate = preg_replace('/[^a-z0-9]+/', '-', strtolower($candidate)) ?: $fallback;
    $candidate = trim($candidate, '-');

    return $candidate !== '' ? $candidate : $fallback;
}

function flowcean_workspace_slug(?string $value): string
{
    $fallback = (string) flowcean_config()['default_workspace_slug'];
    return flowcean_slugify((string) $value, $fallback !== '' ? $fallback : 'main');
}

function flowcean_workspace_name(array $state, ?string $fallback = null): string
{
    $name = trim((string) ($state['workspace']['name'] ?? ''));
    if ($name !== '') {
        return $name;
    }

    if ($fallback !== null && trim($fallback) !== '') {
        return trim($fallback);
    }

    return (string) flowcean_config()['default_workspace_name'];
}

function flowcean_workspace_member_role(?string $role, bool $allowOwner = true): string
{
    $normalized = strtolower(trim((string) $role));
    $allowed = $allowOwner
        ? ['super', 'owner', 'admin', 'editor', 'viewer']
        : ['admin', 'editor', 'viewer'];

    return in_array($normalized, $allowed, true) ? $normalized : ($allowOwner ? 'editor' : 'editor');
}

function flowcean_workspace_role_rank(?string $role): int
{
    return match (flowcean_workspace_member_role($role, true)) {
        'super' => 50,
        'owner' => 40,
        'admin' => 30,
        'editor' => 20,
        'viewer' => 10,
        default => 0,
    };
}

function flowcean_workspace_role_allows(?string $currentRole, string $requiredRole): bool
{
    return flowcean_workspace_role_rank($currentRole) >= flowcean_workspace_role_rank($requiredRole);
}

function flowcean_workspace_member_role_label(?string $role): string
{
    return match (flowcean_workspace_member_role($role, true)) {
        'super' => 'Super-utilisateur',
        'owner' => 'Proprietaire',
        'admin' => 'Admin workspace',
        'viewer' => 'Lecture seule',
        default => 'Editeur',
    };
}

function flowcean_workspace_permissions(?string $memberRole): array
{
    return [
        'canEdit' => flowcean_workspace_role_allows($memberRole, 'editor'),
        'canInvite' => flowcean_workspace_role_allows($memberRole, 'admin'),
        'canManageMembers' => flowcean_workspace_role_allows($memberRole, 'admin'),
        'canManageWorkspace' => flowcean_workspace_role_allows($memberRole, 'admin'),
    ];
}

function flowcean_default_user_preferences(): array
{
    return [
        'favoritePageIds' => [],
        'initialized' => false,
    ];
}

function flowcean_normalize_user_preferences(?array $preferences): array
{
    $source = is_array($preferences) ? $preferences : [];
    $ids = $source['favoritePageIds'] ?? ($source['favorites'] ?? []);
    if (!is_array($ids)) {
        $ids = [];
    }

    $favoritePageIds = [];
    foreach ($ids as $id) {
        $candidate = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) $id)) ?: '', 0, 120);
        if ($candidate !== '' && !in_array($candidate, $favoritePageIds, true)) {
            $favoritePageIds[] = $candidate;
        }
    }

    return [
        'favoritePageIds' => $favoritePageIds,
        'initialized' => (bool) ($source['initialized'] ?? false),
    ];
}

function flowcean_get_workspace_user_preferences(PDO $pdo, int $workspaceId, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT preferences_json, updated_at
         FROM flowcean_workspace_user_preferences
         WHERE workspace_id = :workspace_id AND user_id = :user_id
         LIMIT 1'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'user_id' => $userId,
    ]);
    $row = $statement->fetch();

    if (!is_array($row)) {
        return [
            'preferences' => flowcean_default_user_preferences(),
            'exists' => false,
            'updatedAt' => null,
        ];
    }

    $decoded = json_decode((string) $row['preferences_json'], true);
    return [
        'preferences' => array_merge(
            flowcean_normalize_user_preferences(is_array($decoded) ? $decoded : null),
            ['initialized' => true]
        ),
        'exists' => true,
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function flowcean_attach_user_preferences(PDO $pdo, array $payload, int $workspaceId, int $userId): array
{
    $preferences = flowcean_get_workspace_user_preferences($pdo, $workspaceId, $userId);
    $payload['userPreferences'] = $preferences['preferences'];
    $payload['userPreferencesMeta'] = [
        'exists' => $preferences['exists'],
        'updatedAt' => $preferences['updatedAt'],
    ];
    return $payload;
}

function flowcean_save_workspace_user_preferences(PDO $pdo, string $slug, array $user, array $preferences): array
{
    $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'viewer');
    $workspaceId = (int) $workspace['id'];
    $userId = (int) $user['id'];
    $normalized = flowcean_normalize_user_preferences($preferences);
    $normalized['initialized'] = true;
    $json = json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible d encoder les preferences utilisateur.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO flowcean_workspace_user_preferences (workspace_id, user_id, preferences_json)
         VALUES (:workspace_id, :user_id, :preferences_json)
         ON DUPLICATE KEY UPDATE
            preferences_json = VALUES(preferences_json),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'user_id' => $userId,
        'preferences_json' => $json,
    ]);

    return flowcean_get_workspace_user_preferences($pdo, $workspaceId, $userId);
}

function flowcean_ai_secret(): string
{
    $config = flowcean_config();
    $secret = (string) (($config['ai_secret'] ?? '') ?: getenv('FLOWCEAN_AI_SECRET') ?: '');
    if ($secret !== '') {
        return $secret;
    }

    return implode('|', [
        // Keep the legacy salt stable so saved shared IA keys survive the OceanOS database rename.
        'flowcean',
        (string) ($config['db_user'] ?? 'root'),
        (string) ($config['default_workspace_slug'] ?? 'main'),
        __DIR__,
    ]);
}

function flowcean_encrypt_secret(string $plainText): string
{
    if ($plainText === '') {
        return '';
    }
    if (!function_exists('openssl_encrypt') || !defined('OPENSSL_RAW_DATA')) {
        return 'plain:' . base64_encode($plainText);
    }

    $key = hash('sha256', flowcean_ai_secret(), true);
    $iv = random_bytes(12);
    $tag = '';
    $cipherText = openssl_encrypt($plainText, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipherText === false) {
        throw new RuntimeException('Impossible de chiffrer la cle API.');
    }

    return 'gcm:' . base64_encode($iv . $tag . $cipherText);
}

function flowcean_decrypt_secret(?string $payload): string
{
    $payload = (string) ($payload ?? '');
    if ($payload === '') {
        return '';
    }
    if (str_starts_with($payload, 'plain:')) {
        return (string) base64_decode(substr($payload, 6), true);
    }
    if (!str_starts_with($payload, 'gcm:') || !function_exists('openssl_decrypt')) {
        return '';
    }

    $raw = base64_decode(substr($payload, 4), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }

    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipherText = substr($raw, 28);
    $plainText = openssl_decrypt($cipherText, 'aes-256-gcm', hash('sha256', flowcean_ai_secret(), true), OPENSSL_RAW_DATA, $iv, $tag);
    return $plainText === false ? '' : $plainText;
}

function flowcean_oceanos_secret_key(): string
{
    $secret = trim((string) (getenv('OCEANOS_SECRET') ?: getenv('FLOWCEAN_AI_SECRET') ?: ''));
    if ($secret === '') {
        $configPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'server.php';
        $config = is_file($configPath) ? require $configPath : flowcean_config();
        $config = is_array($config) ? $config : flowcean_config();
        $secret = implode('|', [
            (string) ($config['db_host'] ?? '127.0.0.1'),
            (string) ($config['db_name'] ?? 'OceanOS'),
            (string) ($config['db_user'] ?? 'root'),
            dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS',
        ]);
    }

    return hash('sha256', $secret, true);
}

function flowcean_decrypt_oceanos_secret(?string $payload): string
{
    $payload = trim((string) ($payload ?? ''));
    if ($payload === '') {
        return '';
    }
    if (str_starts_with($payload, 'plain:')) {
        $decoded = base64_decode(substr($payload, 6), true);
        return $decoded === false ? '' : (string) $decoded;
    }
    if (!str_starts_with($payload, 'gcm:') || !function_exists('openssl_decrypt')) {
        return '';
    }

    $raw = base64_decode(substr($payload, 4), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }

    $plainText = openssl_decrypt(
        substr($raw, 28),
        'aes-256-gcm',
        flowcean_oceanos_secret_key(),
        OPENSSL_RAW_DATA,
        substr($raw, 0, 12),
        substr($raw, 12, 16)
    );

    return $plainText === false ? '' : $plainText;
}

function flowcean_find_oceanos_user_for_flowcean_user(PDO $pdo, int $userId): ?array
{
    $flowceanUser = flowcean_find_user_by_id($pdo, $userId);
    if ($flowceanUser === null) {
        return null;
    }

    try {
        $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $userId]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE email = :email LIMIT 1');
            $statement->execute(['email' => mb_strtolower(trim((string) ($flowceanUser['email'] ?? '')))]);
            $row = $statement->fetch();
        }
    } catch (Throwable) {
        return null;
    }

    return is_array($row) ? $row : null;
}

function flowcean_oceanos_ai_public_settings(PDO $pdo, int $userId): ?array
{
    $oceanosUser = flowcean_find_oceanos_user_for_flowcean_user($pdo, $userId);
    if ($oceanosUser === null) {
        return null;
    }

    try {
        $statement = $pdo->prepare('SELECT provider, model, api_key_cipher, updated_at FROM oceanos_user_ai_settings WHERE user_id = :user_id LIMIT 1');
        $statement->execute(['user_id' => (int) $oceanosUser['id']]);
        $row = $statement->fetch();
    } catch (Throwable) {
        return null;
    }

    if (!is_array($row)) {
        return [
            'provider' => 'groq',
            'model' => 'llama-3.3-70b-versatile',
            'hasApiKey' => false,
            'updatedAt' => null,
            'managedBy' => 'OceanOS',
        ];
    }

    return [
        'provider' => (string) ($row['provider'] ?: 'groq'),
        'model' => (string) ($row['model'] ?: 'llama-3.3-70b-versatile'),
        'hasApiKey' => trim((string) ($row['api_key_cipher'] ?? '')) !== '',
        'updatedAt' => $row['updated_at'] ? (string) $row['updated_at'] : null,
        'managedBy' => 'OceanOS',
    ];
}

function flowcean_oceanos_ai_private_settings(PDO $pdo, int $userId): ?array
{
    $oceanosUser = flowcean_find_oceanos_user_for_flowcean_user($pdo, $userId);
    if ($oceanosUser === null) {
        return null;
    }

    try {
        $statement = $pdo->prepare('SELECT provider, model, api_key_cipher FROM oceanos_user_ai_settings WHERE user_id = :user_id LIMIT 1');
        $statement->execute(['user_id' => (int) $oceanosUser['id']]);
        $row = $statement->fetch();
    } catch (Throwable) {
        return null;
    }

    if (!is_array($row)) {
        return [
            'provider' => 'groq',
            'model' => 'llama-3.3-70b-versatile',
            'apiKey' => '',
            'managedBy' => 'OceanOS',
        ];
    }

    return [
        'provider' => (string) ($row['provider'] ?: 'groq'),
        'model' => (string) ($row['model'] ?: 'llama-3.3-70b-versatile'),
        'apiKey' => flowcean_decrypt_oceanos_secret($row['api_key_cipher'] ?? ''),
        'managedBy' => 'OceanOS',
    ];
}

function flowcean_ai_public_settings(PDO $pdo, int $userId): array
{
    $oceanosSettings = flowcean_oceanos_ai_public_settings($pdo, $userId);
    if ($oceanosSettings !== null) {
        return $oceanosSettings;
    }

    $statement = $pdo->prepare('SELECT provider, model, api_key_cipher, updated_at FROM user_ai_settings WHERE user_id = :user_id LIMIT 1');
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
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function flowcean_normalize_ai_provider(?string $provider, ?string $apiKey = null, ?string $model = null): string
{
    return 'groq';
}

function flowcean_default_ai_model(string $provider): string
{
    return 'llama-3.3-70b-versatile';
}

function flowcean_ai_private_settings(PDO $pdo, int $userId): array
{
    $oceanosSettings = flowcean_oceanos_ai_private_settings($pdo, $userId);
    if ($oceanosSettings !== null) {
        return $oceanosSettings;
    }

    $statement = $pdo->prepare('SELECT provider, model, api_key_cipher FROM user_ai_settings WHERE user_id = :user_id LIMIT 1');
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
        'apiKey' => flowcean_decrypt_secret((string) ($row['api_key_cipher'] ?? '')),
    ];
}

function flowcean_save_ai_settings(PDO $pdo, int $userId, string $model, ?string $apiKey, string $provider = 'groq'): array
{
    $existing = flowcean_ai_private_settings($pdo, $userId);
    $provider = 'groq';
    if ($apiKey !== null && trim($apiKey) !== '' && !str_starts_with(trim($apiKey), 'gsk_')) {
        throw new InvalidArgumentException('Cle Groq invalide: elle doit commencer par gsk_. La cle xAI/Grok commence par xai- et ne fonctionne pas avec Groq.');
    }
    $model = trim($model) !== ''
        ? substr(preg_replace('/[^a-zA-Z0-9._:-]/', '', trim($model)) ?: '', 0, 120)
        : flowcean_default_ai_model($provider);
    $cipher = $apiKey !== null && trim($apiKey) !== ''
        ? flowcean_encrypt_secret(trim($apiKey))
        : ($existing['apiKey'] !== '' ? flowcean_encrypt_secret($existing['apiKey']) : '');

    $statement = $pdo->prepare(
        'INSERT INTO user_ai_settings (user_id, provider, model, api_key_cipher)
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
        'model' => $model,
        'api_key_cipher' => $cipher,
    ]);

    return flowcean_ai_public_settings($pdo, $userId);
}

function flowcean_delete_ai_settings(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare('DELETE FROM user_ai_settings WHERE user_id = :user_id');
    $statement->execute(['user_id' => $userId]);
}

function flowcean_ca_bundle_path(): ?string
{
    $config = flowcean_config();
    $candidates = [
        (string) ($config['ca_bundle'] ?? ''),
        (string) ini_get('curl.cainfo'),
        (string) ini_get('openssl.cafile'),
        __DIR__ . '/cacert.pem',
        dirname(__DIR__, 3) . '/apps/phpmyadmin5.2.3/vendor/composer/ca-bundle/res/cacert.pem',
    ];

    foreach (glob(dirname(__DIR__, 3) . '/apps/phpmyadmin*/vendor/composer/ca-bundle/res/cacert.pem') ?: [] as $path) {
        $candidates[] = $path;
    }

    foreach ($candidates as $candidate) {
        $path = trim($candidate);
        if ($path !== '' && is_file($path) && is_readable($path)) {
            return $path;
        }
    }

    return null;
}

function flowcean_ai_post_json(string $url, string $apiKey, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        throw new RuntimeException('Impossible d encoder la requete IA.');
    }

    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ];
    $caBundlePath = flowcean_ca_bundle_path();

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        $curlOptions = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_TIMEOUT => 45,
        ];
        if ($caBundlePath !== null) {
            $curlOptions[CURLOPT_CAINFO] = $caBundlePath;
        }
        curl_setopt_array($curl, $curlOptions);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($raw === false) {
            throw new RuntimeException('Appel Groq impossible: ' . $error);
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'timeout' => 45,
                'ignore_errors' => true,
            ],
        ]);
        if ($caBundlePath !== null) {
            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => implode("\r\n", $headers),
                    'content' => $body,
                    'timeout' => 45,
                    'ignore_errors' => true,
                ],
                'ssl' => [
                    'cafile' => $caBundlePath,
                    'verify_peer' => true,
                    'verify_peer_name' => true,
                ],
            ]);
        }
        $raw = file_get_contents($url, false, $context);
        $statusLine = $http_response_header[0] ?? 'HTTP/1.1 0';
        preg_match('/\s(\d{3})\s/', $statusLine, $matches);
        $status = (int) ($matches[1] ?? 0);
        if ($raw === false) {
            throw new RuntimeException('Appel Groq impossible.');
        }
    }

    $decoded = json_decode((string) $raw, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded) ? (string) ($decoded['error']['message'] ?? $decoded['message'] ?? 'Erreur Groq') : 'Erreur Groq';
        throw new RuntimeException($message);
    }

    return is_array($decoded) ? $decoded : [];
}

function flowcean_groq_chat_completion(string $apiKey, string $model, array $messages, float $temperature = 0.3): string
{
    if ($apiKey === '') {
        throw new InvalidArgumentException('Aucune cle API Groq n est configuree pour cet utilisateur.');
    }
    if (!str_starts_with(trim($apiKey), 'gsk_')) {
        throw new InvalidArgumentException('La cle enregistree n est pas une cle Groq valide. Supprimez-la puis enregistrez une cle Groq commencant par gsk_.');
    }

    $decoded = flowcean_ai_post_json('https://api.groq.com/openai/v1/chat/completions', $apiKey, [
        'model' => $model ?: 'llama-3.3-70b-versatile',
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => 1400,
    ]);

    $content = (string) ($decoded['choices'][0]['message']['content'] ?? '');
    if (trim($content) === '') {
        throw new RuntimeException('Groq n a retourne aucun contenu.');
    }

    return $content;
}

function flowcean_xai_responses_completion(string $apiKey, string $model, array $messages, float $temperature = 0.3): string
{
    if ($apiKey === '') {
        throw new InvalidArgumentException('Aucune cle API xAI n est configuree pour cet utilisateur.');
    }

    $decoded = flowcean_ai_post_json('https://api.x.ai/v1/responses', $apiKey, [
        'model' => $model ?: 'grok-4.20-reasoning',
        'input' => $messages,
        'temperature' => $temperature,
        'max_output_tokens' => 1400,
    ]);

    $content = (string) ($decoded['output_text'] ?? '');
    if ($content === '' && isset($decoded['output']) && is_array($decoded['output'])) {
        $parts = [];
        foreach ($decoded['output'] as $output) {
            foreach (($output['content'] ?? []) as $item) {
                $text = $item['text'] ?? $item['content'] ?? '';
                if (is_string($text) && trim($text) !== '') {
                    $parts[] = $text;
                }
            }
        }
        $content = trim(implode("\n", $parts));
    }

    if (trim($content) === '') {
        throw new RuntimeException('xAI n a retourne aucun contenu.');
    }

    return $content;
}

function flowcean_ai_completion(array $settings, array $messages, float $temperature = 0.3): string
{
    $provider = flowcean_normalize_ai_provider((string) ($settings['provider'] ?? 'groq'), (string) ($settings['apiKey'] ?? ''), (string) ($settings['model'] ?? ''));
    if ($provider === 'xai') {
        return flowcean_xai_responses_completion((string) $settings['apiKey'], (string) $settings['model'], $messages, $temperature);
    }

    return flowcean_groq_chat_completion((string) $settings['apiKey'], (string) $settings['model'], $messages, $temperature);
}

function flowcean_presence_client_id(?string $value): string
{
    $candidate = preg_replace('/[^a-zA-Z0-9_-]/', '', trim((string) $value)) ?: '';
    if ($candidate === '') {
        throw new InvalidArgumentException('Identifiant de session live invalide.');
    }

    return substr($candidate, 0, 80);
}

function flowcean_public_workspace(array $row): array
{
    $memberRole = $row['member_role'] ?? null;
    $deletedAt = isset($row['deleted_at']) && $row['deleted_at'] !== null ? (string) $row['deleted_at'] : null;
    $deleteExpiresAt = null;
    if ($deletedAt !== null) {
        try {
            $expiry = new DateTimeImmutable($deletedAt, new DateTimeZone('UTC'));
            $deleteExpiresAt = $expiry->modify('+30 days')->format('Y-m-d H:i:s');
        } catch (Throwable) {
            $deleteExpiresAt = null;
        }
    }

    return [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'name' => (string) $row['name'],
        'isPersonal' => (bool) ($row['is_personal'] ?? false),
        'ownerUserId' => isset($row['owner_user_id']) ? (int) $row['owner_user_id'] : null,
        'memberRole' => $memberRole === null ? null : (string) $memberRole,
        'memberCount' => isset($row['member_count']) ? (int) $row['member_count'] : null,
        'updatedAt' => (string) $row['updated_at'],
        'createdAt' => (string) $row['created_at'],
        'deletedAt' => $deletedAt,
        'deleteExpiresAt' => $deleteExpiresAt,
        'permissions' => flowcean_workspace_permissions(is_string($memberRole) ? $memberRole : null),
    ];
}

function flowcean_workspace_payload(array $row, bool $created = false): array
{
    $state = json_decode((string) $row['data_json'], true);
    if (!is_array($state)) {
        $state = flowcean_default_state((string) $row['name'], (string) $row['slug']);
    }

    $memberRole = isset($row['member_role']) ? (string) $row['member_role'] : null;
    $permissions = flowcean_workspace_permissions($memberRole);

    $state['workspace']['name'] = flowcean_workspace_name($state, (string) $row['name']);
    $state['meta'] = array_merge(
        is_array($state['meta'] ?? null) ? $state['meta'] : [],
        [
            'workspaceSlug' => (string) $row['slug'],
            'serverVersion' => (int) $row['version'],
            'lastSyncedAt' => (string) $row['updated_at'],
            'source' => 'server',
            'memberRole' => $memberRole,
            'permissions' => $permissions,
            'isPersonal' => (bool) ($row['is_personal'] ?? false),
        ]
    );

    return [
        'workspace' => $state,
        'meta' => [
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'version' => (int) $row['version'],
            'updatedAt' => (string) $row['updated_at'],
            'createdAt' => (string) $row['created_at'],
            'created' => $created,
            'memberRole' => $memberRole,
            'permissions' => $permissions,
            'isPersonal' => (bool) ($row['is_personal'] ?? false),
        ],
    ];
}

function flowcean_find_workspace_by_id(PDO $pdo, int $workspaceId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM flowcean_workspaces WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $workspaceId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_get_workspace(PDO $pdo, string $slug): ?array
{
    $statement = $pdo->prepare('SELECT * FROM flowcean_workspaces WHERE slug = :slug LIMIT 1');
    $statement->execute(['slug' => $slug]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_find_workspace_membership(PDO $pdo, int $workspaceId, int $userId): ?array
{
    $statement = $pdo->prepare(
        'SELECT * FROM flowcean_workspace_members WHERE workspace_id = :workspace_id AND user_id = :user_id LIMIT 1'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'user_id' => $userId,
    ]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_find_workspace_for_user(PDO $pdo, string $slug, int $userId, ?array $user = null): ?array
{
    if ($user !== null && flowcean_is_super_user($user)) {
        $statement = $pdo->prepare(
            "SELECT w.*, 'super' AS member_role
             FROM flowcean_workspaces w
             WHERE w.slug = :slug
               AND w.deleted_at IS NULL
             LIMIT 1"
        );
        $statement->execute([
            'slug' => $slug,
        ]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    $statement = $pdo->prepare(
        'SELECT w.*, wm.role AS member_role
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE w.slug = :slug AND wm.user_id = :user_id
           AND w.deleted_at IS NULL
         LIMIT 1'
    );
    $statement->execute([
        'slug' => $slug,
        'user_id' => $userId,
    ]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_find_workspace_by_id_for_user(PDO $pdo, int $workspaceId, int $userId, ?array $user = null): ?array
{
    if ($user !== null && flowcean_is_super_user($user)) {
        $statement = $pdo->prepare(
            "SELECT w.*, 'super' AS member_role
             FROM flowcean_workspaces w
             WHERE w.id = :workspace_id
               AND w.deleted_at IS NULL
             LIMIT 1"
        );
        $statement->execute([
            'workspace_id' => $workspaceId,
        ]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    $statement = $pdo->prepare(
        'SELECT w.*, wm.role AS member_role
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE w.id = :workspace_id AND wm.user_id = :user_id
           AND w.deleted_at IS NULL
         LIMIT 1'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'user_id' => $userId,
    ]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_require_workspace_access(PDO $pdo, string $slug, array $user, string $requiredRole = 'viewer'): array
{
    $workspace = flowcean_find_workspace_for_user($pdo, $slug, (int) $user['id'], $user);
    if ($workspace === null) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'workspace_not_found',
            'message' => 'Workspace introuvable ou inaccessible.',
        ], 404);
    }

    if (!flowcean_workspace_role_allows($workspace['member_role'] ?? null, $requiredRole)) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Droits insuffisants pour ce workspace.',
        ], 403);
    }

    return $workspace;
}

function flowcean_generate_unique_workspace_slug(PDO $pdo, string $base): string
{
    $root = flowcean_slugify($base, 'workspace');
    $candidate = $root;
    $index = 2;

    while (flowcean_get_workspace($pdo, $candidate) !== null) {
        $candidate = sprintf('%s-%d', $root, $index);
        $index++;
    }

    return $candidate;
}

function flowcean_create_workspace(PDO $pdo, array $ownerUser, string $name, bool $isPersonal = false, ?string $slug = null): array
{
    $workspaceName = trim($name);
    if ($workspaceName === '') {
        throw new InvalidArgumentException('Le nom du workspace est obligatoire.');
    }

    $workspaceSlug = flowcean_generate_unique_workspace_slug($pdo, $slug ?? $workspaceName);
    $defaultState = flowcean_default_state($workspaceName, $workspaceSlug);
    $stateJson = json_encode($defaultState, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($stateJson === false) {
        throw new RuntimeException('Impossible d initialiser le workspace.');
    }

    $now = flowcean_now_iso();
    $pdo->beginTransaction();

    try {
        $insert = $pdo->prepare(
            'INSERT INTO flowcean_workspaces (slug, name, owner_user_id, is_personal, data_json, version, created_at, updated_at)
             VALUES (:slug, :name, :owner_user_id, :is_personal, :data_json, 1, :created_at, :updated_at)'
        );
        $insert->execute([
            'slug' => $workspaceSlug,
            'name' => $workspaceName,
            'owner_user_id' => (int) $ownerUser['id'],
            'is_personal' => $isPersonal ? 1 : 0,
            'data_json' => $stateJson,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $workspaceId = (int) $pdo->lastInsertId();

        $attach = $pdo->prepare(
            'INSERT INTO flowcean_workspace_members (workspace_id, user_id, role, created_at)
             VALUES (:workspace_id, :user_id, :role, :created_at)'
        );
        $attach->execute([
            'workspace_id' => $workspaceId,
            'user_id' => (int) $ownerUser['id'],
            'role' => 'owner',
            'created_at' => $now,
        ]);

        flowcean_log_event(
            $pdo,
            $workspaceId,
            (int) $ownerUser['id'],
            'workspace.created',
            ['slug' => $workspaceSlug, 'isPersonal' => $isPersonal]
        );

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $exception;
    }

    $workspace = flowcean_find_workspace_for_user($pdo, $workspaceSlug, (int) $ownerUser['id']);
    if ($workspace === null) {
        throw new RuntimeException('Impossible de creer le workspace.');
    }

    return $workspace;
}

function flowcean_find_personal_workspace(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare(
        'SELECT w.*, wm.role AS member_role
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE w.owner_user_id = :user_id AND w.is_personal = 1 AND wm.user_id = :user_id
           AND w.deleted_at IS NULL
         LIMIT 1'
    );
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_ensure_user_personal_workspace(PDO $pdo, array $user): array
{
    $existing = flowcean_find_personal_workspace($pdo, (int) $user['id']);
    if ($existing !== null) {
        return $existing;
    }

    $displayName = trim((string) ($user['display_name'] ?? ''));
    $workspaceName = $displayName !== '' ? sprintf('Espace de %s', $displayName) : 'Mon workspace';
    $slugBase = sprintf('%s-home', flowcean_slugify($displayName !== '' ? $displayName : sprintf('user-%d', (int) $user['id']), 'workspace'));

    return flowcean_create_workspace($pdo, $user, $workspaceName, true, $slugBase);
}

function flowcean_log_event(PDO $pdo, int $workspaceId, ?int $actorUserId, string $eventType, ?array $payload = null): void
{
    $statement = $pdo->prepare(
        'INSERT INTO flowcean_workspace_events (workspace_id, actor_user_id, event_type, payload_json)
         VALUES (:workspace_id, :actor_user_id, :event_type, :payload_json)'
    );

    $statement->execute([
        'workspace_id' => $workspaceId,
        'actor_user_id' => $actorUserId,
        'event_type' => $eventType,
        'payload_json' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function flowcean_create_user_notification(
    PDO $pdo,
    int $userId,
    ?int $actorUserId,
    string $type,
    string $title,
    ?string $body = null,
    ?array $payload = null
): void {
    if ($userId <= 0) {
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO flowcean_user_notifications (user_id, actor_user_id, type, title, body, payload_json)
         VALUES (:user_id, :actor_user_id, :type, :title, :body, :payload_json)'
    );
    $statement->execute([
        'user_id' => $userId,
        'actor_user_id' => $actorUserId,
        'type' => mb_substr(trim($type), 0, 80),
        'title' => mb_substr(trim($title), 0, 190),
        'body' => $body !== null ? trim($body) : null,
        'payload_json' => $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    if (function_exists('oceanos_create_notification') && function_exists('oceanos_ensure_schema')) {
        try {
            oceanos_ensure_schema($pdo);
            $actionUrl = null;
            if (isset($payload['workspaceSlug']) && trim((string) $payload['workspaceSlug']) !== '') {
                $actionUrl = '/Flowcean/?workspace=' . rawurlencode((string) $payload['workspaceSlug']);
            }

            oceanos_create_notification(
                $pdo,
                $userId,
                $actorUserId,
                'Flowcean',
                $type,
                str_contains($type, 'removed') ? 'warning' : 'info',
                $title,
                $body,
                $actionUrl,
                $payload ?? []
            );
        } catch (Throwable) {
            // La notification locale Flowcean reste la source principale si OceanOS est indisponible.
        }
    }
}

function flowcean_public_user_notification(array $row): array
{
    $payload = json_decode((string) ($row['payload_json'] ?? ''), true);

    return [
        'id' => 'server-' . (int) $row['id'],
        'serverId' => (int) $row['id'],
        'type' => (string) $row['type'],
        'title' => (string) $row['title'],
        'body' => $row['body'] !== null ? (string) $row['body'] : '',
        'payload' => is_array($payload) ? $payload : [],
        'actorUserId' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
        'actorDisplayName' => $row['actor_display_name'] ?: null,
        'actorEmail' => $row['actor_email'] ?: null,
        'read' => $row['read_at'] !== null,
        'readAt' => $row['read_at'] !== null ? (string) $row['read_at'] : null,
        'createdAt' => (string) $row['created_at'],
        'source' => 'server',
    ];
}

function flowcean_list_user_notifications(PDO $pdo, int $userId, int $limit = 60): array
{
    $statement = $pdo->prepare(
        'SELECT
            n.*,
            u.display_name AS actor_display_name,
            u.email AS actor_email
         FROM flowcean_user_notifications n
         LEFT JOIN users u ON u.id = n.actor_user_id
         WHERE n.user_id = :user_id
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT :limit'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $statement->bindValue(':limit', max(1, min(200, $limit)), PDO::PARAM_INT);
    $statement->execute();
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_user_notification($row), $rows);
}

function flowcean_unread_user_notification_count(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM flowcean_user_notifications WHERE user_id = :user_id AND read_at IS NULL'
    );
    $statement->execute(['user_id' => $userId]);

    return (int) $statement->fetchColumn();
}

function flowcean_mark_user_notification_read(PDO $pdo, int $userId, int $notificationId): void
{
    $statement = $pdo->prepare(
        'UPDATE flowcean_user_notifications
         SET read_at = COALESCE(read_at, :read_at)
         WHERE id = :id AND user_id = :user_id'
    );
    $statement->execute([
        'read_at' => flowcean_now_iso(),
        'id' => $notificationId,
        'user_id' => $userId,
    ]);
}

function flowcean_mark_all_user_notifications_read(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare(
        'UPDATE flowcean_user_notifications
         SET read_at = COALESCE(read_at, :read_at)
         WHERE user_id = :user_id AND read_at IS NULL'
    );
    $statement->execute([
        'read_at' => flowcean_now_iso(),
        'user_id' => $userId,
    ]);
}

function flowcean_latest_workspace_event_id(PDO $pdo, int $workspaceId): int
{
    $statement = $pdo->prepare(
        'SELECT COALESCE(MAX(id), 0) FROM flowcean_workspace_events WHERE workspace_id = :workspace_id'
    );
    $statement->execute(['workspace_id' => $workspaceId]);

    return (int) $statement->fetchColumn();
}

function flowcean_list_workspace_events_since(PDO $pdo, int $workspaceId, int $afterId): array
{
    $statement = $pdo->prepare(
        'SELECT
            e.id,
            e.workspace_id,
            e.actor_user_id,
            e.event_type,
            e.payload_json,
            e.created_at,
            u.display_name AS actor_display_name,
            u.email AS actor_email
         FROM flowcean_workspace_events e
         LEFT JOIN users u ON u.id = e.actor_user_id
         WHERE e.workspace_id = :workspace_id AND e.id > :after_id
         ORDER BY e.id ASC
         LIMIT 100'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'after_id' => $afterId,
    ]);
    $rows = $statement->fetchAll();

    return array_map(
        static function (array $row): array {
            $payload = json_decode((string) ($row['payload_json'] ?? ''), true);

            return [
                'id' => (int) $row['id'],
                'workspaceId' => (int) $row['workspace_id'],
                'actorUserId' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
                'actorDisplayName' => $row['actor_display_name'] ?: null,
                'actorEmail' => $row['actor_email'] ?: null,
                'eventType' => (string) $row['event_type'],
                'payload' => is_array($payload) ? $payload : [],
                'createdAt' => (string) $row['created_at'],
            ];
        },
        $rows
    );
}

function flowcean_prune_workspace_presence(PDO $pdo, int $workspaceId, int $ttlSeconds = 18): void
{
    $statement = $pdo->prepare(
        'DELETE FROM flowcean_workspace_presence
         WHERE workspace_id = :workspace_id
           AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL :ttl SECOND)'
    );
    $statement->bindValue(':workspace_id', $workspaceId, PDO::PARAM_INT);
    $statement->bindValue(':ttl', $ttlSeconds, PDO::PARAM_INT);
    $statement->execute();
}

function flowcean_record_workspace_presence(
    PDO $pdo,
    int $workspaceId,
    string $clientId,
    array $user,
    ?string $activePageId,
    ?string $activePageTitle
): void {
    flowcean_prune_workspace_presence($pdo, $workspaceId);

    $statement = $pdo->prepare(
        'INSERT INTO flowcean_workspace_presence (workspace_id, client_id, user_id, active_page_id, active_page_title)
         VALUES (:workspace_id, :client_id, :user_id, :active_page_id, :active_page_title)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            active_page_id = VALUES(active_page_id),
            active_page_title = VALUES(active_page_title),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'client_id' => flowcean_presence_client_id($clientId),
        'user_id' => (int) $user['id'],
        'active_page_id' => $activePageId !== null && trim($activePageId) !== '' ? substr(trim($activePageId), 0, 120) : null,
        'active_page_title' => $activePageTitle !== null && trim($activePageTitle) !== '' ? mb_substr(trim($activePageTitle), 0, 190) : null,
    ]);
}

function flowcean_remove_workspace_presence(PDO $pdo, int $workspaceId, string $clientId, int $userId): void
{
    $statement = $pdo->prepare(
        'DELETE FROM flowcean_workspace_presence
         WHERE workspace_id = :workspace_id AND client_id = :client_id AND user_id = :user_id'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'client_id' => flowcean_presence_client_id($clientId),
        'user_id' => $userId,
    ]);
}

function flowcean_list_workspace_presence(PDO $pdo, int $workspaceId, int $ttlSeconds = 18): array
{
    flowcean_prune_workspace_presence($pdo, $workspaceId, $ttlSeconds);

    $statement = $pdo->prepare(
        'SELECT
            wp.client_id,
            wp.user_id,
            wp.active_page_id,
            wp.active_page_title,
            wp.updated_at,
            u.display_name,
            u.email
         FROM flowcean_workspace_presence wp
         INNER JOIN users u ON u.id = wp.user_id
         WHERE wp.workspace_id = :workspace_id
         ORDER BY wp.updated_at DESC, u.display_name ASC'
    );
    $statement->execute(['workspace_id' => $workspaceId]);
    $rows = $statement->fetchAll();

    return array_map(
        static function (array $row): array {
            return [
                'clientId' => (string) $row['client_id'],
                'userId' => (int) $row['user_id'],
                'displayName' => (string) $row['display_name'],
                'email' => (string) $row['email'],
                'activePageId' => $row['active_page_id'] !== null ? (string) $row['active_page_id'] : null,
                'activePageTitle' => $row['active_page_title'] !== null ? (string) $row['active_page_title'] : null,
                'lastSeenAt' => (string) $row['updated_at'],
            ];
        },
        $rows
    );
}

function flowcean_get_workspace_payload_for_user(PDO $pdo, string $slug, array $user): array
{
    $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'viewer');
    return flowcean_attach_user_preferences(
        $pdo,
        flowcean_workspace_payload($workspace, false),
        (int) $workspace['id'],
        (int) $user['id']
    );
}

function flowcean_save_workspace(
    PDO $pdo,
    string $slug,
    array $state,
    ?string $name,
    ?int $expectedVersion,
    array $user,
    ?string $clientId = null
): array
{
    $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'editor');
    $workspaceId = (int) $workspace['id'];

    $pdo->beginTransaction();

    try {
        $statement = flowcean_is_super_user($user)
            ? $pdo->prepare(
                "SELECT w.*, 'super' AS member_role
                 FROM flowcean_workspaces w
                 WHERE w.id = :workspace_id
                 LIMIT 1
                 FOR UPDATE"
            )
            : $pdo->prepare(
                'SELECT w.*, wm.role AS member_role
                 FROM flowcean_workspaces w
                 INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
                 WHERE w.id = :workspace_id AND wm.user_id = :user_id
                 LIMIT 1
                 FOR UPDATE'
            );
        $statement->execute(flowcean_is_super_user($user)
            ? ['workspace_id' => $workspaceId]
            : [
                'workspace_id' => $workspaceId,
                'user_id' => (int) $user['id'],
            ]
        );
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new RuntimeException('Workspace introuvable.');
        }

        $currentVersion = (int) $row['version'];
        if ($expectedVersion !== null && $expectedVersion !== $currentVersion) {
            $pdo->rollBack();
            throw new FlowceanConflictException(
                flowcean_workspace_payload($row)['workspace'],
                flowcean_workspace_payload($row)['meta']
            );
        }

        $workspaceName = flowcean_workspace_name($state, $name ?? (string) $row['name']);
        $state['workspace']['name'] = $workspaceName;
        $state['meta'] = array_merge(
            is_array($state['meta'] ?? null) ? $state['meta'] : [],
            [
                'workspaceSlug' => $slug,
                'memberRole' => $row['member_role'] ?? null,
                'permissions' => flowcean_workspace_permissions($row['member_role'] ?? null),
                'isPersonal' => (bool) ($row['is_personal'] ?? false),
            ]
        );
        $stateJson = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($stateJson === false) {
            throw new RuntimeException('Impossible d encoder le JSON du workspace.');
        }

        $nextVersion = $currentVersion + 1;
        $now = flowcean_now_iso();
        $update = $pdo->prepare(
            'UPDATE flowcean_workspaces
             SET name = :name, data_json = :data_json, version = :version, updated_at = :updated_at
             WHERE id = :id'
        );
        $update->execute([
            'name' => $workspaceName,
            'data_json' => $stateJson,
            'version' => $nextVersion,
            'updated_at' => $now,
            'id' => $workspaceId,
        ]);

        flowcean_log_event(
            $pdo,
            $workspaceId,
            (int) $user['id'],
            'workspace.saved',
            [
                'version' => $nextVersion,
                'clientId' => $clientId !== null && trim($clientId) !== '' ? flowcean_presence_client_id($clientId) : null,
            ]
        );

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $exception;
    }

    $fresh = flowcean_find_workspace_for_user($pdo, $slug, (int) $user['id'], $user);
    if ($fresh === null) {
        throw new RuntimeException('Impossible de recharger le workspace.');
    }

    return flowcean_attach_user_preferences(
        $pdo,
        flowcean_workspace_payload($fresh, false),
        (int) $fresh['id'],
        (int) $user['id']
    );
}

function flowcean_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('FLOWCEANSESSID');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 8,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function flowcean_user_count(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

function flowcean_active_admin_count(PDO $pdo, ?int $excludeUserId = null): int
{
    if ($excludeUserId !== null) {
        $statement = $pdo->prepare(
            "SELECT COUNT(*) FROM users WHERE role IN ('super', 'admin') AND is_active = 1 AND id <> :user_id"
        );
        $statement->execute(['user_id' => $excludeUserId]);
        return (int) $statement->fetchColumn();
    }

    return (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role IN ('super', 'admin') AND is_active = 1")->fetchColumn();
}

function flowcean_needs_bootstrap(PDO $pdo): bool
{
    return flowcean_user_count($pdo) === 0;
}

function flowcean_normalize_role(?string $role): string
{
    $normalized = strtolower(trim((string) $role));
    return in_array($normalized, ['super', 'admin'], true) ? $normalized : 'member';
}

function flowcean_is_super_user(array $user): bool
{
    return (($user['role'] ?? 'member') === 'super');
}

function flowcean_user_permissions(array $user): array
{
    $isSuper = flowcean_is_super_user($user);
    $isAdmin = $isSuper || (($user['role'] ?? 'member') === 'admin');

    return [
        'canManageUsers' => $isAdmin,
        'canCreateAdmins' => $isAdmin,
        'canManageWorkspace' => $isAdmin,
        'canAccessAllWorkspaces' => $isSuper,
        'canSuperviseEverything' => $isSuper,
    ];
}

function flowcean_public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'displayName' => (string) $user['display_name'],
        'role' => (string) $user['role'],
        'isActive' => (bool) $user['is_active'],
        'createdAt' => (string) $user['created_at'],
        'permissions' => flowcean_user_permissions($user),
    ];
}

function flowcean_find_user_by_id(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $userId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_find_user_by_email(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => mb_strtolower(trim($email))]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_oceanos_session_id(): string
{
    $sessionId = (string) ($_COOKIE['OCEANOSESSID'] ?? '');
    return preg_match('/^[A-Za-z0-9,-]{16,128}$/', $sessionId) === 1 ? $sessionId : '';
}

function flowcean_find_oceanos_user_by_id(PDO $pdo, int $userId): ?array
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

function flowcean_sync_oceanos_user(PDO $pdo, array $oceanosUser): ?array
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
        'role' => flowcean_normalize_role((string) ($oceanosUser['role'] ?? 'member')),
        'is_active' => !empty($oceanosUser['is_active']) ? 1 : 0,
    ];

    $existingByEmail = flowcean_find_user_by_email($pdo, $email);
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
        return flowcean_find_user_by_id($pdo, (int) $existingByEmail['id']);
    }

    $oceanosUserId = (int) ($oceanosUser['id'] ?? 0);
    $existingById = $oceanosUserId > 0 ? flowcean_find_user_by_id($pdo, $oceanosUserId) : null;

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

    return flowcean_find_user_by_email($pdo, $email);
}

function flowcean_bridge_oceanos_session(PDO $pdo): ?array
{
    $oceanosSessionId = flowcean_oceanos_session_id();
    if ($oceanosSessionId === '') {
        return null;
    }

    $flowceanSessionId = session_id();
    session_write_close();

    $_SESSION = [];
    session_name('OCEANOSESSID');
    session_id($oceanosSessionId);
    session_start(['read_and_close' => true]);
    $oceanosUserId = isset($_SESSION['oceanos_user_id']) ? (int) $_SESSION['oceanos_user_id'] : 0;

    $_SESSION = [];
    session_name('FLOWCEANSESSID');
    if ($flowceanSessionId !== '') {
        session_id($flowceanSessionId);
    }
    session_start();

    $oceanosUser = flowcean_find_oceanos_user_by_id($pdo, $oceanosUserId);
    if ($oceanosUser === null || !(bool) $oceanosUser['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    $user = flowcean_sync_oceanos_user($pdo, $oceanosUser);
    if ($user === null || !(bool) $user['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    $_SESSION['user_id'] = (int) $user['id'];
    return $user;
}

function flowcean_current_user(PDO $pdo): ?array
{
    flowcean_start_session();
    $bridgedUser = flowcean_bridge_oceanos_session($pdo);
    if ($bridgedUser !== null) {
        return $bridgedUser;
    }

    $userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    if ($userId <= 0) {
        return null;
    }

    $user = flowcean_find_user_by_id($pdo, $userId);
    if ($user === null || !(bool) $user['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }

    return $user;
}

function flowcean_require_auth(PDO $pdo): array
{
    $user = flowcean_current_user($pdo);
    if ($user === null) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'unauthenticated',
            'message' => 'Connexion requise.',
        ], 401);
    }

    return $user;
}

function flowcean_require_admin(PDO $pdo): array
{
    $user = flowcean_require_auth($pdo);
    if (!in_array(($user['role'] ?? 'member'), ['super', 'admin'], true)) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function flowcean_sync_user_invitations(PDO $pdo, array $user): void
{
    $statement = $pdo->prepare(
        'UPDATE flowcean_workspace_invitations
         SET invited_user_id = :user_id
         WHERE email = :email AND status = :status AND (invited_user_id IS NULL OR invited_user_id = :user_id)'
    );
    $statement->execute([
        'user_id' => (int) $user['id'],
        'email' => mb_strtolower(trim((string) $user['email'])),
        'status' => 'pending',
    ]);
}

function flowcean_login_user(PDO $pdo, string $email, string $password): ?array
{
    $user = flowcean_find_user_by_email($pdo, $email);
    if ($user === null || !(bool) $user['is_active']) {
        return null;
    }

    if (!password_verify($password, (string) $user['password_hash'])) {
        return null;
    }

    flowcean_sync_user_invitations($pdo, $user);
    flowcean_ensure_user_personal_workspace($pdo, $user);

    flowcean_start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    return $user;
}

function flowcean_logout_user(): void
{
    flowcean_start_session();
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

function flowcean_create_user(PDO $pdo, string $displayName, string $email, string $password, string $role = 'member'): array
{
    $normalizedEmail = mb_strtolower(trim($email));
    $normalizedName = trim($displayName);
    $normalizedRole = flowcean_normalize_role($role);

    if ($normalizedName === '' || $normalizedEmail === '' || $password === '') {
        throw new InvalidArgumentException('Nom, email et mot de passe sont obligatoires.');
    }

    if (!filter_var($normalizedEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }

    if (mb_strlen($password) < 8) {
        throw new InvalidArgumentException('Le mot de passe doit contenir au moins 8 caracteres.');
    }

    if (flowcean_find_user_by_email($pdo, $normalizedEmail) !== null) {
        throw new InvalidArgumentException('Un compte existe deja avec cet email.');
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $statement = $pdo->prepare(
        'INSERT INTO users (email, display_name, password_hash, role, is_active)
         VALUES (:email, :display_name, :password_hash, :role, 1)'
    );
    $statement->execute([
        'email' => $normalizedEmail,
        'display_name' => $normalizedName,
        'password_hash' => $passwordHash,
        'role' => $normalizedRole,
    ]);

    $user = flowcean_find_user_by_id($pdo, (int) $pdo->lastInsertId());
    if ($user === null) {
        throw new RuntimeException('Impossible de creer le compte.');
    }

    flowcean_ensure_user_personal_workspace($pdo, $user);
    flowcean_sync_user_invitations($pdo, $user);

    return $user;
}

function flowcean_update_user(PDO $pdo, int $targetUserId, array $input, array $actorUser): array
{
    $target = flowcean_find_user_by_id($pdo, $targetUserId);
    if ($target === null) {
        throw new InvalidArgumentException('Utilisateur introuvable.');
    }

    $displayName = array_key_exists('displayName', $input)
        ? trim((string) $input['displayName'])
        : (string) $target['display_name'];
    $email = array_key_exists('email', $input)
        ? mb_strtolower(trim((string) $input['email']))
        : (string) $target['email'];
    $role = array_key_exists('role', $input)
        ? flowcean_normalize_role((string) $input['role'])
        : (string) $target['role'];
    $isActive = array_key_exists('isActive', $input)
        ? (bool) $input['isActive']
        : (bool) $target['is_active'];
    $password = array_key_exists('password', $input) ? (string) $input['password'] : '';

    if ($displayName === '' || $email === '') {
        throw new InvalidArgumentException('Nom et email sont obligatoires.');
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }

    $existing = flowcean_find_user_by_email($pdo, $email);
    if ($existing !== null && (int) $existing['id'] !== $targetUserId) {
        throw new InvalidArgumentException('Un compte existe deja avec cet email.');
    }

    if ($password !== '' && mb_strlen($password) < 8) {
        throw new InvalidArgumentException('Le mot de passe doit contenir au moins 8 caracteres.');
    }

    $targetIsOnlyActiveAdmin = in_array((string) $target['role'], ['super', 'admin'], true)
        && (bool) $target['is_active']
        && flowcean_active_admin_count($pdo, $targetUserId) === 0;
    if ($targetIsOnlyActiveAdmin && (!in_array($role, ['super', 'admin'], true) || !$isActive)) {
        throw new InvalidArgumentException('Impossible de retirer ou desactiver le dernier administrateur actif.');
    }

    if ((int) $actorUser['id'] === $targetUserId && !$isActive) {
        throw new InvalidArgumentException('Vous ne pouvez pas desactiver votre propre compte.');
    }

    if (
        !flowcean_is_super_user($actorUser)
        && (flowcean_is_super_user($target) || $role === 'super')
    ) {
        throw new InvalidArgumentException('Seul un super-utilisateur peut creer ou modifier un compte super-utilisateur.');
    }

    $fields = [
        'email = :email',
        'display_name = :display_name',
        'role = :role',
        'is_active = :is_active',
    ];
    $params = [
        'id' => $targetUserId,
        'email' => $email,
        'display_name' => $displayName,
        'role' => $role,
        'is_active' => $isActive ? 1 : 0,
    ];

    if ($password !== '') {
        $fields[] = 'password_hash = :password_hash';
        $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    $statement = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id');
    $statement->execute($params);

    $updated = flowcean_find_user_by_id($pdo, $targetUserId);
    if ($updated === null) {
        throw new RuntimeException('Impossible de mettre a jour le compte.');
    }

    flowcean_sync_user_invitations($pdo, $updated);

    return $updated;
}

function flowcean_delete_user(PDO $pdo, int $targetUserId, array $actorUser): void
{
    $target = flowcean_find_user_by_id($pdo, $targetUserId);
    if ($target === null) {
        throw new InvalidArgumentException('Utilisateur introuvable.');
    }

    if ((int) $actorUser['id'] === $targetUserId) {
        throw new InvalidArgumentException('Vous ne pouvez pas supprimer votre propre compte.');
    }

    $targetIsOnlyActiveAdmin = in_array((string) $target['role'], ['super', 'admin'], true)
        && (bool) $target['is_active']
        && flowcean_active_admin_count($pdo, $targetUserId) === 0;
    if ($targetIsOnlyActiveAdmin) {
        throw new InvalidArgumentException('Impossible de supprimer le dernier administrateur actif.');
    }

    $pdo->beginTransaction();
    try {
        $deletePersonalWorkspaces = $pdo->prepare(
            'DELETE FROM flowcean_workspaces WHERE owner_user_id = :user_id AND is_personal = 1'
        );
        $deletePersonalWorkspaces->execute(['user_id' => $targetUserId]);

        $deleteUser = $pdo->prepare('DELETE FROM users WHERE id = :id');
        $deleteUser->execute(['id' => $targetUserId]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function flowcean_bootstrap_admin(PDO $pdo, string $displayName, string $email, string $password): array
{
    if (!flowcean_needs_bootstrap($pdo)) {
        throw new RuntimeException('Le bootstrap initial a deja ete effectue.');
    }

    $user = flowcean_create_user($pdo, $displayName, $email, $password, 'admin');
    flowcean_start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    return $user;
}

function flowcean_list_users(PDO $pdo): array
{
    $statement = $pdo->query('SELECT * FROM users ORDER BY created_at ASC, id ASC');
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_user($row), $rows);
}

function flowcean_list_user_workspaces(PDO $pdo, array $user): array
{
    flowcean_ensure_user_personal_workspace($pdo, $user);

    if (flowcean_is_super_user($user)) {
        $statement = $pdo->prepare(
            "SELECT
                w.*,
                'super' AS member_role,
                (
                    SELECT COUNT(*)
                    FROM flowcean_workspace_members inner_wm
                    WHERE inner_wm.workspace_id = w.id
                ) AS member_count
             FROM flowcean_workspaces w
             WHERE w.deleted_at IS NULL
             ORDER BY (w.owner_user_id = :user_id) DESC, w.is_personal DESC, w.updated_at DESC, w.created_at ASC"
        );
        $statement->execute(['user_id' => (int) $user['id']]);
        $rows = $statement->fetchAll();

        return array_map(static fn(array $row): array => flowcean_public_workspace($row), $rows);
    }

    $statement = $pdo->prepare(
        'SELECT
            w.*,
            wm.role AS member_role,
            (
                SELECT COUNT(*)
                FROM flowcean_workspace_members inner_wm
                WHERE inner_wm.workspace_id = w.id
            ) AS member_count
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = :user_id
           AND w.deleted_at IS NULL
         ORDER BY w.is_personal DESC, w.updated_at DESC, w.created_at ASC'
    );
    $statement->execute(['user_id' => (int) $user['id']]);
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_workspace($row), $rows);
}

function flowcean_list_deleted_user_workspaces(PDO $pdo, array $user): array
{
    if (flowcean_is_super_user($user)) {
        $statement = $pdo->prepare(
            "SELECT
                w.*,
                'super' AS member_role,
                (
                    SELECT COUNT(*)
                    FROM flowcean_workspace_members inner_wm
                    WHERE inner_wm.workspace_id = w.id
                ) AS member_count
             FROM flowcean_workspaces w
             WHERE w.deleted_at IS NOT NULL
               AND w.deleted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
             ORDER BY w.deleted_at DESC, w.updated_at DESC"
        );
        $statement->execute();
        $rows = $statement->fetchAll();

        return array_map(static fn(array $row): array => flowcean_public_workspace($row), $rows);
    }

    $statement = $pdo->prepare(
        'SELECT
            w.*,
            wm.role AS member_role,
            (
                SELECT COUNT(*)
                FROM flowcean_workspace_members inner_wm
                WHERE inner_wm.workspace_id = w.id
            ) AS member_count
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = :user_id
           AND w.deleted_at IS NOT NULL
           AND w.deleted_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
         ORDER BY w.deleted_at DESC, w.updated_at DESC'
    );
    $statement->execute(['user_id' => (int) $user['id']]);
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_workspace($row), $rows);
}

function flowcean_find_workspace_for_user_including_deleted(PDO $pdo, string $slug, int $userId, ?array $user = null): ?array
{
    if ($user !== null && flowcean_is_super_user($user)) {
        $statement = $pdo->prepare(
            "SELECT w.*, 'super' AS member_role
             FROM flowcean_workspaces w
             WHERE w.slug = :slug
             LIMIT 1"
        );
        $statement->execute([
            'slug' => $slug,
        ]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    $statement = $pdo->prepare(
        'SELECT w.*, wm.role AS member_role
         FROM flowcean_workspaces w
         INNER JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
         WHERE w.slug = :slug AND wm.user_id = :user_id
         LIMIT 1'
    );
    $statement->execute([
        'slug' => $slug,
        'user_id' => $userId,
    ]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_soft_delete_workspace(PDO $pdo, string $slug, array $user): array
{
    $workspace = flowcean_find_workspace_for_user($pdo, $slug, (int) $user['id'], $user);
    if ($workspace === null) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'workspace_not_found',
            'message' => 'Workspace introuvable ou inaccessible.',
        ], 404);
    }

    if ((bool) ($workspace['is_personal'] ?? false) && !flowcean_is_super_user($user)) {
        throw new InvalidArgumentException('L espace personnel ne peut pas etre supprime.');
    }

    if (!flowcean_workspace_role_allows($workspace['member_role'] ?? null, 'admin')) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Droits insuffisants pour supprimer ce workspace.',
        ], 403);
    }

    $now = flowcean_now_iso();
    $update = $pdo->prepare(
        'UPDATE flowcean_workspaces
         SET deleted_at = :deleted_at, updated_at = :updated_at
         WHERE id = :id AND deleted_at IS NULL'
    );
    $update->execute([
        'deleted_at' => $now,
        'updated_at' => $now,
        'id' => (int) $workspace['id'],
    ]);

    flowcean_log_event($pdo, (int) $workspace['id'], (int) $user['id'], 'workspace.deleted', [
        'slug' => (string) $workspace['slug'],
    ]);

    return flowcean_find_workspace_for_user_including_deleted($pdo, $slug, (int) $user['id'], $user) ?? $workspace;
}

function flowcean_restore_workspace(PDO $pdo, string $slug, array $user): array
{
    $workspace = flowcean_find_workspace_for_user_including_deleted($pdo, $slug, (int) $user['id'], $user);
    if ($workspace === null || $workspace['deleted_at'] === null) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'workspace_not_found',
            'message' => 'Workspace supprime introuvable.',
        ], 404);
    }

    if (!flowcean_workspace_role_allows($workspace['member_role'] ?? null, 'admin')) {
        flowcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Droits insuffisants pour restaurer ce workspace.',
        ], 403);
    }

    $deletedAt = new DateTimeImmutable((string) $workspace['deleted_at'], new DateTimeZone('UTC'));
    if ($deletedAt < (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('-30 days')) {
        throw new InvalidArgumentException('Ce workspace a depasse le delai de restauration de 30 jours.');
    }

    $now = flowcean_now_iso();
    $update = $pdo->prepare(
        'UPDATE flowcean_workspaces
         SET deleted_at = NULL, updated_at = :updated_at
         WHERE id = :id'
    );
    $update->execute([
        'updated_at' => $now,
        'id' => (int) $workspace['id'],
    ]);

    flowcean_log_event($pdo, (int) $workspace['id'], (int) $user['id'], 'workspace.restored', [
        'slug' => (string) $workspace['slug'],
    ]);

    $restored = flowcean_find_workspace_for_user($pdo, $slug, (int) $user['id'], $user);
    if ($restored === null) {
        throw new RuntimeException('Impossible de restaurer le workspace.');
    }

    return $restored;
}

function flowcean_list_workspace_members(PDO $pdo, int $workspaceId): array
{
    $statement = $pdo->prepare(
        'SELECT
            u.id,
            u.email,
            u.display_name,
            u.role AS account_role,
            u.is_active,
            wm.role AS workspace_role,
            wm.created_at
         FROM flowcean_workspace_members wm
         INNER JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = :workspace_id
         ORDER BY
            CASE wm.role
                WHEN \'owner\' THEN 1
                WHEN \'admin\' THEN 2
                WHEN \'editor\' THEN 3
                ELSE 4
            END,
            u.display_name ASC'
    );
    $statement->execute(['workspace_id' => $workspaceId]);
    $rows = $statement->fetchAll();

    return array_map(
        static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'email' => (string) $row['email'],
                'displayName' => (string) $row['display_name'],
                'accountRole' => (string) $row['account_role'],
                'workspaceRole' => (string) $row['workspace_role'],
                'isActive' => (bool) $row['is_active'],
                'joinedAt' => (string) $row['created_at'],
            ];
        },
        $rows
    );
}

function flowcean_update_workspace_member_role(PDO $pdo, string $workspaceSlug, array $actorUser, int $targetUserId, string $role): array
{
    $workspace = flowcean_require_workspace_access($pdo, $workspaceSlug, $actorUser, 'admin');
    $workspaceId = (int) $workspace['id'];
    $normalizedRole = flowcean_workspace_member_role($role, false);

    if ($targetUserId <= 0) {
        throw new InvalidArgumentException('Membre introuvable.');
    }

    if ($targetUserId === (int) $actorUser['id']) {
        throw new InvalidArgumentException('Vous ne pouvez pas modifier vos propres droits depuis ce panneau.');
    }

    $membership = flowcean_find_workspace_membership($pdo, $workspaceId, $targetUserId);
    if ($membership === null) {
        throw new InvalidArgumentException('Ce membre ne fait pas partie du workspace.');
    }

    if ((string) $membership['role'] === 'owner') {
        throw new InvalidArgumentException('Les droits du proprietaire ne peuvent pas etre modifies.');
    }

    $update = $pdo->prepare(
        'UPDATE flowcean_workspace_members
         SET role = :role
         WHERE workspace_id = :workspace_id AND user_id = :user_id'
    );
    $update->execute([
        'role' => $normalizedRole,
        'workspace_id' => $workspaceId,
        'user_id' => $targetUserId,
    ]);

    flowcean_log_event($pdo, $workspaceId, (int) $actorUser['id'], 'workspace.member_role_updated', [
        'userId' => $targetUserId,
        'role' => $normalizedRole,
    ]);

    flowcean_create_user_notification(
        $pdo,
        $targetUserId,
        (int) $actorUser['id'],
        'workspace.member_role_updated',
        'Droits modifies',
        sprintf('Vos droits dans "%s" sont maintenant : %s.', (string) $workspace['name'], flowcean_workspace_member_role_label($normalizedRole)),
        [
            'workspaceId' => $workspaceId,
            'workspaceSlug' => (string) $workspace['slug'],
            'workspaceName' => (string) $workspace['name'],
            'role' => $normalizedRole,
        ]
    );

    return $workspace;
}

function flowcean_remove_workspace_member(PDO $pdo, string $workspaceSlug, array $actorUser, int $targetUserId): array
{
    $workspace = flowcean_require_workspace_access($pdo, $workspaceSlug, $actorUser, 'admin');
    $workspaceId = (int) $workspace['id'];

    if ($targetUserId <= 0) {
        throw new InvalidArgumentException('Membre introuvable.');
    }

    if ($targetUserId === (int) $actorUser['id']) {
        throw new InvalidArgumentException('Vous ne pouvez pas supprimer votre propre acces depuis ce panneau.');
    }

    $membership = flowcean_find_workspace_membership($pdo, $workspaceId, $targetUserId);
    if ($membership === null) {
        throw new InvalidArgumentException('Ce membre ne fait pas partie du workspace.');
    }

    if ((string) $membership['role'] === 'owner') {
        throw new InvalidArgumentException('Le proprietaire ne peut pas etre retire du workspace.');
    }

    $delete = $pdo->prepare(
        'DELETE FROM flowcean_workspace_members
         WHERE workspace_id = :workspace_id AND user_id = :user_id'
    );
    $delete->execute([
        'workspace_id' => $workspaceId,
        'user_id' => $targetUserId,
    ]);

    flowcean_log_event($pdo, $workspaceId, (int) $actorUser['id'], 'workspace.member_removed', [
        'userId' => $targetUserId,
    ]);

    flowcean_create_user_notification(
        $pdo,
        $targetUserId,
        (int) $actorUser['id'],
        'workspace.member_removed',
        'Acces retire',
        sprintf('Votre acces au workspace "%s" a ete retire.', (string) $workspace['name']),
        [
            'workspaceId' => $workspaceId,
            'workspaceSlug' => (string) $workspace['slug'],
            'workspaceName' => (string) $workspace['name'],
        ]
    );

    return $workspace;
}

function flowcean_get_workspace_invitation(PDO $pdo, int $invitationId): ?array
{
    $statement = $pdo->prepare(
        'SELECT
            wi.*,
            iu.display_name AS invited_user_display_name,
            iu.email AS invited_user_email,
            su.display_name AS sender_display_name,
            su.email AS sender_email,
            w.slug AS workspace_slug,
            w.name AS workspace_name,
            w.is_personal AS workspace_is_personal
         FROM flowcean_workspace_invitations wi
         INNER JOIN flowcean_workspaces w ON w.id = wi.workspace_id
         LEFT JOIN users iu ON iu.id = wi.invited_user_id
         INNER JOIN users su ON su.id = wi.invited_by_user_id
         WHERE wi.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $invitationId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function flowcean_public_workspace_invitation(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'role' => (string) $row['role'],
        'status' => (string) $row['status'],
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
        'acceptedAt' => $row['accepted_at'] ?: null,
        'invitedUser' => $row['invited_user_email'] ?? null
            ? [
                'email' => (string) $row['invited_user_email'],
                'displayName' => (string) ($row['invited_user_display_name'] ?? ''),
            ]
            : null,
        'invitedBy' => [
            'email' => (string) ($row['sender_email'] ?? ''),
            'displayName' => (string) ($row['sender_display_name'] ?? ''),
        ],
    ];
}

function flowcean_public_pending_invitation(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'role' => (string) $row['role'],
        'createdAt' => (string) $row['created_at'],
        'workspace' => [
            'id' => (int) $row['workspace_id'],
            'slug' => (string) $row['workspace_slug'],
            'name' => (string) $row['workspace_name'],
            'isPersonal' => (bool) ($row['workspace_is_personal'] ?? false),
        ],
        'invitedBy' => [
            'email' => (string) ($row['sender_email'] ?? ''),
            'displayName' => (string) ($row['sender_display_name'] ?? ''),
        ],
    ];
}

function flowcean_list_workspace_invitations(PDO $pdo, int $workspaceId): array
{
    $statement = $pdo->prepare(
        'SELECT
            wi.*,
            iu.display_name AS invited_user_display_name,
            iu.email AS invited_user_email,
            su.display_name AS sender_display_name,
            su.email AS sender_email
         FROM flowcean_workspace_invitations wi
         LEFT JOIN users iu ON iu.id = wi.invited_user_id
         INNER JOIN users su ON su.id = wi.invited_by_user_id
         WHERE wi.workspace_id = :workspace_id AND wi.status = :status
         ORDER BY wi.created_at DESC'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'status' => 'pending',
    ]);
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_workspace_invitation($row), $rows);
}

function flowcean_list_user_pending_invitations(PDO $pdo, array $user): array
{
    $statement = $pdo->prepare(
        'SELECT
            wi.*,
            w.slug AS workspace_slug,
            w.name AS workspace_name,
            w.is_personal AS workspace_is_personal,
            su.display_name AS sender_display_name,
            su.email AS sender_email
         FROM flowcean_workspace_invitations wi
         INNER JOIN flowcean_workspaces w ON w.id = wi.workspace_id
         INNER JOIN users su ON su.id = wi.invited_by_user_id
         WHERE wi.email = :email AND wi.status = :status
         ORDER BY wi.created_at DESC'
    );
    $statement->execute([
        'email' => mb_strtolower(trim((string) $user['email'])),
        'status' => 'pending',
    ]);
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => flowcean_public_pending_invitation($row), $rows);
}

function flowcean_create_workspace_invitation(PDO $pdo, int $workspaceId, array $inviterUser, string $email, string $role = 'editor'): array
{
    $normalizedEmail = mb_strtolower(trim($email));
    if ($normalizedEmail === '') {
        throw new InvalidArgumentException('L email du membre a inviter est obligatoire.');
    }

    if (!filter_var($normalizedEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse email invalide.');
    }

    $normalizedRole = flowcean_workspace_member_role($role, false);
    $invitedUser = flowcean_find_user_by_email($pdo, $normalizedEmail);
    if ($invitedUser !== null) {
        $existingMembership = flowcean_find_workspace_membership($pdo, $workspaceId, (int) $invitedUser['id']);
        if ($existingMembership !== null) {
            throw new InvalidArgumentException('Cet utilisateur fait deja partie du workspace.');
        }
    }

    $statement = $pdo->prepare(
        'INSERT INTO flowcean_workspace_invitations (workspace_id, email, invited_user_id, invited_by_user_id, role, status, accepted_at)
         VALUES (:workspace_id, :email, :invited_user_id, :invited_by_user_id, :role, :status, NULL)
         ON DUPLICATE KEY UPDATE
            invited_user_id = VALUES(invited_user_id),
            invited_by_user_id = VALUES(invited_by_user_id),
            role = VALUES(role),
            status = VALUES(status),
            accepted_at = NULL,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'workspace_id' => $workspaceId,
        'email' => $normalizedEmail,
        'invited_user_id' => $invitedUser ? (int) $invitedUser['id'] : null,
        'invited_by_user_id' => (int) $inviterUser['id'],
        'role' => $normalizedRole,
        'status' => 'pending',
    ]);

    $invitationId = (int) $pdo->lastInsertId();
    if ($invitationId <= 0) {
        $lookup = $pdo->prepare(
            'SELECT id FROM flowcean_workspace_invitations WHERE workspace_id = :workspace_id AND email = :email LIMIT 1'
        );
        $lookup->execute([
            'workspace_id' => $workspaceId,
            'email' => $normalizedEmail,
        ]);
        $invitationId = (int) $lookup->fetchColumn();
    }

    flowcean_log_event(
        $pdo,
        $workspaceId,
        (int) $inviterUser['id'],
        'workspace.invited',
        ['email' => $normalizedEmail, 'role' => $normalizedRole]
    );

    $invitation = flowcean_get_workspace_invitation($pdo, $invitationId);
    if ($invitation === null) {
        throw new RuntimeException('Impossible de creer l invitation.');
    }

    if ($invitedUser !== null) {
        flowcean_create_user_notification(
            $pdo,
            (int) $invitedUser['id'],
            (int) $inviterUser['id'],
            'workspace.invited',
            'Invitation a un workspace',
            sprintf('%s vous invite a rejoindre "%s".', (string) ($inviterUser['display_name'] ?? $inviterUser['email'] ?? 'Un utilisateur'), (string) ($invitation['workspace_name'] ?? 'un workspace')),
            [
                'workspaceId' => $workspaceId,
                'workspaceSlug' => (string) ($invitation['workspace_slug'] ?? ''),
                'workspaceName' => (string) ($invitation['workspace_name'] ?? ''),
                'invitationId' => $invitationId,
                'role' => $normalizedRole,
            ]
        );
    }

    return $invitation;
}

function flowcean_accept_workspace_invitation(PDO $pdo, int $invitationId, array $user): array
{
    $pdo->beginTransaction();

    try {
        $statement = $pdo->prepare(
            'SELECT * FROM flowcean_workspace_invitations WHERE id = :id LIMIT 1 FOR UPDATE'
        );
        $statement->execute(['id' => $invitationId]);
        $invitation = $statement->fetch();
        if (!is_array($invitation)) {
            throw new InvalidArgumentException('Invitation introuvable.');
        }

        if ((string) $invitation['status'] !== 'pending') {
            throw new InvalidArgumentException('Cette invitation n est plus disponible.');
        }

        $userEmail = mb_strtolower(trim((string) $user['email']));
        $inviteEmail = mb_strtolower(trim((string) $invitation['email']));
        if ($inviteEmail !== $userEmail) {
            throw new InvalidArgumentException('Cette invitation ne correspond pas a votre compte.');
        }

        $attach = $pdo->prepare(
            'INSERT INTO flowcean_workspace_members (workspace_id, user_id, role)
             VALUES (:workspace_id, :user_id, :role)
             ON DUPLICATE KEY UPDATE role = VALUES(role)'
        );
        $attach->execute([
            'workspace_id' => (int) $invitation['workspace_id'],
            'user_id' => (int) $user['id'],
            'role' => flowcean_workspace_member_role((string) $invitation['role'], false),
        ]);

        $update = $pdo->prepare(
            'UPDATE flowcean_workspace_invitations
             SET invited_user_id = :user_id, status = :status, accepted_at = :accepted_at
             WHERE id = :id'
        );
        $update->execute([
            'user_id' => (int) $user['id'],
            'status' => 'accepted',
            'accepted_at' => flowcean_now_iso(),
            'id' => $invitationId,
        ]);

        flowcean_log_event(
            $pdo,
            (int) $invitation['workspace_id'],
            (int) $user['id'],
            'workspace.invitation_accepted',
            ['invitationId' => $invitationId]
        );

        $workspaceRow = flowcean_find_workspace_by_id($pdo, (int) $invitation['workspace_id']);
        $workspaceName = $workspaceRow ? (string) $workspaceRow['name'] : 'le workspace';
        $recipients = array_values(array_unique(array_filter([
            (int) ($invitation['invited_by_user_id'] ?? 0),
            $workspaceRow && isset($workspaceRow['owner_user_id']) ? (int) $workspaceRow['owner_user_id'] : 0,
        ])));
        foreach ($recipients as $recipientId) {
            if ($recipientId <= 0 || $recipientId === (int) $user['id']) {
                continue;
            }
            flowcean_create_user_notification(
                $pdo,
                $recipientId,
                (int) $user['id'],
                'workspace.invitation_accepted',
                'Invitation acceptee',
                sprintf('%s a accepte l invitation a rejoindre "%s".', (string) ($user['display_name'] ?? $user['email'] ?? 'Un utilisateur'), $workspaceName),
                [
                    'workspaceId' => (int) $invitation['workspace_id'],
                    'workspaceSlug' => $workspaceRow ? (string) $workspaceRow['slug'] : '',
                    'workspaceName' => $workspaceName,
                    'invitationId' => $invitationId,
                ]
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $exception;
    }

    $workspace = flowcean_find_workspace_by_id_for_user($pdo, (int) $invitation['workspace_id'], (int) $user['id']);
    if ($workspace === null) {
        throw new RuntimeException('Impossible d ouvrir le workspace accepte.');
    }

    return $workspace;
}

function flowcean_decline_workspace_invitation(PDO $pdo, int $invitationId, array $user): void
{
    $pdo->beginTransaction();

    try {
        $statement = $pdo->prepare(
            'SELECT * FROM flowcean_workspace_invitations WHERE id = :id LIMIT 1 FOR UPDATE'
        );
        $statement->execute(['id' => $invitationId]);
        $invitation = $statement->fetch();
        if (!is_array($invitation)) {
            throw new InvalidArgumentException('Invitation introuvable.');
        }

        if ((string) $invitation['status'] !== 'pending') {
            throw new InvalidArgumentException('Cette invitation n est plus disponible.');
        }

        $userEmail = mb_strtolower(trim((string) $user['email']));
        $inviteEmail = mb_strtolower(trim((string) $invitation['email']));
        if ($inviteEmail !== $userEmail) {
            throw new InvalidArgumentException('Cette invitation ne correspond pas a votre compte.');
        }

        $update = $pdo->prepare(
            'UPDATE flowcean_workspace_invitations
             SET invited_user_id = :user_id, status = :status, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $update->execute([
            'user_id' => (int) $user['id'],
            'status' => 'revoked',
            'id' => $invitationId,
        ]);

        flowcean_log_event(
            $pdo,
            (int) $invitation['workspace_id'],
            (int) $user['id'],
            'workspace.invitation_declined',
            ['invitationId' => $invitationId]
        );

        $workspaceRow = flowcean_find_workspace_by_id($pdo, (int) $invitation['workspace_id']);
        $workspaceName = $workspaceRow ? (string) $workspaceRow['name'] : 'le workspace';
        $recipients = array_values(array_unique(array_filter([
            (int) ($invitation['invited_by_user_id'] ?? 0),
            $workspaceRow && isset($workspaceRow['owner_user_id']) ? (int) $workspaceRow['owner_user_id'] : 0,
        ])));
        foreach ($recipients as $recipientId) {
            if ($recipientId <= 0 || $recipientId === (int) $user['id']) {
                continue;
            }
            flowcean_create_user_notification(
                $pdo,
                $recipientId,
                (int) $user['id'],
                'workspace.invitation_declined',
                'Invitation refusee',
                sprintf('%s a refuse l invitation a rejoindre "%s".', (string) ($user['display_name'] ?? $user['email'] ?? 'Un utilisateur'), $workspaceName),
                [
                    'workspaceId' => (int) $invitation['workspace_id'],
                    'workspaceSlug' => $workspaceRow ? (string) $workspaceRow['slug'] : '',
                    'workspaceName' => $workspaceName,
                    'invitationId' => $invitationId,
                ]
            );
        }

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $exception;
    }
}
