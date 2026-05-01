<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const VISIOCEAN_MODULE_ID = 'visiocean';
const VISIOCEAN_PRESENCE_TTL_SECONDS = 45;
const VISIOCEAN_SIGNAL_TTL_MINUTES = 10;

function visiocean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    visiocean_ensure_schema($pdo);
    return $pdo;
}

function visiocean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_rooms (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(24) NOT NULL UNIQUE,
            title VARCHAR(190) NOT NULL,
            created_by BIGINT UNSIGNED NULL,
            is_locked TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_visiocean_rooms_activity (last_activity_at),
            CONSTRAINT fk_visiocean_rooms_creator FOREIGN KEY (created_by) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_participants (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            room_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NULL,
            client_id VARCHAR(80) NOT NULL,
            display_name VARCHAR(160) NOT NULL,
            source_language VARCHAR(12) NOT NULL DEFAULT 'fr-FR',
            target_language VARCHAR(12) NOT NULL DEFAULT 'fr-FR',
            microphone_enabled TINYINT(1) NOT NULL DEFAULT 1,
            camera_enabled TINYINT(1) NOT NULL DEFAULT 1,
            screen_enabled TINYINT(1) NOT NULL DEFAULT 0,
            connection_state VARCHAR(40) NOT NULL DEFAULT 'online',
            joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_visiocean_participant_client (room_id, client_id),
            KEY idx_visiocean_participants_room_updated (room_id, updated_at),
            CONSTRAINT fk_visiocean_participants_room FOREIGN KEY (room_id) REFERENCES visiocean_rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_visiocean_participants_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_signals (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            room_id BIGINT UNSIGNED NOT NULL,
            sender_client_id VARCHAR(80) NOT NULL,
            recipient_client_id VARCHAR(80) NOT NULL,
            signal_type VARCHAR(32) NOT NULL,
            payload_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_visiocean_signals_recipient (room_id, recipient_client_id, id),
            KEY idx_visiocean_signals_created (created_at),
            CONSTRAINT fk_visiocean_signals_room FOREIGN KEY (room_id) REFERENCES visiocean_rooms(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS visiocean_transcripts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            room_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NULL,
            client_id VARCHAR(80) NOT NULL,
            speaker_name VARCHAR(160) NOT NULL,
            source_language VARCHAR(12) NOT NULL DEFAULT 'fr-FR',
            text LONGTEXT NOT NULL,
            translations_json LONGTEXT NULL,
            is_final TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_visiocean_transcripts_room_id (room_id, id),
            CONSTRAINT fk_visiocean_transcripts_room FOREIGN KEY (room_id) REFERENCES visiocean_rooms(id) ON DELETE CASCADE,
            CONSTRAINT fk_visiocean_transcripts_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function visiocean_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(VISIOCEAN_MODULE_ID, $visibleModules, true)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Visiocean n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function visiocean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function visiocean_public_user(array $user): array
{
    return [
        'id' => (int) ($user['id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'displayName' => (string) ($user['display_name'] ?? $user['email'] ?? 'Utilisateur'),
        'role' => (string) ($user['role'] ?? 'member'),
    ];
}

function visiocean_languages(): array
{
    return [
        'fr-FR' => 'Francais',
        'en-US' => 'Anglais',
        'es-ES' => 'Espagnol',
        'de-DE' => 'Allemand',
        'it-IT' => 'Italien',
        'pt-PT' => 'Portugais',
        'nl-NL' => 'Neerlandais',
        'ar-SA' => 'Arabe',
    ];
}

function visiocean_normalize_language(mixed $language, string $fallback = 'fr-FR'): string
{
    $language = trim((string) $language);
    $languages = visiocean_languages();
    if (isset($languages[$language])) {
        return $language;
    }

    $short = strtolower(substr($language, 0, 2));
    foreach (array_keys($languages) as $code) {
        if (strtolower(substr($code, 0, 2)) === $short) {
            return $code;
        }
    }

    return isset($languages[$fallback]) ? $fallback : 'fr-FR';
}

function visiocean_language_label(string $language): string
{
    $languages = visiocean_languages();
    return $languages[visiocean_normalize_language($language)] ?? $language;
}

function visiocean_clean_client_id(mixed $clientId): string
{
    $clientId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $clientId) ?: '';
    $clientId = substr($clientId, 0, 72);
    if ($clientId === '') {
        throw new InvalidArgumentException('Client de reunion invalide.');
    }

    return $clientId;
}

function visiocean_clean_room_code(mixed $code): string
{
    $code = strtoupper(trim((string) $code));
    $code = preg_replace('/[^A-Z0-9-]/', '', $code) ?: '';
    if ($code === '') {
        throw new InvalidArgumentException('Code reunion obligatoire.');
    }

    return substr($code, 0, 24);
}

function visiocean_room_title(mixed $title): string
{
    $title = trim(preg_replace('/\s+/', ' ', (string) $title) ?? '');
    if ($title === '') {
        $title = 'Reunion Visiocean';
    }

    return mb_substr($title, 0, 120);
}

function visiocean_random_room_slug(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $code = 'VIS-';
        for ($index = 0; $index < 6; $index++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $statement = $pdo->prepare('SELECT COUNT(*) FROM visiocean_rooms WHERE slug = :slug');
        $statement->execute(['slug' => $code]);
        if ((int) $statement->fetchColumn() === 0) {
            return $code;
        }
    }

    throw new RuntimeException('Impossible de generer un code reunion.');
}

function visiocean_create_room(PDO $pdo, array $user, string $title): array
{
    $slug = visiocean_random_room_slug($pdo);
    $statement = $pdo->prepare(
        'INSERT INTO visiocean_rooms (slug, title, created_by)
         VALUES (:slug, :title, :created_by)'
    );
    $statement->execute([
        'slug' => $slug,
        'title' => visiocean_room_title($title),
        'created_by' => (int) $user['id'],
    ]);

    return visiocean_find_room($pdo, (int) $pdo->lastInsertId());
}

function visiocean_find_room(PDO $pdo, mixed $room): array
{
    if (is_numeric($room)) {
        $statement = $pdo->prepare('SELECT * FROM visiocean_rooms WHERE id = :id LIMIT 1');
        $statement->execute(['id' => (int) $room]);
    } else {
        $statement = $pdo->prepare('SELECT * FROM visiocean_rooms WHERE slug = :slug LIMIT 1');
        $statement->execute(['slug' => visiocean_clean_room_code($room)]);
    }

    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Reunion introuvable.');
    }
    if ((int) ($row['is_locked'] ?? 0) === 1) {
        throw new InvalidArgumentException('Cette reunion est verrouillee.');
    }

    return $row;
}

function visiocean_cleanup_room(PDO $pdo, int $roomId): void
{
    $participantStatement = $pdo->prepare(
        'DELETE FROM visiocean_participants
         WHERE room_id = :room_id
           AND updated_at < DATE_SUB(NOW(), INTERVAL ' . VISIOCEAN_PRESENCE_TTL_SECONDS . ' SECOND)'
    );
    $participantStatement->execute(['room_id' => $roomId]);

    $signalStatement = $pdo->prepare(
        'DELETE FROM visiocean_signals
         WHERE room_id = :room_id
           AND created_at < DATE_SUB(NOW(), INTERVAL ' . VISIOCEAN_SIGNAL_TTL_MINUTES . ' MINUTE)'
    );
    $signalStatement->execute(['room_id' => $roomId]);
}

function visiocean_touch_room(PDO $pdo, int $roomId): void
{
    $statement = $pdo->prepare('UPDATE visiocean_rooms SET last_activity_at = CURRENT_TIMESTAMP WHERE id = :room_id');
    $statement->execute(['room_id' => $roomId]);
}

function visiocean_public_room(PDO $pdo, array $room): array
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM visiocean_participants
         WHERE room_id = :room_id
           AND updated_at >= DATE_SUB(NOW(), INTERVAL ' . VISIOCEAN_PRESENCE_TTL_SECONDS . ' SECOND)'
    );
    $statement->execute(['room_id' => (int) $room['id']]);

    return [
        'id' => (int) $room['id'],
        'code' => (string) $room['slug'],
        'title' => (string) $room['title'],
        'participantCount' => (int) $statement->fetchColumn(),
        'createdAt' => (string) ($room['created_at'] ?? ''),
        'updatedAt' => (string) ($room['updated_at'] ?? ''),
        'lastActivityAt' => (string) ($room['last_activity_at'] ?? ''),
    ];
}

function visiocean_recent_rooms(PDO $pdo): array
{
    $statement = $pdo->query(
        'SELECT *
         FROM visiocean_rooms
         ORDER BY last_activity_at DESC, id DESC
         LIMIT 8'
    );
    $rooms = [];
    foreach ($statement->fetchAll() ?: [] as $room) {
        $rooms[] = visiocean_public_room($pdo, $room);
    }

    return $rooms;
}

function visiocean_media_state(array $input): array
{
    $state = is_array($input['mediaState'] ?? null) ? $input['mediaState'] : [];
    return [
        'microphone' => array_key_exists('microphone', $state) ? (bool) $state['microphone'] : true,
        'camera' => array_key_exists('camera', $state) ? (bool) $state['camera'] : true,
        'screen' => array_key_exists('screen', $state) ? (bool) $state['screen'] : false,
        'connectionState' => trim((string) ($state['connectionState'] ?? 'online')) ?: 'online',
    ];
}

function visiocean_touch_participant(PDO $pdo, array $room, array $user, array $input): array
{
    $clientId = visiocean_clean_client_id($input['clientId'] ?? '');
    $sourceLanguage = visiocean_normalize_language($input['sourceLanguage'] ?? 'fr-FR');
    $targetLanguage = visiocean_normalize_language($input['targetLanguage'] ?? $sourceLanguage, $sourceLanguage);
    $media = visiocean_media_state($input);
    $displayName = trim((string) ($user['display_name'] ?? $user['email'] ?? 'Utilisateur'));
    $displayName = mb_substr($displayName !== '' ? $displayName : 'Utilisateur', 0, 140);

    $statement = $pdo->prepare(
        'INSERT INTO visiocean_participants
            (room_id, user_id, client_id, display_name, source_language, target_language, microphone_enabled, camera_enabled, screen_enabled, connection_state)
         VALUES
            (:room_id, :user_id, :client_id, :display_name, :source_language, :target_language, :microphone_enabled, :camera_enabled, :screen_enabled, :connection_state)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            display_name = VALUES(display_name),
            source_language = VALUES(source_language),
            target_language = VALUES(target_language),
            microphone_enabled = VALUES(microphone_enabled),
            camera_enabled = VALUES(camera_enabled),
            screen_enabled = VALUES(screen_enabled),
            connection_state = VALUES(connection_state),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'room_id' => (int) $room['id'],
        'user_id' => (int) $user['id'],
        'client_id' => $clientId,
        'display_name' => $displayName,
        'source_language' => $sourceLanguage,
        'target_language' => $targetLanguage,
        'microphone_enabled' => $media['microphone'] ? 1 : 0,
        'camera_enabled' => $media['camera'] ? 1 : 0,
        'screen_enabled' => $media['screen'] ? 1 : 0,
        'connection_state' => mb_substr($media['connectionState'], 0, 36),
    ]);
    visiocean_touch_room($pdo, (int) $room['id']);

    return [
        'clientId' => $clientId,
        'sourceLanguage' => $sourceLanguage,
        'targetLanguage' => $targetLanguage,
    ];
}

function visiocean_leave_participant(PDO $pdo, int $roomId, string $clientId): void
{
    $statement = $pdo->prepare('DELETE FROM visiocean_participants WHERE room_id = :room_id AND client_id = :client_id');
    $statement->execute([
        'room_id' => $roomId,
        'client_id' => $clientId,
    ]);

    $signalStatement = $pdo->prepare(
        'DELETE FROM visiocean_signals
         WHERE room_id = :room_id
           AND (sender_client_id = :client_id OR recipient_client_id = :client_id)'
    );
    $signalStatement->execute([
        'room_id' => $roomId,
        'client_id' => $clientId,
    ]);
}

function visiocean_list_participants(PDO $pdo, int $roomId): array
{
    $statement = $pdo->prepare(
        'SELECT client_id, user_id, display_name, source_language, target_language,
                microphone_enabled, camera_enabled, screen_enabled, connection_state,
                joined_at, updated_at
         FROM visiocean_participants
         WHERE room_id = :room_id
           AND updated_at >= DATE_SUB(NOW(), INTERVAL ' . VISIOCEAN_PRESENCE_TTL_SECONDS . ' SECOND)
         ORDER BY joined_at ASC, id ASC'
    );
    $statement->execute(['room_id' => $roomId]);

    $participants = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $participants[] = [
            'clientId' => (string) $row['client_id'],
            'userId' => (int) ($row['user_id'] ?? 0),
            'displayName' => (string) $row['display_name'],
            'sourceLanguage' => visiocean_normalize_language($row['source_language'] ?? 'fr-FR'),
            'targetLanguage' => visiocean_normalize_language($row['target_language'] ?? 'fr-FR'),
            'microphoneEnabled' => (int) $row['microphone_enabled'] === 1,
            'cameraEnabled' => (int) $row['camera_enabled'] === 1,
            'screenEnabled' => (int) $row['screen_enabled'] === 1,
            'connectionState' => (string) $row['connection_state'],
            'joinedAt' => (string) $row['joined_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    return $participants;
}

function visiocean_json_decode(?string $json): array
{
    $decoded = json_decode((string) $json, true);
    return is_array($decoded) ? $decoded : [];
}

function visiocean_json_encode(array $payload): string
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($json)) {
        throw new RuntimeException('Encodage JSON impossible.');
    }

    return $json;
}

function visiocean_add_signal(PDO $pdo, array $room, array $input): array
{
    $sender = visiocean_clean_client_id($input['senderClientId'] ?? $input['clientId'] ?? '');
    $recipient = visiocean_clean_client_id($input['recipientClientId'] ?? '');
    $type = strtolower(trim((string) ($input['signalType'] ?? '')));
    if (!in_array($type, ['offer', 'answer', 'candidate', 'leave'], true)) {
        throw new InvalidArgumentException('Signal WebRTC non supporte.');
    }

    $payload = $input['payload'] ?? [];
    if (!is_array($payload)) {
        throw new InvalidArgumentException('Signal WebRTC invalide.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO visiocean_signals (room_id, sender_client_id, recipient_client_id, signal_type, payload_json)
         VALUES (:room_id, :sender_client_id, :recipient_client_id, :signal_type, :payload_json)'
    );
    $statement->execute([
        'room_id' => (int) $room['id'],
        'sender_client_id' => $sender,
        'recipient_client_id' => $recipient,
        'signal_type' => $type,
        'payload_json' => visiocean_json_encode($payload),
    ]);

    return [
        'id' => (int) $pdo->lastInsertId(),
        'type' => $type,
    ];
}

function visiocean_signals_since(PDO $pdo, int $roomId, string $clientId, int $sinceId): array
{
    $statement = $pdo->prepare(
        'SELECT id, sender_client_id, recipient_client_id, signal_type, payload_json, created_at
         FROM visiocean_signals
         WHERE room_id = :room_id
           AND id > :since_id
           AND sender_client_id <> :client_id
           AND recipient_client_id = :client_id
         ORDER BY id ASC
         LIMIT 200'
    );
    $statement->bindValue('room_id', $roomId, PDO::PARAM_INT);
    $statement->bindValue('since_id', max(0, $sinceId), PDO::PARAM_INT);
    $statement->bindValue('client_id', $clientId, PDO::PARAM_STR);
    $statement->execute();

    $signals = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $signals[] = [
            'id' => (int) $row['id'],
            'senderClientId' => (string) $row['sender_client_id'],
            'recipientClientId' => (string) $row['recipient_client_id'],
            'signalType' => (string) $row['signal_type'],
            'payload' => visiocean_json_decode($row['payload_json'] ?? '{}'),
            'createdAt' => (string) $row['created_at'],
        ];
    }

    return $signals;
}

function visiocean_add_transcript(PDO $pdo, array $room, array $user, array $input): array
{
    $clientId = visiocean_clean_client_id($input['clientId'] ?? '');
    $text = trim(preg_replace('/\s+/', ' ', (string) ($input['text'] ?? '')) ?? '');
    if ($text === '') {
        throw new InvalidArgumentException('Transcription vide.');
    }
    if (mb_strlen($text) > 1200) {
        $text = mb_substr($text, 0, 1200);
    }

    $sourceLanguage = visiocean_normalize_language($input['sourceLanguage'] ?? 'fr-FR');
    $speakerName = trim((string) ($user['display_name'] ?? $user['email'] ?? 'Utilisateur')) ?: 'Utilisateur';

    $statement = $pdo->prepare(
        'INSERT INTO visiocean_transcripts
            (room_id, user_id, client_id, speaker_name, source_language, text, translations_json, is_final)
         VALUES
            (:room_id, :user_id, :client_id, :speaker_name, :source_language, :text, :translations_json, 1)'
    );
    $statement->execute([
        'room_id' => (int) $room['id'],
        'user_id' => (int) $user['id'],
        'client_id' => $clientId,
        'speaker_name' => mb_substr($speakerName, 0, 140),
        'source_language' => $sourceLanguage,
        'text' => $text,
        'translations_json' => '{}',
    ]);
    visiocean_touch_room($pdo, (int) $room['id']);

    return [
        'id' => (int) $pdo->lastInsertId(),
    ];
}

function visiocean_translate_text(PDO $pdo, int $userId, string $text, string $sourceLanguage, string $targetLanguage): string
{
    $settings = oceanos_ai_private_settings($pdo, $userId);
    $apiKey = trim((string) ($settings['apiKey'] ?? ''));
    if ($apiKey === '') {
        return '';
    }

    $sourceLabel = visiocean_language_label($sourceLanguage);
    $targetLabel = visiocean_language_label($targetLanguage);
    $model = trim((string) ($settings['model'] ?? 'llama-3.3-70b-versatile')) ?: 'llama-3.3-70b-versatile';

    return trim(oceanos_groq_chat_completion(
        $apiKey,
        $model,
        [
            [
                'role' => 'system',
                'content' => 'Tu es un moteur de traduction de visioconference. Traduis fidelement le sens, conserve les noms propres et reponds uniquement avec le texte traduit.',
            ],
            [
                'role' => 'user',
                'content' => "Langue source: {$sourceLabel}\nLangue cible: {$targetLabel}\nTexte:\n{$text}",
            ],
        ],
        0
    ));
}

function visiocean_ensure_translation(PDO $pdo, int $userId, array $row, string $targetLanguage): array
{
    $sourceLanguage = visiocean_normalize_language($row['source_language'] ?? 'fr-FR');
    $targetLanguage = visiocean_normalize_language($targetLanguage, $sourceLanguage);
    $text = trim((string) ($row['text'] ?? ''));
    $translations = visiocean_json_decode($row['translations_json'] ?? '{}');

    if ($targetLanguage === $sourceLanguage || $text === '') {
        $row['translatedText'] = $text;
        $row['translationStatus'] = 'same_language';
        return $row;
    }

    if (isset($translations[$targetLanguage]) && trim((string) $translations[$targetLanguage]) !== '') {
        $row['translatedText'] = (string) $translations[$targetLanguage];
        $row['translationStatus'] = 'translated';
        return $row;
    }

    try {
        $translated = visiocean_translate_text($pdo, $userId, $text, $sourceLanguage, $targetLanguage);
    } catch (Throwable $exception) {
        $translated = '';
    }

    if ($translated !== '') {
        $translations[$targetLanguage] = mb_substr($translated, 0, 4000);
        $statement = $pdo->prepare(
            'UPDATE visiocean_transcripts
             SET translations_json = :translations_json
             WHERE id = :id'
        );
        $statement->execute([
            'id' => (int) $row['id'],
            'translations_json' => visiocean_json_encode($translations),
        ]);
        $row['translations_json'] = visiocean_json_encode($translations);
        $row['translatedText'] = $translations[$targetLanguage];
        $row['translationStatus'] = 'translated';
        return $row;
    }

    $row['translatedText'] = '';
    $row['translationStatus'] = 'unavailable';
    return $row;
}

function visiocean_transcript_payload(array $row, string $targetLanguage): array
{
    $sourceLanguage = visiocean_normalize_language($row['source_language'] ?? 'fr-FR');
    $targetLanguage = visiocean_normalize_language($targetLanguage, $sourceLanguage);

    return [
        'id' => (int) $row['id'],
        'clientId' => (string) $row['client_id'],
        'userId' => (int) ($row['user_id'] ?? 0),
        'speakerName' => (string) $row['speaker_name'],
        'sourceLanguage' => $sourceLanguage,
        'sourceLabel' => visiocean_language_label($sourceLanguage),
        'targetLanguage' => $targetLanguage,
        'targetLabel' => visiocean_language_label($targetLanguage),
        'text' => (string) $row['text'],
        'translatedText' => (string) ($row['translatedText'] ?? ''),
        'translationStatus' => (string) ($row['translationStatus'] ?? 'unavailable'),
        'isFinal' => (int) ($row['is_final'] ?? 1) === 1,
        'createdAt' => (string) $row['created_at'],
    ];
}

function visiocean_transcripts_since(PDO $pdo, int $roomId, int $sinceId, string $targetLanguage, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT id, room_id, user_id, client_id, speaker_name, source_language, text, translations_json, is_final, created_at
         FROM visiocean_transcripts
         WHERE room_id = :room_id
           AND id > :since_id
         ORDER BY id ASC
         LIMIT 100'
    );
    $statement->bindValue('room_id', $roomId, PDO::PARAM_INT);
    $statement->bindValue('since_id', max(0, $sinceId), PDO::PARAM_INT);
    $statement->execute();

    $items = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $row = visiocean_ensure_translation($pdo, $userId, $row, $targetLanguage);
        $items[] = visiocean_transcript_payload($row, $targetLanguage);
    }

    return $items;
}

