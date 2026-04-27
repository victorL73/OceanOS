<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        flowcean_json_response([
            'ok' => true,
            'notifications' => flowcean_list_user_notifications($pdo, (int) $user['id']),
            'unreadCount' => flowcean_unread_user_notification_count($pdo, (int) $user['id']),
        ]);
    }

    if ($method === 'POST') {
        $input = flowcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'mark_read')));

        if ($action === 'mark_read') {
            flowcean_mark_user_notification_read($pdo, (int) $user['id'], (int) ($input['notificationId'] ?? 0));
        } elseif ($action === 'mark_all_read') {
            flowcean_mark_all_user_notifications_read($pdo, (int) $user['id']);
        } else {
            flowcean_json_response([
                'ok' => false,
                'error' => 'unsupported_action',
                'message' => 'Action non supportee.',
            ], 422);
        }

        flowcean_json_response([
            'ok' => true,
            'notifications' => flowcean_list_user_notifications($pdo, (int) $user['id']),
            'unreadCount' => flowcean_unread_user_notification_count($pdo, (int) $user['id']),
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
