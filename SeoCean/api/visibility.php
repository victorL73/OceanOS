<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = visiocean_pdo();
    $user = visiocean_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $days = (int) ($_GET['days'] ?? 30);

    if ($method === 'GET') {
        oceanos_json_response(visiocean_dashboard($pdo, $user, $days));
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'dashboard')));

        if ($action === 'refresh_google') {
            oceanos_json_response([
                ...visiocean_dashboard($pdo, $user, (int) ($input['days'] ?? $days)),
                'message' => 'Donnees Google actualisees.',
            ]);
        }

        if (!visiocean_is_admin($user)) {
            oceanos_json_response([
                'ok' => false,
                'error' => 'forbidden',
                'message' => 'Configuration SeoCean reservee aux administrateurs.',
            ], 403);
        }

        if ($action === 'save_settings') {
            $settings = visiocean_save_settings($pdo, $input);
            oceanos_json_response([
                ...visiocean_dashboard($pdo, $user, (int) ($input['days'] ?? $days)),
                'settings' => $settings,
                'message' => 'Configuration SeoCean enregistree.',
            ]);
        }

        if ($action === 'audit_site') {
            $settings = visiocean_private_settings($pdo);
            $audit = visiocean_run_audit($pdo, $settings, (int) ($input['limit'] ?? 12));
            oceanos_json_response([
                ...visiocean_dashboard($pdo, $user, (int) ($input['days'] ?? $days)),
                'audit' => $audit,
                'message' => 'Audit SEO SeoCean termine.',
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action SeoCean non supportee.',
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
