<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function mobywork_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mobywork_read_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function mobywork_config(): array
{
    $oceanosServerConfigPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'server.php';
    $oceanosServerConfig = is_file($oceanosServerConfigPath) ? require $oceanosServerConfigPath : [];
    $oceanosServerConfig = is_array($oceanosServerConfig) ? $oceanosServerConfig : [];

    return [
        'db_host' => getenv('MOBYWORK_DB_HOST') ?: (getenv('OCEANOS_DB_HOST') ?: ($oceanosServerConfig['db_host'] ?? '127.0.0.1')),
        'db_port' => (int) (getenv('MOBYWORK_DB_PORT') ?: (getenv('OCEANOS_DB_PORT') ?: ($oceanosServerConfig['db_port'] ?? 3306))),
        'db_name' => getenv('MOBYWORK_DB_NAME') ?: (getenv('OCEANOS_DB_NAME') ?: ($oceanosServerConfig['db_name'] ?? 'OceanOS')),
        'db_user' => getenv('MOBYWORK_DB_USER') ?: (getenv('OCEANOS_DB_USER') ?: ($oceanosServerConfig['db_user'] ?? 'root')),
        'db_pass' => getenv('MOBYWORK_DB_PASS') ?: (getenv('OCEANOS_DB_PASS') ?: ($oceanosServerConfig['db_pass'] ?? '')),
    ];
}

function mobywork_bridge_token(): string
{
    $env = trim((string) (getenv('MOBYWORK_BRIDGE_TOKEN') ?: ''));
    if ($env !== '') {
        return $env;
    }

    $file = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . '.mobywork_bridge_secret';
    return is_file($file) ? trim((string) file_get_contents($file)) : '';
}

function mobywork_require_bridge_token(): void
{
    $expected = mobywork_bridge_token();
    $actual = trim((string) ($_SERVER['HTTP_X_MOBYWORK_BRIDGE'] ?? ''));
    if ($expected === '' || $actual === '' || !hash_equals($expected, $actual)) {
        mobywork_json(['ok' => false, 'error' => 'forbidden'], 403);
    }
}

