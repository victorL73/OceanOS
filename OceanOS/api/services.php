<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

const OCEANOS_SERVICES_API_VERSION = '2026-05-02-git-update-fallback';

function oceanos_app_root(): string
{
    return dirname(__DIR__, 2);
}

function oceanos_service_control_path(): string
{
    return '/usr/local/sbin/oceanos-service-control';
}

function oceanos_services_catalog(): array
{
    return [
        'web' => [
            'id' => 'web',
            'label' => 'Serveur web',
            'description' => 'Apache sert OceanOS et les modules PHP.',
            'unit' => 'apache2',
        ],
        'database' => [
            'id' => 'database',
            'label' => 'Base de donnees',
            'description' => 'MariaDB/MySQL stocke les comptes et donnees applicatives.',
            'unit' => 'mariadb',
        ],
        'mobywork' => [
            'id' => 'mobywork',
            'label' => 'Mobywork API',
            'description' => 'API Node utilisee par Mobywork.',
            'unit' => 'mobywork-backend',
        ],
    ];
}

function oceanos_service_control_available(): bool
{
    $path = oceanos_service_control_path();
    return PHP_OS_FAMILY === 'Linux' && is_file($path);
}

function oceanos_systemctl_path(): string
{
    foreach (['/usr/bin/systemctl', '/bin/systemctl'] as $path) {
        if (is_executable($path)) {
            return $path;
        }
    }

    return 'systemctl';
}

function oceanos_can_run_process(): bool
{
    return function_exists('proc_open') || function_exists('shell_exec');
}

function oceanos_git_candidates(): array
{
    $candidates = ['git'];
    if (PHP_OS_FAMILY === 'Windows') {
        $userProfile = (string) (getenv('USERPROFILE') ?: '');
        $localAppData = (string) (getenv('LOCALAPPDATA') ?: ($userProfile !== '' ? $userProfile . '\\AppData\\Local' : ''));
        $candidates = array_merge($candidates, [
            'C:\\Program Files\\Git\\cmd\\git.exe',
            'C:\\Program Files\\Git\\bin\\git.exe',
            'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
            $userProfile !== '' ? $userProfile . '\\AppData\\Local\\Programs\\Git\\cmd\\git.exe' : '',
            $userProfile !== '' ? $userProfile . '\\AppData\\Local\\Programs\\Git\\bin\\git.exe' : '',
        ]);
        if ($localAppData !== '') {
            foreach (glob($localAppData . '\\GitHubDesktop\\app-*\\resources\\app\\git\\cmd\\git.exe') ?: [] as $path) {
                $candidates[] = $path;
            }
            foreach (glob($localAppData . '\\GitHubDesktop\\app-*\\resources\\app\\git\\mingw64\\bin\\git.exe') ?: [] as $path) {
                $candidates[] = $path;
            }
        }
    } else {
        $candidates = array_merge($candidates, ['/usr/bin/git', '/usr/local/bin/git', '/bin/git']);
    }

    return array_values(array_unique(array_filter($candidates)));
}

function oceanos_git_path(): string
{
    foreach (oceanos_git_candidates() as $candidate) {
        if ($candidate === 'git') {
            continue;
        }
        if (is_file($candidate) && is_executable($candidate)) {
            return $candidate;
        }
    }

    return 'git';
}

function oceanos_git_available(): bool
{
    if (!oceanos_can_run_process()) {
        return false;
    }
    foreach (oceanos_git_candidates() as $candidate) {
        if ($candidate !== 'git' && is_file($candidate) && is_executable($candidate)) {
            return true;
        }
    }

    try {
        $result = oceanos_run_process(['git', '--version']);
        return (int) ($result['status'] ?? 1) === 0;
    } catch (Throwable) {
        return false;
    }
}

