const AUTH_URL = "/OceanOS/api/auth.php";
const MODULE_DATA_URL = "/OceanOS/api/module_preview_data.php";

const moduleCatalog = {
  pilotocean: {
    title: "PilotOcean",
    mark: "PI",
    eyebrow: "Cockpit ERP",
    subtitle: "Pilotage transversal des ventes, operations, stock et tresorerie.",
    status: "Vue cockpit",
    accent: "#38a3ff",
    accent2: "#7ed66f",
    tabs: ["Synthese", "Ventes", "Operations"],
    metrics: [
      ["CA mois", "42.8 kEUR", "+12%"],
      ["Devis a signer", "7", "3 chauds"],
      ["Stock critique", "12", "a surveiller"],
      ["Tresorerie", "38 j", "prevision"],
    ],
    priorities: [
      ["Relancer les devis Renovboat en attente", "Devis, NautiCRM et NautiMail", "Vente"],
      ["Verifier les ruptures liees aux commandes ouvertes", "Commandes et Stockcean", "Stock"],
      ["Controle TVA et benefice net de la semaine", "Tresorcean et Invocean", "Finance"],
      ["Tickets SAV a impact client fort", "SAV et Portail Client", "Support"],
    ],
    flows: [
      ["Devis signe -> facture", "3 dossiers", "Invocean pret"],
      ["Commande -> reservation stock", "5 commandes", "2 lignes critiques"],
      ["Prospect -> opportunite", "9 prospects", "NautiCRM"],
      ["SAV -> intervention", "4 demandes", "QualiOcean"],
    ],
    statusRows: [
      ["Connecteurs", "PrestaShop, CRM, Finance"],
      ["Mode", "Consolidation"],
      ["Rythme", "Quotidien"],
    ],
    roadmap: [
      ["Tableaux de bord", "Aggregations par module et alertes configurables."],
      ["Decision rapide", "Actions directes vers devis, stock, facture et SAV."],
      ["Prevision", "Tresorerie et charge equipe projetees sur 30 jours."],
    ],
  },
  portailclient: {
    title: "Portail Client",
    mark: "PC",
    eyebrow: "Espace externe",
    subtitle: "Vue client pour devis, factures, commandes, documents et SAV.",
    status: "Vue portail",
    accent: "#1fd1b2",
    accent2: "#f2b84b",
    tabs: ["Clients", "Documents", "Demandes"],
    metrics: [
      ["Clients actifs", "126", "avec acces"],
      ["Documents prets", "43", "a publier"],
      ["Demandes SAV", "9", "ouvertes"],
      ["Signatures", "5", "en cours"],
    ],
    priorities: [
      ["Publier les devis signes et factures recentes", "Invocean, Devis et Nautisign", "Docs"],
      ["Centraliser les demandes SAV entrantes", "SAV et NautiMail", "Support"],
      ["Preparer le suivi des commandes client", "Commandes et PrestaShop", "Commande"],
      ["Partager les documents techniques", "NautiCloud et PIMcean", "Cloud"],
    ],
    flows: [
      ["Facture disponible", "18 clients", "Lecture seule"],
      ["Signature attendue", "5 liens", "Nautisign"],
      ["Commande en traitement", "12 commandes", "PrestaShop"],
      ["Demande client", "9 tickets", "SAV"],
    ],
    statusRows: [
      ["Exposition", "Espace authentifie"],
      ["Documents", "PDF et fichiers"],
      ["Source", "Modules OceanOS"],
    ],
    roadmap: [
      ["Acces client", "Comptes rattaches aux clients NautiCRM."],
      ["Centre documents", "Factures, devis, bons et fichiers partages."],
      ["Suivi SAV", "Fil de discussion et pieces jointes par demande."],
    ],
  },
  pimcean: {
    title: "PIMcean",
    mark: "PIM",
    eyebrow: "Catalogue produit",
    subtitle: "Fiches produits, medias, variantes, marges et synchronisation PrestaShop.",
    status: "Vue catalogue",
    accent: "#d8c45f",
    accent2: "#38a3ff",
    tabs: ["Catalogue", "Enrichissement", "Sync"],
    metrics: [
      ["Produits", "1 248", "catalogue"],
      ["A enrichir", "86", "fiches"],
      ["Marge moyenne", "32%", "estimee"],
      ["Sync", "18 min", "dernier run"],
    ],
    priorities: [
      ["Completer les fiches sans image principale", "PrestaShop et NautiCloud", "Medias"],
      ["Revoir les prix sous marge cible", "Stockcean et Tresorcean", "Marge"],
      ["Identifier les variantes incoherentes", "Catalogue et commandes", "Variantes"],
      ["Preparer les contenus SEO produit", "SeoCean et NautiPost", "SEO"],
    ],
    flows: [
      ["Fiche -> PrestaShop", "74 modifications", "A valider"],
      ["Media -> produit", "31 images", "NautiCloud"],
      ["Achat -> cout revient", "42 lignes", "Stockcean"],
      ["Produit -> SEO", "18 pages", "SeoCean"],
    ],
    statusRows: [
      ["Referentiel", "Produits et variantes"],
      ["Connecteur", "PrestaShop"],
      ["Controle", "Marge et completude"],
    ],
    roadmap: [
      ["Fiche unique", "Nom, description, medias, compatibilites et prix."],
      ["Regles marge", "Alertes sur cout, prix public et marge minimale."],
      ["Publication", "Synchronisation selective vers PrestaShop."],
    ],
  },
  contratocean: {
    title: "ContratOcean",
    mark: "CT",
    eyebrow: "Contrats",
    subtitle: "Contrats, abonnements, garanties, renouvellements et facturation recurrente.",
    status: "Vue contrats",
    accent: "#36c9b6",
    accent2: "#ff8a5b",
    tabs: ["Contrats", "Renouvellements", "Garanties"],
    metrics: [
      ["Contrats actifs", "42", "suivis"],
      ["Renouv. 30j", "8", "a traiter"],
      ["Recurrent", "6.4 kEUR", "mensuel"],
      ["Garanties", "17", "ouvertes"],
    ],
    priorities: [
      ["Renouveler les contrats arrivant a echeance", "NautiCRM et Agenda", "30 jours"],
      ["Generer les factures recurrentes", "Invocean et Tresorcean", "Facture"],
      ["Relier garanties et interventions", "SAV et QualiOcean", "Garantie"],
      ["Controler les contrats sans document signe", "Nautisign et NautiCloud", "Signature"],
    ],
    flows: [
      ["Contrat -> facture", "11 cycles", "Invocean"],
      ["Garantie -> SAV", "6 dossiers", "A suivre"],
      ["Renouvellement -> relance", "8 clients", "NautiCRM"],
      ["Document -> signature", "4 contrats", "Nautisign"],
    ],
    statusRows: [
      ["Perimetre", "Contrats et garanties"],
      ["Rythme", "Mensuel"],
      ["Alerte", "Echeances"],
    ],
    roadmap: [
      ["Bibliotheque", "Modeles de contrats et conditions rattachees."],
      ["Facturation", "Cycles recurrents et ecritures associees."],
      ["Echeances", "Relances automatiques et alertes calendrier."],
    ],
  },
  qualiocean: {
    title: "QualiOcean",
    mark: "QL",
    eyebrow: "Qualite",
    subtitle: "Checklists, controles livraison, non-conformites et audits internes.",
    status: "Vue qualite",
    accent: "#7ed66f",
    accent2: "#f2b84b",
    tabs: ["Checklists", "Non-conformites", "Audits"],
    metrics: [
      ["Checklists", "18", "actives"],
      ["NC ouvertes", "4", "priorite"],
      ["Livraisons OK", "92%", "mois"],
      ["Audits", "3", "ouverts"],
    ],
    priorities: [
      ["Finaliser les controles avant livraison", "Commandes et SAV", "Livraison"],
      ["Traiter les non-conformites critiques", "SAV et AtelierOcean futur", "NC"],
      ["Archiver les preuves photo", "NautiCloud", "Preuves"],
      ["Verifier les actions correctives", "Agenda et Flowcean", "Actions"],
    ],
    flows: [
      ["Checklist -> livraison", "7 controles", "En cours"],
      ["NC -> action", "4 dossiers", "Ouvert"],
      ["Audit -> rapport", "3 audits", "A rediger"],
      ["Preuve -> cloud", "22 fichiers", "NautiCloud"],
    ],
    statusRows: [
      ["Standards", "Controle interne"],
      ["Documents", "Photos et rapports"],
      ["Boucle", "Actions correctives"],
    ],
    roadmap: [
      ["Modeles", "Checklists par type de prestation ou commande."],
      ["Preuves", "Pieces jointes, photos et signatures de controle."],
      ["Suivi", "Actions correctives avec responsable et date cible."],
    ],
  },
  dataocean: {
    title: "DataOcean",
    mark: "DA",
    eyebrow: "BI et reporting",
    subtitle: "Indicateurs, rapports, analyses et exports de donnees OceanOS.",
    status: "Vue BI",
    accent: "#9adf68",
    accent2: "#38a3ff",
    tabs: ["KPI", "Rapports", "Exports"],
    metrics: [
      ["KPI suivis", "24", "actifs"],
      ["Rapports", "12", "modeles"],
      ["Alertes BI", "5", "ouvertes"],
      ["Exports", "7", "prets"],
    ],
    priorities: [
      ["Construire la marge par canal de vente", "Invocean, Commandes et Stockcean", "Marge"],
      ["Suivre le tunnel prospect -> client", "Prospection et NautiCRM", "Tunnel"],
      ["Analyser les stocks dormants", "Stockcean et PIMcean", "Stock"],
      ["Prevoir la tresorerie a 60 jours", "Tresorcean et contrats", "Finance"],
    ],
    flows: [
      ["Ventes -> rapport", "4 sources", "Mensuel"],
      ["CRM -> conversion", "3 segments", "Pipeline"],
      ["Stock -> rotation", "248 refs", "Analyse"],
      ["Finance -> prevision", "60 jours", "Tresorcean"],
    ],
    statusRows: [
      ["Sources", "Modules OceanOS"],
      ["Sorties", "Tableaux et CSV"],
      ["Frequence", "A la demande"],
    ],
    roadmap: [
      ["Modele KPI", "Definitions partagees pour ventes, marge et operationnel."],
      ["Rapports", "Vues enregistrables et exports CSV/PDF."],
      ["Alertes", "Seuils declenches sur indicateurs critiques."],
    ],
  },
};

