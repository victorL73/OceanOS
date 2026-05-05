<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $userId = (int) $user['id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response([
            'ok' => true,
            'push' => oceanos_push_public_status($pdo, $userId),
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $subscription = is_array($input['subscription'] ?? null) ? $input['subscription'] : $input;
        oceanos_json_response([
            'ok' => true,
            'push' => oceanos_store_push_subscription($pdo, $userId, $subscription),
        ]);
    }

    if ($method === 'DELETE') {
        $input = oceanos_read_json_request();
        oceanos_json_response([
            'ok' => true,
            'push' => oceanos_delete_push_subscription($pdo, $userId, (string) ($input['endpoint'] ?? '')),
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
        'error' => 'invalid_push_subscription',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
