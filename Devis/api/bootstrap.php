<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const DEVIS_PDF_PAGE_W = 595.28;
const DEVIS_PDF_PAGE_H = 841.89;
const DEVIS_PDF_MM = 72 / 25.4;

function devis_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function devis_read_json_request(): array
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

function devis_pdo(): PDO
{
    $pdo = oceanos_pdo();
    devis_ensure_schema($pdo);
    return $pdo;
}

function devis_column_exists(PDO $pdo, string $table, string $column): bool
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

function devis_ensure_column(PDO $pdo, string $table, string $column, string $definition): void
{
    if (!devis_column_exists($pdo, $table, $column)) {
        $pdo->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    }
}

function devis_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS devis_quotes (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            client_id BIGINT NULL,
            client_name TEXT NULL,
            client_email TEXT NULL,
            reference VARCHAR(120) NOT NULL,
            status VARCHAR(80) NOT NULL DEFAULT 'Brouillon',
            total_ht DECIMAL(14,6) NOT NULL DEFAULT 0,
            total_ttc DECIMAL(14,6) NOT NULL DEFAULT 0,
            lines_json LONGTEXT NULL,
            date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            pdf_file_path VARCHAR(500) NULL,
            pdf_generated_at DATETIME NULL,
            UNIQUE KEY uniq_devis_user_reference (user_id, reference),
            KEY idx_devis_quotes_user_updated (user_id, date_updated),
            CONSTRAINT fk_devis_quote_user FOREIGN KEY (user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    devis_ensure_column($pdo, 'devis_quotes', 'pdf_file_path', 'VARCHAR(500) NULL');
    devis_ensure_column($pdo, 'devis_quotes', 'pdf_generated_at', 'DATETIME NULL');
}

function devis_is_admin(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function devis_settings(PDO $pdo): array
{
    $row = oceanos_company_settings_row($pdo);

    return [
        'quote_company_name' => (string) ($row['company_name'] ?? 'RenovBoat'),
        'quote_company_address' => (string) ($row['company_address'] ?? ''),
        'quote_company_city' => (string) ($row['company_city'] ?? ''),
        'quote_company_phone' => (string) ($row['company_phone'] ?? ''),
        'quote_company_email' => (string) ($row['company_email'] ?? ''),
        'quote_company_siret' => (string) ($row['company_siret'] ?? ''),
        'quote_payment_terms' => (string) ($row['payment_terms'] ?? 'Virement bancaire a 30 jours'),
        'quote_validity_days' => (int) ($row['quote_validity_days'] ?? 30),
        'quote_footer_note' => (string) ($row['footer_note'] ?? 'Merci de votre confiance.'),
    ];
}

function devis_public_company_settings(PDO $pdo): array
{
    $settings = devis_settings($pdo);

    return [
        'companyName' => $settings['quote_company_name'],
        'companyPhone' => $settings['quote_company_phone'],
        'companyAddress' => $settings['quote_company_address'],
        'companyCity' => $settings['quote_company_city'],
        'companyEmail' => $settings['quote_company_email'],
        'companySiret' => $settings['quote_company_siret'],
        'paymentTerms' => $settings['quote_payment_terms'],
        'quoteValidityDays' => $settings['quote_validity_days'],
        'footerNote' => $settings['quote_footer_note'],
        'managedBy' => 'OceanOS',
    ];
}

function devis_collect_nodes(SimpleXMLElement $xml, string $container, string $nodeName): array
{
    if (!isset($xml->{$container}->{$nodeName})) {
        if (isset($xml->{$nodeName})) {
            $nodes = [];
            foreach ($xml->{$nodeName} as $node) {
                $nodes[] = $node;
            }
            return $nodes;
        }
        return [];
    }

    $nodes = [];
    foreach ($xml->{$container}->{$nodeName} as $node) {
        $nodes[] = $node;
    }

    return $nodes;
}

function devis_fetch_products(PDO $pdo, int $limit = 500): array
{
    $settings = oceanos_prestashop_private_settings($pdo);
    [$shopUrl, $apiKey] = oceanos_require_prestashop_settings($settings);
    $query = [
        'display' => '[id,reference,name,price,active,date_upd]',
        'sort' => '[name_ASC]',
        'limit' => '0,' . max(1, min(1000, $limit)),
    ];

    try {
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'products', $query));
    } catch (OceanosPrestashopException $exception) {
        if (!in_array($exception->statusCode, [400, 500], true)) {
            throw $exception;
        }
        $query['display'] = 'full';
        $xml = oceanos_load_xml(oceanos_prestashop_get($shopUrl, $apiKey, 'products', $query));
    }

    $products = [];
    foreach (devis_collect_nodes($xml, 'products', 'product') as $node) {
        $id = (int) oceanos_xml_text($node, 'id');
        if ($id <= 0) {
            continue;
        }
        $name = oceanos_xml_language_value($node, 'name');
        $products[] = [
            'id' => $id,
            'reference' => oceanos_xml_text($node, 'reference'),
            'name' => $name !== '' ? $name : 'Produit #' . $id,
            'price' => (float) str_replace(',', '.', oceanos_xml_text($node, 'price')),
            'active' => oceanos_xml_text($node, 'active') !== '0',
            'updatedAt' => oceanos_xml_text($node, 'date_upd'),
        ];
    }

    return $products;
}

