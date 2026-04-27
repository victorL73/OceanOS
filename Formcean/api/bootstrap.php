<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'OceanOS' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

const FORMCEAN_MODULE_ID = 'formcean';

function formcean_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function formcean_read_json_request(): array
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

function formcean_pdo(): PDO
{
    $pdo = oceanos_pdo();
    formcean_ensure_schema($pdo);
    return $pdo;
}

function formcean_ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS formcean_forms (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            owner_user_id BIGINT UNSIGNED NOT NULL,
            slug VARCHAR(120) NOT NULL UNIQUE,
            title VARCHAR(190) NOT NULL,
            description TEXT NULL,
            status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
            settings_json LONGTEXT NULL,
            fields_json LONGTEXT NOT NULL,
            response_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_formcean_forms_owner_updated (owner_user_id, updated_at),
            INDEX idx_formcean_forms_status (status),
            CONSTRAINT fk_formcean_forms_owner FOREIGN KEY (owner_user_id) REFERENCES oceanos_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS formcean_responses (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            form_id BIGINT UNSIGNED NOT NULL,
            respondent_email VARCHAR(190) NULL,
            respondent_device_hash VARCHAR(64) NULL,
            respondent_network_hash VARCHAR(64) NULL,
            respondent_json LONGTEXT NULL,
            answers_json LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_formcean_responses_form_created (form_id, created_at),
            INDEX idx_formcean_responses_form_email (form_id, respondent_email),
            INDEX idx_formcean_responses_form_device (form_id, respondent_device_hash),
            INDEX idx_formcean_responses_form_network (form_id, respondent_network_hash),
            CONSTRAINT fk_formcean_responses_form FOREIGN KEY (form_id) REFERENCES formcean_forms(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!oceanos_column_exists($pdo, 'formcean_responses', 'respondent_email')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD COLUMN respondent_email VARCHAR(190) NULL AFTER form_id');
    }
    if (!oceanos_column_exists($pdo, 'formcean_responses', 'respondent_device_hash')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD COLUMN respondent_device_hash VARCHAR(64) NULL AFTER respondent_email');
    }
    if (!oceanos_column_exists($pdo, 'formcean_responses', 'respondent_network_hash')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD COLUMN respondent_network_hash VARCHAR(64) NULL AFTER respondent_device_hash');
    }
    formcean_backfill_response_emails($pdo);
    if (!formcean_index_exists($pdo, 'formcean_responses', 'idx_formcean_responses_form_email')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD INDEX idx_formcean_responses_form_email (form_id, respondent_email)');
    }
    if (!formcean_index_exists($pdo, 'formcean_responses', 'idx_formcean_responses_form_device')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD INDEX idx_formcean_responses_form_device (form_id, respondent_device_hash)');
    }
    if (!formcean_index_exists($pdo, 'formcean_responses', 'idx_formcean_responses_form_network')) {
        $pdo->exec('ALTER TABLE formcean_responses ADD INDEX idx_formcean_responses_form_network (form_id, respondent_network_hash)');
    }
}

function formcean_index_exists(PDO $pdo, string $table, string $index): bool
{
    $statement = $pdo->prepare('SHOW INDEX FROM `' . str_replace('`', '``', $table) . '` WHERE Key_name = :index_name');
    $statement->execute(['index_name' => $index]);
    return $statement->fetch() !== false;
}

function formcean_backfill_response_emails(PDO $pdo): void
{
    try {
        $pdo->exec(
            "UPDATE formcean_responses
             SET respondent_email = LOWER(JSON_UNQUOTE(JSON_EXTRACT(respondent_json, '$.email')))
             WHERE respondent_email IS NULL
               AND respondent_json IS NOT NULL
               AND JSON_VALID(respondent_json)
               AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(respondent_json, '$.email')), '') <> ''"
        );
    } catch (Throwable) {
        // La colonne reste utilisable pour les nouvelles reponses meme si l'ancien JSON est illisible.
    }
}

function formcean_client_token(mixed $value): string
{
    $token = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $value) ?: '';
    return mb_substr($token, 0, 160);
}

