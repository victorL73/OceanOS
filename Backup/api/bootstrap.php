<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const BACKUP_MODULE_VERSION = '20260502';
const BACKUP_DEFAULT_RETENTION_COUNT = 12;

function backup_www_root(): string
{
    return dirname(__DIR__, 2);
}

function backup_module_path(string ...$parts): string
{
    $path = dirname(__DIR__);
    foreach ($parts as $part) {
        $path .= DIRECTORY_SEPARATOR . $part;
    }

    return $path;
}

function backup_storage_path(string ...$parts): string
{
    return backup_module_path('storage', ...$parts);
}

function backup_backups_path(): string
{
    return backup_storage_path('backups');
}

function backup_tmp_path(string ...$parts): string
{
    return backup_storage_path('tmp', ...$parts);
}

function backup_schedule_path(): string
{
    return backup_storage_path('schedule.php');
}

function backup_lock_path(): string
{
    return backup_storage_path('backup.lock');
}

function backup_ensure_storage(): void
{
    $paths = [backup_storage_path(), backup_backups_path(), backup_tmp_path()];
    foreach ($paths as $path) {
        if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
            throw new RuntimeException('Impossible de creer le dossier de stockage Backup.');
        }
    }

    foreach ($paths as $path) {
        $htaccess = $path . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($htaccess)) {
            file_put_contents($htaccess, "Require all denied\nDeny from all\n");
        }
    }
}

function backup_write_php_config(string $path, array $data): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Impossible de creer le dossier de configuration Backup.');
    }

    $content = "<?php\n"
        . "declare(strict_types=1);\n\n"
        . 'return ' . var_export($data, true) . ";\n";

    if (file_put_contents($path, $content, LOCK_EX) === false) {
        throw new RuntimeException('Impossible d enregistrer la configuration Backup.');
    }
}

function backup_default_schedule(): array
{
    return [
        'enabled' => false,
        'frequency' => 'daily',
        'time' => '02:00',
        'weekday' => 1,
        'monthday' => 1,
        'timezone' => date_default_timezone_get() ?: 'UTC',
        'retention_count' => BACKUP_DEFAULT_RETENTION_COUNT,
        'last_run_at' => null,
        'last_scheduled_slot_at' => null,
        'last_status' => null,
        'last_error' => null,
        'last_backup_file' => null,
        'updated_at' => null,
    ];
}

function backup_normalize_time(string $time): string
{
    $time = trim($time);
    if (preg_match('/^([01]?\d|2[0-3]):([0-5]\d)$/', $time, $matches) === 1) {
        return sprintf('%02d:%02d', (int) $matches[1], (int) $matches[2]);
    }

    return '02:00';
}

function backup_normalize_schedule(array $schedule): array
{
    $defaults = backup_default_schedule();
    $schedule = array_merge($defaults, $schedule);

    $frequency = strtolower(trim((string) ($schedule['frequency'] ?? 'daily')));
    if (!in_array($frequency, ['hourly', 'daily', 'weekly', 'monthly'], true)) {
        $frequency = 'daily';
    }

    $weekday = (int) ($schedule['weekday'] ?? 1);
    if ($weekday < 1 || $weekday > 7) {
        $weekday = 1;
    }

    $monthday = (int) ($schedule['monthday'] ?? 1);
    if ($monthday < 1 || $monthday > 31) {
        $monthday = 1;
    }

    $retentionCount = (int) ($schedule['retention_count'] ?? BACKUP_DEFAULT_RETENTION_COUNT);
    if ($retentionCount < 1) {
        $retentionCount = BACKUP_DEFAULT_RETENTION_COUNT;
    }
    if ($retentionCount > 365) {
        $retentionCount = 365;
    }

    $timezone = trim((string) ($schedule['timezone'] ?? ''));
    try {
        new DateTimeZone($timezone);
    } catch (Throwable) {
        $timezone = date_default_timezone_get() ?: 'UTC';
    }

    return [
        'enabled' => (bool) ($schedule['enabled'] ?? false),
        'frequency' => $frequency,
        'time' => backup_normalize_time((string) ($schedule['time'] ?? '02:00')),
        'weekday' => $weekday,
        'monthday' => $monthday,
        'timezone' => $timezone,
        'retention_count' => $retentionCount,
        'last_run_at' => backup_nullable_string($schedule['last_run_at'] ?? null),
        'last_scheduled_slot_at' => backup_nullable_string($schedule['last_scheduled_slot_at'] ?? null),
        'last_status' => backup_nullable_string($schedule['last_status'] ?? null),
        'last_error' => backup_nullable_string($schedule['last_error'] ?? null),
        'last_backup_file' => backup_nullable_string($schedule['last_backup_file'] ?? null),
        'updated_at' => backup_nullable_string($schedule['updated_at'] ?? null),
    ];
}

