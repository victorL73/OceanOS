const API = {
  auth: "api/auth.php",
  clients: "api/clients.php",
};

const OCEANOS_URL = "/OceanOS/";
const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  prestashopChip: $("prestashop-chip"),
  currentUser: $("current-user"),
  syncPrestashopButton: $("sync-prestashop-button"),
  refreshButton: $("refresh-button"),
  newClientButton: $("new-client-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricClients: $("metric-clients"),
  metricProspects: $("metric-prospects"),
  metricFollowups: $("metric-followups"),
  metricPipeline: $("metric-pipeline"),
  metricTasks: $("metric-tasks"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  filtersForm: $("filters-form"),
  filterSearch: $("filter-search"),
  filterType: $("filter-type"),
  filterStatus: $("filter-status"),
  aiSearch: $("ai-search"),
  aiRaw: $("ai-raw"),
  aiCleanButton: $("ai-clean-button"),
  aiCsvFile: $("ai-csv-file"),
  aiCsvButton: $("ai-csv-button"),
  aiCategory: $("ai-category"),
  aiRegion: $("ai-region"),
  aiCount: $("ai-count"),
  aiImportButton: $("ai-import-button"),
  aiClearButton: $("ai-clear-button"),
  aiPreview: $("ai-preview"),
  clientsBody: $("clients-body"),
  clientForm: $("client-form"),
  clientFormTitle: $("client-form-title"),
  clientId: $("client-id"),
  clientCompany: $("client-company"),
  clientType: $("client-type"),
  clientStatus: $("client-status"),
  clientPriority: $("client-priority"),
  clientAssigned: $("client-assigned"),
  clientSegment: $("client-segment"),
  clientSource: $("client-source"),
  clientEmail: $("client-email"),
  clientPhone: $("client-phone"),
  clientWebsite: $("client-website"),
  clientAddress: $("client-address"),
  clientCity: $("client-city"),
  clientCountry: $("client-country"),
  clientSiret: $("client-siret"),
  clientVat: $("client-vat"),
  clientNextAction: $("client-next-action"),
  clientNotes: $("client-notes"),
  clientSaveButton: $("client-save-button"),
  clientResetButton: $("client-reset-button"),
  clientArchiveButton: $("client-archive-button"),
  clientDetailEmpty: $("client-detail-empty"),
  clientDetail: $("client-detail"),
  detailSummary: $("detail-summary"),
  contactForm: $("contact-form"),
  contactId: $("contact-id"),
  contactFirstName: $("contact-first-name"),
  contactLastName: $("contact-last-name"),
  contactJobTitle: $("contact-job-title"),
  contactEmail: $("contact-email"),
  contactPhone: $("contact-phone"),
  contactPrimary: $("contact-primary"),
  contactsList: $("contacts-list"),
  interactionForm: $("interaction-form"),
  interactionType: $("interaction-type"),
  interactionContact: $("interaction-contact"),
  interactionSubject: $("interaction-subject"),
  interactionDate: $("interaction-date"),
  interactionNextAction: $("interaction-next-action"),
  interactionBody: $("interaction-body"),
  interactionsList: $("interactions-list"),
  taskForm: $("task-form"),
  taskId: $("task-id"),
  taskTitle: $("task-title"),
  taskStatus: $("task-status"),
  taskPriority: $("task-priority"),
  taskDue: $("task-due"),
  taskAssigned: $("task-assigned"),
  taskNotes: $("task-notes"),
  clientTasksList: $("client-tasks-list"),
  opportunityForm: $("opportunity-form"),
  opportunityId: $("opportunity-id"),
  opportunityTitle: $("opportunity-title"),
  opportunityStage: $("opportunity-stage"),
  opportunityAmount: $("opportunity-amount"),
  opportunityProbability: $("opportunity-probability"),
  opportunityClose: $("opportunity-close"),
  opportunityNotes: $("opportunity-notes"),
  clientOpportunitiesList: $("client-opportunities-list"),
  tasksList: $("tasks-list"),
  opportunitiesList: $("opportunities-list"),
  activityList: $("activity-list"),
};

const state = {
  user: null,
  settings: null,
  latestSync: null,
  stats: {},
  clients: [],
  users: [],
  recentInteractions: [],
  tasks: [],
  opportunities: [],
  selectedBundle: null,
  currentView: "clients",
  aiImport: {
    clients: [],
  },
};

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const labels = {
  clientType: {
    prospect: "Prospect",
    client: "Client",
    partner: "Partenaire",
    inactive: "Inactif",
  },
  status: {
    new: "Nouveau",
    active: "Actif",
    follow_up: "A relancer",
    won: "Gagne",
    lost: "Perdu",
    archived: "Archive",
  },
  priority: {
    low: "Basse",
    normal: "Normale",
    high: "Haute",
  },
  interactionType: {
    call: "Appel",
    email: "Email",
    meeting: "Rendez-vous",
    note: "Note",
    quote: "Devis",
    order: "Commande",
    support: "Support",
  },
  taskStatus: {
    todo: "A faire",
    doing: "En cours",
    done: "Terminee",
    cancelled: "Annulee",
  },
  stage: {
    lead: "Lead",
    qualified: "Qualifie",
    proposal: "Devis",
    negotiation: "Negociation",
    won: "Gagne",
    lost: "Perdu",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function isAdmin() {
  return ["super", "admin"].includes(String(state.user?.role || "member"));
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function setActiveView(view) {
  state.currentView = view || "clients";
  elements.viewTabs.forEach((button) => {
    const active = button.dataset.view === state.currentView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== state.currentView);
  });
}

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "Requete impossible.");
  }
  return payload;
}

