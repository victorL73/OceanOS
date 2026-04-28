<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function mobywork_sql_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mobywork_sql_read_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function mobywork_sql_env_file_value(string $path, array $keys): string
{
    if (!is_file($path)) {
        return '';
    }

    $wanted = array_flip($keys);
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return '';
    }

    foreach ($lines as $line) {
        $line = trim((string) $line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!isset($wanted[$key])) {
            continue;
        }

        $value = trim($value, "\"'");
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function mobywork_sql_bridge_token(): string
{
    $env = trim((string) (getenv('MOBYWORK_BRIDGE_TOKEN') ?: ''));
    if ($env !== '') {
        return $env;
    }

    $serverToken = mobywork_sql_env_file_value('/etc/oceanos/mobywork-backend.env', ['MOBYWORK_BRIDGE_TOKEN']);
    if ($serverToken !== '') {
        return $serverToken;
    }

    $envFileToken = mobywork_sql_env_file_value(
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . '.env',
        ['MOBYWORK_BRIDGE_TOKEN']
    );
    if ($envFileToken !== '') {
        return $envFileToken;
    }

    $file = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . '.mobywork_bridge_secret';
    return is_file($file) ? trim((string) file_get_contents($file)) : '';
}

function mobywork_sql_require_bridge_token(): void
{
    $expected = mobywork_sql_bridge_token();
    $actual = trim((string) ($_SERVER['HTTP_X_MOBYWORK_BRIDGE'] ?? ''));
    if ($expected === '' || $actual === '' || !hash_equals($expected, $actual)) {
        mobywork_sql_json(['ok' => false, 'error' => 'forbidden'], 403);
    }
}

function mobywork_sql_pdo(): PDO
{
    $pdo = oceanos_pdo();
    mobywork_sql_ensure_schema($pdo);
    return $pdo;
}

function mobywork_sql_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $statement->execute([$table, $column]);
    if ((int) $statement->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    }
}

