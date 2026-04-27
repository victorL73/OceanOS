<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function oceanos_base64url(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function oceanos_jwt(array $payload, string $secret): string
{
    $header = [
        'typ' => 'JWT',
        'alg' => 'HS256',
    ];

    $segments = [
        oceanos_base64url(json_encode($header, JSON_UNESCAPED_SLASHES) ?: '{}'),
        oceanos_base64url(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}'),
    ];
    $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
    $segments[] = oceanos_base64url($signature);

    return implode('.', $segments);
}

function oceanos_mobywork_secret(): string
{
    $env = trim((string) (getenv('JWT_SECRET') ?: ''));
    if ($env !== '') {
        return $env;
    }

    $fileSecret = oceanos_env_file_value(
        dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Mobywork' . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . '.env',
        ['JWT_SECRET', 'OCEANOS_SECRET', 'FLOWCEAN_AI_SECRET']
    );
    if ($fileSecret !== '') {
        return $fileSecret;
    }

    return getenv('OCEANOS_SECRET') ?: 'MobyWorkspace_SuperSecretKey2026';
}

function oceanos_env_file_value(string $path, array $keys): string
{
    if (!is_file($path)) {
        return '';
    }

    $wanted = array_flip($keys);
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return '';
    }

    foreach ($lines as $line) {
        $line = trim((string) $line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!isset($wanted[$key])) {
            continue;
        }

        $value = trim($value, "\"'");
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function oceanos_mobywork_user(array $user): array
{
    $accountRole = (string) ($user['role'] ?? 'member');
    $displayName = (string) ($user['display_name'] ?? $user['email'] ?? 'Utilisateur');

    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'role' => in_array($accountRole, ['super', 'admin'], true) ? 'admin' : 'user',
        'nom' => $displayName,
        'displayName' => $displayName,
        'accountRole' => $accountRole,
        'source' => 'oceanos',
    ];
}

try {
    $pdo = oceanos_pdo();
    $user = oceanos_current_user($pdo);

    if ($user === null) {
        oceanos_json_response([
            'ok' => false,
            'error' => 'unauthenticated',
            'message' => 'Connexion OceanOS requise.',
        ], 401);
    }

    $mobyUser = oceanos_mobywork_user($user);
    $issuedAt = time();
    $expiresAt = $issuedAt + (7 * 24 * 60 * 60);
    $token = oceanos_jwt(array_merge($mobyUser, [
        'iat' => $issuedAt,
        'exp' => $expiresAt,
    ]), oceanos_mobywork_secret());

    oceanos_json_response([
        'ok' => true,
        'success' => true,
        'token' => $token,
        'user' => $mobyUser,
        'expiresAt' => gmdate('c', $expiresAt),
    ]);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
