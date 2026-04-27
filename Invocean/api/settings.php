<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = invocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = invocean_require_auth($pdo);

    if ($method === 'GET') {
        $settings = invocean_get_settings($pdo);
        invocean_json_response([
            'ok' => true,
            'settings' => invocean_public_settings($settings, invocean_is_admin($user)),
        ]);
    }

    if ($method === 'POST') {
        invocean_require_admin($pdo);
        $input = invocean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'save')));

        if ($action === 'test') {
            invocean_json_response(invocean_test_prestashop($pdo, $input));
        }

        $settings = invocean_save_settings($pdo, $input);
        invocean_json_response([
            'ok' => true,
            'message' => 'Configuration enregistree.',
            'settings' => invocean_public_settings($settings, true),
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
