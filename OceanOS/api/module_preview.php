<?php
declare(strict_types=1);

function oceanos_preview_module_definitions(): array
{
    return [
        'pilotocean' => [
            'moduleId' => 'pilotocean',
            'label' => 'PilotOcean',
            'href' => '/PilotOcean/',
            'agendaTypes' => [
                'pilot_review' => 'Revues cockpit',
                'pilot_alert' => 'Alertes pilotage',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'pilot_review',
                    'title' => 'Revue cockpit ERP',
                    'description' => 'Verifier CA, devis, commandes, stock critique, tresorerie et SAV.',
                    'priority' => 'high',
                    'offsetDays' => 1,
                ],
                [
                    'sourceType' => 'pilot_alert',
                    'title' => 'Qualifier les alertes transversales',
                    'description' => 'Transformer les alertes PilotOcean en actions dans les modules concernes.',
                    'priority' => 'normal',
                    'offsetDays' => 3,
                ],
            ],
        ],
        'portailclient' => [
            'moduleId' => 'portailclient',
            'label' => 'Portail Client',
            'href' => '/PortailClient/',
            'agendaTypes' => [
                'client_portal' => 'Preparations portail',
                'client_document' => 'Documents client',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'client_portal',
                    'title' => 'Preparer les acces client',
                    'description' => 'Identifier les clients NautiCRM a ouvrir dans le futur Portail Client.',
                    'priority' => 'normal',
                    'offsetDays' => 2,
                ],
                [
                    'sourceType' => 'client_document',
                    'title' => 'Publier les documents prioritaires',
                    'description' => 'Verifier les devis, factures, signatures et fichiers a exposer cote client.',
                    'priority' => 'high',
                    'offsetDays' => 5,
                ],
            ],
        ],
        'pimcean' => [
            'moduleId' => 'pimcean',
            'label' => 'PIMcean',
            'href' => '/PIMcean/',
            'agendaTypes' => [
                'product_enrichment' => 'Enrichissement produit',
                'catalog_sync' => 'Synchronisation catalogue',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'product_enrichment',
                    'title' => 'Prioriser les fiches produits a enrichir',
                    'description' => 'Croiser Stockcean, PrestaShop et SeoCean pour choisir les produits a corriger.',
                    'priority' => 'normal',
                    'offsetDays' => 4,
                ],
                [
                    'sourceType' => 'catalog_sync',
                    'title' => 'Preparer la regle de sync PrestaShop',
                    'description' => 'Definir quels champs PIMcean devront alimenter la boutique.',
                    'priority' => 'normal',
                    'offsetDays' => 9,
                ],
            ],
        ],
        'contratocean' => [
            'moduleId' => 'contratocean',
            'label' => 'ContratOcean',
            'href' => '/ContratOcean/',
            'agendaTypes' => [
                'contract_review' => 'Revues contrats',
                'renewal' => 'Renouvellements',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'contract_review',
                    'title' => 'Recenser les contrats actifs',
                    'description' => 'Rattacher contrats, garanties, documents signes et clients NautiCRM.',
                    'priority' => 'normal',
                    'offsetDays' => 6,
                ],
                [
                    'sourceType' => 'renewal',
                    'title' => 'Identifier les renouvellements a 30 jours',
                    'description' => 'Preparer les relances et futures factures recurrentes.',
                    'priority' => 'high',
                    'offsetDays' => 12,
                ],
            ],
        ],
        'qualiocean' => [
            'moduleId' => 'qualiocean',
            'label' => 'QualiOcean',
            'href' => '/QualiOcean/',
            'agendaTypes' => [
                'quality_check' => 'Controles qualite',
                'non_conformity' => 'Non-conformites',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'quality_check',
                    'title' => 'Creer les premieres checklists qualite',
                    'description' => 'Lister les controles livraison et SAV a standardiser.',
                    'priority' => 'normal',
                    'offsetDays' => 7,
                ],
                [
                    'sourceType' => 'non_conformity',
                    'title' => 'Relier SAV et non-conformites',
                    'description' => 'Definir quelles demandes SAV devront ouvrir une action QualiOcean.',
                    'priority' => 'high',
                    'offsetDays' => 10,
                ],
            ],
        ],
        'dataocean' => [
            'moduleId' => 'dataocean',
            'label' => 'DataOcean',
            'href' => '/DataOcean/',
            'agendaTypes' => [
                'bi_report' => 'Rapports BI',
                'kpi_review' => 'Revues KPI',
            ],
            'agendaTasks' => [
                [
                    'sourceType' => 'bi_report',
                    'title' => 'Definir les KPI DataOcean',
                    'description' => 'Choisir les indicateurs ventes, marge, stock, CRM et tresorerie.',
                    'priority' => 'high',
                    'offsetDays' => 8,
                ],
                [
                    'sourceType' => 'kpi_review',
                    'title' => 'Preparer le premier rapport de synthese',
                    'description' => 'Regrouper les donnees utiles de PilotOcean, Tresorcean et Stockcean.',
                    'priority' => 'normal',
                    'offsetDays' => 14,
                ],
            ],
        ],
    ];
}

