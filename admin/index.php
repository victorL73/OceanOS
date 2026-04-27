<?php
declare(strict_types=1);

session_name('OCEANOSADMINSESSID');
session_start();

const OCEANOS_ADMIN_DEFAULT_LOGIN_HASH = 'dd693f002f22c059a7d870a74b10503c224a2f5e6e3f0d750fac9f10c026ebbd';
const OCEANOS_ADMIN_DEFAULT_PASSWORD_HASH = '$2y$12$JwgZs7nHC01qGvoswVyCXOZTY1JG8Z.EyfY9lPtYQqEFoKkx8QvMq';

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function oceanos_admin_root_path(string ...$parts): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $parts);
}

function oceanos_admin_credentials_path(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'admin_credentials.php';
}

function oceanos_admin_default_credentials(): array
{
    return [
        'login_hash' => OCEANOS_ADMIN_DEFAULT_LOGIN_HASH,
        'password_hash' => OCEANOS_ADMIN_DEFAULT_PASSWORD_HASH,
        'updated_at' => gmdate('c'),
    ];
}

function oceanos_admin_write_php_config(string $path, array $data): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        throw new RuntimeException('Impossible de creer le dossier de configuration.');
    }

    $content = "<?php\n";
    $content .= "declare(strict_types=1);\n\n";
    $content .= 'return ' . var_export($data, true) . ";\n";

    if (file_put_contents($path, $content, LOCK_EX) === false) {
        throw new RuntimeException('Impossible d ecrire la configuration.');
    }
}

function oceanos_admin_load_credentials(): array
{
    $path = oceanos_admin_credentials_path();
    if (!is_file($path)) {
        oceanos_admin_write_php_config($path, oceanos_admin_default_credentials());
    }

    $credentials = require $path;
    if (!is_array($credentials)) {
        return oceanos_admin_default_credentials();
    }

    return array_merge(oceanos_admin_default_credentials(), $credentials);
}

function oceanos_admin_save_password(string $password): void
{
    $credentials = oceanos_admin_load_credentials();
    $credentials['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    $credentials['updated_at'] = gmdate('c');
    oceanos_admin_write_php_config(oceanos_admin_credentials_path(), $credentials);
}

function oceanos_admin_verify_login(string $login, string $password): bool
{
    $credentials = oceanos_admin_load_credentials();
    $loginHash = hash('sha256', trim($login));

    return hash_equals((string) $credentials['login_hash'], $loginHash)
        && password_verify($password, (string) $credentials['password_hash']);
}

function oceanos_admin_is_authenticated(): bool
{
    return isset($_SESSION['oceanos_admin_authenticated']) && $_SESSION['oceanos_admin_authenticated'] === true;
}

function oceanos_admin_csrf_token(): string
{
    if (empty($_SESSION['oceanos_admin_csrf'])) {
        $_SESSION['oceanos_admin_csrf'] = bin2hex(random_bytes(32));
    }

    return (string) $_SESSION['oceanos_admin_csrf'];
}

function oceanos_admin_require_csrf(): void
{
    $token = (string) ($_POST['csrf'] ?? '');
    if ($token === '' || !hash_equals(oceanos_admin_csrf_token(), $token)) {
        throw new RuntimeException('Session expiree, rechargez la page.');
    }
}

function oceanos_admin_server_config_path(): string
{
    return oceanos_admin_root_path('OceanOS', 'config', 'server.php');
}

function oceanos_admin_default_database_config(): array
{
    return [
        'db_host' => '127.0.0.1',
        'db_port' => 3306,
        'db_name' => 'OceanOS',
        'db_user' => 'root',
        'db_pass' => '',
    ];
}

function oceanos_admin_database_config(): array
{
    $path = oceanos_admin_server_config_path();
    $config = is_file($path) ? require $path : [];
    $config = is_array($config) ? $config : [];

    return array_merge(oceanos_admin_default_database_config(), $config);
}

function oceanos_admin_database_config_from_post(array $current): array
{
    $host = trim((string) ($_POST['db_host'] ?? ''));
    $port = (int) ($_POST['db_port'] ?? 0);
    $name = trim((string) ($_POST['db_name'] ?? ''));
    $user = trim((string) ($_POST['db_user'] ?? ''));
    $postedPassword = (string) ($_POST['db_pass'] ?? '');
    $clearPassword = isset($_POST['db_pass_empty']);

    if ($host === '' || mb_strlen($host) > 190) {
        throw new InvalidArgumentException('Hote MySQL invalide.');
    }
    if ($port < 1 || $port > 65535) {
        throw new InvalidArgumentException('Port MySQL invalide.');
    }
    if (!preg_match('/^[A-Za-z0-9_]+$/', $name) || mb_strlen($name) > 64) {
        throw new InvalidArgumentException('Nom de base invalide. Utilisez lettres, chiffres et underscore.');
    }
    if ($user === '' || mb_strlen($user) > 190) {
        throw new InvalidArgumentException('Utilisateur MySQL invalide.');
    }
    if (strlen($postedPassword) > 512) {
        throw new InvalidArgumentException('Mot de passe MySQL trop long.');
    }

    return [
        'db_host' => $host,
        'db_port' => $port,
        'db_name' => $name,
        'db_user' => $user,
        'db_pass' => $postedPassword !== '' || $clearPassword ? $postedPassword : (string) ($current['db_pass'] ?? ''),
    ];
}

function oceanos_admin_save_database_config(array $config): void
{
    oceanos_admin_write_php_config(oceanos_admin_server_config_path(), $config);
}

function oceanos_admin_root_pdo(array $config): PDO
{
    return new PDO(
        sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $config['db_host'], (int) $config['db_port']),
        (string) $config['db_user'],
        (string) $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
}

function oceanos_admin_database_pdo(array $config): PDO
{
    return new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], (int) $config['db_port'], $config['db_name']),
        (string) $config['db_user'],
        (string) $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
}

