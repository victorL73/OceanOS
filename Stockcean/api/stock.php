<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = stockcean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = oceanos_require_auth($pdo);

    if ($method === 'GET') {
        stockcean_json_response(stockcean_dashboard($pdo, $_GET, $user));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $input = stockcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'sync') {
            $admin = stockcean_require_admin($pdo);
            $run = stockcean_sync_prestashop($pdo, $admin, $input);
            stockcean_json_response([
                'ok' => true,
                'message' => $run['message'],
                'run' => $run,
                'dashboard' => stockcean_dashboard($pdo, [], $admin),
            ]);
        }

        if ($action === 'save_supplier') {
            $admin = stockcean_require_admin($pdo);
            $supplier = stockcean_save_supplier($pdo, $input);
            stockcean_json_response([
                'ok' => true,
                'message' => 'Fournisseur enregistre.',
                'supplier' => $supplier,
                'dashboard' => stockcean_dashboard($pdo, [], $admin),
            ]);
        }

        if ($action === 'update_product') {
            $admin = stockcean_require_admin($pdo);
            $product = stockcean_update_product($pdo, $input);
            stockcean_json_response([
                'ok' => true,
                'message' => 'Produit mis a jour.',
                'product' => $product,
                'dashboard' => stockcean_dashboard($pdo, [], $admin),
            ]);
        }

        if ($action === 'create_purchase_order') {
            $admin = stockcean_require_admin($pdo);
            $order = stockcean_create_purchase_order($pdo, $admin, $input);
            stockcean_json_response([
                'ok' => true,
                'message' => 'Commande fournisseur creee.',
                'purchaseOrder' => $order,
                'dashboard' => stockcean_dashboard($pdo, [], $admin),
            ], 201);
        }

        if ($action === 'update_purchase_order_status') {
            $admin = stockcean_require_admin($pdo);
            $order = stockcean_update_purchase_order_status($pdo, $input);
            $receipt = is_array($order['prestashopReceipt'] ?? null) ? $order['prestashopReceipt'] : null;
            $message = 'Statut de commande mis a jour.';
            if ($receipt !== null) {
                $units = (int) ($receipt['unitsPushed'] ?? 0);
                $message = $units > 0
                    ? sprintf('Commande receptionnee. %d unite(s) ajoutee(s) dans PrestaShop.', $units)
                    : 'Commande receptionnee. Aucun stock restant a pousser vers PrestaShop.';
            }
            stockcean_json_response([
                'ok' => true,
                'message' => $message,
                'purchaseOrder' => $order,
                'dashboard' => stockcean_dashboard($pdo, [], $admin),
            ]);
        }

        stockcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Stockcean non supportee.',
        ], 422);
    }

    stockcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    stockcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    stockcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
