<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'bootstrap.php';

$pdo = oceanos_pdo();
$user = oceanos_current_user($pdo);
if ($user === null) {
    header('Location: /OceanOS/?next=' . rawurlencode('/Backup/'));
    exit;
}

if (!oceanos_is_super_user($user)) {
    http_response_code(403);
    oceanos_send_security_headers();
    ?>
    <!doctype html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Backup - Acces refuse</title>
      <link rel="stylesheet" href="/OceanOS/assets/guard.css">
      <link rel="stylesheet" href="/Backup/assets/style.css?v=20260502">
    </head>
    <body>
      <main class="access-denied">
        <span class="brand-mark">BA</span>
        <h1>Acces reserve</h1>
        <p>Le module Backup est reserve aux super-utilisateurs OceanOS.</p>
        <a class="primary-link" href="/OceanOS/">Retour OceanOS</a>
      </main>
    </body>
    </html>
    <?php
    exit;
}

oceanos_send_security_headers();

function backup_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Backup OceanOS</title>
  <link rel="icon" type="image/svg+xml" href="/OceanOS/assets/favicons/backup.svg?v=20260502">
  <meta name="description" content="Backup OceanOS - archives ZIP du dossier www et export SQL de la base.">
  <link rel="stylesheet" href="/OceanOS/assets/guard.css">
  <link rel="stylesheet" href="assets/style.css?v=20260502">
  <script defer src="/OceanOS/assets/guard.js?v=20260503-nautimail-notification-link"></script>
  <script defer src="assets/app.js?v=20260502-cron-auto"></script>
</head>
<body>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-mark">BA</span>
        <div>
          <p class="eyebrow">OceanOS</p>
          <h1>Backup</h1>
        </div>
      </div>
      <div class="topbar-actions">
        <a class="ghost-link" href="/OceanOS/">OceanOS</a>
        <button class="ghost-button danger-text" id="logout-button" type="button">Deconnexion</button>
        <span class="user-chip" id="current-user"><?= backup_h((string) $user['display_name']) ?></span>
      </div>
    </header>

    <p class="app-message hidden" id="app-message"></p>

    <section class="metrics-grid" aria-label="Statistiques Backup">
      <article class="metric">
        <span>Archives</span>
        <strong id="metric-count">0</strong>
      </article>
      <article class="metric">
        <span>Stockage</span>
        <strong id="metric-size">0 o</strong>
      </article>
      <article class="metric">
        <span>Dernier backup</span>
        <strong id="metric-last">Aucun</strong>
      </article>
      <article class="metric live">
        <span>Prochain backup</span>
        <strong id="metric-next">Desactive</strong>
      </article>
    </section>

    <section class="backup-layout">
      <section class="panel manual-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Action</p>
            <h2>Backup manuel</h2>
          </div>
          <button class="ghost-button" id="refresh-button" type="button">Actualiser</button>
        </div>

        <div class="action-row">
          <button class="primary-button" id="create-backup-button" type="button">Creer un backup</button>
          <span class="run-state" id="run-state">Pret</span>
        </div>

        <dl class="path-list">
          <div>
            <dt>Dossier www</dt>
            <dd id="www-root">-</dd>
          </div>
          <div>
            <dt>Dossier archives</dt>
            <dd id="backup-directory">-</dd>
          </div>
          <div>
            <dt>ZIP PHP</dt>
            <dd id="zip-requirement">-</dd>
          </div>
          <div>
            <dt>Droits stockage</dt>
            <dd id="storage-requirement">-</dd>
          </div>
        </dl>
      </section>

      <form class="panel schedule-panel" id="schedule-form">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Automatique</p>
            <h2>Planification</h2>
          </div>
          <label class="switch">
            <input id="schedule-enabled" type="checkbox">
            <span>Actif</span>
          </label>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Frequence</span>
            <select id="schedule-frequency">
              <option value="hourly">Chaque heure</option>
              <option value="daily">Chaque jour</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </label>

          <label class="field">
            <span>Heure</span>
            <input id="schedule-time" type="time" value="02:00">
          </label>

          <label class="field" id="weekday-field">
            <span>Jour</span>
            <select id="schedule-weekday">
              <option value="1">Lundi</option>
              <option value="2">Mardi</option>
              <option value="3">Mercredi</option>
              <option value="4">Jeudi</option>
              <option value="5">Vendredi</option>
              <option value="6">Samedi</option>
              <option value="7">Dimanche</option>
            </select>
          </label>

          <label class="field" id="monthday-field">
            <span>Jour du mois</span>
            <input id="schedule-monthday" type="number" min="1" max="31" value="1">
          </label>

          <label class="field">
            <span>Archives gardees max</span>
            <input id="retention-count" type="number" min="1" max="365" value="12">
          </label>

          <label class="field">
            <span>Suppression apres</span>
            <input id="retention-days" type="number" min="1" max="3650" value="15">
          </label>
        </div>

        <div class="form-actions">
          <button class="primary-button" id="save-schedule-button" type="submit">Enregistrer</button>
          <button class="ghost-button" id="run-scheduled-button" type="button">Tester le cron</button>
        </div>
      </form>
    </section>

    <section class="panel cron-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Ubuntu</p>
          <h2>Cron serveur</h2>
        </div>
        <button class="ghost-button" id="copy-cron-button" type="button">Copier</button>
      </div>
      <code class="cron-command" id="cron-command">Chargement...</code>
    </section>

    <section class="panel backups-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Archives</p>
          <h2>Backups disponibles</h2>
        </div>
      </div>
      <div class="backup-list" id="backup-list"></div>
    </section>
  </main>
</body>
</html>