function mobywork_pdo_root(): PDO
{
    $config = mobywork_config();
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

function mobywork_pdo(): PDO
{
    $config = mobywork_config();
    $dbName = str_replace('`', '``', (string) $config['db_name']);
    mobywork_pdo_root()->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']),
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    mobywork_ensure_users_schema($pdo);
    return $pdo;
}

function mobywork_ensure_users_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS oceanos_users (
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
}

function mobywork_email(string $email): string
{
    return mb_strtolower(trim($email));
}

function mobywork_role(?string $role): string
{
    $normalized = mb_strtolower(trim((string) $role));
    if ($normalized === 'user') {
        return 'member';
    }
    return in_array($normalized, ['super', 'admin'], true) ? $normalized : 'member';
}

function mobywork_public_user(array $row): array
{
    $accountRole = mobywork_role((string) ($row['role'] ?? 'member'));
    return [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'nom' => (string) ($row['display_name'] ?? $row['email']),
        'displayName' => (string) ($row['display_name'] ?? $row['email']),
        'role' => in_array($accountRole, ['super', 'admin'], true) ? 'admin' : 'user',
        'accountRole' => $accountRole,
        'isActive' => (bool) ($row['is_active'] ?? false),
        'is_active' => (bool) ($row['is_active'] ?? false),
        'createdAt' => isset($row['created_at']) ? (string) $row['created_at'] : null,
        'source' => 'oceanos',
    ];
}

function mobywork_find_user_by_email(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE email = :email LIMIT 1');
    $statement->execute(['email' => mobywork_email($email)]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function mobywork_find_user_by_id(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare('SELECT * FROM oceanos_users WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function mobywork_active_admin_count(PDO $pdo, ?int $excludeUserId = null): int
{
    if ($excludeUserId !== null) {
        $statement = $pdo->prepare("SELECT COUNT(*) FROM oceanos_users WHERE role IN ('super', 'admin') AND is_active = 1 AND id <> :id");
        $statement->execute(['id' => $excludeUserId]);
        return (int) $statement->fetchColumn();
    }

    return (int) $pdo->query("SELECT COUNT(*) FROM oceanos_users WHERE role IN ('super', 'admin') AND is_active = 1")->fetchColumn();
}

mobywork_require_bridge_token();

try {
    $input = mobywork_read_json();
    $action = mb_strtolower(trim((string) ($input['action'] ?? '')));
    $pdo = mobywork_pdo();

    if ($action === 'login') {
        $user = mobywork_find_user_by_email($pdo, (string) ($input['email'] ?? ''));
        if ($user === null || !(bool) $user['is_active'] || !password_verify((string) ($input['password'] ?? ''), (string) $user['password_hash'])) {
            mobywork_json(['ok' => false, 'error' => 'Identifiants incorrects'], 401);
        }

        mobywork_json(['ok' => true, 'user' => mobywork_public_user($user)]);
    }

    if ($action === 'find') {
        $user = mobywork_find_user_by_id($pdo, (int) ($input['id'] ?? 0));
        mobywork_json(['ok' => true, 'user' => $user ? mobywork_public_user($user) : null]);
    }

    if ($action === 'list') {
        $rows = $pdo->query('SELECT * FROM oceanos_users WHERE is_active = 1 ORDER BY display_name ASC, email ASC')->fetchAll();
        mobywork_json(['ok' => true, 'users' => array_map('mobywork_public_user', $rows)]);
    }

    if ($action === 'ai') {
        $userId = (int) ($input['id'] ?? 0);
        if ($userId <= 0) {
            mobywork_json(['ok' => false, 'error' => 'Utilisateur invalide.'], 422);
        }

        $settings = oceanos_ai_private_settings($pdo, $userId);
        mobywork_json([
            'ok' => true,
            'settings' => [
                'provider' => 'groq',
                'model' => (string) ($settings['model'] ?? 'llama-3.3-70b-versatile'),
                'apiKey' => (string) ($settings['apiKey'] ?? ''),
                'hasApiKey' => trim((string) ($settings['apiKey'] ?? '')) !== '',
            ],
        ]);
    }

    if ($action === 'prestashop') {
        $settings = oceanos_prestashop_private_settings($pdo);
        mobywork_json([
            'ok' => true,
            'settings' => [
                'shopUrl' => (string) ($settings['shopUrl'] ?? ''),
                'apiUrl' => rtrim((string) ($settings['shopUrl'] ?? ''), '/') . '/api/',
                'apiKey' => (string) ($settings['webserviceKey'] ?? ''),
                'hasApiKey' => trim((string) ($settings['webserviceKey'] ?? '')) !== '',
                'webserviceKeyHint' => (string) ($settings['webserviceKeyHint'] ?? ''),
                'syncWindowDays' => (int) ($settings['syncWindowDays'] ?? 30),
                'managedBy' => 'OceanOS',
            ],
        ]);
    }

    if ($action === 'create') {
        mobywork_json([
            'ok' => false,
            'error' => 'managed_by_oceanos',
            'message' => 'La creation des comptes se fait maintenant dans OceanOS.',
            'oceanosUrl' => '/OceanOS/',
        ], 410);
    }

    if ($action === 'deactivate') {
        mobywork_json([
            'ok' => false,
            'error' => 'managed_by_oceanos',
            'message' => 'La gestion des droits se fait maintenant dans OceanOS.',
            'oceanosUrl' => '/OceanOS/',
        ], 410);
    }

    mobywork_json(['ok' => false, 'error' => 'Action non supportee.'], 422);
} catch (Throwable $exception) {
    mobywork_json(['ok' => false, 'error' => $exception->getMessage()], 500);
}