function devis_parse_lines(?string $linesJson): array
{
    $decoded = json_decode((string) ($linesJson ?? '[]'), true);
    return is_array($decoded) ? array_values(array_filter($decoded, 'is_array')) : [];
}

function devis_public_quote(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'user_id' => (int) $row['user_id'],
        'client_id' => isset($row['client_id']) ? (int) $row['client_id'] : null,
        'client_name' => (string) ($row['client_name'] ?? ''),
        'client_email' => (string) ($row['client_email'] ?? ''),
        'reference' => (string) ($row['reference'] ?? ''),
        'status' => (string) ($row['status'] ?? 'Brouillon'),
        'total_ht' => (float) ($row['total_ht'] ?? 0),
        'total_ttc' => (float) ($row['total_ttc'] ?? 0),
        'lines' => devis_parse_lines($row['lines_json'] ?? null),
        'date_created' => (string) ($row['date_created'] ?? ''),
        'date_updated' => (string) ($row['date_updated'] ?? ''),
        'pdf_file_path' => (string) ($row['pdf_file_path'] ?? ''),
        'pdf_generated_at' => (string) ($row['pdf_generated_at'] ?? ''),
        'pdf_url' => '/Devis/api/devis.php?action=download&id=' . (int) $row['id'],
    ];
}

function devis_list_quotes(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare('SELECT * FROM devis_quotes WHERE user_id = :user_id ORDER BY date_updated DESC, id DESC LIMIT 200');
    $statement->execute(['user_id' => $userId]);

    return array_map(static fn(array $row): array => devis_public_quote($row), $statement->fetchAll());
}

