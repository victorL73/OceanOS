<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = visiocean_pdo();
    $user = visiocean_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response(visiocean_dashboard($pdo, $user));
    }

    if ($method !== 'POST') {
        oceanos_json_response([
            'ok' => false,
            'error' => 'method_not_allowed',
            'message' => 'Methode non supportee.',
        ], 405);
    }

    $input = oceanos_read_json_request();
    $action = strtolower(trim((string) ($input['action'] ?? 'dashboard')));

    if ($action === 'dashboard') {
        oceanos_json_response(visiocean_dashboard($pdo, $user));
    }

    if ($action === 'create_room') {
        $room = visiocean_create_room($pdo, $user, (string) ($input['title'] ?? 'Reunion Visiocean'));
        $participant = visiocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...visiocean_room_state($pdo, $room, $user, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion creee.',
        ]);
    }

    if ($action === 'join_room') {
        $room = visiocean_find_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '');
        $participant = visiocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...visiocean_room_state($pdo, $room, $user, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion rejointe.',
        ]);
    }

    if ($action === 'touch') {
        $room = visiocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = visiocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...visiocean_room_state(
                $pdo,
                $room,
                $user,
                $participant['clientId'],
                (int) ($input['sinceSignalId'] ?? 0),
                (int) ($input['sinceTranscriptId'] ?? 0),
                $participant['targetLanguage']
            ),
            'message' => 'Presence mise a jour.',
        ]);
    }

    if ($action === 'sync') {
        $room = visiocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = visiocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response(visiocean_room_state(
            $pdo,
            $room,
            $user,
            $participant['clientId'],
            (int) ($input['sinceSignalId'] ?? 0),
            (int) ($input['sinceTranscriptId'] ?? 0),
            $participant['targetLanguage']
        ));
    }

    if ($action === 'leave_room') {
        $room = visiocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $clientId = visiocean_clean_client_id($input['clientId'] ?? '');
        visiocean_leave_participant($pdo, (int) $room['id'], $clientId);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Vous avez quitte la reunion.',
        ]);
    }

    if ($action === 'signal') {
        $room = visiocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $signal = visiocean_add_signal($pdo, $room, $input);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'signal' => $signal,
        ]);
    }

    if ($action === 'add_transcript') {
        $room = visiocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = visiocean_touch_participant($pdo, $room, $user, $input);
        $transcript = visiocean_add_transcript($pdo, $room, $user, $input);
        oceanos_json_response([
            ...visiocean_room_state(
                $pdo,
                $room,
                $user,
                $participant['clientId'],
                (int) ($input['sinceSignalId'] ?? 0),
                max(0, $transcript['id'] - 1),
                $participant['targetLanguage']
            ),
            'message' => 'Transcription ajoutee.',
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'unsupported_action',
        'message' => 'Action Visiocean non supportee.',
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
