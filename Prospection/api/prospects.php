<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = prospection_pdo();
    $user = prospection_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'prospect') {
            $prospectId = (int) ($_GET['id'] ?? 0);
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'user' => oceanos_public_user($user),
                'bundle' => prospection_prospect_bundle($pdo, $user, $prospectId),
            ]);
        }

        prospection_json_response(prospection_dashboard($pdo, $_GET, $user));
    }

    if ($method === 'POST') {
        $input = prospection_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'save_prospect')));
        $bundle = [];
        $message = 'Donnees enregistrees.';

        if ($action === 'ai_clean_import') {
            prospection_json_response(prospection_ai_clean_import($pdo, $user, $input));
        }

        if ($action === 'import_ai_prospects') {
            prospection_json_response(prospection_import_ai_prospects($pdo, $user, $input));
        }

        if ($action === 'render_template') {
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'rendered' => prospection_render_template($pdo, $user, $input),
            ]);
        }

        if ($action === 'send_template') {
            $result = prospection_send_template($pdo, $user, $input);
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Mail envoye et synchronise avec NautiMail.',
                'sentId' => $result['sentId'],
                'bundle' => $result['bundle'],
                'dashboard' => prospection_dashboard($pdo, $_GET, $user),
            ]);
        }

        if ($action === 'mark_positive') {
            $bundle = prospection_mark_positive($pdo, $user, $input);
            $message = 'Reponse positive enregistree.';
        } elseif ($action === 'transfer_to_crm') {
            $result = prospection_transfer_to_crm($pdo, $user, $input);
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Contact transfere dans NautiCRM.',
                'crmClientId' => $result['crmClientId'],
                'bundle' => $result['bundle'],
                'dashboard' => prospection_dashboard($pdo, $_GET, $user),
            ]);
        } elseif ($action === 'save_prospect') {
            $bundle = prospection_save_prospect($pdo, $user, $input);
            $message = 'Prospect enregistre.';
        } elseif ($action === 'save_task') {
            $bundle = prospection_save_task($pdo, $user, $input);
            $message = 'Tache enregistree.';
        } elseif ($action === 'log_interaction') {
            $bundle = prospection_log_interaction($pdo, $user, $input);
            $message = 'Interaction ajoutee.';
        } elseif ($action === 'save_template') {
            $template = prospection_save_template($pdo, $user, $input);
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Template mail enregistre.',
                'template' => $template,
                'dashboard' => prospection_dashboard($pdo, $_GET, $user),
            ]);
        } elseif ($action === 'delete_template') {
            prospection_delete_template($pdo, $user, $input);
            prospection_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Template mail archive.',
                'dashboard' => prospection_dashboard($pdo, $_GET, $user),
            ]);
        } elseif ($action === 'archive_prospect') {
            $dashboard = prospection_archive_prospect($pdo, $user, $input);
            $dashboard['message'] = 'Prospect archive.';
            prospection_json_response($dashboard);
        } else {
            prospection_json_response([
                'ok' => false,
                'error' => 'unsupported_action',
                'message' => 'Action non supportee.',
            ], 422);
        }

        prospection_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => $message,
            'user' => oceanos_public_user($user),
            'bundle' => $bundle,
            'dashboard' => prospection_dashboard($pdo, $_GET, $user),
        ]);
    }

    prospection_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    prospection_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    prospection_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
