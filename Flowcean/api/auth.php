<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = flowcean_current_user($pdo);
        if ($user !== null) {
            flowcean_sync_user_invitations($pdo, $user);
            flowcean_ensure_user_personal_workspace($pdo, $user);
            $user = flowcean_find_user_by_id($pdo, (int) $user['id']) ?? $user;
        }
        flowcean_json_response([
            'ok' => true,
            'authenticated' => $user !== null,
            'needsSetup' => flowcean_needs_bootstrap($pdo),
            'user' => $user ? flowcean_public_user($user) : null,
        ]);
    }

    if ($method === 'POST') {
        $input = flowcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'login')));

        if ($action === 'bootstrap') {
            $user = flowcean_bootstrap_admin(
                $pdo,
                (string) ($input['displayName'] ?? ''),
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            flowcean_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => flowcean_public_user($user),
            ]);
        }

        if ($action === 'login') {
            $user = flowcean_login_user(
                $pdo,
                (string) ($input['email'] ?? ''),
                (string) ($input['password'] ?? '')
            );

            if ($user === null) {
                flowcean_json_response([
                    'ok' => false,
                    'error' => 'invalid_credentials',
                    'message' => 'Email ou mot de passe invalide.',
                ], 401);
            }

            flowcean_json_response([
                'ok' => true,
                'authenticated' => true,
                'needsSetup' => false,
                'user' => flowcean_public_user($user),
            ]);
        }

        flowcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        flowcean_logout_user();
        flowcean_json_response([
            'ok' => true,
            'authenticated' => false,
            'needsSetup' => false,
            'user' => null,
        ]);
    }

    flowcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
