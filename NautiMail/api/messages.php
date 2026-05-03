<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nautimail_pdo();
    $user = nautimail_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));
        if ($action === 'attachment') {
            nautimail_download_attachment($pdo, $user, (int) ($_GET['id'] ?? 0), (int) ($_GET['index'] ?? -1), !empty($_GET['inline']));
        }

        if ($action === 'inline') {
            nautimail_download_inline_content_id($pdo, $user, (int) ($_GET['id'] ?? 0), (string) ($_GET['cid'] ?? ''));
        }

        if ($action === 'remote_image') {
            nautimail_proxy_remote_image((string) ($_GET['url'] ?? ''));
        }

        if ($action === 'message') {
            $rawId = trim((string) ($_GET['id'] ?? ''));
            if (str_starts_with($rawId, 'sent:')) {
                $sentMessage = nautimail_require_sent_message_access($pdo, $user, (int) substr($rawId, 5));
                nautimail_json_response([
                    'ok' => true,
                    'managedBy' => 'OceanOS',
                    'user' => oceanos_public_user($user),
                    'message' => nautimail_public_sent_message($sentMessage),
                    'conversation' => nautimail_sent_message_conversation($sentMessage),
                ]);
            }

            $message = nautimail_require_message_access($pdo, $user, (int) $rawId);
            if (!empty($_GET['refreshParts']) || nautimail_message_missing_inline_sources($message)) {
                $message = nautimail_refresh_message_parts($pdo, $user, $message);
            }
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'user' => oceanos_public_user($user),
                'message' => nautimail_public_message($message),
                'conversation' => nautimail_message_conversation($pdo, $user, (int) $message['id']),
            ]);
        }

        nautimail_json_response(nautimail_dashboard($pdo, $_GET, $user));
    }

    if ($method === 'POST') {
        $input = nautimail_read_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'save_account')));

        if ($action === 'save_account') {
            $account = nautimail_save_account($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Adresse mail enregistree.',
                'account' => $account,
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $account['id']], $user),
            ]);
        }

        if ($action === 'deactivate_account') {
            $account = nautimail_deactivate_account($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Adresse mail desactivee.',
                'account' => $account,
                'dashboard' => nautimail_dashboard($pdo, [], $user),
            ]);
        }

        if ($action === 'set_primary_account') {
            $account = nautimail_set_primary_account($pdo, $user, (int) ($input['accountId'] ?? 0));
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Adresse principale mise a jour.',
                'account' => nautimail_public_account($pdo, $account, (int) $account['id']),
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => (int) $account['id']], $user),
            ]);
        }

        if ($action === 'sync_account') {
            $summary = nautimail_sync_account($pdo, $user, $input);
            $dashboard = nautimail_dashboard($pdo, ['accountId' => (int) ($input['accountId'] ?? 0)], $user);
            $dashboard['syncSummary'] = $summary;
            $dashboard['message'] = (string) ($summary['message'] ?? 'Synchronisation terminee.');
            nautimail_json_response($dashboard);
        }

        if ($action === 'analyze_message') {
            $message = nautimail_analyze_message($pdo, $user, (int) ($input['messageId'] ?? 0));
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Mail synthetise et trie.',
                'mail' => $message,
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $message['accountId']], $user),
            ]);
        }

        if ($action === 'analyze_pending') {
            $summary = nautimail_analyze_pending($pdo, $user, $input);
            $dashboard = nautimail_dashboard($pdo, ['accountId' => (int) ($input['accountId'] ?? 0)], $user);
            $dashboard['aiSummary'] = $summary;
            $dashboard['message'] = sprintf('%d mail(s) analyses.', (int) $summary['count']);
            nautimail_json_response($dashboard);
        }

        if ($action === 'update_message') {
            $message = nautimail_update_message($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Tri du mail mis a jour.',
                'mail' => $message,
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $message['accountId']], $user),
            ]);
        }

        if ($action === 'delete_message') {
            $result = nautimail_delete_message($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Mail supprime. Il ne reviendra pas au prochain releve.',
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $result['accountId']], $user),
            ]);
        }

        if ($action === 'generate_reply') {
            $draft = nautimail_generate_reply($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Brouillon IA prepare.',
                'draft' => $draft,
            ]);
        }

        if ($action === 'send_reply') {
            $result = nautimail_send_reply($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Reponse envoyee.',
                'replyId' => $result['replyId'],
                'mail' => $result['message'],
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $result['message']['accountId']], $user),
            ]);
        }

        if ($action === 'send_message') {
            $result = nautimail_send_message($pdo, $user, $input);
            nautimail_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Mail envoye.',
                'sentId' => $result['sentId'],
                'dashboard' => nautimail_dashboard($pdo, ['accountId' => $result['accountId']], $user),
            ]);
        }

        nautimail_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    nautimail_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    nautimail_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    nautimail_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
