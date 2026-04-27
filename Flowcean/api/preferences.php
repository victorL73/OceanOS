<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $slug = flowcean_workspace_slug($_GET['slug'] ?? null);
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);

    flowcean_sync_user_invitations($pdo, $user);
    flowcean_ensure_user_personal_workspace($pdo, $user);

    if ($method === 'OPTIONS') {
        flowcean_json_response(['ok' => true]);
    }

    if ($method === 'GET') {
        $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'viewer');
        $payload = flowcean_get_workspace_user_preferences($pdo, (int) $workspace['id'], (int) $user['id']);
        flowcean_json_response([
            'ok' => true,
            'userPreferences' => $payload['preferences'],
            'meta' => [
                'exists' => $payload['exists'],
                'updatedAt' => $payload['updatedAt'],
            ],
        ]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        $input = flowcean_read_json_request();
        $preferences = $input['preferences'] ?? $input;
        if (!is_array($preferences)) {
            flowcean_json_response([
                'ok' => false,
                'error' => 'invalid_preferences',
                'message' => 'Le corps de la requete doit contenir des preferences utilisateur.',
            ], 422);
        }

        $payload = flowcean_save_workspace_user_preferences($pdo, $slug, $user, $preferences);
        flowcean_json_response([
            'ok' => true,
            'userPreferences' => $payload['preferences'],
            'meta' => [
                'exists' => $payload['exists'],
                'updatedAt' => $payload['updatedAt'],
            ],
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
