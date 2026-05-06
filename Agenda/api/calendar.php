<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = agenda_pdo();
    $token = trim((string) ($_GET['token'] ?? ''));
    $user = agenda_user_from_sync_token($pdo, $token);
    if ($user === null) {
        http_response_code(404);
        oceanos_send_security_headers();
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        echo 'Calendrier Agenda introuvable.';
        exit;
    }

    $ics = agenda_build_calendar_ics($pdo, $user);
    oceanos_send_security_headers();
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: inline; filename="agenda-oceanos.ics"');
    header('Cache-Control: private, no-cache, must-revalidate, max-age=0');
    echo $ics;
} catch (Throwable $exception) {
    http_response_code(500);
    oceanos_send_security_headers();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo 'Generation du calendrier impossible.';
}
