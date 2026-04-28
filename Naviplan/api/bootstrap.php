<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const NAVIPLAN_MODULE_ID = 'naviplan';

function naviplan_pdo(): PDO
{
    $pdo = oceanos_pdo();
    naviplan_ensure_schema($pdo);
    return $pdo;
}

function naviplan_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS naviplan_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            settings_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function naviplan_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(NAVIPLAN_MODULE_ID, $visibleModules, true)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Naviplan n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function naviplan_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function naviplan_defaults(PDO $pdo): array
{
    return [
        'legalForm' => 'sas',
        'taxRegime' => 'is',
        'tvaRegime' => 'normal_monthly',
        'staffRange' => 'under50',
        'payrollFrequency' => 'monthly',
        'closingDate' => '2025-12-31',
        'activeProfiles' => ['fiscal', 'tva', 'employer', 'local', 'legal', 'hr', 'data'],
        'options' => [
            'cfe' => true,
            'cvae' => false,
            'intraEu' => false,
            'rcm' => true,
            'taxOnSalaries' => false,
            'apprenticeshipTax' => true,
            'doeth' => false,
            'companyAccounts' => true,
            'rgpd' => true,
            'electronicInvoicing' => true,
            'vehicles' => false,
            'heavyVehicles' => false,
            'insuranceTax' => false,
            'energyAccises' => false,
        ],
        'notificationUserIds' => oceanos_active_user_ids($pdo, ['super', 'admin']),
        'notificationLeadDays' => [30],
    ];
}

function naviplan_decode_settings(?string $json): array
{
    $decoded = json_decode((string) $json, true);
    return is_array($decoded) ? $decoded : [];
}

function naviplan_bool(array $source, string $key, bool $fallback): bool
{
    return array_key_exists($key, $source) ? (bool) $source[$key] : $fallback;
}

function naviplan_normalize_lead_days(mixed $value, array $fallback): array
{
    $values = is_array($value) ? $value : [$value];
    $days = [];
    foreach ($values as $rawValue) {
        if (!is_scalar($rawValue)) {
            continue;
        }
        $day = (int) $rawValue;
        if ($day >= 1 && $day <= 120) {
            $days[] = $day;
        }
    }

    $days = array_values(array_unique($days));
    rsort($days, SORT_NUMERIC);

    return $days !== [] ? $days : $fallback;
}

function naviplan_normalize_settings(PDO $pdo, array $input): array
{
    $defaults = naviplan_defaults($pdo);

    $legalForms = ['micro', 'ei', 'eurl', 'sarl', 'sasu', 'sas', 'sci', 'association'];
    $taxRegimes = ['ir', 'is'];
    $tvaRegimes = ['franchise', 'normal_monthly', 'normal_quarterly', 'simplified', 'exempt'];
    $staffRanges = ['none', 'under11', 'under50', 'over50'];
    $payrollFrequencies = ['monthly', 'quarterly'];
    $profiles = ['fiscal', 'tva', 'employer', 'local', 'legal', 'hr', 'data', 'sector'];

    $legalForm = strtolower(trim((string) ($input['legalForm'] ?? $defaults['legalForm'])));
    $taxRegime = strtolower(trim((string) ($input['taxRegime'] ?? $defaults['taxRegime'])));
    $tvaRegime = strtolower(trim((string) ($input['tvaRegime'] ?? $defaults['tvaRegime'])));
    $staffRange = strtolower(trim((string) ($input['staffRange'] ?? $defaults['staffRange'])));
    $payrollFrequency = strtolower(trim((string) ($input['payrollFrequency'] ?? $defaults['payrollFrequency'])));
    $closingDate = trim((string) ($input['closingDate'] ?? $defaults['closingDate']));

    if (!in_array($legalForm, $legalForms, true)) {
        $legalForm = $defaults['legalForm'];
    }
    if (!in_array($taxRegime, $taxRegimes, true)) {
        $taxRegime = $defaults['taxRegime'];
    }
    if (!in_array($tvaRegime, $tvaRegimes, true)) {
        $tvaRegime = $defaults['tvaRegime'];
    }
    if (!in_array($staffRange, $staffRanges, true)) {
        $staffRange = $defaults['staffRange'];
    }
    if (!in_array($payrollFrequency, $payrollFrequencies, true)) {
        $payrollFrequency = $defaults['payrollFrequency'];
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $closingDate)) {
        $closingDate = $defaults['closingDate'];
    }

    $activeProfiles = $input['activeProfiles'] ?? $defaults['activeProfiles'];
    if (!is_array($activeProfiles)) {
        $activeProfiles = $defaults['activeProfiles'];
    }
    $activeProfiles = array_values(array_intersect($profiles, array_map(static fn($value): string => strtolower(trim((string) $value)), $activeProfiles)));
    if ($activeProfiles === []) {
        $activeProfiles = $defaults['activeProfiles'];
    }

    $inputOptions = is_array($input['options'] ?? null) ? $input['options'] : [];
    $options = [];
    foreach ($defaults['options'] as $key => $fallback) {
        $options[$key] = naviplan_bool($inputOptions, $key, (bool) $fallback);
    }

    $activeUserIds = oceanos_active_user_ids($pdo);
    $notificationUserIds = $input['notificationUserIds'] ?? $defaults['notificationUserIds'];
    if (!is_array($notificationUserIds)) {
        $notificationUserIds = [];
    }
    $notificationUserIds = array_values(array_intersect(
        $activeUserIds,
        array_values(array_unique(array_map(static fn($value): int => (int) $value, $notificationUserIds)))
    ));

    $notificationLeadDays = naviplan_normalize_lead_days(
        $input['notificationLeadDays'] ?? $defaults['notificationLeadDays'],
        $defaults['notificationLeadDays']
    );

    return [
        'legalForm' => $legalForm,
        'taxRegime' => $taxRegime,
        'tvaRegime' => $tvaRegime,
        'staffRange' => $staffRange,
        'payrollFrequency' => $payrollFrequency,
        'closingDate' => $closingDate,
        'activeProfiles' => $activeProfiles,
        'options' => $options,
        'notificationUserIds' => $notificationUserIds,
        'notificationLeadDays' => $notificationLeadDays,
    ];
}

