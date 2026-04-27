<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function flowcean_sse_emit(string $event, array $payload, ?int $id = null): void
{
    if ($id !== null) {
        echo 'id: ' . $id . "\n";
    }

    echo 'event: ' . $event . "\n";
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo 'data: ' . ($json === false ? '{}' : $json) . "\n\n";
}

try {
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);
    $slug = flowcean_workspace_slug($_GET['slug'] ?? null);
    $workspace = flowcean_require_workspace_access($pdo, $slug, $user, 'viewer');
    $workspaceId = (int) $workspace['id'];

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
        $sinceEventId = flowcean_latest_workspace_event_id($pdo, $workspaceId);
    }

    $readyPayload = [
        'workspaceSlug' => $slug,
        'lastEventId' => $sinceEventId,
        'serverVersion' => (int) ($workspace['version'] ?? 0),
    ];
    flowcean_sse_emit('ready', $readyPayload, $sinceEventId > 0 ? $sinceEventId : null);

    $lastPresenceJson = '';
    $presence = flowcean_list_workspace_presence($pdo, $workspaceId);
    $lastPresenceJson = json_encode($presence, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    flowcean_sse_emit('presence.sync', [
        'workspaceSlug' => $slug,
        'presence' => $presence,
    ]);
    @flush();

    $startedAt = microtime(true);
    while (!connection_aborted() && (microtime(true) - $startedAt) < 25) {
        $sent = false;

        $events = flowcean_list_workspace_events_since($pdo, $workspaceId, $sinceEventId);
        foreach ($events as $event) {
            $sinceEventId = max($sinceEventId, (int) $event['id']);
            flowcean_sse_emit('workspace.event', $event, (int) $event['id']);
            $sent = true;
        }

        $presence = flowcean_list_workspace_presence($pdo, $workspaceId);
        $presenceJson = json_encode($presence, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
        if ($presenceJson !== $lastPresenceJson) {
            flowcean_sse_emit('presence.sync', [
                'workspaceSlug' => $slug,
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
    echo 'event: error' . "\n";
    echo 'data: ' . json_encode([
        'ok' => false,
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
}