function backup_nullable_string(mixed $value): ?string
{
    $value = trim((string) ($value ?? ''));
    return $value === '' ? null : $value;
}

function backup_load_schedule(): array
{
    backup_ensure_storage();
    $path = backup_schedule_path();
    if (!is_file($path)) {
        return backup_default_schedule();
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        return backup_default_schedule();
    }

    return backup_normalize_schedule($loaded);
}

function backup_save_schedule(array $schedule): array
{
    $schedule = backup_normalize_schedule([
        ...$schedule,
        'updated_at' => backup_now_iso(),
    ]);
    backup_write_php_config(backup_schedule_path(), $schedule);
    return $schedule;
}

function backup_schedule_from_input(array $input): array
{
    $current = backup_load_schedule();
    $beforeTiming = backup_schedule_timing_signature($current);

    $next = [
        ...$current,
        'enabled' => (bool) ($input['enabled'] ?? false),
        'frequency' => (string) ($input['frequency'] ?? $current['frequency']),
        'time' => (string) ($input['time'] ?? $current['time']),
        'weekday' => (int) ($input['weekday'] ?? $current['weekday']),
        'monthday' => (int) ($input['monthday'] ?? $current['monthday']),
        'retention_count' => (int) ($input['retentionCount'] ?? $input['retention_count'] ?? $current['retention_count']),
    ];
    $next = backup_normalize_schedule($next);

    if ($beforeTiming !== backup_schedule_timing_signature($next)) {
        $next['last_scheduled_slot_at'] = null;
        $next['last_status'] = null;
        $next['last_error'] = null;
    }

    return backup_save_schedule($next);
}

function backup_schedule_timing_signature(array $schedule): string
{
    return json_encode([
        'enabled' => (bool) ($schedule['enabled'] ?? false),
        'frequency' => (string) ($schedule['frequency'] ?? ''),
        'time' => (string) ($schedule['time'] ?? ''),
        'weekday' => (int) ($schedule['weekday'] ?? 1),
        'monthday' => (int) ($schedule['monthday'] ?? 1),
    ], JSON_UNESCAPED_SLASHES) ?: '';
}

function backup_now_iso(?DateTimeZone $timezone = null): string
{
    return (new DateTimeImmutable('now', $timezone))->format(DateTimeInterface::ATOM);
}

function backup_schedule_timezone(array $schedule): DateTimeZone
{
    return new DateTimeZone((string) ($schedule['timezone'] ?? (date_default_timezone_get() ?: 'UTC')));
}

function backup_schedule_time_parts(array $schedule): array
{
    [$hour, $minute] = array_map('intval', explode(':', (string) $schedule['time']));
    return [$hour, $minute];
}

function backup_schedule_previous_slot(array $schedule, ?DateTimeImmutable $now = null): ?DateTimeImmutable
{
    $schedule = backup_normalize_schedule($schedule);
    if (!$schedule['enabled']) {
        return null;
    }

    $timezone = backup_schedule_timezone($schedule);
    $now = ($now ?? new DateTimeImmutable('now', $timezone))->setTimezone($timezone);
    [$hour, $minute] = backup_schedule_time_parts($schedule);

    if ($schedule['frequency'] === 'hourly') {
        $candidate = $now->setTime((int) $now->format('H'), $minute, 0);
        return $candidate > $now ? $candidate->modify('-1 hour') : $candidate;
    }

    if ($schedule['frequency'] === 'daily') {
        $candidate = $now->setTime($hour, $minute, 0);
        return $candidate > $now ? $candidate->modify('-1 day') : $candidate;
    }

    if ($schedule['frequency'] === 'weekly') {
        $today = (int) $now->format('N');
        $daysBack = ($today - (int) $schedule['weekday'] + 7) % 7;
        $candidate = $now->modify('-' . $daysBack . ' days')->setTime($hour, $minute, 0);
        return $candidate > $now ? $candidate->modify('-7 days') : $candidate;
    }

    $monthday = (int) $schedule['monthday'];
    $candidate = backup_schedule_month_slot((int) $now->format('Y'), (int) $now->format('m'), $monthday, $hour, $minute, $timezone);
    if ($candidate > $now) {
        $previousMonth = $now->modify('first day of this month')->modify('-1 month');
        $candidate = backup_schedule_month_slot((int) $previousMonth->format('Y'), (int) $previousMonth->format('m'), $monthday, $hour, $minute, $timezone);
    }

    return $candidate;
}