function visiocean_room_state(PDO $pdo, array $room, array $user, string $clientId, int $sinceSignalId = 0, int $sinceTranscriptId = 0, ?string $targetLanguage = null): array
{
    $clientId = visiocean_clean_client_id($clientId);
    visiocean_cleanup_room($pdo, (int) $room['id']);

    $participant = null;
    foreach (visiocean_list_participants($pdo, (int) $room['id']) as $item) {
        if ($item['clientId'] === $clientId) {
            $participant = $item;
            break;
        }
    }

    $targetLanguage = visiocean_normalize_language($targetLanguage ?? ($participant['targetLanguage'] ?? 'fr-FR'));

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'room' => visiocean_public_room($pdo, $room),
        'participants' => visiocean_list_participants($pdo, (int) $room['id']),
        'signals' => visiocean_signals_since($pdo, (int) $room['id'], $clientId, $sinceSignalId),
        'transcripts' => visiocean_transcripts_since($pdo, (int) $room['id'], $sinceTranscriptId, $targetLanguage, (int) $user['id']),
    ];
}

function visiocean_dashboard(PDO $pdo, array $user): array
{
    $ai = oceanos_ai_public_settings($pdo, (int) $user['id']);

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'currentUser' => visiocean_public_user($user),
        'canManage' => visiocean_is_admin($user),
        'languages' => visiocean_languages(),
        'defaults' => [
            'sourceLanguage' => 'fr-FR',
            'targetLanguage' => 'fr-FR',
        ],
        'ai' => [
            'provider' => (string) ($ai['provider'] ?? 'groq'),
            'model' => (string) ($ai['model'] ?? 'llama-3.3-70b-versatile'),
            'hasApiKey' => (bool) ($ai['hasApiKey'] ?? false),
        ],
        'recentRooms' => visiocean_recent_rooms($pdo),
    ];
}
