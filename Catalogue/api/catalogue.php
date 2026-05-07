<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = catalogue_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'dashboard')));

        if ($action === 'download_order') {
            catalogue_download_order_pdf($pdo, (int) ($_GET['id'] ?? 0));
        }

        if ($action === 'prestashop_image') {
            catalogue_proxy_prestashop_image($pdo, (int) ($_GET['product_id'] ?? 0), (int) ($_GET['image_id'] ?? 0));
        }

        catalogue_json_response(catalogue_dashboard($pdo));
    }

    if ($method === 'POST' || $method === 'PATCH') {
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        $isMultipart = str_contains($contentType, 'multipart/form-data');
        $input = $isMultipart ? $_POST : catalogue_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'client_login') {
            $client = catalogue_login_client($pdo, $input);
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
                'ok' => true,
                'message' => 'Connexion catalogue active.',
                'client' => $client,
            ]));
        }

        if ($action === 'client_register') {
            $client = catalogue_register_client($pdo, $input);
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
                'ok' => true,
                'message' => 'Compte catalogue cree.',
                'client' => $client,
            ]));
        }

        if ($action === 'client_logout') {
            catalogue_logout_client();
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
                'ok' => true,
                'message' => 'Session catalogue fermee.',
            ]));
        }

        if ($action === 'place_order') {
            $result = catalogue_place_order($pdo, $input);
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), $result, [
                'ok' => true,
                'message' => 'Commande envoyee. Le devis PDF a ete genere.',
            ]));
        }

        if ($action === 'sync_prestashop') {
            catalogue_require_admin($pdo);
            $result = catalogue_sync_prestashop($pdo);
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), $result, [
                'ok' => true,
                'message' => (string) $result['count'] . ' produit(s) recuperes depuis PrestaShop.',
            ]));
        }

        if ($action === 'save_product') {
            catalogue_require_admin($pdo);
            $productInput = is_array($input['product'] ?? null) ? $input['product'] : $input;
            $product = catalogue_save_product($pdo, $productInput);
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
                'ok' => true,
                'message' => 'Produit catalogue enregistre.',
                'product' => $product,
            ]));
        }

        if ($action === 'delete_product') {
            catalogue_require_admin($pdo);
            catalogue_disable_product($pdo, (int) ($input['id'] ?? 0));
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
                'ok' => true,
                'message' => 'Produit masque du catalogue.',
            ]));
        }

        if ($action === 'upload_images') {
            catalogue_require_admin($pdo);
            $result = catalogue_upload_images($pdo, (int) ($input['product_id'] ?? $input['productId'] ?? 0));
            catalogue_json_response(array_merge(catalogue_dashboard($pdo), $result, [
                'ok' => true,
                'message' => count($result['uploaded']) . ' photo(s) ajoutee(s).',
            ]));
        }

        catalogue_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action Catalogue non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        catalogue_logout_client();
        catalogue_json_response(array_merge(catalogue_dashboard($pdo), [
            'ok' => true,
            'message' => 'Session catalogue fermee.',
        ]));
    }

    catalogue_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (CatalogueAuthException $exception) {
    catalogue_json_response([
        'ok' => false,
        'error' => 'client_auth_required',
        'message' => $exception->getMessage(),
    ], 401);
} catch (CatalogueForbiddenException $exception) {
    catalogue_json_response([
        'ok' => false,
        'error' => 'forbidden',
        'message' => $exception->getMessage(),
    ], 403);
} catch (InvalidArgumentException $exception) {
    catalogue_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    catalogue_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