function mobywork_sql_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NULL UNIQUE,
            password_hash VARCHAR(255) NULL,
            nom VARCHAR(190) NULL,
            role VARCHAR(40) NOT NULL DEFAULT 'user',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_user_settings (
            user_id BIGINT UNSIGNED PRIMARY KEY,
            imap_host TEXT NULL,
            imap_port INT NULL,
            imap_user TEXT NULL,
            imap_pass TEXT NULL,
            smtp_host TEXT NULL,
            smtp_port INT NULL,
            smtp_user TEXT NULL,
            smtp_pass TEXT NULL,
            smtp_accounts LONGTEXT NULL,
            smtp_default_sender TEXT NULL,
            groq_api_key TEXT NULL,
            nom TEXT NULL,
            poste TEXT NULL,
            signature_email LONGTEXT NULL,
            signature_is_html INT NOT NULL DEFAULT 0,
            signature_photo LONGTEXT NULL,
            ai_tone TEXT NULL,
            ai_langue TEXT NULL,
            crm_template_promo LONGTEXT NULL,
            crm_template_vip LONGTEXT NULL,
            crm_template_relance LONGTEXT NULL,
            ps_api_url TEXT NULL,
            ps_api_key TEXT NULL,
            autopilot_archive_noreply INT NOT NULL DEFAULT 1,
            autopilot_archive_promo INT NOT NULL DEFAULT 1,
            autopilot_delay_relance INT NOT NULL DEFAULT 3,
            notif_panier_abandon INT NOT NULL DEFAULT 1,
            notif_stock_critique INT NOT NULL DEFAULT 1,
            notif_email_sans_reponse INT NOT NULL DEFAULT 1,
            finance_expense_coef DOUBLE NOT NULL DEFAULT 1.15,
            finance_client_delay INT NOT NULL DEFAULT 30,
            finance_supplier_delay INT NOT NULL DEFAULT 30,
            signature_illustration LONGTEXT NULL,
            marketing_target_roas DOUBLE NOT NULL DEFAULT 3.0,
            marketing_auto_pilot INT NOT NULL DEFAULT 0,
            marketing_daily_budget DOUBLE NOT NULL DEFAULT 50.0,
            marketing_google_ads_id TEXT NULL,
            marketing_meta_ads_id TEXT NULL,
            marketing_tiktok_ads_id TEXT NULL,
            quote_company_name TEXT NULL,
            quote_company_address TEXT NULL,
            quote_company_city TEXT NULL,
            quote_company_phone TEXT NULL,
            quote_company_email TEXT NULL,
            quote_company_siret TEXT NULL,
            quote_company_logo LONGTEXT NULL,
            quote_payment_terms TEXT NULL,
            quote_validity_days INT NOT NULL DEFAULT 30,
            quote_footer_note TEXT NULL,
            quote_html_template LONGTEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $settingsColumns = [
        'imap_host' => 'TEXT NULL',
        'imap_port' => 'INT NULL',
        'imap_user' => 'TEXT NULL',
        'imap_pass' => 'TEXT NULL',
        'smtp_host' => 'TEXT NULL',
        'smtp_port' => 'INT NULL',
        'smtp_user' => 'TEXT NULL',
        'smtp_pass' => 'TEXT NULL',
        'smtp_accounts' => 'LONGTEXT NULL',
        'smtp_default_sender' => 'TEXT NULL',
        'groq_api_key' => 'TEXT NULL',
        'nom' => 'TEXT NULL',
        'poste' => 'TEXT NULL',
        'signature_email' => 'LONGTEXT NULL',
        'signature_is_html' => 'INT NOT NULL DEFAULT 0',
        'signature_photo' => 'LONGTEXT NULL',
        'ai_tone' => 'TEXT NULL',
        'ai_langue' => 'TEXT NULL',
        'crm_template_promo' => 'LONGTEXT NULL',
        'crm_template_vip' => 'LONGTEXT NULL',
        'crm_template_relance' => 'LONGTEXT NULL',
        'ps_api_url' => 'TEXT NULL',
        'ps_api_key' => 'TEXT NULL',
        'autopilot_archive_noreply' => 'INT NOT NULL DEFAULT 1',
        'autopilot_archive_promo' => 'INT NOT NULL DEFAULT 1',
        'autopilot_delay_relance' => 'INT NOT NULL DEFAULT 3',
        'notif_panier_abandon' => 'INT NOT NULL DEFAULT 1',
        'notif_stock_critique' => 'INT NOT NULL DEFAULT 1',
        'notif_email_sans_reponse' => 'INT NOT NULL DEFAULT 1',
        'finance_expense_coef' => 'DOUBLE NOT NULL DEFAULT 1.15',
        'finance_client_delay' => 'INT NOT NULL DEFAULT 30',
        'finance_supplier_delay' => 'INT NOT NULL DEFAULT 30',
        'signature_illustration' => 'LONGTEXT NULL',
        'marketing_target_roas' => 'DOUBLE NOT NULL DEFAULT 3.0',
        'marketing_auto_pilot' => 'INT NOT NULL DEFAULT 0',
        'marketing_daily_budget' => 'DOUBLE NOT NULL DEFAULT 50.0',
        'marketing_google_ads_id' => 'TEXT NULL',
        'marketing_meta_ads_id' => 'TEXT NULL',
        'marketing_tiktok_ads_id' => 'TEXT NULL',
        'quote_company_name' => 'TEXT NULL',
        'quote_company_address' => 'TEXT NULL',
        'quote_company_city' => 'TEXT NULL',
        'quote_company_phone' => 'TEXT NULL',
        'quote_company_email' => 'TEXT NULL',
        'quote_company_siret' => 'TEXT NULL',
        'quote_company_logo' => 'LONGTEXT NULL',
        'quote_payment_terms' => 'TEXT NULL',
        'quote_validity_days' => 'INT NOT NULL DEFAULT 30',
        'quote_footer_note' => 'TEXT NULL',
        'quote_html_template' => 'LONGTEXT NULL',
    ];
    foreach ($settingsColumns as $column => $definition) {
        mobywork_sql_ensure_column($pdo, 'mobywork_user_settings', $column, $definition);
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_emails (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            uid BIGINT NULL,
            from_address TEXT NULL,
            subject TEXT NULL,
            content LONGTEXT NULL,
            categorie VARCHAR(80) NULL,
            priorite VARCHAR(80) NULL,
            status VARCHAR(80) NOT NULL DEFAULT 'a_repondre',
            resume LONGTEXT NULL,
            reponse_suggeree LONGTEXT NULL,
            date_reception DATETIME NULL,
            amount DOUBLE NULL,
            due_date TEXT NULL,
            reponse_formelle LONGTEXT NULL,
            reponse_amicale LONGTEXT NULL,
            reponse_rapide LONGTEXT NULL,
            html_content LONGTEXT NULL,
            attachments LONGTEXT NULL,
            action_recommandee TEXT NULL,
            is_business INT NULL,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
            mailbox_id VARCHAR(190) NULL,
            mailbox_address TEXT NULL,
            raw_imap_uid VARCHAR(80) NULL,
            UNIQUE KEY uniq_mobywork_emails_uid_user (uid, user_id),
            INDEX idx_mobywork_emails_user_date (user_id, date_reception)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    mobywork_sql_ensure_column($pdo, 'mobywork_emails', 'mailbox_id', 'VARCHAR(190) NULL');
    mobywork_sql_ensure_column($pdo, 'mobywork_emails', 'mailbox_address', 'TEXT NULL');
    mobywork_sql_ensure_column($pdo, 'mobywork_emails', 'raw_imap_uid', 'VARCHAR(80) NULL');

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_crm_activities (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            clientId BIGINT NULL,
            type VARCHAR(80) NULL,
            label TEXT NULL,
            message LONGTEXT NULL,
            date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            icon VARCHAR(80) NULL,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
            INDEX idx_mobywork_crm_user_date (user_id, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec("CREATE TABLE IF NOT EXISTS mobywork_dismissed_carts (user_id BIGINT UNSIGNED NOT NULL, cart_id BIGINT NOT NULL, PRIMARY KEY (user_id, cart_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS mobywork_dismissed_suggestions (user_id BIGINT UNSIGNED NOT NULL, suggestion_id VARCHAR(190) NOT NULL, PRIMARY KEY (user_id, suggestion_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_expenses (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
            amount DOUBLE NULL,
            supplier TEXT NULL,
            date TEXT NULL,
            category TEXT NULL,
            email_id BIGINT NULL,
            UNIQUE KEY uniq_mobywork_expenses_email (email_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_quotes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
            client_id BIGINT NULL,
            client_name TEXT NULL,
            client_email TEXT NULL,
            reference VARCHAR(120) NULL UNIQUE,
            status VARCHAR(80) NOT NULL DEFAULT 'Brouillon',
            total_ht DOUBLE NOT NULL DEFAULT 0,
            total_ttc DOUBLE NOT NULL DEFAULT 0,
            lines_json LONGTEXT NULL,
            date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            pdf_file_path VARCHAR(500) NULL,
            pdf_generated_at DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    mobywork_sql_ensure_column($pdo, 'mobywork_quotes', 'pdf_file_path', 'VARCHAR(500) NULL');
    mobywork_sql_ensure_column($pdo, 'mobywork_quotes', 'pdf_generated_at', 'DATETIME NULL');

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_marketing_campaigns (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name TEXT NOT NULL,
            platform VARCHAR(80) NOT NULL DEFAULT 'google',
            type VARCHAR(80) NOT NULL DEFAULT 'search',
            budget_daily DOUBLE NOT NULL DEFAULT 10,
            spent DOUBLE NOT NULL DEFAULT 0,
            impressions BIGINT NOT NULL DEFAULT 0,
            clicks BIGINT NOT NULL DEFAULT 0,
            conversions BIGINT NOT NULL DEFAULT 0,
            revenue DOUBLE NOT NULL DEFAULT 0,
            status VARCHAR(80) NOT NULL DEFAULT 'active',
            score VARCHAR(8) NOT NULL DEFAULT 'B',
            audience_id BIGINT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_marketing_audiences (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name TEXT NOT NULL,
            type VARCHAR(80) NOT NULL DEFAULT 'custom',
            size BIGINT NOT NULL DEFAULT 0,
            source VARCHAR(80) NOT NULL DEFAULT 'manual',
            status VARCHAR(80) NOT NULL DEFAULT 'active',
            description LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_marketing_rules (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name TEXT NOT NULL,
            condition_metric VARCHAR(80) NULL,
            condition_operator VARCHAR(16) NULL,
            condition_value DOUBLE NULL,
            action_type VARCHAR(80) NULL,
            action_value TEXT NULL,
            mode VARCHAR(80) NOT NULL DEFAULT 'manual',
            enabled INT NOT NULL DEFAULT 1,
            last_triggered DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_marketing_actions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            campaign_id BIGINT NULL,
            action_type VARCHAR(80) NULL,
            description LONGTEXT NULL,
            source VARCHAR(80) NOT NULL DEFAULT 'manual',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS mobywork_prospects (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            company_name TEXT NULL,
            email TEXT NULL,
            phone TEXT NULL,
            type TEXT NULL,
            tags LONGTEXT NULL,
            status VARCHAR(80) NOT NULL DEFAULT 'Nouveau',
            score INT NOT NULL DEFAULT 0,
            source TEXT NULL,
            raw_data LONGTEXT NULL,
            cleaned_data LONGTEXT NULL,
            last_contact_date DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
            city TEXT NULL,
            country TEXT NULL,
            street TEXT NULL,
            comments LONGTEXT NULL,
            category TEXT NULL,
            confidence INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    mobywork_sql_seed_demo_data($pdo);
}

function mobywork_sql_seed_demo_data(PDO $pdo): void
{
    if ((int) $pdo->query('SELECT COUNT(*) FROM mobywork_marketing_campaigns')->fetchColumn() === 0) {
        $campaigns = [
            ['Search - Winch Lewmar 44ST', 'google', 'search', 25, 487, 12400, 198, 23, 1196, 'active', 'A', 1],
            ['Retargeting Visiteurs Site', 'meta', 'retargeting', 15, 312, 18500, 296, 31, 2121, 'active', 'A', 1],
            ['Display - Accastillage Pro', 'google', 'display', 30, 623, 45000, 430, 12, 1308, 'active', 'C', 1],
            ['Lookalike FR Plaisanciers', 'meta', 'lookalike', 20, 401, 22000, 264, 18, 1360, 'active', 'B', 1],
        ];
        $statement = $pdo->prepare(
            'INSERT INTO mobywork_marketing_campaigns
             (name, platform, type, budget_daily, spent, impressions, clicks, conversions, revenue, status, score, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($campaigns as $campaign) {
            $statement->execute($campaign);
        }
    }

    if ((int) $pdo->query('SELECT COUNT(*) FROM mobywork_marketing_audiences')->fetchColumn() === 0) {
        $audiences = [
            ['Plaisanciers 35-65 ans', 'interest', 45000, 'google', 'active', 'Proprietaires de bateaux, interet voile/moteur', 1],
            ['Visiteurs site 30j', 'retargeting', 3200, 'pixel', 'active', 'Visiteurs du site dans les 30 derniers jours', 1],
            ['Acheteurs recents 90j', 'custom', 890, 'crm', 'active', 'Clients ayant achete dans les 90 derniers jours', 1],
        ];
        $statement = $pdo->prepare(
            'INSERT INTO mobywork_marketing_audiences
             (name, type, size, source, status, description, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($audiences as $audience) {
            $statement->execute($audience);
        }
    }

    if ((int) $pdo->query('SELECT COUNT(*) FROM mobywork_marketing_rules')->fetchColumn() === 0) {
        $rules = [
            ['ROAS eleve -> Augmenter budget', 'roas', '>', 4.0, 'increase_budget', '20', 'semi_auto', 1, 1],
            ['ROAS faible -> Pause campagne', 'roas', '<', 1.5, 'pause', null, 'manual', 1, 1],
        ];
        $statement = $pdo->prepare(
            'INSERT INTO mobywork_marketing_rules
             (name, condition_metric, condition_operator, condition_value, action_type, action_value, mode, enabled, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($rules as $rule) {
            $statement->execute($rule);
        }
    }

    if ((int) $pdo->query('SELECT COUNT(*) FROM mobywork_prospects')->fetchColumn() === 0) {
        $statement = $pdo->prepare(
            'INSERT INTO mobywork_prospects (company_name, email, type, status, score, city, country, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute(['Chantier Naval de l Atlantique', 'contact@atlantique-naval.fr', 'chantier naval', 'Nouveau', 85, 'Saint-Nazaire', 'France', 1]);
    }
}

function mobywork_sql_translate(string $sql): string
{
    $sql = trim($sql);
    $sql = rtrim($sql, ';');

    if (preg_match('/^(CREATE\s+TABLE|ALTER\s+TABLE)\b/i', $sql)) {
        return '';
    }

    $sql = preg_replace('/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i', 'INSERT IGNORE INTO', $sql) ?? $sql;
    $sql = preg_replace("/date\s*\(\s*'now'\s*,\s*'-7 days'\s*\)/i", 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)', $sql) ?? $sql;
    $sql = preg_replace('/\bdate\s*\(/i', 'DATE(', $sql) ?? $sql;

    $tables = [
        'users',
        'user_settings',
        'emails',
        'crm_activities',
        'dismissed_carts',
        'dismissed_suggestions',
        'expenses',
        'quotes',
        'marketing_campaigns',
        'marketing_audiences',
        'marketing_rules',
        'marketing_actions',
        'prospects',
    ];

    foreach ($tables as $table) {
        $sql = preg_replace('/(?<!mobywork_)\b' . preg_quote($table, '/') . '\b/i', 'mobywork_' . $table, $sql) ?? $sql;
    }

    return $sql;
}

function mobywork_sql_normalize_param(mixed $value): mixed
{
    if (!is_string($value)) {
        return $value;
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/', $value) === 1) {
        return str_replace('T', ' ', substr($value, 0, 19));
    }

    return $value;
}

function mobywork_sql_params(array $params): array
{
    return array_map('mobywork_sql_normalize_param', array_values($params));
}

mobywork_sql_require_bridge_token();

try {
    $input = mobywork_sql_read_json();
    $action = strtolower(trim((string) ($input['action'] ?? '')));
    $sql = mobywork_sql_translate((string) ($input['sql'] ?? ''));
    $params = mobywork_sql_params(is_array($input['params'] ?? null) ? $input['params'] : []);
    $pdo = mobywork_sql_pdo();

    if ($sql === '') {
        mobywork_sql_json(['ok' => true, 'rows' => [], 'row' => null, 'lastID' => 0, 'changes' => 0]);
    }

    if ($action === 'get') {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch();
        mobywork_sql_json(['ok' => true, 'row' => is_array($row) ? $row : null]);
    }

    if ($action === 'all') {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        mobywork_sql_json(['ok' => true, 'rows' => $statement->fetchAll()]);
    }

    if ($action === 'run') {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        mobywork_sql_json([
            'ok' => true,
            'lastID' => (int) $pdo->lastInsertId(),
            'changes' => $statement->rowCount(),
        ]);
    }

    mobywork_sql_json(['ok' => false, 'error' => 'Action SQL non supportee.'], 422);
} catch (Throwable $exception) {
    mobywork_sql_json(['ok' => false, 'error' => $exception->getMessage()], 500);
}
