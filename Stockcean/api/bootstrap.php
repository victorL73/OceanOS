<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function stockcean_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function stockcean_read_json_request(): array
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

function stockcean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    stockcean_ensure_schema($pdo);
    return $pdo;
}

function stockcean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stockcean_suppliers (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prestashop_supplier_id BIGINT UNSIGNED NULL UNIQUE,
            name VARCHAR(190) NOT NULL,
            contact_name VARCHAR(190) NULL,
            email VARCHAR(190) NULL,
            phone VARCHAR(60) NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_stockcean_supplier_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stockcean_products (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prestashop_product_id BIGINT UNSIGNED NOT NULL UNIQUE,
            reference VARCHAR(120) NULL,
            name VARCHAR(255) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            price_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            quantity INT NOT NULL DEFAULT 0,
            reserved_quantity INT NOT NULL DEFAULT 0,
            min_stock_alert INT UNSIGNED NOT NULL DEFAULT 5,
            supplier_id BIGINT UNSIGNED NULL,
            prestashop_supplier_id BIGINT UNSIGNED NULL,
            raw_json LONGTEXT NULL,
            source_hash CHAR(64) NOT NULL DEFAULT '',
            synced_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_stockcean_product_reference (reference),
            KEY idx_stockcean_product_name (name),
            KEY idx_stockcean_product_quantity (quantity),
            KEY idx_stockcean_product_supplier (supplier_id),
            CONSTRAINT fk_stockcean_product_supplier FOREIGN KEY (supplier_id) REFERENCES stockcean_suppliers(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stockcean_purchase_orders (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_number VARCHAR(80) NOT NULL UNIQUE,
            supplier_id BIGINT UNSIGNED NULL,
            user_id BIGINT UNSIGNED NULL,
            status ENUM('draft', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
            expected_at DATE NULL,
            total_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_stockcean_po_supplier (supplier_id),
            KEY idx_stockcean_po_status (status),
            CONSTRAINT fk_stockcean_po_supplier FOREIGN KEY (supplier_id) REFERENCES stockcean_suppliers(id) ON DELETE SET NULL,
            CONSTRAINT fk_stockcean_po_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stockcean_purchase_order_lines (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            purchase_order_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NULL,
            label VARCHAR(255) NOT NULL,
            quantity_ordered INT UNSIGNED NOT NULL DEFAULT 1,
            quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
            unit_price_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_stockcean_po_line_order (purchase_order_id),
            KEY idx_stockcean_po_line_product (product_id),
            CONSTRAINT fk_stockcean_po_line_order FOREIGN KEY (purchase_order_id) REFERENCES stockcean_purchase_orders(id) ON DELETE CASCADE,
            CONSTRAINT fk_stockcean_po_line_product FOREIGN KEY (product_id) REFERENCES stockcean_products(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS stockcean_sync_runs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME NULL,
            products_seen INT UNSIGNED NOT NULL DEFAULT 0,
            products_created INT UNSIGNED NOT NULL DEFAULT 0,
            products_updated INT UNSIGNED NOT NULL DEFAULT 0,
            suppliers_seen INT UNSIGNED NOT NULL DEFAULT 0,
            message TEXT NULL,
            raw_summary_json LONGTEXT NULL,
            KEY idx_stockcean_sync_started (started_at),
            CONSTRAINT fk_stockcean_sync_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function stockcean_require_admin(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    if (!in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true)) {
        stockcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function stockcean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function stockcean_money(string $value): string
{
    $normalized = str_replace(',', '.', trim($value));
    if ($normalized === '' || !is_numeric($normalized)) {
        return '0';
    }

    return number_format((float) $normalized, 6, '.', '');
}

function stockcean_plain_xml(SimpleXMLElement $node): array
{
    $encoded = json_encode($node, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $decoded = $encoded ? json_decode($encoded, true) : null;
    return is_array($decoded) ? $decoded : [];
}

function stockcean_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (!isset($xml->{$container}->{$nodeName})) {
        return [];
    }

    $nodes = [];
    foreach ($xml->{$container}->{$nodeName} as $node) {
        $nodes[] = $node;
    }

    return $nodes;
}

function stockcean_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return stockcean_collect_nodes($xml, $container, $nodeName);
}

function stockcean_fetch_products(string $shopUrl, string $apiKey, int $limit): array
{
    $query = [
        'display' => '[id,reference,name,price,active,id_supplier,id_manufacturer,date_upd]',
        'sort' => '[id_ASC]',
        'limit' => '0,' . max(1, min(500, $limit)),
    ];

    try {
        return stockcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'products', 'products', 'product', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }

        $query['display'] = 'full';
        return stockcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'products', 'products', 'product', $query);
    }
}

function stockcean_fetch_stock_availables(string $shopUrl, string $apiKey, int $limit): array
{
    return stockcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'stock_availables', 'stock_availables', 'stock_available', [
        'display' => '[id,id_product,id_product_attribute,quantity]',
        'sort' => '[id_product_ASC]',
        'limit' => '0,' . max(1, min(1500, $limit)),
    ]);
}

function stockcean_fetch_suppliers(string $shopUrl, string $apiKey, int $limit = 500): array
{
    try {
        return stockcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'suppliers', 'suppliers', 'supplier', [
            'display' => '[id,name,active]',
            'sort' => '[name_ASC]',
            'limit' => '0,' . max(1, min(500, $limit)),
        ]);
    } catch (OceanosPrestashopException $exception) {
        if (in_array($exception->statusCode, [401, 403, 404], true)) {
            return [];
        }
        throw $exception;
    }
}

function stockcean_stock_map(array $stockNodes): array
{
    $map = [];
    foreach ($stockNodes as $node) {
        $productId = (int) oceanos_xml_text($node, 'id_product');
        if ($productId <= 0) {
            continue;
        }
        $map[$productId] = ($map[$productId] ?? 0) + (int) oceanos_xml_text($node, 'quantity');
    }

    return $map;
}

function stockcean_upsert_supplier(PDO $pdo, array $supplier): string
{
    $statement = $pdo->prepare('SELECT id, name FROM stockcean_suppliers WHERE prestashop_supplier_id = :prestashop_supplier_id LIMIT 1');
    $statement->execute(['prestashop_supplier_id' => $supplier['prestashopSupplierId']]);
    $existing = $statement->fetch();

    $upsert = $pdo->prepare(
        'INSERT INTO stockcean_suppliers (prestashop_supplier_id, name)
         VALUES (:prestashop_supplier_id, :name)
         ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
        'prestashop_supplier_id' => $supplier['prestashopSupplierId'],
        'name' => $supplier['name'],
    ]);

    return is_array($existing) ? ((string) $existing['name'] === $supplier['name'] ? 'unchanged' : 'updated') : 'created';
}

function stockcean_supplier_map(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, prestashop_supplier_id FROM stockcean_suppliers WHERE prestashop_supplier_id IS NOT NULL')->fetchAll();
    $map = [];
    foreach ($rows as $row) {
        $map[(int) $row['prestashop_supplier_id']] = (int) $row['id'];
    }

    return $map;
}

function stockcean_normalize_product(SimpleXMLElement $node, array $stockMap, array $supplierMap): array
{
    $prestashopProductId = (int) oceanos_xml_text($node, 'id');
    $prestashopSupplierId = (int) oceanos_xml_text($node, 'id_supplier');
    $name = oceanos_xml_language_value($node, 'name');
    if ($name === '') {
        $name = 'Produit #' . $prestashopProductId;
    }

    $raw = stockcean_plain_xml($node);
    $payload = [
        'prestashopProductId' => $prestashopProductId,
        'reference' => oceanos_xml_text($node, 'reference'),
        'name' => $name,
        'active' => oceanos_xml_text($node, 'active') !== '0',
        'priceTaxExcl' => stockcean_money(oceanos_xml_text($node, 'price')),
        'quantity' => (int) ($stockMap[$prestashopProductId] ?? 0),
        'supplierId' => $supplierMap[$prestashopSupplierId] ?? null,
        'prestashopSupplierId' => $prestashopSupplierId > 0 ? $prestashopSupplierId : null,
        'raw' => $raw,
    ];
    $payload['sourceHash'] = hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    return $payload;
}

function stockcean_upsert_product(PDO $pdo, array $product): string
{
    $statement = $pdo->prepare('SELECT id, source_hash FROM stockcean_products WHERE prestashop_product_id = :prestashop_product_id LIMIT 1');
    $statement->execute(['prestashop_product_id' => $product['prestashopProductId']]);
    $existing = $statement->fetch();

    $upsert = $pdo->prepare(
        'INSERT INTO stockcean_products
            (prestashop_product_id, reference, name, active, price_tax_excl, quantity, supplier_id, prestashop_supplier_id, raw_json, source_hash, synced_at)
         VALUES
            (:prestashop_product_id, :reference, :name, :active, :price_tax_excl, :quantity, :supplier_id, :prestashop_supplier_id, :raw_json, :source_hash, NOW())
         ON DUPLICATE KEY UPDATE
            reference = VALUES(reference),
            name = VALUES(name),
            active = VALUES(active),
            price_tax_excl = VALUES(price_tax_excl),
            quantity = VALUES(quantity),
            supplier_id = COALESCE(VALUES(supplier_id), supplier_id),
            prestashop_supplier_id = VALUES(prestashop_supplier_id),
            raw_json = VALUES(raw_json),
            source_hash = VALUES(source_hash),
            synced_at = NOW(),
            updated_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
        'prestashop_product_id' => $product['prestashopProductId'],
        'reference' => $product['reference'] !== '' ? $product['reference'] : null,
        'name' => $product['name'],
        'active' => $product['active'] ? 1 : 0,
        'price_tax_excl' => $product['priceTaxExcl'],
        'quantity' => $product['quantity'],
        'supplier_id' => $product['supplierId'],
        'prestashop_supplier_id' => $product['prestashopSupplierId'],
        'raw_json' => json_encode($product['raw'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'source_hash' => $product['sourceHash'],
    ]);

    if (!is_array($existing)) {
        return 'created';
    }

    return hash_equals((string) $existing['source_hash'], (string) $product['sourceHash']) ? 'unchanged' : 'updated';
}

function stockcean_stock_alert_rows(PDO $pdo, int $limit = 100): array
{
    $statement = $pdo->prepare(
        'SELECT p.*, s.name AS supplier_name
         FROM stockcean_products p
         LEFT JOIN stockcean_suppliers s ON s.id = p.supplier_id
         WHERE p.quantity <= p.min_stock_alert
         ORDER BY (p.quantity <= 0) DESC, p.quantity ASC, p.name ASC
         LIMIT :limit'
    );
    $statement->bindValue(':limit', max(1, min(200, $limit)), PDO::PARAM_INT);
    $statement->execute();

    return $statement->fetchAll();
}

function stockcean_notify_stock_alerts(PDO $pdo, ?int $actorUserId = null): int
{
    $adminUserIds = oceanos_active_user_ids($pdo, ['super', 'admin']);
    if ($adminUserIds === []) {
        return 0;
    }

    $alerts = stockcean_stock_alert_rows($pdo);
    foreach ($alerts as $product) {
        $quantity = (int) ($product['quantity'] ?? 0);
        $threshold = (int) ($product['min_stock_alert'] ?? 0);
        $isOut = $quantity <= 0;
        $type = $isOut ? 'stock.out' : 'stock.low';
        $severity = $isOut ? 'danger' : 'warning';
        $title = $isOut ? 'Rupture de stock' : 'Stock bas';
        $reference = trim((string) ($product['reference'] ?? ''));
        $name = trim((string) ($product['name'] ?? 'Produit'));
        $label = $reference !== '' ? $reference . ' - ' . $name : $name;
        $body = sprintf('%s est a %d unite(s), seuil %d.', $label, $quantity, $threshold);
        $actionUrl = $isOut ? '/Stockcean/?stock=out' : '/Stockcean/?stock=low';

        foreach ($adminUserIds as $userId) {
            oceanos_create_notification(
                $pdo,
                $userId,
                $actorUserId,
                'Stockcean',
                $type,
                $severity,
                $title,
                $body,
                $actionUrl,
                [
                    'productId' => (int) $product['id'],
                    'prestashopProductId' => (int) $product['prestashop_product_id'],
                    'reference' => $reference,
                    'quantity' => $quantity,
                    'threshold' => $threshold,
                    'supplierName' => (string) ($product['supplier_name'] ?? ''),
                ],
                'stockcean:stock_alert:' . (int) $product['id']
            );
        }
    }

    return count($alerts);
}

function stockcean_create_sync_run(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare('INSERT INTO stockcean_sync_runs (user_id, status) VALUES (:user_id, "running")');
    $statement->execute(['user_id' => $userId]);
    return (int) $pdo->lastInsertId();
}

function stockcean_finish_sync_run(PDO $pdo, int $runId, string $status, array $counts, string $message, array $summary = []): array
{
    $statement = $pdo->prepare(
        'UPDATE stockcean_sync_runs
         SET status = :status,
             finished_at = NOW(),
             products_seen = :products_seen,
             products_created = :products_created,
             products_updated = :products_updated,
             suppliers_seen = :suppliers_seen,
             message = :message,
             raw_summary_json = :raw_summary_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $runId,
        'status' => $status,
        'products_seen' => (int) ($counts['seen'] ?? 0),
        'products_created' => (int) ($counts['created'] ?? 0),
        'products_updated' => (int) ($counts['updated'] ?? 0),
        'suppliers_seen' => (int) ($counts['suppliers'] ?? 0),
        'message' => $message,
        'raw_summary_json' => json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $run = stockcean_get_sync_run($pdo, $runId);
    if ($run === null) {
        throw new RuntimeException('Journal de synchronisation introuvable.');
    }

    return $run;
}

function stockcean_sync_prestashop(PDO $pdo, array $user, array $options = []): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $limit = max(10, min(500, (int) ($options['limit'] ?? 250)));
    $runId = stockcean_create_sync_run($pdo, (int) $user['id']);
    $counts = ['seen' => 0, 'created' => 0, 'updated' => 0, 'suppliers' => 0];

    try {
        $supplierNodes = stockcean_fetch_suppliers($shopUrl, $apiKey);
        foreach ($supplierNodes as $node) {
            $supplierId = (int) oceanos_xml_text($node, 'id');
            $name = oceanos_xml_text($node, 'name');
            if ($supplierId > 0 && $name !== '') {
                stockcean_upsert_supplier($pdo, [
                    'prestashopSupplierId' => $supplierId,
                    'name' => $name,
                ]);
                $counts['suppliers']++;
            }
        }

        $supplierMap = stockcean_supplier_map($pdo);
        $stockMap = stockcean_stock_map(stockcean_fetch_stock_availables($shopUrl, $apiKey, 1500));
        $productNodes = stockcean_fetch_products($shopUrl, $apiKey, $limit);

        foreach ($productNodes as $node) {
            $product = stockcean_normalize_product($node, $stockMap, $supplierMap);
            if ($product['prestashopProductId'] <= 0) {
                continue;
            }
            $counts['seen']++;
            $result = stockcean_upsert_product($pdo, $product);
            if ($result === 'created') {
                $counts['created']++;
            } elseif ($result === 'updated') {
                $counts['updated']++;
            }
        }

        $alertCount = stockcean_notify_stock_alerts($pdo, (int) $user['id']);
        $message = sprintf('%d produit(s) lu(s), %d cree(s), %d mis a jour.', $counts['seen'], $counts['created'], $counts['updated']);
        if ($alertCount > 0) {
            $message .= sprintf(' %d alerte(s) stock envoyee(s).', $alertCount);
        }

        return stockcean_finish_sync_run($pdo, $runId, 'success', $counts, $message, [
            'limit' => $limit,
            'shopUrl' => $shopUrl,
            'stockAlerts' => $alertCount,
        ]);
    } catch (Throwable $exception) {
        stockcean_finish_sync_run($pdo, $runId, 'failed', $counts, $exception->getMessage(), [
            'limit' => $limit,
            'shopUrl' => $shopUrl ?? '',
        ]);
        throw $exception;
    }
}

function stockcean_product_filters(array $input): array
{
    $where = [];
    $params = [];

    $search = trim((string) ($input['search'] ?? ''));
    if ($search !== '') {
        $where[] = '(p.name LIKE :search OR p.reference LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $stock = trim((string) ($input['stock'] ?? ''));
    if ($stock === 'low') {
        $where[] = 'p.quantity <= p.min_stock_alert';
    } elseif ($stock === 'out') {
        $where[] = 'p.quantity <= 0';
    }

    $active = trim((string) ($input['active'] ?? ''));
    if ($active === '1' || $active === '0') {
        $where[] = 'p.active = :active';
        $params['active'] = (int) $active;
    }

    return [
        'sql' => $where === [] ? '1 = 1' : implode(' AND ', $where),
        'params' => $params,
    ];
}

function stockcean_public_product(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'prestashopProductId' => (int) $row['prestashop_product_id'],
        'reference' => (string) ($row['reference'] ?? ''),
        'name' => (string) ($row['name'] ?? ''),
        'active' => (bool) ($row['active'] ?? false),
        'priceTaxExcl' => (float) ($row['price_tax_excl'] ?? 0),
        'quantity' => (int) ($row['quantity'] ?? 0),
        'reservedQuantity' => (int) ($row['reserved_quantity'] ?? 0),
        'minStockAlert' => (int) ($row['min_stock_alert'] ?? 5),
        'supplierId' => isset($row['supplier_id']) ? (int) $row['supplier_id'] : null,
        'supplierName' => (string) ($row['supplier_name'] ?? ''),
        'prestashopSupplierId' => isset($row['prestashop_supplier_id']) ? (int) $row['prestashop_supplier_id'] : null,
        'isLowStock' => (int) ($row['quantity'] ?? 0) <= (int) ($row['min_stock_alert'] ?? 5),
        'syncedAt' => (string) ($row['synced_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function stockcean_list_products(PDO $pdo, array $input): array
{
    $limit = max(10, min(500, (int) ($input['limit'] ?? 80)));
    $filters = stockcean_product_filters($input);

    $statement = $pdo->prepare(
        'SELECT p.*, s.name AS supplier_name
         FROM stockcean_products p
         LEFT JOIN stockcean_suppliers s ON s.id = p.supplier_id
         WHERE ' . $filters['sql'] . '
         ORDER BY (p.quantity <= p.min_stock_alert) DESC, p.quantity ASC, p.name ASC
         LIMIT :limit'
    );
    foreach ($filters['params'] as $key => $value) {
        $statement->bindValue(':' . $key, $value);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->execute();

    return array_map(static fn(array $row): array => stockcean_public_product($row), $statement->fetchAll());
}

function stockcean_supplier_catalog(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT p.*, s.name AS supplier_name
         FROM stockcean_products p
         LEFT JOIN stockcean_suppliers s ON s.id = p.supplier_id
         ORDER BY COALESCE(s.name, "Sans fournisseur") ASC, p.name ASC
         LIMIT 1000'
    )->fetchAll();

    return array_map(static fn(array $row): array => stockcean_public_product($row), $rows);
}

function stockcean_stats(PDO $pdo): array
{
    $row = $pdo->query(
        'SELECT
            COUNT(*) AS product_count,
            COALESCE(SUM(quantity <= min_stock_alert), 0) AS low_stock_count,
            COALESCE(SUM(quantity <= 0), 0) AS out_stock_count,
            COALESCE(SUM(quantity * price_tax_excl), 0) AS stock_value
         FROM stockcean_products'
    )->fetch() ?: [];

    $purchase = $pdo->query(
        "SELECT
            COALESCE(SUM(status = 'draft'), 0) AS draft_count,
            COALESCE(SUM(status = 'ordered'), 0) AS ordered_count
         FROM stockcean_purchase_orders"
    )->fetch() ?: [];

    return [
        'productCount' => (int) ($row['product_count'] ?? 0),
        'lowStockCount' => (int) ($row['low_stock_count'] ?? 0),
        'outStockCount' => (int) ($row['out_stock_count'] ?? 0),
        'stockValue' => (float) ($row['stock_value'] ?? 0),
        'draftPurchaseOrders' => (int) ($purchase['draft_count'] ?? 0),
        'orderedPurchaseOrders' => (int) ($purchase['ordered_count'] ?? 0),
    ];
}

function stockcean_public_supplier(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'prestashopSupplierId' => isset($row['prestashop_supplier_id']) ? (int) $row['prestashop_supplier_id'] : null,
        'name' => (string) ($row['name'] ?? ''),
        'contactName' => (string) ($row['contact_name'] ?? ''),
        'email' => (string) ($row['email'] ?? ''),
        'phone' => (string) ($row['phone'] ?? ''),
        'notes' => (string) ($row['notes'] ?? ''),
        'productCount' => (int) ($row['product_count'] ?? 0),
    ];
}

function stockcean_list_suppliers(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT s.*, COUNT(p.id) AS product_count
         FROM stockcean_suppliers s
         LEFT JOIN stockcean_products p ON p.supplier_id = s.id
         GROUP BY s.id
         ORDER BY s.name ASC'
    )->fetchAll();

    return array_map(static fn(array $row): array => stockcean_public_supplier($row), $rows);
}

function stockcean_save_supplier(PDO $pdo, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') {
        throw new InvalidArgumentException('Le nom du fournisseur est obligatoire.');
    }

    $params = [
        'name' => $name,
        'contact_name' => trim((string) ($input['contactName'] ?? '')) ?: null,
        'email' => trim((string) ($input['email'] ?? '')) ?: null,
        'phone' => trim((string) ($input['phone'] ?? '')) ?: null,
        'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
    ];

    if ($id > 0) {
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE stockcean_suppliers
             SET name = :name, contact_name = :contact_name, email = :email, phone = :phone, notes = :notes
             WHERE id = :id'
        );
        $statement->execute($params);
    } else {
        $statement = $pdo->prepare(
            'INSERT INTO stockcean_suppliers (name, contact_name, email, phone, notes)
             VALUES (:name, :contact_name, :email, :phone, :notes)'
        );
        $statement->execute($params);
        $id = (int) $pdo->lastInsertId();
    }

    $fetch = $pdo->prepare(
        'SELECT s.*, COUNT(p.id) AS product_count
         FROM stockcean_suppliers s
         LEFT JOIN stockcean_products p ON p.supplier_id = s.id
         WHERE s.id = :id
         GROUP BY s.id'
    );
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Fournisseur introuvable apres sauvegarde.');
    }

    return stockcean_public_supplier($row);
}

function stockcean_update_product(PDO $pdo, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        throw new InvalidArgumentException('Produit invalide.');
    }

    $minStockAlert = max(0, min(999999, (int) ($input['minStockAlert'] ?? 5)));
    $supplierId = (int) ($input['supplierId'] ?? 0);
    $statement = $pdo->prepare(
        'UPDATE stockcean_products
         SET min_stock_alert = :min_stock_alert,
             supplier_id = :supplier_id
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $id,
        'min_stock_alert' => $minStockAlert,
        'supplier_id' => $supplierId > 0 ? $supplierId : null,
    ]);

    $fetch = $pdo->prepare(
        'SELECT p.*, s.name AS supplier_name
         FROM stockcean_products p
         LEFT JOIN stockcean_suppliers s ON s.id = p.supplier_id
         WHERE p.id = :id
         LIMIT 1'
    );
    $fetch->execute(['id' => $id]);
    $row = $fetch->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Produit introuvable.');
    }

    if ((int) ($row['quantity'] ?? 0) <= (int) ($row['min_stock_alert'] ?? 0)) {
        stockcean_notify_stock_alerts($pdo);
    }

    return stockcean_public_product($row);
}

