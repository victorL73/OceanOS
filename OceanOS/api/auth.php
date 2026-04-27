<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = oceanos_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = oceanos_current_user($pdo);
        oceanos_json_response([
            'ok' => true,
            'authenticated' => $user !== null,
            'needsSetup' => oceanos_needs_bootstrap($pdo),
            'user' => $user ? oceanos_public_user($user) : null,
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'login')));

        if ($action === 'bootstrap') {
            $user = oceanos_bootstrap_admin(
                $pdo,
                (string) ($input['displayName'] ?? ''),
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            oceanos_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => oceanos_public_user($user),
            ]);
        }

        if ($action === 'login') {
            $user = oceanos_login_user(
                $pdo,
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            if ($user === null) {
                oceanos_json_response([
                    'ok' => false,
                    'error' => 'invalid_credentials',
                    'message' => 'Email ou mot de passe invalide.',
                ], 401);
            }

            oceanos_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => oceanos_public_user($user),
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        oceanos_logout_user();
        oceanos_json_response([
            'ok' => true,
            'authenticated' => false,
            'needsSetup' => false,
            'user' => null,
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
