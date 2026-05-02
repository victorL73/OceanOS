<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function commandes_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function commandes_read_json_request(): array
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

function commandes_pdo(): PDO
{
    return oceanos_pdo();
}

function commandes_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
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

function commandes_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return commandes_collect_nodes($xml, $container, $nodeName);
}

function commandes_prestashop_context(PDO $pdo): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);

    return [$shopUrl, $apiKey, $settings];
}

function commandes_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function commandes_float(string $value): float
{
    $normalized = str_replace(',', '.', trim($value));
    return is_numeric($normalized) ? (float) $normalized : 0.0;
}

function commandes_fetch_order_states(string $shopUrl, string $apiKey): array
{
    $query = [
        'display' => '[id,name,color,paid,shipped,delivery,logable,invoice,deleted]',
        'sort' => '[id_ASC]',
        'limit' => '0,200',
    ];

    try {
        $nodes = commandes_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        $nodes = commandes_fetch_prestashop_nodes($shopUrl, $apiKey, 'order_states', 'order_states', 'order_state', $query);
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

    uasort($states, static fn(array $a, array $b): int => $a['id'] <=> $b['id']);
    return $states;
}

function commandes_fetch_customer_summary(string $shopUrl, string $apiKey, int $customerId): array
{
    if ($customerId <= 0) {
        return [
            'id' => 0,
            'name' => 'Client invite',
            'email' => '',
            'company' => '',
        ];
    }

    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'customers/' . $customerId));
        $customer = $xml->customer ?? null;
        if (!$customer instanceof SimpleXMLElement) {
            throw new RuntimeException('Client introuvable.');
        }

        $firstName = oceanos_xml_text($customer, 'firstname');
        $lastName = oceanos_xml_text($customer, 'lastname');
        $company = oceanos_xml_text($customer, 'company');
        $name = trim($firstName . ' ' . $lastName);

        return [
            'id' => $customerId,
            'name' => $name !== '' ? $name : ($company !== '' ? $company : 'Client #' . $customerId),
            'email' => oceanos_xml_text($customer, 'email'),
            'company' => $company,
        ];
    } catch (Throwable) {
        return [
            'id' => $customerId,
            'name' => 'Client #' . $customerId,
            'email' => '',
            'company' => '',
        ];
    }
}

function commandes_public_order(SimpleXMLElement $node, array $states, array &$customers, string $shopUrl, string $apiKey): array
{
    $id = (int) oceanos_xml_text($node, 'id');
    $customerId = (int) oceanos_xml_text($node, 'id_customer');
    if (!array_key_exists($customerId, $customers)) {
        $customers[$customerId] = commandes_fetch_customer_summary($shopUrl, $apiKey, $customerId);
    }

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

    return [
        'id' => $id,
        'reference' => oceanos_xml_text($node, 'reference') ?: ('Commande #' . $id),
        'customerId' => $customerId,
        'customer' => $customers[$customerId],
        'currentStateId' => $stateId,
        'currentState' => $state,
        'payment' => oceanos_xml_text($node, 'payment'),
        'module' => oceanos_xml_text($node, 'module'),
        'totalPaid' => commandes_float(oceanos_xml_text($node, 'total_paid_tax_incl') ?: oceanos_xml_text($node, 'total_paid')),
        'totalProducts' => commandes_float(oceanos_xml_text($node, 'total_products_wt') ?: oceanos_xml_text($node, 'total_products')),
        'currencyId' => (int) oceanos_xml_text($node, 'id_currency'),
        'dateAdd' => oceanos_xml_text($node, 'date_add'),
        'dateUpd' => oceanos_xml_text($node, 'date_upd'),
    ];
}