function stockcean_next_order_number(): string
{
    return 'SC-' . date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
}

function stockcean_create_purchase_order(PDO $pdo, array $user, array $input): array
{
    $lines = $input['lines'] ?? [];
    if (!is_array($lines) || $lines === []) {
        throw new InvalidArgumentException('Ajoutez au moins une ligne de commande fournisseur.');
    }

    $supplierId = (int) ($input['supplierId'] ?? 0);
    $expectedAt = trim((string) ($input['expectedAt'] ?? ''));
    if ($expectedAt !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedAt)) {
        throw new InvalidArgumentException('Date de livraison invalide.');
    }

    $pdo->beginTransaction();
    try {
        $orderNumber = stockcean_next_order_number();
        $statement = $pdo->prepare(
            'INSERT INTO stockcean_purchase_orders (order_number, supplier_id, user_id, expected_at, notes)
             VALUES (:order_number, :supplier_id, :user_id, :expected_at, :notes)'
        );
        $statement->execute([
            'order_number' => $orderNumber,
            'supplier_id' => $supplierId > 0 ? $supplierId : null,
            'user_id' => (int) $user['id'],
            'expected_at' => $expectedAt !== '' ? $expectedAt : null,
            'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
        ]);
        $orderId = (int) $pdo->lastInsertId();
        $total = 0.0;

        $lineInsert = $pdo->prepare(
            'INSERT INTO stockcean_purchase_order_lines
                (purchase_order_id, product_id, label, quantity_ordered, unit_price_tax_excl)
             VALUES
                (:purchase_order_id, :product_id, :label, :quantity_ordered, :unit_price_tax_excl)'
        );
        foreach ($lines as $line) {
            if (!is_array($line)) {
                continue;
            }
            $label = trim((string) ($line['label'] ?? ''));
            $productId = (int) ($line['productId'] ?? 0);
            if ($label === '' && $productId > 0) {
                $product = stockcean_get_product_row($pdo, $productId);
                $label = (string) ($product['name'] ?? '');
            }
            $quantity = max(1, min(999999, (int) ($line['quantity'] ?? 1)));
            $unitPrice = (float) stockcean_money((string) ($line['unitPriceTaxExcl'] ?? '0'));
            if ($label === '') {
                throw new InvalidArgumentException('Chaque ligne doit avoir un libelle ou un produit.');
            }
            $total += $quantity * $unitPrice;
            $lineInsert->execute([
                'purchase_order_id' => $orderId,
                'product_id' => $productId > 0 ? $productId : null,
                'label' => $label,
                'quantity_ordered' => $quantity,
                'unit_price_tax_excl' => number_format($unitPrice, 6, '.', ''),
            ]);
        }

        $updateTotal = $pdo->prepare('UPDATE stockcean_purchase_orders SET total_tax_excl = :total WHERE id = :id');
        $updateTotal->execute([
            'id' => $orderId,
            'total' => number_format($total, 6, '.', ''),
        ]);

        $pdo->commit();
        return stockcean_get_purchase_order($pdo, $orderId);
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}