function oceanos_admin_database_exists(PDO $root, string $dbName): bool
{
    $statement = $root->prepare('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = :name LIMIT 1');
    $statement->execute(['name' => $dbName]);

    return $statement->fetchColumn() !== false;
}

function oceanos_admin_table_names(PDO $root, string $dbName): array
{
    $statement = $root->prepare('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :name ORDER BY TABLE_NAME');
    $statement->execute(['name' => $dbName]);

    return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
}

function oceanos_admin_super_users(array $config, array $tables): array
{
    if (!in_array('oceanos_users', $tables, true)) {
        return [];
    }

    $pdo = oceanos_admin_database_pdo($config);
    $statement = $pdo->query("SELECT display_name, email, is_active, created_at FROM oceanos_users WHERE role = 'super' ORDER BY created_at ASC, id ASC");

    return $statement->fetchAll();
}

function oceanos_admin_status(array $config): array
{
    $status = [
        'connection_ok' => false,
        'database_exists' => false,
        'tables' => [],
        'super_users' => [],
        'error' => '',
    ];

    try {
        $root = oceanos_admin_root_pdo($config);
        $status['connection_ok'] = true;
        $status['database_exists'] = oceanos_admin_database_exists($root, (string) $config['db_name']);
        if ($status['database_exists']) {
            $status['tables'] = oceanos_admin_table_names($root, (string) $config['db_name']);
            $status['super_users'] = oceanos_admin_super_users($config, $status['tables']);
        }
    } catch (Throwable $exception) {
        $status['error'] = $exception->getMessage();
    }

    return $status;
}

function oceanos_admin_require_flowcean(): void
{
    require_once oceanos_admin_root_path('Flowcean', 'api', 'bootstrap.php');
}

function oceanos_admin_require_oceanos(): void
{
    require_once oceanos_admin_root_path('OceanOS', 'api', 'bootstrap.php');
}

function oceanos_admin_require_invocean(): void
{
    require_once oceanos_admin_root_path('Invocean', 'api', 'bootstrap.php');
}

function oceanos_admin_require_stockcean(): void
{
    require_once oceanos_admin_root_path('Stockcean', 'api', 'bootstrap.php');
}

function oceanos_admin_create_database_schema(): void
{
    oceanos_admin_require_oceanos();
    oceanos_pdo();

    oceanos_admin_require_flowcean();
    flowcean_pdo();

    oceanos_admin_require_invocean();
    invocean_pdo();

    oceanos_admin_require_stockcean();
    stockcean_pdo();
}

function oceanos_admin_create_super_user(string $displayName, string $email, string $password): array
{
    oceanos_admin_require_oceanos();
    $pdo = oceanos_pdo();

    return oceanos_create_user($pdo, $displayName, $email, $password, 'super');
}