async function fetchAuth() {
  const payload = await apiRequest(API.auth);
  if (!payload.authenticated) {
    redirectToOceanOS();
    return false;
  }
  state.user = payload.user || null;
  return true;
}

function queryFromFilters() {
  const params = new URLSearchParams();
  if (elements.filterSearch.value.trim()) params.set("search", elements.filterSearch.value.trim());
  if (elements.filterType.value) params.set("type", elements.filterType.value);
  if (elements.filterStatus.value) params.set("status", elements.filterStatus.value);
  return params;
}

async function loadDashboard() {
  const query = queryFromFilters();
  const payload = await apiRequest(`${API.clients}?${query.toString()}`);
  applyDashboard(payload);
}

async function loadClient(clientId, activate = true) {
  const payload = await apiRequest(`${API.clients}?action=client&id=${encodeURIComponent(clientId)}`);
  state.selectedBundle = payload.bundle || null;
  if (state.selectedBundle?.client) {
    populateClientForm(state.selectedBundle.client);
  }
  renderDetail();
  if (activate) setActiveView("detail");
}

function applyDashboard(payload) {
  state.user = payload.user || state.user;
  state.settings = payload.settings || null;
  state.latestSync = payload.latestSync || null;
  state.stats = payload.stats || {};
  state.clients = payload.clients || [];
  state.users = payload.users || [];
  state.recentInteractions = payload.recentInteractions || [];
  state.tasks = payload.tasks || [];
  state.opportunities = payload.opportunities || [];
  render();
}

function applySavePayload(payload) {
  if (payload.bundle) {
    state.selectedBundle = payload.bundle;
    if (state.selectedBundle.client) populateClientForm(state.selectedBundle.client);
  }
  if (payload.dashboard) {
    applyDashboard(payload.dashboard);
  } else {
    applyDashboard(payload);
  }
  renderDetail();
}

function userOptions(selectedId = null, includeEmpty = true) {
  const options = includeEmpty ? ['<option value="">Non assigne</option>'] : [];
  state.users.forEach((user) => {
    const selected = Number(selectedId || 0) === Number(user.id) ? " selected" : "";
    const label = user.displayName || user.email || "Utilisateur";
    options.push(`<option value="${user.id}"${selected}>${escapeHtml(label)}</option>`);
  });
  return options.join("");
}

function contactOptions(selectedId = null) {
  const contacts = state.selectedBundle?.contacts || [];
  const options = ['<option value="">Aucun contact</option>'];
  contacts.forEach((contact) => {
    const selected = Number(selectedId || 0) === Number(contact.id) ? " selected" : "";
    const label = contact.name || contact.email || "Contact";
    options.push(`<option value="${contact.id}"${selected}>${escapeHtml(label)}</option>`);
  });
  return options.join("");
}

function render() {
  renderChrome();
  renderMetrics();
  renderUsersInForms();
  renderClients();
  renderAiPreview();
  renderDetail();
  renderGlobalTasks();
  renderGlobalOpportunities();
  renderActivity();
  setActiveView(state.currentView);
}

function renderChrome() {
  const user = state.user || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  const connected = Boolean(state.settings?.shopUrl && state.settings?.hasWebserviceKey);
  elements.prestashopChip.textContent = connected ? "PrestaShop connecte" : "PrestaShop non configure";
  elements.prestashopChip.className = connected ? "status-pill success-pill" : "status-pill muted-pill";
  elements.syncPrestashopButton.disabled = !connected || !isAdmin();
  if (state.latestSync?.finishedAt) {
    const status = state.latestSync.status === "success" ? "OK" : state.latestSync.status === "failed" ? "echec" : "en cours";
    elements.prestashopChip.title = `Derniere synchro ${formatDateTime(state.latestSync.finishedAt)} (${status})`;
  } else {
    elements.prestashopChip.title = connected ? "Aucune synchronisation NautiCRM encore lancee." : "Configurez PrestaShop dans OceanOS.";
  }
}

function renderMetrics() {
  const stats = state.stats || {};
  elements.metricClients.textContent = String(stats.clientCount || 0);
  elements.metricProspects.textContent = String(stats.prospectCount || 0);
  elements.metricFollowups.textContent = String(stats.dueFollowupCount || 0);
  elements.metricPipeline.textContent = money.format(Number(stats.pipelineAmount || 0));
  elements.metricTasks.textContent = String(stats.openTaskCount || 0);
}

