<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = meetocean_pdo();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $currentUser = oceanos_current_user($pdo);
    $user = is_array($currentUser) && meetocean_user_can_access($currentUser) ? $currentUser : null;

    if ($method === 'GET') {
        $inviteToken = $_GET['invite'] ?? $_GET['token'] ?? '';
        $roomCode = $_GET['room'] ?? $_GET['code'] ?? '';
        if (trim((string) $inviteToken) !== '' && trim((string) $roomCode) !== '') {
            $room = meetocean_find_invited_room($pdo, $roomCode, $inviteToken);
            oceanos_json_response(meetocean_guest_dashboard($pdo, $room, $_GET['name'] ?? ''));
        }

        if ($user !== null) {
            oceanos_json_response(meetocean_dashboard($pdo, $user));
        }

        oceanos_json_response([
            'ok' => false,
            'error' => $currentUser === null ? 'unauthenticated' : 'forbidden',
            'message' => $currentUser === null ? 'Connexion requise.' : 'MeetOcean n est pas active pour ce compte.',
        ], $currentUser === null ? 401 : 403);
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
    $inviteToken = $input['inviteToken'] ?? $input['invite'] ?? $input['token'] ?? '';
    $guestName = $input['guestName'] ?? $input['displayName'] ?? '';
    $isGuest = trim((string) $inviteToken) !== '';

    if ($user === null && !$isGuest) {
        oceanos_json_response([
            'ok' => false,
            'error' => $currentUser === null ? 'unauthenticated' : 'forbidden',
            'message' => $currentUser === null ? 'Connexion requise.' : 'MeetOcean n est pas active pour ce compte.',
        ], $currentUser === null ? 401 : 403);
    }

    $actor = $isGuest ? meetocean_guest_user($guestName) : $user;

    if ($action === 'dashboard') {
        if ($isGuest) {
            $room = meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken);
            oceanos_json_response(meetocean_guest_dashboard($pdo, $room, $guestName));
        }
        oceanos_json_response(meetocean_dashboard($pdo, $actor));
    }

    if ($action === 'create_room') {
        if ($isGuest) {
            throw new InvalidArgumentException('Un invite ne peut pas creer de reunion.');
        }
        $room = meetocean_create_room($pdo, $actor, (string) ($input['title'] ?? 'Reunion MeetOcean'));
        $participant = meetocean_touch_participant($pdo, $room, $actor, $input);
        oceanos_json_response([
            ...meetocean_room_state($pdo, $room, $actor, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion creee.',
        ]);
    }

    if ($action === 'ensure_invite') {
        if ($isGuest) {
            throw new InvalidArgumentException('Un invite ne peut pas creer de lien invitation.');
        }
        $room = meetocean_ensure_invite($pdo, meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? ''));
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'room' => meetocean_public_room($pdo, $room, $actor),
            'inviteUrl' => meetocean_invite_url($room),
            'message' => 'Lien invitation pret.',
        ]);
    }

    if ($action === 'join_room') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $actor, $input);
        oceanos_json_response([
            ...meetocean_room_state($pdo, $room, $actor, $participant['clientId'], 0, 0, $participant['targetLanguage']),
            'message' => 'Reunion rejointe.',
        ]);
    }

    if ($action === 'touch') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $actor, $input);
        oceanos_json_response([
            ...meetocean_room_state(
                $pdo,
                $room,
                $actor,
                $participant['clientId'],
                (int) ($input['sinceSignalId'] ?? 0),
                (int) ($input['sinceTranscriptId'] ?? 0),
                $participant['targetLanguage']
            ),
            'message' => 'Presence mise a jour.',
        ]);
    }

    if ($action === 'sync') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $actor, $input);
        oceanos_json_response(meetocean_room_state(
            $pdo,
            $room,
            $actor,
            $participant['clientId'],
            (int) ($input['sinceSignalId'] ?? 0),
            (int) ($input['sinceTranscriptId'] ?? 0),
            $participant['targetLanguage']
        ));
    }

    if ($action === 'leave_room') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $clientId = meetocean_clean_client_id($input['clientId'] ?? '');
        meetocean_leave_participant($pdo, (int) $room['id'], $clientId);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Vous avez quitte la reunion.',
        ]);
    }

    if ($action === 'delete_room') {
        if ($isGuest) {
            throw new InvalidArgumentException('Un invite ne peut pas supprimer de reunion.');
        }
        $room = meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        meetocean_delete_room($pdo, $room, $actor);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'message' => 'Reunion supprimee.',
            'recentRooms' => meetocean_recent_rooms($pdo, $actor),
        ]);
    }

    if ($action === 'signal') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $signal = meetocean_add_signal($pdo, $room, $input);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'signal' => $signal,
        ]);
    }

    if ($action === 'add_transcript') {
        $room = $isGuest
            ? meetocean_find_invited_room($pdo, $input['roomCode'] ?? $input['roomId'] ?? '', $inviteToken)
            : meetocean_find_room($pdo, $input['roomId'] ?? $input['roomCode'] ?? '');
        $participant = meetocean_touch_participant($pdo, $room, $actor, $input);
        $transcript = meetocean_add_transcript($pdo, $room, $actor, $input);
        oceanos_json_response([
            ...meetocean_room_state(
                $pdo,
                $room,
                $actor,
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
} catch (PDOException $exception) {
    if (meetocean_is_retryable_database_error($exception)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'database_busy',
            'message' => 'La reunion est tres active, synchronisation relancee automatiquement.',
        ], 503);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'database_error',
        'message' => 'Erreur base de donnees MeetOcean.',
    ], 500);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}