$message = ['type' => '', 'text' => ''];
$databaseConfig = oceanos_admin_database_config();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        oceanos_admin_require_csrf();
        $action = (string) ($_POST['action'] ?? '');

        if ($action === 'login') {
            if (oceanos_admin_verify_login((string) ($_POST['login'] ?? ''), (string) ($_POST['password'] ?? ''))) {
                session_regenerate_id(true);
                $_SESSION['oceanos_admin_authenticated'] = true;
                $_SESSION['oceanos_admin_csrf'] = bin2hex(random_bytes(32));
                $message = ['type' => 'success', 'text' => 'Connexion admin active.'];
            } else {
                $message = ['type' => 'error', 'text' => 'Identifiant ou mot de passe invalide.'];
            }
        } elseif ($action === 'logout') {
            unset($_SESSION['oceanos_admin_authenticated']);
            $_SESSION['oceanos_admin_csrf'] = bin2hex(random_bytes(32));
            $message = ['type' => 'success', 'text' => 'Session fermee.'];
        } elseif (!oceanos_admin_is_authenticated()) {
            $message = ['type' => 'error', 'text' => 'Connexion admin requise.'];
        } elseif (in_array($action, ['save_database', 'test_database', 'create_database'], true)) {
            $databaseConfig = oceanos_admin_database_config_from_post($databaseConfig);
            if ($action === 'test_database') {
                oceanos_admin_root_pdo($databaseConfig);
                $message = ['type' => 'success', 'text' => 'Connexion MySQL valide.'];
            }
            if ($action === 'save_database') {
                oceanos_admin_save_database_config($databaseConfig);
                $message = ['type' => 'success', 'text' => 'Connexion MySQL enregistree.'];
            }
            if ($action === 'create_database') {
                oceanos_admin_save_database_config($databaseConfig);
                oceanos_admin_create_database_schema();
                $message = ['type' => 'success', 'text' => 'Base et tables OceanOS creees ou mises a jour.'];
            }
        } elseif ($action === 'create_super') {
            $user = oceanos_admin_create_super_user(
                trim((string) ($_POST['super_display_name'] ?? '')),
                trim((string) ($_POST['super_email'] ?? '')),
                (string) ($_POST['super_password'] ?? '')
            );
            $message = ['type' => 'success', 'text' => 'Super-utilisateur cree : ' . (string) $user['email']];
        } elseif ($action === 'change_admin_password') {
            $currentPassword = (string) ($_POST['current_admin_password'] ?? '');
            $newPassword = (string) ($_POST['new_admin_password'] ?? '');
            $confirmPassword = (string) ($_POST['confirm_admin_password'] ?? '');
            $credentials = oceanos_admin_load_credentials();

            if (!password_verify($currentPassword, (string) $credentials['password_hash'])) {
                throw new InvalidArgumentException('Mot de passe actuel invalide.');
            }
            if (mb_strlen($newPassword) < 8) {
                throw new InvalidArgumentException('Le nouveau mot de passe doit contenir au moins 8 caracteres.');
            }
            if ($newPassword !== $confirmPassword) {
                throw new InvalidArgumentException('La confirmation ne correspond pas.');
            }

            oceanos_admin_save_password($newPassword);
            $message = ['type' => 'success', 'text' => 'Mot de passe admin modifie.'];
        }
    }
} catch (Throwable $exception) {
    $message = ['type' => 'error', 'text' => $exception->getMessage()];
}

