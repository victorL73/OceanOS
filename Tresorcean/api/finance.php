<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = tresorcean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = tresorcean_require_access($pdo);

    if ($method === 'GET') {
        tresorcean_json_response(tresorcean_dashboard($pdo, $_GET, $user));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $input = tresorcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'save_entry') {
            $entry = tresorcean_save_entry($pdo, $user, $input);
            tresorcean_json_response([
                'ok' => true,
                'message' => 'Mouvement enregistre.',
                'entry' => $entry,
                'dashboard' => tresorcean_dashboard($pdo, $_GET, $user),
            ]);
        }

        if ($action === 'delete_entry') {
            tresorcean_delete_entry($pdo, $user, (int) ($input['id'] ?? 0));
            tresorcean_json_response([
                'ok' => true,
                'message' => 'Mouvement supprime.',
                'dashboard' => tresorcean_dashboard($pdo, $_GET, $user),
            ]);
        }

        if ($action === 'save_settings') {
            $admin = tresorcean_require_admin($pdo);
            $settings = tresorcean_save_settings($pdo, $input);
            tresorcean_json_response([
                'ok' => true,
                'message' => 'Reglages Tresorcean enregistres.',
                'settings' => $settings,
                'dashboard' => tresorcean_dashboard($pdo, $_GET, $admin),
            ]);
        }

        tresorcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Tresorcean non supportee.',
        ], 422);
    }

    tresorcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    tresorcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    tresorcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
