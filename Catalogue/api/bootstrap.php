<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'Devis' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

final class CatalogueAuthException extends RuntimeException
{
}

final class CatalogueForbiddenException extends RuntimeException
{
}

const CATALOGUE_MAX_UPLOAD_BYTES = 8388608;

function catalogue_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function catalogue_read_json_request(): array
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

function catalogue_pdo(): PDO
{
    $pdo = oceanos_pdo();
    devis_ensure_schema($pdo);
    catalogue_ensure_schema($pdo);
    return $pdo;
}

function catalogue_column_exists(PDO $pdo, string $table, string $column): bool
{
    $config = oceanos_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $statement->execute([
        'db_name' => (string) $config['db_name'],
        'table_name' => $table,
        'column_name' => $column,
    ]);

    return (int) $statement->fetchColumn() > 0;
}

function catalogue_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    if (!catalogue_column_exists($pdo, $table, $column)) {
        $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    }
}

function catalogue_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS catalogue_clients (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(190) NOT NULL,
            company_name VARCHAR(190) NULL,
            phone VARCHAR(80) NULL,
            address VARCHAR(255) NULL,
            city VARCHAR(190) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_login_at DATETIME NULL,
            UNIQUE KEY uniq_catalogue_clients_email (email),
            KEY idx_catalogue_clients_active (is_active, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS catalogue_products (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prestashop_id BIGINT UNSIGNED NULL,
            source VARCHAR(40) NOT NULL DEFAULT 'manual',
            reference VARCHAR(160) NULL,
            sku VARCHAR(160) NULL,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            category VARCHAR(160) NULL,
            brand VARCHAR(160) NULL,
            short_description TEXT NULL,
            description LONGTEXT NULL,
            price_ht DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_rate DECIMAL(8,3) NOT NULL DEFAULT 20,
            stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
            unit VARCHAR(50) NOT NULL DEFAULT 'piece',
            active TINYINT(1) NOT NULL DEFAULT 1,
            featured TINYINT(1) NOT NULL DEFAULT 0,
            image_path VARCHAR(500) NULL,
            prestashop_image_id BIGINT UNSIGNED NULL,
            prestashop_updated_at VARCHAR(80) NULL,
            synced_at DATETIME NULL,
            prestashop_sync_locked TINYINT(1) NOT NULL DEFAULT 0,
            local_override_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_catalogue_products_prestashop (prestashop_id),
            UNIQUE KEY uniq_catalogue_products_sku (sku),
            KEY idx_catalogue_products_public (active, featured, name),
            KEY idx_catalogue_products_reference (reference),
            KEY idx_catalogue_products_source (source)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS catalogue_product_images (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            product_id BIGINT UNSIGNED NOT NULL,
            image_path VARCHAR(500) NOT NULL,
            alt_text VARCHAR(190) NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_primary TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_catalogue_images_product (product_id, sort_order, id),
            CONSTRAINT fk_catalogue_images_product FOREIGN KEY (product_id) REFERENCES catalogue_products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS catalogue_orders (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_id BIGINT UNSIGNED NOT NULL,
            quote_id BIGINT UNSIGNED NULL,
            reference VARCHAR(120) NOT NULL,
            status VARCHAR(80) NOT NULL DEFAULT 'Devis genere',
            total_ht DECIMAL(14,6) NOT NULL DEFAULT 0,
            total_ttc DECIMAL(14,6) NOT NULL DEFAULT 0,
            lines_json LONGTEXT NULL,
            client_snapshot_json LONGTEXT NULL,
            message TEXT NULL,
            pdf_file_path VARCHAR(500) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_catalogue_orders_reference (reference),
            KEY idx_catalogue_orders_client (client_id, created_at),
            KEY idx_catalogue_orders_quote (quote_id),
            CONSTRAINT fk_catalogue_orders_client FOREIGN KEY (client_id) REFERENCES catalogue_clients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    catalogue_ensure_column($pdo, 'catalogue_products', 'prestashop_image_id', 'BIGINT UNSIGNED NULL');
    catalogue_ensure_column($pdo, 'catalogue_products', 'sku', 'VARCHAR(160) NULL AFTER reference');
    catalogue_ensure_column($pdo, 'catalogue_products', 'prestashop_sync_locked', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER synced_at');
    catalogue_ensure_column($pdo, 'catalogue_products', 'local_override_at', 'DATETIME NULL AFTER prestashop_sync_locked');
    catalogue_ensure_column($pdo, 'catalogue_orders', 'pdf_file_path', 'VARCHAR(500) NULL');
    catalogue_backfill_product_skus($pdo);
    catalogue_ensure_unique_sku_index($pdo);
}

function catalogue_index_exists(PDO $pdo, string $table, string $index): bool
{
    $config = oceanos_config();
    $statement = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
    );
    $statement->execute([
        'db_name' => (string) $config['db_name'],
        'table_name' => $table,
        'index_name' => $index,
    ]);

    return (int) $statement->fetchColumn() > 0;
}

function catalogue_normalize_sku(mixed $value): string
{
    $sku = catalogue_clean_text($value, 160);
    $sku = function_exists('mb_strtoupper') ? mb_strtoupper($sku, 'UTF-8') : strtoupper($sku);
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $sku);
    if ($converted !== false) {
        $sku = $converted;
    }
    $sku = preg_replace('/[^A-Z0-9._-]+/', '-', $sku) ?? '';
    return substr(trim($sku, '-'), 0, 160);
}

function catalogue_unique_sku_from_base(PDO $pdo, string $base, int $productId = 0, array &$seen = []): string
{
    $baseSku = catalogue_normalize_sku($base);
    if ($baseSku === '') {
        $baseSku = $productId > 0 ? 'CAT-' . $productId : 'CAT-' . date('YmdHis');
    }

    $sku = $baseSku;
    $suffix = 2;
    while (catalogue_sku_exists($pdo, $sku, $productId) || isset($seen[$sku])) {
        $sku = substr($baseSku, 0, 150) . '-' . $suffix;
        $suffix++;
    }
    $seen[$sku] = true;

    return $sku;
}

function catalogue_backfill_product_skus(PDO $pdo): void
{
    if (!catalogue_column_exists($pdo, 'catalogue_products', 'sku')) {
        return;
    }

    $existingRows = $pdo->query("SELECT sku FROM catalogue_products WHERE sku IS NOT NULL AND sku <> ''")->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $seen = [];
    foreach ($existingRows as $sku) {
        $normalized = catalogue_normalize_sku($sku);
        if ($normalized !== '') {
            $seen[$normalized] = true;
        }
    }

    $rows = $pdo->query(
        "SELECT id, reference, prestashop_id, name
         FROM catalogue_products
         WHERE sku IS NULL OR sku = ''
         ORDER BY id ASC"
    )->fetchAll() ?: [];
    if ($rows === []) {
        return;
    }

    $statement = $pdo->prepare('UPDATE catalogue_products SET sku = :sku WHERE id = :id');
    foreach ($rows as $row) {
        $base = (string) (($row['reference'] ?? '') ?: ($row['prestashop_id'] ? 'PS-' . $row['prestashop_id'] : 'CAT-' . $row['id']));
        $sku = catalogue_unique_sku_from_base($pdo, $base, (int) $row['id'], $seen);
        $statement->execute([
            'sku' => $sku,
            'id' => (int) $row['id'],
        ]);
    }
}

function catalogue_ensure_unique_sku_index(PDO $pdo): void
{
    if (catalogue_index_exists($pdo, 'catalogue_products', 'uniq_catalogue_products_sku')) {
        return;
    }

    $duplicates = $pdo->query(
        "SELECT sku
         FROM catalogue_products
         WHERE sku IS NOT NULL AND sku <> ''
         GROUP BY sku
         HAVING COUNT(*) > 1
         LIMIT 1"
    )->fetchColumn();
    if ($duplicates !== false) {
        return;
    }

    $pdo->exec('ALTER TABLE catalogue_products ADD UNIQUE KEY uniq_catalogue_products_sku (sku)');
}

function catalogue_sku_exists(PDO $pdo, string $sku, int $excludeProductId = 0): bool
{
    $sku = catalogue_normalize_sku($sku);
    if ($sku === '') {
        return false;
    }

    $sql = 'SELECT id FROM catalogue_products WHERE sku = :sku';
    $params = ['sku' => $sku];
    if ($excludeProductId > 0) {
        $sql .= ' AND id <> :id';
        $params['id'] = $excludeProductId;
    }
    $sql .= ' LIMIT 1';

    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchColumn() !== false;
}

function catalogue_is_admin(?array $user): bool
{
    return is_array($user) && in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function catalogue_require_admin(PDO $pdo): array
{
    $user = oceanos_current_user($pdo);
    if (!catalogue_is_admin($user)) {
        throw new CatalogueForbiddenException('Acces backoffice reserve aux administrateurs OceanOS.');
    }
    if (catalogue_current_client($pdo) !== null) {
        throw new CatalogueForbiddenException('Deconnectez la session client catalogue avant d ouvrir le backoffice.');
    }

    return $user;
}

function catalogue_normalize_email(mixed $email): string
{
    return strtolower(trim((string) $email));
}

function catalogue_decimal(mixed $value): float
{
    if (is_string($value)) {
        $value = str_replace(',', '.', trim($value));
    }
    $number = (float) $value;
    return is_finite($number) ? $number : 0.0;
}

function catalogue_clean_text(mixed $value, int $maxLength = 0): string
{
    $text = html_entity_decode(strip_tags((string) ($value ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    $length = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
    if ($maxLength > 0 && $length > $maxLength) {
        return function_exists('mb_substr') ? mb_substr($text, 0, $maxLength) : substr($text, 0, $maxLength);
    }

    return $text;
}

function catalogue_slug(mixed $value): string
{
    $text = catalogue_clean_text($value, 180);
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if ($converted === false) {
        $converted = $text;
    }
    $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $converted));
    $slug = trim($slug, '-');
    return $slug !== '' ? $slug : 'produit';
}

function catalogue_safe_filename(mixed $value): string
{
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string) $value);
    if ($converted === false) {
        $converted = (string) $value;
    }
    $filename = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $converted) ?? '';
    $filename = trim($filename, '-');
    return substr($filename !== '' ? $filename : 'image', 0, 80);
}

function catalogue_start_session(): void
{
    oceanos_start_session();
}

function catalogue_public_client(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => (string) ($row['email'] ?? ''),
        'displayName' => (string) ($row['display_name'] ?? ''),
        'companyName' => (string) ($row['company_name'] ?? ''),
        'phone' => (string) ($row['phone'] ?? ''),
        'address' => (string) ($row['address'] ?? ''),
        'city' => (string) ($row['city'] ?? ''),
    ];
}

function catalogue_find_client_by_email(PDO $pdo, string $email): ?array
{
    $statement = $pdo->prepare('SELECT * FROM catalogue_clients WHERE email = :email LIMIT 1');
    $statement->execute(['email' => catalogue_normalize_email($email)]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function catalogue_find_client_by_id(PDO $pdo, int $clientId): ?array
{
    if ($clientId <= 0) {
        return null;
    }

    $statement = $pdo->prepare('SELECT * FROM catalogue_clients WHERE id = :id AND is_active = 1 LIMIT 1');
    $statement->execute(['id' => $clientId]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function catalogue_current_client(PDO $pdo): ?array
{
    catalogue_start_session();
    $clientId = isset($_SESSION['catalogue_client_id']) ? (int) $_SESSION['catalogue_client_id'] : 0;
    $client = catalogue_find_client_by_id($pdo, $clientId);
    if ($client === null) {
        unset($_SESSION['catalogue_client_id']);
        return null;
    }

    return $client;
}

function catalogue_require_client(PDO $pdo): array
{
    $client = catalogue_current_client($pdo);
    if ($client === null) {
        throw new CatalogueAuthException('Connectez-vous au catalogue pour voir les prix et commander.');
    }

    return $client;
}

function catalogue_login_client(PDO $pdo, array $input): array
{
    $email = catalogue_normalize_email($input['email'] ?? '');
    $password = (string) ($input['password'] ?? '');
    if ($email === '' || $password === '') {
        throw new InvalidArgumentException('Email et mot de passe obligatoires.');
    }

    $client = catalogue_find_client_by_email($pdo, $email);
    if (!is_array($client) || (int) ($client['is_active'] ?? 0) !== 1 || !password_verify($password, (string) ($client['password_hash'] ?? ''))) {
        throw new CatalogueAuthException('Identifiants catalogue invalides.');
    }

    catalogue_start_session();
    $_SESSION['catalogue_client_id'] = (int) $client['id'];
    $statement = $pdo->prepare('UPDATE catalogue_clients SET last_login_at = NOW() WHERE id = :id');
    $statement->execute(['id' => (int) $client['id']]);

    return catalogue_public_client($client);
}

function catalogue_register_client(PDO $pdo, array $input): array
{
    $email = catalogue_normalize_email($input['email'] ?? '');
    $password = (string) ($input['password'] ?? '');
    $displayName = catalogue_clean_text($input['displayName'] ?? $input['display_name'] ?? '', 190);
    $companyName = catalogue_clean_text($input['companyName'] ?? $input['company_name'] ?? '', 190);
    if ($displayName === '') {
        $displayName = $companyName !== '' ? $companyName : $email;
    }

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email catalogue invalide.');
    }
    if (strlen($password) < 8) {
        throw new InvalidArgumentException('Le mot de passe doit contenir au moins 8 caracteres.');
    }
    if (catalogue_find_client_by_email($pdo, $email) !== null) {
        throw new InvalidArgumentException('Un compte catalogue existe deja avec cet email.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO catalogue_clients
            (email, password_hash, display_name, company_name, phone, address, city)
         VALUES
            (:email, :password_hash, :display_name, :company_name, :phone, :address, :city)'
    );
    $statement->execute([
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'display_name' => $displayName,
        'company_name' => $companyName !== '' ? $companyName : null,
        'phone' => catalogue_clean_text($input['phone'] ?? '', 80) ?: null,
        'address' => catalogue_clean_text($input['address'] ?? '', 255) ?: null,
        'city' => catalogue_clean_text($input['city'] ?? '', 190) ?: null,
    ]);

    $client = catalogue_find_client_by_id($pdo, (int) $pdo->lastInsertId());
    if (!is_array($client)) {
        throw new RuntimeException('Compte catalogue introuvable apres creation.');
    }

    catalogue_start_session();
    $_SESSION['catalogue_client_id'] = (int) $client['id'];

    return catalogue_public_client($client);
}

function catalogue_logout_client(): void
{
    catalogue_start_session();
    unset($_SESSION['catalogue_client_id']);
}

function catalogue_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (!isset($xml->{$container}->{$nodeName})) {
        if (!isset($xml->{$nodeName})) {
            return [];
        }
        $nodes = [];
        foreach ($xml->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    $nodes = [];
    foreach ($xml->{$container}->{$nodeName} as $node) {
        $nodes[] = $node;
    }

    return $nodes;
}

function catalogue_product_image_url(array $product, array $images = []): string
{
    $localPath = trim((string) ($product['image_path'] ?? ''));
    if ($localPath !== '') {
        return '/Catalogue/' . str_replace('\\', '/', ltrim($localPath, '/\\'));
    }

    if ($images !== []) {
        $first = $images[0];
        $imagePath = trim((string) ($first['image_path'] ?? ''));
        if ($imagePath !== '') {
            return '/Catalogue/' . str_replace('\\', '/', ltrim($imagePath, '/\\'));
        }
    }

    $prestashopId = (int) ($product['prestashop_id'] ?? 0);
    $prestashopImageId = (int) ($product['prestashop_image_id'] ?? 0);
    if ($prestashopId > 0 && $prestashopImageId > 0) {
        return '/Catalogue/api/catalogue.php?action=prestashop_image&product_id=' . $prestashopId . '&image_id=' . $prestashopImageId;
    }

    return '';
}

function catalogue_images_by_product_ids(PDO $pdo, array $productIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $productIds), static fn(int $id): bool => $id > 0)));
    if ($ids === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = $pdo->prepare('SELECT * FROM catalogue_product_images WHERE product_id IN (' . $placeholders . ') ORDER BY is_primary DESC, sort_order ASC, id ASC');
    $statement->execute($ids);
    $imagesByProduct = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $productId = (int) $row['product_id'];
        $imagesByProduct[$productId][] = [
            'id' => (int) $row['id'],
            'imagePath' => (string) ($row['image_path'] ?? ''),
            'imageUrl' => '/Catalogue/' . str_replace('\\', '/', ltrim((string) ($row['image_path'] ?? ''), '/\\')),
            'altText' => (string) ($row['alt_text'] ?? ''),
            'isPrimary' => (int) ($row['is_primary'] ?? 0) === 1,
        ];
    }

    return $imagesByProduct;
}

function catalogue_public_product(array $row, bool $includePrices = false, array $images = []): array
{
    $product = [
        'id' => (int) $row['id'],
        'prestashopId' => isset($row['prestashop_id']) ? (int) $row['prestashop_id'] : null,
        'source' => (string) ($row['source'] ?? 'manual'),
        'reference' => (string) ($row['reference'] ?? ''),
        'sku' => (string) ($row['sku'] ?? ''),
        'name' => (string) ($row['name'] ?? ''),
        'slug' => (string) ($row['slug'] ?? ''),
        'category' => (string) ($row['category'] ?? ''),
        'brand' => (string) ($row['brand'] ?? ''),
        'shortDescription' => (string) ($row['short_description'] ?? ''),
        'description' => (string) ($row['description'] ?? ''),
        'taxRate' => (float) ($row['tax_rate'] ?? 20),
        'stockQuantity' => (float) ($row['stock_quantity'] ?? 0),
        'unit' => (string) ($row['unit'] ?? 'piece'),
        'active' => (int) ($row['active'] ?? 1) === 1,
        'featured' => (int) ($row['featured'] ?? 0) === 1,
        'prestashopSyncLocked' => (int) ($row['prestashop_sync_locked'] ?? 0) === 1,
        'localOverrideAt' => (string) ($row['local_override_at'] ?? ''),
        'imageUrl' => catalogue_product_image_url($row, $images),
        'images' => $images,
        'syncedAt' => (string) ($row['synced_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];

    if ($includePrices) {
        $product['priceHt'] = (float) ($row['price_ht'] ?? 0);
        $product['priceTtc'] = round((float) ($row['price_ht'] ?? 0) * (1 + ((float) ($row['tax_rate'] ?? 20) / 100)), 6);
    }

    return $product;
}

function catalogue_list_products(PDO $pdo, bool $includeInactive = false, bool $includePrices = false): array
{
    $sql = 'SELECT * FROM catalogue_products';
    if (!$includeInactive) {
        $sql .= ' WHERE active = 1';
    }
    $sql .= ' ORDER BY featured DESC, name ASC, id DESC LIMIT 1000';
    $rows = $pdo->query($sql)->fetchAll() ?: [];
    $imagesByProduct = catalogue_images_by_product_ids($pdo, array_map(static fn(array $row): int => (int) $row['id'], $rows));

    return array_map(
        static fn(array $row): array => catalogue_public_product($row, $includePrices, $imagesByProduct[(int) $row['id']] ?? []),
        $rows
    );
}

function catalogue_admin_orders(PDO $pdo): array
{
    $rows = $pdo->query(
        "SELECT o.*, c.email, c.display_name, c.company_name
         FROM catalogue_orders o
         JOIN catalogue_clients c ON c.id = o.client_id
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 200"
    )->fetchAll() ?: [];

    return array_map(static fn(array $row): array => catalogue_public_order($row, true), $rows);
}

function catalogue_client_orders(PDO $pdo, int $clientId): array
{
    $statement = $pdo->prepare('SELECT * FROM catalogue_orders WHERE client_id = :client_id ORDER BY created_at DESC, id DESC LIMIT 100');
    $statement->execute(['client_id' => $clientId]);
    return array_map(static fn(array $row): array => catalogue_public_order($row, false), $statement->fetchAll() ?: []);
}

function catalogue_public_order(array $row, bool $admin = false): array
{
    $payload = [
        'id' => (int) $row['id'],
        'quoteId' => isset($row['quote_id']) ? (int) $row['quote_id'] : null,
        'reference' => (string) ($row['reference'] ?? ''),
        'status' => (string) ($row['status'] ?? ''),
        'totalHt' => (float) ($row['total_ht'] ?? 0),
        'totalTtc' => (float) ($row['total_ttc'] ?? 0),
        'lines' => devis_parse_lines($row['lines_json'] ?? null),
        'message' => (string) ($row['message'] ?? ''),
        'pdfUrl' => '/Catalogue/api/catalogue.php?action=download_order&id=' . (int) $row['id'],
        'createdAt' => (string) ($row['created_at'] ?? ''),
    ];

    if ($admin) {
        $payload['clientEmail'] = (string) ($row['email'] ?? '');
        $payload['clientName'] = (string) (($row['company_name'] ?? '') ?: ($row['display_name'] ?? ''));
    }

    return $payload;
}

function catalogue_admin_stats(PDO $pdo): array
{
    return [
        'products' => (int) $pdo->query('SELECT COUNT(*) FROM catalogue_products')->fetchColumn(),
        'activeProducts' => (int) $pdo->query('SELECT COUNT(*) FROM catalogue_products WHERE active = 1')->fetchColumn(),
        'prestashopProducts' => (int) $pdo->query("SELECT COUNT(*) FROM catalogue_products WHERE source = 'prestashop'")->fetchColumn(),
        'lockedPrestashopProducts' => (int) $pdo->query("SELECT COUNT(*) FROM catalogue_products WHERE source = 'prestashop' AND prestashop_sync_locked = 1")->fetchColumn(),
        'manualProducts' => (int) $pdo->query("SELECT COUNT(*) FROM catalogue_products WHERE source = 'manual'")->fetchColumn(),
        'orders' => (int) $pdo->query('SELECT COUNT(*) FROM catalogue_orders')->fetchColumn(),
    ];
}

function catalogue_dashboard(PDO $pdo): array
{
    $internalUser = oceanos_current_user($pdo);
    $client = catalogue_current_client($pdo);
    $isAdmin = catalogue_is_admin($internalUser);
    $isBackoffice = $isAdmin && $client === null;
    $canSeePrices = $client !== null || $isBackoffice;

    $payload = [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'clientAuthenticated' => $client !== null,
        'client' => $client ? catalogue_public_client($client) : null,
        'internalUser' => $isBackoffice && $internalUser ? oceanos_public_user($internalUser) : null,
        'isBackoffice' => $isBackoffice,
        'canSeePrices' => $canSeePrices,
        'products' => catalogue_list_products($pdo, false, $canSeePrices),
        'orders' => $client ? catalogue_client_orders($pdo, (int) $client['id']) : [],
        'company' => devis_public_company_settings($pdo),
    ];

    if ($isBackoffice) {
        $payload['backoffice'] = [
            'products' => catalogue_list_products($pdo, true, true),
            'orders' => catalogue_admin_orders($pdo),
            'stats' => catalogue_admin_stats($pdo),
            'prestashop' => oceanos_prestashop_public_settings($pdo, true),
        ];
    }

    return $payload;
}

function catalogue_fetch_prestashop_products(PDO $pdo, int $limit = 500): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $query = [
        'display' => 'full',
        'sort' => '[name_ASC]',
        'limit' => '0,' . max(1, min(1000, $limit)),
    ];
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'products', $query));
    $products = [];

    foreach (catalogue_collect_nodes($xml, 'products', 'product') as $node) {
        $id = (int) oceanos_xml_text($node, 'id');
        if ($id <= 0) {
            continue;
        }
        $name = catalogue_clean_text(oceanos_xml_language_value($node, 'name'), 255);
        $products[] = [
            'prestashop_id' => $id,
            'reference' => catalogue_clean_text(oceanos_xml_text($node, 'reference'), 160),
            'sku' => catalogue_normalize_sku(oceanos_xml_text($node, 'reference') ?: ('PS-' . $id)),
            'name' => $name !== '' ? $name : 'Produit #' . $id,
            'short_description' => catalogue_clean_text(oceanos_xml_language_value($node, 'description_short'), 600),
            'description' => catalogue_clean_text(oceanos_xml_language_value($node, 'description'), 8000),
            'price_ht' => max(0.0, catalogue_decimal(oceanos_xml_text($node, 'price'))),
            'tax_rate' => 20.0,
            'active' => oceanos_xml_text($node, 'active') !== '0' ? 1 : 0,
            'prestashop_image_id' => (int) oceanos_xml_text($node, 'id_default_image') ?: null,
            'prestashop_updated_at' => oceanos_xml_text($node, 'date_upd'),
        ];
    }

    return $products;
}

function catalogue_sync_prestashop(PDO $pdo): array
{
    $products = catalogue_fetch_prestashop_products($pdo);
    $statement = $pdo->prepare(
        'INSERT INTO catalogue_products
            (prestashop_id, source, reference, sku, name, slug, short_description, description, price_ht, tax_rate, active, prestashop_image_id, prestashop_updated_at, synced_at)
         VALUES
            (:prestashop_id, "prestashop", :reference, :sku, :name, :slug, :short_description, :description, :price_ht, :tax_rate, :active, :prestashop_image_id, :prestashop_updated_at, NOW())
         ON DUPLICATE KEY UPDATE
            source = "prestashop",
            reference = CASE WHEN prestashop_sync_locked = 1 THEN reference ELSE VALUES(reference) END,
            sku = CASE WHEN prestashop_sync_locked = 1 THEN sku ELSE VALUES(sku) END,
            name = CASE WHEN prestashop_sync_locked = 1 THEN name ELSE VALUES(name) END,
            slug = CASE WHEN prestashop_sync_locked = 1 THEN slug ELSE VALUES(slug) END,
            short_description = CASE WHEN prestashop_sync_locked = 1 THEN short_description ELSE VALUES(short_description) END,
            description = CASE WHEN prestashop_sync_locked = 1 THEN description ELSE VALUES(description) END,
            price_ht = CASE WHEN prestashop_sync_locked = 1 THEN price_ht ELSE VALUES(price_ht) END,
            tax_rate = CASE WHEN prestashop_sync_locked = 1 THEN tax_rate ELSE VALUES(tax_rate) END,
            active = CASE WHEN prestashop_sync_locked = 1 THEN active ELSE VALUES(active) END,
            prestashop_image_id = CASE WHEN prestashop_sync_locked = 1 THEN prestashop_image_id ELSE VALUES(prestashop_image_id) END,
            prestashop_updated_at = VALUES(prestashop_updated_at),
            synced_at = NOW(),
            updated_at = CASE WHEN prestashop_sync_locked = 1 THEN updated_at ELSE NOW() END'
    );

    foreach ($products as $product) {
        $existingId = 0;
        $existingStatement = $pdo->prepare('SELECT id FROM catalogue_products WHERE prestashop_id = :prestashop_id LIMIT 1');
        $existingStatement->execute(['prestashop_id' => (int) $product['prestashop_id']]);
        $existingId = (int) ($existingStatement->fetchColumn() ?: 0);
        $seen = [];
        $sku = catalogue_unique_sku_from_base($pdo, (string) ($product['sku'] ?? ''), $existingId, $seen);
        $statement->execute([
            'prestashop_id' => $product['prestashop_id'],
            'reference' => $product['reference'] ?: null,
            'sku' => $sku,
            'name' => $product['name'],
            'slug' => catalogue_slug($product['name'] . '-' . $product['prestashop_id']),
            'short_description' => $product['short_description'] ?: null,
            'description' => $product['description'] ?: null,
            'price_ht' => number_format((float) $product['price_ht'], 6, '.', ''),
            'tax_rate' => number_format((float) $product['tax_rate'], 3, '.', ''),
            'active' => (int) $product['active'],
            'prestashop_image_id' => $product['prestashop_image_id'],
            'prestashop_updated_at' => $product['prestashop_updated_at'] ?: null,
        ]);
    }

    return [
        'count' => count($products),
        'products' => catalogue_list_products($pdo, true, true),
        'stats' => catalogue_admin_stats($pdo),
    ];
}

function catalogue_save_product(PDO $pdo, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $existingProduct = null;
    if ($id > 0) {
        $existingStatement = $pdo->prepare('SELECT * FROM catalogue_products WHERE id = :id LIMIT 1');
        $existingStatement->execute(['id' => $id]);
        $existingProduct = $existingStatement->fetch();
        if (!is_array($existingProduct)) {
            throw new InvalidArgumentException('Produit introuvable.');
        }
    }
    $name = catalogue_clean_text($input['name'] ?? '', 255);
    if ($name === '') {
        throw new InvalidArgumentException('Nom du produit obligatoire.');
    }
    $sku = catalogue_normalize_sku($input['sku'] ?? '');
    if ($sku === '') {
        $sku = catalogue_unique_sku_from_base($pdo, (string) (($input['reference'] ?? '') ?: $name), $id);
    }
    if (catalogue_sku_exists($pdo, $sku, $id)) {
        throw new InvalidArgumentException('Ce SKU est deja utilise par un autre produit.');
    }

    $params = [
        'reference' => catalogue_clean_text($input['reference'] ?? '', 160) ?: null,
        'sku' => $sku,
        'name' => $name,
        'slug' => catalogue_slug($name . '-' . $sku),
        'category' => catalogue_clean_text($input['category'] ?? '', 160) ?: null,
        'brand' => catalogue_clean_text($input['brand'] ?? '', 160) ?: null,
        'short_description' => catalogue_clean_text($input['shortDescription'] ?? $input['short_description'] ?? '', 600) ?: null,
        'description' => catalogue_clean_text($input['description'] ?? '', 8000) ?: null,
        'price_ht' => number_format(max(0.0, catalogue_decimal($input['priceHt'] ?? $input['price_ht'] ?? 0)), 6, '.', ''),
        'tax_rate' => number_format(max(0.0, catalogue_decimal($input['taxRate'] ?? $input['tax_rate'] ?? 20)), 3, '.', ''),
        'stock_quantity' => number_format(max(0.0, catalogue_decimal($input['stockQuantity'] ?? $input['stock_quantity'] ?? 0)), 3, '.', ''),
        'unit' => catalogue_clean_text($input['unit'] ?? 'piece', 50) ?: 'piece',
        'active' => !empty($input['active']) ? 1 : 0,
        'featured' => !empty($input['featured']) ? 1 : 0,
    ];

    if ($id > 0) {
        $params['id'] = $id;
        $lockPrestashopSync = ((int) ($existingProduct['prestashop_id'] ?? 0) > 0 || (string) ($existingProduct['source'] ?? '') === 'prestashop');
        $params['prestashop_sync_locked'] = $lockPrestashopSync ? 1 : (int) ($existingProduct['prestashop_sync_locked'] ?? 0);
        $params['local_override_locked'] = $params['prestashop_sync_locked'];
        $statement = $pdo->prepare(
            'UPDATE catalogue_products
             SET reference = :reference,
                 sku = :sku,
                 name = :name,
                 slug = :slug,
                 category = :category,
                 brand = :brand,
                 short_description = :short_description,
                 description = :description,
                 price_ht = :price_ht,
                 tax_rate = :tax_rate,
                 stock_quantity = :stock_quantity,
                 unit = :unit,
                 active = :active,
                 featured = :featured,
                 prestashop_sync_locked = :prestashop_sync_locked,
                 local_override_at = CASE WHEN :local_override_locked = 1 THEN NOW() ELSE local_override_at END,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $statement->execute($params);
    } else {
        $statement = $pdo->prepare(
            'INSERT INTO catalogue_products
                (source, reference, sku, name, slug, category, brand, short_description, description, price_ht, tax_rate, stock_quantity, unit, active, featured)
             VALUES
                ("manual", :reference, :sku, :name, :slug, :category, :brand, :short_description, :description, :price_ht, :tax_rate, :stock_quantity, :unit, :active, :featured)'
        );
        $statement->execute($params);
        $id = (int) $pdo->lastInsertId();
    }

    $statement = $pdo->prepare('SELECT * FROM catalogue_products WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Produit introuvable apres sauvegarde.');
    }

    $imagesByProduct = catalogue_images_by_product_ids($pdo, [$id]);
    return catalogue_public_product($row, true, $imagesByProduct[$id] ?? []);
}

function catalogue_disable_product(PDO $pdo, int $id): void
{
    if ($id <= 0) {
        throw new InvalidArgumentException('Produit invalide.');
    }
    $statement = $pdo->prepare(
        'UPDATE catalogue_products
         SET active = 0,
             prestashop_sync_locked = CASE WHEN prestashop_id IS NOT NULL THEN 1 ELSE prestashop_sync_locked END,
             local_override_at = CASE WHEN prestashop_id IS NOT NULL THEN NOW() ELSE local_override_at END,
             updated_at = NOW()
         WHERE id = :id'
    );
    $statement->execute(['id' => $id]);
}

function catalogue_upload_dir(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'products';
}

function catalogue_ensure_upload_dir(): void
{
    $dir = catalogue_upload_dir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de creer le dossier photos catalogue.');
    }
    if (!is_writable($dir)) {
        @chmod($dir, 0775);
    }
    if (!is_writable($dir)) {
        throw new RuntimeException('Le dossier photos catalogue n est pas accessible en ecriture.');
    }
}

function catalogue_uploaded_files(): array
{
    $entry = $_FILES['images'] ?? ($_FILES['image'] ?? null);
    if (!is_array($entry)) {
        return [];
    }

    if (is_array($entry['name'] ?? null)) {
        $files = [];
        foreach ($entry['name'] as $index => $name) {
            $files[] = [
                'name' => $name,
                'type' => $entry['type'][$index] ?? '',
                'tmp_name' => $entry['tmp_name'][$index] ?? '',
                'error' => $entry['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $entry['size'][$index] ?? 0,
            ];
        }
        return $files;
    }

    return [$entry];
}

function catalogue_upload_images(PDO $pdo, int $productId): array
{
    if ($productId <= 0) {
        throw new InvalidArgumentException('Produit invalide pour l ajout de photos.');
    }

    $statement = $pdo->prepare('SELECT id, image_path, name, source, prestashop_id FROM catalogue_products WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $productId]);
    $product = $statement->fetch();
    if (!is_array($product)) {
        throw new InvalidArgumentException('Produit introuvable pour l ajout de photos.');
    }

    catalogue_ensure_upload_dir();
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    $uploaded = [];

    foreach (catalogue_uploaded_files() as $file) {
        if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        if ((int) ($file['size'] ?? 0) <= 0 || (int) ($file['size'] ?? 0) > CATALOGUE_MAX_UPLOAD_BYTES) {
            throw new InvalidArgumentException('Photo trop volumineuse. Limite 8 Mo.');
        }
        $tmpPath = (string) ($file['tmp_name'] ?? '');
        $info = @getimagesize($tmpPath);
        $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
        if (!isset($allowed[$mime])) {
            throw new InvalidArgumentException('Format photo non supporte. Utilisez JPG, PNG, WebP ou GIF.');
        }

        $filename = 'product-' . $productId . '-' . catalogue_safe_filename(pathinfo((string) ($file['name'] ?? 'image'), PATHINFO_FILENAME)) . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
        $absolutePath = catalogue_upload_dir() . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($tmpPath, $absolutePath)) {
            throw new RuntimeException('Impossible d enregistrer la photo envoyee.');
        }

        $relativePath = 'storage/products/' . $filename;
        $isPrimary = trim((string) ($product['image_path'] ?? '')) === '' && $uploaded === [];
        $insert = $pdo->prepare(
            'INSERT INTO catalogue_product_images (product_id, image_path, alt_text, sort_order, is_primary)
             VALUES (:product_id, :image_path, :alt_text, :sort_order, :is_primary)'
        );
        $insert->execute([
            'product_id' => $productId,
            'image_path' => $relativePath,
            'alt_text' => (string) ($product['name'] ?? ''),
            'sort_order' => count($uploaded),
            'is_primary' => $isPrimary ? 1 : 0,
        ]);
        if ($isPrimary) {
            $update = $pdo->prepare(
                'UPDATE catalogue_products
                 SET image_path = :image_path,
                     prestashop_sync_locked = CASE WHEN prestashop_id IS NOT NULL THEN 1 ELSE prestashop_sync_locked END,
                     local_override_at = CASE WHEN prestashop_id IS NOT NULL THEN NOW() ELSE local_override_at END
                 WHERE id = :id'
            );
            $update->execute(['image_path' => $relativePath, 'id' => $productId]);
        }
        $uploaded[] = $relativePath;
    }

    if ($uploaded === []) {
        throw new InvalidArgumentException('Aucune photo valide recue.');
    }
    if ((int) ($product['prestashop_id'] ?? 0) > 0 || (string) ($product['source'] ?? '') === 'prestashop') {
        $lock = $pdo->prepare('UPDATE catalogue_products SET prestashop_sync_locked = 1, local_override_at = NOW(), updated_at = NOW() WHERE id = :id');
        $lock->execute(['id' => $productId]);
    }

    $statement = $pdo->prepare('SELECT * FROM catalogue_products WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $productId]);
    $row = $statement->fetch();
    $imagesByProduct = catalogue_images_by_product_ids($pdo, [$productId]);

    return [
        'uploaded' => $uploaded,
        'product' => is_array($row) ? catalogue_public_product($row, true, $imagesByProduct[$productId] ?? []) : null,
    ];
}

function catalogue_next_order_reference(PDO $pdo): string
{
    $year = date('Y');
    $prefix = 'CAT-' . $year . '-';
    $statement = $pdo->prepare('SELECT reference FROM catalogue_orders WHERE reference LIKE :prefix');
    $statement->execute(['prefix' => $prefix . '%']);

    $max = 0;
    foreach ($statement->fetchAll(PDO::FETCH_COLUMN) ?: [] as $reference) {
        if (preg_match('/^CAT-' . preg_quote($year, '/') . '-(\d+)$/', (string) $reference, $matches)) {
            $max = max($max, (int) $matches[1]);
        }
    }

    return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
}

function catalogue_quote_owner_user(PDO $pdo): array
{
    $row = $pdo->query(
        "SELECT * FROM oceanos_users
         WHERE is_active = 1 AND role IN ('super', 'admin')
         ORDER BY FIELD(role, 'super', 'admin'), id ASC
         LIMIT 1"
    )->fetch();

    if (!is_array($row)) {
        $row = $pdo->query('SELECT * FROM oceanos_users WHERE is_active = 1 ORDER BY id ASC LIMIT 1')->fetch();
    }

    if (!is_array($row)) {
        throw new RuntimeException('Aucun utilisateur OceanOS actif pour rattacher le devis.');
    }

    return $row;
}

function catalogue_products_by_ids(PDO $pdo, array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $id): bool => $id > 0)));
    if ($ids === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $statement = $pdo->prepare('SELECT * FROM catalogue_products WHERE active = 1 AND id IN (' . $placeholders . ')');
    $statement->execute($ids);
    $products = [];
    foreach ($statement->fetchAll() ?: [] as $row) {
        $products[(int) $row['id']] = $row;
    }

    return $products;
}

