<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = tresorcean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = oceanos_current_user($pdo);
        $allowed = $user !== null && in_array(TRESORCEAN_MODULE_ID, oceanos_decode_visible_modules($user['visible_modules_json'] ?? null), true);
        tresorcean_json_response([
            'ok' => true,
            'authenticated' => $user !== null && $allowed,
            'needsSetup' => oceanos_needs_bootstrap($pdo),
            'oceanosUrl' => '/OceanOS/',
            'user' => $user && $allowed ? oceanos_public_user($user) : null,
        ]);
    }

    if ($method === 'DELETE') {
        oceanos_logout_user();
        tresorcean_json_response([
            'ok' => true,
            'authenticated' => false,
            'needsSetup' => false,
            'user' => null,
        ]);
    }

    tresorcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (Throwable $exception) {
    tresorcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
