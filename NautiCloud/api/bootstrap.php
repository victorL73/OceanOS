<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const NAUTICLOUD_MODULE_ID = 'nauticloud';
const NAUTICLOUD_MAX_TEXT_BYTES = 2097152;
const NAUTICLOUD_MAX_SEARCH_RESULTS = 120;

function nauticloud_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function nauticloud_read_json_request(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Requete JSON invalide.');
    }

    return $decoded;
}

function nauticloud_pdo(): PDO
{
    return oceanos_pdo();
}

function nauticloud_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(NAUTICLOUD_MODULE_ID, $visibleModules, true)) {
        nauticloud_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'NautiCloud n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function nauticloud_public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'email' => (string) $user['email'],
        'displayName' => (string) $user['display_name'],
        'role' => (string) $user['role'],
    ];
}

function nauticloud_storage_dir(): string
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de preparer le stockage NautiCloud.');
    }

    return $dir;
}

function nauticloud_storage_root(): string
{
    $root = nauticloud_storage_dir() . DIRECTORY_SEPARATOR . 'files';
    if (!is_dir($root) && !mkdir($root, 0775, true) && !is_dir($root)) {
        throw new RuntimeException('Impossible de preparer les fichiers NautiCloud.');
    }

    return $root;
}

function nauticloud_meta_dir(): string
{
    $dir = nauticloud_storage_dir() . DIRECTORY_SEPARATOR . 'meta';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de preparer les metadonnees NautiCloud.');
    }

    return $dir;
}

function nauticloud_clean_name(string $name): string
{
    $name = trim(str_replace(["\r", "\n", "\t"], ' ', $name));
    $name = preg_replace('/\s+/u', ' ', $name) ?: '';
    if ($name === '') {
        throw new InvalidArgumentException('Nom obligatoire.');
    }
    if (mb_strlen($name) > 180) {
        throw new InvalidArgumentException('Nom trop long.');
    }
    if (preg_match('/[\/\\\\<>:"|?*\x00-\x1F]/u', $name)) {
        throw new InvalidArgumentException('Le nom contient un caractere interdit.');
    }
    if (trim($name, " .") === '') {
        throw new InvalidArgumentException('Nom invalide.');
    }
    if ($name !== rtrim($name, ' .')) {
        throw new InvalidArgumentException('Le nom ne peut pas se terminer par un espace ou un point.');
    }
    if (preg_match('/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/iu', $name)) {
        throw new InvalidArgumentException('Nom reserve par Windows.');
    }

    return $name;
}

function nauticloud_relative_path(mixed $path): string
{
    $path = str_replace('\\', '/', (string) $path);
    $path = preg_replace('~/+~', '/', $path) ?: '';
    $path = trim($path, "/ \t\n\r\0\x0B");
    if ($path === '') {
        return '';
    }

    $parts = [];
    foreach (explode('/', $path) as $part) {
        $part = trim($part);
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            throw new InvalidArgumentException('Chemin invalide.');
        }
        $parts[] = nauticloud_clean_name($part);
    }

    return implode('/', $parts);
}

function nauticloud_join_path(string $parent, string $name): string
{
    $parent = nauticloud_relative_path($parent);
    $name = nauticloud_clean_name($name);
    return $parent === '' ? $name : $parent . '/' . $name;
}

function nauticloud_path_is_inside(string $path, string $root): bool
{
    $path = rtrim(strtolower(str_replace('\\', '/', $path)), '/');
    $root = rtrim(strtolower(str_replace('\\', '/', $root)), '/');
    return $path === $root || str_starts_with($path, $root . '/');
}

function nauticloud_absolute_path(string $relativePath, bool $mustExist = true): string
{
    $relativePath = nauticloud_relative_path($relativePath);
    $root = realpath(nauticloud_storage_root());
    if ($root === false) {
        throw new RuntimeException('Racine de stockage introuvable.');
    }

    if ($relativePath === '') {
        return $root;
    }

    $full = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

    if ($mustExist) {
        $real = realpath($full);
        if ($real === false) {
            throw new InvalidArgumentException('Fichier ou dossier introuvable.');
        }
        if (!nauticloud_path_is_inside($real, $root)) {
            throw new InvalidArgumentException('Chemin hors de NautiCloud.');
        }
        if (is_link($real)) {
            throw new InvalidArgumentException('Les liens symboliques ne sont pas pris en charge.');
        }

        return $real;
    }

    $parentRelative = dirname($relativePath);
    $parentRelative = $parentRelative === '.' ? '' : str_replace('\\', '/', $parentRelative);
    $parent = nauticloud_absolute_path($parentRelative, true);
    if (!is_dir($parent)) {
        throw new InvalidArgumentException('Dossier parent introuvable.');
    }

    $candidate = $parent . DIRECTORY_SEPARATOR . basename($relativePath);
    if (!nauticloud_path_is_inside($candidate, $root)) {
        throw new InvalidArgumentException('Chemin hors de NautiCloud.');
    }

    return $candidate;
}