function catalogue_place_order(PDO $pdo, array $input): array
{
    $client = catalogue_require_client($pdo);
    $items = is_array($input['items'] ?? null) ? $input['items'] : [];
    if ($items === []) {
        throw new InvalidArgumentException('Votre panier est vide.');
    }

    $quantities = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $productId = (int) ($item['productId'] ?? $item['product_id'] ?? 0);
        $quantity = max(0.0, catalogue_decimal($item['quantity'] ?? 0));
        if ($productId > 0 && $quantity > 0) {
            $quantities[$productId] = min(999.0, ($quantities[$productId] ?? 0) + $quantity);
        }
    }
    if ($quantities === []) {
        throw new InvalidArgumentException('Votre panier ne contient aucun produit valide.');
    }

    $products = catalogue_products_by_ids($pdo, array_keys($quantities));
    $lines = [];
    foreach ($quantities as $productId => $quantity) {
        if (!isset($products[$productId])) {
            continue;
        }
        $product = $products[$productId];
        $unitPrice = max(0.0, catalogue_decimal($product['price_ht'] ?? 0));
        $taxRate = max(0.0, catalogue_decimal($product['tax_rate'] ?? 20));
        $lines[] = [
            'line_type' => 'product',
            'product_id' => (int) $product['id'],
            'product_reference' => (string) (($product['sku'] ?? '') ?: ($product['reference'] ?? '')),
            'name' => (string) ($product['name'] ?? ('Produit #' . $productId)),
            'quantity' => $quantity,
            'catalog_price_ht' => $unitPrice,
            'unit_price_ht' => $unitPrice,
            'tax_rate' => $taxRate,
            'price_mode' => 'standard',
            'b2b_percent' => null,
        ];
    }

    if ($lines === []) {
        throw new InvalidArgumentException('Aucun produit actif dans le panier.');
    }

    $message = catalogue_clean_text($input['message'] ?? '', 1200);
    $snapshot = [
        'clientId' => (int) $client['id'],
        'displayName' => (string) ($client['display_name'] ?? ''),
        'companyName' => (string) ($client['company_name'] ?? ''),
        'email' => (string) ($client['email'] ?? ''),
        'phone' => (string) ($client['phone'] ?? ''),
        'address' => (string) ($client['address'] ?? ''),
        'city' => (string) ($client['city'] ?? ''),
        'message' => $message,
    ];
    $clientName = trim((string) (($client['company_name'] ?? '') ?: ($client['display_name'] ?? 'Client catalogue')));
    $quoteOwner = catalogue_quote_owner_user($pdo);
    $quote = devis_save_quote($pdo, $quoteOwner, [
        'client_name' => $clientName,
        'client_email' => (string) ($client['email'] ?? ''),
        'status' => 'Envoye',
        'lines' => $lines,
    ]);

    $reference = catalogue_next_order_reference($pdo);
    $statement = $pdo->prepare(
        'INSERT INTO catalogue_orders
            (client_id, quote_id, reference, status, total_ht, total_ttc, lines_json, client_snapshot_json, message, pdf_file_path)
         VALUES
            (:client_id, :quote_id, :reference, :status, :total_ht, :total_ttc, :lines_json, :client_snapshot_json, :message, :pdf_file_path)'
    );
    $statement->execute([
        'client_id' => (int) $client['id'],
        'quote_id' => (int) ($quote['id'] ?? 0) ?: null,
        'reference' => $reference,
        'status' => 'Devis genere',
        'total_ht' => number_format((float) ($quote['total_ht'] ?? 0), 6, '.', ''),
        'total_ttc' => number_format((float) ($quote['total_ttc'] ?? 0), 6, '.', ''),
        'lines_json' => json_encode($lines, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'client_snapshot_json' => json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'message' => $message !== '' ? $message : null,
        'pdf_file_path' => (string) ($quote['pdf_file_path'] ?? ''),
    ]);

    $orderId = (int) $pdo->lastInsertId();
    catalogue_notify_order($pdo, $quoteOwner, $reference, $clientName, (float) ($quote['total_ttc'] ?? 0));
    $orders = catalogue_client_orders($pdo, (int) $client['id']);

    return [
        'order' => $orders[0] ?? null,
        'orders' => $orders,
        'quote' => $quote,
        'orderId' => $orderId,
    ];
}

