<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function nauticloud_sse_emit(string $event, array $payload, ?int $id = null): void
{
    if ($id !== null) {
        echo 'id: ' . $id . "\n";
    }
    echo 'event: ' . $event . "\n";
    echo 'data: ' . (json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{}') . "\n\n";
}

try {
    $pdo = nauticloud_pdo();
    nauticloud_require_user($pdo);

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    while (ob_get_level() > 0) {
        ob_end_flush();
    }
    ob_implicit_flush(true);
    ignore_user_abort(true);
    set_time_limit(0);

    echo "retry: 2000\n\n";

    $sinceEventId = isset($_GET['sinceEventId'])
        ? (int) $_GET['sinceEventId']
        : (isset($_SERVER['HTTP_LAST_EVENT_ID']) ? (int) $_SERVER['HTTP_LAST_EVENT_ID'] : 0);
    if ($sinceEventId < 0) {
        $sinceEventId = 0;
    }
    if ($sinceEventId === 0) {
        $sinceEventId = nauticloud_latest_event_id();
    }

    nauticloud_sse_emit('drive.ready', [
        'lastEventId' => $sinceEventId,
        'stats' => nauticloud_stats(),
    ], $sinceEventId > 0 ? $sinceEventId : null);

    $lastPresenceJson = json_encode(nauticloud_list_presence(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    nauticloud_sse_emit('presence.sync', [
        'presence' => json_decode($lastPresenceJson, true),
    ]);
    @flush();

    $startedAt = microtime(true);
    while (!connection_aborted() && (microtime(true) - $startedAt) < 28) {
        $sent = false;
        $events = nauticloud_events_since($sinceEventId);
        foreach ($events as $event) {
            $eventId = (int) ($event['id'] ?? 0);
            if ($eventId <= $sinceEventId) {
                continue;
            }
            $sinceEventId = $eventId;
            nauticloud_sse_emit('drive.change', $event, $eventId);
            $sent = true;
        }

        $presence = nauticloud_list_presence();
        $presenceJson = json_encode($presence, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
        if ($presenceJson !== $lastPresenceJson) {
            nauticloud_sse_emit('presence.sync', [
                'presence' => $presence,
            ]);
            $lastPresenceJson = $presenceJson;
            $sent = true;
        }

        if (!$sent) {
            echo ": keepalive\n\n";
        }

        @flush();
        sleep(1);
    }
} catch (Throwable $exception) {
    http_response_code(500);
    header('Content-Type: text/event-stream; charset=utf-8');
    echo "event: error\n";
    echo 'data: ' . json_encode([
        'ok' => false,
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n\n";
}