function renderUsersInForms() {
  const selectedClientUser = elements.clientAssigned.value || state.selectedBundle?.client?.assignedUserId || "";
  const selectedTaskUser = elements.taskAssigned.value || state.user?.id || "";
  elements.clientAssigned.innerHTML = userOptions(selectedClientUser, true);
  elements.taskAssigned.innerHTML = userOptions(selectedTaskUser, true);
}

function badge(value, type = "") {
  const className = `${type || value}`.replace(/[^a-z0-9_-]/gi, "");
  return `<span class="mini-pill ${className}">${escapeHtml(value)}</span>`;
}

function renderClients() {
  if (state.clients.length === 0) {
    elements.clientsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Aucun client.</td></tr>';
    return;
  }

  elements.clientsBody.innerHTML = state.clients.map((client) => `
    <tr data-client-row="${client.id}">
      <td class="client-name-cell">
        <strong>${escapeHtml(client.companyName)}</strong>
        <span class="table-meta">${escapeHtml(client.segment || client.source || "Sans segment")} - ${client.contactCount} contact(s)${client.prestashopCustomerId ? ` - PS #${client.prestashopCustomerId}` : ""}</span>
      </td>
      <td>
        ${badge(labels.status[client.status] || client.status, client.status)}
        <span class="table-meta">${escapeHtml(labels.clientType[client.clientType] || client.clientType)} - ${escapeHtml(labels.priority[client.priority] || client.priority)}</span>
      </td>
      <td>
        <span>${escapeHtml(client.email || client.phone || "-")}</span>
        <span class="table-meta">${escapeHtml(client.city || client.assignedUserDisplayName || "")}</span>
      </td>
      <td>
        <span>${client.nextActionAt ? escapeHtml(formatDate(client.nextActionAt)) : "-"}</span>
        <span class="table-meta">${client.openTaskCount} tache(s)</span>
      </td>
      <td>
        <span>${money.format(Number(client.opportunityAmount || 0))}</span>
        <span class="table-meta">${client.prestashopOrdersCount ? `${client.prestashopOrdersCount} commande(s) PS` : ""}</span>
      </td>
      <td>
        <div class="card-actions">
          <button class="ghost-button" data-client-open="${client.id}" type="button">Ouvrir</button>
          <button class="ghost-button" data-client-edit="${client.id}" type="button">Editer</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function aiSearchText(client) {
  return [
    client.companyName,
    client.firstName,
    client.lastName,
    client.email,
    client.phone,
    client.website,
    client.city,
    client.country,
    client.segment,
    client.source,
    client.address,
    client.siret,
    client.vatNumber,
    client.notes,
    ...(client.sourceUrls || []),
  ].join(" ").toLowerCase();
}

function filteredAiClients() {
  const search = (elements.aiSearch?.value || "").trim().toLowerCase();
  const clients = state.aiImport.clients || [];
  if (search === "") return clients;
  return clients.filter((client) => aiSearchText(client).includes(search));
}

function urlHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return url;
  }
}

