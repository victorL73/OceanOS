<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OceanOS</title>
  <link rel="icon" type="image/svg+xml" href="/OceanOS/assets/favicons/oceanos.svg?v=20260427">
  <meta name="description" content="OceanOS - Portail CRM central pour Agenda, Flowcean, Invocean, Stockcean, Mobywork, NautiPost, NautiCloud, Formcean, Nautisign, Naviplan, SeoCean et MeetOcean.">
  <link rel="stylesheet" href="assets/guard.css">
  <link rel="stylesheet" href="assets/oceanos.css?v=20260427-company-scope">
</head>
<body>
  <main class="shell" data-state="loading">
    <section class="status-view" id="loading-view">
      <div class="pulse-mark">O</div>
      <p>Chargement OceanOS...</p>
    </section>

    <section class="login-view hidden" id="login-view">
      <div class="identity-panel">
        <div class="brand-line">
          <span class="brand-mark">O</span>
          <div>
            <p class="eyebrow">CRM central</p>
            <h1>OceanOS</h1>
          </div>
        </div>
        <p class="lead">Une seule connexion pour ouvrir vos applications internes et garder la session active sur tout le site.</p>
        <div class="mini-map" aria-hidden="true">
          <span>Agenda</span>
          <span>Flowcean</span>
          <span>Invocean</span>
          <span>Stockcean</span>
          <span>Mobywork</span>
          <span>NautiCloud</span>
          <span>Formcean</span>
          <span>Nautisign</span>
          <span>Naviplan</span>
          <span>SeoCean</span>
          <span>MeetOcean</span>
        </div>
      </div>

      <form class="auth-card" id="auth-form">
        <p class="eyebrow" id="auth-kicker">Connexion</p>
        <h2 id="auth-title">Acceder a OceanOS</h2>
        <p class="muted" id="auth-subtitle">Connectez-vous ici, puis ouvrez les apps sans vous reconnecter.</p>

        <label class="field hidden" id="name-field">
          <span>Nom affiche</span>
          <input id="display-name" type="text" autocomplete="name">
        </label>
        <label class="field">
          <span>Email</span>
          <input id="email" type="email" autocomplete="username" required>
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input id="password" type="password" autocomplete="current-password" required>
        </label>

        <button class="primary-button" id="submit-button" type="submit">Se connecter</button>
        <p class="form-message hidden" id="form-message"></p>
      </form>
    </section>

    <section class="dashboard-view hidden" id="dashboard-view">
      <header class="topbar">
        <div class="brand-line compact">
          <span class="brand-mark">O</span>
          <div>
            <p class="eyebrow">OceanOS</p>
            <h1>Portail CRM</h1>
          </div>
        </div>
        <div class="user-zone">
          <button class="user-chip user-menu-trigger" id="user-chip" type="button"></button>
          <button class="ghost-button" id="logout-button" type="button">Deconnexion</button>
        </div>
      </header>

      <section class="user-menu hidden" id="user-menu" role="dialog" aria-modal="true" aria-labelledby="user-menu-title">
        <button class="user-menu-backdrop" id="user-menu-backdrop" type="button" aria-label="Fermer le menu utilisateur"></button>
        <div class="user-menu-panel">
          <div class="user-menu-header">
            <div>
              <p class="eyebrow">Menu utilisateur</p>
              <h2 id="user-menu-title">Mon compte OceanOS</h2>
            </div>
            <button class="ghost-button" id="close-user-menu" type="button">Fermer</button>
          </div>

          <div class="user-control-center">
            <nav class="user-control-rail" aria-label="Menu utilisateur OceanOS">
              <button class="user-control-tab active" data-user-tab="account" type="button">
                <strong>Compte</strong>
                <span>Profil et session</span>
              </button>
              <button class="user-control-tab" data-user-tab="ai" type="button">
                <strong>IA Groq</strong>
                <span>Cle partagee</span>
              </button>
              <button class="user-control-tab" data-user-tab="company" id="user-tab-company" type="button">
                <strong>Entreprise</strong>
                <span>Infos communes</span>
              </button>
              <button class="user-control-tab hidden" data-user-tab="prestashop" id="user-tab-prestashop" type="button">
                <strong>PrestaShop</strong>
                <span>Connecteur commun</span>
              </button>
              <button class="user-control-tab hidden" data-user-tab="admin" id="user-tab-admin" type="button">
                <strong>Admin</strong>
                <span>Comptes et droits</span>
              </button>
              <button class="user-control-tab hidden" data-user-tab="services" id="user-tab-services" type="button">
                <strong>Serveurs</strong>
                <span>Etat et services</span>
              </button>
            </nav>

            <div class="user-control-content">
              <section class="user-menu-section active" data-user-section="account">
                <div class="user-control-profile">
                  <div class="user-menu-avatar" id="menu-user-avatar">O</div>
                  <div>
                    <strong id="menu-user-name">Utilisateur</strong>
                    <span id="menu-user-email"></span>
                  </div>
                </div>

                <div class="user-control-info-grid">
                  <div class="user-control-info">
                    <span>Role</span>
                    <strong id="menu-user-role">Membre</strong>
                  </div>
                  <div class="user-control-info">
                    <span>Session</span>
                    <strong>Partagee sur tout le site</strong>
                  </div>
                </div>

                <div class="user-control-actions">
                  <button class="user-control-action" data-user-jump="ai" type="button">
                    <span>
                      <strong>Configuration IA Groq</strong>
                      <small>Gerer la cle utilisee par Flowcean, Mobywork, NautiPost et MeetOcean.</small>
                    </span>
                    <em>Onglet</em>
                  </button>
                  <button class="user-control-action admin-only-action hidden" data-user-jump="prestashop" type="button">
                    <span>
                      <strong>Connecteur PrestaShop</strong>
                      <small>Gerer l URL boutique et la cle Webservice partagees.</small>
                    </span>
                    <em>Admin</em>
                  </button>
                  <button class="user-control-action" data-user-jump="company" type="button">
                    <span>
                      <strong>Informations entreprise</strong>
                      <small>Coordonnees communes utilisees dans les modules et les documents.</small>
                    </span>
                    <em>Commun</em>
                  </button>
                  <button class="user-control-action hidden" id="menu-admin-page-button" type="button">
                    <span>
                      <strong>Admin serveur</strong>
                      <small>Ouvrir la configuration initiale, la BDD et les super-utilisateurs.</small>
                    </span>
                    <em>Page</em>
                  </button>
                  <button class="user-control-action services-only-action hidden" data-user-jump="services" type="button">
                    <span>
                      <strong>Services Ubuntu</strong>
                      <small>Suivre et piloter Apache, la base de donnees et Mobywork.</small>
                    </span>
                    <em>Admin</em>
                  </button>
                  <button class="user-control-action danger" id="menu-logout-button" type="button">
                    <span>
                      <strong>Deconnexion</strong>
                      <small>Quitter OceanOS sur cet appareil.</small>
                    </span>
                    <em>Sortir</em>
                  </button>
                </div>
              </section>

              <section class="user-menu-section" data-user-section="ai">
                <div class="user-control-heading">
                  <h3>Configuration IA Groq</h3>
                  <p>Cette cle est utilisee par Flowcean, Mobywork, NautiPost, MeetOcean et les futurs modules OceanOS.</p>
                </div>

                <form class="ai-form" id="ai-form">
                  <label class="field">
                    <span>Modele Groq</span>
                    <input id="ai-model" type="text" value="llama-3.3-70b-versatile" autocomplete="off">
                  </label>
                  <label class="field">
                    <span>Cle API Groq</span>
                    <input id="ai-key" type="password" placeholder="gsk_..." autocomplete="off">
                  </label>
                  <div class="ai-actions">
                    <button class="primary-button" id="save-ai-button" type="submit">Enregistrer</button>
                    <button class="ghost-button" id="test-ai-button" type="button">Tester</button>
                    <button class="danger-button" id="delete-ai-button" type="button">Supprimer</button>
                  </div>
                </form>
                <p class="ai-status" id="ai-status"></p>
              </section>

              <section class="user-menu-section" data-user-section="company">
                <div class="user-control-heading">
                  <h3>Informations entreprise</h3>
                  <p>Ces coordonnees sont communes a toutes les sessions et reutilisees par les modules OceanOS.</p>
                </div>

                <form class="company-form" id="company-form">
                  <label class="field">
                    <span>Nom de l'entreprise</span>
                    <input id="company-name" type="text" autocomplete="organization">
                  </label>
                  <label class="field">
                    <span>Telephone</span>
                    <input id="company-phone" type="text" autocomplete="tel">
                  </label>
                  <label class="field">
                    <span>Adresse</span>
                    <input id="company-address" type="text" autocomplete="street-address">
                  </label>
                  <label class="field">
                    <span>Ville et code postal</span>
                    <input id="company-city" type="text" autocomplete="address-level2">
                  </label>
                  <label class="field">
                    <span>Email entreprise</span>
                    <input id="company-email" type="email" autocomplete="email">
                  </label>
                  <label class="field">
                    <span>SIRET</span>
                    <input id="company-siret" type="text" inputmode="numeric">
                  </label>
                  <div class="company-actions">
                    <button class="primary-button" id="save-company-button" type="submit">Enregistrer</button>
                    <button class="ghost-button" id="reset-company-button" type="button">Reinitialiser</button>
                  </div>
                </form>
                <p class="ai-status" id="company-status"></p>
              </section>

              <section class="user-menu-section" data-user-section="prestashop">
                <div class="user-control-heading">
                  <h3>Connecteur PrestaShop</h3>
                  <p>Cette configuration est utilisee par Invocean, Stockcean, Mobywork et les futurs modules e-commerce.</p>
                </div>

                <form class="prestashop-form" id="prestashop-form">
                  <label class="field">
                    <span>URL boutique</span>
                    <input id="prestashop-shop-url" type="url" placeholder="https://boutique.example.com" autocomplete="off">
                  </label>
                  <label class="field">
                    <span>Cle Webservice</span>
                    <input id="prestashop-key" type="password" placeholder="Conserver la cle actuelle" autocomplete="off">
                  </label>
                  <label class="field">
                    <span>Fenetre de synchronisation</span>
                    <input id="prestashop-sync-window-days" type="number" min="1" max="365" value="30">
                  </label>
                  <label class="check-row">
                    <input id="prestashop-clear-key" type="checkbox">
                    <span>Effacer la cle enregistree</span>
                  </label>
                  <div class="prestashop-actions">
                    <button class="primary-button" id="save-prestashop-button" type="submit">Enregistrer</button>
                    <button class="ghost-button" id="test-prestashop-button" type="button">Tester</button>
                    <button class="danger-button" id="delete-prestashop-button" type="button">Supprimer</button>
                  </div>
                </form>
                <p class="ai-status" id="prestashop-status"></p>
              </section>

              <section class="user-menu-section admin-panel hidden" id="admin-panel" data-user-section="admin">
                <div class="admin-heading">
                  <div>
                    <p class="eyebrow">Comptes et droits</p>
                    <h2>Administration OceanOS</h2>
                  </div>
                  <button class="ghost-button" id="reload-users" type="button">Actualiser</button>
                </div>

                <form class="user-create-form" id="user-create-form">
                  <label class="field">
                    <span>Nom</span>
                    <input id="new-display-name" type="text" autocomplete="name" required>
                  </label>
                  <label class="field">
                    <span>Email</span>
                    <input id="new-email" type="email" autocomplete="off" required>
                  </label>
                  <label class="field">
                    <span>Mot de passe provisoire</span>
                    <input id="new-password" type="password" autocomplete="new-password" minlength="8" required>
                  </label>
                  <label class="field">
                    <span>Role</span>
                    <select id="new-role">
                      <option value="member">Membre</option>
                      <option value="admin">Administrateur</option>
                      <option value="super" id="new-role-super">Super-utilisateur</option>
                    </select>
                  </label>
                  <button class="primary-button" id="create-user-button" type="submit">Creer le compte</button>
                </form>

                <p class="form-message hidden" id="users-message"></p>
                <div class="users-list" id="users-list"></div>
              </section>

              <section class="user-menu-section services-panel hidden" id="services-panel" data-user-section="services">
                <div class="admin-heading">
                  <div>
                    <p class="eyebrow">Services serveur</p>
                    <h2>Etat Ubuntu</h2>
                  </div>
                  <div class="services-toolbar">
                    <button class="ghost-button" id="reload-services" type="button">Actualiser</button>
                    <button class="primary-button" id="update-services" type="button">Mettre a jour</button>
                  </div>
                </div>

                <p class="ai-status" id="services-status"></p>
                <div class="services-list" id="services-list"></div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section class="overview">
        <div>
          <p class="eyebrow">Applications</p>
          <h2>Passerelle principale</h2>
        </div>
        <p class="muted">Votre session OceanOS est partagee avec Flowcean, Invocean, Stockcean, Mobywork, NautiPost, NautiCloud, Formcean, Nautisign, Naviplan, SeoCean et MeetOcean.</p>
      </section>

      <section class="app-grid" id="app-grid"></section>

    </section>
  </main>

  <script defer src="assets/guard.js?v=20260501-agenda"></script>
  <script src="assets/oceanos.js?v=20260501-agenda"></script>
</body>
</html>
