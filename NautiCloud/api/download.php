<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nauticloud_pdo();
    nauticloud_require_user($pdo);

    $path = nauticloud_relative_path($_GET['path'] ?? '');
    $absolutePath = nauticloud_absolute_path($path, true);
    if (!is_file($absolutePath)) {
        throw new InvalidArgumentException('Telechargement disponible uniquement pour les fichiers.');
    }

    $name = basename($absolutePath);
    $mime = nauticloud_detect_mime($absolutePath);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($absolutePath));
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $name) . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    readfile($absolutePath);
    exit;
} catch (Throwable $exception) {
    nauticloud_json_response([
        'ok' => false,
        'error' => 'download_error',
        'message' => $exception->getMessage(),
    ], $exception instanceof InvalidArgumentException ? 422 : 500);
}
