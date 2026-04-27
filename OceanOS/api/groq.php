<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method !== 'POST') {
        oceanos_json_response([
            'ok' => false,
            'error' => 'method_not_allowed',
            'message' => 'Methode non supportee.',
        ], 405);
    }

    $settings = oceanos_ai_private_settings($pdo, (int) $user['id']);
    if (trim((string) $settings['apiKey']) === '') {
        throw new InvalidArgumentException('Aucune cle Groq n est configuree dans OceanOS.');
    }

    $input = oceanos_read_json_request();
    $payload = [
        'model' => (string) ($input['model'] ?? $settings['model']),
        'messages' => is_array($input['messages'] ?? null) ? $input['messages'] : [],
        'temperature' => (float) ($input['temperature'] ?? 0.3),
        'max_tokens' => (int) ($input['max_tokens'] ?? 1024),
    ];

    if ($payload['messages'] === []) {
        throw new InvalidArgumentException('Messages Groq manquants.');
    }

    if (isset($input['response_format']) && is_array($input['response_format'])) {
        $payload['response_format'] = $input['response_format'];
    }

    $result = oceanos_ai_post_json('https://api.groq.com/openai/v1/chat/completions', (string) $settings['apiKey'], $payload);
    oceanos_json_response([
        'ok' => true,
        'managedBy' => 'OceanOS',
        'data' => $result,
    ]);
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
