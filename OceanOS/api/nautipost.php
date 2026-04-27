<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function nautipost_public_history(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'date' => gmdate('c', strtotime((string) $row['created_at'])),
        'network' => (string) $row['network'],
        'text' => (string) $row['post_text'],
        'image' => $row['image_data'] !== null ? (string) $row['image_data'] : null,
    ];
}

function nautipost_list_history(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare(
        'SELECT id, network, post_text, image_data, created_at
         FROM nautipost_history
         WHERE user_id = :user_id
         ORDER BY created_at DESC, id DESC
         LIMIT 20'
    );
    $statement->execute(['user_id' => $userId]);

    return array_map('nautipost_public_history', $statement->fetchAll());
}

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $userId = (int) $user['id'];
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'history' => nautipost_list_history($pdo, $userId),
        ]);
    }

    if ($method === 'POST') {
        $input = oceanos_read_json_request();
        $network = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($input['network'] ?? '')) ?: '', 0, 40);
        $text = trim((string) ($input['text'] ?? ''));
        $image = isset($input['image']) ? (string) $input['image'] : null;

        if ($network === '' || $text === '') {
            throw new InvalidArgumentException('Historique NautiPost incomplet.');
        }

        $statement = $pdo->prepare(
            'INSERT INTO nautipost_history (user_id, network, post_text, image_data)
             VALUES (:user_id, :network, :post_text, :image_data)'
        );
        $statement->execute([
            'user_id' => $userId,
            'network' => $network,
            'post_text' => $text,
            'image_data' => $image,
        ]);

        $pdo->prepare(
            'DELETE FROM nautipost_history
             WHERE user_id = :user_id
             AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM nautipost_history
                    WHERE user_id = :inner_user_id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 20
                ) keep_rows
             )'
        )->execute([
            'user_id' => $userId,
            'inner_user_id' => $userId,
        ]);

        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'history' => nautipost_list_history($pdo, $userId),
        ], 201);
    }

    if ($method === 'DELETE') {
        $statement = $pdo->prepare('DELETE FROM nautipost_history WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);

        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'history' => [],
        ]);
    }

    oceanos_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
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
