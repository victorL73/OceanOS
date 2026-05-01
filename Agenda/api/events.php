<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = agenda_pdo();
    $user = agenda_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response(agenda_dashboard($pdo, $user));
    }

    if ($method !== 'POST') {
        oceanos_json_response([
            'ok' => false,
            'error' => 'method_not_allowed',
            'message' => 'Methode non supportee.',
        ], 405);
    }

    $input = oceanos_read_json_request();
    $action = strtolower(trim((string) ($input['action'] ?? 'create_event')));

    if ($action === 'create_event') {
        $event = agenda_create_event($pdo, $user, $input);
        oceanos_json_response([
            'ok' => true,
            'message' => $event['category'] === 'meeting' ? 'Reunion ajoutee a l agenda.' : 'Evenement ajoute a l agenda.',
            'event' => $event,
            ...agenda_dashboard($pdo, $user),
        ], 201);
    }

    if ($action === 'update_event') {
        $event = agenda_update_event($pdo, $user, $input);
        oceanos_json_response([
            'ok' => true,
            'message' => 'Evenement mis a jour.',
            'event' => $event,
            ...agenda_dashboard($pdo, $user),
        ]);
    }

    if ($action === 'delete_event') {
        agenda_delete_event($pdo, $user, (int) ($input['id'] ?? 0));
        oceanos_json_response([
            'ok' => true,
            'message' => 'Evenement supprime.',
            ...agenda_dashboard($pdo, $user),
        ]);
    }

    if ($action === 'set_status') {
        $event = agenda_set_event_status($pdo, $user, (int) ($input['id'] ?? 0), (string) ($input['status'] ?? 'planned'));
        oceanos_json_response([
            'ok' => true,
            'message' => 'Statut mis a jour.',
            'event' => $event,
            ...agenda_dashboard($pdo, $user),
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'unsupported_action',
        'message' => 'Action Agenda non supportee.',
    ], 422);
} catch (InvalidArgumentException $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
