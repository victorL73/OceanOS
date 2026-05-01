<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = meetocean_pdo();
    $user = meetocean_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response(meetocean_dashboard($pdo, $user));
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
        oceanos_json_response(meetocean_dashboard($pdo, $user));
    }

    if ($action === 'create_room') {
        $room = meetocean_create_room($pdo, $user, (string) ($input['title'] ?? 'Reunion MeetOcean'));
        $participant = meetocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...meetocean_room_state($pdo, $room, $user, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion creee.',
        ]);
    }

    if ($action === 'join_room') {
        $room = meetocean_find_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...meetocean_room_state($pdo, $room, $user, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion rejointe.',
        ]);
    }

    if ($action === 'touch') {
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response([
            ...meetocean_room_state(
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
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $user, $input);
        oceanos_json_response(meetocean_room_state(
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
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $clientId = meetocean_clean_client_id($input['clientId'] ?? '');
        meetocean_leave_participant($pdo, (int) $room['id'], $clientId);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Vous avez quitte la reunion.',
        ]);
    }

    if ($action === 'signal') {
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $signal = meetocean_add_signal($pdo, $room, $input);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'signal' => $signal,
        ]);
    }

    if ($action === 'add_transcript') {
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $user, $input);
        $transcript = meetocean_add_transcript($pdo, $room, $user, $input);
        oceanos_json_response([
            ...meetocean_room_state(
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
        'message' => 'Action MeetOcean non supportee.',
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