function backup_schedule_next_slot(array $schedule, ?DateTimeImmutable $now = null): ?DateTimeImmutable
{
    $previous = backup_schedule_previous_slot($schedule, $now);
    if ($previous === null) {
        return null;
    }

    $schedule = backup_normalize_schedule($schedule);
    if ($schedule['frequency'] === 'hourly') {
        return $previous->modify('+1 hour');
    }
    if ($schedule['frequency'] === 'daily') {
        return $previous->modify('+1 day');
    }
    if ($schedule['frequency'] === 'weekly') {
        return $previous->modify('+7 days');
    }

    $timezone = backup_schedule_timezone($schedule);
    [$hour, $minute] = backup_schedule_time_parts($schedule);
    $nextMonth = $previous->setTimezone($timezone)->modify('first day of next month');
    return backup_schedule_month_slot((int) $nextMonth->format('Y'), (int) $nextMonth->format('m'), (int) $schedule['monthday'], $hour, $minute, $timezone);
}

function backup_schedule_month_slot(int $year, int $month, int $monthday, int $hour, int $minute, DateTimeZone $timezone): DateTimeImmutable
{
    $lastDay = (int) (new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month), $timezone))->format('t');
    $day = min($monthday, $lastDay);
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d %02d:%02d:00', $year, $month, $day, $hour, $minute), $timezone);
}

function backup_schedule_due_slot(array $schedule, ?DateTimeImmutable $now = null): ?DateTimeImmutable
{
    $slot = backup_schedule_previous_slot($schedule, $now);
    if ($slot === null) {
        return null;
    }

    $lastSlot = backup_parse_iso_datetime($schedule['last_scheduled_slot_at'] ?? null, backup_schedule_timezone($schedule));
    if ($lastSlot !== null && $lastSlot >= $slot) {
        return null;
    }

    return $slot;
}

function backup_parse_iso_datetime(?string $value, DateTimeZone $timezone): ?DateTimeImmutable
{
    $value = trim((string) ($value ?? ''));
    if ($value === '') {
        return null;
    }

    try {
        return (new DateTimeImmutable($value))->setTimezone($timezone);
    } catch (Throwable) {
        return null;
    }
}

function backup_cron_command(): string
{
    return '*/15 * * * * /usr/bin/php '
        . backup_shell_arg(backup_module_path('api', 'backup.php'))
        . ' run-scheduled >/dev/null 2>&1';
}

function backup_shell_arg(string $value): string
{
    return "'" . str_replace("'", "'\\''", $value) . "'";
}

function backup_public_schedule(array $schedule): array
{
    $schedule = backup_normalize_schedule($schedule);
    $nextSlot = backup_schedule_next_slot($schedule);
    $dueSlot = backup_schedule_due_slot($schedule);

    return [
        'enabled' => $schedule['enabled'],
        'frequency' => $schedule['frequency'],
        'time' => $schedule['time'],
        'weekday' => $schedule['weekday'],
        'monthday' => $schedule['monthday'],
        'timezone' => $schedule['timezone'],
        'retentionCount' => $schedule['retention_count'],
        'lastRunAt' => $schedule['last_run_at'],
        'lastScheduledSlotAt' => $schedule['last_scheduled_slot_at'],
        'lastStatus' => $schedule['last_status'],
        'lastError' => $schedule['last_error'],
        'lastBackupFile' => $schedule['last_backup_file'],
        'updatedAt' => $schedule['updated_at'],
        'nextRunAt' => $nextSlot?->format(DateTimeInterface::ATOM),
        'dueRunAt' => $dueSlot?->format(DateTimeInterface::ATOM),
        'cronCommand' => backup_cron_command(),
    ];
}

function backup_require_super_user(): array
{
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    if (!oceanos_is_super_user($user)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux super-utilisateurs.',
        ], 403);
    }

    return $user;
}

