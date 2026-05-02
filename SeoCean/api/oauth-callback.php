<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function visiocean_redirect_with_status(string $status, string $message): void
{
    header('Location: /SeoCean/?google=' . rawurlencode($status) . '&message=' . rawurlencode($message), true, 302);
    exit;
}

try {
    $pdo = visiocean_pdo();
    $user = visiocean_require_user($pdo);
    if (!visiocean_is_admin($user)) {
        visiocean_redirect_with_status('error', 'Connexion Google reservee aux administrateurs.');
    }

    $error = trim((string) ($_GET['error'] ?? ''));
    if ($error !== '') {
        visiocean_redirect_with_status('error', 'Google a annule la connexion : ' . $error);
    }

    $code = trim((string) ($_GET['code'] ?? ''));
    $state = trim((string) ($_GET['state'] ?? ''));
    if ($code === '' || $state === '') {
        visiocean_redirect_with_status('error', 'Reponse OAuth Google incomplete.');
    }

    $settings = visiocean_complete_oauth($pdo, $code, $state);
    $email = (string) ($settings['oauthConnectedEmail'] ?? '');
    visiocean_redirect_with_status('connected', $email !== '' ? 'Google connecte avec ' . $email . '.' : 'Google connecte.');
} catch (Throwable $exception) {
    visiocean_redirect_with_status('error', $exception->getMessage());
}