function nauticloud_child_relative(string $parentRelative, string $childName): string
{
    return nauticloud_join_path($parentRelative, $childName);
}

function nauticloud_parent_path(string $relativePath): string
{
    $relativePath = nauticloud_relative_path($relativePath);
    if ($relativePath === '') {
        return '';
    }

    $parent = dirname($relativePath);
    return $parent === '.' ? '' : str_replace('\\', '/', $parent);
}

function nauticloud_file_extension(string $path): string
{
    return strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
}

function nauticloud_detect_mime(string $absolutePath): string
{
    if (is_dir($absolutePath)) {
        return 'inode/directory';
    }

    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = finfo_file($finfo, $absolutePath);
            finfo_close($finfo);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
    }

    return 'application/octet-stream';
}

function nauticloud_file_kind(string $absolutePath, string $extension, string $mime): string
{
    if (is_dir($absolutePath)) {
        return 'folder';
    }
    if (str_starts_with($mime, 'image/') || in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff'], true)) {
        return 'image';
    }
    if ($mime === 'application/pdf' || $extension === 'pdf') {
        return 'pdf';
    }
    if (str_starts_with($mime, 'audio/')) {
        return 'audio';
    }
    if (str_starts_with($mime, 'video/')) {
        return 'video';
    }
    if (in_array($extension, ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml', 'ini', 'log', 'sql', 'css', 'scss', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'html', 'htm', 'php', 'py', 'ps1', 'bat', 'cmd', 'sh', 'env', 'svg'], true)) {
        return 'text';
    }
    if (str_starts_with($mime, 'text/')) {
        return 'text';
    }
    if (in_array($extension, ['zip', 'rar', '7z', 'tar', 'gz'], true)) {
        return 'archive';
    }
    if (in_array($extension, ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'], true)) {
        return 'office';
    }

    return 'binary';
}

function nauticloud_is_editable(string $absolutePath, string $kind): bool
{
    return is_file($absolutePath) && $kind === 'text' && filesize($absolutePath) <= NAUTICLOUD_MAX_TEXT_BYTES;
}

function nauticloud_is_spreadsheet(array $item): bool
{
    return $item['type'] === 'file' && in_array((string) ($item['extension'] ?? ''), ['xlsx', 'xls', 'ods', 'csv'], true);
}

function nauticloud_is_word_document(array $item): bool
{
    return $item['type'] === 'file' && (string) ($item['extension'] ?? '') === 'docx';
}

function nauticloud_is_binary_editable(array $item): bool
{
    return nauticloud_is_spreadsheet($item) || nauticloud_is_word_document($item);
}

function nauticloud_format_size(int $bytes): string
{
    if ($bytes < 1024) {
        return $bytes . ' o';
    }

    $units = ['Ko', 'Mo', 'Go', 'To'];
    $size = $bytes / 1024;
    foreach ($units as $unit) {
        if ($size < 1024) {
            return number_format($size, $size >= 10 ? 1 : 2, ',', ' ') . ' ' . $unit;
        }
        $size /= 1024;
    }

    return number_format($size, 1, ',', ' ') . ' Po';
}

function nauticloud_version_for(string $absolutePath): string
{
    $mtime = file_exists($absolutePath) ? (int) filemtime($absolutePath) : 0;
    $size = is_file($absolutePath) ? (int) filesize($absolutePath) : 0;
    return $mtime . '-' . $size;
}

function nauticloud_item(string $relativePath): array
{
    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, true);
    if (is_link($absolutePath)) {
        throw new InvalidArgumentException('Les liens symboliques ne sont pas pris en charge.');
    }

    $isDir = is_dir($absolutePath);
    $name = $relativePath === '' ? 'NautiCloud' : basename($relativePath);
    $extension = $isDir ? '' : nauticloud_file_extension($absolutePath);
    $mime = nauticloud_detect_mime($absolutePath);
    $kind = nauticloud_file_kind($absolutePath, $extension, $mime);
    $size = $isDir ? 0 : (int) filesize($absolutePath);

    return [
        'id' => sha1($relativePath === '' ? '/' : $relativePath),
        'path' => $relativePath,
        'parentPath' => nauticloud_parent_path($relativePath),
        'name' => $name,
        'type' => $isDir ? 'folder' : 'file',
        'kind' => $kind,
        'extension' => $extension,
        'mime' => $mime,
        'size' => $size,
        'sizeLabel' => $isDir ? '' : nauticloud_format_size($size),
        'modifiedAt' => date(DATE_ATOM, (int) filemtime($absolutePath)),
        'version' => nauticloud_version_for($absolutePath),
        'editable' => nauticloud_is_editable($absolutePath, $kind),
        'previewable' => $isDir || in_array($kind, ['image', 'pdf', 'text', 'audio', 'video'], true),
        'downloadUrl' => $isDir ? null : 'api/download.php?path=' . rawurlencode($relativePath),
        'previewUrl' => $isDir ? null : 'api/preview.php?path=' . rawurlencode($relativePath),
    ];
}

function nauticloud_sort_items(array $items): array
{
    usort($items, static function (array $a, array $b): int {
        if ($a['type'] !== $b['type']) {
            return $a['type'] === 'folder' ? -1 : 1;
        }

        return strnatcasecmp((string) $a['name'], (string) $b['name']);
    });

    return $items;
}

function nauticloud_list_directory(string $relativePath): array
{
    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, true);
    if (!is_dir($absolutePath)) {
        throw new InvalidArgumentException('Ce chemin n est pas un dossier.');
    }

    $items = [];
    $entries = scandir($absolutePath) ?: [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $childAbsolute = $absolutePath . DIRECTORY_SEPARATOR . $entry;
        if (is_link($childAbsolute)) {
            continue;
        }

        $items[] = nauticloud_item(nauticloud_child_relative($relativePath, $entry));
    }

    return nauticloud_sort_items($items);
}

