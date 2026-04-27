<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nauticloud_pdo();
    nauticloud_require_user($pdo);

    $path = nauticloud_relative_path($_GET['path'] ?? '');
    $absolutePath = nauticloud_absolute_path($path, true);
    if (!is_file($absolutePath)) {
        throw new InvalidArgumentException('Apercu disponible uniquement pour les fichiers.');
    }

    $item = nauticloud_item($path);
    if (!in_array($item['kind'], ['image', 'pdf', 'audio', 'video'], true)) {
        throw new InvalidArgumentException('Ce type de fichier ne possede pas d apercu direct.');
    }

    header('Content-Type: ' . $item['mime']);
    header('Content-Length: ' . (string) filesize($absolutePath));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', basename($absolutePath)) . '"');
    header('Cache-Control: private, max-age=60');
    readfile($absolutePath);
    exit;
} catch (Throwable $exception) {
    nauticloud_json_response([
        'ok' => false,
        'error' => 'preview_error',
        'message' => $exception->getMessage(),
    ], $exception instanceof InvalidArgumentException ? 422 : 500);
}