function oceanos_run_process(array $parts): array
{
    if (!oceanos_can_run_process()) {
        throw new RuntimeException('La fonction PHP proc_open est requise pour lire les services.');
    }

    $command = implode(' ', array_map('escapeshellarg', $parts));

    if (!function_exists('proc_open')) {
        $output = shell_exec($command . ' 2>&1');

        return [
            'status' => 0,
            'stdout' => trim((string) $output),
            'stderr' => '',
        ];
    }

    $pipes = [];
    $process = proc_open(
        $command,
        [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ],
        $pipes
    );

    if (!is_resource($process)) {
        throw new RuntimeException('Impossible de lancer la commande systeme.');
    }

    $stdout = stream_get_contents($pipes[1]) ?: '';
    fclose($pipes[1]);
    $stderr = stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[2]);

    return [
        'status' => proc_close($process),
        'stdout' => trim($stdout),
        'stderr' => trim($stderr),
    ];
}

function oceanos_unknown_services(string $message): array
{
    return array_map(
        static fn(array $service): array => [
            ...$service,
            'active' => 'unknown',
            'enabled' => 'unknown',
            'subState' => 'unknown',
            'loadState' => 'unknown',
            'stateLabel' => 'Indisponible',
            'isRunning' => false,
            'canControl' => false,
            'message' => $message,
        ],
        array_values(oceanos_services_catalog())
    );
}

function oceanos_systemctl_value(string $unit, array $args, string $default = 'unknown'): string
{
    try {
        $result = oceanos_run_process(array_merge([oceanos_systemctl_path()], $args, [$unit]));
        $value = trim((string) ($result['stdout'] ?? ''));
        if ($value !== '') {
            return strtok($value, "\r\n") ?: $default;
        }
    } catch (Throwable) {
    }

    return $default;
}

function oceanos_normalize_service_row(array $service, bool $canControl = true): array
{
    $catalog = oceanos_services_catalog();
    $id = strtolower(trim((string) ($service['id'] ?? '')));
    $base = $catalog[$id] ?? [
        'id' => $id,
        'label' => $id !== '' ? $id : 'Service',
        'description' => '',
        'unit' => '',
    ];

    $active = trim((string) ($service['active'] ?? 'unknown'));
    $stateLabels = [
        'active' => 'Lance',
        'inactive' => 'Arrete',
        'failed' => 'Erreur',
        'activating' => 'Demarrage',
        'deactivating' => 'Arret',
        'unknown' => 'Inconnu',
    ];

    return [
        ...$base,
        'label' => (string) ($service['label'] ?? $base['label']),
        'description' => (string) ($service['description'] ?? $base['description']),
        'unit' => (string) ($service['unit'] ?? $base['unit']),
        'active' => $active,
        'enabled' => (string) ($service['enabled'] ?? 'unknown'),
        'subState' => (string) ($service['subState'] ?? 'unknown'),
        'loadState' => (string) ($service['loadState'] ?? 'unknown'),
        'stateLabel' => $stateLabels[$active] ?? ucfirst($active !== '' ? $active : 'unknown'),
        'isRunning' => $active === 'active',
        'canControl' => $canControl,
        'message' => (string) ($service['message'] ?? ''),
    ];
}

function oceanos_read_service_status_direct(string $message): array
{
    return array_map(
        static function (array $service) use ($message): array {
            $unit = (string) ($service['unit'] ?? '');

            return oceanos_normalize_service_row(
                [
                    ...$service,
                    'active' => oceanos_systemctl_value($unit, ['is-active']),
                    'enabled' => oceanos_systemctl_value($unit, ['is-enabled']),
                    'subState' => oceanos_systemctl_value($unit, ['show', '--property=SubState', '--value']),
                    'loadState' => oceanos_systemctl_value($unit, ['show', '--property=LoadState', '--value']),
                    'message' => $message,
                ],
                false
            );
        },
        array_values(oceanos_services_catalog())
    );
}

