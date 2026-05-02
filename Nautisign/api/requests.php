<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nautisign_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if (isset($_GET['public'])) {
        $token = (string) ($_GET['token'] ?? '');
        $request = nautisign_find_request_by_token($pdo, $token);
        if ($request === null) {
            nautisign_json_response([
                'ok' => false,
                'error' => 'not_found',
                'message' => 'Lien Nautisign introuvable.',
            ], 404);
        }

        if ($method === 'GET') {
            nautisign_json_response([
                'ok' => true,
                'request' => nautisign_public_request($request, false),
            ]);
        }

        if ($method === 'POST') {
            $input = nautisign_read_json_request();
            $signed = nautisign_sign_request($pdo, $request, $input);
            nautisign_json_response([
                'ok' => true,
                'message' => 'Devis signe et valide.',
                'request' => nautisign_public_request($signed, false),
            ], 201);
        }

        nautisign_json_response([
            'ok' => false,
            'error' => 'method_not_allowed',
            'message' => 'Methode non supportee.',
        ], 405);
    }

    $user = nautisign_require_user($pdo);

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'list')));

        if ($action === 'quotes') {
            nautisign_json_response([
                'ok' => true,
                'quotesDir' => 'Devis/storage/quotes',
                'quoteSources' => array_map(
                    static fn(array $source): array => [
                        'label' => (string) ($source['label'] ?? ''),
                        'relativePath' => (string) ($source['relativePath'] ?? ''),
                    ],
                    nautisign_quote_sources()
                ),
                'quotes' => nautisign_list_quote_files(),
            ]);
        }

        if ($action === 'list') {
            nautisign_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'user' => nautisign_public_user($user),
                'requests' => nautisign_list_requests($pdo, $user),
                'quotesDir' => 'Devis/storage/quotes',
                'quotes' => nautisign_list_quote_files(),
            ]);
        }

        if ($action === 'get') {
            $request = nautisign_require_request($pdo, (int) ($_GET['id'] ?? 0), $user);
            nautisign_json_response([
                'ok' => true,
                'request' => nautisign_public_request($request, true),
            ]);
        }

        nautisign_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'POST') {
        $input = nautisign_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'create')));

        if ($action === 'create') {
            $request = nautisign_create_request($pdo, $user, $input);
            nautisign_json_response([
                'ok' => true,
                'message' => 'Lien Nautisign cree.',
                'request' => nautisign_public_request($request, true),
                'requests' => nautisign_list_requests($pdo, $user),
            ], 201);
        }

        if ($action === 'revoke' || $action === 'restore') {
            $request = nautisign_require_request($pdo, (int) ($input['id'] ?? 0), $user);
            $updated = nautisign_update_status($pdo, $request, $action === 'revoke' ? 'revoked' : 'pending');
            nautisign_json_response([
                'ok' => true,
                'message' => $action === 'revoke' ? 'Lien desactive.' : 'Lien reactive.',
                'request' => nautisign_public_request($updated, true),
                'requests' => nautisign_list_requests($pdo, $user),
            ]);
        }

        nautisign_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        $input = nautisign_read_json_request();
        $request = nautisign_require_request($pdo, (int) ($input['id'] ?? $_GET['id'] ?? 0), $user);
        nautisign_delete_request($pdo, $request);
        nautisign_json_response([
            'ok' => true,
            'message' => 'Demande supprimee.',
            'requests' => nautisign_list_requests($pdo, $user),
        ]);
    }

    nautisign_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    nautisign_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    nautisign_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