function commandes_order_rows(SimpleXMLElement $order): array
{
    $rows = [];
    if (!isset($order->associations->order_rows->order_row)) {
        return $rows;
    }

    foreach ($order->associations->order_rows->order_row as $row) {
        $quantity = max(0, (int) oceanos_xml_text($row, 'product_quantity'));
        $unitHt = commandes_float(oceanos_xml_text($row, 'unit_price_tax_excl') ?: oceanos_xml_text($row, 'product_price'));
        $unitTtc = commandes_float(oceanos_xml_text($row, 'unit_price_tax_incl'));
        $totalHt = commandes_float(oceanos_xml_text($row, 'total_price_tax_excl'));
        $totalTtc = commandes_float(oceanos_xml_text($row, 'total_price_tax_incl'));
        if ($totalHt <= 0 && $unitHt > 0) {
            $totalHt = $unitHt * $quantity;
        }
        if ($totalTtc <= 0 && $unitTtc > 0) {
            $totalTtc = $unitTtc * $quantity;
        }

        $rows[] = [
            'id' => (int) oceanos_xml_text($row, 'id'),
            'productId' => (int) oceanos_xml_text($row, 'product_id'),
            'productAttributeId' => (int) oceanos_xml_text($row, 'product_attribute_id'),
            'reference' => oceanos_xml_text($row, 'product_reference'),
            'name' => oceanos_xml_text($row, 'product_name') ?: 'Produit',
            'quantity' => $quantity,
            'unitPriceTaxExcl' => $unitHt,
            'unitPriceTaxIncl' => $unitTtc,
            'totalTaxExcl' => $totalHt,
            'totalTaxIncl' => $totalTtc,
        ];
    }

    return $rows;
}

function commandes_fetch_orders(PDO $pdo, array $query = []): array
{
    [$shopUrl, $apiKey] = commandes_prestashop_context($pdo);
    $limit = max(1, min(250, (int) ($query['limit'] ?? 80)));
    $filters = [
        'display' => '[id,reference,id_customer,current_state,payment,module,total_paid,total_paid_tax_incl,total_products,total_products_wt,id_currency,date_add,date_upd]',
        'sort' => '[date_add_DESC]',
        'limit' => '0,' . $limit,
    ];

    $stateId = (int) ($query['state'] ?? 0);
    if ($stateId > 0) {
        $filters['filter[current_state]'] = '[' . $stateId . ']';
    }

    $nodes = commandes_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', $filters);
    $states = commandes_fetch_order_states($shopUrl, $apiKey);
    $customers = [];
    $orders = [];
    foreach ($nodes as $node) {
        $orders[] = commandes_public_order($node, $states, $customers, $shopUrl, $apiKey);
    }

    return [$orders, array_values($states), $states];
}

function commandes_fetch_order_detail(PDO $pdo, int $orderId): array
{
    if ($orderId <= 0) {
        throw new InvalidArgumentException('Commande invalide.');
    }

    [$shopUrl, $apiKey] = commandes_prestashop_context($pdo);
    $states = commandes_fetch_order_states($shopUrl, $apiKey);
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'orders/' . $orderId));
    $order = $xml->order ?? null;
    if (!$order instanceof SimpleXMLElement) {
        throw new RuntimeException('Commande PrestaShop introuvable.');
    }

    $customers = [];
    $summary = commandes_public_order($order, $states, $customers, $shopUrl, $apiKey);

    return [
        ...$summary,
        'invoiceNumber' => oceanos_xml_text($order, 'invoice_number'),
        'invoiceDate' => oceanos_xml_text($order, 'invoice_date'),
        'deliveryNumber' => oceanos_xml_text($order, 'delivery_number'),
        'deliveryDate' => oceanos_xml_text($order, 'delivery_date'),
        'totalPaidTaxExcl' => commandes_float(oceanos_xml_text($order, 'total_paid_tax_excl')),
        'totalShipping' => commandes_float(oceanos_xml_text($order, 'total_shipping_tax_incl') ?: oceanos_xml_text($order, 'total_shipping')),
        'totalDiscounts' => commandes_float(oceanos_xml_text($order, 'total_discounts_tax_incl') ?: oceanos_xml_text($order, 'total_discounts')),
        'conversionRate' => commandes_float(oceanos_xml_text($order, 'conversion_rate')),
        'giftMessage' => oceanos_xml_text($order, 'gift_message'),
        'lines' => commandes_order_rows($order),
    ];
}

