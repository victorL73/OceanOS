<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    $user = flowcean_require_auth($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $userId = (int) $user['id'];

    if ($method === 'OPTIONS') {
        flowcean_json_response(['ok' => true]);
    }

    if ($method === 'GET') {
        flowcean_json_response([
            'ok' => true,
            'settings' => flowcean_ai_public_settings($pdo, $userId),
        ]);
    }

    if ($method === 'PUT' || $method === 'POST') {
        $input = flowcean_read_json_request();
        $action = strtolower(trim((string) ($input['action'] ?? 'settings')));

        if ($action === 'settings') {
            flowcean_json_response([
                'ok' => false,
                'error' => 'managed_by_oceanos',
                'message' => 'La configuration Groq se fait maintenant dans OceanOS.',
                'oceanosUrl' => '/OceanOS/',
            ], 410);
        }

        if ($action === 'complete' || $action === 'test') {
            $settings = flowcean_ai_private_settings($pdo, $userId);
            $prompt = trim((string) ($input['prompt'] ?? ''));
            $context = trim((string) ($input['context'] ?? ''));
            $task = strtolower(trim((string) ($input['task'] ?? 'chat')));

            if ($action === 'test') {
                $prompt = 'Reponds uniquement: Flowcean IA est connecte.';
                $task = 'test';
            }

            if ($prompt === '' && $context === '') {
                flowcean_json_response([
                    'ok' => false,
                    'error' => 'empty_prompt',
                    'message' => 'Ajoutez un texte ou une page a analyser.',
                ], 422);
            }

            $instruction = match ($task) {
                'summary' => 'Tu es un assistant de productivite. Resume clairement le contenu fourni en francais, avec les points importants et les actions a retenir.',
                'improve' => 'Tu es un assistant d ecriture. Ameliore le texte en francais, corrige les fautes, clarifie le style, et conserve le sens.',
                'tasks' => 'Tu es un chef de projet. Transforme le contenu fourni en liste d actions concretes, avec priorites et responsables si disponibles.',
                'plan' => 'Tu es un chef de projet senior. Transforme le contenu fourni en plan de projet concis: objectifs, jalons, risques, dependances et prochaines actions.',
                'translate' => 'Tu es un traducteur professionnel. Traduis le contenu fourni en francais naturel, sans ajouter de commentaire.',
                'patch' => 'Tu es un editeur de contenu. Propose des remplacements precis bloc par bloc. Reponds uniquement avec du JSON valide, sans Markdown ni explication hors JSON.',
                default => 'Tu es Flowcean IA, un assistant francais concis, utile et oriente travail collaboratif.',
            };

            $userContent = trim($context) !== ''
                ? "Contexte:\n{$context}\n\nDemande:\n{$prompt}"
                : $prompt;

            $answer = flowcean_groq_chat_completion(
                $settings['apiKey'],
                $settings['model'],
                [
                    ['role' => 'system', 'content' => $instruction],
                    ['role' => 'user', 'content' => $userContent],
                ],
                $task === 'chat' ? 0.5 : 0.25
            );

            flowcean_json_response([
                'ok' => true,
                'answer' => $answer,
                'settings' => flowcean_ai_public_settings($pdo, $userId),
            ]);
        }

        flowcean_json_response([
            'ok' => false,
            'error' => 'unsupported_action',
            'message' => 'Action IA non supportee.',
        ], 422);
    }

    if ($method === 'DELETE') {
        flowcean_json_response([
            'ok' => false,
            'error' => 'managed_by_oceanos',
            'message' => 'La configuration Groq se supprime maintenant dans OceanOS.',
            'oceanosUrl' => '/OceanOS/',
        ], 410);
    }

    flowcean_json_response([
        'ok' => false,
        'error' => 'method_not_allowed',
        'message' => 'Methode non supportee.',
    ], 405);
} catch (InvalidArgumentException $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (Throwable $exception) {
    flowcean_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
