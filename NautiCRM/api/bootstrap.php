<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const NAUTICRM_MODULE_ID = 'nauticrm';

function nauticrm_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function nauticrm_read_json_request(): array
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

function nauticrm_pdo(): PDO
{
    $pdo = oceanos_pdo();
    nauticrm_ensure_schema($pdo);
    return $pdo;
}

function nauticrm_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_clients (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            prestashop_customer_id BIGINT UNSIGNED NULL UNIQUE,
            prestashop_address_id BIGINT UNSIGNED NULL,
            prestashop_orders_count INT UNSIGNED NOT NULL DEFAULT 0,
            prestashop_total_paid_tax_incl DECIMAL(14,2) NOT NULL DEFAULT 0,
            prestashop_last_order_at DATETIME NULL,
            prestashop_synced_at DATETIME NULL,
            company_name VARCHAR(190) NOT NULL,
            client_type ENUM('prospect', 'client', 'partner', 'inactive') NOT NULL DEFAULT 'prospect',
            status ENUM('new', 'active', 'follow_up', 'won', 'lost', 'archived') NOT NULL DEFAULT 'new',
            priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
            segment VARCHAR(120) NULL,
            source VARCHAR(120) NULL,
            email VARCHAR(190) NULL,
            phone VARCHAR(80) NULL,
            website VARCHAR(255) NULL,
            address VARCHAR(255) NULL,
            city VARCHAR(160) NULL,
            country VARCHAR(100) NULL,
            siret VARCHAR(80) NULL,
            vat_number VARCHAR(80) NULL,
            assigned_user_id BIGINT UNSIGNED NULL,
            created_by_user_id BIGINT UNSIGNED NULL,
            updated_by_user_id BIGINT UNSIGNED NULL,
            next_action_at DATE NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_nauticrm_clients_name (company_name),
            KEY idx_nauticrm_clients_status (status),
            KEY idx_nauticrm_clients_type (client_type),
            KEY idx_nauticrm_clients_prestashop_customer (prestashop_customer_id),
            KEY idx_nauticrm_clients_assigned (assigned_user_id),
            KEY idx_nauticrm_clients_next_action (next_action_at),
            CONSTRAINT fk_nauticrm_clients_assigned FOREIGN KEY (assigned_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL,
            CONSTRAINT fk_nauticrm_clients_created_by FOREIGN KEY (created_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL,
            CONSTRAINT fk_nauticrm_clients_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_customer_id')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_customer_id BIGINT UNSIGNED NULL UNIQUE AFTER id');
    }
    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_address_id')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_address_id BIGINT UNSIGNED NULL AFTER prestashop_customer_id');
    }
    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_orders_count')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_orders_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER prestashop_address_id');
    }
    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_total_paid_tax_incl')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_total_paid_tax_incl DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER prestashop_orders_count');
    }
    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_last_order_at')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_last_order_at DATETIME NULL AFTER prestashop_total_paid_tax_incl');
    }
    if (!oceanos_column_exists($pdo, 'nauticrm_clients', 'prestashop_synced_at')) {
        $pdo->exec('ALTER TABLE nauticrm_clients ADD COLUMN prestashop_synced_at DATETIME NULL AFTER prestashop_last_order_at');
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_contacts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_id BIGINT UNSIGNED NOT NULL,
            first_name VARCHAR(120) NULL,
            last_name VARCHAR(120) NULL,
            job_title VARCHAR(160) NULL,
            email VARCHAR(190) NULL,
            phone VARCHAR(80) NULL,
            is_primary TINYINT(1) NOT NULL DEFAULT 0,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_nauticrm_contacts_client (client_id),
            KEY idx_nauticrm_contacts_email (email),
            CONSTRAINT fk_nauticrm_contacts_client FOREIGN KEY (client_id) REFERENCES nauticrm_clients(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_interactions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_id BIGINT UNSIGNED NOT NULL,
            contact_id BIGINT UNSIGNED NULL,
            user_id BIGINT UNSIGNED NULL,
            interaction_type ENUM('call', 'email', 'meeting', 'note', 'quote', 'order', 'support') NOT NULL DEFAULT 'note',
            subject VARCHAR(190) NOT NULL,
            body TEXT NULL,
            occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            next_action_at DATE NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_nauticrm_interactions_client (client_id, occurred_at),
            KEY idx_nauticrm_interactions_contact (contact_id),
            KEY idx_nauticrm_interactions_user (user_id),
            CONSTRAINT fk_nauticrm_interactions_client FOREIGN KEY (client_id) REFERENCES nauticrm_clients(id) ON DELETE CASCADE,
            CONSTRAINT fk_nauticrm_interactions_contact FOREIGN KEY (contact_id) REFERENCES nauticrm_contacts(id) ON DELETE SET NULL,
            CONSTRAINT fk_nauticrm_interactions_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_tasks (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_id BIGINT UNSIGNED NULL,
            assigned_user_id BIGINT UNSIGNED NULL,
            created_by_user_id BIGINT UNSIGNED NULL,
            title VARCHAR(190) NOT NULL,
            status ENUM('todo', 'doing', 'done', 'cancelled') NOT NULL DEFAULT 'todo',
            priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
            due_at DATE NULL,
            notes TEXT NULL,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_nauticrm_tasks_client (client_id),
            KEY idx_nauticrm_tasks_assigned (assigned_user_id),
            KEY idx_nauticrm_tasks_status_due (status, due_at),
            CONSTRAINT fk_nauticrm_tasks_client FOREIGN KEY (client_id) REFERENCES nauticrm_clients(id) ON DELETE CASCADE,
            CONSTRAINT fk_nauticrm_tasks_assigned FOREIGN KEY (assigned_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL,
            CONSTRAINT fk_nauticrm_tasks_created_by FOREIGN KEY (created_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_opportunities (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            stage ENUM('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost') NOT NULL DEFAULT 'lead',
            amount_tax_excl DECIMAL(14,2) NOT NULL DEFAULT 0,
            probability TINYINT UNSIGNED NOT NULL DEFAULT 20,
            expected_close_at DATE NULL,
            notes TEXT NULL,
            created_by_user_id BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_nauticrm_opportunities_client (client_id),
            KEY idx_nauticrm_opportunities_stage (stage),
            KEY idx_nauticrm_opportunities_expected (expected_close_at),
            CONSTRAINT fk_nauticrm_opportunities_client FOREIGN KEY (client_id) REFERENCES nauticrm_clients(id) ON DELETE CASCADE,
            CONSTRAINT fk_nauticrm_opportunities_created_by FOREIGN KEY (created_by_user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS nauticrm_sync_runs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NULL,
            source VARCHAR(60) NOT NULL DEFAULT 'prestashop',
            status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
            started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME NULL,
            customers_seen INT UNSIGNED NOT NULL DEFAULT 0,
            clients_created INT UNSIGNED NOT NULL DEFAULT 0,
            clients_updated INT UNSIGNED NOT NULL DEFAULT 0,
            contacts_upserted INT UNSIGNED NOT NULL DEFAULT 0,
            message TEXT NULL,
            raw_summary_json LONGTEXT NULL,
            KEY idx_nauticrm_sync_source_started (source, started_at),
            CONSTRAINT fk_nauticrm_sync_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function nauticrm_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(NAUTICRM_MODULE_ID, $visibleModules, true)) {
        nauticrm_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'NautiCRM n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function nauticrm_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function nauticrm_require_admin(array $user): void
{
    if (!nauticrm_is_admin($user)) {
        nauticrm_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Synchronisation reservee aux administrateurs.',
        ], 403);
    }
}

function nauticrm_clean_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): string
{
    $text = trim((string) $value);
    $text = str_replace("\0", '', $text);
    if ($singleLine) {
        $text = preg_replace('/\s+/u', ' ', $text) ?: '';
    }

    return mb_substr($text, 0, $maxLength);
}

function nauticrm_nullable_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): ?string
{
    $text = nauticrm_clean_text($value, $maxLength, $singleLine);
    return $text !== '' ? $text : null;
}

function nauticrm_email(mixed $value): ?string
{
    $email = mb_strtolower(nauticrm_clean_text($value, 190, true));
    if ($email === '') {
        return null;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email invalide.');
    }

    return $email;
}

function nauticrm_enum(mixed $value, array $allowed, string $fallback): string
{
    $candidate = strtolower(trim((string) $value));
    return in_array($candidate, $allowed, true) ? $candidate : $fallback;
}

function nauticrm_date(mixed $value): ?string
{
    $date = trim((string) $value);
    if ($date === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        throw new InvalidArgumentException('Date invalide.');
    }

    return $date;
}

function nauticrm_datetime(mixed $value): string
{
    $date = trim((string) $value);
    if ($date === '') {
        return date('Y-m-d H:i:s');
    }
    $date = str_replace('T', ' ', $date);
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $date)) {
        return $date . ':00';
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date)) {
        throw new InvalidArgumentException('Date et heure invalides.');
    }

    return $date;
}