function nauticloud_read_text_file(string $relativePath): array
{
    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, true);
    if (!is_file($absolutePath)) {
        throw new InvalidArgumentException('Ce chemin n est pas un fichier.');
    }

    $item = nauticloud_item($relativePath);
    if (!$item['editable']) {
        throw new InvalidArgumentException('Ce fichier n est pas editable dans NautiCloud.');
    }

    $content = file_get_contents($absolutePath);
    if ($content === false) {
        throw new RuntimeException('Impossible de lire le fichier.');
    }

    return [
        'item' => $item,
        'content' => $content,
        'version' => $item['version'],
    ];
}

function nauticloud_write_text_file(string $relativePath, string $content, ?string $expectedVersion, array $user, bool $force = false): array
{
    if (strlen($content) > NAUTICLOUD_MAX_TEXT_BYTES) {
        throw new InvalidArgumentException('Le fichier est trop volumineux pour l edition en ligne.');
    }

    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, true);
    if (!is_file($absolutePath)) {
        throw new InvalidArgumentException('Ce chemin n est pas un fichier.');
    }

    $item = nauticloud_item($relativePath);
    if (!$item['editable']) {
        throw new InvalidArgumentException('Ce fichier n est pas editable dans NautiCloud.');
    }
    if (!$force && $expectedVersion !== null && $expectedVersion !== '' && $expectedVersion !== $item['version']) {
        nauticloud_json_response([
            'ok' => false,
            'error' => 'version_conflict',
            'message' => 'Une version plus recente existe deja sur le serveur.',
            'item' => $item,
        ], 409);
    }

    $result = file_put_contents($absolutePath, $content, LOCK_EX);
    if ($result === false) {
        throw new RuntimeException('Impossible d enregistrer le fichier.');
    }

    clearstatcache(true, $absolutePath);
    $updatedItem = nauticloud_item($relativePath);
    nauticloud_record_event('file.saved', $relativePath, $user, [
        'item' => $updatedItem,
    ]);

    return [
        'item' => $updatedItem,
        'version' => $updatedItem['version'],
    ];
}