function formcean_request_ip(): string
{
    return mb_substr(trim((string) ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 90);
}

function formcean_request_user_agent(): string
{
    return mb_substr(trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 500);
}

function formcean_request_language(): string
{
    return mb_substr(trim((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')), 0, 220);
}

function formcean_response_device_hash(array $form, array $input): string
{
    $clientToken = formcean_client_token($input['clientToken'] ?? '');
    if ($clientToken === '') {
        return '';
    }

    return hash_hmac(
        'sha256',
        implode('|', ['formcean-device', (int) $form['id'], $clientToken]),
        oceanos_secret_key()
    );
}

function formcean_response_network_hash(array $form): string
{
    $ip = formcean_request_ip();
    $userAgent = formcean_request_user_agent();
    if ($ip === '' && $userAgent === '') {
        return '';
    }

    return hash_hmac(
        'sha256',
        implode('|', ['formcean-network', (int) $form['id'], $ip, $userAgent, formcean_request_language()]),
        oceanos_secret_key()
    );
}

function formcean_require_user(PDO $pdo): array
{
    $user = oceanos_require_auth($pdo);
    $visibleModules = oceanos_decode_visible_modules($user['visible_modules_json'] ?? null);
    if (!in_array(FORMCEAN_MODULE_ID, $visibleModules, true)) {
        formcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Formcean n est pas active pour ce compte.',
        ], 403);
    }

    return $user;
}

function formcean_public_user(array $user): array
{
    return oceanos_public_user($user);
}

function formcean_is_manager(array $user): bool
{
    return in_array((string) ($user['role'] ?? 'member'), ['super', 'admin'], true);
}

function formcean_can_manage_form(array $form, array $user): bool
{
    return (int) ($form['owner_user_id'] ?? 0) === (int) ($user['id'] ?? 0) || formcean_is_manager($user);
}

function formcean_clean_text(mixed $value, int $maxLength = 4000, bool $singleLine = false): string
{
    $text = trim((string) $value);
    $text = str_replace("\0", '', $text);
    if ($singleLine) {
        $text = preg_replace('/\s+/u', ' ', $text) ?: '';
    }

    return mb_substr($text, 0, $maxLength);
}

function formcean_slugify(string $value): string
{
    $value = trim(mb_strtolower($value));
    if ($value === '') {
        $value = 'formulaire';
    }

    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (is_string($ascii) && trim($ascii) !== '') {
        $value = $ascii;
    }

    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($value)) ?: 'formulaire';
    $slug = trim($slug, '-');
    return mb_substr($slug !== '' ? $slug : 'formulaire', 0, 72);
}

function formcean_slug_exists(PDO $pdo, string $slug, ?int $ignoreFormId = null): bool
{
    if ($ignoreFormId !== null) {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM formcean_forms WHERE slug = :slug AND id <> :id');
        $statement->execute(['slug' => $slug, 'id' => $ignoreFormId]);
        return (int) $statement->fetchColumn() > 0;
    }

    $statement = $pdo->prepare('SELECT COUNT(*) FROM formcean_forms WHERE slug = :slug');
    $statement->execute(['slug' => $slug]);
    return (int) $statement->fetchColumn() > 0;
}

function formcean_unique_slug(PDO $pdo, string $title, ?int $ignoreFormId = null): string
{
    $base = formcean_slugify($title);
    if (!formcean_slug_exists($pdo, $base, $ignoreFormId)) {
        return $base;
    }

    for ($index = 2; $index < 500; $index++) {
        $candidate = mb_substr($base, 0, 72) . '-' . $index;
        if (!formcean_slug_exists($pdo, $candidate, $ignoreFormId)) {
            return $candidate;
        }
    }

    return $base . '-' . bin2hex(random_bytes(4));
}

function formcean_field_types(): array
{
    return ['short', 'paragraph', 'email', 'number', 'date', 'radio', 'checkbox', 'select', 'rating', 'scale'];
}

function formcean_field_id(): string
{
    return 'f_' . bin2hex(random_bytes(6));
}

function formcean_default_field(): array
{
    return [
        'id' => formcean_field_id(),
        'type' => 'short',
        'label' => 'Nouvelle question',
        'required' => false,
        'placeholder' => '',
        'help' => '',
        'options' => [],
        'min' => 1,
        'max' => 5,
        'minLabel' => '',
        'maxLabel' => '',
    ];
}

function formcean_normalize_options(mixed $options): array
{
    if (!is_array($options)) {
        $options = [];
    }

    $normalized = [];
    foreach ($options as $option) {
        $value = formcean_clean_text($option, 160, true);
        if ($value === '' || in_array($value, $normalized, true)) {
            continue;
        }
        $normalized[] = $value;
        if (count($normalized) >= 40) {
            break;
        }
    }

    return $normalized;
}

function formcean_normalize_field(array $field): array
{
    $type = strtolower(trim((string) ($field['type'] ?? 'short')));
    if (!in_array($type, formcean_field_types(), true)) {
        $type = 'short';
    }

    $id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($field['id'] ?? '')) ?: '';
    $id = $id !== '' ? mb_substr($id, 0, 64) : formcean_field_id();
    $label = formcean_clean_text($field['label'] ?? '', 190, true);
    if ($label === '') {
        $label = 'Nouvelle question';
    }

    $options = formcean_normalize_options($field['options'] ?? []);
    if (in_array($type, ['radio', 'checkbox', 'select'], true) && count($options) === 0) {
        $options = ['Option 1'];
    }
    if (!in_array($type, ['radio', 'checkbox', 'select'], true)) {
        $options = [];
    }

    $min = max(0, min(10, (int) ($field['min'] ?? 1)));
    $max = max(1, min(10, (int) ($field['max'] ?? 5)));
    if ($type === 'rating') {
        $min = 1;
        $max = max(2, min(10, $max));
    } elseif ($type === 'scale') {
        if ($max <= $min) {
            $max = min(10, $min + 1);
        }
    } else {
        $min = 1;
        $max = 5;
    }

    return [
        'id' => $id,
        'type' => $type,
        'label' => $label,
        'required' => !empty($field['required']),
        'placeholder' => formcean_clean_text($field['placeholder'] ?? '', 190, true),
        'help' => formcean_clean_text($field['help'] ?? '', 500, false),
        'options' => $options,
        'min' => $min,
        'max' => $max,
        'minLabel' => $type === 'scale' ? formcean_clean_text($field['minLabel'] ?? '', 80, true) : '',
        'maxLabel' => $type === 'scale' ? formcean_clean_text($field['maxLabel'] ?? '', 80, true) : '',
    ];
}

