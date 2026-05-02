<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function oceanos_dispatch_module_notifications(PDO $pdo, int $userId): void
{
    $meetOceanBootstrap = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'MeetOcean' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';
    if (!is_file($meetOceanBootstrap)) {
        return;
    }

    try {
        require_once $meetOceanBootstrap;
        if (function_exists('meetocean_ensure_schema') && function_exists('meetocean_dispatch_due_notifications')) {
            meetocean_ensure_schema($pdo);
            meetocean_dispatch_due_notifications($pdo, $userId);
        }
    } catch (Throwable $exception) {
        // Les notifications OceanOS restent disponibles meme si un module optionnel echoue.
    }
}

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $userId = (int) $user['id'];

    if ($method === 'GET') {
        oceanos_dispatch_module_notifications($pdo, $userId);
        oceanos_json_response([
            'ok' => true,
            'notifications' => oceanos_list_notifications($pdo, $userId),
            'unreadCount' => oceanos_unread_notification_count($pdo, $userId),
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'mark_read')));

        if ($action === 'mark_read') {
            oceanos_mark_notification_read($pdo, $userId, (int) ($input['notificationId'] ?? 0));
        } elseif ($action === 'mark_all_read') {
            oceanos_mark_all_notifications_read($pdo, $userId);
        } else {
            oceanos_json_response([
                'ok' => false,
                'error' => 'unsupported_action',
                'message' => 'Action non supportee.',
            ], 422);
        }

        oceanos_dispatch_module_notifications($pdo, $userId);
        oceanos_json_response([
            'ok' => true,
            'notifications' => oceanos_list_notifications($pdo, $userId),
            'unreadCount' => oceanos_unread_notification_count($pdo, $userId),
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
