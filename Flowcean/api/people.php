<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    flowcean_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $users = array_values(array_filter(
            flowcean_list_users($pdo),
            static fn(array $user): bool => (bool) ($user['isActive'] ?? true)
        ));

        flowcean_json_response([
            'ok' => true,
            'users' => $users,
        ]);
    }

    flowcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (Throwable $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