function formcean_normalize_fields(mixed $fields): array
{
    if (!is_array($fields) || $fields === []) {
        return [formcean_default_field()];
    }

    $normalized = [];
    $seenIds = [];
    foreach ($fields as $field) {
        if (!is_array($field)) {
            continue;
        }
        $next = formcean_normalize_field($field);
        while (isset($seenIds[$next['id']])) {
            $next['id'] = formcean_field_id();
        }
        $seenIds[$next['id']] = true;
        $normalized[] = $next;
        if (count($normalized) >= 80) {
            break;
        }
    }

    return $normalized !== [] ? $normalized : [formcean_default_field()];
}

function formcean_default_settings(): array
{
    return [
        'collectEmail' => false,
        'confirmationMessage' => 'Merci, votre reponse a bien ete envoyee.',
        'closedMessage' => 'Ce formulaire ne collecte pas de reponses pour le moment.',
    ];
}

function formcean_normalize_settings(mixed $settings): array
{
    $source = is_array($settings) ? $settings : [];
    $defaults = formcean_default_settings();

    return [
        'collectEmail' => !empty($source['collectEmail']),
        'confirmationMessage' => formcean_clean_text(
            $source['confirmationMessage'] ?? $defaults['confirmationMessage'],
            240,
            false
        ) ?: $defaults['confirmationMessage'],
        'closedMessage' => formcean_clean_text(
            $source['closedMessage'] ?? $defaults['closedMessage'],
            240,
            false
        ) ?: $defaults['closedMessage'],
    ];
}

