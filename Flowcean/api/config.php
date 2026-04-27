<?php
declare(strict_types=1);

$oceanosConfigDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'config';
$oceanosLocalConfigPath = $oceanosConfigDir . DIRECTORY_SEPARATOR . 'server.local.php';
$oceanosServerConfigPath = is_file($oceanosLocalConfigPath)
    ? $oceanosLocalConfigPath
    : $oceanosConfigDir . DIRECTORY_SEPARATOR . 'server.php';
$oceanosServerConfig = is_file($oceanosServerConfigPath) ? require $oceanosServerConfigPath : [];
$oceanosServerConfig = is_array($oceanosServerConfig) ? $oceanosServerConfig : [];

return [
    'db_host' => getenv('FLOWCEAN_DB_HOST') ?: ($oceanosServerConfig['db_host'] ?? '127.0.0.1'),
    'db_port' => (int) (getenv('FLOWCEAN_DB_PORT') ?: ($oceanosServerConfig['db_port'] ?? 3306)),
    'db_name' => getenv('FLOWCEAN_DB_NAME') ?: ($oceanosServerConfig['db_name'] ?? 'OceanOS'),
    'db_user' => getenv('FLOWCEAN_DB_USER') ?: ($oceanosServerConfig['db_user'] ?? 'root'),
    'db_pass' => getenv('FLOWCEAN_DB_PASS') ?: ($oceanosServerConfig['db_pass'] ?? ''),
    'ai_secret' => getenv('FLOWCEAN_AI_SECRET') ?: '',
    'ca_bundle' => getenv('FLOWCEAN_CA_BUNDLE') ?: '',
    'default_workspace_slug' => getenv('FLOWCEAN_DEFAULT_WORKSPACE') ?: 'main',
    'default_workspace_name' => getenv('FLOWCEAN_DEFAULT_WORKSPACE_NAME') ?: 'Flowcean Workspace',
];
