<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'MeetOcean' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const AGENDA_MODULE_ID = 'agenda';

function agenda_pdo(): PDO
{
    $pdo = oceanos_pdo();
    meetocean_ensure_schema($pdo);
    agenda_ensure_schema($pdo);
    return $pdo;
}

function agenda_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS agenda_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(190) NOT NULL,
            description TEXT NULL,
            category VARCHAR(40) NOT NULL DEFAULT 'task',
            status VARCHAR(24) NOT NULL DEFAULT 'planned',
            priority VARCHAR(24) NOT NULL DEFAULT 'normal',
            starts_at DATETIME NOT NULL,
            ends_at DATETIME NULL,
            all_day TINYINT(1) NOT NULL DEFAULT 0,
            location VARCHAR(190) NULL,
            source_module VARCHAR(80) NOT NULL DEFAULT 'Agenda',
            source_type VARCHAR(80) NOT NULL DEFAULT 'manual',
            source_id VARCHAR(160) NULL,
            created_by BIGINT UNSIGNED NULL,
            meetocean_room_id BIGINT UNSIGNED NULL,
            meetocean_join_url VARCHAR(500) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_agenda_events_start (starts_at),
            KEY idx_agenda_events_creator_start (created_by, starts_at),
            KEY idx_agenda_events_meetocean_room (meetocean_room_id),
            CONSTRAINT fk_agenda_events_creator FOREIGN KEY (created_by) REFERENCES oceanos_users(id) ON DELETE SET NULL,
            CONSTRAINT fk_agenda_events_meetocean_room FOREIGN KEY (meetocean_room_id) REFERENCES meetocean_rooms(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS agenda_event_attendees (
            event_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            response_status VARCHAR(24) NOT NULL DEFAULT 'needs_action',
            added_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (event_id, user_id),
            KEY idx_agenda_attendees_user (user_id, updated_at),
            CONSTRAINT fk_agenda_attendees_event FOREIGN KEY (event_id) REFERENCES agenda_events(id) ON DELETE CASCADE,
            CONSTRAINT fk_agenda_attendees_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE,
            CONSTRAINT fk_agenda_attendees_added_by FOREIGN KEY (added_by) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS agenda_user_settings (
            user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            settings_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_agenda_user_settings_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function agenda_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    if (!agenda_user_can_access($user)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Agenda n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function agenda_user_can_access(array $user): bool
{
    return in_array(AGENDA_MODULE_ID, oceanos_decode_visible_modules($user['visible_modules_json'] ?? null), true);
}

function agenda_user_has_module(array $user, string $moduleId): bool
{
    return in_array($moduleId, oceanos_decode_visible_modules($user['visible_modules_json'] ?? null), true);
}

function agenda_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function agenda_public_users(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT id, email, display_name, role, is_active, visible_modules_json, created_at
         FROM oceanos_users
         WHERE is_active = 1
         ORDER BY display_name ASC, email ASC'
    )->fetchAll();

    $rows = array_values(array_filter($rows, static fn(array $row): bool => agenda_user_can_access($row)));

    return array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'displayName' => (string) $row['display_name'],
        'role' => (string) $row['role'],
        'isActive' => (bool) $row['is_active'],
    ], $rows);
}

function agenda_settings_catalog(): array
{
    return [
        'Agenda' => [
            'moduleId' => 'agenda',
            'label' => 'Agenda',
            'types' => [
                'task' => 'Taches',
                'event' => 'Evenements',
                'meeting' => 'Reunions MeetOcean',
                'reminder' => 'Rappels',
            ],
        ],
        'Flowcean' => [
            'moduleId' => 'flowcean',
            'label' => 'Flowcean',
            'types' => [
                'todo_block' => 'Checklists',
                'database_row' => 'Lignes de tableau',
            ],
        ],
        'Mobywork' => [
            'moduleId' => 'mobywork',
            'label' => 'Mobywork',
            'types' => [
                'email' => 'Emails a traiter',
                'quote' => 'Devis a suivre',
            ],
        ],
        'Stockcean' => [
            'moduleId' => 'stockcean',
            'label' => 'Stockcean',
            'types' => [
                'purchase_order' => 'Commandes achat',
                'stock_alert' => 'Alertes stock',
            ],
        ],
        'Invocean' => [
            'moduleId' => 'invocean',
            'label' => 'Invocean',
            'types' => [
                'invoice' => 'Factures a suivre',
            ],
        ],
        'Nautisign' => [
            'moduleId' => 'nautisign',
            'label' => 'Nautisign',
            'types' => [
                'signature' => 'Signatures a relancer',
            ],
        ],
        'Formcean' => [
            'moduleId' => 'formcean',
            'label' => 'Formcean',
            'types' => [
                'form_draft' => 'Formulaires brouillons',
            ],
        ],
        'Naviplan' => [
            'moduleId' => 'naviplan',
            'label' => 'Naviplan',
            'types' => [
                'tax_deadline' => 'Echeances fiscales',
                'social_deadline' => 'Echeances sociales',
                'legal_deadline' => 'Echeances juridiques',
                'data_review' => 'Revues donnees',
            ],
        ],
    ];
}

function agenda_default_settings(): array
{
    $modules = [];
    foreach (agenda_settings_catalog() as $module => $definition) {
        $types = [];
        foreach (array_keys($definition['types']) as $type) {
            $types[$type] = true;
        }
        $modules[$module] = [
            'enabled' => true,
            'types' => $types,
        ];
    }

    return ['modules' => $modules];
}

function agenda_normalize_settings(mixed $settings): array
{
    $inputModules = is_array($settings) && is_array($settings['modules'] ?? null) ? $settings['modules'] : [];
    $normalized = agenda_default_settings();

    foreach (agenda_settings_catalog() as $module => $definition) {
        $incoming = is_array($inputModules[$module] ?? null) ? $inputModules[$module] : null;
        if ($incoming === null) {
            foreach ($inputModules as $key => $value) {
                if (strcasecmp((string) $key, (string) $module) === 0 && is_array($value)) {
                    $incoming = $value;
                    break;
                }
            }
        }
        if ($incoming === null) {
            continue;
        }

        $normalized['modules'][$module]['enabled'] = (bool) ($incoming['enabled'] ?? true);
        $inputTypes = is_array($incoming['types'] ?? null) ? $incoming['types'] : [];
        foreach (array_keys($definition['types']) as $type) {
            if (array_key_exists($type, $inputTypes)) {
                $normalized['modules'][$module]['types'][$type] = (bool) $inputTypes[$type];
            }
        }
    }

    return $normalized;
}

function agenda_store_settings(PDO $pdo, int $userId, array $settings): void
{
    if ($userId <= 0) {
        return;
    }

    $json = json_encode($settings, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('Parametres Agenda invalides.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO agenda_user_settings (user_id, settings_json)
         VALUES (:user_id, :settings_json)
         ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'settings_json' => $json,
    ]);
}

function agenda_settings(PDO $pdo, int $userId): array
{
    $default = agenda_default_settings();
    if ($userId <= 0) {
        return $default;
    }

    $statement = $pdo->prepare('SELECT settings_json FROM agenda_user_settings WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        agenda_store_settings($pdo, $userId, $default);
        return $default;
    }

    $decoded = json_decode((string) $row['settings_json'], true);
    return agenda_normalize_settings(is_array($decoded) ? $decoded : $default);
}

function agenda_save_settings(PDO $pdo, int $userId, mixed $settings): array
{
    $normalized = agenda_normalize_settings($settings);
    agenda_store_settings($pdo, $userId, $normalized);
    return $normalized;
}

function agenda_settings_module_enabled(?array $settings, string $module): bool
{
    if ($settings === null) {
        return true;
    }

    $moduleSettings = is_array($settings['modules'][$module] ?? null) ? $settings['modules'][$module] : null;
    return $moduleSettings === null || (bool) ($moduleSettings['enabled'] ?? true);
}

function agenda_settings_allows(?array $settings, string $module, string $type): bool
{
    if (!agenda_settings_module_enabled($settings, $module)) {
        return false;
    }
    if ($settings === null) {
        return true;
    }

    $moduleSettings = is_array($settings['modules'][$module] ?? null) ? $settings['modules'][$module] : null;
    $types = is_array($moduleSettings['types'] ?? null) ? $moduleSettings['types'] : [];
    return !array_key_exists($type, $types) || (bool) $types[$type];
}

function agenda_clean_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): string
{
    $text = trim(str_replace("\0", '', (string) $value));
    if ($singleLine) {
        $text = preg_replace('/\s+/u', ' ', $text) ?: '';
    }

    return mb_substr($text, 0, $maxLength);
}