function backup_create_backup(?array $actorUser = null, string $reason = 'manual'): array
{
    backup_ensure_storage();
    if (!class_exists(ZipArchive::class)) {
        throw new RuntimeException('Extension PHP ZipArchive indisponible.');
    }

    if (function_exists('set_time_limit')) {
        @set_time_limit(0);
    }

    $lockHandle = fopen(backup_lock_path(), 'c+');
    if ($lockHandle === false) {
        throw new RuntimeException('Impossible de creer le verrou Backup.');
    }

    if (!flock($lockHandle, LOCK_EX | LOCK_NB)) {
        fclose($lockHandle);
        throw new RuntimeException('Un backup est deja en cours.');
    }

    $startedAt = new DateTimeImmutable('now');
    $backupId = $startedAt->format('Ymd_His') . '_' . bin2hex(random_bytes(3));
    $zipName = 'oceanos-www-db-' . $backupId . '.zip';
    $tmpZipPath = backup_tmp_path($zipName . '.tmp');
    $finalZipPath = backup_backups_path() . DIRECTORY_SEPARATOR . $zipName;
    $sqlPath = backup_tmp_path('database-' . $backupId . '.sql');
    $zip = new ZipArchive();
    $zipOpen = false;

    try {
        $dump = backup_export_database($sqlPath);
        if ($zip->open($tmpZipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Impossible de creer l archive ZIP.');
        }
        $zipOpen = true;

        $dbName = (string) (oceanos_config()['db_name'] ?? 'OceanOS');
        $zip->addFile($sqlPath, 'database/' . backup_safe_archive_name($dbName) . '-' . $backupId . '.sql');
        $zipStats = backup_add_www_to_zip($zip);

        $duration = max(0.001, microtime(true) - (float) $startedAt->format('U.u'));
        $manifest = [
            'version' => BACKUP_MODULE_VERSION,
            'created_at' => $startedAt->format(DateTimeInterface::ATOM),
            'reason' => $reason,
            'source_path' => backup_www_root(),
            'database' => $dbName,
            'database_dump_method' => $dump['method'],
            'database_dump_warning' => $dump['warning'] ?? null,
            'files_count' => $zipStats['files'],
            'directories_count' => $zipStats['directories'],
            'source_bytes' => $zipStats['bytes'],
            'created_by' => $actorUser ? [
                'id' => (int) ($actorUser['id'] ?? 0),
                'email' => (string) ($actorUser['email'] ?? ''),
                'display_name' => (string) ($actorUser['display_name'] ?? ''),
                'role' => (string) ($actorUser['role'] ?? ''),
            ] : null,
        ];
        $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        if ($zip->close() !== true) {
            throw new RuntimeException('Impossible de finaliser l archive ZIP.');
        }
        $zipOpen = false;

        if (!rename($tmpZipPath, $finalZipPath)) {
            throw new RuntimeException('Impossible de placer l archive finale.');
        }

        $metadata = [
            ...$manifest,
            'file_name' => $zipName,
            'size' => filesize($finalZipPath) ?: 0,
            'duration_seconds' => round($duration, 3),
            'download_url' => backup_download_url($zipName),
        ];
        backup_write_metadata($zipName, $metadata);
        backup_apply_retention();

        return backup_public_metadata($metadata);
    } finally {
        if ($zipOpen) {
            $zip->close();
        }
        @unlink($sqlPath);
        @unlink($tmpZipPath);
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
}

function backup_export_database(string $targetPath): array
{
    $mysqldumpError = null;
    try {
        backup_export_database_with_mysqldump($targetPath);
        return ['method' => 'mysqldump'];
    } catch (Throwable $exception) {
        $mysqldumpError = $exception->getMessage();
        @unlink($targetPath);
    }

    backup_export_database_with_pdo($targetPath);
    return [
        'method' => 'pdo',
        'warning' => 'mysqldump indisponible, export PDO utilise: ' . $mysqldumpError,
    ];
}

function backup_export_database_with_mysqldump(string $targetPath): void
{
    if (!function_exists('proc_open')) {
        throw new RuntimeException('proc_open indisponible.');
    }

    $config = oceanos_config();
    $defaultsPath = backup_tmp_path('mysql-' . bin2hex(random_bytes(4)) . '.cnf');
    $defaultsContent = "[client]\n"
        . 'host=' . backup_mysql_option_value((string) $config['db_host']) . "\n"
        . 'port=' . (int) $config['db_port'] . "\n"
        . 'user=' . backup_mysql_option_value((string) $config['db_user']) . "\n"
        . 'password=' . backup_mysql_option_value((string) $config['db_pass']) . "\n"
        . "default-character-set=utf8mb4\n";

    file_put_contents($defaultsPath, $defaultsContent, LOCK_EX);
    @chmod($defaultsPath, 0600);

    $binary = trim((string) (getenv('OCEANOS_MYSQLDUMP_PATH') ?: 'mysqldump'));
    $args = [
        $binary,
        '--defaults-extra-file=' . $defaultsPath,
        '--single-transaction',
        '--quick',
        '--routines',
        '--events',
        '--triggers',
        '--hex-blob',
        '--default-character-set=utf8mb4',
        '--databases',
        (string) $config['db_name'],
    ];
    $command = implode(' ', array_map('backup_shell_arg', $args));
    $descriptors = [
        1 => ['file', $targetPath, 'wb'],
        2 => ['pipe', 'w'],
    ];

    try {
        $process = proc_open($command, $descriptors, $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('Impossible de lancer mysqldump.');
        }

        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        if ($exitCode !== 0) {
            throw new RuntimeException(trim($stderr) !== '' ? trim($stderr) : 'mysqldump a echoue.');
        }
        if (!is_file($targetPath) || filesize($targetPath) === 0) {
            throw new RuntimeException('mysqldump a produit un fichier vide.');
        }
    } finally {
        @unlink($defaultsPath);
    }
}

function backup_mysql_option_value(string $value): string
{
    return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"';
}

function backup_export_database_with_pdo(string $targetPath): void
{
    $config = oceanos_config();
    $pdo = oceanos_pdo();
    $dbName = (string) $config['db_name'];
    $handle = fopen($targetPath, 'wb');
    if ($handle === false) {
        throw new RuntimeException('Impossible d ecrire le dump SQL.');
    }

    try {
        backup_sql_write($handle, "-- OceanOS Backup SQL fallback\n");
        backup_sql_write($handle, "-- Created at " . backup_now_iso() . "\n\n");
        backup_sql_write($handle, 'CREATE DATABASE IF NOT EXISTS ' . backup_sql_identifier($dbName) . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n");
        backup_sql_write($handle, 'USE ' . backup_sql_identifier($dbName) . ";\n\n");
        backup_sql_write($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

        $rows = $pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM);
        $tables = [];
        $views = [];
        foreach ($rows as $row) {
            $name = (string) ($row[0] ?? '');
            $type = strtoupper((string) ($row[1] ?? 'BASE TABLE'));
            if ($name === '') {
                continue;
            }
            if ($type === 'VIEW') {
                $views[] = $name;
            } else {
                $tables[] = $name;
            }
        }

        foreach ($tables as $table) {
            backup_dump_table_with_pdo($pdo, $handle, $table);
        }
        foreach ($views as $view) {
            backup_dump_view_with_pdo($pdo, $handle, $view);
        }

        backup_dump_triggers_with_pdo($pdo, $handle);
        backup_dump_routines_with_pdo($pdo, $handle);
        backup_dump_events_with_pdo($pdo, $handle);
        backup_sql_write($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
    } finally {
        fclose($handle);
    }
}

function backup_dump_table_with_pdo(PDO $pdo, mixed $handle, string $table): void
{
    $quoted = backup_sql_identifier($table);
    $create = $pdo->query('SHOW CREATE TABLE ' . $quoted)->fetch(PDO::FETCH_ASSOC);
    $createSql = backup_show_create_value($create, 'create table');

    backup_sql_write($handle, "\nDROP TABLE IF EXISTS {$quoted};\n");
    backup_sql_write($handle, $createSql . ";\n\n");

    $columns = $pdo->query('SHOW COLUMNS FROM ' . $quoted)->fetchAll(PDO::FETCH_ASSOC);
    $columnNames = array_map(static fn(array $row): string => (string) $row['Field'], $columns);
    if ($columnNames === []) {
        return;
    }

    $select = $pdo->query('SELECT * FROM ' . $quoted);
    $batch = [];
    $prefix = 'INSERT INTO ' . $quoted . ' (' . implode(', ', array_map('backup_sql_identifier', $columnNames)) . ") VALUES\n";

    while (($row = $select->fetch(PDO::FETCH_ASSOC)) !== false) {
        $values = [];
        foreach ($columnNames as $column) {
            $values[] = backup_sql_value($pdo, $row[$column] ?? null);
        }
        $batch[] = '(' . implode(', ', $values) . ')';

        if (count($batch) >= 100) {
            backup_sql_write($handle, $prefix . implode(",\n", $batch) . ";\n");
            $batch = [];
        }
    }

    if ($batch !== []) {
        backup_sql_write($handle, $prefix . implode(",\n", $batch) . ";\n");
    }
    backup_sql_write($handle, "\n");
}

function backup_dump_view_with_pdo(PDO $pdo, mixed $handle, string $view): void
{
    $quoted = backup_sql_identifier($view);
    $create = $pdo->query('SHOW CREATE VIEW ' . $quoted)->fetch(PDO::FETCH_ASSOC);
    $createSql = backup_show_create_value($create, 'create view');
    backup_sql_write($handle, "\nDROP VIEW IF EXISTS {$quoted};\n");
    backup_sql_write($handle, $createSql . ";\n\n");
}

function backup_dump_triggers_with_pdo(PDO $pdo, mixed $handle): void
{
    try {
        $rows = $pdo->query('SHOW TRIGGERS')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $name = (string) ($row['Trigger'] ?? '');
            if ($name === '') {
                continue;
            }
            $create = $pdo->query('SHOW CREATE TRIGGER ' . backup_sql_identifier($name))->fetch(PDO::FETCH_ASSOC);
            backup_write_delimited_sql($handle, backup_show_create_value($create, 'sql original statement'));
        }
    } catch (Throwable) {
    }
}

function backup_dump_routines_with_pdo(PDO $pdo, mixed $handle): void
{
    try {
        $rows = $pdo->query('SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $name = (string) ($row['ROUTINE_NAME'] ?? '');
            $type = strtoupper((string) ($row['ROUTINE_TYPE'] ?? ''));
            if ($name === '' || !in_array($type, ['PROCEDURE', 'FUNCTION'], true)) {
                continue;
            }
            $create = $pdo->query('SHOW CREATE ' . $type . ' ' . backup_sql_identifier($name))->fetch(PDO::FETCH_ASSOC);
            backup_write_delimited_sql($handle, backup_show_create_value($create, 'create ' . strtolower($type)));
        }
    } catch (Throwable) {
    }
}

function backup_dump_events_with_pdo(PDO $pdo, mixed $handle): void
{
    try {
        $rows = $pdo->query('SHOW EVENTS')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $name = (string) ($row['Name'] ?? '');
            if ($name === '') {
                continue;
            }
            $create = $pdo->query('SHOW CREATE EVENT ' . backup_sql_identifier($name))->fetch(PDO::FETCH_ASSOC);
            backup_write_delimited_sql($handle, backup_show_create_value($create, 'create event'));
        }
    } catch (Throwable) {
    }
}

function backup_show_create_value(array|false $row, string $preferredKey): string
{
    if (!is_array($row)) {
        throw new RuntimeException('SHOW CREATE a echoue.');
    }

    foreach ($row as $key => $value) {
        if (strtolower((string) $key) === strtolower($preferredKey)) {
            return (string) $value;
        }
    }
    foreach ($row as $key => $value) {
        if (str_contains(strtolower((string) $key), 'create') || str_contains(strtolower((string) $key), 'statement')) {
            return (string) $value;
        }
    }

    throw new RuntimeException('Instruction CREATE introuvable.');
}

function backup_write_delimited_sql(mixed $handle, string $sql): void
{
    $sql = rtrim(trim($sql), ';');
    if ($sql === '') {
        return;
    }

    backup_sql_write($handle, "\nDELIMITER ;;\n{$sql};;\nDELIMITER ;\n\n");
}

function backup_sql_identifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function backup_sql_value(PDO $pdo, mixed $value): string
{
    if ($value === null) {
        return 'NULL';
    }

    $quoted = $pdo->quote((string) $value);
    return $quoted === false ? "''" : $quoted;
}

function backup_sql_write(mixed $handle, string $content): void
{
    if (fwrite($handle, $content) === false) {
        throw new RuntimeException('Impossible d ecrire le dump SQL.');
    }
}

function backup_add_www_to_zip(ZipArchive $zip): array
{
    $root = backup_www_root();
    $rootReal = realpath($root) ?: $root;
    $excludeRoots = array_values(array_filter([
        backup_storage_path(),
        backup_www_root() . DIRECTORY_SEPARATOR . '_backups',
        backup_www_root() . DIRECTORY_SEPARATOR . '.git',
    ], static fn(string $path): bool => $path !== ''));

    $directory = new RecursiveDirectoryIterator($rootReal, FilesystemIterator::SKIP_DOTS);
    $filter = new RecursiveCallbackFilterIterator($directory, static function (SplFileInfo $current) use ($excludeRoots): bool {
        $path = $current->getPathname();
        if (backup_path_is_excluded($path, $excludeRoots)) {
            return false;
        }
        if ($current->isLink() && $current->isDir()) {
            return false;
        }

        return true;
    });
    $iterator = new RecursiveIteratorIterator($filter, RecursiveIteratorIterator::SELF_FIRST);

    $files = 0;
    $directories = 0;
    $bytes = 0;
    foreach ($iterator as $item) {
        $path = $item->getPathname();
        $relative = backup_relative_path($path, $rootReal);
        if ($relative === '' || $relative === false) {
            continue;
        }
        $archiveName = 'www/' . str_replace('\\', '/', (string) $relative);

        if ($item->isDir()) {
            $zip->addEmptyDir($archiveName);
            $directories++;
            continue;
        }

        if (!$item->isFile() || $item->isLink()) {
            continue;
        }

        if (!$zip->addFile($path, $archiveName)) {
            throw new RuntimeException('Impossible d ajouter au ZIP : ' . $relative);
        }
        $files++;
        $bytes += $item->getSize();
    }

    return ['files' => $files, 'directories' => $directories, 'bytes' => $bytes];
}

function backup_relative_path(string $path, string $root): string|false
{
    $path = backup_normalized_path($path);
    $root = backup_normalized_path($root);
    if ($path === $root) {
        return '';
    }
    if (backup_path_starts_with($path, $root . '/')) {
        return substr($path, strlen($root) + 1);
    }

    return false;
}

function backup_path_is_excluded(string $path, array $excludeRoots): bool
{
    $normalized = backup_normalized_path($path);
    foreach ($excludeRoots as $excludeRoot) {
        $exclude = backup_normalized_path($excludeRoot);
        if ($normalized === $exclude || backup_path_starts_with($normalized, $exclude . '/')) {
            return true;
        }
    }

    return false;
}

function backup_normalized_path(string $path): string
{
    $real = realpath($path);
    $normalized = str_replace('\\', '/', $real !== false ? $real : $path);
    $normalized = rtrim($normalized, '/');
    return DIRECTORY_SEPARATOR === '\\' ? strtolower($normalized) : $normalized;
}

function backup_path_starts_with(string $path, string $prefix): bool
{
    return substr($path, 0, strlen($prefix)) === $prefix;
}

function backup_safe_archive_name(string $name): string
{
    $safe = preg_replace('/[^a-zA-Z0-9_.-]+/', '-', $name) ?: 'database';
    return trim($safe, '-_.') ?: 'database';
}

function backup_download_url(string $zipName): string
{
    return '/Backup/api/backup.php?action=download&file=' . rawurlencode($zipName);
}

function backup_metadata_path(string $zipName): string
{
    return backup_backups_path() . DIRECTORY_SEPARATOR . substr($zipName, 0, -4) . '.json';
}

function backup_write_metadata(string $zipName, array $metadata): void
{
    file_put_contents(backup_metadata_path($zipName), json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function backup_sanitize_zip_name(string $fileName): string
{
    $base = basename(str_replace('\\', '/', $fileName));
    if (preg_match('/^oceanos-www-db-\d{8}_\d{6}_[a-f0-9]{6}\.zip$/', $base) !== 1) {
        throw new InvalidArgumentException('Fichier backup invalide.');
    }

    return $base;
}

function backup_find_zip_path(string $fileName): string
{
    $zipName = backup_sanitize_zip_name($fileName);
    $path = backup_backups_path() . DIRECTORY_SEPARATOR . $zipName;
    if (!is_file($path)) {
        throw new InvalidArgumentException('Backup introuvable.');
    }

    return $path;
}

function backup_public_metadata(array $metadata): array
{
    $fileName = (string) ($metadata['file_name'] ?? '');
    return [
        'fileName' => $fileName,
        'createdAt' => (string) ($metadata['created_at'] ?? ''),
        'reason' => (string) ($metadata['reason'] ?? ''),
        'size' => (int) ($metadata['size'] ?? 0),
        'durationSeconds' => (float) ($metadata['duration_seconds'] ?? 0),
        'database' => (string) ($metadata['database'] ?? ''),
        'databaseDumpMethod' => (string) ($metadata['database_dump_method'] ?? ''),
        'databaseDumpWarning' => backup_nullable_string($metadata['database_dump_warning'] ?? null),
        'filesCount' => (int) ($metadata['files_count'] ?? 0),
        'directoriesCount' => (int) ($metadata['directories_count'] ?? 0),
        'sourceBytes' => (int) ($metadata['source_bytes'] ?? 0),
        'sourcePath' => (string) ($metadata['source_path'] ?? ''),
        'downloadUrl' => $fileName !== '' ? backup_download_url($fileName) : '',
        'createdBy' => $metadata['created_by'] ?? null,
    ];
}

function backup_list_backups(): array
{
    backup_ensure_storage();
    $items = [];
    foreach (glob(backup_backups_path() . DIRECTORY_SEPARATOR . 'oceanos-www-db-*.zip') ?: [] as $zipPath) {
        $zipName = basename($zipPath);
        $metadataPath = backup_metadata_path($zipName);
        $metadata = [
            'file_name' => $zipName,
            'created_at' => date(DateTimeInterface::ATOM, filemtime($zipPath) ?: time()),
            'size' => filesize($zipPath) ?: 0,
        ];
        if (is_file($metadataPath)) {
            $loaded = json_decode((string) file_get_contents($metadataPath), true);
            if (is_array($loaded)) {
                $metadata = array_merge($metadata, $loaded);
            }
        }
        $items[] = backup_public_metadata($metadata);
    }

    usort($items, static fn(array $a, array $b): int => strcmp((string) $b['createdAt'], (string) $a['createdAt']));
    return $items;
}

function backup_delete_backup(string $fileName): void
{
    $zipPath = backup_find_zip_path($fileName);
    $metadataPath = backup_metadata_path(basename($zipPath));
    if (!unlink($zipPath)) {
        throw new RuntimeException('Impossible de supprimer le backup.');
    }
    @unlink($metadataPath);
}

function backup_apply_retention(): void
{
    $schedule = backup_load_schedule();
    $retention = (int) ($schedule['retention_count'] ?? BACKUP_DEFAULT_RETENTION_COUNT);
    $backups = backup_list_backups();
    if (count($backups) <= $retention) {
        return;
    }

    foreach (array_slice($backups, $retention) as $backup) {
        try {
            backup_delete_backup((string) $backup['fileName']);
        } catch (Throwable) {
        }
    }
}

function backup_totals(array $backups): array
{
    return [
        'count' => count($backups),
        'bytes' => array_sum(array_map(static fn(array $backup): int => (int) ($backup['size'] ?? 0), $backups)),
    ];
}

function backup_status_payload(?array $currentUser = null): array
{
    $schedule = backup_load_schedule();
    $backups = backup_list_backups();

    return [
        'ok' => true,
        'version' => BACKUP_MODULE_VERSION,
        'currentUser' => $currentUser ? oceanos_public_user($currentUser) : null,
        'schedule' => backup_public_schedule($schedule),
        'backups' => $backups,
        'totals' => backup_totals($backups),
        'paths' => [
            'wwwRoot' => backup_www_root(),
            'backupDirectory' => backup_backups_path(),
        ],
        'requirements' => [
            'zipArchive' => class_exists(ZipArchive::class),
        ],
    ];
}

function backup_run_scheduled_backup(): array
{
    backup_ensure_storage();
    $schedule = backup_load_schedule();
    $timezone = backup_schedule_timezone($schedule);
    $slot = backup_schedule_due_slot($schedule);

    if ($slot === null) {
        return [
            ...backup_status_payload(),
            'scheduledRun' => [
                'ran' => false,
                'message' => 'Aucun backup planifie a executer.',
            ],
        ];
    }

    try {
        $backup = backup_create_backup(null, 'scheduled');
        $schedule = backup_load_schedule();
        $schedule['last_run_at'] = backup_now_iso($timezone);
        $schedule['last_scheduled_slot_at'] = $slot->format(DateTimeInterface::ATOM);
        $schedule['last_status'] = 'success';
        $schedule['last_error'] = null;
        $schedule['last_backup_file'] = $backup['fileName'];
        backup_save_schedule($schedule);

        return [
            ...backup_status_payload(),
            'scheduledRun' => [
                'ran' => true,
                'status' => 'success',
                'slot' => $slot->format(DateTimeInterface::ATOM),
                'backup' => $backup,
            ],
        ];
    } catch (Throwable $exception) {
        $schedule = backup_load_schedule();
        $schedule['last_run_at'] = backup_now_iso($timezone);
        $schedule['last_scheduled_slot_at'] = $slot->format(DateTimeInterface::ATOM);
        $schedule['last_status'] = 'error';
        $schedule['last_error'] = $exception->getMessage();
        backup_save_schedule($schedule);
        throw $exception;
    }
}