function stockcean_get_product_row(PDO $pdo, int $productId): array
{
    $statement = $pdo->prepare('SELECT * FROM stockcean_products WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $productId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Produit introuvable.');
    }

    return $row;
}

function stockcean_public_order(array $row, array $lines = []): array
{
    return [
        'id' => (int) $row['id'],
        'orderNumber' => (string) $row['order_number'],
        'supplierId' => isset($row['supplier_id']) ? (int) $row['supplier_id'] : null,
        'supplierName' => (string) ($row['supplier_name'] ?? ''),
        'status' => (string) ($row['status'] ?? 'draft'),
        'expectedAt' => (string) ($row['expected_at'] ?? ''),
        'totalTaxExcl' => (float) ($row['total_tax_excl'] ?? 0),
        'notes' => (string) ($row['notes'] ?? ''),
        'lineCount' => (int) ($row['line_count'] ?? count($lines)),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'userEmail' => (string) ($row['user_email'] ?? ''),
        'lines' => $lines,
    ];
}

function stockcean_public_order_line(array $line): array
{
    return [
        'id' => (int) $line['id'],
        'productId' => isset($line['product_id']) ? (int) $line['product_id'] : null,
        'productReference' => (string) ($line['product_reference'] ?? ''),
        'label' => (string) ($line['label'] ?? ''),
        'quantityOrdered' => (int) ($line['quantity_ordered'] ?? 0),
        'quantityReceived' => (int) ($line['quantity_received'] ?? 0),
        'unitPriceTaxExcl' => (float) ($line['unit_price_tax_excl'] ?? 0),
        'lineTotalTaxExcl' => (float) ($line['quantity_ordered'] ?? 0) * (float) ($line['unit_price_tax_excl'] ?? 0),
    ];
}

