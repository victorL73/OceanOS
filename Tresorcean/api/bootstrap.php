<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const TRESORCEAN_MODULE_ID = 'tresorcean';

function tresorcean_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    oceanos_send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tresorcean_read_json_request(): array
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

function tresorcean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    tresorcean_ensure_schema($pdo);
    return $pdo;
}

function tresorcean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            default_sales_tax_rate DECIMAL(6,3) NOT NULL DEFAULT 20,
            default_purchase_tax_rate DECIMAL(6,3) NOT NULL DEFAULT 20,
            prestashop_order_limit INT UNSIGNED NOT NULL DEFAULT 80,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_entries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            entry_type ENUM('fund', 'income', 'expense', 'supplier', 'tax_adjustment') NOT NULL DEFAULT 'fund',
            direction ENUM('in', 'out') NOT NULL DEFAULT 'in',
            tax_scope ENUM('neutral', 'collected', 'deductible') NOT NULL DEFAULT 'neutral',
            label VARCHAR(190) NOT NULL,
            counterparty VARCHAR(190) NULL,
            amount_tax_excl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_amount DECIMAL(14,6) NOT NULL DEFAULT 0,
            amount_tax_incl DECIMAL(14,6) NOT NULL DEFAULT 0,
            tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0,
            occurred_at DATE NOT NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tresorcean_entries_date (occurred_at),
            KEY idx_tresorcean_entries_type (entry_type),
            KEY idx_tresorcean_entries_user (user_id),
            CONSTRAINT fk_tresorcean_entries_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tresorcean_user_preferences (
            user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            period_start DATE NULL,
            period_end DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_tresorcean_preferences_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec('INSERT IGNORE INTO tresorcean_settings (id) VALUES (1)');
}

function tresorcean_require_access(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $modules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(TRESORCEAN_MODULE_ID, $modules, true)) {
        tresorcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Module Tresorcean non autorise pour ce compte.',
        ], 403);
    }

    return $user;
}

function tresorcean_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function tresorcean_require_admin(PDO $pdo): array
{
    $user = tresorcean_require_access($pdo);
    if (!tresorcean_is_admin($user)) {
        tresorcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Acces reserve aux administrateurs.',
        ], 403);
    }

    return $user;
}