function nauticloud_write_binary_file(string $relativePath, string $tmpName, ?string $expectedVersion, array $user, bool $force = false): array
{
    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, true);
    if (!is_file($absolutePath)) {
        throw new InvalidArgumentException('Ce chemin n est pas un fichier.');
    }

    $item = nauticloud_item($relativePath);
    if (!nauticloud_is_binary_editable($item)) {
        throw new InvalidArgumentException('La sauvegarde binaire est reservee aux tableurs et documents Word.');
    }
    if (!$force && $expectedVersion !== null && $expectedVersion !== '' && $expectedVersion !== $item['version']) {
        nauticloud_json_response([
            'ok' => false,
            'error' => 'version_conflict',
            'message' => 'Une version plus recente existe deja sur le serveur.',
            'item' => $item,
        ], 409);
    }
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new InvalidArgumentException('Fichier sauvegarde invalide.');
    }

    if (!move_uploaded_file($tmpName, $absolutePath)) {
        throw new RuntimeException('Impossible d enregistrer le fichier.');
    }

    clearstatcache(true, $absolutePath);
    $updatedItem = nauticloud_item($relativePath);
    nauticloud_record_event('file.saved', $relativePath, $user, [
        'item' => $updatedItem,
    ]);

    return [
        'item' => $updatedItem,
        'version' => $updatedItem['version'],
    ];
}

function nauticloud_unique_relative_path(string $relativePath): string
{
    $relativePath = nauticloud_relative_path($relativePath);
    $absolutePath = nauticloud_absolute_path($relativePath, false);
    if (!file_exists($absolutePath)) {
        return $relativePath;
    }

    $parent = nauticloud_parent_path($relativePath);
    $name = basename($relativePath);
    $extension = pathinfo($name, PATHINFO_EXTENSION);
    $base = $extension === '' ? $name : mb_substr($name, 0, -1 * (mb_strlen($extension) + 1));

    for ($index = 2; $index < 1000; $index++) {
        $candidateName = $extension === '' ? "{$base} ({$index})" : "{$base} ({$index}).{$extension}";
        $candidate = nauticloud_join_path($parent, $candidateName);
        if (!file_exists(nauticloud_absolute_path($candidate, false))) {
            return $candidate;
        }
    }

    throw new RuntimeException('Impossible de trouver un nom disponible.');
}

function nauticloud_create_folder(string $parentPath, string $name, array $user): array
{
    $relativePath = nauticloud_unique_relative_path(nauticloud_join_path($parentPath, $name));
    $absolutePath = nauticloud_absolute_path($relativePath, false);
    if (!mkdir($absolutePath, 0775, true) && !is_dir($absolutePath)) {
        throw new RuntimeException('Impossible de creer le dossier.');
    }

    $item = nauticloud_item($relativePath);
    nauticloud_record_event('folder.created', $relativePath, $user, ['item' => $item]);
    return $item;
}

function nauticloud_create_file(string $parentPath, string $name, string $content, array $user): array
{
    if (strlen($content) > NAUTICLOUD_MAX_TEXT_BYTES) {
        throw new InvalidArgumentException('Le contenu initial est trop volumineux.');
    }

    $relativePath = nauticloud_unique_relative_path(nauticloud_join_path($parentPath, $name));
    $absolutePath = nauticloud_absolute_path($relativePath, false);
    $bytes = file_put_contents($absolutePath, $content, LOCK_EX);
    if ($bytes === false) {
        throw new RuntimeException('Impossible de creer le fichier.');
    }

    $item = nauticloud_item($relativePath);
    nauticloud_record_event('file.created', $relativePath, $user, ['item' => $item]);
    return $item;
}

function nauticloud_delete_recursive(string $absolutePath): void
{
    if (is_link($absolutePath)) {
        throw new InvalidArgumentException('Les liens symboliques ne sont pas pris en charge.');
    }

    if (is_file($absolutePath)) {
        if (!unlink($absolutePath)) {
            throw new RuntimeException('Impossible de supprimer le fichier.');
        }
        return;
    }

    if (is_dir($absolutePath)) {
        $entries = scandir($absolutePath) ?: [];
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            nauticloud_delete_recursive($absolutePath . DIRECTORY_SEPARATOR . $entry);
        }
        if (!rmdir($absolutePath)) {
            throw new RuntimeException('Impossible de supprimer le dossier.');
        }
        return;
    }

    throw new InvalidArgumentException('Element introuvable.');
}

