<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = formcean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET' && isset($_GET['public'])) {
        $slug = formcean_slugify((string) ($_GET['slug'] ?? ''));
        $form = $slug !== '' ? formcean_find_form_by_slug($pdo, $slug) : null;
        if ($form === null) {
            formcean_json_response([
                'ok' => false,
                'error' => 'not_found',
                'message' => 'Formulaire introuvable.',
            ], 404);
        }

        $payload = formcean_public_form($form, false);
        if (!$payload['isPublished']) {
            $payload['fields'] = [];
        }

        formcean_json_response([
            'ok' => true,
            'form' => $payload,
        ]);
    }

    if ($method === 'POST' && isset($_GET['public'])) {
        $input = formcean_read_json_request();
        $slug = formcean_slugify((string) ($_GET['slug'] ?? $input['slug'] ?? ''));
        $form = $slug !== '' ? formcean_find_form_by_slug($pdo, $slug) : null;
        if ($form === null) {
            formcean_json_response([
                'ok' => false,
                'error' => 'not_found',
                'message' => 'Formulaire introuvable.',
            ], 404);
        }

        $response = formcean_submit_response($pdo, $form, $input);
        formcean_json_response([
            'ok' => true,
            'message' => $response['confirmationMessage'],
            'response' => $response,
        ], 201);
    }

    $user = formcean_require_user($pdo);

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'list')));

        if ($action === 'list') {
            formcean_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'user' => formcean_public_user($user),
                'forms' => formcean_list_forms($pdo, $user),
            ]);
        }

        if ($action === 'get') {
            $form = formcean_require_form($pdo, (int) ($_GET['id'] ?? 0), $user);
            formcean_json_response([
                'ok' => true,
                'form' => formcean_public_form($form, true),
            ]);
        }

        if ($action === 'responses') {
            $form = formcean_require_form($pdo, (int) ($_GET['id'] ?? 0), $user);
            $responses = formcean_list_responses($pdo, $form);
            formcean_json_response([
                'ok' => true,
                'form' => formcean_public_form($form, true),
                'responses' => $responses,
                'summary' => formcean_response_summary($form, $responses),
            ]);
        }

        formcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'POST') {
        $input = formcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'create')));

        if ($action === 'create') {
            $form = formcean_create_form($pdo, $user, $input);
            formcean_json_response([
                'ok' => true,
                'message' => 'Formulaire cree.',
                'form' => formcean_public_form($form, true),
                'forms' => formcean_list_forms($pdo, $user),
            ], 201);
        }

        if ($action === 'duplicate') {
            $form = formcean_require_form($pdo, (int) ($input['id'] ?? 0), $user);
            $copy = formcean_duplicate_form($pdo, $form, $user);
            formcean_json_response([
                'ok' => true,
                'message' => 'Formulaire duplique.',
                'form' => formcean_public_form($copy, true),
                'forms' => formcean_list_forms($pdo, $user),
            ], 201);
        }

        formcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'PATCH') {
        $input = formcean_read_json_request();
        $form = formcean_require_form($pdo, (int) ($input['id'] ?? 0), $user);
        $updated = formcean_update_form($pdo, $form, $input);
        formcean_json_response([
            'ok' => true,
            'message' => 'Formulaire enregistre.',
            'form' => formcean_public_form($updated, true),
            'forms' => formcean_list_forms($pdo, $user),
        ]);
    }

    if ($method === 'DELETE') {
        $input = formcean_read_json_request();
        $form = formcean_require_form($pdo, (int) ($input['id'] ?? $_GET['id'] ?? 0), $user);
        formcean_delete_form($pdo, $form);
        formcean_json_response([
            'ok' => true,
            'message' => 'Formulaire supprime.',
            'forms' => formcean_list_forms($pdo, $user),
        ]);
    }

    formcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    formcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    formcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
