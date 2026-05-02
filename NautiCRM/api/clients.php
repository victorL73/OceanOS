<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nauticrm_pdo();
    $user = nauticrm_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'client') {
            $clientId = (int) ($_GET['id'] ?? 0);
            nauticrm_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'user' => oceanos_public_user($user),
                'bundle' => nauticrm_client_bundle($pdo, $clientId),
            ]);
        }

        nauticrm_json_response(nauticrm_dashboard($pdo, $_GET, $user));
    }

    if ($method === 'POST') {
        $input = nauticrm_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'save_client')));
        $bundle = [];
        $message = 'Donnees enregistrees.';

        if ($action === 'save_client') {
            $bundle = nauticrm_save_client($pdo, $user, $input);
            $message = 'Client enregistre.';
        } elseif ($action === 'save_contact') {
            $bundle = nauticrm_save_contact($pdo, $input);
            $message = 'Contact enregistre.';
        } elseif ($action === 'log_interaction') {
            $bundle = nauticrm_log_interaction($pdo, $user, $input);
            $message = 'Interaction ajoutee.';
        } elseif ($action === 'save_task') {
            $bundle = nauticrm_save_task($pdo, $user, $input);
            $message = 'Tache enregistree.';
        } elseif ($action === 'save_opportunity') {
            $bundle = nauticrm_save_opportunity($pdo, $user, $input);
            $message = 'Opportunite enregistree.';
        } elseif ($action === 'sync_prestashop') {
            $summary = nauticrm_sync_prestashop_customers($pdo, $user, (int) ($input['limit'] ?? 500));
            $dashboard = nauticrm_dashboard($pdo, $_GET, $user);
            $dashboard['message'] = (string) ($summary['message'] ?? 'Synchronisation PrestaShop terminee.');
            $dashboard['syncSummary'] = $summary;
            nauticrm_json_response($dashboard);
        } elseif ($action === 'archive_client') {
            $dashboard = nauticrm_archive_client($pdo, $user, $input);
            $dashboard['message'] = 'Client archive.';
            nauticrm_json_response($dashboard);
        } else {
            nauticrm_json_response([
                'ok' => false,
                'error' => 'unsupported_action',
                'message' => 'Action non supportee.',
            ], 422);
        }

        nauticrm_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => $message,
            'user' => oceanos_public_user($user),
            'bundle' => $bundle,
            'dashboard' => nauticrm_dashboard($pdo, $_GET, $user),
        ]);
    }

    nauticrm_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    nauticrm_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    nauticrm_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