function stockcean_get_purchase_order(PDO $pdo, int $orderId): array
{
    $statement = $pdo->prepare(
        'SELECT o.*, s.name AS supplier_name, COUNT(l.id) AS line_count
         FROM stockcean_purchase_orders o
         LEFT JOIN stockcean_suppliers s ON s.id = o.supplier_id
         LEFT JOIN stockcean_purchase_order_lines l ON l.purchase_order_id = o.id
         WHERE o.id = :id
         GROUP BY o.id
         LIMIT 1'
    );
    $statement->execute(['id' => $orderId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Commande fournisseur introuvable.');
    }

    $lineStatement = $pdo->prepare(
        'SELECT l.*, p.reference AS product_reference
         FROM stockcean_purchase_order_lines l
         LEFT JOIN stockcean_products p ON p.id = l.product_id
         WHERE l.purchase_order_id = :id
         ORDER BY l.id ASC'
    );
    $lineStatement->execute(['id' => $orderId]);
    $lines = array_map(static fn(array $line): array => stockcean_public_order_line($line), $lineStatement->fetchAll());

    return stockcean_public_order($row, $lines);
}

function stockcean_list_purchase_orders(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT
            o.*,
            s.name AS supplier_name,
            u.display_name AS user_display_name,
            u.email AS user_email,
            COUNT(l.id) AS line_count
         FROM stockcean_purchase_orders o
         LEFT JOIN stockcean_suppliers s ON s.id = o.supplier_id
         LEFT JOIN oceanos_users u ON u.id = o.user_id
         LEFT JOIN stockcean_purchase_order_lines l ON l.purchase_order_id = o.id
         GROUP BY o.id
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 100'
    )->fetchAll();

    $orders = array_map(static fn(array $row): array => stockcean_public_order($row), $rows);
    if ($orders === []) {
        return [];
    }

    $orderIds = array_map(static fn(array $order): int => (int) $order['id'], $orders);
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $lineStatement = $pdo->prepare(
        'SELECT l.*, p.reference AS product_reference
         FROM stockcean_purchase_order_lines l
         LEFT JOIN stockcean_products p ON p.id = l.product_id
         WHERE l.purchase_order_id IN (' . $placeholders . ')
         ORDER BY l.purchase_order_id DESC, l.id ASC'
    );
    $lineStatement->execute($orderIds);

    $linesByOrder = [];
    foreach ($lineStatement->fetchAll() as $line) {
        $linesByOrder[(int) $line['purchase_order_id']][] = stockcean_public_order_line($line);
    }

    foreach ($orders as &$order) {
        $order['lines'] = $linesByOrder[(int) $order['id']] ?? [];
    }
    unset($order);

    return $orders;
}