function nauticrm_mysql_datetime_or_null(mixed $value): ?string
{
    $date = trim((string) $value);
    if ($date === '' || str_starts_with($date, '0000-00-00')) {
        return null;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date)) {
        return $date;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return $date . ' 00:00:00';
    }

    return null;
}

function nauticrm_money(mixed $value): string
{
    $normalized = str_replace(',', '.', trim((string) $value));
    if ($normalized === '') {
        return '0.00';
    }
    if (!is_numeric($normalized)) {
        throw new InvalidArgumentException('Montant invalide.');
    }

    return number_format(max(0, (float) $normalized), 2, '.', '');
}

function nauticrm_first_text(array $values): string
{
    foreach ($values as $value) {
        $text = nauticrm_clean_text($value, 255, true);
        if ($text !== '') {
            return $text;
        }
    }

    return '';
}

function nauticrm_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (isset($xml->{$nodeName})) {
        $nodes = [];
        foreach ($xml->{$nodeName} as $node) {
            $nodes[] = $node;
        }
        return $nodes;
    }

    if (!isset($xml->{$container}->{$nodeName})) {
        return [];
    }

    $nodes = [];
    foreach ($xml->{$container}->{$nodeName} as $node) {
        $nodes[] = $node;
    }

    return $nodes;
}

function nauticrm_fetch_prestashop_nodes(string $shopUrl, string $apiKey, string $resource, string $container, string $nodeName, array $query): array
{
    $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, $resource, $query));
    return nauticrm_collect_nodes($xml, $container, $nodeName);
}

