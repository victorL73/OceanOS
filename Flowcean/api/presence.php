<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'POST');

    if ($method !== 'POST') {
        flowcean_json_response([
            'ok' => false,
            'error' => 'method_not_allowed',
            'message' => 'Methode non supportee.',
        ], 405);
    }

    $input = flowcean_read_json_request();
    $action = strtolower(trim((string) ($input['action'] ?? 'heartbeat')));
    $slug = flowcean_workspace_slug((string) ($input['workspaceSlug'] ?? ''));
    $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'viewer');
    $clientId = flowcean_presence_client_id((string) ($input['clientId'] ?? ''));

    if ($action === 'leave') {
        flowcean_remove_workspace_presence($pdo, (int) $workspace['id'], $clientId, (int) $user['id']);
        flowcean_json_response([
            'ok' => true,
            'workspaceSlug' => $slug,
            'presence' => flowcean_list_workspace_presence($pdo, (int) $workspace['id']),
        ]);
    }

    flowcean_record_workspace_presence(
        $pdo,
        (int) $workspace['id'],
        $clientId,
        $user,
        isset($input['activePageId']) ? (string) $input['activePageId'] : null,
        isset($input['activePageTitle']) ? (string) $input['activePageTitle'] : null
    );

    flowcean_json_response([
        'ok' => true,
        'workspaceSlug' => $slug,
        'presence' => flowcean_list_workspace_presence($pdo, (int) $workspace['id']),
    ]);
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
