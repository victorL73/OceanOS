<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = oceanos_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $user = oceanos_require_auth($pdo);
        $canManage = in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'settings' => oceanos_prestashop_public_settings($pdo, $canManage),
        ]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        oceanos_require_admin($pdo);
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'settings')));

        if ($action === 'test') {
            oceanos_json_response(oceanos_test_prestashop($pdo, $input));
        }

        if ($action === 'settings') {
            $settings = oceanos_save_prestashop_settings($pdo, $input);
            oceanos_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'settings' => $settings,
                'message' => 'Configuration PrestaShop enregistree dans OceanOS.',
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action PrestaShop non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        oceanos_require_admin($pdo);
        oceanos_delete_prestashop_settings($pdo);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'settings' => oceanos_prestashop_public_settings($pdo, true),
            'message' => 'Configuration PrestaShop supprimee dans OceanOS.',
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
