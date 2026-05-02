<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function sav_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sav_read_json_request(): array
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

function sav_pdo(): PDO
{
    $pdo = oceanos_pdo();
    sav_ensure_schema($pdo);
    return $pdo;
}

function sav_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS sav_notification_state (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            last_customer_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            checked_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function sav_notification_state(PDO $pdo): ?array
{
    sav_ensure_schema($pdo);
    $row = $pdo->query('SELECT * FROM sav_notification_state WHERE id = 1 LIMIT 1')->fetch();
    return is_array($row) ? $row : null;
}

function sav_save_notification_state(PDO $pdo, int $lastCustomerMessageId): void
{
    sav_ensure_schema($pdo);
    $statement = $pdo->prepare(
        'INSERT INTO sav_notification_state (id, last_customer_message_id, checked_at)
         VALUES (1, :last_customer_message_id, NOW())
         ON DUPLICATE KEY UPDATE last_customer_message_id = VALUES(last_customer_message_id), checked_at = NOW()'
    );
    $statement->execute(['last_customer_message_id' => max(0, $lastCustomerMessageId)]);
}

function sav_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
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

function sav_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return sav_collect_nodes($xml, $container, $nodeName);
}

function sav_module_user_ids(PDO $pdo): array
{
    $rows = $pdo->query('SELECT * FROM oceanos_users WHERE is_active = 1 ORDER BY id ASC')->fetchAll();
    $userIds = [];
    foreach ($rows ?: [] as $row) {
        $modules = oceanos_decode_visible_modules($row['visible_modules_json'] ?? null);
        if (in_array('sav', $modules, true)) {
            $userIds[] = (int) $row['id'];
        }
    }

    return $userIds;
}

function sav_prestashop_context(PDO $pdo): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);

    return [$shopUrl, $apiKey, $settings];
}

function sav_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function sav_thread_statuses(): array
{
    return [
        ['id' => 'open', 'label' => 'Ouvert', 'tone' => 'success'],
        ['id' => 'pending1', 'label' => 'En attente client', 'tone' => 'warning'],
        ['id' => 'pending2', 'label' => 'En attente interne', 'tone' => 'warning'],
        ['id' => 'closed', 'label' => 'Ferme', 'tone' => 'muted'],
    ];
}

function sav_status_label(string $status): string
{
    foreach (sav_thread_statuses() as $entry) {
        if ($entry['id'] === $status) {
            return $entry['label'];
        }
    }

    return $status !== '' ? ucfirst($status) : 'Sans statut';
}

function sav_normalize_thread_status(string $status): string
{
    $status = strtolower(trim($status));
    $allowed = array_map(static fn(array $entry): string => $entry['id'], sav_thread_statuses());
    if (!in_array($status, $allowed, true)) {
        throw new InvalidArgumentException('Statut SAV invalide.');
    }

    return $status;
}

function sav_fetch_customer_summary(string $shopUrl, string $apiKey, int $customerId, string $fallbackEmail = ''): array
{
    if ($customerId <= 0) {
        return [
            'id' => 0,
            'name' => $fallbackEmail !== '' ? $fallbackEmail : 'Client invite',
            'email' => $fallbackEmail,
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
        $email = oceanos_xml_text($customer, 'email');

        return [
            'id' => $customerId,
            'name' => $name !== '' ? $name : ($company !== '' ? $company : ($email !== '' ? $email : 'Client #' . $customerId)),
            'email' => $email !== '' ? $email : $fallbackEmail,
            'company' => $company,
        ];
    } catch (Throwable) {
        return [
            'id' => $customerId,
            'name' => $fallbackEmail !== '' ? $fallbackEmail : 'Client #' . $customerId,
            'email' => $fallbackEmail,
            'company' => '',
        ];
    }
}

function sav_fetch_order_reference(string $shopUrl, string $apiKey, int $orderId): string
{
    if ($orderId <= 0) {
        return '';
    }

    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'orders/' . $orderId));
        $order = $xml->order ?? null;
        if ($order instanceof SimpleXMLElement) {
            return oceanos_xml_text($order, 'reference') ?: ('#' . $orderId);
        }
    } catch (Throwable) {
    }

    return '#' . $orderId;
}

function sav_fetch_contact_name(string $shopUrl, string $apiKey, int $contactId): string
{
    if ($contactId <= 0) {
        return '';
    }

    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'contacts/' . $contactId));
        $contact = $xml->contact ?? null;
        if ($contact instanceof SimpleXMLElement) {
            $name = oceanos_xml_language_value($contact, 'name');
            return $name !== '' ? $name : ('Contact #' . $contactId);
        }
    } catch (Throwable) {
    }

    return 'Contact #' . $contactId;
}

