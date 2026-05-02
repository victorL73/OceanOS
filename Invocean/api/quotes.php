<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = invocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    invocean_require_auth($pdo);

    if ($method === 'GET') {
        $payload = invocean_list_signed_quotes($pdo);
        $payload['ok'] = true;
        invocean_json_response($payload);
    }

    if ($method === 'POST') {
        invocean_require_admin($pdo);
        $input = invocean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'sync')));

        if ($action === 'sync') {
            $summary = invocean_sync_nautisign_quotes($pdo);
            $payload = invocean_list_signed_quotes($pdo);
            invocean_json_response([
                'ok' => true,
                'message' => $summary['message'],
                'summary' => $summary,
                'quotes' => $payload['quotes'],
                'stats' => $payload['stats'],
            ]);
        }

        if ($action === 'convert') {
            $invoice = invocean_convert_quote_to_invoice($pdo, (int) ($input['id'] ?? 0));
            $payload = invocean_list_signed_quotes($pdo);
            invocean_json_response([
                'ok' => true,
                'message' => 'Devis transforme en facture.',
                'invoice' => $invoice,
                'quotes' => $payload['quotes'],
                'stats' => $payload['stats'],
            ]);
        }

        if ($action === 'import') {
            $quotePayload = $input['quote'] ?? null;
            if (is_string($quotePayload)) {
                $quotePayload = json_decode($quotePayload, true);
            }
            if (!is_array($quotePayload)) {
                throw new InvalidArgumentException('Collez un devis JSON valide.');
            }
            $quote = invocean_normalize_quote_payload($quotePayload, 'manual');
            invocean_upsert_signed_quote($pdo, $quote);
            $payload = invocean_list_signed_quotes($pdo);
            invocean_json_response([
                'ok' => true,
                'message' => 'Devis importe.',
                'quotes' => $payload['quotes'],
                'stats' => $payload['stats'],
            ]);
        }

        invocean_json_response([
            'ok' => false,
            'error' => 'unknown_action',
            'message' => 'Action devis inconnue.',
        ], 422);
    }

    invocean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    invocean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    invocean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