function nauticrm_fetch_prestashop_customers(string $shopUrl, string $apiKey, int $limit): array
{
    $query = [
        'display' => '[id,firstname,lastname,email,company,siret,website,active,note,date_add,date_upd]',
        'sort' => '[id_ASC]',
        'limit' => '0,' . max(1, min(1000, $limit)),
    ];

    try {
        return nauticrm_fetch_prestashop_nodes($shopUrl, $apiKey, 'customers', 'customers', 'customer', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        return nauticrm_fetch_prestashop_nodes($shopUrl, $apiKey, 'customers', 'customers', 'customer', $query);
    }
}

function nauticrm_fetch_prestashop_addresses(string $shopUrl, string $apiKey, int $limit): array
{
    $query = [
        'display' => '[id,id_customer,alias,company,firstname,lastname,address1,address2,postcode,city,phone,phone_mobile,vat_number,dni,date_upd]',
        'sort' => '[id_customer_ASC]',
        'limit' => '0,' . max(1, min(3000, $limit)),
    ];

    try {
        return nauticrm_fetch_prestashop_nodes($shopUrl, $apiKey, 'addresses', 'addresses', 'address', $query);
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        return nauticrm_fetch_prestashop_nodes($shopUrl, $apiKey, 'addresses', 'addresses', 'address', $query);
    }
}

function nauticrm_fetch_prestashop_orders(string $shopUrl, string $apiKey, int $limit): array
{
    return nauticrm_fetch_prestashop_nodes($shopUrl, $apiKey, 'orders', 'orders', 'order', [
        'display' => '[id,id_customer,total_paid_tax_incl,date_add,date_upd]',
        'sort' => '[date_add_DESC]',
        'limit' => '0,' . max(1, min(5000, $limit)),
    ]);
}

function nauticrm_address_payload(SimpleXMLElement $node): array
{
    $address1 = oceanos_xml_text($node, 'address1');
    $address2 = oceanos_xml_text($node, 'address2');
    $postcode = oceanos_xml_text($node, 'postcode');
    $city = oceanos_xml_text($node, 'city');
    $line = trim(implode(' ', array_filter([$address1, $address2])));
    $cityLine = trim(implode(' ', array_filter([$postcode, $city])));

    return [
        'id' => (int) oceanos_xml_text($node, 'id'),
        'customerId' => (int) oceanos_xml_text($node, 'id_customer'),
        'company' => oceanos_xml_text($node, 'company'),
        'firstName' => oceanos_xml_text($node, 'firstname'),
        'lastName' => oceanos_xml_text($node, 'lastname'),
        'phone' => nauticrm_first_text([oceanos_xml_text($node, 'phone_mobile'), oceanos_xml_text($node, 'phone')]),
        'address' => $line,
        'city' => $cityLine !== '' ? $cityLine : $city,
        'vatNumber' => oceanos_xml_text($node, 'vat_number'),
        'siret' => oceanos_xml_text($node, 'dni'),
    ];
}

function nauticrm_customer_payload(SimpleXMLElement $node, ?array $address, array $orderStats): array
{
    $customerId = (int) oceanos_xml_text($node, 'id');
    $email = mb_strtolower(oceanos_xml_text($node, 'email'));
    $firstName = oceanos_xml_text($node, 'firstname');
    $lastName = oceanos_xml_text($node, 'lastname');
    $company = nauticrm_first_text([
        oceanos_xml_text($node, 'company'),
        $address['company'] ?? '',
        trim($firstName . ' ' . $lastName),
        $email,
        'Client PrestaShop #' . $customerId,
    ]);

    return [
        'prestashopCustomerId' => $customerId,
        'prestashopAddressId' => $address['id'] ?? null,
        'companyName' => $company,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '',
        'phone' => (string) ($address['phone'] ?? ''),
        'website' => oceanos_xml_text($node, 'website'),
        'address' => (string) ($address['address'] ?? ''),
        'city' => (string) ($address['city'] ?? ''),
        'siret' => nauticrm_first_text([oceanos_xml_text($node, 'siret'), $address['siret'] ?? '']),
        'vatNumber' => (string) ($address['vatNumber'] ?? ''),
        'note' => oceanos_xml_text($node, 'note'),
        'active' => (int) oceanos_xml_text($node, 'active') !== 0,
        'ordersCount' => (int) ($orderStats['count'] ?? 0),
        'totalPaidTaxIncl' => (float) ($orderStats['total'] ?? 0),
        'lastOrderAt' => (string) ($orderStats['lastOrderAt'] ?? ''),
    ];
}

function nauticrm_addresses_by_customer(array $addressNodes): array
{
    $addresses = [];
    foreach ($addressNodes as $node) {
        if (!$node instanceof SimpleXMLElement) {
            continue;
        }
        $address = nauticrm_address_payload($node);
        if ($address['customerId'] <= 0) {
            continue;
        }
        $addresses[$address['customerId']][] = $address;
    }

    foreach ($addresses as &$items) {
        usort($items, static function (array $left, array $right): int {
            $leftScore = ($left['phone'] !== '' ? 10 : 0) + ($left['company'] !== '' ? 4 : 0) + ($left['address'] !== '' ? 2 : 0);
            $rightScore = ($right['phone'] !== '' ? 10 : 0) + ($right['company'] !== '' ? 4 : 0) + ($right['address'] !== '' ? 2 : 0);
            return $rightScore <=> $leftScore ?: ((int) $right['id'] <=> (int) $left['id']);
        });
    }
    unset($items);

    return $addresses;
}

function nauticrm_order_stats_by_customer(array $orderNodes): array
{
    $stats = [];
    foreach ($orderNodes as $node) {
        if (!$node instanceof SimpleXMLElement) {
            continue;
        }
        $customerId = (int) oceanos_xml_text($node, 'id_customer');
        if ($customerId <= 0) {
            continue;
        }
        if (!isset($stats[$customerId])) {
            $stats[$customerId] = [
                'count' => 0,
                'total' => 0.0,
                'lastOrderAt' => '',
            ];
        }
        $date = oceanos_xml_text($node, 'date_add');
        $stats[$customerId]['count']++;
        $stats[$customerId]['total'] += (float) str_replace(',', '.', oceanos_xml_text($node, 'total_paid_tax_incl'));
        if ($date !== '' && ($stats[$customerId]['lastOrderAt'] === '' || strcmp($date, $stats[$customerId]['lastOrderAt']) > 0)) {
            $stats[$customerId]['lastOrderAt'] = $date;
        }
    }

    return $stats;
}

function nauticrm_find_client_for_prestashop_customer(PDO $pdo, array $customer): ?array
{
    $statement = $pdo->prepare('SELECT * FROM nauticrm_clients WHERE prestashop_customer_id = :prestashop_customer_id LIMIT 1');
    $statement->execute(['prestashop_customer_id' => (int) $customer['prestashopCustomerId']]);
    $row = $statement->fetch();
    if (is_array($row)) {
        return $row;
    }

    $email = trim((string) ($customer['email'] ?? ''));
    if ($email === '') {
        return null;
    }

    $statement = $pdo->prepare('SELECT * FROM nauticrm_clients WHERE email = :email ORDER BY id ASC LIMIT 1');
    $statement->execute(['email' => $email]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function nauticrm_merge_existing_text(?string $existing, string $incoming, bool $force = false): ?string
{
    $existing = trim((string) $existing);
    $incoming = trim($incoming);
    if ($force && $incoming !== '') {
        return $incoming;
    }

    return $existing !== '' ? $existing : ($incoming !== '' ? $incoming : null);
}

function nauticrm_upsert_prestashop_contact(PDO $pdo, int $clientId, array $customer): int
{
    $firstName = nauticrm_nullable_text($customer['firstName'] ?? '', 120, true);
    $lastName = nauticrm_nullable_text($customer['lastName'] ?? '', 120, true);
    $email = nauticrm_email($customer['email'] ?? '');
    $phone = nauticrm_nullable_text($customer['phone'] ?? '', 80, true);
    if ($firstName === null && $lastName === null && $email === null && $phone === null) {
        return 0;
    }

    $statement = null;
    if ($email !== null) {
        $statement = $pdo->prepare('SELECT id FROM nauticrm_contacts WHERE client_id = :client_id AND email = :email LIMIT 1');
        $statement->execute(['client_id' => $clientId, 'email' => $email]);
    }
    $contactId = $statement ? (int) ($statement->fetchColumn() ?: 0) : 0;
    if ($contactId <= 0) {
        $statement = $pdo->prepare('SELECT id FROM nauticrm_contacts WHERE client_id = :client_id AND is_primary = 1 LIMIT 1');
        $statement->execute(['client_id' => $clientId]);
        $contactId = (int) ($statement->fetchColumn() ?: 0);
    }

    if ($contactId > 0) {
        $statement = $pdo->prepare(
            'UPDATE nauticrm_contacts
             SET first_name = COALESCE(:first_name, first_name),
                 last_name = COALESCE(:last_name, last_name),
                 email = COALESCE(:email, email),
                 phone = COALESCE(:phone, phone),
                 is_primary = 1
             WHERE id = :id AND client_id = :client_id'
        );
        $statement->execute([
            'id' => $contactId,
            'client_id' => $clientId,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone' => $phone,
        ]);
        return 1;
    }

    $statement = $pdo->prepare(
        'INSERT INTO nauticrm_contacts (client_id, first_name, last_name, email, phone, is_primary)
         VALUES (:client_id, :first_name, :last_name, :email, :phone, 1)'
    );
    $statement->execute([
        'client_id' => $clientId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'phone' => $phone,
    ]);

    return 1;
}

function nauticrm_sync_run_start(PDO $pdo, array $user): int
{
    $statement = $pdo->prepare('INSERT INTO nauticrm_sync_runs (user_id, source) VALUES (:user_id, \'prestashop\')');
    $statement->execute(['user_id' => (int) $user['id']]);
    return (int) $pdo->lastInsertId();
}

function nauticrm_sync_run_finish(PDO $pdo, int $runId, string $status, array $summary, string $message): void
{
    $statement = $pdo->prepare(
        'UPDATE nauticrm_sync_runs
         SET status = :status,
             finished_at = NOW(),
             customers_seen = :customers_seen,
             clients_created = :clients_created,
             clients_updated = :clients_updated,
             contacts_upserted = :contacts_upserted,
             message = :message,
             raw_summary_json = :raw_summary_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $runId,
        'status' => $status,
        'customers_seen' => (int) ($summary['customersSeen'] ?? 0),
        'clients_created' => (int) ($summary['clientsCreated'] ?? 0),
        'clients_updated' => (int) ($summary['clientsUpdated'] ?? 0),
        'contacts_upserted' => (int) ($summary['contactsUpserted'] ?? 0),
        'message' => $message,
        'raw_summary_json' => json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function nauticrm_public_sync_run(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'source' => (string) $row['source'],
        'status' => (string) $row['status'],
        'startedAt' => (string) $row['started_at'],
        'finishedAt' => $row['finished_at'] !== null ? (string) $row['finished_at'] : null,
        'customersSeen' => (int) $row['customers_seen'],
        'clientsCreated' => (int) $row['clients_created'],
        'clientsUpdated' => (int) $row['clients_updated'],
        'contactsUpserted' => (int) $row['contacts_upserted'],
        'message' => (string) ($row['message'] ?? ''),
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
    ];
}

function nauticrm_latest_sync_run(PDO $pdo): ?array
{
    $row = $pdo->query(
        'SELECT r.*, u.display_name AS user_display_name
         FROM nauticrm_sync_runs r
         LEFT JOIN oceanos_users u ON u.id = r.user_id
         WHERE r.source = \'prestashop\'
         ORDER BY r.started_at DESC, r.id DESC
         LIMIT 1'
    )->fetch();

    return is_array($row) ? nauticrm_public_sync_run($row) : null;
}

function nauticrm_sync_prestashop_customers(PDO $pdo, array $user, int $limit = 500): array
{
    nauticrm_require_admin($user);
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $limit = max(1, min(1000, $limit));
    $runId = nauticrm_sync_run_start($pdo, $user);
    $summary = [
        'customersSeen' => 0,
        'clientsCreated' => 0,
        'clientsUpdated' => 0,
        'contactsUpserted' => 0,
        'addressesSeen' => 0,
        'ordersSeen' => 0,
        'warnings' => [],
    ];

    try {
        $customerNodes = nauticrm_fetch_prestashop_customers($shopUrl, $apiKey, $limit);
        $addressNodes = [];
        $orderNodes = [];
        try {
            $addressNodes = nauticrm_fetch_prestashop_addresses($shopUrl, $apiKey, $limit * 3);
        } catch (Throwable $exception) {
            $summary['warnings'][] = 'Adresses non importees: ' . $exception->getMessage();
        }
        try {
            $orderNodes = nauticrm_fetch_prestashop_orders($shopUrl, $apiKey, $limit * 5);
        } catch (Throwable $exception) {
            $summary['warnings'][] = 'Commandes non importees: ' . $exception->getMessage();
        }

        $addressesByCustomer = nauticrm_addresses_by_customer($addressNodes);
        $ordersByCustomer = nauticrm_order_stats_by_customer($orderNodes);
        $summary['addressesSeen'] = count($addressNodes);
        $summary['ordersSeen'] = count($orderNodes);

        foreach ($customerNodes as $node) {
            if (!$node instanceof SimpleXMLElement) {
                continue;
            }
            $customerId = (int) oceanos_xml_text($node, 'id');
            if ($customerId <= 0) {
                continue;
            }
            $summary['customersSeen']++;
            $customer = nauticrm_customer_payload(
                $node,
                $addressesByCustomer[$customerId][0] ?? null,
                $ordersByCustomer[$customerId] ?? []
            );
            $existing = nauticrm_find_client_for_prestashop_customer($pdo, $customer);
            $force = is_array($existing) && (int) ($existing['prestashop_customer_id'] ?? 0) === $customerId;
            $clientType = $customer['active'] ? 'client' : 'inactive';
            $status = is_array($existing) && (string) ($existing['status'] ?? '') === 'archived' ? 'archived' : 'active';

            if (is_array($existing)) {
                $statement = $pdo->prepare(
                    'UPDATE nauticrm_clients
                     SET prestashop_customer_id = :prestashop_customer_id,
                         prestashop_address_id = :prestashop_address_id,
                         prestashop_orders_count = :prestashop_orders_count,
                         prestashop_total_paid_tax_incl = :prestashop_total_paid_tax_incl,
                         prestashop_last_order_at = :prestashop_last_order_at,
                         prestashop_synced_at = NOW(),
                         company_name = :company_name,
                         client_type = :client_type,
                         status = :status,
                         segment = :segment,
                         source = :source,
                         email = :email,
                         phone = :phone,
                         website = :website,
                         address = :address,
                         city = :city,
                         siret = :siret,
                         vat_number = :vat_number,
                         updated_by_user_id = :updated_by_user_id
                     WHERE id = :id'
                );
                $statement->execute([
                    'id' => (int) $existing['id'],
                    'prestashop_customer_id' => $customerId,
                    'prestashop_address_id' => $customer['prestashopAddressId'],
                    'prestashop_orders_count' => $customer['ordersCount'],
                    'prestashop_total_paid_tax_incl' => number_format((float) $customer['totalPaidTaxIncl'], 2, '.', ''),
                    'prestashop_last_order_at' => nauticrm_mysql_datetime_or_null($customer['lastOrderAt']),
                    'company_name' => nauticrm_merge_existing_text($existing['company_name'] ?? '', $customer['companyName'], $force) ?? $customer['companyName'],
                    'client_type' => $clientType,
                    'status' => $status,
                    'segment' => nauticrm_merge_existing_text($existing['segment'] ?? '', 'PrestaShop'),
                    'source' => nauticrm_merge_existing_text($existing['source'] ?? '', 'PrestaShop'),
                    'email' => $customer['email'] !== '' ? $customer['email'] : ($existing['email'] ?? null),
                    'phone' => nauticrm_merge_existing_text($existing['phone'] ?? '', $customer['phone'], $force),
                    'website' => nauticrm_merge_existing_text($existing['website'] ?? '', $customer['website'], $force),
                    'address' => nauticrm_merge_existing_text($existing['address'] ?? '', $customer['address'], $force),
                    'city' => nauticrm_merge_existing_text($existing['city'] ?? '', $customer['city'], $force),
                    'siret' => nauticrm_merge_existing_text($existing['siret'] ?? '', $customer['siret'], $force),
                    'vat_number' => nauticrm_merge_existing_text($existing['vat_number'] ?? '', $customer['vatNumber'], $force),
                    'updated_by_user_id' => (int) $user['id'],
                ]);
                $clientId = (int) $existing['id'];
                $summary['clientsUpdated']++;
            } else {
                $statement = $pdo->prepare(
                    'INSERT INTO nauticrm_clients
                        (prestashop_customer_id, prestashop_address_id, prestashop_orders_count, prestashop_total_paid_tax_incl, prestashop_last_order_at, prestashop_synced_at, company_name, client_type, status, priority, segment, source, email, phone, website, address, city, siret, vat_number, created_by_user_id, updated_by_user_id)
                     VALUES
                        (:prestashop_customer_id, :prestashop_address_id, :prestashop_orders_count, :prestashop_total_paid_tax_incl, :prestashop_last_order_at, NOW(), :company_name, :client_type, :status, \'normal\', \'PrestaShop\', \'PrestaShop\', :email, :phone, :website, :address, :city, :siret, :vat_number, :created_by_user_id, :updated_by_user_id)'
                );
                $statement->execute([
                    'prestashop_customer_id' => $customerId,
                    'prestashop_address_id' => $customer['prestashopAddressId'],
                    'prestashop_orders_count' => $customer['ordersCount'],
                    'prestashop_total_paid_tax_incl' => number_format((float) $customer['totalPaidTaxIncl'], 2, '.', ''),
                    'prestashop_last_order_at' => nauticrm_mysql_datetime_or_null($customer['lastOrderAt']),
                    'company_name' => $customer['companyName'],
                    'client_type' => $clientType,
                    'status' => $status,
                    'email' => $customer['email'] !== '' ? $customer['email'] : null,
                    'phone' => $customer['phone'] !== '' ? $customer['phone'] : null,
                    'website' => $customer['website'] !== '' ? $customer['website'] : null,
                    'address' => $customer['address'] !== '' ? $customer['address'] : null,
                    'city' => $customer['city'] !== '' ? $customer['city'] : null,
                    'siret' => $customer['siret'] !== '' ? $customer['siret'] : null,
                    'vat_number' => $customer['vatNumber'] !== '' ? $customer['vatNumber'] : null,
                    'created_by_user_id' => (int) $user['id'],
                    'updated_by_user_id' => (int) $user['id'],
                ]);
                $clientId = (int) $pdo->lastInsertId();
                $summary['clientsCreated']++;
            }

            $summary['contactsUpserted'] += nauticrm_upsert_prestashop_contact($pdo, $clientId, $customer);
        }

        $message = sprintf(
            '%d client(s) PrestaShop lus, %d cree(s), %d mis a jour.',
            (int) $summary['customersSeen'],
            (int) $summary['clientsCreated'],
            (int) $summary['clientsUpdated']
        );
        nauticrm_sync_run_finish($pdo, $runId, 'success', $summary, $message);
        $summary['message'] = $message;
        return $summary;
    } catch (Throwable $exception) {
        $summary['message'] = $exception->getMessage();
        nauticrm_sync_run_finish($pdo, $runId, 'failed', $summary, $exception->getMessage());
        throw $exception;
    }
}

function nauticrm_user_options(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT * FROM oceanos_users
         WHERE is_active = 1
         ORDER BY display_name ASC, email ASC'
    )->fetchAll();

    return array_map(static fn(array $row): array => oceanos_public_user($row), $rows ?: []);
}

function nauticrm_public_client(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'prestashopCustomerId' => $row['prestashop_customer_id'] !== null ? (int) $row['prestashop_customer_id'] : null,
        'prestashopAddressId' => $row['prestashop_address_id'] !== null ? (int) $row['prestashop_address_id'] : null,
        'prestashopOrdersCount' => (int) ($row['prestashop_orders_count'] ?? 0),
        'prestashopTotalPaidTaxIncl' => (float) ($row['prestashop_total_paid_tax_incl'] ?? 0),
        'prestashopLastOrderAt' => $row['prestashop_last_order_at'] !== null ? (string) $row['prestashop_last_order_at'] : '',
        'prestashopSyncedAt' => $row['prestashop_synced_at'] !== null ? (string) $row['prestashop_synced_at'] : '',
        'companyName' => (string) $row['company_name'],
        'clientType' => (string) $row['client_type'],
        'status' => (string) $row['status'],
        'priority' => (string) $row['priority'],
        'segment' => (string) ($row['segment'] ?? ''),
        'source' => (string) ($row['source'] ?? ''),
        'email' => (string) ($row['email'] ?? ''),
        'phone' => (string) ($row['phone'] ?? ''),
        'website' => (string) ($row['website'] ?? ''),
        'address' => (string) ($row['address'] ?? ''),
        'city' => (string) ($row['city'] ?? ''),
        'country' => (string) ($row['country'] ?? ''),
        'siret' => (string) ($row['siret'] ?? ''),
        'vatNumber' => (string) ($row['vat_number'] ?? ''),
        'assignedUserId' => $row['assigned_user_id'] !== null ? (int) $row['assigned_user_id'] : null,
        'assignedUserDisplayName' => (string) ($row['assigned_user_display_name'] ?? ''),
        'assignedUserEmail' => (string) ($row['assigned_user_email'] ?? ''),
        'nextActionAt' => $row['next_action_at'] !== null ? (string) $row['next_action_at'] : '',
        'notes' => (string) ($row['notes'] ?? ''),
        'contactCount' => (int) ($row['contact_count'] ?? 0),
        'interactionCount' => (int) ($row['interaction_count'] ?? 0),
        'openTaskCount' => (int) ($row['open_task_count'] ?? 0),
        'opportunityAmount' => (float) ($row['opportunity_amount'] ?? 0),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function nauticrm_public_contact(array $row): array
{
    $name = trim((string) ($row['first_name'] ?? '') . ' ' . (string) ($row['last_name'] ?? ''));
    return [
        'id' => (int) $row['id'],
        'clientId' => (int) $row['client_id'],
        'firstName' => (string) ($row['first_name'] ?? ''),
        'lastName' => (string) ($row['last_name'] ?? ''),
        'name' => $name,
        'jobTitle' => (string) ($row['job_title'] ?? ''),
        'email' => (string) ($row['email'] ?? ''),
        'phone' => (string) ($row['phone'] ?? ''),
        'isPrimary' => (bool) ($row['is_primary'] ?? false),
        'notes' => (string) ($row['notes'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function nauticrm_public_interaction(array $row): array
{
    $contactName = trim((string) ($row['contact_first_name'] ?? '') . ' ' . (string) ($row['contact_last_name'] ?? ''));
    return [
        'id' => (int) $row['id'],
        'clientId' => (int) $row['client_id'],
        'clientName' => (string) ($row['company_name'] ?? ''),
        'contactId' => $row['contact_id'] !== null ? (int) $row['contact_id'] : null,
        'contactName' => $contactName,
        'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
        'userDisplayName' => (string) ($row['user_display_name'] ?? ''),
        'interactionType' => (string) $row['interaction_type'],
        'subject' => (string) $row['subject'],
        'body' => (string) ($row['body'] ?? ''),
        'occurredAt' => (string) $row['occurred_at'],
        'nextActionAt' => $row['next_action_at'] !== null ? (string) $row['next_action_at'] : '',
        'createdAt' => (string) ($row['created_at'] ?? ''),
    ];
}

function nauticrm_public_task(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'clientId' => $row['client_id'] !== null ? (int) $row['client_id'] : null,
        'clientName' => (string) ($row['company_name'] ?? ''),
        'assignedUserId' => $row['assigned_user_id'] !== null ? (int) $row['assigned_user_id'] : null,
        'assignedUserDisplayName' => (string) ($row['assigned_user_display_name'] ?? ''),
        'createdByUserId' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
        'title' => (string) $row['title'],
        'status' => (string) $row['status'],
        'priority' => (string) $row['priority'],
        'dueAt' => $row['due_at'] !== null ? (string) $row['due_at'] : '',
        'notes' => (string) ($row['notes'] ?? ''),
        'completedAt' => $row['completed_at'] !== null ? (string) $row['completed_at'] : '',
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function nauticrm_public_opportunity(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'clientId' => (int) $row['client_id'],
        'clientName' => (string) ($row['company_name'] ?? ''),
        'title' => (string) $row['title'],
        'stage' => (string) $row['stage'],
        'amountTaxExcl' => (float) $row['amount_tax_excl'],
        'probability' => (int) $row['probability'],
        'expectedCloseAt' => $row['expected_close_at'] !== null ? (string) $row['expected_close_at'] : '',
        'notes' => (string) ($row['notes'] ?? ''),
        'createdByUserId' => $row['created_by_user_id'] !== null ? (int) $row['created_by_user_id'] : null,
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function nauticrm_client_select_sql(): string
{
    return "SELECT
            c.*,
            assigned.display_name AS assigned_user_display_name,
            assigned.email AS assigned_user_email,
            (SELECT COUNT(*) FROM nauticrm_contacts ct WHERE ct.client_id = c.id) AS contact_count,
            (SELECT COUNT(*) FROM nauticrm_interactions i WHERE i.client_id = c.id) AS interaction_count,
            (SELECT COUNT(*) FROM nauticrm_tasks t WHERE t.client_id = c.id AND t.status IN ('todo', 'doing')) AS open_task_count,
            (SELECT COALESCE(SUM(o.amount_tax_excl), 0) FROM nauticrm_opportunities o WHERE o.client_id = c.id AND o.stage NOT IN ('won', 'lost')) AS opportunity_amount
        FROM nauticrm_clients c
        LEFT JOIN oceanos_users assigned ON assigned.id = c.assigned_user_id";
}

function nauticrm_find_client(PDO $pdo, int $clientId): ?array
{
    $statement = $pdo->prepare(nauticrm_client_select_sql() . ' WHERE c.id = :id LIMIT 1');
    $statement->execute(['id' => $clientId]);
    $row = $statement->fetch();

    return is_array($row) ? $row : null;
}

function nauticrm_require_client(PDO $pdo, int $clientId): array
{
    if ($clientId <= 0) {
        throw new InvalidArgumentException('Client invalide.');
    }

    $client = nauticrm_find_client($pdo, $clientId);
    if ($client === null) {
        throw new InvalidArgumentException('Client introuvable.');
    }

    return $client;
}

function nauticrm_stats(PDO $pdo): array
{
    $row = $pdo->query(
        "SELECT
            (SELECT COUNT(*) FROM nauticrm_clients WHERE status <> 'archived') AS client_count,
            (SELECT COUNT(*) FROM nauticrm_clients WHERE client_type = 'prospect' AND status <> 'archived') AS prospect_count,
            (SELECT COUNT(*) FROM nauticrm_clients WHERE client_type = 'client' AND status <> 'archived') AS active_client_count,
            (SELECT COUNT(*) FROM nauticrm_tasks WHERE status IN ('todo', 'doing')) AS open_task_count,
            (SELECT COUNT(*) FROM nauticrm_clients WHERE next_action_at IS NOT NULL AND next_action_at <= CURRENT_DATE AND status <> 'archived') AS due_followup_count,
            (SELECT COUNT(*) FROM nauticrm_clients WHERE prestashop_customer_id IS NOT NULL) AS prestashop_client_count,
            (SELECT COALESCE(SUM(amount_tax_excl), 0) FROM nauticrm_opportunities WHERE stage NOT IN ('won', 'lost')) AS pipeline_amount
        "
    )->fetch();

    return [
        'clientCount' => (int) ($row['client_count'] ?? 0),
        'prospectCount' => (int) ($row['prospect_count'] ?? 0),
        'activeClientCount' => (int) ($row['active_client_count'] ?? 0),
        'openTaskCount' => (int) ($row['open_task_count'] ?? 0),
        'dueFollowupCount' => (int) ($row['due_followup_count'] ?? 0),
        'prestashopClientCount' => (int) ($row['prestashop_client_count'] ?? 0),
        'pipelineAmount' => (float) ($row['pipeline_amount'] ?? 0),
    ];
}

function nauticrm_list_clients(PDO $pdo, array $query = []): array
{
    $where = [];
    $params = [];

    $status = nauticrm_clean_text($query['status'] ?? '', 40, true);
    if ($status !== '') {
        $where[] = 'c.status = :status';
        $params['status'] = nauticrm_enum($status, ['new', 'active', 'follow_up', 'won', 'lost', 'archived'], 'new');
    } else {
        $where[] = "c.status <> 'archived'";
    }

    $type = nauticrm_clean_text($query['type'] ?? '', 40, true);
    if ($type !== '') {
        $where[] = 'c.client_type = :client_type';
        $params['client_type'] = nauticrm_enum($type, ['prospect', 'client', 'partner', 'inactive'], 'prospect');
    }

    $assignedUserId = (int) ($query['assignedUserId'] ?? 0);
    if ($assignedUserId > 0) {
        $where[] = 'c.assigned_user_id = :assigned_user_id';
        $params['assigned_user_id'] = $assignedUserId;
    }

    $search = nauticrm_clean_text($query['search'] ?? '', 120, true);
    if ($search !== '') {
        $where[] = '(c.company_name LIKE :search OR c.email LIKE :search OR c.phone LIKE :search OR c.city LIKE :search OR c.segment LIKE :search OR c.source LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $sql = nauticrm_client_select_sql()
        . ($where !== [] ? ' WHERE ' . implode(' AND ', $where) : '')
        . ' ORDER BY c.next_action_at IS NULL ASC, c.next_action_at ASC, c.updated_at DESC, c.id DESC LIMIT 200';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);

    return array_map(static fn(array $row): array => nauticrm_public_client($row), $statement->fetchAll() ?: []);
}

function nauticrm_client_bundle(PDO $pdo, int $clientId): array
{
    $client = nauticrm_require_client($pdo, $clientId);

    $contacts = $pdo->prepare(
        'SELECT * FROM nauticrm_contacts
         WHERE client_id = :client_id
         ORDER BY is_primary DESC, last_name ASC, first_name ASC, id DESC'
    );
    $contacts->execute(['client_id' => $clientId]);

    $interactions = $pdo->prepare(
        'SELECT i.*, c.company_name, ct.first_name AS contact_first_name, ct.last_name AS contact_last_name, u.display_name AS user_display_name
         FROM nauticrm_interactions i
         INNER JOIN nauticrm_clients c ON c.id = i.client_id
         LEFT JOIN nauticrm_contacts ct ON ct.id = i.contact_id
         LEFT JOIN oceanos_users u ON u.id = i.user_id
         WHERE i.client_id = :client_id
         ORDER BY i.occurred_at DESC, i.id DESC
         LIMIT 80'
    );
    $interactions->execute(['client_id' => $clientId]);

    $tasks = $pdo->prepare(
        'SELECT t.*, c.company_name, assigned.display_name AS assigned_user_display_name
         FROM nauticrm_tasks t
         LEFT JOIN nauticrm_clients c ON c.id = t.client_id
         LEFT JOIN oceanos_users assigned ON assigned.id = t.assigned_user_id
         WHERE t.client_id = :client_id
         ORDER BY FIELD(t.status, \'todo\', \'doing\', \'done\', \'cancelled\'), t.due_at IS NULL ASC, t.due_at ASC, t.updated_at DESC
         LIMIT 100'
    );
    $tasks->execute(['client_id' => $clientId]);

    $opportunities = $pdo->prepare(
        'SELECT o.*, c.company_name
         FROM nauticrm_opportunities o
         INNER JOIN nauticrm_clients c ON c.id = o.client_id
         WHERE o.client_id = :client_id
         ORDER BY FIELD(o.stage, \'lead\', \'qualified\', \'proposal\', \'negotiation\', \'won\', \'lost\'), o.expected_close_at IS NULL ASC, o.expected_close_at ASC, o.updated_at DESC'
    );
    $opportunities->execute(['client_id' => $clientId]);

    return [
        'client' => nauticrm_public_client($client),
        'contacts' => array_map(static fn(array $row): array => nauticrm_public_contact($row), $contacts->fetchAll() ?: []),
        'interactions' => array_map(static fn(array $row): array => nauticrm_public_interaction($row), $interactions->fetchAll() ?: []),
        'tasks' => array_map(static fn(array $row): array => nauticrm_public_task($row), $tasks->fetchAll() ?: []),
        'opportunities' => array_map(static fn(array $row): array => nauticrm_public_opportunity($row), $opportunities->fetchAll() ?: []),
    ];
}

function nauticrm_list_recent_interactions(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT i.*, c.company_name, ct.first_name AS contact_first_name, ct.last_name AS contact_last_name, u.display_name AS user_display_name
         FROM nauticrm_interactions i
         INNER JOIN nauticrm_clients c ON c.id = i.client_id
         LEFT JOIN nauticrm_contacts ct ON ct.id = i.contact_id
         LEFT JOIN oceanos_users u ON u.id = i.user_id
         ORDER BY i.occurred_at DESC, i.id DESC
         LIMIT 30'
    )->fetchAll();

    return array_map(static fn(array $row): array => nauticrm_public_interaction($row), $rows ?: []);
}

function nauticrm_list_open_tasks(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT t.*, c.company_name, assigned.display_name AS assigned_user_display_name
         FROM nauticrm_tasks t
         LEFT JOIN nauticrm_clients c ON c.id = t.client_id
         LEFT JOIN oceanos_users assigned ON assigned.id = t.assigned_user_id
         WHERE t.status IN (\'todo\', \'doing\')
         ORDER BY t.due_at IS NULL ASC, t.due_at ASC, FIELD(t.priority, \'high\', \'normal\', \'low\'), t.updated_at DESC
         LIMIT 80'
    )->fetchAll();

    return array_map(static fn(array $row): array => nauticrm_public_task($row), $rows ?: []);
}

function nauticrm_list_opportunities(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT o.*, c.company_name
         FROM nauticrm_opportunities o
         INNER JOIN nauticrm_clients c ON c.id = o.client_id
         ORDER BY FIELD(o.stage, \'lead\', \'qualified\', \'proposal\', \'negotiation\', \'won\', \'lost\'), o.expected_close_at IS NULL ASC, o.expected_close_at ASC, o.updated_at DESC
         LIMIT 100'
    )->fetchAll();

    return array_map(static fn(array $row): array => nauticrm_public_opportunity($row), $rows ?: []);
}

function nauticrm_dashboard(PDO $pdo, array $query, array $user): array
{
    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'settings' => oceanos_prestashop_public_settings($pdo, nauticrm_is_admin($user)),
        'latestSync' => nauticrm_latest_sync_run($pdo),
        'stats' => nauticrm_stats($pdo),
        'clients' => nauticrm_list_clients($pdo, $query),
        'users' => nauticrm_user_options($pdo),
        'recentInteractions' => nauticrm_list_recent_interactions($pdo),
        'tasks' => nauticrm_list_open_tasks($pdo),
        'opportunities' => nauticrm_list_opportunities($pdo),
    ];
}

function nauticrm_save_client(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $companyName = nauticrm_clean_text($input['companyName'] ?? '', 190, true);
    if ($companyName === '') {
        throw new InvalidArgumentException('Le nom du client est obligatoire.');
    }

    $params = [
        'company_name' => $companyName,
        'client_type' => nauticrm_enum($input['clientType'] ?? '', ['prospect', 'client', 'partner', 'inactive'], 'prospect'),
        'status' => nauticrm_enum($input['status'] ?? '', ['new', 'active', 'follow_up', 'won', 'lost', 'archived'], 'new'),
        'priority' => nauticrm_enum($input['priority'] ?? '', ['low', 'normal', 'high'], 'normal'),
        'segment' => nauticrm_nullable_text($input['segment'] ?? '', 120, true),
        'source' => nauticrm_nullable_text($input['source'] ?? '', 120, true),
        'email' => nauticrm_email($input['email'] ?? ''),
        'phone' => nauticrm_nullable_text($input['phone'] ?? '', 80, true),
        'website' => nauticrm_nullable_text($input['website'] ?? '', 255, true),
        'address' => nauticrm_nullable_text($input['address'] ?? '', 255, true),
        'city' => nauticrm_nullable_text($input['city'] ?? '', 160, true),
        'country' => nauticrm_nullable_text($input['country'] ?? '', 100, true),
        'siret' => nauticrm_nullable_text($input['siret'] ?? '', 80, true),
        'vat_number' => nauticrm_nullable_text($input['vatNumber'] ?? '', 80, true),
        'assigned_user_id' => (int) ($input['assignedUserId'] ?? 0) > 0 ? (int) $input['assignedUserId'] : null,
        'updated_by_user_id' => (int) $user['id'],
        'next_action_at' => nauticrm_date($input['nextActionAt'] ?? ''),
        'notes' => nauticrm_nullable_text($input['notes'] ?? '', 8000, false),
    ];

    if ($id > 0) {
        nauticrm_require_client($pdo, $id);
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE nauticrm_clients
             SET company_name = :company_name,
                 client_type = :client_type,
                 status = :status,
                 priority = :priority,
                 segment = :segment,
                 source = :source,
                 email = :email,
                 phone = :phone,
                 website = :website,
                 address = :address,
                 city = :city,
                 country = :country,
                 siret = :siret,
                 vat_number = :vat_number,
                 assigned_user_id = :assigned_user_id,
                 updated_by_user_id = :updated_by_user_id,
                 next_action_at = :next_action_at,
                 notes = :notes
             WHERE id = :id'
        );
        $statement->execute($params);
        return nauticrm_client_bundle($pdo, $id);
    }

    $params['created_by_user_id'] = (int) $user['id'];
    $statement = $pdo->prepare(
        'INSERT INTO nauticrm_clients
            (company_name, client_type, status, priority, segment, source, email, phone, website, address, city, country, siret, vat_number, assigned_user_id, created_by_user_id, updated_by_user_id, next_action_at, notes)
         VALUES
            (:company_name, :client_type, :status, :priority, :segment, :source, :email, :phone, :website, :address, :city, :country, :siret, :vat_number, :assigned_user_id, :created_by_user_id, :updated_by_user_id, :next_action_at, :notes)'
    );
    $statement->execute($params);

    return nauticrm_client_bundle($pdo, (int) $pdo->lastInsertId());
}

function nauticrm_save_contact(PDO $pdo, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $clientId = (int) ($input['clientId'] ?? 0);
    nauticrm_require_client($pdo, $clientId);

    $firstName = nauticrm_nullable_text($input['firstName'] ?? '', 120, true);
    $lastName = nauticrm_nullable_text($input['lastName'] ?? '', 120, true);
    $email = nauticrm_email($input['email'] ?? '');
    if ($firstName === null && $lastName === null && $email === null) {
        throw new InvalidArgumentException('Ajoutez au moins un nom ou un email au contact.');
    }

    $params = [
        'client_id' => $clientId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'job_title' => nauticrm_nullable_text($input['jobTitle'] ?? '', 160, true),
        'email' => $email,
        'phone' => nauticrm_nullable_text($input['phone'] ?? '', 80, true),
        'is_primary' => !empty($input['isPrimary']) ? 1 : 0,
        'notes' => nauticrm_nullable_text($input['notes'] ?? '', 4000, false),
    ];

    $pdo->beginTransaction();
    try {
        if ((int) $params['is_primary'] === 1) {
            $clear = $pdo->prepare('UPDATE nauticrm_contacts SET is_primary = 0 WHERE client_id = :client_id');
            $clear->execute(['client_id' => $clientId]);
        }

        if ($id > 0) {
            $params['id'] = $id;
            $statement = $pdo->prepare(
                'UPDATE nauticrm_contacts
                 SET first_name = :first_name,
                     last_name = :last_name,
                     job_title = :job_title,
                     email = :email,
                     phone = :phone,
                     is_primary = :is_primary,
                     notes = :notes
                 WHERE id = :id AND client_id = :client_id'
            );
            $statement->execute($params);
        } else {
            $statement = $pdo->prepare(
                'INSERT INTO nauticrm_contacts (client_id, first_name, last_name, job_title, email, phone, is_primary, notes)
                 VALUES (:client_id, :first_name, :last_name, :job_title, :email, :phone, :is_primary, :notes)'
            );
            $statement->execute($params);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    return nauticrm_client_bundle($pdo, $clientId);
}

function nauticrm_log_interaction(PDO $pdo, array $user, array $input): array
{
    $clientId = (int) ($input['clientId'] ?? 0);
    nauticrm_require_client($pdo, $clientId);
    $contactId = (int) ($input['contactId'] ?? 0);
    $type = nauticrm_enum($input['interactionType'] ?? '', ['call', 'email', 'meeting', 'note', 'quote', 'order', 'support'], 'note');
    $subject = nauticrm_clean_text($input['subject'] ?? '', 190, true);
    if ($subject === '') {
        $subject = ucfirst($type);
    }

    $statement = $pdo->prepare(
        'INSERT INTO nauticrm_interactions (client_id, contact_id, user_id, interaction_type, subject, body, occurred_at, next_action_at)
         VALUES (:client_id, :contact_id, :user_id, :interaction_type, :subject, :body, :occurred_at, :next_action_at)'
    );
    $statement->execute([
        'client_id' => $clientId,
        'contact_id' => $contactId > 0 ? $contactId : null,
        'user_id' => (int) $user['id'],
        'interaction_type' => $type,
        'subject' => $subject,
        'body' => nauticrm_nullable_text($input['body'] ?? '', 8000, false),
        'occurred_at' => nauticrm_datetime($input['occurredAt'] ?? ''),
        'next_action_at' => nauticrm_date($input['nextActionAt'] ?? ''),
    ]);

    if (trim((string) ($input['nextActionAt'] ?? '')) !== '') {
        $update = $pdo->prepare('UPDATE nauticrm_clients SET next_action_at = :next_action_at, status = \'follow_up\', updated_by_user_id = :user_id WHERE id = :id');
        $update->execute([
            'id' => $clientId,
            'next_action_at' => nauticrm_date($input['nextActionAt']),
            'user_id' => (int) $user['id'],
        ]);
    }

    return nauticrm_client_bundle($pdo, $clientId);
}

function nauticrm_save_task(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $clientId = (int) ($input['clientId'] ?? 0);
    if ($clientId > 0) {
        nauticrm_require_client($pdo, $clientId);
    }
    $title = nauticrm_clean_text($input['title'] ?? '', 190, true);
    if ($title === '') {
        throw new InvalidArgumentException('Le titre de la tache est obligatoire.');
    }

    $status = nauticrm_enum($input['status'] ?? '', ['todo', 'doing', 'done', 'cancelled'], 'todo');
    $params = [
        'client_id' => $clientId > 0 ? $clientId : null,
        'assigned_user_id' => (int) ($input['assignedUserId'] ?? 0) > 0 ? (int) $input['assignedUserId'] : null,
        'title' => $title,
        'status' => $status,
        'priority' => nauticrm_enum($input['priority'] ?? '', ['low', 'normal', 'high'], 'normal'),
        'due_at' => nauticrm_date($input['dueAt'] ?? ''),
        'notes' => nauticrm_nullable_text($input['notes'] ?? '', 5000, false),
        'completed_at' => $status === 'done' ? date('Y-m-d H:i:s') : null,
    ];

    if ($id > 0) {
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE nauticrm_tasks
             SET client_id = :client_id,
                 assigned_user_id = :assigned_user_id,
                 title = :title,
                 status = :status,
                 priority = :priority,
                 due_at = :due_at,
                 notes = :notes,
                 completed_at = :completed_at
             WHERE id = :id'
        );
        $statement->execute($params);
    } else {
        $params['created_by_user_id'] = (int) $user['id'];
        $statement = $pdo->prepare(
            'INSERT INTO nauticrm_tasks (client_id, assigned_user_id, created_by_user_id, title, status, priority, due_at, notes, completed_at)
             VALUES (:client_id, :assigned_user_id, :created_by_user_id, :title, :status, :priority, :due_at, :notes, :completed_at)'
        );
        $statement->execute($params);
    }

    return $clientId > 0 ? nauticrm_client_bundle($pdo, $clientId) : [];
}

function nauticrm_save_opportunity(PDO $pdo, array $user, array $input): array
{
    $id = (int) ($input['id'] ?? 0);
    $clientId = (int) ($input['clientId'] ?? 0);
    nauticrm_require_client($pdo, $clientId);
    $title = nauticrm_clean_text($input['title'] ?? '', 190, true);
    if ($title === '') {
        throw new InvalidArgumentException('Le titre de l opportunite est obligatoire.');
    }

    $params = [
        'client_id' => $clientId,
        'title' => $title,
        'stage' => nauticrm_enum($input['stage'] ?? '', ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], 'lead'),
        'amount_tax_excl' => nauticrm_money($input['amountTaxExcl'] ?? '0'),
        'probability' => max(0, min(100, (int) ($input['probability'] ?? 20))),
        'expected_close_at' => nauticrm_date($input['expectedCloseAt'] ?? ''),
        'notes' => nauticrm_nullable_text($input['notes'] ?? '', 5000, false),
    ];

    if ($id > 0) {
        $params['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE nauticrm_opportunities
             SET title = :title,
                 stage = :stage,
                 amount_tax_excl = :amount_tax_excl,
                 probability = :probability,
                 expected_close_at = :expected_close_at,
                 notes = :notes
             WHERE id = :id AND client_id = :client_id'
        );
        $statement->execute($params);
    } else {
        $params['created_by_user_id'] = (int) $user['id'];
        $statement = $pdo->prepare(
            'INSERT INTO nauticrm_opportunities (client_id, title, stage, amount_tax_excl, probability, expected_close_at, notes, created_by_user_id)
             VALUES (:client_id, :title, :stage, :amount_tax_excl, :probability, :expected_close_at, :notes, :created_by_user_id)'
        );
        $statement->execute($params);
    }

    return nauticrm_client_bundle($pdo, $clientId);
}

function nauticrm_archive_client(PDO $pdo, array $user, array $input): array
{
    $clientId = (int) ($input['id'] ?? 0);
    nauticrm_require_client($pdo, $clientId);
    $statement = $pdo->prepare(
        'UPDATE nauticrm_clients
         SET status = \'archived\',
             client_type = \'inactive\',
             updated_by_user_id = :user_id
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $clientId,
        'user_id' => (int) $user['id'],
    ]);

    return nauticrm_dashboard($pdo, [], $user);
}
