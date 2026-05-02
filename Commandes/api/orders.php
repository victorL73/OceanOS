<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = commandes_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = oceanos_require_auth($pdo);

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'detail') {
            commandes_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'order' => commandes_fetch_order_detail($pdo, (int) ($_GET['id'] ?? 0)),
            ]);
        }

        commandes_json_response(commandes_dashboard($pdo, $user, $_GET));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $input = commandes_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'change_status') {
            $order = commandes_change_order_status(
                $pdo,
                $user,
                (int) ($input['orderId'] ?? 0),
                (int) ($input['stateId'] ?? 0)
            );
            commandes_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'message' => 'Statut de commande mis a jour dans PrestaShop.',
                'order' => $order,
                'dashboard' => commandes_dashboard($pdo, $user, []),
            ]);
        }

        commandes_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Commandes non supportee.',
        ], 422);
    }

    commandes_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    commandes_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    commandes_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
