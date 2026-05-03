<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

function nautimail_cli_option_int(array $options, string $name, int $fallback, int $min, int $max): int
{
    $value = (int) ($options[$name] ?? $fallback);
    if ($value < $min || $value > $max) {
        return $fallback;
    }

    return $value;
}

function nautimail_cli_sync_user(PDO $pdo): array
{
    $statement = $pdo->query(
        "SELECT id, email, display_name, role, visible_modules_json
         FROM oceanos_users
         WHERE is_active = 1 AND role IN ('super', 'admin')
         ORDER BY FIELD(role, 'super', 'admin'), id ASC
         LIMIT 1"
    );
    $user = $statement ? $statement->fetch() : false;
    if (!is_array($user)) {
        $statement = $pdo->query(
            'SELECT id, email, display_name, role, visible_modules_json
             FROM oceanos_users
             WHERE is_active = 1
             ORDER BY id ASC
             LIMIT 1'
        );
        $user = $statement ? $statement->fetch() : false;
    }
    if (!is_array($user)) {
        throw new RuntimeException('Aucun utilisateur OceanOS actif pour tracer la synchronisation.');
    }

    $user['nautimail_system_access'] = true;
    return $user;
}

function nautimail_cli_accounts(PDO $pdo, int $accountId): array
{
    if ($accountId > 0) {
        $statement = $pdo->prepare(
            'SELECT id, label, email_address
             FROM nautimail_accounts
             WHERE id = :id AND is_active = 1
             ORDER BY email_address ASC, id ASC'
        );
        $statement->execute(['id' => $accountId]);
        return $statement->fetchAll();
    }

    return $pdo->query(
        'SELECT id, label, email_address
         FROM nautimail_accounts
         WHERE is_active = 1
         ORDER BY email_address ASC, id ASC'
    )->fetchAll();
}

$options = getopt('', ['account::', 'limit::', 'json', 'quiet']);
$limit = nautimail_cli_option_int($options, 'limit', 50, 1, 100);
$accountId = nautimail_cli_option_int($options, 'account', 0, 0, PHP_INT_MAX);
$json = array_key_exists('json', $options);
$quiet = array_key_exists('quiet', $options);

$startedAt = date(DATE_ATOM);
$results = [];
$errors = [];
$created = 0;
$updated = 0;
$seen = 0;

try {
    $pdo = nautimail_pdo();
    if (!function_exists('imap_open')) {
        throw new RuntimeException('Extension PHP IMAP inactive.');
    }

    $user = nautimail_cli_sync_user($pdo);
    $accounts = nautimail_cli_accounts($pdo, $accountId);
    foreach ($accounts as $account) {
        try {
            $summary = nautimail_sync_account($pdo, $user, [
                'accountId' => (int) $account['id'],
                'limit' => $limit,
            ]);
            $summary['accountId'] = (int) $account['id'];
            $summary['label'] = (string) ($account['label'] ?? $account['email_address']);
            $results[] = $summary;
            $seen += (int) ($summary['seen'] ?? 0);
            $created += (int) ($summary['created'] ?? 0);
            $updated += (int) ($summary['updated'] ?? 0);
        } catch (Throwable $exception) {
            $errors[] = [
                'accountId' => (int) $account['id'],
                'label' => (string) ($account['label'] ?? $account['email_address']),
                'message' => $exception->getMessage(),
            ];
        }
    }
} catch (Throwable $exception) {
    $errors[] = [
        'accountId' => null,
        'label' => 'NautiMail',
        'message' => $exception->getMessage(),
    ];
}

$payload = [
    'ok' => $errors === [],
    'startedAt' => $startedAt,
    'finishedAt' => date(DATE_ATOM),
    'accountCount' => count($results),
    'seen' => $seen,
    'created' => $created,
    'updated' => $updated,
    'results' => $results,
    'errors' => $errors,
];

if ($json) {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . PHP_EOL;
} elseif (!$quiet) {
    printf(
        "NautiMail sync: %d compte(s), %d mail(s) lus, %d ajoute(s), %d mis a jour, %d erreur(s).\n",
        count($results),
        $seen,
        $created,
        $updated,
        count($errors)
    );
    foreach ($errors as $error) {
        printf("- %s: %s\n", (string) $error['label'], (string) $error['message']);
    }
}

exit($errors !== [] && $results === [] ? 1 : 0);
