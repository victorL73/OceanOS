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
        $payload = flowcean_get_workspace_payload_for_user($pdo, $slug, $user);
        flowcean_json_response(['ok' => true] + $payload);
    }

    if ($method === 'POST' || $method === 'PUT') {
        $input = flowcean_read_json_request();
        $state = $input['state'] ?? null;
        if (!is_array($state)) {
            flowcean_json_response([
                'ok' => false,
                'error' => 'invalid_state',
                'message' => 'Le corps de la requete doit contenir un objet state.',
            ], 422);
        }

        $expectedVersion = isset($input['expectedVersion']) ? (int) $input['expectedVersion'] : null;
        $name = isset($input['name']) ? (string) $input['name'] : null;
        $clientId = isset($input['clientId']) ? (string) $input['clientId'] : null;
        $payload = flowcean_save_workspace($pdo, $slug, $state, $name, $expectedVersion, $user, $clientId);
        flowcean_json_response(['ok' => true] + $payload);
    }

    flowcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (FlowceanConflictException $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'version_conflict',
        'message' => 'Une version plus recente du workspace existe deja sur le serveur.',
        'workspace' => $exception->workspace,
        'meta' => $exception->meta,
    ], 409);
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
