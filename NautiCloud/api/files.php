<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nauticloud_pdo();
    $user = nauticloud_require_user($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $action = strtolower(trim((string) ($_GET['action'] ?? 'list')));
        $path = nauticloud_relative_path($_GET['path'] ?? '');

        if ($action === 'list') {
            nauticloud_json_response([
                'ok' => true,
                'path' => $path,
                'current' => nauticloud_item($path),
                'items' => nauticloud_list_directory($path),
                'stats' => nauticloud_stats(),
                'presence' => nauticloud_list_presence(),
                'latestEventId' => nauticloud_latest_event_id(),
            ]);
        }

        if ($action === 'content') {
            nauticloud_json_response([
                'ok' => true,
            ] + nauticloud_read_text_file($path));
        }

        if ($action === 'search') {
            nauticloud_json_response([
                'ok' => true,
                'query' => (string) ($_GET['q'] ?? ''),
                'items' => nauticloud_search((string) ($_GET['q'] ?? ''), $path),
            ]);
        }

        if ($action === 'stats') {
            nauticloud_json_response([
                'ok' => true,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ]);
        }

        nauticloud_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    if ($method === 'POST') {
        $contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');

        if (str_contains(strtolower($contentType), 'multipart/form-data')) {
            $action = strtolower(trim((string) ($_POST['action'] ?? 'upload')));

            if ($action === 'upload') {
                $uploaded = nauticloud_upload_files((string) ($_POST['path'] ?? ''), $_FILES['files'] ?? [], $user);
                nauticloud_json_response([
                    'ok' => true,
                    'items' => $uploaded,
                    'stats' => nauticloud_stats(),
                    'latestEventId' => nauticloud_latest_event_id(),
                ], 201);
            }

            if ($action === 'save_binary') {
                $file = $_FILES['file'] ?? null;
                if (!is_array($file)) {
                    throw new InvalidArgumentException('Fichier manquant.');
                }

                $payload = nauticloud_write_binary_file(
                    (string) ($_POST['path'] ?? ''),
                    (string) ($file['tmp_name'] ?? ''),
                    isset($_POST['expectedVersion']) ? (string) $_POST['expectedVersion'] : null,
                    $user,
                    (bool) ($_POST['force'] ?? false)
                );
                nauticloud_json_response([
                    'ok' => true,
                    'stats' => nauticloud_stats(),
                    'latestEventId' => nauticloud_latest_event_id(),
                ] + $payload);
            }

            throw new InvalidArgumentException('Action multipart non supportee.');
        }

        $input = nauticloud_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'create_folder') {
            $item = nauticloud_create_folder((string) ($input['path'] ?? ''), (string) ($input['name'] ?? ''), $user);
            nauticloud_json_response([
                'ok' => true,
                'item' => $item,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ], 201);
        }

        if ($action === 'create_file') {
            $item = nauticloud_create_file(
                (string) ($input['path'] ?? ''),
                (string) ($input['name'] ?? ''),
                (string) ($input['content'] ?? ''),
                $user
            );
            nauticloud_json_response([
                'ok' => true,
                'item' => $item,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ], 201);
        }

        if ($action === 'save_file') {
            $payload = nauticloud_write_text_file(
                (string) ($input['path'] ?? ''),
                (string) ($input['content'] ?? ''),
                isset($input['expectedVersion']) ? (string) $input['expectedVersion'] : null,
                $user,
                (bool) ($input['force'] ?? false)
            );
            nauticloud_json_response([
                'ok' => true,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ] + $payload);
        }

        if ($action === 'rename') {
            $item = nauticloud_rename_item((string) ($input['path'] ?? ''), (string) ($input['name'] ?? ''), $user);
            nauticloud_json_response([
                'ok' => true,
                'item' => $item,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ]);
        }

        if ($action === 'delete') {
            $paths = $input['paths'] ?? [$input['path'] ?? ''];
            if (!is_array($paths)) {
                throw new InvalidArgumentException('Liste de chemins invalide.');
            }
            $deleted = nauticloud_delete_paths($paths, $user);
            nauticloud_json_response([
                'ok' => true,
                'deleted' => $deleted,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ]);
        }

        if ($action === 'move' || $action === 'copy') {
            $paths = $input['paths'] ?? [$input['path'] ?? ''];
            if (!is_array($paths)) {
                throw new InvalidArgumentException('Liste de chemins invalide.');
            }
            $items = nauticloud_move_paths($paths, (string) ($input['destination'] ?? ''), $user, $action === 'copy');
            nauticloud_json_response([
                'ok' => true,
                'items' => $items,
                'stats' => nauticloud_stats(),
                'latestEventId' => nauticloud_latest_event_id(),
            ]);
        }

        if ($action === 'presence') {
            $presence = nauticloud_update_presence(
                (string) ($input['clientId'] ?? ''),
                (string) ($input['path'] ?? ''),
                $user,
                (bool) ($input['editing'] ?? false)
            );
            nauticloud_json_response([
                'ok' => true,
                'presence' => $presence,
            ]);
        }

        if ($action === 'leave_presence') {
            $presence = nauticloud_remove_presence((string) ($input['clientId'] ?? ''));
            nauticloud_json_response([
                'ok' => true,
                'presence' => $presence,
            ]);
        }

        nauticloud_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action non supportee.',
        ], 422);
    }

    nauticloud_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    nauticloud_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    nauticloud_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
