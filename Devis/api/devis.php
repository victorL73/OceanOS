<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = devis_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = oceanos_require_auth($pdo);

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'download') {
            devis_download_quote_pdf($pdo, $user, (int) ($_GET['id'] ?? 0));
        }

        if ($action === 'products') {
            devis_json_response([
                'ok' => true,
                'products' => devis_fetch_products($pdo),
            ]);
        }

        devis_json_response(devis_dashboard($pdo, $user));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $input = devis_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'save_quote') {
            $quote = devis_save_quote($pdo, $user, is_array($input['quote'] ?? null) ? $input['quote'] : []);
            devis_json_response([
                'ok' => true,
                'message' => 'Devis enregistre. PDF genere localement.',
                'quote' => $quote,
                'quotes' => devis_list_quotes($pdo, (int) $user['id']),
            ]);
        }

        if ($action === 'delete_quote') {
            devis_delete_quote($pdo, $user, (int) ($input['id'] ?? 0));
            devis_json_response([
                'ok' => true,
                'message' => 'Devis supprime.',
                'quotes' => devis_list_quotes($pdo, (int) $user['id']),
            ]);
        }

        devis_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Devis non supportee.',
        ], 422);
    }

    devis_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    devis_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    devis_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
