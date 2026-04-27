<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = invocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'POST');
    $user = invocean_require_admin($pdo);

    if ($method === 'POST') {
        $input = invocean_read_json_request();
        $run = invocean_sync_prestashop($pdo, $user, $input);
        invocean_json_response([
            'ok' => true,
            'message' => $run['message'],
            'run' => $run,
            'runs' => invocean_list_sync_runs($pdo),
        ]);
    }

    invocean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    invocean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    invocean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