function agenda_normalize_status(mixed $value): string
{
    $status = strtolower(trim((string) $value));
    return in_array($status, ['planned', 'done', 'cancelled'], true) ? $status : 'planned';
}

function agenda_normalize_category(mixed $value): string
{
    $category = strtolower(trim((string) $value));
    return in_array($category, ['task', 'event', 'meeting', 'reminder'], true) ? $category : 'task';
}

function agenda_normalize_priority(mixed $value): string
{
    $priority = strtolower(trim((string) $value));
    return in_array($priority, ['low', 'normal', 'high', 'urgent'], true) ? $priority : 'normal';
}

function agenda_datetime_from_input(mixed $value, bool $dateOnly = false): ?DateTimeImmutable
{
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    $text = str_replace('T', ' ', $text);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) {
        $text .= $dateOnly ? ' 00:00:00' : ' 09:00:00';
    } elseif (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $text)) {
        $text .= ':00';
    }

    try {
        return new DateTimeImmutable($text);
    } catch (Throwable) {
        return null;
    }
}

function agenda_sql_datetime(DateTimeImmutable $date): string
{
    return $date->format('Y-m-d H:i:s');
}

function agenda_parse_due_datetime(mixed $value): ?string
{
    $date = agenda_datetime_from_input($value);
    return $date !== null ? agenda_sql_datetime($date) : null;
}

function agenda_default_end(DateTimeImmutable $start, string $category, bool $allDay): ?DateTimeImmutable
{
    if ($allDay) {
        return null;
    }

    return $start->modify($category === 'meeting' ? '+1 hour' : '+30 minutes');
}

function agenda_normalize_attendee_ids(PDO $pdo, mixed $value, int $actorUserId): array
{
    $rawIds = is_array($value) ? $value : [];
    $ids = [];
    foreach ($rawIds as $rawId) {
        $id = (int) $rawId;
        if ($id > 0) {
            $ids[$id] = true;
        }
    }
    if ($actorUserId > 0) {
        $ids[$actorUserId] = true;
    }

    if ($ids === []) {
        return [];
    }

    $placeholders = [];
    $params = [];
    foreach (array_keys($ids) as $index => $id) {
        $key = 'id_' . $index;
        $placeholders[] = ':' . $key;
        $params[$key] = $id;
    }

    $statement = $pdo->prepare(
        'SELECT id, email, display_name, role, is_active, visible_modules_json, created_at
         FROM oceanos_users
         WHERE is_active = 1 AND id IN (' . implode(',', $placeholders) . ')'
    );
    $statement->execute($params);

    $rows = array_values(array_filter($statement->fetchAll(), static fn(array $row): bool => agenda_user_can_access($row)));

    return array_map(static fn(array $row): int => (int) $row['id'], $rows);
}

function agenda_normalize_event_input(PDO $pdo, array $input, array $actor, ?array $existing = null): array
{
    $title = agenda_clean_text($input['title'] ?? ($existing['title'] ?? ''), 190, true);
    if ($title === '') {
        throw new InvalidArgumentException('Le titre est obligatoire.');
    }

    $category = agenda_normalize_category($input['category'] ?? ($existing['category'] ?? 'task'));
    $createMeeting = array_key_exists('createMeeting', $input)
        ? (bool) $input['createMeeting']
        : ($category === 'meeting' && empty($existing['meetocean_room_id']));
    if ($createMeeting) {
        $category = 'meeting';
    }

    $allDay = array_key_exists('allDay', $input) ? (bool) $input['allDay'] : (bool) ($existing['all_day'] ?? false);
    $start = agenda_datetime_from_input($input['startsAt'] ?? $input['date'] ?? ($existing['starts_at'] ?? ''), $allDay);
    if ($start === null) {
        throw new InvalidArgumentException('Date de debut invalide.');
    }
    if ($allDay) {
        $start = $start->setTime(0, 0, 0);
    }

    $end = null;
    if (array_key_exists('endsAt', $input) || isset($existing['ends_at'])) {
        $end = agenda_datetime_from_input($input['endsAt'] ?? ($existing['ends_at'] ?? ''), $allDay);
    }
    if ($end !== null && $end <= $start) {
        $end = null;
    }
    if ($end === null) {
        $end = agenda_default_end($start, $category, $allDay);
    }

    return [
        'title' => $title,
        'description' => agenda_clean_text($input['description'] ?? ($existing['description'] ?? ''), 4000),
        'category' => $category,
        'status' => agenda_normalize_status($input['status'] ?? ($existing['status'] ?? 'planned')),
        'priority' => agenda_normalize_priority($input['priority'] ?? ($existing['priority'] ?? 'normal')),
        'startsAt' => agenda_sql_datetime($start),
        'endsAt' => $end !== null ? agenda_sql_datetime($end) : null,
        'allDay' => $allDay,
        'location' => agenda_clean_text($input['location'] ?? ($existing['location'] ?? ''), 190, true),
        'createMeeting' => $createMeeting,
        'attendeeUserIds' => agenda_normalize_attendee_ids(
            $pdo,
            $input['attendeeUserIds'] ?? $input['attendees'] ?? [],
            (int) $actor['id']
        ),
    ];
}