function sav_public_thread(SimpleXMLElement $node, array &$customers, array &$orders, array &$contacts, string $shopUrl, string $apiKey): array
{
    $id = (int) oceanos_xml_text($node, 'id');
    $customerId = (int) oceanos_xml_text($node, 'id_customer');
    $orderId = (int) oceanos_xml_text($node, 'id_order');
    $contactId = (int) oceanos_xml_text($node, 'id_contact');
    $email = oceanos_xml_text($node, 'email');

    if (!array_key_exists($customerId, $customers)) {
        $customers[$customerId] = sav_fetch_customer_summary($shopUrl, $apiKey, $customerId, $email);
    }
    if (!array_key_exists($orderId, $orders)) {
        $orders[$orderId] = sav_fetch_order_reference($shopUrl, $apiKey, $orderId);
    }
    if (!array_key_exists($contactId, $contacts)) {
        $contacts[$contactId] = sav_fetch_contact_name($shopUrl, $apiKey, $contactId);
    }

    $status = strtolower(oceanos_xml_text($node, 'status'));

    return [
        'id' => $id,
        'customerId' => $customerId,
        'orderId' => $orderId,
        'orderReference' => $orders[$orderId],
        'contactId' => $contactId,
        'contactName' => $contacts[$contactId],
        'email' => $email,
        'customer' => $customers[$customerId],
        'status' => $status,
        'statusLabel' => sav_status_label($status),
        'dateAdd' => oceanos_xml_text($node, 'date_add'),
        'dateUpd' => oceanos_xml_text($node, 'date_upd'),
    ];
}

function sav_fetch_threads(PDO $pdo, array $query = []): array
{
    [$shopUrl, $apiKey] = sav_prestashop_context($pdo);
    $limit = max(1, min(250, (int) ($query['limit'] ?? 80)));
    $filters = [
        'display' => '[id,id_customer,id_order,id_contact,email,token,status,date_add,date_upd]',
        'sort' => '[id_DESC]',
        'limit' => '0,' . $limit,
    ];

    $status = strtolower(trim((string) ($query['status'] ?? '')));
    if ($status !== '') {
        $filters['filter[status]'] = '[' . sav_normalize_thread_status($status) . ']';
    }

    try {
        $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_threads', 'customer_threads', 'customer_thread', $filters);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }

        $filters['display'] = '[id,id_customer,id_order,id_product,id_contact,email,token,status]';
        $filters['sort'] = '[id_DESC]';
        $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_threads', 'customer_threads', 'customer_thread', $filters);
    }

    $customers = [];
    $orders = [];
    $contacts = [];
    $threads = [];
    foreach ($nodes as $node) {
        $threads[] = sav_public_thread($node, $customers, $orders, $contacts, $shopUrl, $apiKey);
    }

    return $threads;
}

function sav_public_message(SimpleXMLElement $node): array
{
    $employeeId = (int) oceanos_xml_text($node, 'id_employee');

    return [
        'id' => (int) oceanos_xml_text($node, 'id'),
        'threadId' => (int) oceanos_xml_text($node, 'id_customer_thread'),
        'employeeId' => $employeeId,
        'message' => trim(oceanos_xml_text($node, 'message')),
        'private' => oceanos_xml_text($node, 'private') === '1',
        'read' => oceanos_xml_text($node, 'read') === '1',
        'fromEmployee' => $employeeId > 0,
        'dateAdd' => oceanos_xml_text($node, 'date_add'),
        'dateUpd' => oceanos_xml_text($node, 'date_upd'),
    ];
}

function sav_fetch_thread_messages(string $shopUrl, string $apiKey, int $threadId): array
{
    $filters = [
        'filter[id_customer_thread]' => '[' . $threadId . ']',
        'display' => '[id,id_customer_thread,id_employee,message,private,read,date_add,date_upd]',
        'sort' => '[id_ASC]',
        'limit' => '0,200',
    ];

    try {
        $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_messages', 'customer_messages', 'customer_message', $filters);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }

        $filters['display'] = '[id,id_customer_thread,id_employee,message,private,read]';
        $filters['sort'] = '[id_ASC]';
        $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_messages', 'customer_messages', 'customer_message', $filters);
    }

    return array_map(static fn(SimpleXMLElement $node): array => sav_public_message($node), $nodes);
}