function oceanos_run_service_control(string $action, string $service = 'all'): array
{
    if (!oceanos_service_control_available()) {
        throw new RuntimeException('Controle systeme non installe. Lancez sudo scripts/ubuntu/oceanos-ubuntu.sh control sur le serveur Ubuntu.');
    }

    $result = oceanos_run_process(['sudo', '-n', oceanos_service_control_path(), $action, $service]);
    $stdout = (string) ($result['stdout'] ?? '');
    $stderr = (string) ($result['stderr'] ?? '');
    $status = (int) ($result['status'] ?? 1);

    $decoded = json_decode($stdout, true);
    if (!is_array($decoded)) {
        $details = trim($stderr) !== '' ? trim($stderr) : trim($stdout);
        throw new RuntimeException($details !== '' ? $details : 'Reponse invalide du controleur de services.');
    }
    if ($status !== 0 || ($decoded['ok'] ?? false) !== true) {
        throw new RuntimeException((string) ($decoded['message'] ?? trim($stderr) ?: 'Action systeme refusee.'));
    }

    return $decoded;
}

function oceanos_run_git_command(array $args): array
{
    if (!oceanos_git_available()) {
        throw new RuntimeException('Git est introuvable pour PHP. Installez Git ou ajoutez git.exe au PATH de WAMP/Apache.');
    }

    return oceanos_run_process(array_merge([oceanos_git_path(), '-C', oceanos_app_root()], $args));
}

function oceanos_git_output(array $args, bool $allowFailure = false): array
{
    $result = oceanos_run_git_command($args);
    $status = (int) ($result['status'] ?? 1);
    if ($status !== 0 && !$allowFailure) {
        $details = trim((string) ($result['stderr'] ?? '')) ?: trim((string) ($result['stdout'] ?? ''));
        throw new RuntimeException($details !== '' ? $details : 'Commande Git refusee.');
    }

    return $result;
}

function oceanos_git_short_head(): string
{
    try {
        $result = oceanos_git_output(['rev-parse', '--short', 'HEAD'], true);
        return trim(strtok((string) ($result['stdout'] ?? ''), "\r\n") ?: '');
    } catch (Throwable) {
        return '';
    }
}

function oceanos_run_git_update_direct(): array
{
    $root = oceanos_app_root();
    if (!is_dir($root . DIRECTORY_SEPARATOR . '.git')) {
        throw new RuntimeException('Depot Git introuvable dans ' . $root . '.');
    }

    $before = oceanos_git_short_head();
    $result = oceanos_git_output(['pull', '--ff-only'], true);
    $status = (int) ($result['status'] ?? 1);
    $output = trim(trim((string) ($result['stdout'] ?? '')) . "\n" . trim((string) ($result['stderr'] ?? '')));
    if ($status !== 0) {
        throw new RuntimeException($output !== '' ? $output : 'Mise a jour Git refusee.');
    }

    $after = oceanos_git_short_head();

    return [
        'ok' => true,
        'message' => $before !== '' && $after !== '' && $before === $after
            ? 'Depot Git deja a jour.'
            : 'Mise a jour Git terminee.',
        'before' => $before,
        'after' => $after,
        'output' => $output,
        'servicesRestarted' => false,
    ];
}

