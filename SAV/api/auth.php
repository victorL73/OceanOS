<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = sav_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = oceanos_current_user($pdo);
        sav_json_response([
            'ok' => true,
            'authenticated' => $user !== null,
            'needsSetup' => oceanos_needs_bootstrap($pdo),
            'oceanosUrl' => '/OceanOS/',
            'user' => $user ? oceanos_public_user($user) : null,
        ]);
    }

    if ($method === 'DELETE') {
        oceanos_logout_user();
        sav_json_response([
            'ok' => true,
            'authenticated' => false,
            'needsSetup' => false,
            'user' => null,
        ]);
    }

    sav_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (Throwable $exception) {
    sav_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