function naviplan_settings(PDO $pdo): array
{
    $defaults = naviplan_defaults($pdo);
    $statement = $pdo->prepare(
        'INSERT IGNORE INTO naviplan_settings (id, settings_json)
         VALUES (1, :settings_json)'
    );
    $statement->execute([
        'settings_json' => json_encode($defaults, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $row = $pdo->query('SELECT settings_json FROM naviplan_settings WHERE id = 1 LIMIT 1')->fetch();
    return naviplan_normalize_settings($pdo, naviplan_decode_settings(is_array($row) ? (string) $row['settings_json'] : null));
}

function naviplan_save_settings(PDO $pdo, array $settings): array
{
    $settings = naviplan_normalize_settings($pdo, $settings);
    $statement = $pdo->prepare(
        'INSERT INTO naviplan_settings (id, settings_json)
         VALUES (1, :settings_json)
         ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'settings_json' => json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    return $settings;
}

function naviplan_public_users(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT id, email, display_name, role, is_active
         FROM oceanos_users
         WHERE is_active = 1
         ORDER BY display_name ASC, email ASC'
    )->fetchAll();

    return array_map(static fn(array $row): array => [
        'id' => (int) $row['id'],
        'email' => (string) $row['email'],
        'displayName' => (string) $row['display_name'],
        'role' => (string) $row['role'],
        'isActive' => (bool) $row['is_active'],
    ], $rows);
}

function naviplan_clean_event(array $input): array
{
    $date = trim((string) ($input['date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new InvalidArgumentException('Date de notification invalide.');
    }

    return [
        'id' => mb_substr(preg_replace('/[^a-zA-Z0-9_.:-]/', '', (string) ($input['id'] ?? 'event')) ?: 'event', 0, 80),
        'date' => $date,
        'title' => mb_substr(trim((string) ($input['title'] ?? 'Echeance Naviplan')), 0, 160),
        'summary' => mb_substr(trim((string) ($input['summary'] ?? '')), 0, 600),
        'priority' => in_array((string) ($input['priority'] ?? 'normal'), ['critical', 'high', 'normal'], true)
            ? (string) $input['priority']
            : 'normal',
        'sourceUrl' => mb_substr(trim((string) ($input['sourceUrl'] ?? '/Naviplan/')), 0, 500),
        'reminderDays' => max(0, min(120, (int) ($input['reminderDays'] ?? 0))),
        'daysUntil' => max(0, min(366, (int) ($input['daysUntil'] ?? 0))),
    ];
}

function naviplan_notify(PDO $pdo, array $actor, array $input): array
{
    $settings = naviplan_settings($pdo);
    $recipients = $settings['notificationUserIds'];
    if ($recipients === []) {
        throw new InvalidArgumentException('Aucun destinataire Naviplan n est configure.');
    }

    $events = $input['events'] ?? [];
    if (!is_array($events) || $events === []) {
        throw new InvalidArgumentException('Aucune echeance a notifier.');
    }

    $limit = max(1, min(40, (int) ($input['limit'] ?? 12)));
    $events = array_slice($events, 0, $limit);
    $created = 0;
    $severityMap = ['critical' => 'danger', 'high' => 'warning', 'normal' => 'info'];

    foreach ($events as $rawEvent) {
        if (!is_array($rawEvent)) {
            continue;
        }
        $event = naviplan_clean_event($rawEvent);
        $reminderLabel = $event['reminderDays'] > 0 ? 'Rappel J-' . $event['reminderDays'] : 'Rappel Naviplan';
        $daysUntilLabel = $event['daysUntil'] === 0 ? 'aujourd hui' : 'dans ' . $event['daysUntil'] . ' jour(s)';
        $body = $event['summary'] !== ''
            ? $reminderLabel . ' - ' . $event['summary'] . ' Echeance ' . $daysUntilLabel . ' : ' . $event['date'] . '.'
            : $reminderLabel . ' - Echeance ' . $daysUntilLabel . ' : ' . $event['date'] . '.';
        foreach ($recipients as $userId) {
            oceanos_create_notification(
                $pdo,
                (int) $userId,
                (int) $actor['id'],
                'Naviplan',
                'naviplan.deadline',
                $severityMap[$event['priority']] ?? 'info',
                $event['title'],
                $body,
                '/Naviplan/',
                $event,
                'naviplan:' . $event['id'] . ':' . $event['date'] . ':j-' . $event['reminderDays']
            );
            $created++;
        }
    }

    return [
        'recipientCount' => count($recipients),
        'eventCount' => count($events),
        'notificationCount' => $created,
    ];
}
