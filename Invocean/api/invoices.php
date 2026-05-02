<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = invocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $user = invocean_require_auth($pdo);

    if ($method === 'GET') {
        if (isset($_GET['download']) && $_GET['download'] === 'pdf') {
            invocean_download_invoice_pdf($pdo, (int) ($_GET['id'] ?? 0));
        }

        if (isset($_GET['download']) && $_GET['download'] === 'facturx') {
            invocean_download_facturx_pdf($pdo, (int) ($_GET['id'] ?? 0));
        }

        if (isset($_GET['download']) && $_GET['download'] === 'facturx_xml') {
            invocean_download_facturx_xml($pdo, (int) ($_GET['id'] ?? 0));
        }

        if (isset($_GET['export']) && $_GET['export'] === 'csv') {
            invocean_export_csv($pdo, $_GET);
        }
        if (isset($_GET['export']) && $_GET['export'] === 'pdf') {
            invocean_export_pdf_zip($pdo, $_GET);
        }
        if (isset($_GET['export']) && $_GET['export'] === 'facturx') {
            invocean_export_facturx_zip($pdo, $_GET);
        }

        $payload = invocean_list_invoices($pdo, $_GET);
        $payload['ok'] = true;
        $payload['runs'] = invocean_list_sync_runs($pdo);
        invocean_json_response($payload);
    }

    if ($method === 'PATCH') {
        $input = invocean_read_json_request();
        $invoice = invocean_update_invoice_status(
            $pdo,
            (int) ($input['id'] ?? 0),
            (string) ($input['status'] ?? '')
        );

        invocean_json_response([
            'ok' => true,
            'message' => 'Statut mis a jour.',
            'invoice' => $invoice,
        ]);
    }

    if ($method === 'DELETE') {
        if (!invocean_is_super($user)) {
            invocean_json_response([
                'ok' => false,
                'error' => 'forbidden',
                'message' => 'Acces reserve aux super utilisateurs.',
            ], 403);
        }

        $input = invocean_read_json_request();
        $deleted = invocean_delete_invoice($pdo, (int) ($input['id'] ?? 0), $user);

        invocean_json_response([
            'ok' => true,
            'message' => 'Facture supprimee.',
            'deleted' => $deleted,
            'runs' => invocean_list_sync_runs($pdo),
        ]);
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