function catalogue_notify_order(PDO $pdo, array $ownerUser, string $reference, string $clientName, float $totalTtc): void
{
    if (!function_exists('oceanos_create_notification')) {
        return;
    }

    try {
        oceanos_create_notification(
            $pdo,
            (int) $ownerUser['id'],
            null,
            'Catalogue',
            'catalogue_order',
            'info',
            'Nouvelle commande catalogue',
            $reference . ' - ' . $clientName . ' - ' . devis_format_money($totalTtc),
            '/Catalogue/',
            ['reference' => $reference],
            'catalogue_order_' . $reference
        );
    } catch (Throwable) {
    }
}

function catalogue_download_order_pdf(PDO $pdo, int $orderId): void
{
    if ($orderId <= 0) {
        catalogue_json_response(['ok' => false, 'message' => 'Commande invalide.'], 422);
    }

    $client = catalogue_current_client($pdo);
    $internalUser = oceanos_current_user($pdo);
    $isBackoffice = catalogue_is_admin($internalUser) && $client === null;

    if ($isBackoffice) {
        $statement = $pdo->prepare('SELECT * FROM catalogue_orders WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $orderId]);
    } elseif ($client !== null) {
        $statement = $pdo->prepare('SELECT * FROM catalogue_orders WHERE id = :id AND client_id = :client_id LIMIT 1');
        $statement->execute(['id' => $orderId, 'client_id' => (int) $client['id']]);
    } else {
        catalogue_json_response(['ok' => false, 'message' => 'Connectez-vous pour telecharger ce devis.'], 401);
    }

    $order = $statement->fetch();
    if (!is_array($order)) {
        catalogue_json_response(['ok' => false, 'message' => 'Commande introuvable.'], 404);
    }

    $path = devis_pdf_absolute_path($order['pdf_file_path'] ?? '');
    if ($path === '' || !is_file($path)) {
        catalogue_json_response(['ok' => false, 'message' => 'PDF introuvable.'], 404);
    }

    $filename = devis_safe_filename((string) ($order['reference'] ?? 'devis-catalogue')) . '.pdf';
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function catalogue_proxy_prestashop_image(PDO $pdo, int $productId, int $imageId): void
{
    if ($productId <= 0 || $imageId <= 0) {
        http_response_code(404);
        exit;
    }

    $statement = $pdo->prepare('SELECT * FROM catalogue_products WHERE active = 1 AND prestashop_id = :product_id AND prestashop_image_id = :image_id LIMIT 1');
    $statement->execute([
        'product_id' => $productId,
        'image_id' => $imageId,
    ]);
    if (!is_array($statement->fetch())) {
        http_response_code(404);
        exit;
    }

    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $body = oceanos_prestashop_get($shopUrl, $apiKey, 'images/products/' . $productId . '/' . $imageId);
    $info = @getimagesizefromstring($body);
    if (!is_array($info) || empty($info['mime'])) {
        http_response_code(404);
        exit;
    }

    header('Content-Type: ' . (string) $info['mime']);
    header('Cache-Control: public, max-age=86400');
    echo $body;
    exit;
}