const $ = (id) => document.getElementById(id);

const state = {
  query: "",
  activeTab: "",
  moduleData: null,
  loadingData: false,
  dataError: "",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function config() {
  const moduleId = document.body.dataset.module || "pilotocean";
  const fallback = moduleCatalog[moduleId] || moduleCatalog.pilotocean;
  const data = state.moduleData?.moduleId === moduleId ? state.moduleData : null;
  if (!data) return fallback;

  return {
    ...fallback,
    status: "Donnees reliees",
    metrics: rowsOrFallback(data.metrics, fallback.metrics),
    priorities: rowsOrFallback(data.priorities, fallback.priorities),
    flows: rowsOrFallback(data.flows, fallback.flows),
    statusRows: rowsOrFallback(data.statusRows, rowsOrFallback(data.sources, fallback.statusRows)),
  };
}

function currentModuleId() {
  return document.body.dataset.module || "pilotocean";
}

function rowsOrFallback(rows, fallback) {
  return Array.isArray(rows) && rows.length > 0 ? rows : fallback;
}

function userCanOpenModule(user) {
  if (!Array.isArray(user?.visibleModules)) return true;
  if (user.visibleModules.length === 0) return false;
  const moduleId = currentModuleId();
  return user.visibleModules
    .map((value) => String(value || "").toLowerCase())
    .includes(moduleId);
}

function setVisible(ready) {
  $("loading-view")?.classList.toggle("hidden", ready);
  $("app-view")?.classList.toggle("hidden", !ready);
}

function rowMatches(row) {
  const query = normalize(state.query);
  if (!query) return true;
  return normalize(row.filter(Boolean).join(" ")).includes(query);
}

function renderMetrics(moduleConfig) {
  return moduleConfig.metrics.map(([label, value, hint]) => `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join("");
}

function renderTabs(moduleConfig) {
  return moduleConfig.tabs.map((tab) => `
    <button class="tab-button${tab === state.activeTab ? " is-active" : ""}" type="button" data-tab="${escapeHtml(tab)}">${escapeHtml(tab)}</button>
  `).join("");
}

function renderPriorities(moduleConfig) {
  const rows = moduleConfig.priorities.filter(rowMatches);
  if (rows.length === 0) {
    return '<div class="empty-state">Aucun element ne correspond a la recherche.</div>';
  }
  return rows.map(([title, source, badge, actionUrl]) => `
    <article class="priority-item">
      <div>
        <span class="item-kicker">${escapeHtml(state.activeTab)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(source)}</p>
      </div>
      <div class="priority-actions">
        <span class="item-badge">${escapeHtml(badge)}</span>
        ${actionUrl ? `<a class="ghost-link compact-link" href="${escapeHtml(actionUrl)}">Ouvrir</a>` : ""}
      </div>
    </article>
  `).join("");
}

function renderFlows(moduleConfig) {
  const rows = moduleConfig.flows.filter(rowMatches);
  if (rows.length === 0) {
    return '<tr><td colspan="3">Aucun flux trouve.</td></tr>';
  }
  return rows.map(([flow, volume, status, actionUrl]) => `
    <tr>
      <td><strong>${escapeHtml(flow)}</strong><small>${escapeHtml(state.activeTab)}</small></td>
      <td>${escapeHtml(volume)}</td>
      <td>
        ${actionUrl
          ? `<a class="status-pill status-link" href="${escapeHtml(actionUrl)}">${escapeHtml(status)}</a>`
          : `<span class="status-pill">${escapeHtml(status)}</span>`}
      </td>
    </tr>
  `).join("");
}

function renderStatusRows(moduleConfig) {
  return moduleConfig.statusRows.map(([label, value]) => `
    <div class="status-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderRoadmap(moduleConfig) {
  return moduleConfig.roadmap.map(([tag, text]) => `
    <article class="roadmap-item">
      <span class="roadmap-tag">${escapeHtml(tag)}</span>
      <strong>${escapeHtml(text)}</strong>
    </article>
  `).join("");
}

function renderMeta(moduleConfig) {
  return moduleConfig.tabs.map((tab) => `<span>${escapeHtml(tab)}</span>`).join("");
}

function renderDataNotice() {
  if (state.loadingData) {
    return '<p class="app-message">Connexion aux donnees ERP en cours.</p>';
  }
  if (!state.dataError) {
    return "";
  }

  return `<p class="app-message" data-type="error">${escapeHtml(state.dataError)}</p>`;
}

function renderApp(user) {
  const moduleConfig = config();
  if (!state.activeTab) state.activeTab = moduleConfig.tabs[0];
  document.title = `${moduleConfig.title} - OceanOS`;
  document.documentElement.style.setProperty("--accent", moduleConfig.accent);
  document.documentElement.style.setProperty("--accent-2", moduleConfig.accent2);

  const appView = $("app-view");
  appView.innerHTML = `
    <header class="topbar">
      <div>
        <div class="brand-row">
          <span class="brand-mark compact">${escapeHtml(moduleConfig.mark)}</span>
          <span class="status-pill">${escapeHtml(moduleConfig.status)}</span>
        </div>
        <p class="eyebrow">${escapeHtml(moduleConfig.eyebrow)}</p>
        <h1>${escapeHtml(moduleConfig.title)}</h1>
        <p>${escapeHtml(moduleConfig.subtitle)}</p>
        ${renderDataNotice()}
      </div>
      <div class="topbar-actions">
        <a class="ghost-link" href="/OceanOS/">OceanOS</a>
        <button class="ghost-button danger-text" id="logout-button" type="button">Deconnexion</button>
        <span class="user-chip">${escapeHtml(user?.displayName || user?.email || "OceanOS")}</span>
      </div>
    </header>

    <section class="metrics-grid" aria-label="Indicateurs ${escapeHtml(moduleConfig.title)}">
      ${renderMetrics(moduleConfig)}
    </section>

    <section class="control-strip">
      <label class="search-field">
        <span>Recherche</span>
        <input id="search-input" type="search" value="${escapeHtml(state.query)}" placeholder="Client, module, statut, action...">
      </label>
      <nav class="tab-list" aria-label="Vues ${escapeHtml(moduleConfig.title)}">
        ${renderTabs(moduleConfig)}
      </nav>
    </section>

    <section class="workspace-grid">
      <section>
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">${escapeHtml(moduleConfig.title)}</p>
              <h2>Priorites ${escapeHtml(state.activeTab)}</h2>
            </div>
            <span class="count-pill">${moduleConfig.priorities.filter(rowMatches).length} elements</span>
          </div>
          <div class="priority-list">
            ${renderPriorities(moduleConfig)}
          </div>
          <div class="action-row">
            <a class="ghost-link" href="/Agenda/">Agenda</a>
            <button class="primary-button" id="refresh-data-button" type="button">Actualiser</button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Flux</p>
              <h2>Passerelles modules</h2>
            </div>
          </div>
          <table class="flow-table">
            <thead>
              <tr>
                <th>Flux</th>
                <th>Volume</th>
                <th>Etat</th>
              </tr>
            </thead>
            <tbody>${renderFlows(moduleConfig)}</tbody>
          </table>
        </section>
      </section>

      <aside class="side-panel">
        <section class="panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Configuration</p>
              <h2>Raccords modules</h2>
            </div>
          </div>
          ${renderStatusRows(moduleConfig)}
          <div class="mini-meta">
            ${renderMeta(moduleConfig)}
          </div>
        </section>

        <section class="panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Suite</p>
              <h2>Socle fonctionnel</h2>
            </div>
          </div>
          <div class="roadmap-list">
            ${renderRoadmap(moduleConfig)}
          </div>
        </section>
      </aside>
    </section>
  `;

  $("search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderApp(user);
    $("search-input")?.focus();
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab || moduleConfig.tabs[0];
      renderApp(user);
    });
  });

  $("refresh-data-button")?.addEventListener("click", () => {
    refreshModuleData(user);
  });

  setVisible(true);
}

async function fetchModuleData() {
  const response = await fetch(`${MODULE_DATA_URL}?module=${encodeURIComponent(currentModuleId())}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "Donnees ERP indisponibles pour ce module.");
  }

  return payload;
}

async function refreshModuleData(user) {
  state.loadingData = true;
  state.dataError = "";
  renderApp(user);

  try {
    state.moduleData = await fetchModuleData();
  } catch (error) {
    state.moduleData = null;
    state.dataError = error?.message || "Donnees ERP indisponibles pour ce module.";
  } finally {
    state.loadingData = false;
    renderApp(user);
  }
}

async function boot() {
  try {
    const response = await fetch(AUTH_URL, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!payload.authenticated) return;
    if (!userCanOpenModule(payload.user || null)) {
      window.location.href = "/OceanOS/";
      return;
    }
    const user = payload.user || null;
    renderApp(user);
    refreshModuleData(user);
  } catch (error) {
    return;
  }
}

boot();