function nauticloud_delete_paths(array $paths, array $user): array
{
    $deleted = [];
    foreach ($paths as $path) {
        $relativePath = nauticloud_relative_path($path);
        if ($relativePath === '') {
            throw new InvalidArgumentException('La racine NautiCloud ne peut pas etre supprimee.');
        }

        $absolutePath = nauticloud_absolute_path($relativePath, true);
        nauticloud_delete_recursive($absolutePath);
        $deleted[] = $relativePath;
        nauticloud_record_event('item.deleted', $relativePath, $user, ['path' => $relativePath]);
    }

    return $deleted;
}

function nauticloud_copy_recursive(string $sourceAbsolute, string $targetAbsolute): void
{
    if (is_link($sourceAbsolute)) {
        throw new InvalidArgumentException('Les liens symboliques ne sont pas pris en charge.');
    }

    if (is_file($sourceAbsolute)) {
        if (!copy($sourceAbsolute, $targetAbsolute)) {
            throw new RuntimeException('Impossible de copier le fichier.');
        }
        return;
    }

    if (is_dir($sourceAbsolute)) {
        if (!is_dir($targetAbsolute) && !mkdir($targetAbsolute, 0775, true) && !is_dir($targetAbsolute)) {
            throw new RuntimeException('Impossible de creer le dossier copie.');
        }
        $entries = scandir($sourceAbsolute) ?: [];
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            nauticloud_copy_recursive(
                $sourceAbsolute . DIRECTORY_SEPARATOR . $entry,
                $targetAbsolute . DIRECTORY_SEPARATOR . $entry
            );
        }
        return;
    }

    throw new InvalidArgumentException('Element introuvable.');
}

function nauticloud_rename_item(string $relativePath, string $name, array $user): array
{
    $relativePath = nauticloud_relative_path($relativePath);
    if ($relativePath === '') {
        throw new InvalidArgumentException('La racine NautiCloud ne peut pas etre renommee.');
    }

    $sourceAbsolute = nauticloud_absolute_path($relativePath, true);
    $cleanName = nauticloud_clean_name($name);
    if ($cleanName === basename($relativePath)) {
        return nauticloud_item($relativePath);
    }

    $targetRelative = nauticloud_unique_relative_path(nauticloud_join_path(nauticloud_parent_path($relativePath), $cleanName));
    $targetAbsolute = nauticloud_absolute_path($targetRelative, false);
    if (!rename($sourceAbsolute, $targetAbsolute)) {
        throw new RuntimeException('Impossible de renommer l element.');
    }

    $item = nauticloud_item($targetRelative);
    nauticloud_record_event('item.renamed', $targetRelative, $user, [
        'fromPath' => $relativePath,
        'item' => $item,
    ]);

    return $item;
}

function nauticloud_move_paths(array $paths, string $destination, array $user, bool $copy = false): array
{
    $destination = nauticloud_relative_path($destination);
    $destinationAbsolute = nauticloud_absolute_path($destination, true);
    if (!is_dir($destinationAbsolute)) {
        throw new InvalidArgumentException('La destination doit etre un dossier.');
    }

    $items = [];
    foreach ($paths as $path) {
        $sourceRelative = nauticloud_relative_path($path);
        if ($sourceRelative === '') {
            throw new InvalidArgumentException('La racine NautiCloud ne peut pas etre deplacee.');
        }
        if ($destination === $sourceRelative || str_starts_with($destination . '/', $sourceRelative . '/')) {
            throw new InvalidArgumentException('Impossible de placer un dossier dans lui-meme.');
        }

        $sourceAbsolute = nauticloud_absolute_path($sourceRelative, true);
        if (!$copy && $destination === nauticloud_parent_path($sourceRelative)) {
            $items[] = nauticloud_item($sourceRelative);
            continue;
        }

        $targetRelative = nauticloud_unique_relative_path(nauticloud_join_path($destination, basename($sourceRelative)));
        $targetAbsolute = nauticloud_absolute_path($targetRelative, false);

        if ($copy) {
            nauticloud_copy_recursive($sourceAbsolute, $targetAbsolute);
            $event = 'item.copied';
        } else {
            if (!rename($sourceAbsolute, $targetAbsolute)) {
                throw new RuntimeException('Impossible de deplacer l element.');
            }
            $event = 'item.moved';
        }

        $item = nauticloud_item($targetRelative);
        $items[] = $item;
        nauticloud_record_event($event, $targetRelative, $user, [
            'fromPath' => $sourceRelative,
            'item' => $item,
        ]);
    }

    return $items;
}