function renderAiPreview() {
  const clients = filteredAiClients();
  const total = state.aiImport.clients.length;
  elements.aiCount.textContent = `${total} client${total > 1 ? "s" : ""}`;
  elements.aiImportButton.disabled = total === 0;

  if (total === 0) {
    elements.aiPreview.innerHTML = '<div class="empty-state">Collez une liste de clients puis lancez le nettoyage IA.</div>';
    return;
  }

  if (clients.length === 0) {
    elements.aiPreview.innerHTML = '<div class="empty-state">Aucun client ne correspond a la recherche.</div>';
    return;
  }

  elements.aiPreview.innerHTML = clients.map((client, index) => {
    const originalIndex = state.aiImport.clients.indexOf(client);
    const name = client.companyName || [client.firstName, client.lastName].filter(Boolean).join(" ") || client.email || "Client IA";
    const contact = [client.firstName, client.lastName].filter(Boolean).join(" ");
    const segment = [client.segment, client.source].filter(Boolean).join(" - ");
    const place = [client.address, client.city, client.country].filter(Boolean).join(" - ");
    const identifiers = [client.siret ? `SIRET ${client.siret}` : "", client.vatNumber ? `TVA ${client.vatNumber}` : ""].filter(Boolean).join(" - ");
    const sources = Array.isArray(client.sourceUrls) ? client.sourceUrls.filter(Boolean).slice(0, 4) : [];
    return `
      <article class="ai-preview-card">
        <div class="ai-preview-title">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <small class="detail-meta">${escapeHtml(contact || client.email || client.phone || "Contact a completer")}</small>
          </div>
          <button class="ghost-button danger-text" data-ai-remove="${originalIndex}" type="button">Retirer</button>
        </div>
        <div class="ai-preview-meta">
          <span>${escapeHtml(client.email || "-")}<br>${escapeHtml(client.phone || "")}</span>
          <span>${escapeHtml(client.website || "-")}<br>${escapeHtml(place || "")}</span>
          <span>${escapeHtml(segment || "Import IA")}<br>${escapeHtml(identifiers || "")}</span>
        </div>
        ${client.notes ? `<p class="ai-preview-notes">${escapeHtml(client.notes)}</p>` : ""}
        ${sources.length ? `<div class="ai-source-list">${sources.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urlHost(url))}</a>`).join("")}</div>` : ""}
      </article>
    `;
  }).join("");
}

async function cleanAiImport() {
  const rawData = elements.aiRaw.value.trim();
  if (rawData === "") {
    showMessage("Collez des donnees client avant de lancer l IA.", "error");
    return;
  }

  elements.aiCleanButton.disabled = true;
  showMessage("Recherche web et enrichissement IA en cours...");
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "ai_clean_import",
        rawData,
        category: elements.aiCategory.value,
        region: elements.aiRegion.value,
      }),
    });
    state.aiImport.clients = payload.clients || [];
    renderAiPreview();
    showMessage(payload.message || `${state.aiImport.clients.length} client(s) enrichi(s).`, "success");
  } catch (error) {
    showMessage(error.message || "Recherche IA impossible.", "error");
  } finally {
    elements.aiCleanButton.disabled = false;
  }
}

function readAiCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsText(file);
  });
}

async function handleAiCsvFile() {
  const file = elements.aiCsvFile.files?.[0];
  if (!file) return;
  try {
    elements.aiRaw.value = await readAiCsvFile(file);
    state.aiImport.clients = [];
    renderAiPreview();
    showMessage("CSV charge. Lancez le nettoyage IA pour preparer les clients.", "success");
  } catch (error) {
    showMessage(error.message || "Import CSV impossible.", "error");
  } finally {
    elements.aiCsvFile.value = "";
  }
}

async function importAiClients() {
  const clients = state.aiImport.clients || [];
  if (clients.length === 0) return;

  elements.aiImportButton.disabled = true;
  showMessage("Import des clients IA en cours...");
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "import_ai_clients",
        clients,
        category: elements.aiCategory.value,
        region: elements.aiRegion.value,
      }),
    });
    state.aiImport.clients = [];
    elements.aiRaw.value = "";
    applyDashboard(payload.dashboard || payload);
    renderAiPreview();
    showMessage(payload.message || "Clients importes dans NautiCRM.", "success");
    setActiveView("clients");
  } catch (error) {
    showMessage(error.message || "Import IA impossible.", "error");
  } finally {
    elements.aiImportButton.disabled = state.aiImport.clients.length === 0;
  }
}

function clearAiImport() {
  state.aiImport.clients = [];
  elements.aiRaw.value = "";
  elements.aiSearch.value = "";
  renderAiPreview();
}

function resetClientForm() {
  elements.clientForm.reset();
  elements.clientId.value = "";
  elements.clientType.value = "prospect";
  elements.clientStatus.value = "new";
  elements.clientPriority.value = "normal";
  elements.clientCountry.value = "France";
  elements.clientAssigned.innerHTML = userOptions("", true);
  elements.clientFormTitle.textContent = "Nouveau client";
  elements.clientArchiveButton.classList.add("hidden");
}

function populateClientForm(client) {
  elements.clientId.value = client.id || "";
  elements.clientCompany.value = client.companyName || "";
  elements.clientType.value = client.clientType || "prospect";
  elements.clientStatus.value = client.status || "new";
  elements.clientPriority.value = client.priority || "normal";
  elements.clientAssigned.innerHTML = userOptions(client.assignedUserId || "", true);
  elements.clientSegment.value = client.segment || "";
  elements.clientSource.value = client.source || "";
  elements.clientEmail.value = client.email || "";
  elements.clientPhone.value = client.phone || "";
  elements.clientWebsite.value = client.website || "";
  elements.clientAddress.value = client.address || "";
  elements.clientCity.value = client.city || "";
  elements.clientCountry.value = client.country || "";
  elements.clientSiret.value = client.siret || "";
  elements.clientVat.value = client.vatNumber || "";
  elements.clientNextAction.value = client.nextActionAt || "";
  elements.clientNotes.value = client.notes || "";
  elements.clientFormTitle.textContent = `Modifier ${client.companyName}`;
  elements.clientArchiveButton.classList.toggle("hidden", !client.id || client.status === "archived");
}

function clientFormPayload() {
  return {
    action: "save_client",
    id: Number(elements.clientId.value || 0),
    companyName: elements.clientCompany.value.trim(),
    clientType: elements.clientType.value,
    status: elements.clientStatus.value,
    priority: elements.clientPriority.value,
    assignedUserId: Number(elements.clientAssigned.value || 0),
    segment: elements.clientSegment.value.trim(),
    source: elements.clientSource.value.trim(),
    email: elements.clientEmail.value.trim(),
    phone: elements.clientPhone.value.trim(),
    website: elements.clientWebsite.value.trim(),
    address: elements.clientAddress.value.trim(),
    city: elements.clientCity.value.trim(),
    country: elements.clientCountry.value.trim(),
    siret: elements.clientSiret.value.trim(),
    vatNumber: elements.clientVat.value.trim(),
    nextActionAt: elements.clientNextAction.value,
    notes: elements.clientNotes.value.trim(),
  };
}

async function saveClient(event) {
  event.preventDefault();
  elements.clientSaveButton.disabled = true;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify(clientFormPayload()),
    });
    applySavePayload(payload);
    showMessage(payload.message || "Client enregistre.", "success");
    setActiveView("detail");
  } catch (error) {
    showMessage(error.message || "Enregistrement impossible.", "error");
  } finally {
    elements.clientSaveButton.disabled = false;
  }
}

async function archiveCurrentClient() {
  const clientId = Number(elements.clientId.value || state.selectedBundle?.client?.id || 0);
  if (clientId <= 0) return;
  const ok = window.confirm("Archiver ce client dans NautiCRM ?");
  if (!ok) return;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({ action: "archive_client", id: clientId }),
    });
    state.selectedBundle = null;
    resetClientForm();
    applyDashboard(payload);
    showMessage(payload.message || "Client archive.", "success");
    setActiveView("clients");
  } catch (error) {
    showMessage(error.message || "Archivage impossible.", "error");
  }
}

function renderDetail() {
  const bundle = state.selectedBundle;
  if (!bundle?.client) {
    elements.clientDetailEmpty.classList.remove("hidden");
    elements.clientDetail.classList.add("hidden");
    return;
  }

  elements.clientDetailEmpty.classList.add("hidden");
  elements.clientDetail.classList.remove("hidden");
  renderDetailSummary(bundle.client);
  renderContacts();
  renderInteractions();
  renderClientTasks();
  renderClientOpportunities();
  elements.interactionContact.innerHTML = contactOptions();
}

function renderDetailSummary(client) {
  elements.detailSummary.innerHTML = `
    <div class="detail-title">
      <div>
        <h2>${escapeHtml(client.companyName)}</h2>
        <span class="detail-meta">${escapeHtml([client.email, client.phone, client.city].filter(Boolean).join(" - ") || "Coordonnees non renseignees")}</span>
      </div>
      <button class="ghost-button" data-detail-edit="${client.id}" type="button">Editer</button>
    </div>
    <div class="detail-tags">
      ${badge(labels.clientType[client.clientType] || client.clientType, client.clientType)}
      ${badge(labels.status[client.status] || client.status, client.status)}
      ${badge(labels.priority[client.priority] || client.priority, client.priority === "high" ? "high-priority" : client.priority)}
      ${client.assignedUserDisplayName ? badge(client.assignedUserDisplayName) : ""}
      ${client.prestashopCustomerId ? badge(`PrestaShop #${client.prestashopCustomerId}`, "client") : ""}
    </div>
    <div class="detail-kpis">
      <span>Contacts<strong>${client.contactCount}</strong></span>
      <span>Interactions<strong>${client.interactionCount}</strong></span>
      <span>Taches ouvertes<strong>${client.openTaskCount}</strong></span>
      <span>CA PrestaShop<strong>${money.format(Number(client.prestashopTotalPaidTaxIncl || 0))}</strong></span>
    </div>
    ${client.notes ? `<p class="detail-meta">${escapeHtml(client.notes)}</p>` : ""}
  `;
}

function renderContacts() {
  const contacts = state.selectedBundle?.contacts || [];
  if (contacts.length === 0) {
    elements.contactsList.innerHTML = '<div class="empty-state">Aucun contact.</div>';
    return;
  }
  elements.contactsList.innerHTML = contacts.map((contact) => `
    <article class="list-card">
      <strong>${escapeHtml(contact.name || contact.email || "Contact")}</strong>
      <small>${escapeHtml([contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(" - ") || "Coordonnees non renseignees")}</small>
      <div class="card-tags">${contact.isPrimary ? badge("Principal", "client") : ""}</div>
      <div class="card-actions">
        <button class="ghost-button" data-contact-edit="${contact.id}" type="button">Editer</button>
      </div>
    </article>
  `).join("");
}

function populateContactForm(contact) {
  elements.contactId.value = contact.id || "";
  elements.contactFirstName.value = contact.firstName || "";
  elements.contactLastName.value = contact.lastName || "";
  elements.contactJobTitle.value = contact.jobTitle || "";
  elements.contactEmail.value = contact.email || "";
  elements.contactPhone.value = contact.phone || "";
  elements.contactPrimary.checked = Boolean(contact.isPrimary);
}

function resetContactForm() {
  elements.contactForm.reset();
  elements.contactId.value = "";
}

async function saveContact(event) {
  event.preventDefault();
  const clientId = state.selectedBundle?.client?.id || 0;
  if (!clientId) return;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "save_contact",
        id: Number(elements.contactId.value || 0),
        clientId,
        firstName: elements.contactFirstName.value.trim(),
        lastName: elements.contactLastName.value.trim(),
        jobTitle: elements.contactJobTitle.value.trim(),
        email: elements.contactEmail.value.trim(),
        phone: elements.contactPhone.value.trim(),
        isPrimary: elements.contactPrimary.checked,
      }),
    });
    applySavePayload(payload);
    resetContactForm();
    showMessage(payload.message || "Contact enregistre.", "success");
  } catch (error) {
    showMessage(error.message || "Contact impossible.", "error");
  }
}

function renderInteractions() {
  const interactions = state.selectedBundle?.interactions || [];
  if (interactions.length === 0) {
    elements.interactionsList.innerHTML = '<div class="empty-state">Aucune interaction.</div>';
    return;
  }
  elements.interactionsList.innerHTML = interactions.map((item) => `
    <article class="list-card">
      <strong>${escapeHtml(item.subject)}</strong>
      <small>${escapeHtml(labels.interactionType[item.interactionType] || item.interactionType)} - ${escapeHtml(formatDateTime(item.occurredAt))}${item.userDisplayName ? ` - ${escapeHtml(item.userDisplayName)}` : ""}</small>
      ${item.body ? `<small>${escapeHtml(item.body)}</small>` : ""}
      <div class="card-tags">${item.nextActionAt ? badge(`Relance ${formatDate(item.nextActionAt)}`, "follow_up") : ""}</div>
    </article>
  `).join("");
}

function resetInteractionForm() {
  elements.interactionForm.reset();
  elements.interactionContact.innerHTML = contactOptions();
}

async function logInteraction(event) {
  event.preventDefault();
  const clientId = state.selectedBundle?.client?.id || 0;
  if (!clientId) return;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "log_interaction",
        clientId,
        contactId: Number(elements.interactionContact.value || 0),
        interactionType: elements.interactionType.value,
        subject: elements.interactionSubject.value.trim(),
        occurredAt: elements.interactionDate.value,
        nextActionAt: elements.interactionNextAction.value,
        body: elements.interactionBody.value.trim(),
      }),
    });
    applySavePayload(payload);
    resetInteractionForm();
    showMessage(payload.message || "Interaction ajoutee.", "success");
  } catch (error) {
    showMessage(error.message || "Interaction impossible.", "error");
  }
}

function renderClientTasks() {
  const tasks = state.selectedBundle?.tasks || [];
  if (tasks.length === 0) {
    elements.clientTasksList.innerHTML = '<div class="empty-state">Aucune tache.</div>';
    return;
  }
  elements.clientTasksList.innerHTML = tasks.map((task) => taskCard(task, true)).join("");
}

function taskCard(task, editable = false) {
  return `
    <article class="list-card">
      <strong>${escapeHtml(task.title)}</strong>
      <small>${escapeHtml(labels.taskStatus[task.status] || task.status)}${task.dueAt ? ` - ${escapeHtml(formatDate(task.dueAt))}` : ""}${task.assignedUserDisplayName ? ` - ${escapeHtml(task.assignedUserDisplayName)}` : ""}</small>
      ${task.notes ? `<small>${escapeHtml(task.notes)}</small>` : ""}
      <div class="card-tags">
        ${badge(labels.priority[task.priority] || task.priority, task.priority === "high" ? "high-priority" : task.priority)}
        ${task.clientName ? badge(task.clientName) : ""}
      </div>
      <div class="card-actions">
        ${editable ? `<button class="ghost-button" data-task-edit="${task.id}" type="button">Editer</button>` : `<button class="ghost-button" data-client-open="${task.clientId || ""}" type="button">Client</button>`}
        ${task.status !== "done" && task.status !== "cancelled" ? `<button class="ghost-button" data-task-done="${task.id}" type="button">Terminer</button>` : ""}
      </div>
    </article>
  `;
}

function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskId.value = "";
  elements.taskStatus.value = "todo";
  elements.taskPriority.value = "normal";
  elements.taskAssigned.innerHTML = userOptions(state.user?.id || "", true);
}

function populateTaskForm(task) {
  elements.taskId.value = task.id || "";
  elements.taskTitle.value = task.title || "";
  elements.taskStatus.value = task.status || "todo";
  elements.taskPriority.value = task.priority || "normal";
  elements.taskDue.value = task.dueAt || "";
  elements.taskAssigned.innerHTML = userOptions(task.assignedUserId || "", true);
  elements.taskNotes.value = task.notes || "";
}

async function saveTask(event) {
  event.preventDefault();
  const clientId = state.selectedBundle?.client?.id || 0;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "save_task",
        id: Number(elements.taskId.value || 0),
        clientId,
        title: elements.taskTitle.value.trim(),
        status: elements.taskStatus.value,
        priority: elements.taskPriority.value,
        dueAt: elements.taskDue.value,
        assignedUserId: Number(elements.taskAssigned.value || 0),
        notes: elements.taskNotes.value.trim(),
      }),
    });
    applySavePayload(payload);
    resetTaskForm();
    showMessage(payload.message || "Tache enregistree.", "success");
  } catch (error) {
    showMessage(error.message || "Tache impossible.", "error");
  }
}

function findTask(taskId) {
  const id = Number(taskId);
  return [
    ...(state.selectedBundle?.tasks || []),
    ...state.tasks,
  ].find((task) => Number(task.id) === id) || null;
}

async function completeTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "save_task",
        id: task.id,
        clientId: task.clientId || 0,
        title: task.title,
        status: "done",
        priority: task.priority,
        dueAt: task.dueAt,
        assignedUserId: task.assignedUserId || 0,
        notes: task.notes || "",
      }),
    });
    applySavePayload(payload);
    showMessage(payload.message || "Tache terminee.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour impossible.", "error");
  }
}

function renderClientOpportunities() {
  const opportunities = state.selectedBundle?.opportunities || [];
  if (opportunities.length === 0) {
    elements.clientOpportunitiesList.innerHTML = '<div class="empty-state">Aucune opportunite.</div>';
    return;
  }
  elements.clientOpportunitiesList.innerHTML = opportunities.map((item) => opportunityCard(item, true)).join("");
}

function opportunityCard(item, editable = false) {
  return `
    <article class="list-card">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(labels.stage[item.stage] || item.stage)} - ${money.format(Number(item.amountTaxExcl || 0))} - ${Number(item.probability || 0)}%</small>
      <small>${item.expectedCloseAt ? `Cloture ${escapeHtml(formatDate(item.expectedCloseAt))}` : ""}${item.clientName ? ` ${escapeHtml(item.clientName)}` : ""}</small>
      ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
      <div class="card-actions">
        ${editable ? `<button class="ghost-button" data-opportunity-edit="${item.id}" type="button">Editer</button>` : `<button class="ghost-button" data-client-open="${item.clientId}" type="button">Client</button>`}
      </div>
    </article>
  `;
}

function resetOpportunityForm() {
  elements.opportunityForm.reset();
  elements.opportunityId.value = "";
  elements.opportunityStage.value = "lead";
  elements.opportunityProbability.value = "20";
}

function populateOpportunityForm(item) {
  elements.opportunityId.value = item.id || "";
  elements.opportunityTitle.value = item.title || "";
  elements.opportunityStage.value = item.stage || "lead";
  elements.opportunityAmount.value = item.amountTaxExcl || "";
  elements.opportunityProbability.value = item.probability || 20;
  elements.opportunityClose.value = item.expectedCloseAt || "";
  elements.opportunityNotes.value = item.notes || "";
}

async function saveOpportunity(event) {
  event.preventDefault();
  const clientId = state.selectedBundle?.client?.id || 0;
  if (!clientId) return;
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({
        action: "save_opportunity",
        id: Number(elements.opportunityId.value || 0),
        clientId,
        title: elements.opportunityTitle.value.trim(),
        stage: elements.opportunityStage.value,
        amountTaxExcl: Number(elements.opportunityAmount.value || 0),
        probability: Number(elements.opportunityProbability.value || 0),
        expectedCloseAt: elements.opportunityClose.value,
        notes: elements.opportunityNotes.value.trim(),
      }),
    });
    applySavePayload(payload);
    resetOpportunityForm();
    showMessage(payload.message || "Opportunite enregistree.", "success");
  } catch (error) {
    showMessage(error.message || "Opportunite impossible.", "error");
  }
}

function renderGlobalTasks() {
  if (state.tasks.length === 0) {
    elements.tasksList.innerHTML = '<div class="empty-state">Aucune tache ouverte.</div>';
    return;
  }
  elements.tasksList.innerHTML = state.tasks.map((task) => taskCard(task, false).replace("list-card", "board-card")).join("");
}

function renderGlobalOpportunities() {
  if (state.opportunities.length === 0) {
    elements.opportunitiesList.innerHTML = '<div class="empty-state">Aucune opportunite.</div>';
    return;
  }
  elements.opportunitiesList.innerHTML = state.opportunities.map((item) => opportunityCard(item, false).replace("list-card", "board-card")).join("");
}

function renderActivity() {
  if (state.recentInteractions.length === 0) {
    elements.activityList.innerHTML = '<div class="empty-state">Aucune interaction.</div>';
    return;
  }
  elements.activityList.innerHTML = state.recentInteractions.map((item) => `
    <article class="board-card">
      <strong>${escapeHtml(item.subject)}</strong>
      <small>${escapeHtml(item.clientName)} - ${escapeHtml(labels.interactionType[item.interactionType] || item.interactionType)} - ${escapeHtml(formatDateTime(item.occurredAt))}</small>
      ${item.body ? `<small>${escapeHtml(item.body)}</small>` : ""}
      <div class="card-actions">
        <button class="ghost-button" data-client-open="${item.clientId}" type="button">Client</button>
      </div>
    </article>
  `).join("");
}

async function logout() {
  try {
    await apiRequest(API.auth, { method: "DELETE" });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

async function syncPrestashopCustomers() {
  elements.syncPrestashopButton.disabled = true;
  showMessage("Synchronisation des clients PrestaShop en cours...");
  try {
    const payload = await apiRequest(API.clients, {
      method: "POST",
      body: JSON.stringify({ action: "sync_prestashop", limit: 500 }),
    });
    applyDashboard(payload);
    const summary = payload.syncSummary || {};
    showMessage(
      payload.message || `${summary.customersSeen || 0} client(s) PrestaShop synchronise(s).`,
      "success"
    );
  } catch (error) {
    showMessage(error.message || "Synchronisation PrestaShop impossible.", "error");
  } finally {
    renderChrome();
  }
}

function installListeners() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view || "clients"));
  });

  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard()
      .then(() => showMessage("Donnees actualisees.", "success"))
      .catch((error) => showMessage(error.message, "error"));
  });
  elements.syncPrestashopButton.addEventListener("click", () => { void syncPrestashopCustomers(); });
  elements.newClientButton.addEventListener("click", () => {
    resetClientForm();
    setActiveView("clients");
    elements.clientCompany.focus();
  });
  elements.logoutButton.addEventListener("click", () => { void logout(); });
  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadDashboard().catch((error) => showMessage(error.message, "error"));
  });
  elements.aiCleanButton.addEventListener("click", () => { void cleanAiImport(); });
  elements.aiCsvButton.addEventListener("click", () => elements.aiCsvFile.click());
  elements.aiCsvFile.addEventListener("change", () => { void handleAiCsvFile(); });
  elements.aiSearch.addEventListener("input", renderAiPreview);
  elements.aiImportButton.addEventListener("click", () => { void importAiClients(); });
  elements.aiClearButton.addEventListener("click", clearAiImport);
  elements.clientForm.addEventListener("submit", saveClient);
  elements.clientResetButton.addEventListener("click", resetClientForm);
  elements.clientArchiveButton.addEventListener("click", () => { void archiveCurrentClient(); });
  elements.contactForm.addEventListener("submit", saveContact);
  elements.interactionForm.addEventListener("submit", logInteraction);
  elements.taskForm.addEventListener("submit", saveTask);
  elements.opportunityForm.addEventListener("submit", saveOpportunity);

  elements.clientsBody.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-client-open]");
    const editButton = event.target.closest("[data-client-edit]");
    if (openButton) {
      void loadClient(openButton.dataset.clientOpen);
    }
    if (editButton) {
      const client = state.clients.find((item) => Number(item.id) === Number(editButton.dataset.clientEdit));
      if (client) populateClientForm(client);
    }
  });

  document.addEventListener("click", (event) => {
    const detailEdit = event.target.closest("[data-detail-edit]");
    if (detailEdit && state.selectedBundle?.client) {
      populateClientForm(state.selectedBundle.client);
      setActiveView("clients");
    }

    const clientOpen = event.target.closest("[data-client-open]");
    if (clientOpen && clientOpen.dataset.clientOpen) {
      void loadClient(clientOpen.dataset.clientOpen);
    }

    const contactEdit = event.target.closest("[data-contact-edit]");
    if (contactEdit) {
      const contact = (state.selectedBundle?.contacts || []).find((item) => Number(item.id) === Number(contactEdit.dataset.contactEdit));
      if (contact) populateContactForm(contact);
    }

    const taskEdit = event.target.closest("[data-task-edit]");
    if (taskEdit) {
      const task = findTask(taskEdit.dataset.taskEdit);
      if (task) populateTaskForm(task);
    }

    const taskDone = event.target.closest("[data-task-done]");
    if (taskDone) {
      void completeTask(taskDone.dataset.taskDone);
    }

    const aiRemove = event.target.closest("[data-ai-remove]");
    if (aiRemove) {
      const index = Number(aiRemove.dataset.aiRemove);
      if (Number.isInteger(index) && index >= 0) {
        state.aiImport.clients.splice(index, 1);
        renderAiPreview();
      }
    }

    const opportunityEdit = event.target.closest("[data-opportunity-edit]");
    if (opportunityEdit) {
      const opportunity = (state.selectedBundle?.opportunities || []).find((item) => Number(item.id) === Number(opportunityEdit.dataset.opportunityEdit));
      if (opportunity) populateOpportunityForm(opportunity);
    }
  });
}

async function init() {
  installListeners();
  try {
    const authenticated = await fetchAuth();
    if (!authenticated) return;
    resetClientForm();
    resetTaskForm();
    await loadDashboard();
    setView("app");
  } catch (error) {
    showMessage(error.message || "NautiCRM est indisponible.", "error");
    setView("app");
  }
}

void init();
