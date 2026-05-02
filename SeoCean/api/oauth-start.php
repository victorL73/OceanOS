<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = visiocean_pdo();
    $user = visiocean_require_user($pdo);
    if (!visiocean_is_admin($user)) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Connexion Google reservee aux administrateurs.',
        ], 403);
    }

    header('Location: ' . visiocean_oauth_authorization_url($pdo), true, 302);
    exit;
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'oauth_start_error',
        'message' => $exception->getMessage(),
    ], 500);
}
