<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $userId = (int) $user['id'];

    if ($method === 'GET') {
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'settings' => oceanos_ai_public_settings($pdo, $userId),
        ]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        $input = oceanos_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'settings')));

        if ($action === 'settings') {
            $settings = oceanos_save_ai_settings(
                $pdo,
                $userId,
                (string) ($input['model'] ?? 'llama-3.3-70b-versatile'),
                array_key_exists('apiKey', $input) ? (string) $input['apiKey'] : null,
                'groq'
            );

            oceanos_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'settings' => $settings,
                'message' => 'Configuration Groq enregistree dans OceanOS.',
            ]);
        }

        if ($action === 'test') {
            $settings = oceanos_ai_private_settings($pdo, $userId);
            $answer = oceanos_groq_chat_completion(
                $settings['apiKey'],
                $settings['model'],
                [
                    ['role' => 'system', 'content' => 'Tu es un test de connexion.'],
                    ['role' => 'user', 'content' => 'Reponds uniquement: OceanOS IA est connecte.'],
                ],
                0
            );

            oceanos_json_response([
                'ok' => true,
                'managedBy' => 'OceanOS',
                'answer' => $answer,
                'settings' => oceanos_ai_public_settings($pdo, $userId),
            ]);
        }

        oceanos_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action IA non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        oceanos_delete_ai_settings($pdo, $userId);
        oceanos_json_response([
            'ok' => true,
            'managedBy' => 'OceanOS',
            'settings' => oceanos_ai_public_settings($pdo, $userId),
            'message' => 'Configuration Groq supprimee dans OceanOS.',
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
