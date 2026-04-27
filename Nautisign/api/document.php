<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = nautisign_pdo();
    $download = isset($_GET['download']) && (string) $_GET['download'] !== '0';
    $variant = strtolower(trim((string) ($_GET['variant'] ?? 'original')));
    $request = null;

    if (isset($_GET['token'])) {
        $request = nautisign_find_request_by_token($pdo, (string) $_GET['token']);
        if ($request === null) {
            throw new InvalidArgumentException('Lien Nautisign introuvable.');
        }
        if (in_array((string) $request['status'], ['revoked'], true)) {
            throw new InvalidArgumentException('Ce lien Nautisign est desactive.');
        }
    } else {
        $user = nautisign_require_user($pdo);
        $request = nautisign_require_request($pdo, (int) ($_GET['id'] ?? 0), $user);
    }

    if ($variant === 'signed') {
        $signedPath = nautisign_signed_absolute_path($request['signed_pdf_path'] ?? null);
        if ($signedPath === '' || !is_file($signedPath)) {
            throw new InvalidArgumentException('PDF signe introuvable.');
        }
        $filename = 'signe-' . nautisign_safe_basename((string) $request['quote_filename']);
        nautisign_serve_pdf($signedPath, $filename, $download);
    }

    $originalPath = nautisign_quote_path((string) $request['quote_filename']);
    nautisign_serve_pdf($originalPath, nautisign_safe_basename((string) $request['quote_filename']), $download);
} catch (InvalidArgumentException $exception) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo $exception->getMessage();
    exit;
} catch (Throwable $exception) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo $exception->getMessage();
    exit;
}