function formcean_decode_json(?string $json, array $fallback): array
{
    $decoded = json_decode((string) $json, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function formcean_decode_fields(?string $json): array
{
    return formcean_normalize_fields(formcean_decode_json($json, []));
}

function formcean_decode_settings(?string $json): array
{
    return formcean_normalize_settings(formcean_decode_json($json, []));
}

function formcean_encode(array $value): string
{
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        throw new RuntimeException('Impossible d encoder les donnees Formcean.');
    }

    return $json;
}

function formcean_find_form_by_id(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT f.*, u.display_name AS owner_display_name, u.email AS owner_email
         FROM formcean_forms f
         INNER JOIN oceanos_users u ON u.id = f.owner_user_id
         WHERE f.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function formcean_find_form_by_slug(PDO $pdo, string $slug): ?array
{
    $statement = $pdo->prepare(
        'SELECT f.*, u.display_name AS owner_display_name, u.email AS owner_email
         FROM formcean_forms f
         INNER JOIN oceanos_users u ON u.id = f.owner_user_id
         WHERE f.slug = :slug
         LIMIT 1'
    );
    $statement->execute(['slug' => $slug]);
    $row = $statement->fetch();
    return is_array($row) ? $row : null;
}

function formcean_require_form(PDO $pdo, int $id, array $user): array
{
    $form = formcean_find_form_by_id($pdo, $id);
    if ($form === null) {
        throw new InvalidArgumentException('Formulaire introuvable.');
    }
    if (!formcean_can_manage_form($form, $user)) {
        formcean_json_response([
            'ok' => false,
            'error' => 'forbidden',
            'message' => 'Vous ne pouvez pas modifier ce formulaire.',
        ], 403);
    }

    return $form;
}

function formcean_public_form(array $form, bool $includePrivate = false): array
{
    $payload = [
        'id' => (int) $form['id'],
        'slug' => (string) $form['slug'],
        'title' => (string) $form['title'],
        'description' => (string) ($form['description'] ?? ''),
        'status' => (string) $form['status'],
        'isPublished' => (string) $form['status'] === 'published',
        'settings' => formcean_decode_settings($form['settings_json'] ?? null),
        'fields' => formcean_decode_fields($form['fields_json'] ?? null),
        'responseCount' => (int) ($form['response_count'] ?? 0),
        'shareUrl' => '/Formcean/?form=' . rawurlencode((string) $form['slug']),
        'createdAt' => (string) ($form['created_at'] ?? ''),
        'updatedAt' => (string) ($form['updated_at'] ?? ''),
        'owner' => [
            'id' => (int) ($form['owner_user_id'] ?? 0),
            'displayName' => (string) ($form['owner_display_name'] ?? ''),
            'email' => (string) ($form['owner_email'] ?? ''),
        ],
    ];

    if (!$includePrivate) {
        unset($payload['owner']['email']);
    }

    return $payload;
}

function formcean_list_forms(PDO $pdo, array $user): array
{
    if (formcean_is_manager($user)) {
        $statement = $pdo->query(
            'SELECT f.*, u.display_name AS owner_display_name, u.email AS owner_email
             FROM formcean_forms f
             INNER JOIN oceanos_users u ON u.id = f.owner_user_id
             ORDER BY f.updated_at DESC, f.id DESC'
        );
    } else {
        $statement = $pdo->prepare(
            'SELECT f.*, u.display_name AS owner_display_name, u.email AS owner_email
             FROM formcean_forms f
             INNER JOIN oceanos_users u ON u.id = f.owner_user_id
             WHERE f.owner_user_id = :user_id
             ORDER BY f.updated_at DESC, f.id DESC'
        );
        $statement->execute(['user_id' => (int) $user['id']]);
    }

    $rows = $statement->fetchAll();
    return array_map(static fn(array $row): array => formcean_public_form($row, true), $rows ?: []);
}

function formcean_create_form(PDO $pdo, array $user, array $input): array
{
    $title = formcean_clean_text($input['title'] ?? '', 190, true);
    if ($title === '') {
        $title = 'Nouveau formulaire';
    }

    $description = formcean_clean_text($input['description'] ?? '', 3000, false);
    $fields = formcean_normalize_fields($input['fields'] ?? []);
    $settings = formcean_normalize_settings($input['settings'] ?? []);
    $slug = formcean_unique_slug($pdo, $title);

    $statement = $pdo->prepare(
        'INSERT INTO formcean_forms (owner_user_id, slug, title, description, status, settings_json, fields_json)
         VALUES (:owner_user_id, :slug, :title, :description, :status, :settings_json, :fields_json)'
    );
    $statement->execute([
        'owner_user_id' => (int) $user['id'],
        'slug' => $slug,
        'title' => $title,
        'description' => $description !== '' ? $description : null,
        'status' => 'draft',
        'settings_json' => formcean_encode($settings),
        'fields_json' => formcean_encode($fields),
    ]);

    $form = formcean_find_form_by_id($pdo, (int) $pdo->lastInsertId());
    if ($form === null) {
        throw new RuntimeException('Impossible de creer le formulaire.');
    }

    return $form;
}

function formcean_update_form(PDO $pdo, array $form, array $input): array
{
    $title = array_key_exists('title', $input)
        ? formcean_clean_text($input['title'], 190, true)
        : (string) $form['title'];
    if ($title === '') {
        throw new InvalidArgumentException('Le titre du formulaire est obligatoire.');
    }

    $description = array_key_exists('description', $input)
        ? formcean_clean_text($input['description'], 3000, false)
        : (string) ($form['description'] ?? '');
    $status = strtolower(trim((string) ($input['status'] ?? $form['status'])));
    $status = $status === 'published' ? 'published' : 'draft';
    $slug = array_key_exists('slug', $input) && trim((string) $input['slug']) !== ''
        ? formcean_slugify((string) $input['slug'])
        : (string) $form['slug'];
    if (formcean_slug_exists($pdo, $slug, (int) $form['id'])) {
        throw new InvalidArgumentException('Ce lien public est deja utilise par un autre formulaire.');
    }

    $fields = array_key_exists('fields', $input)
        ? formcean_normalize_fields($input['fields'])
        : formcean_decode_fields($form['fields_json'] ?? null);
    $settings = array_key_exists('settings', $input)
        ? formcean_normalize_settings($input['settings'])
        : formcean_decode_settings($form['settings_json'] ?? null);

    $statement = $pdo->prepare(
        'UPDATE formcean_forms
         SET title = :title,
             description = :description,
             status = :status,
             slug = :slug,
             settings_json = :settings_json,
             fields_json = :fields_json
         WHERE id = :id'
    );
    $statement->execute([
        'id' => (int) $form['id'],
        'title' => $title,
        'description' => $description !== '' ? $description : null,
        'status' => $status,
        'slug' => $slug,
        'settings_json' => formcean_encode($settings),
        'fields_json' => formcean_encode($fields),
    ]);

    return formcean_find_form_by_id($pdo, (int) $form['id']) ?? $form;
}

function formcean_duplicate_form(PDO $pdo, array $form, array $user): array
{
    $title = formcean_clean_text((string) $form['title'] . ' copie', 190, true);
    $statement = $pdo->prepare(
        'INSERT INTO formcean_forms (owner_user_id, slug, title, description, status, settings_json, fields_json)
         VALUES (:owner_user_id, :slug, :title, :description, :status, :settings_json, :fields_json)'
    );
    $statement->execute([
        'owner_user_id' => (int) $user['id'],
        'slug' => formcean_unique_slug($pdo, $title),
        'title' => $title,
        'description' => $form['description'] ?? null,
        'status' => 'draft',
        'settings_json' => formcean_encode(formcean_decode_settings($form['settings_json'] ?? null)),
        'fields_json' => formcean_encode(formcean_decode_fields($form['fields_json'] ?? null)),
    ]);

    $copy = formcean_find_form_by_id($pdo, (int) $pdo->lastInsertId());
    if ($copy === null) {
        throw new RuntimeException('Impossible de dupliquer le formulaire.');
    }

    return $copy;
}

function formcean_delete_form(PDO $pdo, array $form): void
{
    $statement = $pdo->prepare('DELETE FROM formcean_forms WHERE id = :id');
    $statement->execute(['id' => (int) $form['id']]);
}

function formcean_empty_answer(mixed $value): bool
{
    if (is_array($value)) {
        return count(array_filter($value, static fn($item): bool => trim((string) $item) !== '')) === 0;
    }

    return trim((string) $value) === '';
}

function formcean_answer_display(array $field, mixed $value): string
{
    if (is_array($value)) {
        return implode(', ', array_map(static fn($item): string => (string) $item, $value));
    }
    if ($value === null) {
        return '';
    }

    return (string) $value;
}

function formcean_normalize_answer(array $field, mixed $rawValue): mixed
{
    $type = (string) ($field['type'] ?? 'short');
    if (formcean_empty_answer($rawValue)) {
        if (!empty($field['required'])) {
            throw new InvalidArgumentException('La question "' . (string) $field['label'] . '" est obligatoire.');
        }
        return $type === 'checkbox' ? [] : '';
    }

    if ($type === 'checkbox') {
        $values = is_array($rawValue) ? $rawValue : [$rawValue];
        $allowed = $field['options'] ?? [];
        $selected = [];
        foreach ($values as $value) {
            $candidate = formcean_clean_text($value, 160, true);
            if ($candidate !== '' && in_array($candidate, $allowed, true) && !in_array($candidate, $selected, true)) {
                $selected[] = $candidate;
            }
        }
        if ($selected === [] && !empty($field['required'])) {
            throw new InvalidArgumentException('La question "' . (string) $field['label'] . '" est obligatoire.');
        }
        return $selected;
    }

    $value = formcean_clean_text($rawValue, $type === 'paragraph' ? 12000 : 800, $type !== 'paragraph');

    if (in_array($type, ['radio', 'select'], true)) {
        $allowed = $field['options'] ?? [];
        if (!in_array($value, $allowed, true)) {
            throw new InvalidArgumentException('Reponse invalide pour "' . (string) $field['label'] . '".');
        }
        return $value;
    }
    if ($type === 'email' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Email invalide pour "' . (string) $field['label'] . '".');
    }
    if ($type === 'number') {
        if (!is_numeric(str_replace(',', '.', $value))) {
            throw new InvalidArgumentException('Nombre invalide pour "' . (string) $field['label'] . '".');
        }
        return (string) (float) str_replace(',', '.', $value);
    }
    if ($type === 'date' && $value !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        throw new InvalidArgumentException('Date invalide pour "' . (string) $field['label'] . '".');
    }
    if (in_array($type, ['rating', 'scale'], true)) {
        if (!preg_match('/^-?\d+$/', $value)) {
            throw new InvalidArgumentException('Valeur invalide pour "' . (string) $field['label'] . '".');
        }
        $number = (int) $value;
        $min = (int) ($field['min'] ?? 1);
        $max = (int) ($field['max'] ?? 5);
        if ($number < $min || $number > $max) {
            throw new InvalidArgumentException('Valeur invalide pour "' . (string) $field['label'] . '".');
        }
        return $number;
    }

    return $value;
}

function formcean_submit_response(PDO $pdo, array $form, array $input): array
{
    if ((string) $form['status'] !== 'published') {
        throw new InvalidArgumentException(formcean_decode_settings($form['settings_json'] ?? null)['closedMessage']);
    }

    $fields = formcean_decode_fields($form['fields_json'] ?? null);
    $answers = is_array($input['answers'] ?? null) ? $input['answers'] : [];
    $storedAnswers = [];

    foreach ($fields as $field) {
        $fieldId = (string) $field['id'];
        $value = formcean_normalize_answer($field, $answers[$fieldId] ?? null);
        $storedAnswers[] = [
            'id' => $fieldId,
            'type' => (string) $field['type'],
            'label' => (string) $field['label'],
            'value' => $value,
            'displayValue' => formcean_answer_display($field, $value),
        ];
    }

    $settings = formcean_decode_settings($form['settings_json'] ?? null);
    $respondent = [
        'submittedAt' => gmdate(DATE_ATOM),
        'email' => '',
    ];
    $respondentEmail = null;
    $deviceHash = formcean_response_device_hash($form, $input);
    $networkHash = formcean_response_network_hash($form);

    if ($deviceHash !== '') {
        $existingDevice = $pdo->prepare(
            'SELECT COUNT(*) FROM formcean_responses
             WHERE form_id = :form_id AND respondent_device_hash = :respondent_device_hash'
        );
        $existingDevice->execute([
            'form_id' => (int) $form['id'],
            'respondent_device_hash' => $deviceHash,
        ]);
        if ((int) $existingDevice->fetchColumn() > 0) {
            throw new InvalidArgumentException('Une reponse a deja ete envoyee depuis ce navigateur pour ce formulaire.');
        }
    }

    if ($networkHash !== '') {
        $existingNetwork = $pdo->prepare(
            'SELECT COUNT(*) FROM formcean_responses
             WHERE form_id = :form_id AND respondent_network_hash = :respondent_network_hash'
        );
        $existingNetwork->execute([
            'form_id' => (int) $form['id'],
            'respondent_network_hash' => $networkHash,
        ]);
        if ((int) $existingNetwork->fetchColumn() > 0) {
            throw new InvalidArgumentException('Une reponse a deja ete envoyee depuis cet appareil ou cette connexion pour ce formulaire.');
        }
    }

    if (!empty($settings['collectEmail'])) {
        $email = mb_strtolower(formcean_clean_text($input['respondentEmail'] ?? '', 190, true));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Votre email est obligatoire.');
        }
        $respondent['email'] = $email;
        $respondentEmail = $email;

        $existing = $pdo->prepare(
            'SELECT COUNT(*) FROM formcean_responses
             WHERE form_id = :form_id AND respondent_email = :respondent_email'
        );
        $existing->execute([
            'form_id' => (int) $form['id'],
            'respondent_email' => $respondentEmail,
        ]);
        if ((int) $existing->fetchColumn() > 0) {
            throw new InvalidArgumentException('Cet email a deja ete utilise pour repondre a ce formulaire.');
        }
    }

    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'INSERT INTO formcean_responses (form_id, respondent_email, respondent_device_hash, respondent_network_hash, respondent_json, answers_json)
             VALUES (:form_id, :respondent_email, :respondent_device_hash, :respondent_network_hash, :respondent_json, :answers_json)'
        );
        $statement->execute([
            'form_id' => (int) $form['id'],
            'respondent_email' => $respondentEmail,
            'respondent_device_hash' => $deviceHash !== '' ? $deviceHash : null,
            'respondent_network_hash' => $networkHash !== '' ? $networkHash : null,
            'respondent_json' => formcean_encode($respondent),
            'answers_json' => formcean_encode(['fields' => $storedAnswers]),
        ]);
        $responseId = (int) $pdo->lastInsertId();

        $update = $pdo->prepare('UPDATE formcean_forms SET response_count = response_count + 1 WHERE id = :id');
        $update->execute(['id' => (int) $form['id']]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    return [
        'id' => $responseId,
        'confirmationMessage' => $settings['confirmationMessage'],
    ];
}

function formcean_public_response(array $row): array
{
    $respondent = formcean_decode_json($row['respondent_json'] ?? null, []);
    $answers = formcean_decode_json($row['answers_json'] ?? null, ['fields' => []]);

    return [
        'id' => (int) $row['id'],
        'createdAt' => (string) $row['created_at'],
        'respondent' => [
            'email' => (string) (($row['respondent_email'] ?? '') ?: ($respondent['email'] ?? '')),
        ],
        'answers' => is_array($answers['fields'] ?? null) ? $answers['fields'] : [],
    ];
}

function formcean_list_responses(PDO $pdo, array $form): array
{
    $statement = $pdo->prepare(
        'SELECT * FROM formcean_responses
         WHERE form_id = :form_id
         ORDER BY created_at DESC, id DESC
         LIMIT 500'
    );
    $statement->execute(['form_id' => (int) $form['id']]);
    $rows = $statement->fetchAll();

    return array_map(static fn(array $row): array => formcean_public_response($row), $rows ?: []);
}

function formcean_response_summary(array $form, array $responses): array
{
    $fields = formcean_decode_fields($form['fields_json'] ?? null);
    $summary = [];

    foreach ($fields as $field) {
        $fieldSummary = [
            'id' => $field['id'],
            'label' => $field['label'],
            'type' => $field['type'],
            'total' => 0,
            'empty' => 0,
            'choices' => [],
            'average' => null,
        ];
        $numeric = [];

        foreach ($responses as $response) {
            $answer = null;
            foreach ($response['answers'] as $candidate) {
                if (($candidate['id'] ?? '') === $field['id']) {
                    $answer = $candidate;
                    break;
                }
            }
            if ($answer === null || formcean_empty_answer($answer['value'] ?? '')) {
                $fieldSummary['empty']++;
                continue;
            }

            $fieldSummary['total']++;
            $value = $answer['value'];
            if (is_array($value)) {
                foreach ($value as $choice) {
                    $key = (string) $choice;
                    $fieldSummary['choices'][$key] = ($fieldSummary['choices'][$key] ?? 0) + 1;
                }
            } elseif (in_array((string) $field['type'], ['radio', 'select'], true)) {
                $key = (string) $value;
                $fieldSummary['choices'][$key] = ($fieldSummary['choices'][$key] ?? 0) + 1;
            } elseif (in_array((string) $field['type'], ['rating', 'scale', 'number'], true) && is_numeric($value)) {
                $numeric[] = (float) $value;
            }
        }

        if ($numeric !== []) {
            $fieldSummary['average'] = round(array_sum($numeric) / count($numeric), 2);
        }
        arsort($fieldSummary['choices']);
        $summary[] = $fieldSummary;
    }

    return $summary;
}