function nauticloud_upload_files(string $parentPath, array $files, array $user): array
{
    $parentPath = nauticloud_relative_path($parentPath);
    $parentAbsolute = nauticloud_absolute_path($parentPath, true);
    if (!is_dir($parentAbsolute)) {
        throw new InvalidArgumentException('Le dossier cible est introuvable.');
    }

    $uploaded = [];
    $names = $files['name'] ?? [];
    $tmpNames = $files['tmp_name'] ?? [];
    $errors = $files['error'] ?? [];

    if (!is_array($names)) {
        $names = [$names];
        $tmpNames = [$tmpNames];
        $errors = [$errors];
    }

    foreach ($names as $index => $name) {
        $error = (int) ($errors[$index] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Un upload a echoue.');
        }

        $tmpName = (string) ($tmpNames[$index] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new InvalidArgumentException('Upload invalide.');
        }

        $targetRelative = nauticloud_unique_relative_path(nauticloud_join_path($parentPath, (string) $name));
        $targetAbsolute = nauticloud_absolute_path($targetRelative, false);
        if (!move_uploaded_file($tmpName, $targetAbsolute)) {
            throw new RuntimeException('Impossible de stocker le fichier envoye.');
        }

        $item = nauticloud_item($targetRelative);
        $uploaded[] = $item;
        nauticloud_record_event('file.uploaded', $targetRelative, $user, ['item' => $item]);
    }

    return $uploaded;
}

function nauticloud_search(string $query, string $rootPath = ''): array
{
    $query = trim($query);
    if ($query === '') {
        return [];
    }

    $rootPath = nauticloud_relative_path($rootPath);
    $rootAbsolute = nauticloud_absolute_path($rootPath, true);
    if (!is_dir($rootAbsolute)) {
        throw new InvalidArgumentException('La recherche doit partir d un dossier.');
    }

    $rootReal = realpath(nauticloud_storage_root());
    $needle = mb_strtolower($query);
    $results = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($rootAbsolute, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $entry) {
        if (count($results) >= NAUTICLOUD_MAX_SEARCH_RESULTS) {
            break;
        }
        if ($entry->isLink()) {
            continue;
        }

        $name = $entry->getFilename();
        if (!str_contains(mb_strtolower($name), $needle)) {
            continue;
        }

        $absolute = $entry->getPathname();
        if ($rootReal === false || !nauticloud_path_is_inside($absolute, $rootReal)) {
            continue;
        }

        $relative = trim(str_replace('\\', '/', substr($absolute, strlen($rootReal))), '/');
        $results[] = nauticloud_item($relative);
    }

    return nauticloud_sort_items($results);
}

function nauticloud_stats(): array
{
    $root = nauticloud_storage_root();
    $files = 0;
    $folders = 0;
    $bytes = 0;
    $latestMtime = 0;

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $entry) {
        if ($entry->isLink()) {
            continue;
        }
        $latestMtime = max($latestMtime, (int) $entry->getMTime());
        if ($entry->isDir()) {
            $folders++;
            continue;
        }
        if ($entry->isFile()) {
            $files++;
            $bytes += (int) $entry->getSize();
        }
    }

    return [
        'files' => $files,
        'folders' => $folders,
        'bytes' => $bytes,
        'sizeLabel' => nauticloud_format_size($bytes),
        'latestChangeAt' => $latestMtime > 0 ? date(DATE_ATOM, $latestMtime) : null,
    ];
}

function nauticloud_events_file(): string
{
    return nauticloud_meta_dir() . DIRECTORY_SEPARATOR . 'events.jsonl';
}

function nauticloud_counter_file(): string
{
    return nauticloud_meta_dir() . DIRECTORY_SEPARATOR . 'event-counter.txt';
}