function agenda_save_attendees(PDO $pdo, int $eventId, array $attendeeUserIds, int $actorUserId): void
{
    $delete = $pdo->prepare('DELETE FROM agenda_event_attendees WHERE event_id = :event_id');
    $delete->execute(['event_id' => $eventId]);

    if ($attendeeUserIds === []) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO agenda_event_attendees (event_id, user_id, response_status, added_by)
         VALUES (:event_id, :user_id, :response_status, :added_by)'
    );
    foreach ($attendeeUserIds as $userId) {
        $insert->execute([
            'event_id' => $eventId,
            'user_id' => $userId,
            'response_status' => $userId === $actorUserId ? 'accepted' : 'needs_action',
            'added_by' => $actorUserId > 0 ? $actorUserId : null,
        ]);
    }
}

function agenda_notify_attendees(PDO $pdo, array $event, array $actor, string $type = 'event_invite'): void
{
    $attendees = agenda_event_attendees($pdo, (int) $event['id']);
    $joinUrl = agenda_meetocean_event_join_url($pdo, $event);
    foreach ($attendees as $attendee) {
        $userId = (int) $attendee['id'];
        if ($userId <= 0 || $userId === (int) $actor['id']) {
            continue;
        }

        $isMeeting = (string) ($event['category'] ?? '') === 'meeting';
        $title = $type === 'event_update' ? 'Evenement Agenda mis a jour' : 'Nouvel evenement Agenda';
        $body = (string) ($event['title'] ?? 'Evenement');
        if ($isMeeting && $joinUrl !== '') {
            $body .= ' - lien MeetOcean disponible.';
        }

        oceanos_create_notification(
            $pdo,
            $userId,
            (int) $actor['id'],
            'Agenda',
            $type,
            $isMeeting ? 'success' : 'info',
            $title,
            $body,
            '/Agenda/?event=' . (int) $event['id'],
            [
                'eventId' => (int) $event['id'],
                'startsAt' => (string) ($event['starts_at'] ?? ''),
                'meetOceanJoinUrl' => $joinUrl,
            ],
            'agenda_' . $type . '_' . (int) $event['id'] . '_' . $userId
        );
    }
}

function agenda_meetocean_internal_url(array $room): string
{
    $code = trim((string) ($room['slug'] ?? $room['code'] ?? ''));
    if ($code === '') {
        return '';
    }

    return '/MeetOcean/?' . http_build_query(['room' => $code]);
}