function commandes_first_prestashop_resource_id(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query = []): int
{
    $nodes = commandes_fetch_prestashop_nodes($shopUrl, $apiKey, $resource, $container, $nodeName, $query);
    if ($nodes === []) {
        return 0;
    }

    return (int) oceanos_xml_text($nodes[0], 'id');
}

function commandes_resolve_prestashop_employee_id(string $shopUrl, string $apiKey, array $user): int
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email !== '') {
        try {
            $employeeId = commandes_first_prestashop_resource_id($shopUrl, $apiKey, 'employees', 'employees', 'employee', [
                'filter[email]' => '[' . $email . ']',
                'display' => '[id,email,firstname,lastname]',
                'limit' => '0,1',
            ]);
            if ($employeeId > 0) {
                return $employeeId;
            }
        } catch (Throwable) {
        }
    }

    try {
        $employeeId = commandes_first_prestashop_resource_id($shopUrl, $apiKey, 'employees', 'employees', 'employee', [
            'display' => '[id,email,firstname,lastname]',
            'sort' => '[id_ASC]',
            'limit' => '0,1',
        ]);
        if ($employeeId > 0) {
            return $employeeId;
        }
    } catch (Throwable) {
    }

    return 1;
}

function commandes_append_xml_text(DOMDocument $dom, DOMElement $parent, string $name, string|int|float|null $value): void
{
    $node = $dom->createElement($name);
    $node->appendChild($dom->createCDATASection((string) ($value ?? '')));
    $parent->appendChild($node);
}

function commandes_order_history_payload(int $orderId, int $stateId, int $employeeId): string
{
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $root = $dom->createElement('prestashop');
    $root->setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    $dom->appendChild($root);
    $history = $dom->createElement('order_history');
    $root->appendChild($history);

    commandes_append_xml_text($dom, $history, 'id', '');
    commandes_append_xml_text($dom, $history, 'id_employee', $employeeId);
    commandes_append_xml_text($dom, $history, 'id_order_state', $stateId);
    commandes_append_xml_text($dom, $history, 'id_order', $orderId);
    commandes_append_xml_text($dom, $history, 'date_add', date('Y-m-d H:i:s'));

    $xml = $dom->saveXML();
    if ($xml === false) {
        throw new RuntimeException('XML changement de statut impossible a generer.');
    }

    return $xml;
}

function commandes_change_order_status(PDO $pdo, array $user, int $orderId, int $stateId): array
{
    if ($orderId <= 0 || $stateId <= 0) {
        throw new InvalidArgumentException('Commande ou statut invalide.');
    }

    [$shopUrl, $apiKey] = commandes_prestashop_context($pdo);
    $states = commandes_fetch_order_states($shopUrl, $apiKey);
    if (!isset($states[$stateId])) {
        throw new InvalidArgumentException('Statut PrestaShop introuvable.');
    }

    $employeeId = commandes_resolve_prestashop_employee_id($shopUrl, $apiKey, $user);
    oceanos_prestashop_post_xml(
        $shopUrl,
        $apiKey,
        'order_histories',
        commandes_order_history_payload($orderId, $stateId, $employeeId)
    );

    return commandes_fetch_order_detail($pdo, $orderId);
}

function commandes_dashboard(PDO $pdo, array $user, array $query = []): array
{
    [$orders, $states] = commandes_fetch_orders($pdo, $query);
    $total = 0.0;
    $paid = 0;
    $shipped = 0;
    foreach ($orders as $order) {
        $total += (float) ($order['totalPaid'] ?? 0);
        $state = is_array($order['currentState'] ?? null) ? $order['currentState'] : [];
        if (!empty($state['paid'])) {
            $paid++;
        }
        if (!empty($state['shipped']) || !empty($state['delivery'])) {
            $shipped++;
        }
    }

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'currentUser' => oceanos_public_user($user),
        'settings' => oceanos_prestashop_public_settings($pdo, commandes_is_admin($user)),
        'states' => $states,
        'orders' => $orders,
        'metrics' => [
            'orders' => count($orders),
            'totalPaid' => $total,
            'paid' => $paid,
            'shipped' => $shipped,
        ],
    ];
}
