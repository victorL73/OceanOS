<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = naviplan_pdo();
    $user = naviplan_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $canManage = naviplan_is_admin($user);

    if ($method === 'GET') {
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'currentUser' => oceanos_public_user($user),
            'canManage' => $canManage,
            'settings' => naviplan_settings($pdo),
            'users' => $canManage ? naviplan_public_users($pdo) : [],
        ]);
    }

    if ($method === 'POST') {
        if (!$canManage) {
            oceanos_json_response([
                'ok' => false,
                'error' => 'forbidden',
                'message' => 'Configuration reservee aux administrateurs.',
            ], 403);
        }

        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'settings')));

        if ($action === 'settings') {
            $settings = naviplan_save_settings($pdo, is_array($input['settings'] ?? null) ? $input['settings'] : []);
            oceanos_json_response([
                'ok' => true,
                'message' => 'Configuration Naviplan enregistree.',
                'settings' => $settings,
                'users' => naviplan_public_users($pdo),
                'canManage' => true,
            ]);
        }

        if ($action === 'notify') {
            $result = naviplan_notify($pdo, $user, $input);
            oceanos_json_response([
                'ok' => true,
                'message' => sprintf(
                    '%d notification(s) Naviplan preparee(s) pour %d destinataire(s).',
                    $result['notificationCount'],
                    $result['recipientCount']
                ),
                'result' => $result,
                'settings' => naviplan_settings($pdo),
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Naviplan non supportee.',
        ], 422);
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