$authenticated = oceanos_admin_is_authenticated();
$credentials = oceanos_admin_load_credentials();
$databaseConfig = oceanos_admin_database_config();
$status = $authenticated ? oceanos_admin_status($databaseConfig) : [
    'connection_ok' => false,
    'database_exists' => false,
    'tables' => [],
    'super_users' => [],
    'error' => '',
];
$csrf = oceanos_admin_csrf_token();
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin OceanOS</title>
  <link rel="icon" type="image/svg+xml" href="/OceanOS/assets/favicons/admin.svg?v=20260427">
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111a;
      --panel: #111d28;
      --panel-2: #0d1822;
      --line: #2b3d4e;
      --text: #edf7ff;
      --muted: #a7b9c9;
      --teal: #20d4bd;
      --blue: #3ba6ff;
      --red: #ff6b6b;
      --amber: #f2b84b;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    button,
    input {
      font: inherit;
    }

    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 52px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--line);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .mark {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--blue), var(--teal));
      color: #06111a;
      font-weight: 950;
    }

    .kicker {
      margin: 0 0 4px;
      color: var(--teal);
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    h1 {
      margin-bottom: 0;
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      letter-spacing: 0;
    }

    h2 {
      margin-bottom: 18px;
      font-size: 1.35rem;
      letter-spacing: 0;
    }

    h3 {
      margin-bottom: 8px;
      font-size: 1rem;
    }

    .muted {
      color: var(--muted);
      line-height: 1.45;
    }

    .login-wrap {
      min-height: calc(100vh - 160px);
      display: grid;
      place-items: center;
    }

    .login-panel,
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }

    .login-panel {
      width: min(440px, 100%);
      padding: 26px;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 16px;
      margin-top: 18px;
      align-items: start;
    }

    .panel {
      padding: 22px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }

    .status-item {
      min-height: 76px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel-2);
    }

    .status-item span {
      display: block;
      margin-bottom: 7px;
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 800;
    }

    .status-item strong {
      display: block;
      overflow-wrap: anywhere;
      font-size: 1rem;
    }

    .ok {
      color: var(--teal);
    }

    .warn {
      color: var(--amber);
    }

    .bad {
      color: var(--red);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .field {
      display: grid;
      gap: 7px;
    }

    .field.full {
      grid-column: 1 / -1;
    }

    label {
      color: var(--muted);
      font-size: 0.84rem;
      font-weight: 800;
    }

    input {
      width: 100%;
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      outline: none;
      background: #08131d;
      color: var(--text);
    }

    input:focus {
      border-color: rgba(59, 166, 255, 0.72);
      box-shadow: 0 0 0 3px rgba(59, 166, 255, 0.16);
    }

    .checkbox-line {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      min-height: 42px;
      color: var(--muted);
      font-weight: 800;
    }

    .checkbox-line input {
      width: 18px;
      min-height: 18px;
      padding: 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    button,
    .button-link {
      min-height: 42px;
      padding: 0 15px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }

    .primary {
      border-color: transparent;
      background: linear-gradient(135deg, var(--blue), var(--teal));
      color: #06111a;
    }

    .danger {
      border-color: rgba(255, 107, 107, 0.35);
      color: var(--red);
      background: rgba(255, 107, 107, 0.08);
    }

    .message {
      margin: 18px 0 0;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
    }

    .message[data-type="success"] {
      border-color: rgba(32, 212, 189, 0.35);
      color: var(--teal);
    }

    .message[data-type="error"] {
      border-color: rgba(255, 107, 107, 0.35);
      color: var(--red);
    }

    .list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .list li {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.035);
    }

    .list small {
      color: var(--muted);
    }

    .stack {
      display: grid;
      gap: 16px;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    @media (max-width: 920px) {
      .grid,
      .status-grid,
      .form-grid {
        grid-template-columns: 1fr;
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .top-actions {
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <?php if (!$authenticated): ?>
      <section class="login-wrap">
        <form class="login-panel" method="post">
          <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
          <input type="hidden" name="action" value="login">
          <p class="kicker">Configuration</p>
          <h1>Admin OceanOS</h1>
          <p class="muted">Acces reserve a la configuration initiale.</p>
          <div class="field">
            <label for="login">Identifiant</label>
            <input id="login" name="login" autocomplete="username" required>
          </div>
          <div class="field" style="margin-top:14px">
            <label for="password">Mot de passe</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <div class="actions">
            <button class="primary" type="submit">Connexion</button>
          </div>
          <?php if ($message['text'] !== ''): ?>
            <div class="message" data-type="<?= h($message['type']) ?>"><?= h($message['text']) ?></div>
          <?php endif; ?>
        </form>
      </section>
    <?php else: ?>
      <header class="topbar">
        <div class="brand">
          <span class="mark">O</span>
          <div>
            <p class="kicker">Admin</p>
            <h1>Configuration OceanOS</h1>
          </div>
        </div>
        <div class="top-actions">
          <a class="button-link" href="/OceanOS/">OceanOS</a>
          <form method="post">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <button class="danger" type="submit" name="action" value="logout">Deconnexion</button>
          </form>
        </div>
      </header>

      <?php if ($message['text'] !== ''): ?>
        <div class="message" data-type="<?= h($message['type']) ?>"><?= h($message['text']) ?></div>
      <?php endif; ?>

      <section class="status-grid" aria-label="Etat de configuration">
        <div class="status-item">
          <span>Connexion MySQL</span>
          <strong class="<?= $status['connection_ok'] ? 'ok' : 'bad' ?>"><?= $status['connection_ok'] ? 'Valide' : 'A verifier' ?></strong>
        </div>
        <div class="status-item">
          <span>Base principale</span>
          <strong class="<?= $status['database_exists'] ? 'ok' : 'warn' ?>"><?= $status['database_exists'] ? h((string) $databaseConfig['db_name']) : 'Non creee' ?></strong>
        </div>
        <div class="status-item">
          <span>Tables</span>
          <strong><?= count($status['tables']) ?></strong>
        </div>
        <div class="status-item">
          <span>Super-utilisateurs</span>
          <strong><?= count($status['super_users']) ?></strong>
        </div>
      </section>

      <?php if ($status['error'] !== ''): ?>
        <div class="message" data-type="error"><?= h($status['error']) ?></div>
      <?php endif; ?>

      <section class="grid">
        <div class="stack">
          <form class="panel" method="post">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <h2>Connexion a la BDD</h2>
            <div class="form-grid">
              <div class="field">
                <label for="db_host">Hote</label>
                <input id="db_host" name="db_host" value="<?= h((string) $databaseConfig['db_host']) ?>" required>
              </div>
              <div class="field">
                <label for="db_port">Port</label>
                <input id="db_port" name="db_port" type="number" min="1" max="65535" value="<?= h((string) $databaseConfig['db_port']) ?>" required>
              </div>
              <div class="field">
                <label for="db_name">Nom de la base</label>
                <input id="db_name" name="db_name" value="<?= h((string) $databaseConfig['db_name']) ?>" required>
              </div>
              <div class="field">
                <label for="db_user">Utilisateur MySQL</label>
                <input id="db_user" name="db_user" value="<?= h((string) $databaseConfig['db_user']) ?>" autocomplete="off" required>
              </div>
              <div class="field full">
                <label for="db_pass">Mot de passe MySQL</label>
                <input id="db_pass" name="db_pass" type="password" autocomplete="new-password" placeholder="<?= ((string) $databaseConfig['db_pass']) !== '' ? 'Mot de passe deja configure' : 'Aucun mot de passe configure' ?>">
              </div>
              <label class="checkbox-line field full">
                <input type="checkbox" name="db_pass_empty" value="1">
                Definir un mot de passe MySQL vide
              </label>
            </div>
            <div class="actions">
              <button type="submit" name="action" value="test_database">Tester</button>
              <button type="submit" name="action" value="save_database">Enregistrer</button>
              <button class="primary" type="submit" name="action" value="create_database">Creer / mettre a jour la BDD</button>
            </div>
          </form>

          <form class="panel" method="post">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <h2>Acces configuration</h2>
            <div class="form-grid">
              <div class="field full">
                <label for="current_admin_password">Mot de passe actuel</label>
                <input id="current_admin_password" name="current_admin_password" type="password" autocomplete="current-password" required>
              </div>
              <div class="field">
                <label for="new_admin_password">Nouveau mot de passe</label>
                <input id="new_admin_password" name="new_admin_password" type="password" minlength="8" autocomplete="new-password" required>
              </div>
              <div class="field">
                <label for="confirm_admin_password">Confirmation</label>
                <input id="confirm_admin_password" name="confirm_admin_password" type="password" minlength="8" autocomplete="new-password" required>
              </div>
            </div>
            <div class="actions">
              <button type="submit" name="action" value="change_admin_password">Modifier le mot de passe</button>
            </div>
          </form>
        </div>

        <aside class="stack">
          <form class="panel" method="post">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <h2>Super-utilisateurs</h2>
            <div class="form-grid">
              <div class="field full">
                <label for="super_display_name">Nom</label>
                <input id="super_display_name" name="super_display_name" required>
              </div>
              <div class="field full">
                <label for="super_email">Email</label>
                <input id="super_email" name="super_email" type="email" autocomplete="email" required>
              </div>
              <div class="field full">
                <label for="super_password">Mot de passe provisoire</label>
                <input id="super_password" name="super_password" type="password" minlength="8" autocomplete="new-password" required>
              </div>
            </div>
            <div class="actions">
              <button class="primary" type="submit" name="action" value="create_super">Creer le compte</button>
            </div>
          </form>

          <section class="panel">
            <h2>Comptes existants</h2>
            <?php if (count($status['super_users']) === 0): ?>
              <p class="muted">Aucun super-utilisateur detecte.</p>
            <?php else: ?>
              <ul class="list">
                <?php foreach ($status['super_users'] as $superUser): ?>
                  <li>
                    <strong><?= h((string) ($superUser['display_name'] ?? 'Utilisateur')) ?></strong>
                    <small><?= h((string) ($superUser['email'] ?? '')) ?></small>
                    <small><?= ((bool) ($superUser['is_active'] ?? false)) ? 'Actif' : 'Inactif' ?></small>
                  </li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </section>

          <section class="panel">
            <h2>Tables OceanOS</h2>
            <?php if (count($status['tables']) === 0): ?>
              <p class="muted">Aucune table detectee.</p>
            <?php else: ?>
              <ul class="list">
                <?php foreach ($status['tables'] as $tableName): ?>
                  <li><strong><?= h((string) $tableName) ?></strong></li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </section>
        </aside>
      </section>
    <?php endif; ?>
  </main>
</body>
</html>
