<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function backup_cli_response(array $payload, int $status = 0): int
{
    fwrite($status === 0 ? STDOUT : STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    return $status;
}

function backup_run_cli(array $argv): int
{
    $action = strtolower(trim((string) ($argv[1] ?? 'run-scheduled')));

    try {
        if (in_array($action, ['run-scheduled', 'run_scheduled', 'scheduled'], true)) {
            return backup_cli_response(backup_run_scheduled_backup());
        }

        if (in_array($action, ['create', 'manual'], true)) {
            $backup = backup_create_backup(null, 'manual-cli');
            return backup_cli_response([
                ...backup_status_payload(),
                'backup' => $backup,
            ]);
        }

        return backup_cli_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action CLI non supportee.',
        ], 2);
    } catch (Throwable $exception) {
        return backup_cli_response([
            'ok' => false,
            'error' => 'backup_failed',
            'message' => $exception->getMessage(),
        ], 1);
    }
}

if (PHP_SAPI === 'cli') {
    exit(backup_run_cli($argv ?? []));
}

try {
    $user = backup_require_super_user();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'status')));

        if ($action === 'download') {
            $zipPath = backup_find_zip_path((string) ($_GET['file'] ?? ''));
            $zipName = basename($zipPath);

            oceanos_send_security_headers();
            header('Content-Type: application/zip');
            header('Content-Length: ' . (string) (filesize($zipPath) ?: 0));
            header('Content-Disposition: attachment; filename="' . addslashes($zipName) . '"');
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            readfile($zipPath);
            exit;
        }

        oceanos_json_response(backup_status_payload($user));
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'create')));

        if ($action === 'create') {
            $backup = backup_create_backup($user, 'manual');
            oceanos_json_response([
                ...backup_status_payload($user),
                'backup' => $backup,
                'message' => 'Backup cree.',
            ]);
        }

        if ($action === 'save_schedule') {
            backup_schedule_from_input(is_array($input['schedule'] ?? null) ? $input['schedule'] : $input);
            oceanos_json_response([
                ...backup_status_payload($user),
                'message' => 'Planification enregistree.',
            ]);
        }

        if ($action === 'delete') {
            backup_delete_backup((string) ($input['fileName'] ?? $input['file_name'] ?? ''));
            oceanos_json_response([
                ...backup_status_payload($user),
                'message' => 'Backup supprime.',
            ]);
        }

        if (in_array($action, ['run_scheduled', 'run-scheduled'], true)) {
            oceanos_json_response([
                ...backup_run_scheduled_backup(),
                'currentUser' => oceanos_public_user($user),
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
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
