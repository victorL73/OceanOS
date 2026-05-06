<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/module_preview.php';

try {
    $pdo = oceanos_pdo();
    $user = oceanos_require_auth($pdo);
    $moduleId = strtolower(trim((string) ($_GET['module'] ?? '')));
    if ($moduleId === '') {
        throw new InvalidArgumentException('Module manquant.');
    }

    oceanos_json_response(oceanos_preview_module_payload($pdo, $user, $moduleId));
} catch (InvalidArgumentException $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'validation_error',
        'message' => $exception->getMessage(),
    ], 422);
} catch (RuntimeException $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'forbidden',
        'message' => $exception->getMessage(),
    ], 403);
} catch (Throwable $exception) {
    oceanos_json_response([
        'ok' => false,
        'error' => 'server_error',
        'message' => $exception->getMessage(),
    ], 500);
}