function oceanos_preview_visible_module_definitions(array $user): array
{
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    $definitions = oceanos_preview_module_definitions();

    return array_values(array_filter(
        $definitions,
        static fn(array $definition): bool => in_array((string) $definition['moduleId'], $visibleModules, true)
    ));
}

function oceanos_dispatch_preview_module_notifications(PDO $pdo, int $userId): void
{
    if ($userId <= 0 || !function_exists('oceanos_create_notification')) {
        return;
    }

    $statement = $pdo->prepare(
        'SELECT id, email, display_name, role, is_active, visible_modules_json, created_at
         FROM oceanos_users
         WHERE id = :id AND is_active = 1
         LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    if (!is_array($user)) {
        return;
    }

    $definitions = oceanos_preview_visible_module_definitions($user);
    if ($definitions === []) {
        return;
    }

    $moduleIds = array_map(static fn(array $definition): string => (string) $definition['moduleId'], $definitions);
    sort($moduleIds);
    $dedupeKey = 'preview_modules_ready_' . sha1(implode(',', $moduleIds)) . '_v1';

    if (!oceanos_preview_notification_exists($pdo, $userId, $dedupeKey)) {
        $labels = array_map(static fn(array $definition): string => (string) $definition['label'], $definitions);
        oceanos_create_notification(
            $pdo,
            $userId,
            null,
            'OceanOS',
            'module_suite_ready',
            'info',
            'Nouveaux modules ERP relies',
            implode(', ', $labels) . ' sont disponibles dans OceanOS, Agenda et les droits modules.',
            '/PilotOcean/',
            [
                'modules' => array_map(static fn(array $definition): array => [
                    'moduleId' => (string) $definition['moduleId'],
                    'label' => (string) $definition['label'],
                    'href' => (string) $definition['href'],
                ], $definitions),
            ],
            $dedupeKey
        );
    }

    $visibleById = array_fill_keys($moduleIds, true);
    $dailyKey = date('Ymd');
    foreach (oceanos_preview_notification_alerts($pdo, $visibleById) as $alert) {
        $alertDedupeKey = 'preview_module_alert_' . $alert['moduleId'] . '_' . $alert['type'] . '_' . $dailyKey;
        if (oceanos_preview_notification_exists($pdo, $userId, $alertDedupeKey)) {
            continue;
        }

        oceanos_create_notification(
            $pdo,
            $userId,
            null,
            (string) $alert['module'],
            (string) $alert['type'],
            (string) $alert['severity'],
            (string) $alert['title'],
            (string) $alert['body'],
            (string) $alert['actionUrl'],
            is_array($alert['payload'] ?? null) ? $alert['payload'] : [],
            $alertDedupeKey
        );
    }
}

function oceanos_preview_notification_exists(PDO $pdo, int $userId, string $dedupeKey): bool
{
    if ($userId <= 0 || $dedupeKey === '' || !oceanos_preview_table_exists($pdo, 'oceanos_notifications')) {
        return false;
    }

    $existing = $pdo->prepare(
        'SELECT id
         FROM oceanos_notifications
         WHERE user_id = :user_id AND dedupe_key = :dedupe_key
         LIMIT 1'
    );
    $existing->execute([
        'user_id' => $userId,
        'dedupe_key' => $dedupeKey,
    ]);

    return $existing->fetchColumn() !== false;
}

function oceanos_preview_notification_alerts(PDO $pdo, array $visibleById): array
{
    $stats = oceanos_preview_stats($pdo);
    $alerts = [];
    $add = static function (
        string $moduleId,
        string $module,
        string $type,
        string $severity,
        string $title,
        string $body,
        string $actionUrl,
        int|float $score,
        array $payload = []
    ) use (&$alerts, $visibleById): void {
        if (empty($visibleById[$moduleId]) || $score <= 0) {
            return;
        }

        $alerts[] = [
            'moduleId' => $moduleId,
            'module' => $module,
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'body' => $body,
            'actionUrl' => $actionUrl,
            'payload' => ['score' => $score] + $payload,
        ];
    };

    $add(
        'pilotocean',
        'PilotOcean',
        'pilot_daily_attention',
        'warning',
        'PilotOcean: priorites transversales',
        (string) $stats['stockCritical'] . ' produits critiques, ' . (string) $stats['signedQuotesToConvert'] . ' devis signes a convertir et ' . (string) $stats['mailUrgent'] . ' emails urgents.',
        '/PilotOcean/',
        $stats['stockCritical'] + $stats['signedQuotesToConvert'] + $stats['mailUrgent'],
        ['stats' => $stats]
    );
    $add(
        'portailclient',
        'Portail Client',
        'client_portal_attention',
        'info',
        'Portail Client: elements client a publier',
        (string) ($stats['invoices'] + $stats['devisPdf']) . ' documents disponibles, ' . (string) $stats['signPending'] . ' signatures et ' . (string) ($stats['mailSupport'] + $stats['maintenanceFlows']) . ' demandes support.',
        '/PortailClient/',
        $stats['invoices'] + $stats['devisPdf'] + $stats['signPending'] + $stats['mailSupport'] + $stats['maintenanceFlows'],
        ['stats' => $stats]
    );
    $add(
        'pimcean',
        'PIMcean',
        'catalog_enrichment_attention',
        'warning',
        'PIMcean: catalogue a enrichir',
        (string) $stats['productsWithoutCost'] . ' couts manquants, ' . (string) $stats['productsWithoutSupplier'] . ' fournisseurs absents et ' . (string) $stats['productsMarginRisk'] . ' marges a risque.',
        '/PIMcean/',
        $stats['productsWithoutCost'] + $stats['productsWithoutSupplier'] + $stats['productsMarginRisk'],
        ['stats' => $stats]
    );
    $add(
        'contratocean',
        'ContratOcean',
        'contract_renewal_attention',
        'info',
        'ContratOcean: contrats et renouvellements',
        (string) $stats['recurringFlows'] . ' flux recurrents, ' . (string) $stats['crmFollowups'] . ' relances proches et ' . (string) $stats['signSigned'] . ' documents signes a classer.',
        '/ContratOcean/',
        $stats['recurringFlows'] + $stats['crmFollowups'] + $stats['signSigned'],
        ['stats' => $stats]
    );
    $add(
        'qualiocean',
        'QualiOcean',
        'quality_attention',
        'warning',
        'QualiOcean: controles et non-conformites',
        (string) ($stats['mailSupport'] + $stats['maintenanceFlows']) . ' signaux support, ' . (string) $stats['stockCritical'] . ' ruptures et ' . (string) $stats['formResponses'] . ' preuves formulaire.',
        '/QualiOcean/',
        $stats['mailSupport'] + $stats['maintenanceFlows'] + $stats['stockCritical'],
        ['stats' => $stats]
    );

    $sources = oceanos_preview_sources($pdo);
    $activeSources = count(array_filter(
        $sources,
        static fn(array $row): bool => !in_array((string) ($row[1] ?? ''), ['Non initialise', 'Pret, vide'], true)
    ));
    $add(
        'dataocean',
        'DataOcean',
        'bi_daily_digest',
        'info',
        'DataOcean: synthese KPI alimentee',
        (string) $activeSources . ' sources actives alimentent le rapport du jour.',
        '/DataOcean/',
        $activeSources,
        ['sources' => $sources, 'stats' => $stats]
    );

    return $alerts;
}

function oceanos_preview_table_exists(PDO $pdo, string $table): bool
{
    return function_exists('oceanos_table_exists') && oceanos_table_exists($pdo, $table);
}

function oceanos_preview_column_exists(PDO $pdo, string $table, string $column): bool
{
    return oceanos_preview_table_exists($pdo, $table)
        && function_exists('oceanos_column_exists')
        && oceanos_column_exists($pdo, $table, $column);
}

function oceanos_preview_scalar(PDO $pdo, string $sql, array $params = [], mixed $fallback = 0): mixed
{
    try {
        $statement = $pdo->prepare($sql);
        $statement->execute($params);
        $value = $statement->fetchColumn();
        return $value !== false && $value !== null ? $value : $fallback;
    } catch (Throwable) {
        return $fallback;
    }
}

function oceanos_preview_count(PDO $pdo, string $table, string $where = '1=1', array $params = []): int
{
    if (!oceanos_preview_table_exists($pdo, $table)) {
        return 0;
    }

    return (int) oceanos_preview_scalar($pdo, 'SELECT COUNT(*) FROM `' . $table . '` WHERE ' . $where, $params, 0);
}

function oceanos_preview_sum(PDO $pdo, string $table, string $column, string $where = '1=1', array $params = []): float
{
    if (!oceanos_preview_column_exists($pdo, $table, $column)) {
        return 0.0;
    }

    return (float) oceanos_preview_scalar($pdo, 'SELECT COALESCE(SUM(`' . $column . '`), 0) FROM `' . $table . '` WHERE ' . $where, $params, 0);
}

function oceanos_preview_money(float|int|string $amount): string
{
    $value = (float) $amount;
    if (abs($value) >= 1000) {
        return number_format($value / 1000, 1, ',', ' ') . ' kEUR';
    }

    return number_format($value, 0, ',', ' ') . ' EUR';
}

function oceanos_preview_percent(float|int|string $value): string
{
    return number_format((float) $value, 0, ',', ' ') . '%';
}

function oceanos_preview_metric(string $label, string $value, string $hint): array
{
    return [$label, $value, $hint];
}

function oceanos_preview_item(string $title, string $source, string $badge, string $actionUrl = ''): array
{
    return [$title, $source, $badge, $actionUrl];
}

function oceanos_preview_source_status(PDO $pdo, string $module, array $tables): array
{
    $existing = 0;
    $rows = 0;
    foreach ($tables as $table) {
        if (oceanos_preview_table_exists($pdo, $table)) {
            $existing++;
            $rows += oceanos_preview_count($pdo, $table);
        }
    }

    if ($existing === 0) {
        return [$module, 'Non initialise'];
    }

    return [$module, $rows > 0 ? (string) $rows . ' lignes' : 'Pret, vide'];
}

function oceanos_preview_stats(PDO $pdo): array
{
    $monthStart = (new DateTimeImmutable('first day of this month'))->format('Y-m-d 00:00:00');
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $inThirtyDays = (new DateTimeImmutable('today +30 days'))->format('Y-m-d');

    $invoiceActiveWhere = oceanos_preview_column_exists($pdo, 'invocean_invoices', 'deleted_at')
        ? "(deleted_at IS NULL) AND status NOT IN ('archived', 'rejected')"
        : "status NOT IN ('archived', 'rejected')";

    $invoiceMonthWhere = oceanos_preview_column_exists($pdo, 'invocean_invoices', 'created_at')
        ? $invoiceActiveWhere . ' AND created_at >= :month_start'
        : $invoiceActiveWhere;

    $treasuryBalance = 0.0;
    if (oceanos_preview_table_exists($pdo, 'tresorcean_entries')) {
        $treasuryBalance = (float) oceanos_preview_scalar(
            $pdo,
            "SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_tax_incl ELSE -amount_tax_incl END), 0) FROM tresorcean_entries",
            [],
            0
        );
    }

    return [
        'invoices' => oceanos_preview_count($pdo, 'invocean_invoices', $invoiceActiveWhere),
        'invoiceMonthTotal' => oceanos_preview_sum($pdo, 'invocean_invoices', 'total_tax_incl', $invoiceMonthWhere, ['month_start' => $monthStart]),
        'invoiceReady' => oceanos_preview_count($pdo, 'invocean_invoices', "status IN ('received', 'ready')"),
        'signedQuotes' => oceanos_preview_count($pdo, 'invocean_signed_quotes', "status IN ('signed', 'converted')"),
        'signedQuotesToConvert' => oceanos_preview_count($pdo, 'invocean_signed_quotes', "status = 'signed'"),
        'devis' => oceanos_preview_count($pdo, 'devis_quotes'),
        'devisDraft' => oceanos_preview_count($pdo, 'devis_quotes', "LOWER(status) IN ('brouillon', 'draft')"),
        'devisPdf' => oceanos_preview_count($pdo, 'devis_quotes', "pdf_file_path IS NOT NULL AND pdf_file_path <> ''"),
        'devisTotal' => oceanos_preview_sum($pdo, 'devis_quotes', 'total_ttc'),
        'products' => oceanos_preview_count($pdo, 'stockcean_products'),
        'stockCritical' => oceanos_preview_count($pdo, 'stockcean_products', 'quantity <= min_stock_alert'),
        'productsWithoutCost' => oceanos_preview_count($pdo, 'stockcean_products', 'purchase_price_tax_excl <= 0'),
        'productsWithoutSupplier' => oceanos_preview_count($pdo, 'stockcean_products', 'supplier_id IS NULL'),
        'productsMarginRisk' => oceanos_preview_count($pdo, 'stockcean_products', 'purchase_price_tax_excl > 0 AND price_tax_excl > 0 AND purchase_price_tax_excl >= price_tax_excl'),
        'suppliers' => oceanos_preview_count($pdo, 'stockcean_suppliers'),
        'purchaseOrdersOpen' => oceanos_preview_count($pdo, 'stockcean_purchase_orders', "status IN ('draft', 'ordered')"),
        'treasuryBalance' => $treasuryBalance,
        'treasuryInMonth' => oceanos_preview_sum($pdo, 'tresorcean_entries', 'amount_tax_incl', "direction = 'in' AND occurred_at >= :today_month", ['today_month' => substr($today, 0, 8) . '01']),
        'treasuryOutMonth' => oceanos_preview_sum($pdo, 'tresorcean_entries', 'amount_tax_incl', "direction = 'out' AND occurred_at >= :today_month", ['today_month' => substr($today, 0, 8) . '01']),
        'expenseNotesOpen' => oceanos_preview_count($pdo, 'tresorcean_expense_notes', "status IN ('received', 'approved')"),
        'vatPayments' => oceanos_preview_count($pdo, 'tresorcean_vat_payments'),
        'crmClients' => oceanos_preview_count($pdo, 'nauticrm_clients', "client_type IN ('client', 'partner') AND status <> 'archived'"),
        'crmProspects' => oceanos_preview_count($pdo, 'nauticrm_clients', "client_type = 'prospect' AND status <> 'archived'"),
        'crmFollowups' => oceanos_preview_count($pdo, 'nauticrm_clients', "next_action_at IS NOT NULL AND next_action_at <= :in_thirty_days AND status <> 'archived'", ['in_thirty_days' => $inThirtyDays]),
        'crmTasksOpen' => oceanos_preview_count($pdo, 'nauticrm_tasks', "status IN ('todo', 'doing')"),
        'crmOpportunitiesOpen' => oceanos_preview_count($pdo, 'nauticrm_opportunities', "stage NOT IN ('won', 'lost')"),
        'crmPipeline' => oceanos_preview_sum($pdo, 'nauticrm_opportunities', 'amount_tax_excl', "stage NOT IN ('won', 'lost')"),
        'recurringFlows' => oceanos_preview_count($pdo, 'nauticrm_client_flows', "is_recurring = 1 AND stage <> 'completed'"),
        'maintenanceFlows' => oceanos_preview_count($pdo, 'nauticrm_client_flows', "need_type IN ('maintenance', 'support', 'after_sales') AND stage <> 'completed'"),
        'prospectsActive' => oceanos_preview_count($pdo, 'prospection_prospects', "status NOT IN ('converted', 'lost', 'archived')"),
        'prospectsPositive' => oceanos_preview_count($pdo, 'prospection_prospects', "status = 'positive'"),
        'prospectionTasksOpen' => oceanos_preview_count($pdo, 'prospection_tasks', "status IN ('todo', 'doing')"),
        'mailNew' => oceanos_preview_count($pdo, 'nautimail_messages', "status IN ('new', 'triaged')"),
        'mailUrgent' => oceanos_preview_count($pdo, 'nautimail_messages', "priority IN ('high', 'urgent') AND status NOT IN ('replied', 'archived')"),
        'mailSupport' => oceanos_preview_count($pdo, 'nautimail_messages', "category = 'support' AND status NOT IN ('replied', 'archived')"),
        'mailFinance' => oceanos_preview_count($pdo, 'nautimail_messages', "category = 'finance' AND status NOT IN ('replied', 'archived')"),
        'replyDrafts' => oceanos_preview_count($pdo, 'nautimail_replies', "status = 'draft'"),
        'signPending' => oceanos_preview_count($pdo, 'nautisign_requests', "status = 'pending'"),
        'signSigned' => oceanos_preview_count($pdo, 'nautisign_requests', "status = 'signed'"),
        'forms' => oceanos_preview_count($pdo, 'formcean_forms'),
        'formResponses' => oceanos_preview_count($pdo, 'formcean_responses'),
        'agendaUpcoming' => oceanos_preview_count($pdo, 'agenda_events', "status = 'planned' AND starts_at >= :today", ['today' => $today . ' 00:00:00']),
        'seoAudits' => oceanos_preview_count($pdo, 'visiocean_page_audits'),
    ];
}

function oceanos_preview_sources(PDO $pdo): array
{
    return [
        oceanos_preview_source_status($pdo, 'Invocean', ['invocean_invoices', 'invocean_signed_quotes']),
        oceanos_preview_source_status($pdo, 'Devis', ['devis_quotes']),
        oceanos_preview_source_status($pdo, 'Stockcean', ['stockcean_products', 'stockcean_purchase_orders']),
        oceanos_preview_source_status($pdo, 'Tresorcean', ['tresorcean_entries', 'tresorcean_expense_notes']),
        oceanos_preview_source_status($pdo, 'NautiCRM', ['nauticrm_clients', 'nauticrm_tasks', 'nauticrm_opportunities']),
        oceanos_preview_source_status($pdo, 'Prospection', ['prospection_prospects', 'prospection_tasks']),
        oceanos_preview_source_status($pdo, 'NautiMail', ['nautimail_messages', 'nautimail_replies']),
        oceanos_preview_source_status($pdo, 'Nautisign', ['nautisign_requests']),
        oceanos_preview_source_status($pdo, 'Formcean', ['formcean_forms', 'formcean_responses']),
        oceanos_preview_source_status($pdo, 'Agenda', ['agenda_events']),
    ];
}

function oceanos_preview_common_status(PDO $pdo, array $stats, string $mode): array
{
    $activeSources = count(array_filter(
        oceanos_preview_sources($pdo),
        static fn(array $row): bool => !in_array((string) ($row[1] ?? ''), ['Non initialise', 'Pret, vide'], true)
    ));

    return [
        ['Donnees reelles', $activeSources . ' sources actives'],
        ['Mode', $mode],
        ['Mise a jour', date('d/m/Y H:i')],
    ];
}

function oceanos_preview_build_pilotocean(PDO $pdo, array $stats): array
{
    return [
        'metrics' => [
            oceanos_preview_metric('CA mois', oceanos_preview_money($stats['invoiceMonthTotal']), (string) $stats['invoices'] . ' factures'),
            oceanos_preview_metric('Devis a signer', (string) ($stats['devisDraft'] + $stats['signPending']), (string) $stats['signedQuotesToConvert'] . ' signes a convertir'),
            oceanos_preview_metric('Stock critique', (string) $stats['stockCritical'], (string) $stats['products'] . ' produits'),
            oceanos_preview_metric('Tresorerie', oceanos_preview_money($stats['treasuryBalance']), 'solde consolide'),
        ],
        'priorities' => [
            oceanos_preview_item('Convertir les devis signes en factures', 'Invocean + Nautisign', (string) $stats['signedQuotesToConvert'], '/Invocean/'),
            oceanos_preview_item('Traiter les ruptures et produits sous seuil', 'Stockcean', (string) $stats['stockCritical'], '/Stockcean/'),
            oceanos_preview_item('Relancer clients, prospects et mails urgents', 'NautiCRM + Prospection + NautiMail', (string) ($stats['crmFollowups'] + $stats['prospectionTasksOpen'] + $stats['mailUrgent']), '/NautiCRM/'),
            oceanos_preview_item('Controler notes de frais et mouvements finance', 'Tresorcean', (string) ($stats['expenseNotesOpen'] + $stats['mailFinance']), '/Tresorcean/'),
        ],
        'flows' => [
            oceanos_preview_item('Devis signe -> facture', (string) $stats['signedQuotesToConvert'], 'Invocean', '/Invocean/'),
            oceanos_preview_item('Commande -> stock', (string) $stats['purchaseOrdersOpen'], 'Stockcean', '/Stockcean/'),
            oceanos_preview_item('Prospect -> opportunite', (string) ($stats['prospectsPositive'] + $stats['crmOpportunitiesOpen']), 'CRM', '/NautiCRM/'),
            oceanos_preview_item('Support -> qualite', (string) ($stats['mailSupport'] + $stats['maintenanceFlows']), 'QualiOcean', '/QualiOcean/'),
        ],
        'statusRows' => oceanos_preview_common_status($pdo, $stats, 'Cockpit transversal'),
    ];
}

function oceanos_preview_build_portailclient(PDO $pdo, array $stats): array
{
    $documents = $stats['invoices'] + $stats['devisPdf'] + $stats['signSigned'];

    return [
        'metrics' => [
            oceanos_preview_metric('Clients actifs', (string) $stats['crmClients'], 'NautiCRM'),
            oceanos_preview_metric('Documents prets', (string) $documents, 'factures, devis, signes'),
            oceanos_preview_metric('Demandes support', (string) ($stats['mailSupport'] + $stats['maintenanceFlows']), 'SAV et emails'),
            oceanos_preview_metric('Signatures', (string) $stats['signPending'], 'en attente'),
        ],
        'priorities' => [
            oceanos_preview_item('Publier les factures et devis PDF disponibles', 'Invocean + Devis', (string) ($stats['invoices'] + $stats['devisPdf']), '/Invocean/'),
            oceanos_preview_item('Exposer les demandes support ouvertes', 'SAV + NautiMail', (string) ($stats['mailSupport'] + $stats['maintenanceFlows']), '/SAV/'),
            oceanos_preview_item('Relancer les signatures client', 'Nautisign', (string) $stats['signPending'], '/Nautisign/'),
            oceanos_preview_item('Verifier les clients sans suivi proche', 'NautiCRM', (string) $stats['crmFollowups'], '/NautiCRM/'),
        ],
        'flows' => [
            oceanos_preview_item('Client CRM -> compte portail', (string) $stats['crmClients'], 'Identites', '/NautiCRM/'),
            oceanos_preview_item('Factures -> espace client', (string) $stats['invoices'], 'Documents', '/Invocean/'),
            oceanos_preview_item('Devis -> signature', (string) $stats['signPending'], 'Nautisign', '/Nautisign/'),
            oceanos_preview_item('SAV -> fil client', (string) ($stats['mailSupport'] + $stats['replyDrafts']), 'Support', '/NautiMail/'),
        ],
        'statusRows' => oceanos_preview_common_status($pdo, $stats, 'Portail client interne'),
    ];
}

function oceanos_preview_build_pimcean(PDO $pdo, array $stats): array
{
    $marginPercent = $stats['products'] > 0
        ? 100 - (($stats['productsWithoutCost'] + $stats['productsMarginRisk']) / max(1, $stats['products']) * 100)
        : 0;

    return [
        'metrics' => [
            oceanos_preview_metric('Produits', (string) $stats['products'], 'Stockcean'),
            oceanos_preview_metric('A enrichir', (string) ($stats['productsWithoutCost'] + $stats['productsWithoutSupplier']), 'cout ou fournisseur'),
            oceanos_preview_metric('Marge saine', oceanos_preview_percent(max(0, $marginPercent)), (string) $stats['productsMarginRisk'] . ' risques'),
            oceanos_preview_metric('Sync & SEO', (string) ($stats['seoAudits'] + $stats['purchaseOrdersOpen']), 'audits / achats'),
        ],
        'priorities' => [
            oceanos_preview_item('Completer les couts d achat manquants', 'Stockcean', (string) $stats['productsWithoutCost'], '/Stockcean/'),
            oceanos_preview_item('Associer les fournisseurs produits', 'Stockcean', (string) $stats['productsWithoutSupplier'], '/Stockcean/'),
            oceanos_preview_item('Revoir les produits a marge negative ou nulle', 'Stockcean + Tresorcean', (string) $stats['productsMarginRisk'], '/Stockcean/'),
            oceanos_preview_item('Synchroniser contenu et recommandations SEO', 'SeoCean', (string) $stats['seoAudits'], '/SeoCean/'),
        ],
        'flows' => [
            oceanos_preview_item('Produit -> PrestaShop', (string) $stats['products'], 'Catalogue', '/Stockcean/'),
            oceanos_preview_item('Achat -> prix de revient', (string) $stats['purchaseOrdersOpen'], 'Achats', '/Stockcean/'),
            oceanos_preview_item('Catalogue -> SEO', (string) $stats['seoAudits'], 'SeoCean', '/SeoCean/'),
            oceanos_preview_item('Produit -> devis', (string) $stats['devis'], 'Devis', '/Devis/'),
        ],
        'statusRows' => oceanos_preview_common_status($pdo, $stats, 'Referentiel catalogue'),
    ];
}

function oceanos_preview_build_contratocean(PDO $pdo, array $stats): array
{
    return [
        'metrics' => [
            oceanos_preview_metric('Contrats inferes', (string) ($stats['recurringFlows'] + $stats['signSigned']), 'CRM + signatures'),
            oceanos_preview_metric('Renouv. 30j', (string) $stats['crmFollowups'], 'relances proches'),
            oceanos_preview_metric('Recurrent', oceanos_preview_money($stats['crmPipeline']), 'pipeline HT'),
            oceanos_preview_metric('Garanties/SAV', (string) $stats['maintenanceFlows'], 'flux maintenance'),
        ],
        'priorities' => [
            oceanos_preview_item('Transformer les flux recurrents en contrats', 'NautiCRM', (string) $stats['recurringFlows'], '/NautiCRM/'),
            oceanos_preview_item('Controle des documents signes', 'Nautisign + NautiCloud', (string) $stats['signSigned'], '/Nautisign/'),
            oceanos_preview_item('Planifier les renouvellements proches', 'Agenda + NautiCRM', (string) $stats['crmFollowups'], '/Agenda/'),
            oceanos_preview_item('Relier garanties, SAV et facturation', 'SAV + Invocean', (string) $stats['maintenanceFlows'], '/SAV/'),
        ],
        'flows' => [
            oceanos_preview_item('Signature -> contrat', (string) $stats['signSigned'], 'Nautisign', '/Nautisign/'),
            oceanos_preview_item('Contrat -> facture recurrente', (string) $stats['recurringFlows'], 'Invocean', '/Invocean/'),
            oceanos_preview_item('Contrat -> relance client', (string) $stats['crmFollowups'], 'NautiCRM', '/NautiCRM/'),
            oceanos_preview_item('Garantie -> SAV', (string) $stats['maintenanceFlows'], 'Support', '/SAV/'),
        ],
        'statusRows' => oceanos_preview_common_status($pdo, $stats, 'Contrats inferes'),
    ];
}

function oceanos_preview_build_qualiocean(PDO $pdo, array $stats): array
{
    return [
        'metrics' => [
            oceanos_preview_metric('Controles a creer', (string) ($stats['purchaseOrdersOpen'] + $stats['signPending']), 'livraison / signature'),
            oceanos_preview_metric('NC potentielles', (string) ($stats['mailSupport'] + $stats['stockCritical']), 'support + stock'),
            oceanos_preview_metric('Preuves', (string) ($stats['formResponses'] + $stats['signSigned']), 'formulaires / signatures'),
            oceanos_preview_metric('Audits', (string) $stats['forms'], 'Formcean'),
        ],
        'priorities' => [
            oceanos_preview_item('Creer les checklists livraison et SAV', 'Commandes + SAV', (string) ($stats['purchaseOrdersOpen'] + $stats['mailSupport']), '/QualiOcean/'),
            oceanos_preview_item('Qualifier les emails support urgents', 'NautiMail', (string) $stats['mailUrgent'], '/NautiMail/'),
            oceanos_preview_item('Transformer ruptures stock en actions correctives', 'Stockcean', (string) $stats['stockCritical'], '/Stockcean/'),
            oceanos_preview_item('Exploiter les reponses Formcean comme preuves', 'Formcean', (string) $stats['formResponses'], '/Formcean/'),
        ],
        'flows' => [
            oceanos_preview_item('SAV -> non-conformite', (string) $stats['mailSupport'], 'Support', '/SAV/'),
            oceanos_preview_item('Checklist -> preuve', (string) $stats['formResponses'], 'Formcean', '/Formcean/'),
            oceanos_preview_item('Produit critique -> action', (string) $stats['stockCritical'], 'Stockcean', '/Stockcean/'),
            oceanos_preview_item('Controle -> document signe', (string) $stats['signSigned'], 'Nautisign', '/Nautisign/'),
        ],
        'statusRows' => oceanos_preview_common_status($pdo, $stats, 'Qualite operationnelle'),
    ];
}

function oceanos_preview_build_dataocean(PDO $pdo, array $stats): array
{
    $sources = oceanos_preview_sources($pdo);
    $activeSources = count(array_filter($sources, static fn(array $row): bool => !in_array((string) ($row[1] ?? ''), ['Non initialise', 'Pret, vide'], true)));
    $kpiCount = count(array_filter($stats, static fn(mixed $value): bool => is_numeric($value) && (float) $value > 0));

    return [
        'metrics' => [
            oceanos_preview_metric('Sources actives', (string) $activeSources, count($sources) . ' surveillees'),
            oceanos_preview_metric('KPI alimentes', (string) $kpiCount, 'mesures non nulles'),
            oceanos_preview_metric('Pipeline', oceanos_preview_money($stats['crmPipeline']), 'CRM'),
            oceanos_preview_metric('Exports potentiels', (string) ($stats['forms'] + $stats['invoices'] + $stats['devis']), 'formulaires / docs'),
        ],
        'priorities' => [
            oceanos_preview_item('Construire le rapport ventes et marge', 'Invocean + Devis + Stockcean', (string) ($stats['invoices'] + $stats['devis'] + $stats['products']), '/DataOcean/'),
            oceanos_preview_item('Suivre tunnel prospect -> client', 'Prospection + NautiCRM', (string) ($stats['prospectsActive'] + $stats['crmClients']), '/Prospection/'),
            oceanos_preview_item('Analyser les stocks dormants ou critiques', 'Stockcean + PIMcean', (string) $stats['stockCritical'], '/Stockcean/'),
            oceanos_preview_item('Prevoir tresorerie et recurring', 'Tresorcean + ContratOcean', oceanos_preview_money($stats['treasuryBalance']), '/Tresorcean/'),
        ],
        'flows' => [
            oceanos_preview_item('ERP -> KPI', (string) $kpiCount, 'DataOcean', '/DataOcean/'),
            oceanos_preview_item('Formulaires -> exports', (string) $stats['formResponses'], 'Formcean', '/Formcean/'),
            oceanos_preview_item('Finance -> prevision', oceanos_preview_money($stats['treasuryBalance']), 'Tresorcean', '/Tresorcean/'),
            oceanos_preview_item('SEO -> acquisition', (string) $stats['seoAudits'], 'SeoCean', '/SeoCean/'),
        ],
        'statusRows' => $sources,
    ];
}

function oceanos_preview_module_payload(PDO $pdo, array $user, string $moduleId): array
{
    $moduleId = strtolower(trim($moduleId));
    $definitions = oceanos_preview_module_definitions();
    if (!isset($definitions[$moduleId])) {
        throw new InvalidArgumentException('Module de consolidation inconnu.');
    }

    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array($moduleId, $visibleModules, true)) {
        throw new RuntimeException('Module non autorise pour ce compte.');
    }

    $stats = oceanos_preview_stats($pdo);
    $payload = match ($moduleId) {
        'pilotocean' => oceanos_preview_build_pilotocean($pdo, $stats),
        'portailclient' => oceanos_preview_build_portailclient($pdo, $stats),
        'pimcean' => oceanos_preview_build_pimcean($pdo, $stats),
        'contratocean' => oceanos_preview_build_contratocean($pdo, $stats),
        'qualiocean' => oceanos_preview_build_qualiocean($pdo, $stats),
        'dataocean' => oceanos_preview_build_dataocean($pdo, $stats),
        default => [],
    };

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'moduleId' => $moduleId,
        'definition' => [
            'label' => (string) $definitions[$moduleId]['label'],
            'href' => (string) $definitions[$moduleId]['href'],
        ],
        'stats' => $stats,
        'sources' => oceanos_preview_sources($pdo),
        'updatedAt' => date(DATE_ATOM),
        ...$payload,
    ];
}