function sav_fetch_thread_detail(PDO $pdo, int $threadId): array
{
    if ($threadId <= 0) {
        throw new InvalidArgumentException('Demande SAV invalide.');
    }

    [$shopUrl, $apiKey] = sav_prestashop_context($pdo);
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'customer_threads/' . $threadId));
    $thread = $xml->customer_thread ?? null;
    if (!$thread instanceof SimpleXMLElement) {
        throw new RuntimeException('Demande SAV PrestaShop introuvable.');
    }

    $customers = [];
    $orders = [];
    $contacts = [];
    $publicThread = sav_public_thread($thread, $customers, $orders, $contacts, $shopUrl, $apiKey);

    return [
        ...$publicThread,
        'productId' => (int) oceanos_xml_text($thread, 'id_product'),
        'messages' => sav_fetch_thread_messages($shopUrl, $apiKey, $threadId),
    ];
}

function sav_fetch_thread_summary_remote(string $shopUrl, string $apiKey, int $threadId): array
{
    if ($threadId <= 0) {
        return [
            'id' => 0,
            'customer' => ['name' => 'Client', 'email' => '', 'company' => ''],
            'email' => '',
            'orderReference' => '',
            'contactName' => 'SAV',
            'status' => '',
            'statusLabel' => 'Sans statut',
        ];
    }

    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'customer_threads/' . $threadId));
    $thread = $xml->customer_thread ?? null;
    if (!$thread instanceof SimpleXMLElement) {
        throw new RuntimeException('Demande SAV PrestaShop introuvable.');
    }

    $customers = [];
    $orders = [];
    $contacts = [];
    return sav_public_thread($thread, $customers, $orders, $contacts, $shopUrl, $apiKey);
}

function sav_latest_remote_customer_message_id(string $shopUrl, string $apiKey): int
{
    $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_messages', 'customer_messages', 'customer_message', [
        'display' => '[id]',
        'sort' => '[id_DESC]',
        'limit' => '0,1',
    ]);
    if ($nodes === []) {
        return 0;
    }

    return (int) oceanos_xml_text($nodes[0], 'id');
}

function sav_recent_remote_messages_for_notifications(string $shopUrl, string $apiKey, int $afterMessageId, int $limit = 100): array
{
    $filters = [
        'display' => '[id,id_customer_thread,id_employee,message,private,read]',
        'sort' => '[id_DESC]',
        'limit' => '0,' . max(1, min(200, $limit)),
    ];

    $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, 'customer_messages', 'customer_messages', 'customer_message', $filters);
    $messages = [];
    foreach ($nodes as $node) {
        $messageId = (int) oceanos_xml_text($node, 'id');
        if ($messageId <= $afterMessageId) {
            continue;
        }
        $message = sav_public_message($node);
        if ((int) ($message['employeeId'] ?? 0) > 0 || !empty($message['private'])) {
            continue;
        }
        $messages[] = $message;
    }

    usort($messages, static fn(array $a, array $b): int => (int) $a['id'] <=> (int) $b['id']);
    return $messages;
}

function sav_dispatch_new_message_notifications(PDO $pdo): void
{
    sav_ensure_schema($pdo);
    [$shopUrl, $apiKey] = sav_prestashop_context($pdo);
    $latestMessageId = sav_latest_remote_customer_message_id($shopUrl, $apiKey);
    if ($latestMessageId <= 0) {
        sav_save_notification_state($pdo, 0);
        return;
    }

    $state = sav_notification_state($pdo);
    if ($state === null) {
        sav_save_notification_state($pdo, $latestMessageId);
        return;
    }

    $lastMessageId = (int) ($state['last_customer_message_id'] ?? 0);
    if ($latestMessageId <= $lastMessageId) {
        sav_save_notification_state($pdo, $lastMessageId);
        return;
    }

    $messages = sav_recent_remote_messages_for_notifications($shopUrl, $apiKey, $lastMessageId);
    $userIds = sav_module_user_ids($pdo);
    $threadCache = [];
    foreach ($messages as $message) {
        $messageId = (int) ($message['id'] ?? 0);
        $threadId = (int) ($message['threadId'] ?? 0);
        if ($messageId <= 0 || $threadId <= 0) {
            continue;
        }

        if (!array_key_exists($threadId, $threadCache)) {
            try {
                $threadCache[$threadId] = sav_fetch_thread_summary_remote($shopUrl, $apiKey, $threadId);
            } catch (Throwable) {
                $threadCache[$threadId] = [
                    'id' => $threadId,
                    'customer' => ['name' => 'Client', 'email' => '', 'company' => ''],
                    'email' => '',
                    'orderReference' => '',
                    'contactName' => 'SAV',
                ];
            }
        }

        $thread = $threadCache[$threadId];
        $customer = is_array($thread['customer'] ?? null) ? $thread['customer'] : [];
        $customerName = (string) ($customer['name'] ?? ($thread['email'] ?? 'Client'));
        $bodyText = trim((string) ($message['message'] ?? ''));
        $body = $customerName;
        if ($bodyText !== '') {
            $body .= ' - ' . mb_substr(preg_replace('/\s+/', ' ', $bodyText) ?? $bodyText, 0, 140);
        }

        foreach ($userIds as $userId) {
            oceanos_create_notification(
                $pdo,
                $userId,
                null,
                'SAV',
                'new_customer_message',
                'warning',
                'Nouveau message SAV',
                $body,
                '/SAV/?thread=' . $threadId,
                [
                    'messageId' => $messageId,
                    'threadId' => $threadId,
                    'customerName' => $customerName,
                    'orderReference' => (string) ($thread['orderReference'] ?? ''),
                ],
                'sav_new_message_' . $messageId . '_' . $userId
            );
        }
    }

    sav_save_notification_state($pdo, $latestMessageId);
}