function stockcean_update_purchase_order_status(PDO $pdo, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $status = trim((string) ($input['status'] ?? ''));
    if ($id <= 0 || !in_array($status, ['draft', 'ordered', 'received', 'cancelled'], true)) {
        throw new InvalidArgumentException('Statut de commande fournisseur invalide.');
    }

    $statement = $pdo->prepare('UPDATE stockcean_purchase_orders SET status = :status WHERE id = :id');
    $statement->execute(['id' => $id, 'status' => $status]);
    if ($status === 'received') {
        $pdo->prepare('UPDATE stockcean_purchase_order_lines SET quantity_received = quantity_ordered WHERE purchase_order_id = :id')->execute(['id' => $id]);
    }

    return stockcean_get_purchase_order($pdo, $id);
}

function stockcean_get_sync_run(PDO $pdo, int $runId): ?array
{
    $statement = $pdo->prepare(
        'SELECT r.*, u.display_name AS user_display_name, u.email AS user_email
         FROM stockcean_sync_runs r
         LEFT JOIN oceanos_users u ON u.id = r.user_id
         WHERE r.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $runId]);
    $row = $statement->fetch();
    return is_array($row) ? stockcean_public_sync_run($row) : null;
}

function stockcean_public_sync_run(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'status' => (string) $row['status'],
        'startedAt' => (string) $row['started_at'],
        'finishedAt' => $row['finished_at'] !== null ? (string) $row['finished_at'] : null,
        'productsSeen' => (int) $row['products_seen'],
        'productsCreated' => (int) $row['products_created'],
        'productsUpdated' => (int) $row['products_updated'],
        'suppliersSeen' => (int) $row['suppliers_seen'],
        'message' => (string) ($row['message'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'userEmail' => (string) ($row['user_email'] ?? ''),
    ];
}

function stockcean_list_sync_runs(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT r.*, u.display_name AS user_display_name, u.email AS user_email
         FROM stockcean_sync_runs r
         LEFT JOIN oceanos_users u ON u.id = r.user_id
         ORDER BY r.started_at DESC, r.id DESC
         LIMIT 8'
    )->fetchAll();

    return array_map(static fn(array $row): array => stockcean_public_sync_run($row), $rows);
}

function stockcean_dashboard(PDO $pdo, array $query, array $user): array
{
    $admin = stockcean_is_admin($user);

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'settings' => oceanos_prestashop_public_settings($pdo, $admin),
        'stats' => stockcean_stats($pdo),
        'products' => stockcean_list_products($pdo, $query),
        'catalogProducts' => stockcean_supplier_catalog($pdo),
        'suppliers' => stockcean_list_suppliers($pdo),
        'purchaseOrders' => stockcean_list_purchase_orders($pdo),
        'runs' => stockcean_list_sync_runs($pdo),
    ];
}
