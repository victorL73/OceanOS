<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = sav_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = oceanos_require_auth($pdo);

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'detail') {
            sav_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'thread' => sav_fetch_thread_detail($pdo, (int) ($_GET['id'] ?? 0)),
            ]);
        }

        sav_json_response(sav_dashboard($pdo, $user, $_GET));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $input = sav_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'reply') {
            $thread = sav_reply_to_thread(
                $pdo,
                $user,
                (int) ($input['threadId'] ?? 0),
                (string) ($input['message'] ?? ''),
                !empty($input['private']),
                (string) ($input['nextStatus'] ?? 'open')
            );
            sav_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Reponse SAV ajoutee dans PrestaShop.',
                'thread' => $thread,
                'dashboard' => sav_dashboard($pdo, $user, []),
            ]);
        }

        if ($action === 'change_status') {
            $thread = sav_change_thread_status(
                $pdo,
                (int) ($input['threadId'] ?? 0),
                (string) ($input['status'] ?? '')
            );
            sav_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Statut SAV mis a jour dans PrestaShop.',
                'thread' => $thread,
                'dashboard' => sav_dashboard($pdo, $user, []),
            ]);
        }

        sav_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action SAV non supportee.',
        ], 422);
    }

    sav_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    sav_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    sav_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