function sav_first_prestashop_resource_id(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query = []): int
{
    $nodes = sav_fetch_prestashop_nodes($shopUrl, $apiKey, $resource, $container, $nodeName, $query);
    if ($nodes === []) {
        return 0;
    }

    return (int) oceanos_xml_text($nodes[0], 'id');
}

function sav_resolve_prestashop_employee_id(string $shopUrl, string $apiKey, array $user): int
{
    $email = trim((string) ($user['email'] ?? ''));
    if ($email !== '') {
        try {
            $employeeId = sav_first_prestashop_resource_id($shopUrl, $apiKey, 'employees', 'employees', 'employee', [
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
        $employeeId = sav_first_prestashop_resource_id($shopUrl, $apiKey, 'employees', 'employees', 'employee', [
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

function sav_set_xml_text(SimpleXMLElement $node, string $field, string|int|float|null $value): void
{
    if (!isset($node->{$field})) {
        $node->addChild($field);
    }
    $node->{$field} = (string) ($value ?? '');
}

function sav_wrap_xml(SimpleXMLElement $node): string
{
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $root = $dom->createElement('prestashop');
    $root->setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    $dom->appendChild($root);
    $imported = $dom->importNode(dom_import_simplexml($node), true);
    if (!$imported instanceof DOMNode) {
        throw new RuntimeException('XML PrestaShop impossible a preparer.');
    }
    $root->appendChild($imported);

    $xml = $dom->saveXML();
    if ($xml === false) {
        throw new RuntimeException('XML PrestaShop impossible a generer.');
    }

    return $xml;
}

function sav_blank_resource_node(string $shopUrl, string $apiKey, string $resource, string $nodeName): SimpleXMLElement
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, ['schema' => 'blank']));
    $node = $xml->{$nodeName} ?? null;
    if (!$node instanceof SimpleXMLElement) {
        throw new RuntimeException('Schema PrestaShop ' . $resource . ' introuvable.');
    }

    return $node;
}

function sav_append_xml_text(DOMDocument $dom, DOMElement $parent, string $name, string|int|float|null $value): void
{
    $node = $dom->createElement($name);
    $node->appendChild($dom->createCDATASection((string) ($value ?? '')));
    $parent->appendChild($node);
}

function sav_fallback_customer_message_payload(int $threadId, int $employeeId, string $message, bool $private): string
{
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $root = $dom->createElement('prestashop');
    $root->setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    $dom->appendChild($root);
    $node = $dom->createElement('customer_message');
    $root->appendChild($node);

    sav_append_xml_text($dom, $node, 'id', '');
    sav_append_xml_text($dom, $node, 'id_customer_thread', $threadId);
    sav_append_xml_text($dom, $node, 'id_employee', $employeeId);
    sav_append_xml_text($dom, $node, 'message', $message);
    sav_append_xml_text($dom, $node, 'file_name', '');
    sav_append_xml_text($dom, $node, 'ip_address', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    sav_append_xml_text($dom, $node, 'user_agent', 'OceanOS SAV');
    sav_append_xml_text($dom, $node, 'private', $private ? 1 : 0);
    sav_append_xml_text($dom, $node, 'read', 1);
    sav_append_xml_text($dom, $node, 'date_add', date('Y-m-d H:i:s'));
    sav_append_xml_text($dom, $node, 'date_upd', date('Y-m-d H:i:s'));

    $xml = $dom->saveXML();
    if ($xml === false) {
        throw new RuntimeException('XML reponse SAV impossible a generer.');
    }

    return $xml;
}

function sav_customer_message_payload(string $shopUrl, string $apiKey, int $threadId, int $employeeId, string $message, bool $private): string
{
    try {
        $node = sav_blank_resource_node($shopUrl, $apiKey, 'customer_messages', 'customer_message');
        sav_set_xml_text($node, 'id', '');
        sav_set_xml_text($node, 'id_customer_thread', $threadId);
        sav_set_xml_text($node, 'id_employee', $employeeId);
        sav_set_xml_text($node, 'message', $message);
        sav_set_xml_text($node, 'file_name', '');
        sav_set_xml_text($node, 'ip_address', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
        sav_set_xml_text($node, 'user_agent', 'OceanOS SAV');
        sav_set_xml_text($node, 'private', $private ? 1 : 0);
        sav_set_xml_text($node, 'read', 1);
        sav_set_xml_text($node, 'date_add', date('Y-m-d H:i:s'));
        sav_set_xml_text($node, 'date_upd', date('Y-m-d H:i:s'));

        return sav_wrap_xml($node);
    } catch (Throwable) {
        return sav_fallback_customer_message_payload($threadId, $employeeId, $message, $private);
    }
}

function sav_update_thread_status_remote(string $shopUrl, string $apiKey, int $threadId, string $status): void
{
    $status = sav_normalize_thread_status($status);
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'customer_threads/' . $threadId));
    $thread = $xml->customer_thread ?? null;
    if (!$thread instanceof SimpleXMLElement) {
        throw new RuntimeException('Demande SAV PrestaShop introuvable.');
    }

    sav_set_xml_text($thread, 'status', $status);
    sav_set_xml_text($thread, 'date_upd', date('Y-m-d H:i:s'));
    oceanos_prestashop_put_xml($shopUrl, $apiKey, 'customer_threads/' . $threadId, sav_wrap_xml($thread));
}

function sav_reply_to_thread(PDO $pdo, array $user, int $threadId, string $message, bool $private = false, string $nextStatus = 'open'): array
{
    $message = trim($message);
    if ($threadId <= 0) {
        throw new InvalidArgumentException('Demande SAV invalide.');
    }
    if ($message === '') {
        throw new InvalidArgumentException('La reponse SAV est vide.');
    }

    [$shopUrl, $apiKey] = sav_prestashop_context($pdo);
    $employeeId = sav_resolve_prestashop_employee_id($shopUrl, $apiKey, $user);
    oceanos_prestashop_post_xml(
        $shopUrl,
        $apiKey,
        'customer_messages',
        sav_customer_message_payload($shopUrl, $apiKey, $threadId, $employeeId, $message, $private)
    );

    if ($nextStatus !== '') {
        sav_update_thread_status_remote($shopUrl, $apiKey, $threadId, $nextStatus);
    }

    return sav_fetch_thread_detail($pdo, $threadId);
}

function sav_change_thread_status(PDO $pdo, int $threadId, string $status): array
{
    if ($threadId <= 0) {
        throw new InvalidArgumentException('Demande SAV invalide.');
    }

    [$shopUrl, $apiKey] = sav_prestashop_context($pdo);
    sav_update_thread_status_remote($shopUrl, $apiKey, $threadId, $status);

    return sav_fetch_thread_detail($pdo, $threadId);
}

function sav_dashboard(PDO $pdo, array $user, array $query = []): array
{
    $threads = sav_fetch_threads($pdo, $query);
    $metrics = [
        'threads' => count($threads),
        'open' => 0,
        'pending' => 0,
        'closed' => 0,
    ];
    foreach ($threads as $thread) {
        $status = (string) ($thread['status'] ?? '');
        if ($status === 'closed') {
            $metrics['closed']++;
        } elseif (str_starts_with($status, 'pending')) {
            $metrics['pending']++;
        } else {
            $metrics['open']++;
        }
    }

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'currentUser' => oceanos_public_user($user),
        'settings' => oceanos_prestashop_public_settings($pdo, sav_is_admin($user)),
        'statuses' => sav_thread_statuses(),
        'threads' => $threads,
        'metrics' => $metrics,
    ];
}