function nauticloud_next_event_id(): int
{
    $file = nauticloud_counter_file();
    $handle = fopen($file, 'c+');
    if (!$handle) {
        throw new RuntimeException('Impossible d ouvrir le compteur d evenements.');
    }

    try {
        flock($handle, LOCK_EX);
        $raw = stream_get_contents($handle);
        $id = max(0, (int) trim((string) $raw)) + 1;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) $id);
        fflush($handle);
        flock($handle, LOCK_UN);
        return $id;
    } finally {
        fclose($handle);
    }
}

function nauticloud_latest_event_id(): int
{
    $file = nauticloud_counter_file();
    if (!is_file($file)) {
        return 0;
    }

    return max(0, (int) trim((string) file_get_contents($file)));
}

function nauticloud_record_event(string $type, string $path, array $user, array $payload = []): void
{
    $event = [
        'id' => nauticloud_next_event_id(),
        'type' => $type,
        'path' => nauticloud_relative_path($path),
        'actor' => nauticloud_public_user($user),
        'payload' => $payload,
        'createdAt' => gmdate(DATE_ATOM),
    ];

    $line = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($line === false) {
        return;
    }

    file_put_contents(nauticloud_events_file(), $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function nauticloud_events_since(int $sinceEventId): array
{
    $file = nauticloud_events_file();
    if (!is_file($file)) {
        return [];
    }

    $events = [];
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    foreach ($lines as $line) {
        $event = json_decode($line, true);
        if (!is_array($event) || (int) ($event['id'] ?? 0) <= $sinceEventId) {
            continue;
        }
        $events[] = $event;
    }

    if (count($events) > 100) {
        $events = array_slice($events, -100);
    }

    return $events;
}

function nauticloud_presence_file(): string
{
    return nauticloud_meta_dir() . DIRECTORY_SEPARATOR . 'presence.json';
}

function nauticloud_presence_load_locked($handle): array
{
    rewind($handle);
    $raw = stream_get_contents($handle) ?: '';
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function nauticloud_presence_save_locked($handle, array $presence): void
{
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($presence, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{}');
    fflush($handle);
}

function nauticloud_cleanup_presence(array $presence): array
{
    $now = time();
    return array_filter($presence, static function (array $entry) use ($now): bool {
        return ($now - (int) ($entry['updatedAtUnix'] ?? 0)) <= 45;
    });
}

function nauticloud_update_presence(string $clientId, string $path, array $user, bool $editing): array
{
    $clientId = preg_replace('/[^a-zA-Z0-9_-]/', '', $clientId) ?: '';
    if ($clientId === '') {
        throw new InvalidArgumentException('Client temps reel invalide.');
    }

    $path = nauticloud_relative_path($path);
    $file = nauticloud_presence_file();
    $handle = fopen($file, 'c+');
    if (!$handle) {
        throw new RuntimeException('Presence indisponible.');
    }

    try {
        flock($handle, LOCK_EX);
        $presence = nauticloud_cleanup_presence(nauticloud_presence_load_locked($handle));
        $presence[$clientId] = [
            'clientId' => $clientId,
            'path' => $path,
            'editing' => $editing,
            'user' => nauticloud_public_user($user),
            'updatedAt' => gmdate(DATE_ATOM),
            'updatedAtUnix' => time(),
        ];
        nauticloud_presence_save_locked($handle, $presence);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }

    return nauticloud_list_presence();
}

function nauticloud_remove_presence(string $clientId): array
{
    $clientId = preg_replace('/[^a-zA-Z0-9_-]/', '', $clientId) ?: '';
    if ($clientId === '') {
        return nauticloud_list_presence();
    }

    $file = nauticloud_presence_file();
    $handle = fopen($file, 'c+');
    if (!$handle) {
        return [];
    }

    try {
        flock($handle, LOCK_EX);
        $presence = nauticloud_cleanup_presence(nauticloud_presence_load_locked($handle));
        unset($presence[$clientId]);
        nauticloud_presence_save_locked($handle, $presence);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }

    return nauticloud_list_presence();
}

function nauticloud_list_presence(): array
{
    $file = nauticloud_presence_file();
    if (!is_file($file)) {
        return [];
    }

    $handle = fopen($file, 'c+');
    if (!$handle) {
        return [];
    }

    try {
        flock($handle, LOCK_EX);
        $presence = nauticloud_cleanup_presence(nauticloud_presence_load_locked($handle));
        nauticloud_presence_save_locked($handle, $presence);
        flock($handle, LOCK_UN);
        return array_values($presence);
    } finally {
        fclose($handle);
    }
}
