<?php
declare(strict_types=1);

$oceanosServerConfigPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'server.php';
$oceanosServerConfig = is_file($oceanosServerConfigPath) ? require $oceanosServerConfigPath : [];
$oceanosServerConfig = is_array($oceanosServerConfig) ? $oceanosServerConfig : [];

return [
    'db_host' => getenv('INVOCEAN_DB_HOST') ?: (getenv('FLOWCEAN_DB_HOST') ?: ($oceanosServerConfig['db_host'] ?? '127.0.0.1')),
    'db_port' => (int) (getenv('INVOCEAN_DB_PORT') ?: (getenv('FLOWCEAN_DB_PORT') ?: ($oceanosServerConfig['db_port'] ?? 3306))),
    'db_name' => getenv('INVOCEAN_DB_NAME') ?: (getenv('FLOWCEAN_DB_NAME') ?: ($oceanosServerConfig['db_name'] ?? 'OceanOS')),
    'db_user' => getenv('INVOCEAN_DB_USER') ?: (getenv('FLOWCEAN_DB_USER') ?: ($oceanosServerConfig['db_user'] ?? 'root')),
    'db_pass' => getenv('INVOCEAN_DB_PASS') ?: (getenv('FLOWCEAN_DB_PASS') ?: ($oceanosServerConfig['db_pass'] ?? '')),
    'session_name' => getenv('INVOCEAN_SESSION_NAME') ?: 'FLOWCEANSESSID',
    'secret' => getenv('INVOCEAN_SECRET') ?: (getenv('FLOWCEAN_AI_SECRET') ?: ''),
    'ca_bundle' => getenv('INVOCEAN_CA_BUNDLE') ?: (getenv('FLOWCEAN_CA_BUNDLE') ?: ''),
    'flowcean_url' => getenv('INVOCEAN_FLOWCEAN_URL') ?: '/OceanOS/',
    'default_sync_limit' => (int) (getenv('INVOCEAN_SYNC_LIMIT') ?: 80),
];
