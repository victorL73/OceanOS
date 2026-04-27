<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = invocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = invocean_current_user($pdo);
        invocean_json_response([
            'ok' => true,
            'authenticated' => $user !== null,
            'needsSetup' => invocean_needs_bootstrap($pdo),
            'flowceanUrl' => (string) invocean_config()['flowcean_url'],
            'user' => $user ? invocean_public_user($user) : null,
        ]);
    }

    if ($method === 'POST') {
        $input = invocean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'login')));

        if ($action === 'bootstrap') {
            $user = invocean_bootstrap_admin(
                $pdo,
                (string) ($input['displayName'] ?? ''),
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            invocean_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => invocean_public_user($user),
            ]);
        }

        if ($action === 'login') {
            $user = invocean_login_user(
                $pdo,
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            if ($user === null) {
                invocean_json_response([
                    'ok' => false,
                    'error' => 'invalid_credentials',
                    'message' => 'Email ou mot de passe invalide.',
                ], 401);
            }

            invocean_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => invocean_public_user($user),
            ]);
        }

        invocean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        invocean_logout_user();
        invocean_json_response([
            'ok' => true,
            'authenticated' => false,
            'needsSetup' => false,
            'user' => null,
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