function devis_quote_row(PDO $pdo, int $quoteId, int $userId): array
{
    $statement = $pdo->prepare('SELECT * FROM devis_quotes WHERE id = :id AND user_id = :user_id LIMIT 1');
    $statement->execute(['id' => $quoteId, 'user_id' => $userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        throw new InvalidArgumentException('Devis introuvable.');
    }

    return $row;
}

function devis_decimal(mixed $value): float
{
    if (is_string($value)) {
        $value = str_replace(',', '.', trim($value));
    }
    $number = (float) $value;
    return is_finite($number) ? $number : 0.0;
}

function devis_normalize_lines(array $lines): array
{
    $normalized = [];
    foreach ($lines as $line) {
        if (!is_array($line)) {
            continue;
        }
        $name = trim((string) ($line['name'] ?? ''));
        $productId = (int) ($line['product_id'] ?? $line['productId'] ?? 0);
        $rawLineType = strtolower(trim((string) ($line['line_type'] ?? $line['lineType'] ?? '')));
        $lineType = in_array($rawLineType, ['product', 'fee'], true)
            ? $rawLineType
            : ($productId > 0 ? 'product' : 'fee');
        $quantity = max(0.0, devis_decimal($line['quantity'] ?? 1));
        $unitPrice = max(0.0, devis_decimal($line['unit_price_ht'] ?? $line['unitPriceHt'] ?? 0));
        $catalogPrice = max(0.0, devis_decimal($line['catalog_price_ht'] ?? $line['catalogPriceHt'] ?? $line['base_unit_price_ht'] ?? $unitPrice));
        $taxRate = max(0.0, devis_decimal($line['tax_rate'] ?? $line['taxRate'] ?? 20));
        $rawPriceMode = strtolower(trim((string) ($line['price_mode'] ?? $line['priceMode'] ?? 'standard')));
        $priceMode = in_array($rawPriceMode, ['standard', 'b2b'], true) ? $rawPriceMode : 'standard';
        $b2bPercent = max(0.0, min(100.0, devis_decimal($line['b2b_percent'] ?? $line['b2bPercent'] ?? 0)));
        $rawFeeType = strtolower(trim((string) ($line['fee_type'] ?? $line['feeType'] ?? 'other')));
        $feeType = in_array($rawFeeType, ['delivery', 'handling', 'other'], true) ? $rawFeeType : 'other';
        if ($lineType !== 'fee' && $name === '' && $productId <= 0) {
            continue;
        }
        if ($lineType === 'fee' && $name === '' && $unitPrice <= 0) {
            continue;
        }

        $normalized[] = [
            'line_type' => $lineType,
            'fee_type' => $lineType === 'fee' ? $feeType : null,
            'product_id' => $productId > 0 ? $productId : null,
            'product_reference' => $lineType === 'fee' ? '' : trim((string) ($line['product_reference'] ?? $line['reference'] ?? '')),
            'name' => $name !== '' ? $name : ($lineType === 'fee' ? 'Frais annexe' : 'Produit #' . $productId),
            'quantity' => $quantity,
            'catalog_price_ht' => $lineType === 'fee' ? null : $catalogPrice,
            'unit_price_ht' => $unitPrice,
            'tax_rate' => $taxRate,
            'price_mode' => $lineType === 'fee' ? null : $priceMode,
            'b2b_percent' => $lineType === 'fee' || $priceMode !== 'b2b' ? null : $b2bPercent,
        ];
    }

    return $normalized;
}

function devis_totals(array $lines): array
{
    $totalHt = 0.0;
    $totalTtc = 0.0;
    foreach ($lines as $line) {
        $quantity = devis_decimal($line['quantity'] ?? 0);
        $unitPrice = devis_decimal($line['unit_price_ht'] ?? 0);
        $taxRate = devis_decimal($line['tax_rate'] ?? 0);
        $lineHt = $quantity * $unitPrice;
        $totalHt += $lineHt;
        $totalTtc += $lineHt * (1 + ($taxRate / 100));
    }

    return [
        'total_ht' => round($totalHt, 6),
        'total_ttc' => round($totalTtc, 6),
    ];
}

function devis_next_reference(PDO $pdo, int $userId): string
{
    $year = date('Y');
    $prefix = 'DEV-' . $year . '-';
    $statement = $pdo->prepare('SELECT reference FROM devis_quotes WHERE user_id = :user_id AND reference LIKE :prefix');
    $statement->execute([
        'user_id' => $userId,
        'prefix' => $prefix . '%',
    ]);

    $max = 0;
    foreach ($statement->fetchAll(PDO::FETCH_COLUMN) as $reference) {
        if (preg_match('/^DEV-' . preg_quote($year, '/') . '-(\d+)$/', (string) $reference, $matches)) {
            $max = max($max, (int) $matches[1]);
        }
    }

    return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
}

function devis_pdf_absolute_path(mixed $relativePath): string
{
    $relativePath = trim((string) $relativePath);
    if ($relativePath === '') {
        return '';
    }

    $relativePath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . ltrim($relativePath, DIRECTORY_SEPARATOR);
    $storageRoot = realpath(dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage');
    $fileRoot = realpath(dirname($path));
    if ($storageRoot === false || $fileRoot === false || !str_starts_with($fileRoot, $storageRoot)) {
        return '';
    }

    return $path;
}

function devis_delete_pdf_file(mixed $relativePath): void
{
    $path = devis_pdf_absolute_path($relativePath);
    if ($path !== '' && is_file($path)) {
        @unlink($path);
    }
}

function devis_pdf_storage_dir(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'quotes';
}

function devis_pdf_filename_for_quote(array $quote): string
{
    $reference = (string) ($quote['reference'] ?? ('DEV-' . time()));
    $filename = devis_safe_filename($reference);
    $quoteId = (int) ($quote['id'] ?? 0);
    if ($quoteId > 0) {
        $filename .= '-q' . $quoteId;
    }

    return $filename . '.pdf';
}

function devis_delete_previous_quote_pdfs(string $reference, mixed $keepRelativePath): void
{
    $storageDir = devis_pdf_storage_dir();
    if (!is_dir($storageDir)) {
        return;
    }

    $safeReference = devis_safe_filename($reference);
    if ($safeReference === '') {
        return;
    }

    $keepPath = devis_pdf_absolute_path($keepRelativePath);
    $keepRealPath = $keepPath !== '' && is_file($keepPath) ? realpath($keepPath) : false;
    foreach (scandir($storageDir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..' || !preg_match('/\.pdf$/i', $entry)) {
            continue;
        }
        if (!str_starts_with($entry, $safeReference . '-')) {
            continue;
        }

        $path = $storageDir . DIRECTORY_SEPARATOR . $entry;
        $realPath = is_file($path) ? realpath($path) : false;
        if ($realPath === false || ($keepRealPath !== false && $realPath === $keepRealPath)) {
            continue;
        }
        @unlink($realPath);
    }
}

function devis_sync_nautisign_quote_filename(PDO $pdo, int $userId, string $reference, string $filename): void
{
    if (!oceanos_table_exists($pdo, 'nautisign_requests')) {
        return;
    }

    $safeReference = devis_safe_filename($reference);
    if ($safeReference === '') {
        return;
    }

    $safeFilename = basename(str_replace('\\', '/', $filename));
    $safeFilename = preg_replace('/[^\pL\pN._ -]/u', '', $safeFilename) ?: '';
    if ($safeFilename === '') {
        return;
    }

    $statement = $pdo->prepare(
        "UPDATE nautisign_requests
         SET quote_filename = :quote_filename
         WHERE owner_user_id = :owner_user_id
           AND status <> 'signed'
           AND quote_filename LIKE :reference_prefix"
    );
    $statement->execute([
        'quote_filename' => 'devis/' . $safeFilename,
        'owner_user_id' => $userId,
        'reference_prefix' => 'devis/' . $safeReference . '%',
    ]);
}

function devis_ensure_writable_dir(string $dir, string $label): void
{
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Impossible de creer le dossier ' . $label . ' : ' . $dir);
    }

    clearstatcache(true, $dir);
    if (!is_writable($dir)) {
        @chmod($dir, 0775);
        clearstatcache(true, $dir);
    }

    if (!is_writable($dir)) {
        throw new RuntimeException('Le dossier ' . $label . ' n est pas accessible en ecriture par PHP : ' . $dir);
    }
}

function devis_save_quote(PDO $pdo, array $user, array $input): array
{
    $userId = (int) $user['id'];
    $quoteId = (int) ($input['id'] ?? 0);
    $generatedPdf = null;
    $oldPdfPath = '';
    $lines = devis_normalize_lines(is_array($input['lines'] ?? null) ? $input['lines'] : []);
    $totals = devis_totals($lines);
    $status = trim((string) ($input['status'] ?? 'Brouillon')) ?: 'Brouillon';
    $allowedStatuses = ['Brouillon', 'Envoye', 'Accepte', 'Refuse', 'Expire'];
    if (!in_array($status, $allowedStatuses, true)) {
        $status = 'Brouillon';
    }

    $params = [
        'user_id' => $userId,
        'client_id' => (int) ($input['client_id'] ?? 0) ?: null,
        'client_name' => trim((string) ($input['client_name'] ?? '')),
        'client_email' => trim((string) ($input['client_email'] ?? '')),
        'status' => $status,
        'total_ht' => number_format($totals['total_ht'], 6, '.', ''),
        'total_ttc' => number_format($totals['total_ttc'], 6, '.', ''),
        'lines_json' => json_encode($lines, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ];

    if ($params['client_email'] !== '' && !filter_var((string) $params['client_email'], FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email client invalide.');
    }

    try {
        $pdo->beginTransaction();
        if ($quoteId > 0) {
            $existingRow = devis_quote_row($pdo, $quoteId, $userId);
            $oldPdfPath = (string) ($existingRow['pdf_file_path'] ?? '');
            $params['id'] = $quoteId;
            $statement = $pdo->prepare(
                'UPDATE devis_quotes
                 SET client_id = :client_id,
                     client_name = :client_name,
                     client_email = :client_email,
                     status = :status,
                     total_ht = :total_ht,
                     total_ttc = :total_ttc,
                     lines_json = :lines_json,
                     date_updated = NOW()
                 WHERE id = :id AND user_id = :user_id'
            );
            $statement->execute($params);
        } else {
            $params['reference'] = devis_next_reference($pdo, $userId);
            $statement = $pdo->prepare(
                'INSERT INTO devis_quotes
                    (user_id, client_id, client_name, client_email, reference, status, total_ht, total_ttc, lines_json)
                 VALUES
                    (:user_id, :client_id, :client_name, :client_email, :reference, :status, :total_ht, :total_ttc, :lines_json)'
            );
            $statement->execute($params);
            $quoteId = (int) $pdo->lastInsertId();
        }

        $quote = devis_public_quote(devis_quote_row($pdo, $quoteId, $userId));
        $generatedPdf = devis_generate_quote_pdf($quote, devis_settings($pdo));
        $generatedAt = date('Y-m-d H:i:s');
        $statement = $pdo->prepare(
            'UPDATE devis_quotes
             SET pdf_file_path = :pdf_file_path,
                 pdf_generated_at = :pdf_generated_at
             WHERE id = :id AND user_id = :user_id'
        );
        $statement->execute([
            'pdf_file_path' => $generatedPdf['relativePath'],
            'pdf_generated_at' => $generatedAt,
            'id' => $quoteId,
            'user_id' => $userId,
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if (is_array($generatedPdf ?? null) && is_file((string) ($generatedPdf['absolutePath'] ?? ''))) {
            @unlink((string) $generatedPdf['absolutePath']);
        }
        throw new RuntimeException('Devis non enregistre : impossible de generer le PDF local. ' . $exception->getMessage(), 0, $exception);
    }

    $quote = devis_public_quote(devis_quote_row($pdo, $quoteId, $userId));
    if ($oldPdfPath !== '' && $oldPdfPath !== (string) ($generatedPdf['relativePath'] ?? '')) {
        devis_delete_pdf_file($oldPdfPath);
    }
    devis_delete_previous_quote_pdfs((string) ($quote['reference'] ?? ''), (string) ($generatedPdf['relativePath'] ?? ''));
    try {
        devis_sync_nautisign_quote_filename($pdo, $userId, (string) ($quote['reference'] ?? ''), (string) ($generatedPdf['filename'] ?? ''));
    } catch (Throwable) {
    }

    return $quote;
}

function devis_delete_quote(PDO $pdo, array $user, int $quoteId): void
{
    if ($quoteId <= 0) {
        throw new InvalidArgumentException('Devis invalide.');
    }
    $row = devis_quote_row($pdo, $quoteId, (int) $user['id']);
    devis_delete_pdf_file($row['pdf_file_path'] ?? '');

    $statement = $pdo->prepare('DELETE FROM devis_quotes WHERE id = :id AND user_id = :user_id');
    $statement->execute([
        'id' => $quoteId,
        'user_id' => (int) $user['id'],
    ]);
}

function devis_dashboard(PDO $pdo, array $user): array
{
    $products = [];
    $productError = '';
    try {
        $products = devis_fetch_products($pdo);
    } catch (Throwable $exception) {
        $productError = $exception->getMessage();
    }

    return [
        'ok' => true,
        'managedBy' => 'OceanOS',
        'user' => oceanos_public_user($user),
        'settings' => oceanos_prestashop_public_settings($pdo, devis_is_admin($user)),
        'company' => devis_public_company_settings($pdo),
        'quotes' => devis_list_quotes($pdo, (int) $user['id']),
        'products' => $products,
        'productError' => $productError,
    ];
}

function devis_download_quote_pdf(PDO $pdo, array $user, int $quoteId): void
{
    if ($quoteId <= 0) {
        devis_json_response(['ok' => false, 'message' => 'Devis invalide.'], 422);
    }
    $row = devis_quote_row($pdo, $quoteId, (int) $user['id']);
    $quote = devis_public_quote($row);
    $path = devis_pdf_absolute_path($row['pdf_file_path'] ?? '');
    if ($path === '' || !is_file($path)) {
        devis_json_response(['ok' => false, 'message' => 'PDF introuvable. Reenregistrez le devis pour generer le PDF local.'], 404);
    }

    $filename = devis_safe_filename((string) ($quote['reference'] ?? 'devis')) . '.pdf';
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function devis_pdf_mm(float $value): float
{
    return $value * DEVIS_PDF_MM;
}

function devis_pdf_y_top(float $value): float
{
    return DEVIS_PDF_PAGE_H - devis_pdf_mm($value);
}

function devis_pdf_color(array $rgb): string
{
    return sprintf('%.3F %.3F %.3F', ((float) $rgb[0]) / 255, ((float) $rgb[1]) / 255, ((float) $rgb[2]) / 255);
}

function devis_pdf_ascii_text(mixed $value): string
{
    $text = trim((string) ($value ?? ''));
    if ($text === '') {
        return '';
    }
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if ($converted === false) {
        $converted = $text;
    }
    $converted = preg_replace('/[^\x20-\x7E]/', ' ', $converted) ?? '';
    return trim(preg_replace('/\s+/', ' ', $converted) ?? '');
}

function devis_pdf_escape(mixed $value): string
{
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], devis_pdf_ascii_text($value));
}

function devis_safe_filename(mixed $value): string
{
    $filename = preg_replace('/[^a-zA-Z0-9._-]+/', '-', devis_pdf_ascii_text($value ?: 'devis')) ?? '';
    $filename = trim($filename, '-');
    return substr($filename !== '' ? $filename : 'devis', 0, 120);
}

function devis_logo_path(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'renovboat-logo.jpg';
}

function devis_pdf_jpeg_info(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $size = @getimagesize($path);
    if (!is_array($size) || (string) ($size['mime'] ?? '') !== 'image/jpeg') {
        return null;
    }
    $data = @file_get_contents($path);
    if ($data === false || $data === '') {
        return null;
    }

    return [
        'width' => (int) ($size[0] ?? 0),
        'height' => (int) ($size[1] ?? 0),
        'data' => $data,
    ];
}

function devis_format_money(mixed $value): string
{
    $amount = devis_decimal($value);
    return number_format($amount, 2, ',', ' ') . ' EUR';
}

function devis_format_quantity(mixed $value): string
{
    $quantity = devis_decimal($value);
    $formatted = number_format($quantity, 2, ',', ' ');
    return rtrim(rtrim($formatted, '0'), ',');
}

function devis_estimate_width(mixed $text, float $size): float
{
    return strlen(devis_pdf_ascii_text($text)) * $size * 0.48;
}

function devis_wrap_text(mixed $text, int $maxChars): array
{
    $words = preg_split('/\s+/', devis_pdf_ascii_text($text), -1, PREG_SPLIT_NO_EMPTY);
    $lines = [];
    $current = '';
    foreach ($words ?: [] as $word) {
        $next = $current !== '' ? $current . ' ' . $word : $word;
        if (strlen($next) > $maxChars && $current !== '') {
            $lines[] = $current;
            $current = $word;
        } else {
            $current = $next;
        }
    }
    if ($current !== '') {
        $lines[] = $current;
    }

    return $lines !== [] ? $lines : [''];
}

final class DevisPdfCanvas
{
    /** @var array<int, string> */
    private array $pages = [];
    /** @var array<string, array{width:int, height:int, data:string}> */
    private array $images = [];
    private string $current = '';

    public function addPage(): void
    {
        if ($this->current !== '') {
            $this->pages[] = $this->current;
        }
        $this->current = '';
    }

    public function finish(): string
    {
        if ($this->current !== '' || $this->pages === []) {
            $this->pages[] = $this->current;
        }

        return devis_build_pdf($this->pages, $this->images);
    }

    public function fill(array $rgb): void
    {
        $this->current .= devis_pdf_color($rgb) . " rg\n";
    }

    public function stroke(array $rgb): void
    {
        $this->current .= devis_pdf_color($rgb) . " RG\n";
    }

    public function lineWidth(float $width): void
    {
        $this->current .= number_format($width, 2, '.', '') . " w\n";
    }

    public function rect(float $x, float $y, float $w, float $h, string $mode = 'F'): void
    {
        $this->current .= sprintf(
            "%.2F %.2F %.2F %.2F re %s\n",
            devis_pdf_mm($x),
            DEVIS_PDF_PAGE_H - devis_pdf_mm($y + $h),
            devis_pdf_mm($w),
            devis_pdf_mm($h),
            $mode
        );
    }

    public function line(float $x1, float $y1, float $x2, float $y2): void
    {
        $this->current .= sprintf(
            "%.2F %.2F m %.2F %.2F l S\n",
            devis_pdf_mm($x1),
            devis_pdf_y_top($y1),
            devis_pdf_mm($x2),
            devis_pdf_y_top($y2)
        );
    }

    public function imageJpeg(string $path, float $x, float $y, float $w, float $h, string $name = 'Logo1'): void
    {
        $name = preg_replace('/[^A-Za-z0-9]+/', '', $name) ?: 'Logo1';
        $image = devis_pdf_jpeg_info($path);
        if ($image === null) {
            return;
        }
        $this->images[$name] = $image;
        $this->current .= sprintf(
            "q %.2F 0 0 %.2F %.2F %.2F cm /%s Do Q\n",
            devis_pdf_mm($w),
            devis_pdf_mm($h),
            devis_pdf_mm($x),
            DEVIS_PDF_PAGE_H - devis_pdf_mm($y + $h),
            $name
        );
    }

    public function text(float $x, float $y, mixed $value, float $size = 9, string $font = 'F1', array $rgb = [26, 36, 40]): void
    {
        $this->fill($rgb);
        $this->current .= sprintf(
            "BT /%s %.1F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET\n",
            $font,
            $size,
            devis_pdf_mm($x),
            devis_pdf_y_top($y),
            devis_pdf_escape($value)
        );
    }

    public function textRight(float $x, float $y, mixed $value, float $size = 9, string $font = 'F1', array $rgb = [26, 36, 40]): void
    {
        $this->fill($rgb);
        $this->current .= sprintf(
            "BT /%s %.1F Tf 1 0 0 1 %.2F %.2F Tm (%s) Tj ET\n",
            $font,
            $size,
            devis_pdf_mm($x) - devis_estimate_width($value, $size),
            devis_pdf_y_top($y),
            devis_pdf_escape($value)
        );
    }
}

function devis_build_pdf(array $pageStreams, array $images = []): string
{
    $objects = [1 => null, 2 => null];
    $nextId = 3;
    $addObject = static function (string $body) use (&$objects, &$nextId): int {
        $id = $nextId++;
        $objects[$id] = $body;
        return $id;
    };

    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $regularFont = $addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    $boldFont = $addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    $imageObjectIds = [];
    foreach ($images as $name => $image) {
        if (!is_array($image) || empty($image['data']) || empty($image['width']) || empty($image['height'])) {
            continue;
        }
        $safeName = preg_replace('/[^A-Za-z0-9]+/', '', (string) $name) ?: 'Logo1';
        $imageObjectIds[$safeName] = $addObject(
            '<< /Type /XObject /Subtype /Image /Width ' . (int) $image['width'] .
            ' /Height ' . (int) $image['height'] .
            ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen((string) $image['data']) .
            " >>\nstream\n" . (string) $image['data'] . "\nendstream"
        );
    }
    $pageIds = [];

    foreach ($pageStreams as $stream) {
        $contentId = $addObject('<< /Length ' . strlen($stream) . " >>\nstream\n" . $stream . "\nendstream");
        $xObjects = '';
        if ($imageObjectIds !== []) {
            $xObjects = ' /XObject << ' . implode(' ', array_map(
                static fn(string $name, int $id): string => '/' . $name . ' ' . $id . ' 0 R',
                array_keys($imageObjectIds),
                array_values($imageObjectIds)
            )) . ' >>';
        }
        $pageId = $addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . DEVIS_PDF_PAGE_W . ' ' . DEVIS_PDF_PAGE_H . '] /Resources << /Font << /F1 ' . $regularFont . ' 0 R /F2 ' . $boldFont . ' 0 R >>' . $xObjects . ' >> /Contents ' . $contentId . ' 0 R >>');
        $pageIds[] = $pageId;
    }

    $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', array_map(static fn(int $id): string => $id . ' 0 R', $pageIds)) . '] /Count ' . count($pageIds) . ' >>';
    ksort($objects);

    $pdf = "%PDF-1.4\n";
    $offsets = [0 => 0];
    foreach ($objects as $id => $body) {
        $offsets[$id] = strlen($pdf);
        $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
    }

    $xrefOffset = strlen($pdf);
    $maxId = max(array_keys($objects));
    $pdf .= "xref\n0 " . ($maxId + 1) . "\n0000000000 65535 f \n";
    for ($i = 1; $i <= $maxId; $i++) {
        $pdf .= str_pad((string) ($offsets[$i] ?? 0), 10, '0', STR_PAD_LEFT) . " 00000 n \n";
    }
    $pdf .= "trailer\n<< /Size " . ($maxId + 1) . " /Root 1 0 R >>\nstartxref\n" . $xrefOffset . "\n%%EOF";

    return $pdf;
}

function devis_build_seller_lines(array $settings): array
{
    return array_values(array_filter([
        $settings['quote_company_name'] ?? 'RenovBoat',
        $settings['quote_company_address'] ?? '',
        $settings['quote_company_city'] ?? '',
        $settings['quote_company_phone'] ?? '',
        $settings['quote_company_email'] ?? '',
        !empty($settings['quote_company_siret']) ? 'SIRET ' . $settings['quote_company_siret'] : '',
    ], static fn(mixed $line): bool => devis_pdf_ascii_text($line) !== ''));
}

function devis_build_buyer_lines(array $quote): array
{
    return array_values(array_filter([
        $quote['client_name'] ?? 'Client',
        $quote['client_email'] ?? '',
    ], static fn(mixed $line): bool => devis_pdf_ascii_text($line) !== ''));
}

function devis_draw_header(DevisPdfCanvas $pdf, array $quote, array $settings): void
{
    $company = (string) ($settings['quote_company_name'] ?? 'RenovBoat');
    $reference = (string) ($quote['reference'] ?? 'Brouillon');
    $created = trim((string) ($quote['date_created'] ?? ''));
    $timestamp = $created !== '' ? strtotime($created) : time();
    $date = date('d/m/Y', $timestamp !== false ? $timestamp : time());
    $validityDays = max(1, (int) ($settings['quote_validity_days'] ?? 30));
    $validity = date('d/m/Y', time() + ($validityDays * 86400));

    if (is_file(devis_logo_path())) {
        $pdf->imageJpeg(devis_logo_path(), 14, 12, 78, 18.3, 'RenovboatLogo');
    } else {
        $pdf->text(15, 21, $company, 18, 'F2', [12, 38, 48]);
        $pdf->text(15, 28, 'Reparation nautique', 9, 'F1', [84, 100, 106]);
    }
    $pdf->stroke([14, 59, 83]);
    $pdf->lineWidth(0.8);
    $pdf->line(15, 43, 195, 43);

    $pdf->textRight(195, 22, 'DEVIS', 25, 'F2', [12, 38, 48]);
    $pdf->textRight(195, 29, 'PROPOSITION COMMERCIALE', 10, 'F2', [249, 86, 20]);
    $pdf->textRight(195, 36, 'Document genere par Renovboat', 8, 'F1', [84, 100, 106]);

    $pdf->fill([243, 248, 249]);
    $pdf->stroke([218, 229, 231]);
    $pdf->rect(120, 48, 75, 33, 'B');
    $pdf->text(126, 58, 'Numero', 9, 'F2', [11, 55, 78]);
    $pdf->textRight(189, 58, $reference, 12, 'F2', [11, 55, 78]);
    $pdf->text(126, 65, 'Date', 8, 'F1', [11, 55, 78]);
    $pdf->textRight(189, 65, $date, 8, 'F1', [11, 55, 78]);
    $pdf->text(126, 71, 'Valable', 8, 'F1', [11, 55, 78]);
    $pdf->textRight(189, 71, $validity, 8, 'F1', [11, 55, 78]);
    $pdf->text(126, 77, 'Statut', 8, 'F1', [11, 55, 78]);
    $pdf->textRight(189, 77, $quote['status'] ?? 'Brouillon', 8, 'F1', [11, 55, 78]);
}

function devis_draw_party_box(DevisPdfCanvas $pdf, float $x, float $y, string $title, array $lines): void
{
    $pdf->fill([249, 251, 251]);
    $pdf->stroke([218, 229, 231]);
    $pdf->rect($x, $y, 84, 45, 'B');
    $pdf->text($x + 5, $y + 10, strtoupper($title), 9, 'F2', [11, 55, 78]);
    $cursor = $y + 17;
    foreach (array_slice($lines, 0, 5) as $index => $line) {
        $pdf->text($x + 5, $cursor, $line, $index === 0 ? 8.8 : 8.2, $index === 0 ? 'F2' : 'F1', [24, 37, 42]);
        $cursor += 5;
    }
}

function devis_draw_table_header(DevisPdfCanvas $pdf, float $y): void
{
    $x = 15;
    $widths = [82, 16, 26, 28, 28];
    $labels = ['Designation', 'Qte', 'PU HT', 'Total HT', 'Total TTC'];
    $pdf->fill([11, 55, 78]);
    $pdf->rect($x, $y, 180, 8, 'F');
    $colX = $x;
    foreach ($labels as $index => $label) {
        if ($index === 0) {
            $pdf->text($colX + 2, $y + 5.4, $label, 8, 'F2', [255, 255, 255]);
        } else {
            $pdf->textRight($colX + $widths[$index] - 2, $y + 5.4, $label, 8, 'F2', [255, 255, 255]);
        }
        $colX += $widths[$index];
    }
}

function devis_generate_quote_pdf(array $quote, array $settings = []): array
{
    $storageDir = devis_pdf_storage_dir();
    devis_ensure_writable_dir($storageDir, 'PDF Devis');

    $filename = devis_pdf_filename_for_quote($quote);
    $absolutePath = $storageDir . DIRECTORY_SEPARATOR . $filename;
    $relativePath = 'storage/quotes/' . $filename;
    $content = devis_render_quote_pdf($quote, $settings);

    if (file_put_contents($absolutePath, $content, LOCK_EX) === false) {
        $error = error_get_last();
        $detail = is_array($error) && !empty($error['message']) ? ' ' . (string) $error['message'] : '';
        throw new RuntimeException('Impossible d enregistrer le PDF.' . $detail);
    }

    return [
        'absolutePath' => $absolutePath,
        'relativePath' => $relativePath,
        'filename' => $filename,
    ];
}

function devis_render_quote_pdf(array $quote, array $settings = []): string
{
    $pdf = new DevisPdfCanvas();
    $pdf->addPage();
    devis_draw_header($pdf, $quote, $settings);
    devis_draw_party_box($pdf, 15, 92, 'Vendeur', devis_build_seller_lines($settings));
    devis_draw_party_box($pdf, 111, 92, 'Client', devis_build_buyer_lines($quote));

    $y = 150.0;
    devis_draw_table_header($pdf, $y);
    $y += 8;
    $widths = [82, 16, 26, 28, 28];
    $lines = is_array($quote['lines'] ?? null) ? $quote['lines'] : [];
    foreach ($lines as $index => $line) {
        if (!is_array($line)) {
            continue;
        }
        $quantity = devis_decimal($line['quantity'] ?? 0);
        $unitPrice = devis_decimal($line['unit_price_ht'] ?? 0);
        $taxRate = devis_decimal($line['tax_rate'] ?? 0);
        $totalHt = $quantity * $unitPrice;
        $totalTtc = $totalHt * (1 + ($taxRate / 100));
        $isFee = (string) ($line['line_type'] ?? '') === 'fee';
        $referenceLabel = $isFee ? '' : (string) ($line['product_reference'] ?? ($line['product_id'] ?? ''));
        $label = trim((string) ($line['name'] ?? 'Produit'));
        if ($isFee) {
            $label = 'Frais annexes - ' . $label;
        } elseif ($referenceLabel !== '') {
            $label .= ' - Ref. ' . $referenceLabel;
        }
        $labelLines = devis_wrap_text($label, 44);
        $rowHeight = max(10, count($labelLines) * 5 + 4);

        if ($y + $rowHeight > 244) {
            $pdf->addPage();
            devis_draw_header($pdf, $quote, $settings);
            $y = 92;
            devis_draw_table_header($pdf, $y);
            $y += 8;
        }

        if ($index % 2 === 0) {
            $pdf->fill([248, 251, 251]);
            $pdf->rect(15, $y, 180, $rowHeight, 'F');
        }
        $pdf->stroke([222, 231, 232]);
        $pdf->lineWidth(0.25);
        $pdf->line(15, $y + $rowHeight, 195, $y + $rowHeight);

        foreach (array_slice($labelLines, 0, 4) as $lineIndex => $labelLine) {
            $pdf->text(17, $y + 5 + ($lineIndex * 5), $labelLine, 8.2, 'F1', [26, 36, 40]);
        }
        $pdf->textRight(15 + $widths[0] + $widths[1] - 2, $y + 6, devis_format_quantity($quantity), 8.2, 'F1', [26, 36, 40]);
        $pdf->textRight(15 + $widths[0] + $widths[1] + $widths[2] - 2, $y + 6, devis_format_money($unitPrice), 8.2, 'F1', [26, 36, 40]);
        $pdf->textRight(15 + $widths[0] + $widths[1] + $widths[2] + $widths[3] - 2, $y + 6, devis_format_money($totalHt), 8.2, 'F1', [26, 36, 40]);
        $pdf->textRight(193, $y + 6, devis_format_money($totalTtc), 8.2, 'F2', [26, 36, 40]);
        $y += $rowHeight;
    }

    if ($lines === []) {
        $pdf->fill([248, 251, 251]);
        $pdf->rect(15, $y, 180, 12, 'F');
        $pdf->text(74, $y + 7.5, 'Aucune ligne de devis', 8.5, 'F1', [102, 115, 120]);
        $y += 12;
    }

    $totalY = max($y + 12, 220);
    if ($totalY > 244) {
        $pdf->addPage();
        devis_draw_header($pdf, $quote, $settings);
        $totalY = 92;
    }

    $totalHt = devis_decimal($quote['total_ht'] ?? 0);
    $totalTtc = devis_decimal($quote['total_ttc'] ?? 0);
    $totalVat = max(0, $totalTtc - $totalHt);
    $pdf->text(15, $totalY + 5, 'Conditions de reglement', 8.2, 'F2', [74, 91, 97]);
    foreach (array_slice(devis_wrap_text($settings['quote_payment_terms'] ?? 'Virement bancaire a 30 jours', 44), 0, 3) as $index => $line) {
        $pdf->text(15, $totalY + 11 + ($index * 4.5), $line, 8, 'F1', [74, 91, 97]);
    }

    $pdf->fill([243, 248, 249]);
    $pdf->stroke([218, 229, 231]);
    $pdf->rect(118, $totalY, 77, 40, 'B');
    $pdf->text(124, $totalY + 11, 'Total HT', 9, 'F1', [29, 45, 50]);
    $pdf->textRight(188, $totalY + 11, devis_format_money($totalHt), 9, 'F1', [29, 45, 50]);
    $pdf->text(124, $totalY + 18, 'TVA', 9, 'F1', [29, 45, 50]);
    $pdf->textRight(188, $totalY + 18, devis_format_money($totalVat), 9, 'F1', [29, 45, 50]);
    $pdf->text(124, $totalY + 28, 'Total TTC', 12, 'F2', [11, 55, 78]);
    $pdf->textRight(188, $totalY + 28, devis_format_money($totalTtc), 12, 'F2', [249, 86, 20]);

    $pdf->stroke([222, 231, 232]);
    $pdf->line(15, 281, 195, 281);
    $footerCompany = (string) ($settings['quote_company_name'] ?? 'RenovBoat');
    $pdf->text(57, 287, $footerCompany . ' - Reparation nautique - Devis genere par Renovboat', 7.5, 'F1', [102, 115, 120]);

    return $pdf->finish();
}
