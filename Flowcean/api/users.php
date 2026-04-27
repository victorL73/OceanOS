<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = flowcean_pdo();
    flowcean_require_admin($pdo);
    flowcean_json_response([
        'ok' => false,
        'error' => 'managed_by_oceanos',
        'message' => 'La gestion des comptes et des droits se fait maintenant dans OceanOS.',
        'oceanosUrl' => '/OceanOS/',
    ], 410);
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