function oceanos_service_status_payload(): array
{
    $controlAvailable = oceanos_service_control_available();
    $gitAvailable = oceanos_git_available();
    $updateAvailable = $controlAvailable || $gitAvailable;
    if (!$controlAvailable) {
        if (PHP_OS_FAMILY === 'Linux' && oceanos_can_run_process()) {
            $message = 'Etats lus via systemctl. Lancez sudo scripts/ubuntu/oceanos-ubuntu.sh control pour activer les boutons.';

            return [
                'ok' => true,
                'managedBy' => 'OceanOS',
                'version' => OCEANOS_SERVICES_API_VERSION,
                'controlAvailable' => false,
                'gitAvailable' => $gitAvailable,
                'updateAvailable' => $updateAvailable,
                'controller' => oceanos_service_control_path(),
                'services' => oceanos_read_service_status_direct($message),
                'message' => $message,
            ];
        }

        $message = PHP_OS_FAMILY === 'Linux'
            ? 'Controleur systeme non installe, non executable ou proc_open indisponible.'
            : 'Controle systeme disponible uniquement sur Ubuntu/Linux.';

        return [
            'ok' => true,
            'managedBy' => 'OceanOS',
            'version' => OCEANOS_SERVICES_API_VERSION,
            'controlAvailable' => false,
            'gitAvailable' => $gitAvailable,
            'updateAvailable' => $updateAvailable,
            'controller' => oceanos_service_control_path(),
            'services' => oceanos_unknown_services($message),
            'message' => $message,
        ];
    }

    $payload = oceanos_run_service_control('status', 'all');
    $services = array_map(
        static fn(array $service): array => oceanos_normalize_service_row($service, true),
        is_array($payload['services'] ?? null) ? $payload['services'] : []
    );

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'version' => OCEANOS_SERVICES_API_VERSION,
        'controlAvailable' => true,
        'gitAvailable' => $gitAvailable,
        'updateAvailable' => $updateAvailable,
        'controller' => oceanos_service_control_path(),
        'services' => $services,
        'message' => 'Etat des services charge.',
    ];
}

function oceanos_restart_mobywork_after_update(array $actionResult): array
{
    if (!oceanos_service_control_available()) {
        return $actionResult;
    }

    $restartResult = oceanos_run_service_control('restart', 'mobywork');
    $message = trim((string) ($actionResult['message'] ?? 'Mise a jour terminee.'));
    if ($message === '') {
        $message = 'Mise a jour terminee.';
    }

    return [
        ...$actionResult,
        'message' => rtrim($message, '.') . '. Backend Mobywork relance.',
        'mobyworkRestart' => $restartResult,
    ];
}

function oceanos_require_services_admin(): array
{
    try {
        $pdo = oceanos_pdo();
        return [$pdo, oceanos_require_admin($pdo)];
    } catch (Throwable $exception) {
        oceanos_start_session();
        $role = oceanos_normalize_role((string) ($_SESSION['oceanos_user_role'] ?? 'member'));
        $userId = (int) ($_SESSION['oceanos_user_id'] ?? 0);
        if ($userId > 0 && in_array($role, ['super', 'admin'], true)) {
            return [
                null,
                [
                    'id' => $userId,
                    'email' => (string) ($_SESSION['oceanos_user_email'] ?? ''),
                    'display_name' => (string) ($_SESSION['oceanos_user_name'] ?? 'Administrateur'),
                    'role' => $role,
                    'is_active' => 1,
                    'visible_modules_json' => null,
                    'created_at' => '',
                ],
            ];
        }

        throw $exception;
    }
}

try {
    [$pdo, $admin] = oceanos_require_services_admin();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response([
            ...oceanos_service_status_payload(),
            'currentUser' => oceanos_public_user($admin),
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'status')));
        $service = strtolower(trim((string) ($input['service'] ?? 'all')));

        if (!in_array($action, ['status', 'start', 'stop', 'restart', 'update'], true)) {
            throw new InvalidArgumentException('Action service non supportee.');
        }
        if (!in_array($service, ['all', 'web', 'database', 'mobywork'], true)) {
            throw new InvalidArgumentException('Service non supporte.');
        }
        if (!in_array($action, ['status', 'update'], true) && $service === 'all') {
            throw new InvalidArgumentException('Choisissez un service precis pour cette action.');
        }

        if ($action === 'status') {
            $actionResult = ['ok' => true];
        } elseif ($action === 'update' && !oceanos_service_control_available()) {
            $actionResult = oceanos_run_git_update_direct();
        } else {
            $actionResult = oceanos_run_service_control($action, $service);
        }

        if ($action === 'update' && in_array($service, ['all', 'mobywork'], true)) {
            $actionResult = oceanos_restart_mobywork_after_update($actionResult);
        }

        oceanos_json_response([
            ...oceanos_service_status_payload(),
            'currentUser' => oceanos_public_user($admin),
            'action' => $action,
            'service' => $service,
            'actionResult' => $actionResult,
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