function agenda_meetocean_internal_url_from_room_id(PDO $pdo, ?int $roomId): string
{
    if ($roomId === null || $roomId <= 0) {
        return '';
    }

    $statement = $pdo->prepare('SELECT slug FROM meetocean_rooms WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $roomId]);
    $room = $statement->fetch();

    return is_array($room) ? agenda_meetocean_internal_url($room) : '';
}

function agenda_meetocean_event_join_url(PDO $pdo, array $event): string
{
    $roomUrl = agenda_meetocean_internal_url_from_room_id(
        $pdo,
        isset($event['meetocean_room_id']) ? (int) $event['meetocean_room_id'] : null
    );
    if ($roomUrl !== '') {
        return $roomUrl;
    }

    $storedUrl = trim((string) ($event['meetocean_join_url'] ?? ''));
    if ($storedUrl === '') {
        return '';
    }

    $parts = parse_url($storedUrl);
    if (is_array($parts) && isset($parts['query'])) {
        parse_str((string) $parts['query'], $query);
        $room = trim((string) ($query['room'] ?? $query['code'] ?? ''));
        if ($room !== '') {
            return '/MeetOcean/?' . http_build_query(['room' => $room]);
        }
    }

    return $storedUrl;
}

function agenda_create_event(PDO $pdo, array $actor, array $input): array
{
    $event = agenda_normalize_event_input($pdo, $input, $actor);
    $roomId = null;
    $joinUrl = null;

    $pdo->beginTransaction();
    try {
        if ($event['createMeeting']) {
            $room = meetocean_create_room($pdo, $actor, $event['title']);
            $roomId = (int) $room['id'];
            $joinUrl = agenda_meetocean_internal_url($room);
        }

        $insert = $pdo->prepare(
            'INSERT INTO agenda_events
                (title, description, category, status, priority, starts_at, ends_at, all_day, location, source_module, source_type, created_by, meetocean_room_id, meetocean_join_url)
             VALUES
                (:title, :description, :category, :status, :priority, :starts_at, :ends_at, :all_day, :location, :source_module, :source_type, :created_by, :meetocean_room_id, :meetocean_join_url)'
        );
        $insert->execute([
            'title' => $event['title'],
            'description' => $event['description'] !== '' ? $event['description'] : null,
            'category' => $event['category'],
            'status' => $event['status'],
            'priority' => $event['priority'],
            'starts_at' => $event['startsAt'],
            'ends_at' => $event['endsAt'],
            'all_day' => $event['allDay'] ? 1 : 0,
            'location' => $event['location'] !== '' ? $event['location'] : null,
            'source_module' => 'Agenda',
            'source_type' => $event['createMeeting'] ? 'meetocean_meeting' : 'manual',
            'created_by' => (int) $actor['id'],
            'meetocean_room_id' => $roomId,
            'meetocean_join_url' => $joinUrl,
        ]);

        $eventId = (int) $pdo->lastInsertId();
        agenda_save_attendees($pdo, $eventId, $event['attendeeUserIds'], (int) $actor['id']);
        $created = agenda_find_event($pdo, $eventId);
        agenda_notify_attendees($pdo, $created, $actor, 'event_invite');
        $pdo->commit();

        return agenda_public_event($pdo, $created);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function agenda_update_event(PDO $pdo, array $actor, array $input): array
{
    $eventId = (int) ($input['id'] ?? 0);
    $existing = agenda_find_event($pdo, $eventId);
    agenda_assert_can_manage_event($existing, $actor);
    $event = agenda_normalize_event_input($pdo, $input, $actor, $existing);

    $roomId = isset($existing['meetocean_room_id']) ? (int) $existing['meetocean_room_id'] : null;
    $joinUrl = $existing['meetocean_join_url'] ?? null;

    $pdo->beginTransaction();
    try {
        if ($event['createMeeting'] && $roomId === null) {
            $room = meetocean_create_room($pdo, $actor, $event['title']);
            $roomId = (int) $room['id'];
            $joinUrl = agenda_meetocean_internal_url($room);
        } elseif ($roomId !== null && $roomId > 0) {
            $joinUrl = agenda_meetocean_internal_url_from_room_id($pdo, $roomId) ?: $joinUrl;
        }

        $update = $pdo->prepare(
            'UPDATE agenda_events
             SET title = :title,
                 description = :description,
                 category = :category,
                 status = :status,
                 priority = :priority,
                 starts_at = :starts_at,
                 ends_at = :ends_at,
                 all_day = :all_day,
                 location = :location,
                 meetocean_room_id = :meetocean_room_id,
                 meetocean_join_url = :meetocean_join_url
             WHERE id = :id'
        );
        $update->execute([
            'id' => $eventId,
            'title' => $event['title'],
            'description' => $event['description'] !== '' ? $event['description'] : null,
            'category' => $event['category'],
            'status' => $event['status'],
            'priority' => $event['priority'],
            'starts_at' => $event['startsAt'],
            'ends_at' => $event['endsAt'],
            'all_day' => $event['allDay'] ? 1 : 0,
            'location' => $event['location'] !== '' ? $event['location'] : null,
            'meetocean_room_id' => $roomId,
            'meetocean_join_url' => $joinUrl,
        ]);

        agenda_save_attendees($pdo, $eventId, $event['attendeeUserIds'], (int) $actor['id']);
        $updated = agenda_find_event($pdo, $eventId);
        agenda_notify_attendees($pdo, $updated, $actor, 'event_update');
        $pdo->commit();

        return agenda_public_event($pdo, $updated);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

function agenda_delete_event(PDO $pdo, array $actor, int $eventId): void
{
    $event = agenda_find_event($pdo, $eventId);
    agenda_assert_can_manage_event($event, $actor);

    $statement = $pdo->prepare('DELETE FROM agenda_events WHERE id = :id');
    $statement->execute(['id' => $eventId]);
}

function agenda_set_event_status(PDO $pdo, array $actor, int $eventId, string $status): array
{
    $event = agenda_find_event($pdo, $eventId);
    agenda_assert_can_manage_event($event, $actor);

    $statement = $pdo->prepare('UPDATE agenda_events SET status = :status WHERE id = :id');
    $statement->execute([
        'id' => $eventId,
        'status' => agenda_normalize_status($status),
    ]);

    return agenda_public_event($pdo, agenda_find_event($pdo, $eventId));
}

function agenda_find_event(PDO $pdo, int $eventId): array
{
    if ($eventId <= 0) {
        throw new InvalidArgumentException('Evenement invalide.');
    }

    $statement = $pdo->prepare('SELECT * FROM agenda_events WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $eventId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Evenement introuvable.');
    }

    return $row;
}

function agenda_assert_can_manage_event(array $event, array $user): void
{
    if (agenda_is_admin($user) || (int) ($event['created_by'] ?? 0) === (int) ($user['id'] ?? 0)) {
        return;
    }

    throw new InvalidArgumentException('Vous ne pouvez pas modifier cet evenement.');
}

function agenda_event_attendees(PDO $pdo, int $eventId): array
{
    $statement = $pdo->prepare(
        'SELECT u.id, u.email, u.display_name, u.role, a.response_status
         FROM agenda_event_attendees a
         INNER JOIN oceanos_users u ON u.id = a.user_id
         WHERE a.event_id = :event_id
         ORDER BY u.display_name ASC, u.email ASC'
    );
    $statement->execute(['event_id' => $eventId]);

    return array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'displayName' => (string) $row['display_name'],
        'role' => (string) $row['role'],
        'responseStatus' => (string) $row['response_status'],
    ], $statement->fetchAll());
}

function agenda_public_event(PDO $pdo, array $event): array
{
    $attendees = agenda_event_attendees($pdo, (int) $event['id']);
    $meetOceanJoinUrl = agenda_meetocean_event_join_url($pdo, $event);

    return [
        'id' => (int) $event['id'],
        'uid' => 'agenda:' . (int) $event['id'],
        'kind' => 'agenda',
        'module' => 'Agenda',
        'sourceModule' => (string) ($event['source_module'] ?? 'Agenda'),
        'sourceType' => (string) ($event['source_type'] ?? 'manual'),
        'title' => (string) $event['title'],
        'description' => (string) ($event['description'] ?? ''),
        'category' => (string) ($event['category'] ?? 'task'),
        'status' => agenda_normalize_status($event['status'] ?? 'planned'),
        'priority' => agenda_normalize_priority($event['priority'] ?? 'normal'),
        'startsAt' => (string) $event['starts_at'],
        'endsAt' => $event['ends_at'] !== null ? (string) $event['ends_at'] : null,
        'allDay' => (bool) $event['all_day'],
        'location' => (string) ($event['location'] ?? ''),
        'meetOceanRoomId' => isset($event['meetocean_room_id']) ? (int) $event['meetocean_room_id'] : null,
        'meetOceanJoinUrl' => $meetOceanJoinUrl,
        'actionUrl' => '/Agenda/?event=' . (int) $event['id'],
        'attendees' => $attendees,
        'attendeeUserIds' => array_map(static fn(array $attendee): int => (int) $attendee['id'], $attendees),
        'createdBy' => isset($event['created_by']) ? (int) $event['created_by'] : null,
        'createdAt' => (string) ($event['created_at'] ?? ''),
        'updatedAt' => (string) ($event['updated_at'] ?? ''),
        'external' => false,
    ];
}

function agenda_list_events(PDO $pdo, array $user, ?array $settings = null): array
{
    if (!agenda_settings_module_enabled($settings, 'Agenda')) {
        return [];
    }

    $statement = $pdo->prepare(
        'SELECT DISTINCT e.*
         FROM agenda_events e
         LEFT JOIN agenda_event_attendees a ON a.event_id = e.id
         WHERE e.created_by = :user_id OR a.user_id = :user_id
         ORDER BY e.starts_at ASC, e.id ASC'
    );
    $statement->execute(['user_id' => (int) $user['id']]);

    $events = [];
    foreach ($statement->fetchAll() as $row) {
        $event = agenda_public_event($pdo, $row);
        if (agenda_settings_allows($settings, 'Agenda', (string) ($event['category'] ?? 'task'))) {
            $events[] = $event;
        }
    }

    return $events;
}

function agenda_external_task(
    string $module,
    string $sourceId,
    string $title,
    ?string $startsAt,
    string $description,
    string $priority,
    string $actionUrl,
    string $sourceType = 'task'
): array {
    return [
        'id' => $module . ':' . $sourceId,
        'uid' => strtolower($module) . ':' . $sourceId,
        'kind' => 'module_task',
        'module' => $module,
        'sourceModule' => $module,
        'sourceType' => $sourceType,
        'title' => $title,
        'description' => $description,
        'category' => 'task',
        'status' => 'planned',
        'priority' => agenda_normalize_priority($priority),
        'startsAt' => $startsAt,
        'endsAt' => null,
        'allDay' => true,
        'location' => '',
        'meetOceanRoomId' => null,
        'meetOceanJoinUrl' => '',
        'actionUrl' => $actionUrl,
        'attendees' => [],
        'attendeeUserIds' => [],
        'createdBy' => null,
        'createdAt' => '',
        'updatedAt' => '',
        'external' => true,
    ];
}

function agenda_collect_module_tasks(PDO $pdo, array $user, ?array $settings = null): array
{
    $tasks = [];
    if (agenda_user_has_module($user, 'flowcean') && agenda_settings_module_enabled($settings, 'Flowcean')) {
        $tasks = array_merge($tasks, agenda_collect_flowcean_tasks($pdo, $user));
    }
    if (agenda_user_has_module($user, 'mobywork') && agenda_settings_module_enabled($settings, 'Mobywork')) {
        $tasks = array_merge($tasks, agenda_collect_mobywork_tasks($pdo, $user));
    }
    if (agenda_user_has_module($user, 'stockcean') && agenda_settings_module_enabled($settings, 'Stockcean')) {
        $tasks = array_merge($tasks, agenda_collect_stockcean_tasks($pdo, $user));
    }
    if (agenda_user_has_module($user, 'invocean') && agenda_settings_module_enabled($settings, 'Invocean')) {
        $tasks = array_merge($tasks, agenda_collect_invocean_tasks($pdo));
    }
    if (agenda_user_has_module($user, 'nautisign') && agenda_settings_module_enabled($settings, 'Nautisign')) {
        $tasks = array_merge($tasks, agenda_collect_nautisign_tasks($pdo, $user));
    }
    if (agenda_user_has_module($user, 'formcean') && agenda_settings_module_enabled($settings, 'Formcean')) {
        $tasks = array_merge($tasks, agenda_collect_formcean_tasks($pdo, $user));
    }
    if (agenda_user_has_module($user, 'naviplan') && agenda_settings_module_enabled($settings, 'Naviplan')) {
        $tasks = array_merge($tasks, agenda_collect_naviplan_tasks($pdo));
    }

    $tasks = array_values(array_filter($tasks, static fn(array $task): bool => agenda_settings_allows(
        $settings,
        (string) ($task['module'] ?? ''),
        (string) ($task['sourceType'] ?? 'task')
    )));

    usort($tasks, static function (array $a, array $b): int {
        $left = (string) ($a['startsAt'] ?? '9999-12-31 23:59:59');
        $right = (string) ($b['startsAt'] ?? '9999-12-31 23:59:59');
        if ($left === '') {
            $left = '9999-12-31 23:59:59';
        }
        if ($right === '') {
            $right = '9999-12-31 23:59:59';
        }
        return strcmp($left, $right) ?: strcmp((string) $a['title'], (string) $b['title']);
    });

    return array_slice($tasks, 0, 240);
}

function agenda_collect_flowcean_tasks(PDO $pdo, array $user): array
{
    if (!oceanos_table_exists($pdo, 'flowcean_workspaces')) {
        return [];
    }

    $deletedWhere = oceanos_column_exists($pdo, 'flowcean_workspaces', 'deleted_at') ? ' AND w.deleted_at IS NULL' : '';
    if ((string) ($user['role'] ?? '') === 'super') {
        $statement = $pdo->prepare('SELECT w.id, w.slug, w.name, w.data_json, w.updated_at FROM flowcean_workspaces w WHERE 1=1' . $deletedWhere . ' ORDER BY w.updated_at DESC LIMIT 30');
        $statement->execute();
    } elseif (oceanos_table_exists($pdo, 'flowcean_workspace_members')) {
        $statement = $pdo->prepare(
            'SELECT DISTINCT w.id, w.slug, w.name, w.data_json, w.updated_at
             FROM flowcean_workspaces w
             LEFT JOIN flowcean_workspace_members wm ON wm.workspace_id = w.id
             WHERE (w.owner_user_id = :user_id OR wm.user_id = :user_id)' . $deletedWhere . '
             ORDER BY w.updated_at DESC
             LIMIT 30'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
    } else {
        $statement = $pdo->prepare(
            'SELECT w.id, w.slug, w.name, w.data_json, w.updated_at
             FROM flowcean_workspaces w
             WHERE w.owner_user_id = :user_id' . $deletedWhere . '
             ORDER BY w.updated_at DESC
             LIMIT 30'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
    }

    $tasks = [];
    foreach ($statement->fetchAll() as $workspace) {
        $state = json_decode((string) $workspace['data_json'], true);
        if (!is_array($state) || !is_array($state['pages'] ?? null)) {
            continue;
        }
        foreach ($state['pages'] as $page) {
            if (!is_array($page) || !empty($page['deletedAt'])) {
                continue;
            }
            $pageTitle = agenda_clean_text($page['title'] ?? 'Page Flowcean', 120, true);
            foreach (($page['blocks'] ?? []) as $block) {
                if (!is_array($block) || ($block['type'] ?? '') !== 'todo' || !empty($block['checked'])) {
                    continue;
                }
                $title = agenda_clean_text($block['text'] ?? '', 190, true);
                if ($title === '') {
                    continue;
                }
                $tasks[] = agenda_external_task(
                    'Flowcean',
                    (string) $workspace['id'] . ':block:' . (string) ($block['id'] ?? count($tasks)),
                    $title,
                    null,
                    (string) $workspace['name'] . ' / ' . $pageTitle,
                    'normal',
                    '/Flowcean/',
                    'todo_block'
                );
            }
            foreach (agenda_flowcean_database_tasks($workspace, $page) as $task) {
                $tasks[] = $task;
            }
        }
    }

    return array_slice($tasks, 0, 80);
}

function agenda_flowcean_database_tasks(array $workspace, array $page): array
{
    $database = is_array($page['database'] ?? null) ? $page['database'] : null;
    if ($database === null || !is_array($database['rows'] ?? null) || !is_array($database['properties'] ?? null)) {
        return [];
    }

    $properties = [];
    foreach ($database['properties'] as $property) {
        if (is_array($property) && isset($property['id'])) {
            $properties[(string) $property['id']] = $property;
        }
    }

    $tasks = [];
    foreach ($database['rows'] as $row) {
        if (!is_array($row) || !is_array($row['cells'] ?? null)) {
            continue;
        }
        $cells = $row['cells'];
        if (agenda_flowcean_row_done($cells, $properties)) {
            continue;
        }
        $title = agenda_flowcean_row_title($cells, $properties);
        if ($title === '') {
            continue;
        }
        $startsAt = agenda_flowcean_row_date($cells, $properties);
        $priority = agenda_flowcean_row_priority($cells, $properties);
        $tasks[] = agenda_external_task(
            'Flowcean',
            (string) $workspace['id'] . ':row:' . (string) ($row['id'] ?? count($tasks)),
            $title,
            $startsAt,
            (string) $workspace['name'] . ' / ' . agenda_clean_text($page['title'] ?? 'Tableau', 120, true),
            $priority,
            '/Flowcean/',
            'database_row'
        );
    }

    return $tasks;
}

function agenda_flowcean_row_title(array $cells, array $properties): string
{
    $preferred = ['tache', 'task', 'nom', 'name', 'titre', 'title'];
    foreach ($properties as $id => $property) {
        $name = agenda_ascii_key($property['name'] ?? '');
        if (in_array($name, $preferred, true)) {
            $value = agenda_clean_text($cells[$id] ?? '', 190, true);
            if ($value !== '') {
                return $value;
            }
        }
    }
    foreach ($cells as $value) {
        $text = agenda_clean_text(is_scalar($value) ? $value : '', 190, true);
        if ($text !== '') {
            return $text;
        }
    }

    return '';
}

function agenda_flowcean_row_date(array $cells, array $properties): ?string
{
    foreach ($properties as $id => $property) {
        $name = agenda_ascii_key($property['name'] ?? '');
        $type = strtolower((string) ($property['type'] ?? ''));
        if ($type === 'date' || in_array($name, ['date', 'debut', 'fin', 'echeance', 'deadline', 'due'], true)) {
            $date = agenda_parse_due_datetime($cells[$id] ?? '');
            if ($date !== null) {
                return $date;
            }
        }
    }

    return null;
}

function agenda_flowcean_row_done(array $cells, array $properties): bool
{
    foreach ($properties as $id => $property) {
        $type = strtolower((string) ($property['type'] ?? ''));
        $name = agenda_ascii_key($property['name'] ?? '');
        $value = $cells[$id] ?? null;
        if ($type === 'checkbox' && (bool) $value) {
            return true;
        }
        if (in_array($name, ['statut', 'status', 'etat'], true) && agenda_status_is_done((string) $value)) {
            return true;
        }
    }

    return false;
}

function agenda_flowcean_row_priority(array $cells, array $properties): string
{
    foreach ($properties as $id => $property) {
        $name = agenda_ascii_key($property['name'] ?? '');
        if (in_array($name, ['priorite', 'priority'], true)) {
            return agenda_priority_from_text((string) ($cells[$id] ?? 'normal'));
        }
        if (in_array($name, ['bloquant', 'blocked', 'blocker'], true) && !empty($cells[$id])) {
            return 'high';
        }
    }

    return 'normal';
}

function agenda_collect_mobywork_tasks(PDO $pdo, array $user): array
{
    $tasks = [];
    if (oceanos_table_exists($pdo, 'mobywork_emails')) {
        $statement = $pdo->prepare(
            "SELECT id, subject, from_address, status, priorite, due_date, date_reception
             FROM mobywork_emails
             WHERE user_id = :user_id
               AND LOWER(COALESCE(status, '')) NOT IN ('traite', 'termine', 'archive', 'done', 'repondu', 'clos', 'closed')
             ORDER BY COALESCE(date_reception, NOW()) DESC
             LIMIT 50"
        );
        $statement->execute(['user_id' => (int) $user['id']]);
        foreach ($statement->fetchAll() as $row) {
            $subject = agenda_clean_text($row['subject'] ?? 'Email a traiter', 160, true);
            $tasks[] = agenda_external_task(
                'Mobywork',
                'email:' . (int) $row['id'],
                'Repondre: ' . ($subject !== '' ? $subject : 'Email'),
                agenda_parse_due_datetime($row['due_date'] ?? '') ?? agenda_parse_due_datetime($row['date_reception'] ?? ''),
                agenda_clean_text($row['from_address'] ?? '', 240, true),
                agenda_priority_from_text((string) ($row['priorite'] ?? 'normal')),
                '/Mobywork/',
                'email'
            );
        }
    }

    if (oceanos_table_exists($pdo, 'mobywork_quotes')) {
        $statement = $pdo->prepare(
            "SELECT id, reference, client_name, status, date_updated
             FROM mobywork_quotes
             WHERE user_id = :user_id
               AND LOWER(COALESCE(status, '')) NOT IN ('accepte', 'signe', 'annule', 'refuse')
             ORDER BY date_updated DESC
             LIMIT 30"
        );
        $statement->execute(['user_id' => (int) $user['id']]);
        foreach ($statement->fetchAll() as $row) {
            $label = agenda_clean_text($row['reference'] ?? '', 100, true);
            $client = agenda_clean_text($row['client_name'] ?? '', 120, true);
            $tasks[] = agenda_external_task(
                'Mobywork',
                'quote:' . (int) $row['id'],
                'Suivre le devis ' . ($label !== '' ? $label : '#' . (int) $row['id']),
                agenda_parse_due_datetime($row['date_updated'] ?? ''),
                $client,
                'normal',
                '/Mobywork/',
                'quote'
            );
        }
    }

    return $tasks;
}

function agenda_collect_stockcean_tasks(PDO $pdo, array $user): array
{
    $tasks = [];
    if (oceanos_table_exists($pdo, 'stockcean_purchase_orders')) {
        $query = "SELECT po.id, po.order_number, po.status, po.expected_at, s.name AS supplier_name
                  FROM stockcean_purchase_orders po
                  LEFT JOIN stockcean_suppliers s ON s.id = po.supplier_id
                  WHERE po.status NOT IN ('received', 'cancelled')";
        $params = [];
        if (!agenda_is_admin($user) && oceanos_column_exists($pdo, 'stockcean_purchase_orders', 'user_id')) {
            $query .= ' AND (po.user_id = :user_id OR po.user_id IS NULL)';
            $params['user_id'] = (int) $user['id'];
        }
        $query .= ' ORDER BY po.expected_at IS NULL, po.expected_at ASC, po.updated_at DESC LIMIT 50';
        $statement = $pdo->prepare($query);
        $statement->execute($params);
        foreach ($statement->fetchAll() as $row) {
            $tasks[] = agenda_external_task(
                'Stockcean',
                'purchase:' . (int) $row['id'],
                'Reception achat ' . agenda_clean_text($row['order_number'] ?? ('#' . (int) $row['id']), 90, true),
                agenda_parse_due_datetime($row['expected_at'] ?? ''),
                agenda_clean_text($row['supplier_name'] ?? '', 190, true),
                (string) ($row['status'] ?? '') === 'ordered' ? 'high' : 'normal',
                '/Stockcean/',
                'purchase_order'
            );
        }
    }

    if (oceanos_table_exists($pdo, 'stockcean_products')) {
        $statement = $pdo->query(
            'SELECT id, reference, name, quantity, min_stock_alert
             FROM stockcean_products
             WHERE active = 1 AND quantity <= min_stock_alert
             ORDER BY quantity ASC, name ASC
             LIMIT 40'
        );
        foreach ($statement->fetchAll() as $row) {
            $tasks[] = agenda_external_task(
                'Stockcean',
                'stock:' . (int) $row['id'],
                'Reapprovisionner ' . agenda_clean_text($row['name'] ?? 'Produit', 150, true),
                null,
                'Stock actuel: ' . (int) $row['quantity'] . ' / seuil: ' . (int) $row['min_stock_alert'],
                (int) $row['quantity'] <= 0 ? 'urgent' : 'high',
                '/Stockcean/',
                'stock_alert'
            );
        }
    }

    return $tasks;
}

function agenda_collect_invocean_tasks(PDO $pdo): array
{
    if (!oceanos_table_exists($pdo, 'invocean_invoices')) {
        return [];
    }

    $statement = $pdo->query(
        "SELECT id, invoice_number, order_reference, customer_name, status, invoice_date
         FROM invocean_invoices
         WHERE status NOT IN ('accepted', 'archived')
         ORDER BY invoice_date IS NULL, invoice_date ASC, updated_at DESC
         LIMIT 60"
    );

    $tasks = [];
    foreach ($statement->fetchAll() as $row) {
        $number = agenda_clean_text($row['invoice_number'] ?? $row['order_reference'] ?? ('#' . (int) $row['id']), 120, true);
        $tasks[] = agenda_external_task(
            'Invocean',
            'invoice:' . (int) $row['id'],
            'Suivre facture ' . $number,
            agenda_parse_due_datetime($row['invoice_date'] ?? ''),
            agenda_clean_text($row['customer_name'] ?? '', 190, true),
            in_array((string) ($row['status'] ?? ''), ['rejected', 'received'], true) ? 'high' : 'normal',
            '/Invocean/',
            'invoice'
        );
    }

    return $tasks;
}

function agenda_collect_nautisign_tasks(PDO $pdo, array $user): array
{
    if (!oceanos_table_exists($pdo, 'nautisign_requests')) {
        return [];
    }

    $query = "SELECT id, quote_filename, status, signer_name, signer_email, expires_at
              FROM nautisign_requests
              WHERE LOWER(COALESCE(status, 'pending')) IN ('pending', 'sent', 'opened')";
    $params = [];
    if (!agenda_is_admin($user)) {
        $query .= ' AND owner_user_id = :user_id';
        $params['user_id'] = (int) $user['id'];
    }
    $query .= ' ORDER BY expires_at IS NULL, expires_at ASC, updated_at DESC LIMIT 50';
    $statement = $pdo->prepare($query);
    $statement->execute($params);

    $tasks = [];
    foreach ($statement->fetchAll() as $row) {
        $tasks[] = agenda_external_task(
            'Nautisign',
            'request:' . (int) $row['id'],
            'Relancer signature ' . agenda_clean_text($row['quote_filename'] ?? ('#' . (int) $row['id']), 140, true),
            agenda_parse_due_datetime($row['expires_at'] ?? ''),
            agenda_clean_text(($row['signer_name'] ?? '') . ' ' . ($row['signer_email'] ?? ''), 220, true),
            'high',
            '/Nautisign/',
            'signature'
        );
    }

    return $tasks;
}

function agenda_collect_formcean_tasks(PDO $pdo, array $user): array
{
    if (!oceanos_table_exists($pdo, 'formcean_forms')) {
        return [];
    }

    $query = "SELECT id, title, status, updated_at
              FROM formcean_forms
              WHERE status = 'draft'";
    $params = [];
    if (!agenda_is_admin($user)) {
        $query .= ' AND owner_user_id = :user_id';
        $params['user_id'] = (int) $user['id'];
    }
    $query .= ' ORDER BY updated_at DESC LIMIT 30';
    $statement = $pdo->prepare($query);
    $statement->execute($params);

    $tasks = [];
    foreach ($statement->fetchAll() as $row) {
        $tasks[] = agenda_external_task(
            'Formcean',
            'form:' . (int) $row['id'],
            'Finaliser formulaire ' . agenda_clean_text($row['title'] ?? ('#' . (int) $row['id']), 140, true),
            agenda_parse_due_datetime($row['updated_at'] ?? ''),
            'Brouillon Formcean',
            'normal',
            '/Formcean/',
            'form_draft'
        );
    }

    return $tasks;
}

function agenda_collect_naviplan_tasks(PDO $pdo): array
{
    if (!oceanos_table_exists($pdo, 'naviplan_settings')) {
        return [];
    }

    $row = $pdo->query('SELECT settings_json FROM naviplan_settings WHERE id = 1 LIMIT 1')->fetch();
    $settings = is_array($row) ? json_decode((string) $row['settings_json'], true) : [];
    if (!is_array($settings)) {
        $settings = [];
    }

    $today = new DateTimeImmutable('today');
    $year = (int) $today->format('Y');
    $profiles = is_array($settings['activeProfiles'] ?? null) ? $settings['activeProfiles'] : [];
    $options = is_array($settings['options'] ?? null) ? $settings['options'] : [];
    $tasks = [];

    if (in_array('tva', $profiles, true) && !in_array((string) ($settings['tvaRegime'] ?? ''), ['franchise', 'exempt'], true)) {
        $months = (string) ($settings['tvaRegime'] ?? '') === 'normal_quarterly' ? [4, 7, 10, 1] : range(1, 12);
        foreach ($months as $month) {
            $taskYear = $month === 1 && (string) ($settings['tvaRegime'] ?? '') === 'normal_quarterly' ? $year + 1 : $year;
            $date = sprintf('%04d-%02d-20 09:00:00', $taskYear, $month);
            $tasks[] = agenda_external_task('Naviplan', 'tva:' . $taskYear . ':' . $month, 'Declaration TVA', $date, 'Echeance administrative Naviplan', 'high', '/Naviplan/', 'tax_deadline');
        }
    }

    if (in_array('employer', $profiles, true) && (string) ($settings['staffRange'] ?? 'none') !== 'none') {
        for ($month = 1; $month <= 12; $month++) {
            $date = sprintf('%04d-%02d-15 09:00:00', $year, $month);
            $tasks[] = agenda_external_task('Naviplan', 'dsn:' . $year . ':' . $month, 'DSN mensuelle', $date, 'Declaration sociale nominative', 'high', '/Naviplan/', 'social_deadline');
        }
    }

    if (!empty($options['cfe']) || in_array('local', $profiles, true)) {
        $tasks[] = agenda_external_task('Naviplan', 'cfe-acompte:' . $year, 'Acompte CFE', sprintf('%04d-06-15 09:00:00', $year), 'Cotisation fonciere des entreprises', 'normal', '/Naviplan/', 'tax_deadline');
        $tasks[] = agenda_external_task('Naviplan', 'cfe-solde:' . $year, 'Solde CFE', sprintf('%04d-12-15 09:00:00', $year), 'Cotisation fonciere des entreprises', 'high', '/Naviplan/', 'tax_deadline');
    }

    if (!empty($options['companyAccounts']) || in_array('legal', $profiles, true)) {
        $closing = agenda_datetime_from_input($settings['closingDate'] ?? ($year - 1) . '-12-31', true);
        if ($closing !== null) {
            $deposit = $closing->modify('+6 months');
            $tasks[] = agenda_external_task('Naviplan', 'accounts:' . $deposit->format('Y'), 'Depot des comptes annuels', agenda_sql_datetime($deposit->setTime(9, 0)), 'Echeance juridique Naviplan', 'high', '/Naviplan/', 'legal_deadline');
        }
    }

    if (!empty($options['rgpd']) || in_array('data', $profiles, true)) {
        $tasks[] = agenda_external_task('Naviplan', 'rgpd:' . $year, 'Revue RGPD annuelle', sprintf('%04d-12-01 09:00:00', $year), 'Registre des traitements et donnees personnelles', 'normal', '/Naviplan/', 'data_review');
    }

    return array_values(array_filter($tasks, static function (array $task) use ($today): bool {
        $startsAt = agenda_datetime_from_input($task['startsAt'] ?? '');
        return $startsAt === null || $startsAt >= $today->modify('-30 days');
    }));
}

function agenda_ascii_key(mixed $value): string
{
    $text = mb_strtolower(trim((string) $value));
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if (is_string($ascii) && trim($ascii) !== '') {
        $text = $ascii;
    }
    return preg_replace('/[^a-z0-9]+/', '', $text) ?: '';
}

function agenda_status_is_done(string $value): bool
{
    $key = agenda_ascii_key($value);
    return in_array($key, ['termine', 'fait', 'done', 'complete', 'completed', 'archive', 'annule', 'cancelled', 'lance'], true);
}

function agenda_priority_from_text(string $value): string
{
    $key = agenda_ascii_key($value);
    if (in_array($key, ['urgent', 'critique', 'critical', 'bloque', 'blocked'], true)) {
        return 'urgent';
    }
    if (in_array($key, ['haute', 'high', 'important'], true)) {
        return 'high';
    }
    if (in_array($key, ['basse', 'low'], true)) {
        return 'low';
    }

    return 'normal';
}

function agenda_dashboard(PDO $pdo, array $user): array
{
    $settings = agenda_settings($pdo, (int) ($user['id'] ?? 0));
    $events = agenda_list_events($pdo, $user, $settings);
    $moduleTasks = agenda_collect_module_tasks($pdo, $user, $settings);
    $feed = array_merge($events, $moduleTasks);
    usort($feed, static function (array $a, array $b): int {
        $left = (string) ($a['startsAt'] ?? '9999-12-31 23:59:59');
        $right = (string) ($b['startsAt'] ?? '9999-12-31 23:59:59');
        if ($left === '') {
            $left = '9999-12-31 23:59:59';
        }
        if ($right === '') {
            $right = '9999-12-31 23:59:59';
        }
        return strcmp($left, $right) ?: strcmp((string) ($a['module'] ?? ''), (string) ($b['module'] ?? ''));
    });

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'currentUser' => oceanos_public_user($user),
        'canManage' => agenda_is_admin($user),
        'users' => agenda_public_users($pdo),
        'settings' => $settings,
        'settingsCatalog' => agenda_settings_catalog(),
        'events' => $events,
        'moduleTasks' => $moduleTasks,
        'items' => $feed,
    ];
}