function tresorcean_decimal(mixed $value): float
{
    $normalized = str_replace(',', '.', trim((string) $value));
    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function tresorcean_money_value(mixed $value): string
{
    return number_format(tresorcean_decimal($value), 6, '.', '');
}

function tresorcean_settings(PDO $pdo): array
{
    $pdo->exec('INSERT IGNORE INTO tresorcean_settings (id) VALUES (1)');
    $row = $pdo->query('SELECT * FROM tresorcean_settings WHERE id = 1 LIMIT 1')->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('Configuration Tresorcean introuvable.');
    }

    return [
        'defaultSalesTaxRate' => (float) ($row['default_sales_tax_rate'] ?? 20),
        'defaultPurchaseTaxRate' => (float) ($row['default_purchase_tax_rate'] ?? 20),
        'prestashopOrderLimit' => (int) ($row['prestashop_order_limit'] ?? 80),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_save_settings(PDO $pdo, array $input): array
{
    $salesRate = max(0, min(100, tresorcean_decimal($input['defaultSalesTaxRate'] ?? 20)));
    $purchaseRate = max(0, min(100, tresorcean_decimal($input['defaultPurchaseTaxRate'] ?? 20)));
    $limit = max(10, min(250, (int) ($input['prestashopOrderLimit'] ?? 80)));

    $statement = $pdo->prepare(
        'UPDATE tresorcean_settings
         SET default_sales_tax_rate = :sales_rate,
             default_purchase_tax_rate = :purchase_rate,
             prestashop_order_limit = :order_limit
         WHERE id = 1'
    );
    $statement->execute([
        'sales_rate' => number_format($salesRate, 3, '.', ''),
        'purchase_rate' => number_format($purchaseRate, 3, '.', ''),
        'order_limit' => $limit,
    ]);

    return tresorcean_settings($pdo);
}

function tresorcean_valid_date(string $value): bool
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
}

function tresorcean_user_preferences(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT period_start, period_end, updated_at FROM tresorcean_user_preferences WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return [
            'periodStart' => '',
            'periodEnd' => '',
            'updatedAt' => '',
        ];
    }

    return [
        'periodStart' => (string) ($row['period_start'] ?? ''),
        'periodEnd' => (string) ($row['period_end'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function tresorcean_period_requested(array $query): bool
{
    return array_key_exists('start', $query) || array_key_exists('end', $query);
}

function tresorcean_save_user_period(PDO $pdo, int $userId, array $period): array
{
    $statement = $pdo->prepare(
        'INSERT INTO tresorcean_user_preferences (user_id, period_start, period_end)
         VALUES (:user_id, :period_start, :period_end)
         ON DUPLICATE KEY UPDATE
            period_start = VALUES(period_start),
            period_end = VALUES(period_end),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'period_start' => $period['start'],
        'period_end' => $period['end'],
    ]);

    return tresorcean_user_preferences($pdo, $userId);
}

function tresorcean_period(array $query, array $preferences = []): array
{
    $today = new DateTimeImmutable('today');
    $defaultStart = $today->modify('first day of this month');

    $preferredStart = trim((string) ($preferences['periodStart'] ?? ''));
    $preferredEnd = trim((string) ($preferences['periodEnd'] ?? ''));
    $startFallback = tresorcean_valid_date($preferredStart) ? $preferredStart : $defaultStart->format('Y-m-d');
    $endFallback = tresorcean_valid_date($preferredEnd) ? $preferredEnd : $today->format('Y-m-d');

    $start = trim((string) ($query['start'] ?? $startFallback));
    $end = trim((string) ($query['end'] ?? $endFallback));

    if (!tresorcean_valid_date($start)) {
        $start = $startFallback;
    }
    if (!tresorcean_valid_date($end)) {
        $end = $endFallback;
    }
    if ($start > $end) {
        [$start, $end] = [$end, $start];
    }

    return [
        'start' => $start,
        'end' => $end,
        'startDateTime' => $start . ' 00:00:00',
        'endDateTime' => $end . ' 23:59:59',
    ];
}

function tresorcean_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (isset($xml->{$container}->{$nodeName})) {
        $nodes = [];
        foreach ($xml->{$container}->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    if (isset($xml->{$nodeName})) {
        $nodes = [];
        foreach ($xml->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    return [];
}

function tresorcean_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return tresorcean_collect_nodes($xml, $container, $nodeName);
}

function tresorcean_float_xml(SimpleXMLElement $node, string $field): float
{
    return tresorcean_decimal(oceanos_xml_text($node, $field));
}

function tresorcean_fetch_order_states(string $shopUrl, string $apiKey): array
{
    $query = [
        'display' => '[id,name,color,paid,shipped,delivery,logable,invoice,deleted]',
        'sort' => '[id_ASC]',
        'limit' => '0,200',
    ];

    try {
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
    }

    $states = [];
    foreach ($nodes as $node) {
        $id = (int) oceanos_xml_text($node, 'id');
        if ($id <= 0) {
            continue;
        }
        $name = oceanos_xml_language_value($node, 'name');
        $states[$id] = [
            'id' => $id,
            'name' => $name !== '' ? $name : 'Statut #' . $id,
            'color' => oceanos_xml_text($node, 'color') ?: '#8fa7b0',
            'paid' => oceanos_xml_text($node, 'paid') === '1',
            'shipped' => oceanos_xml_text($node, 'shipped') === '1',
            'delivery' => oceanos_xml_text($node, 'delivery') === '1',
            'logable' => oceanos_xml_text($node, 'logable') === '1',
            'invoice' => oceanos_xml_text($node, 'invoice') === '1',
            'deleted' => oceanos_xml_text($node, 'deleted') === '1',
        ];
    }

    return $states;
}

function tresorcean_revenue_state(array $state): bool
{
    if (!empty($state['deleted'])) {
        return false;
    }

    return !empty($state['paid']) || !empty($state['invoice']) || !empty($state['logable']);
}

function tresorcean_order_lines(SimpleXMLElement $order, array $costMap): array
{
    $lines = [];
    if (!isset($order->associations->order_rows->order_row)) {
        return $lines;
    }

    foreach ($order->associations->order_rows->order_row as $row) {
        $productId = (int) oceanos_xml_text($row, 'product_id');
        $quantity = max(0, (int) oceanos_xml_text($row, 'product_quantity'));
        $unitHt = tresorcean_float_xml($row, 'unit_price_tax_excl');
        if ($unitHt <= 0) {
            $unitHt = tresorcean_float_xml($row, 'product_price');
        }
        $unitTtc = tresorcean_float_xml($row, 'unit_price_tax_incl');
        $totalHt = tresorcean_float_xml($row, 'total_price_tax_excl');
        $totalTtc = tresorcean_float_xml($row, 'total_price_tax_incl');
        if ($totalHt <= 0 && $unitHt > 0) {
            $totalHt = $unitHt * $quantity;
        }
        if ($totalTtc <= 0 && $unitTtc > 0) {
            $totalTtc = $unitTtc * $quantity;
        }

        $unitCost = (float) ($costMap[$productId] ?? 0);
        $estimatedCost = $unitCost * $quantity;

        $lines[] = [
            'productId' => $productId,
            'reference' => oceanos_xml_text($row, 'product_reference'),
            'name' => oceanos_xml_text($row, 'product_name') ?: 'Produit',
            'quantity' => $quantity,
            'unitPriceTaxExcl' => $unitHt,
            'unitPriceTaxIncl' => $unitTtc,
            'totalTaxExcl' => $totalHt,
            'totalTaxIncl' => $totalTtc,
            'estimatedUnitCostTaxExcl' => $unitCost,
            'estimatedCostTaxExcl' => $estimatedCost,
            'missingCost' => $unitCost <= 0,
        ];
    }

    return $lines;
}

function tresorcean_product_cost_map(PDO $pdo): array
{
    if (
        !oceanos_table_exists($pdo, 'stockcean_products')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_orders')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_order_lines')
    ) {
        return [];
    }

    $rows = $pdo->query(
        "SELECT
            p.prestashop_product_id,
            COALESCE(
                SUM(CASE WHEN po.status IN ('ordered', 'received') THEN l.quantity_ordered * l.unit_price_tax_excl ELSE 0 END)
                / NULLIF(SUM(CASE WHEN po.status IN ('ordered', 'received') THEN l.quantity_ordered ELSE 0 END), 0),
                0
            ) AS average_cost
         FROM stockcean_products p
         LEFT JOIN stockcean_purchase_order_lines l ON l.product_id = p.id
         LEFT JOIN stockcean_purchase_orders po ON po.id = l.purchase_order_id
         GROUP BY p.prestashop_product_id"
    )->fetchAll();

    $map = [];
    foreach ($rows as $row) {
        $productId = (int) ($row['prestashop_product_id'] ?? 0);
        if ($productId > 0) {
            $map[$productId] = (float) ($row['average_cost'] ?? 0);
        }
    }

    return $map;
}

function tresorcean_public_order(SimpleXMLElement $node, array $states, array $costMap, string $shopUrl, string $apiKey): array
{
    $id = (int) oceanos_xml_text($node, 'id');
    $stateId = (int) oceanos_xml_text($node, 'current_state');
    $state = $states[$stateId] ?? [
        'id' => $stateId,
        'name' => $stateId > 0 ? 'Statut #' . $stateId : 'Sans statut',
        'color' => '#8fa7b0',
        'paid' => false,
        'shipped' => false,
        'delivery' => false,
        'logable' => false,
        'invoice' => false,
        'deleted' => false,
    ];

    $totalIncl = tresorcean_float_xml($node, 'total_paid_tax_incl');
    if ($totalIncl <= 0) {
        $totalIncl = tresorcean_float_xml($node, 'total_paid');
    }
    $totalExcl = tresorcean_float_xml($node, 'total_paid_tax_excl');
    if ($totalExcl <= 0) {
        $products = tresorcean_float_xml($node, 'total_products');
        $shipping = tresorcean_float_xml($node, 'total_shipping_tax_excl');
        $discounts = tresorcean_float_xml($node, 'total_discounts_tax_excl');
        $totalExcl = max(0, $products + $shipping - $discounts);
    }

    $lines = [];
    $detailWarning = '';
    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'orders/' . $id));
        $detail = $xml->order ?? null;
        if ($detail instanceof SimpleXMLElement) {
            $lines = tresorcean_order_lines($detail, $costMap);
            $detailIncl = tresorcean_float_xml($detail, 'total_paid_tax_incl') ?: tresorcean_float_xml($detail, 'total_paid');
            $detailExcl = tresorcean_float_xml($detail, 'total_paid_tax_excl');
            if ($detailIncl > 0) {
                $totalIncl = $detailIncl;
            }
            if ($detailExcl > 0) {
                $totalExcl = $detailExcl;
            }
        }
    } catch (Throwable $exception) {
        $detailWarning = $exception->getMessage();
    }

    $estimatedCost = array_sum(array_map(static fn(array $line): float => (float) $line['estimatedCostTaxExcl'], $lines));
    $missingCostLines = count(array_filter($lines, static fn(array $line): bool => !empty($line['missingCost']) && (int) $line['productId'] > 0));
    $included = tresorcean_revenue_state($state);

    return [
        'id' => $id,
        'reference' => oceanos_xml_text($node, 'reference') ?: ('Commande #' . $id),
        'currentStateId' => $stateId,
        'currentState' => $state,
        'includedInRevenue' => $included,
        'totalTaxExcl' => $totalExcl,
        'totalTaxIncl' => $totalIncl,
        'vatAmount' => max(0, $totalIncl - $totalExcl),
        'estimatedCostTaxExcl' => $estimatedCost,
        'estimatedMarginTaxExcl' => $totalExcl - $estimatedCost,
        'missingCostLines' => $missingCostLines,
        'dateAdd' => oceanos_xml_text($node, 'date_add'),
        'dateUpd' => oceanos_xml_text($node, 'date_upd'),
        'payment' => oceanos_xml_text($node, 'payment'),
        'lines' => $lines,
        'detailWarning' => $detailWarning,
    ];
}

function tresorcean_fetch_orders(PDO $pdo, array $period, array $settings): array
{
    $private = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($private);
    $limit = max(10, min(250, (int) ($settings['prestashopOrderLimit'] ?? 80)));
    $states = tresorcean_fetch_order_states($shopUrl, $apiKey);
    $costMap = tresorcean_product_cost_map($pdo);

    $query = [
        'display' => '[id,reference,current_state,payment,total_paid,total_paid_tax_excl,total_paid_tax_incl,total_products,total_shipping_tax_excl,total_discounts_tax_excl,date_add,date_upd]',
        'sort' => '[date_add_DESC]',
        'limit' => '0,' . $limit,
        'filter[date_add]' => '[' . $period['startDateTime'] . ',' . $period['endDateTime'] . ']',
        'date' => '1',
    ];

    try {
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        unset($query['filter[date_add]'], $query['date']);
        $nodes = tresorcean_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', $query);
    }

    $orders = [];
    foreach ($nodes as $node) {
        $orders[] = tresorcean_public_order($node, $states, $costMap, $shopUrl, $apiKey);
    }

    return [
        'orders' => $orders,
        'states' => array_values($states),
        'settings' => oceanos_prestashop_public_settings($pdo, tresorcean_is_admin(oceanos_current_user($pdo) ?? [])),
    ];
}

function tresorcean_supplier_orders(PDO $pdo, array $period, float $purchaseTaxRate): array
{
    if (
        !oceanos_table_exists($pdo, 'stockcean_purchase_orders')
        || !oceanos_table_exists($pdo, 'stockcean_purchase_order_lines')
        || !oceanos_table_exists($pdo, 'stockcean_suppliers')
    ) {
        return [];
    }

    $statement = $pdo->prepare(
        "SELECT o.*, s.name AS supplier_name, COUNT(l.id) AS line_count
         FROM stockcean_purchase_orders o
         LEFT JOIN stockcean_suppliers s ON s.id = o.supplier_id
         LEFT JOIN stockcean_purchase_order_lines l ON l.purchase_order_id = o.id
         WHERE o.created_at BETWEEN :start_date AND :end_date
           AND o.status <> 'cancelled'
         GROUP BY o.id
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 120"
    );
    $statement->execute([
        'start_date' => $period['startDateTime'],
        'end_date' => $period['endDateTime'],
    ]);

    $orders = [];
    foreach ($statement->fetchAll() as $row) {
        $totalHt = (float) ($row['total_tax_excl'] ?? 0);
        $tax = $totalHt * ($purchaseTaxRate / 100);
        $included = in_array((string) ($row['status'] ?? ''), ['ordered', 'received'], true);
        $orders[] = [
            'id' => (int) $row['id'],
            'orderNumber' => (string) ($row['order_number'] ?? ''),
            'supplierName' => (string) ($row['supplier_name'] ?? ''),
            'status' => (string) ($row['status'] ?? ''),
            'includedInExpenses' => $included,
            'totalTaxExcl' => $totalHt,
            'taxAmount' => $tax,
            'totalTaxIncl' => $totalHt + $tax,
            'lineCount' => (int) ($row['line_count'] ?? 0),
            'expectedAt' => (string) ($row['expected_at'] ?? ''),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    return $orders;
}

function tresorcean_public_entry(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'userId' => isset($row['user_id']) ? (int) $row['user_id'] : null,
        'entryType' => (string) ($row['entry_type'] ?? 'fund'),
        'direction' => (string) ($row['direction'] ?? 'in'),
        'taxScope' => (string) ($row['tax_scope'] ?? 'neutral'),
        'label' => (string) ($row['label'] ?? ''),
        'counterparty' => (string) ($row['counterparty'] ?? ''),
        'amountTaxExcl' => (float) ($row['amount_tax_excl'] ?? 0),
        'taxAmount' => (float) ($row['tax_amount'] ?? 0),
        'amountTaxIncl' => (float) ($row['amount_tax_incl'] ?? 0),
        'taxRate' => (float) ($row['tax_rate'] ?? 0),
        'occurredAt' => (string) ($row['occurred_at'] ?? ''),
        'notes' => (string) ($row['notes'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
    ];
}

function tresorcean_entries(PDO $pdo, array $period): array
{
    $statement = $pdo->prepare(
        'SELECT e.*, u.display_name AS user_display_name
         FROM tresorcean_entries e
         LEFT JOIN oceanos_users u ON u.id = e.user_id
         WHERE e.occurred_at BETWEEN :start_date AND :end_date
         ORDER BY e.occurred_at DESC, e.id DESC
         LIMIT 220'
    );
    $statement->execute([
        'start_date' => $period['start'],
        'end_date' => $period['end'],
    ]);

    return array_map(static fn(array $row): array => tresorcean_public_entry($row), $statement->fetchAll());
}

function tresorcean_normalize_entry_amounts(array $input): array
{
    $taxRate = max(0, min(100, tresorcean_decimal($input['taxRate'] ?? 0)));
    $amountHt = abs(tresorcean_decimal($input['amountTaxExcl'] ?? 0));
    $taxAmount = abs(tresorcean_decimal($input['taxAmount'] ?? 0));
    $amountTtc = abs(tresorcean_decimal($input['amountTaxIncl'] ?? 0));
    $taxScope = in_array((string) ($input['taxScope'] ?? 'neutral'), ['neutral', 'collected', 'deductible'], true)
        ? (string) $input['taxScope']
        : 'neutral';

    if ($amountTtc > 0 && $amountHt <= 0) {
        if ($taxScope !== 'neutral' && $taxRate > 0) {
            $amountHt = $amountTtc / (1 + ($taxRate / 100));
            $taxAmount = $amountTtc - $amountHt;
        } else {
            $amountHt = $amountTtc;
            $taxAmount = 0;
        }
    } elseif ($amountHt > 0 && $amountTtc <= 0) {
        if ($taxScope !== 'neutral' && $taxRate > 0 && $taxAmount <= 0) {
            $taxAmount = $amountHt * ($taxRate / 100);
        }
        $amountTtc = $amountHt + ($taxScope === 'neutral' ? 0 : $taxAmount);
    } elseif ($amountHt > 0 && $amountTtc > 0 && $taxAmount <= 0) {
        $taxAmount = max(0, $amountTtc - $amountHt);
    }

    if ($taxScope === 'neutral') {
        $taxAmount = 0;
        if ($amountTtc <= 0) {
            $amountTtc = $amountHt;
        }
    }

    if ($amountTtc <= 0) {
        throw new InvalidArgumentException('Montant invalide.');
    }

    return [
        'amountTaxExcl' => $amountHt,
        'taxAmount' => $taxAmount,
        'amountTaxIncl' => $amountTtc,
        'taxRate' => $taxRate,
        'taxScope' => $taxScope,
    ];
}

function tresorcean_save_entry(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $entryType = (string) ($input['entryType'] ?? 'fund');
    if (!in_array($entryType, ['fund', 'income', 'expense', 'supplier', 'tax_adjustment'], true)) {
        $entryType = 'fund';
    }
    $direction = (string) ($input['direction'] ?? 'in');
    if (!in_array($direction, ['in', 'out'], true)) {
        $direction = 'in';
    }
    $label = trim((string) ($input['label'] ?? ''));
    if ($label === '') {
        throw new InvalidArgumentException('Libelle obligatoire.');
    }
    $occurredAt = trim((string) ($input['occurredAt'] ?? date('Y-m-d')));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurredAt)) {
        throw new InvalidArgumentException('Date invalide.');
    }

    $amounts = tresorcean_normalize_entry_amounts($input);
    $params = [
        'user_id' => (int) $user['id'],
        'entry_type' => $entryType,
        'direction' => $direction,
        'tax_scope' => $amounts['taxScope'],
        'label' => $label,
        'counterparty' => trim((string) ($input['counterparty'] ?? '')) ?: null,
        'amount_tax_excl' => number_format($amounts['amountTaxExcl'], 6, '.', ''),
        'tax_amount' => number_format($amounts['taxAmount'], 6, '.', ''),
        'amount_tax_incl' => number_format($amounts['amountTaxIncl'], 6, '.', ''),
        'tax_rate' => number_format($amounts['taxRate'], 3, '.', ''),
        'occurred_at' => $occurredAt,
        'notes' => trim((string) ($input['notes'] ?? '')) ?: null,
    ];

    if ($id > 0) {
        $existing = tresorcean_get_entry_row($pdo, $id);
        if (!tresorcean_is_admin($user) && (int) ($existing['user_id'] ?? 0) !== (int) $user['id']) {
            throw new InvalidArgumentException('Vous ne pouvez modifier que vos mouvements.');
        }
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE tresorcean_entries
             SET user_id = :user_id,
                 entry_type = :entry_type,
                 direction = :direction,
                 tax_scope = :tax_scope,
                 label = :label,
                 counterparty = :counterparty,
                 amount_tax_excl = :amount_tax_excl,
                 tax_amount = :tax_amount,
                 amount_tax_incl = :amount_tax_incl,
                 tax_rate = :tax_rate,
                 occurred_at = :occurred_at,
                 notes = :notes
             WHERE id = :id'
        );
        $statement->execute($params);
    } else {
        $statement = $pdo->prepare(
            'INSERT INTO tresorcean_entries
                (user_id, entry_type, direction, tax_scope, label, counterparty, amount_tax_excl, tax_amount, amount_tax_incl, tax_rate, occurred_at, notes)
             VALUES
                (:user_id, :entry_type, :direction, :tax_scope, :label, :counterparty, :amount_tax_excl, :tax_amount, :amount_tax_incl, :tax_rate, :occurred_at, :notes)'
        );
        $statement->execute($params);
        $id = (int) $pdo->lastInsertId();
    }

    return tresorcean_public_entry(tresorcean_get_entry_row($pdo, $id));
}

function tresorcean_get_entry_row(PDO $pdo, int $id): array
{
    $statement = $pdo->prepare(
        'SELECT e.*, u.display_name AS user_display_name
         FROM tresorcean_entries e
         LEFT JOIN oceanos_users u ON u.id = e.user_id
         WHERE e.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Mouvement introuvable.');
    }

    return $row;
}

function tresorcean_delete_entry(PDO $pdo, array $user, int $id): void
{
    $row = tresorcean_get_entry_row($pdo, $id);
    if (!tresorcean_is_admin($user) && (int) ($row['user_id'] ?? 0) !== (int) $user['id']) {
        throw new InvalidArgumentException('Vous ne pouvez supprimer que vos mouvements.');
    }

    $statement = $pdo->prepare('DELETE FROM tresorcean_entries WHERE id = :id');
    $statement->execute(['id' => $id]);
}

function tresorcean_month_buckets(string $start, string $end): array
{
    $cursor = (new DateTimeImmutable($start))->modify('first day of this month');
    $endDate = (new DateTimeImmutable($end))->modify('first day of this month');
    $buckets = [];
    $guard = 0;
    while ($cursor <= $endDate && $guard < 18) {
        $key = $cursor->format('Y-m');
        $buckets[$key] = [
            'month' => $key,
            'label' => $cursor->format('m/Y'),
            'cashIn' => 0.0,
            'cashOut' => 0.0,
            'revenueTaxExcl' => 0.0,
            'supplierTaxExcl' => 0.0,
            'manualIncomeTaxExcl' => 0.0,
            'manualExpenseTaxExcl' => 0.0,
            'vatCollected' => 0.0,
            'vatDeductible' => 0.0,
            'profitTaxExcl' => 0.0,
        ];
        $cursor = $cursor->modify('+1 month');
        $guard++;
    }

    return $buckets;
}

function tresorcean_bucket_key(string $date): string
{
    if (preg_match('/^\d{4}-\d{2}/', $date, $matches)) {
        return $matches[0];
    }

    return date('Y-m');
}

function tresorcean_summarize(array $orders, array $supplierOrders, array $entries, array $settings, array $period): array
{
    $summary = [
        'cashIn' => 0.0,
        'cashOut' => 0.0,
        'cashBalance' => 0.0,
        'revenueTaxExcl' => 0.0,
        'revenueTaxIncl' => 0.0,
        'prestashopVatCollected' => 0.0,
        'estimatedCostOfGoodsTaxExcl' => 0.0,
        'grossMarginTaxExcl' => 0.0,
        'supplierOrdersTaxExcl' => 0.0,
        'supplierOrdersTaxIncl' => 0.0,
        'supplierVatDeductible' => 0.0,
        'manualCashIn' => 0.0,
        'manualCashOut' => 0.0,
        'manualIncomeTaxExcl' => 0.0,
        'manualExpenseTaxExcl' => 0.0,
        'manualVatCollected' => 0.0,
        'manualVatDeductible' => 0.0,
        'vatCollected' => 0.0,
        'vatDeductible' => 0.0,
        'vatDue' => 0.0,
        'estimatedProfitTaxExcl' => 0.0,
        'includedOrders' => 0,
        'loadedOrders' => count($orders),
        'supplierOrders' => count($supplierOrders),
        'manualEntries' => count($entries),
        'missingCostLines' => 0,
    ];
    $series = tresorcean_month_buckets($period['start'], $period['end']);

    foreach ($orders as $order) {
        if (empty($order['includedInRevenue'])) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($order['dateAdd'] ?? ''));
        $summary['includedOrders']++;
        $summary['revenueTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
        $summary['revenueTaxIncl'] += (float) ($order['totalTaxIncl'] ?? 0);
        $summary['prestashopVatCollected'] += (float) ($order['vatAmount'] ?? 0);
        $summary['estimatedCostOfGoodsTaxExcl'] += (float) ($order['estimatedCostTaxExcl'] ?? 0);
        $summary['missingCostLines'] += (int) ($order['missingCostLines'] ?? 0);
        if (isset($series[$key])) {
            $series[$key]['cashIn'] += (float) ($order['totalTaxIncl'] ?? 0);
            $series[$key]['revenueTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
            $series[$key]['vatCollected'] += (float) ($order['vatAmount'] ?? 0);
        }
    }

    foreach ($supplierOrders as $order) {
        if (empty($order['includedInExpenses'])) {
            continue;
        }
        $key = tresorcean_bucket_key((string) ($order['createdAt'] ?? ''));
        $summary['supplierOrdersTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
        $summary['supplierVatDeductible'] += (float) ($order['taxAmount'] ?? 0);
        $summary['supplierOrdersTaxIncl'] += (float) ($order['totalTaxIncl'] ?? 0);
        if (isset($series[$key])) {
            $series[$key]['cashOut'] += (float) ($order['totalTaxIncl'] ?? 0);
            $series[$key]['supplierTaxExcl'] += (float) ($order['totalTaxExcl'] ?? 0);
            $series[$key]['vatDeductible'] += (float) ($order['taxAmount'] ?? 0);
        }
    }

    foreach ($entries as $entry) {
        $key = tresorcean_bucket_key((string) ($entry['occurredAt'] ?? ''));
        $direction = (string) ($entry['direction'] ?? 'in');
        $entryType = (string) ($entry['entryType'] ?? 'fund');
        $scope = (string) ($entry['taxScope'] ?? 'neutral');
        $amountHt = (float) ($entry['amountTaxExcl'] ?? 0);
        $tax = (float) ($entry['taxAmount'] ?? 0);
        $amountTtc = (float) ($entry['amountTaxIncl'] ?? 0);

        if ($direction === 'in') {
            $summary['manualCashIn'] += $amountTtc;
            if ($entryType !== 'fund') {
                $summary['manualIncomeTaxExcl'] += $amountHt;
            }
            if (isset($series[$key])) {
                $series[$key]['cashIn'] += $amountTtc;
                if ($entryType !== 'fund') {
                    $series[$key]['manualIncomeTaxExcl'] += $amountHt;
                }
            }
        } else {
            $summary['manualCashOut'] += $amountTtc;
            if ($entryType !== 'fund') {
                $summary['manualExpenseTaxExcl'] += $amountHt;
            }
            if (isset($series[$key])) {
                $series[$key]['cashOut'] += $amountTtc;
                if ($entryType !== 'fund') {
                    $series[$key]['manualExpenseTaxExcl'] += $amountHt;
                }
            }
        }

        if ($scope === 'collected') {
            $summary['manualVatCollected'] += $tax;
            if (isset($series[$key])) {
                $series[$key]['vatCollected'] += $tax;
            }
        } elseif ($scope === 'deductible') {
            $summary['manualVatDeductible'] += $tax;
            if (isset($series[$key])) {
                $series[$key]['vatDeductible'] += $tax;
            }
        }
    }

    $summary['cashIn'] = $summary['revenueTaxIncl'] + $summary['manualCashIn'];
    $summary['cashOut'] = $summary['supplierOrdersTaxIncl'] + $summary['manualCashOut'];
    $summary['cashBalance'] = $summary['cashIn'] - $summary['cashOut'];
    $summary['grossMarginTaxExcl'] = $summary['revenueTaxExcl'] - $summary['estimatedCostOfGoodsTaxExcl'];
    $summary['estimatedProfitTaxExcl'] =
        $summary['revenueTaxExcl']
        + $summary['manualIncomeTaxExcl']
        - $summary['supplierOrdersTaxExcl']
        - $summary['manualExpenseTaxExcl'];
    $summary['vatCollected'] = $summary['prestashopVatCollected'] + $summary['manualVatCollected'];
    $summary['vatDeductible'] = $summary['supplierVatDeductible'] + $summary['manualVatDeductible'];
    $summary['vatDue'] = $summary['vatCollected'] - $summary['vatDeductible'];

    foreach ($series as &$bucket) {
        $bucket['profitTaxExcl'] =
            $bucket['revenueTaxExcl']
            + $bucket['manualIncomeTaxExcl']
            - $bucket['supplierTaxExcl']
            - $bucket['manualExpenseTaxExcl'];
    }
    unset($bucket);

    return [
        'summary' => $summary,
        'series' => array_values($series),
        'vat' => [
            'collected' => [
                'total' => $summary['vatCollected'],
                'prestashop' => $summary['prestashopVatCollected'],
                'manual' => $summary['manualVatCollected'],
            ],
            'deductible' => [
                'total' => $summary['vatDeductible'],
                'supplierOrders' => $summary['supplierVatDeductible'],
                'manual' => $summary['manualVatDeductible'],
            ],
            'due' => $summary['vatDue'],
            'defaultPurchaseTaxRate' => (float) ($settings['defaultPurchaseTaxRate'] ?? 20),
        ],
    ];
}

function tresorcean_dashboard(PDO $pdo, array $query, array $user): array
{
    $preferences = tresorcean_user_preferences($pdo, (int) $user['id']);
    $period = tresorcean_period($query, $preferences);
    if (tresorcean_period_requested($query)) {
        $preferences = tresorcean_save_user_period($pdo, (int) $user['id'], $period);
    }
    $settings = tresorcean_settings($pdo);
    $orders = [];
    $states = [];
    $warnings = [];
    $prestashopStatus = [
        'connected' => false,
        'message' => 'PrestaShop non configure.',
        'settings' => oceanos_prestashop_public_settings($pdo, tresorcean_is_admin($user)),
    ];

    try {
        $orderPayload = tresorcean_fetch_orders($pdo, $period, $settings);
        $orders = $orderPayload['orders'];
        $states = $orderPayload['states'];
        $prestashopStatus = [
            'connected' => true,
            'message' => count($orders) . ' commande(s) PrestaShop chargee(s).',
            'settings' => $orderPayload['settings'],
        ];
    } catch (InvalidArgumentException $exception) {
        $warnings[] = $exception->getMessage();
    } catch (Throwable $exception) {
        $warnings[] = 'Lecture PrestaShop impossible: ' . $exception->getMessage();
    }

    $supplierOrders = tresorcean_supplier_orders($pdo, $period, (float) $settings['defaultPurchaseTaxRate']);
    $entries = tresorcean_entries($pdo, $period);
    $computed = tresorcean_summarize($orders, $supplierOrders, $entries, $settings, $period);

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'period' => [
            'start' => $period['start'],
            'end' => $period['end'],
        ],
        'preferences' => [
            'periodStart' => $preferences['periodStart'],
            'periodEnd' => $preferences['periodEnd'],
            'updatedAt' => $preferences['updatedAt'],
        ],
        'settings' => $settings,
        'prestashop' => $prestashopStatus,
        'warnings' => $warnings,
        'states' => $states,
        'orders' => $orders,
        'supplierOrders' => $supplierOrders,
        'entries' => $entries,
        'summary' => $computed['summary'],
        'series' => $computed['series'],
        'vat' => $computed['vat'],
    ];
}
