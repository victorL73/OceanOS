const API = {
  auth: "api/auth.php",
  prospects: "api/prospects.php",
};

const OCEANOS_URL = "/OceanOS/";
const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  mailChip: $("mail-chip"),
  aiChip: $("ai-chip"),
  currentUser: $("current-user"),
  newProspectButton: $("new-prospect-button"),
  refreshButton: $("refresh-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricProspects: $("metric-prospects"),
  metricContacted: $("metric-contacted"),
  metricFollowups: $("metric-followups"),
  metricReplies: $("metric-replies"),
  metricPositive: $("metric-positive"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  filtersForm: $("filters-form"),
  filterSearch: $("filter-search"),
  filterStatus: $("filter-status"),
  prospectsBody: $("prospects-body"),
  prospectForm: $("prospect-form"),
  prospectFormTitle: $("prospect-form-title"),
  prospectId: $("prospect-id"),
  prospectCompany: $("prospect-company"),
  prospectFirstName: $("prospect-first-name"),
  prospectLastName: $("prospect-last-name"),
  prospectJobTitle: $("prospect-job-title"),
  prospectEmail: $("prospect-email"),
  prospectPhone: $("prospect-phone"),
  prospectWebsite: $("prospect-website"),
  prospectAddress: $("prospect-address"),
  prospectCity: $("prospect-city"),
  prospectCountry: $("prospect-country"),
  prospectSegment: $("prospect-segment"),
  prospectSource: $("prospect-source"),
  prospectStatus: $("prospect-status"),
  prospectPriority: $("prospect-priority"),
  prospectAssigned: $("prospect-assigned"),
  prospectNextAction: $("prospect-next-action"),
  prospectSiret: $("prospect-siret"),
  prospectVat: $("prospect-vat"),
  prospectSourceUrls: $("prospect-source-urls"),
  prospectNotes: $("prospect-notes"),
  prospectArchiveButton: $("prospect-archive-button"),
  prospectResetButton: $("prospect-reset-button"),
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
  prospectDetailEmpty: $("prospect-detail-empty"),
  prospectDetail: $("prospect-detail"),
  detailSummary: $("detail-summary"),
  mailForm: $("mail-form"),
  mailAccount: $("mail-account"),
  mailTemplate: $("mail-template"),
  mailSubject: $("mail-subject"),
  mailBody: $("mail-body"),
  mailPreviewButton: $("mail-preview-button"),
  mailSendButton: $("mail-send-button"),
  mailHistory: $("mail-history"),
  taskForm: $("task-form"),
  taskId: $("task-id"),
  taskTitle: $("task-title"),
  taskStatus: $("task-status"),
  taskPriority: $("task-priority"),
  taskDue: $("task-due"),
  taskAssigned: $("task-assigned"),
  taskNotes: $("task-notes"),
  prospectTasksList: $("prospect-tasks-list"),
  interactionForm: $("interaction-form"),
  interactionType: $("interaction-type"),
  interactionDate: $("interaction-date"),
  interactionSubject: $("interaction-subject"),
  interactionNextAction: $("interaction-next-action"),
  interactionBody: $("interaction-body"),
  interactionsList: $("interactions-list"),
  templatesList: $("templates-list"),
  templateForm: $("template-form"),
  templateFormTitle: $("template-form-title"),
  templateId: $("template-id"),
  templateName: $("template-name"),
  templateSubject: $("template-subject"),
  templateBody: $("template-body"),
  templateDefault: $("template-default"),
  templateResetButton: $("template-reset-button"),
  templateDeleteButton: $("template-delete-button"),
  tasksList: $("tasks-list"),
  activityList: $("activity-list"),
};

const state = {
  user: null,
  aiSettings: null,
  stats: {},
  prospects: [],
  users: [],
  templates: [],
  mailAccounts: [],
  tasks: [],
  recentInteractions: [],
  selectedBundle: null,
  currentView: "prospects",
  aiImport: {
    prospects: [],
    sources: [],
  },
};

const labels = {
  status: {
    new: "Nouveau",
    qualified: "Qualifie",
    contacted: "Contacte",
    replied: "Reponse",
    positive: "Positif",
    converted: "Transfere CRM",
    lost: "Perdu",
    archived: "Archive",
  },
  priority: {
    low: "Basse",
    normal: "Normale",
    high: "Haute",
  },
  taskStatus: {
    todo: "A faire",
    doing: "En cours",
    done: "Terminee",
    cancelled: "Annulee",
  },
  interactionType: {
    note: "Note",
    call: "Appel",
    email: "Email",
    reply: "Reponse",
    meeting: "Rendez-vous",
    positive: "Positif",
    transfer: "Transfert CRM",
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
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
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

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function setActiveView(view) {
  state.currentView = view || "prospects";
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
  if (elements.filterStatus.value) params.set("status", elements.filterStatus.value);
  return params;
}

async function loadDashboard() {
  const query = queryFromFilters();
  const payload = await apiRequest(`${API.prospects}?${query.toString()}`);
  applyDashboard(payload);
}

async function loadProspect(prospectId, activate = true) {
  const payload = await apiRequest(`${API.prospects}?action=prospect&id=${encodeURIComponent(prospectId)}`);
  state.selectedBundle = payload.bundle || null;
  if (state.selectedBundle?.prospect) {
    populateProspectForm(state.selectedBundle.prospect);
  }
  renderDetail();
  fillMailDraftFromTemplate();
  if (activate) setActiveView("detail");
}

function applyDashboard(payload) {
  state.user = payload.user || state.user;
  state.aiSettings = payload.aiSettings || null;
  state.stats = payload.stats || {};
  state.prospects = payload.prospects || [];
  state.users = payload.users || [];
  state.templates = payload.templates || [];
  state.mailAccounts = payload.mailAccounts || [];
  state.tasks = payload.tasks || [];
  state.recentInteractions = payload.recentInteractions || [];
  render();
}

function applySavePayload(payload) {
  if (payload.bundle) {
    state.selectedBundle = payload.bundle;
    if (state.selectedBundle.prospect) populateProspectForm(state.selectedBundle.prospect);
  }
  if (payload.dashboard) {
    applyDashboard(payload.dashboard);
  } else {
    applyDashboard(payload);
  }
  renderDetail();
}

function userLabel(user) {
  return user?.displayName || user?.email || "Utilisateur";
}

function userOptions(selectedId = null, includeEmpty = true) {
  const options = includeEmpty ? ['<option value="">Non assigne</option>'] : [];
  state.users.forEach((user) => {
    const selected = Number(selectedId || 0) === Number(user.id) ? " selected" : "";
    options.push(`<option value="${user.id}"${selected}>${escapeHtml(userLabel(user))}</option>`);
  });
  return options.join("");
}

function accountOptions(selectedId = null) {
  if (state.mailAccounts.length === 0) return '<option value="">Aucune adresse NautiMail</option>';
  return state.mailAccounts.map((account) => {
    const label = account.label || account.emailAddress || "Adresse";
    const primary = account.isPrimaryForUser ? " - principale" : "";
    const ready = account.smtpReady ? "" : " - SMTP indisponible";
    const selected = Number(selectedId || 0) === Number(account.id) ? " selected" : "";
    const disabled = account.smtpReady ? "" : " disabled";
    return `<option value="${account.id}"${selected}${disabled}>${escapeHtml(label + primary + ready)}</option>`;
  }).join("");
}

function defaultAccountId() {
  const primary = state.mailAccounts.find((account) => account.isPrimaryForUser && account.smtpReady);
  const firstReady = state.mailAccounts.find((account) => account.smtpReady);
  return Number((primary || firstReady || {}).id || 0);
}

function templateOptions(selectedId = null) {
  if (state.templates.length === 0) return '<option value="">Aucun template</option>';
  return state.templates.map((template) => {
    const selected = Number(selectedId || 0) === Number(template.id) ? " selected" : "";
    const marker = template.isDefault ? " - defaut" : "";
    return `<option value="${template.id}"${selected}>${escapeHtml(template.name + marker)}</option>`;
  }).join("");
}

function defaultTemplateId() {
  const selected = state.templates.find((template) => template.isDefault) || state.templates[0];
  return Number(selected?.id || 0);
}

function badge(value, type = "") {
  const className = `${type || value}`.replace(/[^a-z0-9_-]/gi, "");
  return `<span class="mini-pill ${className}">${escapeHtml(value)}</span>`;
}

function render() {
  renderChrome();
  renderMetrics();
  renderUsersInForms();
  renderProspects();
  renderAiPreview();
  renderDetail();
  renderTemplates();
  renderGlobalTasks();
  renderActivity();
  setActiveView(state.currentView);
}

function renderChrome() {
  const user = state.user || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  const readyCount = state.mailAccounts.filter((account) => account.smtpReady).length;
  elements.mailChip.textContent = readyCount > 0 ? `${readyCount} adresse(s) NautiMail` : "NautiMail a configurer";
  elements.mailChip.className = readyCount > 0 ? "status-pill success-pill" : "status-pill muted-pill";
  elements.aiChip.textContent = state.aiSettings?.hasApiKey ? "IA active" : "IA non configuree";
  elements.aiChip.className = state.aiSettings?.hasApiKey ? "status-pill success-pill" : "status-pill muted-pill";
}

function renderMetrics() {
  const stats = state.stats || {};
  elements.metricProspects.textContent = String(stats.prospectCount || 0);
  elements.metricContacted.textContent = String(stats.contactedCount || 0);
  elements.metricFollowups.textContent = String(stats.dueFollowupCount || 0);
  elements.metricReplies.textContent = String(stats.replyCount || 0);
  elements.metricPositive.textContent = String(stats.positiveCount || 0);
}

function renderUsersInForms() {
  const selectedProspectUser = elements.prospectAssigned.value || state.selectedBundle?.prospect?.assignedUserId || "";
  const selectedTaskUser = elements.taskAssigned.value || state.user?.id || "";
  elements.prospectAssigned.innerHTML = userOptions(selectedProspectUser, true);
  elements.taskAssigned.innerHTML = userOptions(selectedTaskUser, true);
}

function renderProspects() {
  if (state.prospects.length === 0) {
    elements.prospectsBody.innerHTML = '<tr><td colspan="6" class="empty-state">Aucun prospect.</td></tr>';
    return;
  }

  elements.prospectsBody.innerHTML = state.prospects.map((prospect) => {
    const contact = [prospect.contactName, prospect.email || prospect.phone].filter(Boolean).join(" - ");
    return `
      <tr data-prospect-row="${prospect.id}">
        <td class="client-name-cell">
          <strong>${escapeHtml(prospect.companyName)}</strong>
          <span class="table-meta">${escapeHtml([prospect.segment, prospect.source, prospect.city].filter(Boolean).join(" - ") || "Sans segment")}</span>
        </td>
        <td>
          ${badge(labels.status[prospect.status] || prospect.status, prospect.status)}
          <span class="table-meta">${escapeHtml(labels.priority[prospect.priority] || prospect.priority)}${prospect.assignedUserDisplayName ? ` - ${escapeHtml(prospect.assignedUserDisplayName)}` : ""}</span>
        </td>
        <td>
          <span>${escapeHtml(contact || "-")}</span>
          <span class="table-meta">${escapeHtml(prospect.website || "")}</span>
        </td>
        <td>
          <span>${prospect.nextActionAt ? escapeHtml(formatDate(prospect.nextActionAt)) : "-"}</span>
          <span class="table-meta">${prospect.openTaskCount} tache(s)</span>
        </td>
        <td>
          <span>${prospect.sentCount || 0} envoye(s)</span>
          <span class="table-meta">${prospect.replyCount || 0} reponse(s)${prospect.lastReplyAt ? ` - ${escapeHtml(formatDateTime(prospect.lastReplyAt))}` : ""}</span>
        </td>
        <td>
          <div class="card-actions">
            <button class="ghost-button" data-prospect-open="${prospect.id}" type="button">Ouvrir</button>
            <button class="ghost-button" data-prospect-edit="${prospect.id}" type="button">Editer</button>
            ${prospect.email ? `<button class="ghost-button" data-prospect-email="${prospect.id}" type="button">Email</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function sourceUrlsText(prospect) {
  return (prospect?.sourceUrls || []).join("\n");
}

function populateProspectForm(prospect) {
  elements.prospectId.value = prospect.id || "";
  elements.prospectFormTitle.textContent = prospect.id ? "Prospect" : "Nouveau prospect";
  elements.prospectCompany.value = prospect.companyName || "";
  elements.prospectFirstName.value = prospect.contactFirstName || "";
  elements.prospectLastName.value = prospect.contactLastName || "";
  elements.prospectJobTitle.value = prospect.jobTitle || "";
  elements.prospectEmail.value = prospect.email || "";
  elements.prospectPhone.value = prospect.phone || "";
  elements.prospectWebsite.value = prospect.website || "";
  elements.prospectAddress.value = prospect.address || "";
  elements.prospectCity.value = prospect.city || "";
  elements.prospectCountry.value = prospect.country || "France";
  elements.prospectSegment.value = prospect.segment || "";
  elements.prospectSource.value = prospect.source || "";
  elements.prospectStatus.value = prospect.status || "new";
  elements.prospectPriority.value = prospect.priority || "normal";
  elements.prospectAssigned.innerHTML = userOptions(prospect.assignedUserId || "", true);
  elements.prospectNextAction.value = prospect.nextActionAt || "";
  elements.prospectSiret.value = prospect.siret || "";
  elements.prospectVat.value = prospect.vatNumber || "";
  elements.prospectSourceUrls.value = sourceUrlsText(prospect);
  elements.prospectNotes.value = prospect.notes || "";
  elements.prospectArchiveButton.classList.toggle("hidden", !prospect.id || prospect.status === "archived");
}

function resetProspectForm() {
  elements.prospectForm.reset();
  elements.prospectId.value = "";
  elements.prospectFormTitle.textContent = "Nouveau prospect";
  elements.prospectCountry.value = "France";
  elements.prospectStatus.value = "new";
  elements.prospectPriority.value = "normal";
  elements.prospectAssigned.innerHTML = userOptions("", true);
  elements.prospectArchiveButton.classList.add("hidden");
}

async function saveProspect(event) {
  event.preventDefault();
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "save_prospect",
        id: Number(elements.prospectId.value || 0),
        companyName: elements.prospectCompany.value.trim(),
        contactFirstName: elements.prospectFirstName.value.trim(),
        contactLastName: elements.prospectLastName.value.trim(),
        jobTitle: elements.prospectJobTitle.value.trim(),
        email: elements.prospectEmail.value.trim(),
        phone: elements.prospectPhone.value.trim(),
        website: elements.prospectWebsite.value.trim(),
        address: elements.prospectAddress.value.trim(),
        city: elements.prospectCity.value.trim(),
        country: elements.prospectCountry.value.trim(),
        segment: elements.prospectSegment.value.trim(),
        source: elements.prospectSource.value.trim(),
        status: elements.prospectStatus.value,
        priority: elements.prospectPriority.value,
        assignedUserId: Number(elements.prospectAssigned.value || 0),
        nextActionAt: elements.prospectNextAction.value,
        siret: elements.prospectSiret.value.trim(),
        vatNumber: elements.prospectVat.value.trim(),
        sourceUrls: elements.prospectSourceUrls.value,
        notes: elements.prospectNotes.value.trim(),
      }),
    });
    applySavePayload(payload);
    showMessage(payload.message || "Prospect enregistre.", "success");
  } catch (error) {
    showMessage(error.message || "Enregistrement impossible.", "error");
  }
}

async function archiveCurrentProspect() {
  const prospectId = Number(state.selectedBundle?.prospect?.id || elements.prospectId.value || 0);
  if (prospectId <= 0) return;
  const ok = window.confirm("Archiver ce prospect ?");
  if (!ok) return;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({ action: "archive_prospect", id: prospectId }),
    });
    state.selectedBundle = null;
    resetProspectForm();
    applyDashboard(payload);
    showMessage(payload.message || "Prospect archive.", "success");
    setActiveView("prospects");
  } catch (error) {
    showMessage(error.message || "Archivage impossible.", "error");
  }
}

function aiSearchText(prospect) {
  return [
    prospect.companyName,
    prospect.firstName,
    prospect.lastName,
    prospect.email,
    prospect.phone,
    prospect.website,
    prospect.city,
    prospect.country,
    prospect.segment,
    prospect.source,
    prospect.address,
    prospect.siret,
    prospect.vatNumber,
    prospect.notes,
    ...(prospect.sourceUrls || []),
  ].join(" ").toLowerCase();
}

function filteredAiProspects() {
  const search = (elements.aiSearch?.value || "").trim().toLowerCase();
  const prospects = state.aiImport.prospects || [];
  if (search === "") return prospects;
  return prospects.filter((prospect) => aiSearchText(prospect).includes(search));
}

function urlHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return url;
  }
}

function renderAiPreview() {
  const prospects = filteredAiProspects();
  const total = state.aiImport.prospects.length;
  const sourcePages = Array.isArray(state.aiImport.sources) ? state.aiImport.sources.filter((source) => source?.url) : [];
  elements.aiCount.textContent = `${total} prospect${total > 1 ? "s" : ""}`;
  elements.aiImportButton.disabled = total === 0;

  if (total === 0) {
    elements.aiPreview.innerHTML = '<div class="empty-state">Collez une liste de prospects puis lancez le nettoyage IA.</div>';
    return;
  }
  if (prospects.length === 0) {
    elements.aiPreview.innerHTML = '<div class="empty-state">Aucun prospect ne correspond a la recherche.</div>';
    return;
  }

  const sourceSummary = sourcePages.length ? `
    <section class="ai-sources-summary">
      <div>
        <strong>${sourcePages.length} source${sourcePages.length > 1 ? "s" : ""} web analysee${sourcePages.length > 1 ? "s" : ""}</strong>
        <small>Les fiches ci-dessous reprennent les informations publiques qui correspondent au nom et au lieu.</small>
      </div>
      <div class="ai-source-list">
        ${sourcePages.slice(0, 10).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || urlHost(source.url))}</a>`).join("")}
      </div>
    </section>
  ` : "";

  elements.aiPreview.innerHTML = sourceSummary + prospects.map((prospect) => {
    const originalIndex = state.aiImport.prospects.indexOf(prospect);
    const name = prospect.companyName || [prospect.firstName, prospect.lastName].filter(Boolean).join(" ") || prospect.email || "Prospect IA";
    const contact = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ");
    const segment = [prospect.segment, prospect.source].filter(Boolean).join(" - ");
    const place = [prospect.address, prospect.city, prospect.country].filter(Boolean).join(" - ");
    const identifiers = [prospect.siret ? `SIRET ${prospect.siret}` : "", prospect.vatNumber ? `TVA ${prospect.vatNumber}` : ""].filter(Boolean).join(" - ");
    const sources = Array.isArray(prospect.sourceUrls) ? prospect.sourceUrls.filter(Boolean).slice(0, 4) : [];
    return `
      <article class="ai-preview-card">
        <div class="ai-preview-title">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <small class="detail-meta">${escapeHtml(contact || prospect.email || prospect.phone || "Contact a completer")}</small>
          </div>
          <button class="ghost-button danger-text" data-ai-remove="${originalIndex}" type="button">Retirer</button>
        </div>
        <div class="ai-preview-meta">
          <span>${escapeHtml(prospect.email || "-")}<br>${escapeHtml(prospect.phone || "")}</span>
          <span>${escapeHtml(prospect.website || "-")}<br>${escapeHtml(place || "")}</span>
          <span>${escapeHtml(segment || "Import IA")}<br>${escapeHtml(identifiers || "")}</span>
        </div>
        ${prospect.notes ? `<p class="ai-preview-notes">${escapeHtml(prospect.notes)}</p>` : ""}
        ${sources.length ? `<div class="ai-source-list">${sources.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urlHost(url))}</a>`).join("")}</div>` : ""}
      </article>
    `;
  }).join("");
}

async function cleanAiImport() {
  const rawData = elements.aiRaw.value.trim();
  if (rawData === "") {
    showMessage("Collez des donnees prospect avant de lancer l IA.", "error");
    return;
  }

  elements.aiCleanButton.disabled = true;
  showMessage("Recherche web et enrichissement IA en cours...");
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "ai_clean_import",
        rawData,
        category: elements.aiCategory.value,
        region: elements.aiRegion.value,
      }),
    });
    state.aiImport.prospects = payload.prospects || [];
    state.aiImport.sources = payload.sources || [];
    renderAiPreview();
    showMessage(payload.message || `${state.aiImport.prospects.length} prospect(s) prepare(s).`, "success");
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
    state.aiImport.prospects = [];
    state.aiImport.sources = [];
    renderAiPreview();
    showMessage("CSV charge. Lancez le nettoyage IA pour preparer les prospects.", "success");
  } catch (error) {
    showMessage(error.message || "Import CSV impossible.", "error");
  } finally {
    elements.aiCsvFile.value = "";
  }
}

async function importAiProspects() {
  const prospects = state.aiImport.prospects || [];
  if (prospects.length === 0) return;

  elements.aiImportButton.disabled = true;
  showMessage("Import des prospects IA en cours...");
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "import_ai_prospects",
        prospects,
        category: elements.aiCategory.value,
        region: elements.aiRegion.value,
      }),
    });
    state.aiImport.prospects = [];
    state.aiImport.sources = [];
    elements.aiRaw.value = "";
    applyDashboard(payload.dashboard || payload);
    renderAiPreview();
    showMessage(payload.message || "Prospects importes.", "success");
    setActiveView("prospects");
  } catch (error) {
    showMessage(error.message || "Import impossible.", "error");
  } finally {
    elements.aiImportButton.disabled = false;
  }
}

function clearAiImport() {
  state.aiImport.prospects = [];
  state.aiImport.sources = [];
  elements.aiRaw.value = "";
  renderAiPreview();
}

function selectedProspect() {
  return state.selectedBundle?.prospect || null;
}

function renderDetail() {
  const bundle = state.selectedBundle;
  if (!bundle?.prospect) {
    elements.prospectDetailEmpty.classList.remove("hidden");
    elements.prospectDetail.classList.add("hidden");
    return;
  }

  elements.prospectDetailEmpty.classList.add("hidden");
  elements.prospectDetail.classList.remove("hidden");
  renderDetailSummary(bundle.prospect);
  renderMailTools();
  renderMailHistory();
  renderProspectTasks();
  renderInteractions();
}

function renderDetailSummary(prospect) {
  const canTransfer = prospect.status === "positive" || prospect.status === "replied" || prospect.status === "converted";
  elements.detailSummary.innerHTML = `
    <div class="detail-title">
      <div>
        <h2>${escapeHtml(prospect.companyName)}</h2>
        <span class="detail-meta">${escapeHtml([prospect.contactName, prospect.email, prospect.phone, prospect.city].filter(Boolean).join(" - ") || "Coordonnees non renseignees")}</span>
      </div>
      <div class="card-actions">
        <button class="ghost-button" data-detail-edit="${prospect.id}" type="button">Editer</button>
        ${prospect.status !== "positive" && prospect.status !== "converted" ? `<button class="ghost-button" data-prospect-positive="${prospect.id}" type="button">Reponse positive</button>` : ""}
        ${prospect.status !== "converted" && canTransfer ? `<button class="primary-button" data-prospect-transfer="${prospect.id}" type="button">Transferer NautiCRM</button>` : ""}
        ${prospect.crmClientId ? `<a class="ghost-button" href="/NautiCRM/" title="Client CRM #${prospect.crmClientId}">NautiCRM #${prospect.crmClientId}</a>` : ""}
      </div>
    </div>
    <div class="detail-tags">
      ${badge(labels.status[prospect.status] || prospect.status, prospect.status)}
      ${badge(labels.priority[prospect.priority] || prospect.priority, prospect.priority === "high" ? "high-priority" : prospect.priority)}
      ${prospect.segment ? badge(prospect.segment) : ""}
      ${prospect.assignedUserDisplayName ? badge(prospect.assignedUserDisplayName) : ""}
    </div>
    <div class="detail-kpis">
      <span>Mails envoyes<strong>${prospect.sentCount || 0}</strong></span>
      <span>Reponses<strong>${prospect.replyCount || 0}</strong></span>
      <span>Taches ouvertes<strong>${prospect.openTaskCount || 0}</strong></span>
      <span>Relance<strong>${prospect.nextActionAt ? escapeHtml(formatDate(prospect.nextActionAt)) : "-"}</strong></span>
    </div>
    ${prospect.notes ? `<p class="detail-meta">${escapeHtml(prospect.notes)}</p>` : ""}
    ${prospect.sourceUrls?.length ? `<div class="ai-source-list detail-sources">${prospect.sourceUrls.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urlHost(url))}</a>`).join("")}</div>` : ""}
  `;
}

function renderMailTools() {
  const previousAccount = Number(elements.mailAccount.value || defaultAccountId());
  const previousTemplate = Number(elements.mailTemplate.value || defaultTemplateId());
  elements.mailAccount.innerHTML = accountOptions(previousAccount || defaultAccountId());
  elements.mailTemplate.innerHTML = templateOptions(previousTemplate || defaultTemplateId());
  if (!elements.mailAccount.value && defaultAccountId()) elements.mailAccount.value = String(defaultAccountId());
  if (!elements.mailTemplate.value && defaultTemplateId()) elements.mailTemplate.value = String(defaultTemplateId());
  const canSend = Boolean(selectedProspect()?.email) && Number(elements.mailAccount.value || 0) > 0 && Number(elements.mailTemplate.value || 0) > 0;
  elements.mailSendButton.disabled = !canSend;
  elements.mailPreviewButton.disabled = !selectedProspect() || Number(elements.mailTemplate.value || 0) <= 0;
}

function selectedTemplate() {
  const templateId = Number(elements.mailTemplate.value || defaultTemplateId());
  return state.templates.find((template) => Number(template.id) === templateId) || null;
}

function fillMailDraftFromTemplate(force = false) {
  const template = selectedTemplate();
  if (!template) return;
  if (force || elements.mailSubject.value.trim() === "") elements.mailSubject.value = template.subject || "";
  if (force || elements.mailBody.value.trim() === "") elements.mailBody.value = template.bodyText || "";
}

async function previewMailTemplate() {
  const prospect = selectedProspect();
  if (!prospect) return;
  fillMailDraftFromTemplate(false);
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "render_template",
        prospectId: prospect.id,
        templateId: Number(elements.mailTemplate.value || 0),
        subject: elements.mailSubject.value,
        bodyText: elements.mailBody.value,
      }),
    });
    elements.mailSubject.value = payload.rendered?.subject || "";
    elements.mailBody.value = payload.rendered?.bodyText || "";
    showMessage("Template personnalise pour ce prospect.", "success");
  } catch (error) {
    showMessage(error.message || "Previsualisation impossible.", "error");
  }
}

async function sendMail(event) {
  event.preventDefault();
  const prospect = selectedProspect();
  if (!prospect) return;
  const ok = window.confirm(`Envoyer ce mail a ${prospect.email || "ce prospect"} via NautiMail ?`);
  if (!ok) return;
  elements.mailSendButton.disabled = true;
  showMessage("Envoi via NautiMail en cours...");
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "send_template",
        prospectId: prospect.id,
        templateId: Number(elements.mailTemplate.value || 0),
        accountId: Number(elements.mailAccount.value || 0),
        subject: elements.mailSubject.value,
        bodyText: elements.mailBody.value,
      }),
    });
    applySavePayload(payload);
    showMessage(payload.message || "Mail envoye.", "success");
  } catch (error) {
    showMessage(error.message || "Envoi impossible.", "error");
  } finally {
    renderMailTools();
  }
}

function renderMailHistory() {
  const history = state.selectedBundle?.mailHistory || [];
  if (history.length === 0) {
    elements.mailHistory.innerHTML = '<div class="empty-state">Aucun mail synchronise avec ce prospect.</div>';
    return;
  }
  const prospect = selectedProspect();
  elements.mailHistory.innerHTML = history.map((item) => {
    const incoming = item.type === "incoming";
    const sourceLabel = incoming ? "Recu NautiMail" : item.source === "prospection" ? "Envoye Prospection" : "Envoye NautiMail";
    return `
      <article class="list-card mail-card ${incoming ? "incoming-mail" : "outgoing-mail"}">
        <div class="mail-card-head">
          <div>
            <strong>${escapeHtml(item.subject || "(sans sujet)")}</strong>
            <small>${escapeHtml(sourceLabel)} - ${escapeHtml(item.accountLabel || item.accountEmail || "")} - ${escapeHtml(formatDateTime(item.occurredAt))}</small>
          </div>
          ${badge(incoming ? "Reponse" : labels.status[item.status] || item.status || "Mail", incoming ? "replied" : item.status)}
        </div>
        ${item.preview ? `<small>${escapeHtml(item.preview)}</small>` : ""}
        ${item.errorMessage ? `<small class="danger-text">${escapeHtml(item.errorMessage)}</small>` : ""}
        <div class="card-actions">
          ${item.mailId ? `<a class="ghost-button" href="/NautiMail/?messageId=${encodeURIComponent(item.mailId)}">Ouvrir</a>` : ""}
          ${incoming && prospect?.status !== "converted" ? `<button class="ghost-button" data-mail-positive="${escapeHtml(item.subject || "")}" data-mail-body="${escapeHtml(item.preview || "")}" type="button">Reponse positive</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

async function markPositive(subject = "Reponse positive", body = "") {
  const prospect = selectedProspect();
  if (!prospect) return;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "mark_positive",
        prospectId: prospect.id,
        subject,
        body,
      }),
    });
    applySavePayload(payload);
    showMessage(payload.message || "Reponse positive enregistree.", "success");
  } catch (error) {
    showMessage(error.message || "Marquage impossible.", "error");
  }
}

async function transferToCrm() {
  const prospect = selectedProspect();
  if (!prospect) return;
  const ok = window.confirm(`Transferer ${prospect.companyName} dans NautiCRM ?`);
  if (!ok) return;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "transfer_to_crm",
        prospectId: prospect.id,
      }),
    });
    applySavePayload(payload);
    showMessage(payload.message || `Transfere dans NautiCRM #${payload.crmClientId}.`, "success");
  } catch (error) {
    showMessage(error.message || "Transfert NautiCRM impossible.", "error");
  }
}

function renderProspectTasks() {
  const tasks = state.selectedBundle?.tasks || [];
  if (tasks.length === 0) {
    elements.prospectTasksList.innerHTML = '<div class="empty-state">Aucune tache.</div>';
    return;
  }
  elements.prospectTasksList.innerHTML = tasks.map((task) => taskCard(task, true)).join("");
}

function taskCard(task, editable = false) {
  return `
    <article class="list-card">
      <strong>${escapeHtml(task.title)}</strong>
      <small>${escapeHtml(labels.taskStatus[task.status] || task.status)}${task.dueAt ? ` - ${escapeHtml(formatDate(task.dueAt))}` : ""}${task.assignedUserDisplayName ? ` - ${escapeHtml(task.assignedUserDisplayName)}` : ""}</small>
      ${task.notes ? `<small>${escapeHtml(task.notes)}</small>` : ""}
      <div class="card-tags">
        ${badge(labels.priority[task.priority] || task.priority, task.priority === "high" ? "high-priority" : task.priority)}
        ${task.prospectName ? badge(task.prospectName) : ""}
      </div>
      <div class="card-actions">
        ${editable ? `<button class="ghost-button" data-task-edit="${task.id}" type="button">Editer</button>` : `<button class="ghost-button" data-prospect-open="${task.prospectId || ""}" type="button">Prospect</button>`}
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
  const prospectId = selectedProspect()?.id || 0;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "save_task",
        id: Number(elements.taskId.value || 0),
        prospectId,
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
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "save_task",
        id: task.id,
        prospectId: task.prospectId || 0,
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
}

async function logInteraction(event) {
  event.preventDefault();
  const prospectId = selectedProspect()?.id || 0;
  if (!prospectId) return;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "log_interaction",
        prospectId,
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

function renderTemplates() {
  if (state.templates.length === 0) {
    elements.templatesList.innerHTML = '<div class="empty-state">Aucun template.</div>';
    return;
  }
  elements.templatesList.innerHTML = state.templates.map((template) => `
    <article class="list-card">
      <strong>${escapeHtml(template.name)}</strong>
      <small>${escapeHtml(template.subject)}</small>
      <div class="card-tags">${template.isDefault ? badge("Defaut", "client") : ""}</div>
      <div class="card-actions">
        <button class="ghost-button" data-template-edit="${template.id}" type="button">Editer</button>
      </div>
    </article>
  `).join("");
}

function resetTemplateForm() {
  elements.templateForm.reset();
  elements.templateId.value = "";
  elements.templateFormTitle.textContent = "Nouveau template";
  elements.templateDeleteButton.classList.add("hidden");
}

function populateTemplateForm(template) {
  elements.templateId.value = template.id || "";
  elements.templateFormTitle.textContent = template.id ? "Template mail" : "Nouveau template";
  elements.templateName.value = template.name || "";
  elements.templateSubject.value = template.subject || "";
  elements.templateBody.value = template.bodyText || "";
  elements.templateDefault.checked = Boolean(template.isDefault);
  elements.templateDeleteButton.classList.toggle("hidden", !template.id);
}

async function saveTemplate(event) {
  event.preventDefault();
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({
        action: "save_template",
        id: Number(elements.templateId.value || 0),
        name: elements.templateName.value.trim(),
        subject: elements.templateSubject.value.trim(),
        bodyText: elements.templateBody.value,
        isDefault: elements.templateDefault.checked,
      }),
    });
    applyDashboard(payload.dashboard || payload);
    if (payload.template) populateTemplateForm(payload.template);
    showMessage(payload.message || "Template enregistre.", "success");
  } catch (error) {
    showMessage(error.message || "Template impossible.", "error");
  }
}

async function deleteTemplate() {
  const templateId = Number(elements.templateId.value || 0);
  if (templateId <= 0) return;
  const ok = window.confirm("Archiver ce template mail ?");
  if (!ok) return;
  try {
    const payload = await apiRequest(API.prospects, {
      method: "POST",
      body: JSON.stringify({ action: "delete_template", id: templateId }),
    });
    applyDashboard(payload.dashboard || payload);
    resetTemplateForm();
    showMessage(payload.message || "Template archive.", "success");
  } catch (error) {
    showMessage(error.message || "Archivage du template impossible.", "error");
  }
}

function renderGlobalTasks() {
  if (state.tasks.length === 0) {
    elements.tasksList.innerHTML = '<div class="empty-state">Aucune tache ouverte.</div>';
    return;
  }
  elements.tasksList.innerHTML = state.tasks.map((task) => taskCard(task, false).replace("list-card", "board-card")).join("");
}

function renderActivity() {
  if (state.recentInteractions.length === 0) {
    elements.activityList.innerHTML = '<div class="empty-state">Aucune interaction.</div>';
    return;
  }
  elements.activityList.innerHTML = state.recentInteractions.map((item) => `
    <article class="board-card">
      <strong>${escapeHtml(item.subject)}</strong>
      <small>${escapeHtml(item.prospectName)} - ${escapeHtml(labels.interactionType[item.interactionType] || item.interactionType)} - ${escapeHtml(formatDateTime(item.occurredAt))}</small>
      ${item.body ? `<small>${escapeHtml(item.body)}</small>` : ""}
      <div class="card-actions">
        <button class="ghost-button" data-prospect-open="${item.prospectId}" type="button">Prospect</button>
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

function installListeners() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view || "prospects"));
  });
  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard()
      .then(() => showMessage("Donnees actualisees.", "success"))
      .catch((error) => showMessage(error.message, "error"));
  });
  elements.newProspectButton.addEventListener("click", () => {
    resetProspectForm();
    setActiveView("prospects");
    elements.prospectCompany.focus();
  });
  elements.logoutButton.addEventListener("click", () => { void logout(); });
  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadDashboard().catch((error) => showMessage(error.message, "error"));
  });
  elements.prospectForm.addEventListener("submit", saveProspect);
  elements.prospectResetButton.addEventListener("click", resetProspectForm);
  elements.prospectArchiveButton.addEventListener("click", () => { void archiveCurrentProspect(); });
  elements.aiCleanButton.addEventListener("click", () => { void cleanAiImport(); });
  elements.aiCsvButton.addEventListener("click", () => elements.aiCsvFile.click());
  elements.aiCsvFile.addEventListener("change", () => { void handleAiCsvFile(); });
  elements.aiSearch.addEventListener("input", renderAiPreview);
  elements.aiImportButton.addEventListener("click", () => { void importAiProspects(); });
  elements.aiClearButton.addEventListener("click", clearAiImport);
  elements.mailTemplate.addEventListener("change", () => {
    fillMailDraftFromTemplate(true);
    renderMailTools();
  });
  elements.mailAccount.addEventListener("change", renderMailTools);
  elements.mailPreviewButton.addEventListener("click", () => { void previewMailTemplate(); });
  elements.mailForm.addEventListener("submit", sendMail);
  elements.taskForm.addEventListener("submit", saveTask);
  elements.interactionForm.addEventListener("submit", logInteraction);
  elements.templateForm.addEventListener("submit", saveTemplate);
  elements.templateResetButton.addEventListener("click", resetTemplateForm);
  elements.templateDeleteButton.addEventListener("click", () => { void deleteTemplate(); });

  elements.prospectsBody.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-prospect-open]");
    const editButton = event.target.closest("[data-prospect-edit]");
    const emailButton = event.target.closest("[data-prospect-email]");
    if (openButton) {
      void loadProspect(openButton.dataset.prospectOpen);
    }
    if (editButton) {
      const prospect = state.prospects.find((item) => Number(item.id) === Number(editButton.dataset.prospectEdit));
      if (prospect) populateProspectForm(prospect);
    }
    if (emailButton) {
      void loadProspect(emailButton.dataset.prospectEmail).then(() => {
        fillMailDraftFromTemplate(true);
        setActiveView("detail");
      });
    }
  });

  document.addEventListener("click", (event) => {
    const detailEdit = event.target.closest("[data-detail-edit]");
    if (detailEdit && state.selectedBundle?.prospect) {
      populateProspectForm(state.selectedBundle.prospect);
      setActiveView("prospects");
    }

    const prospectOpen = event.target.closest("[data-prospect-open]");
    if (prospectOpen && prospectOpen.dataset.prospectOpen) {
      void loadProspect(prospectOpen.dataset.prospectOpen);
    }

    const prospectPositive = event.target.closest("[data-prospect-positive]");
    if (prospectPositive) {
      void markPositive("Reponse positive", "");
    }

    const prospectTransfer = event.target.closest("[data-prospect-transfer]");
    if (prospectTransfer) {
      void transferToCrm();
    }

    const mailPositive = event.target.closest("[data-mail-positive]");
    if (mailPositive) {
      void markPositive(mailPositive.dataset.mailPositive || "Reponse positive", mailPositive.dataset.mailBody || "");
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
        state.aiImport.prospects.splice(index, 1);
        renderAiPreview();
      }
    }

    const templateEdit = event.target.closest("[data-template-edit]");
    if (templateEdit) {
      const template = state.templates.find((item) => Number(item.id) === Number(templateEdit.dataset.templateEdit));
      if (template) populateTemplateForm(template);
    }
  });
}

async function init() {
  installListeners();
  try {
    const authenticated = await fetchAuth();
    if (!authenticated) return;
    resetProspectForm();
    resetTaskForm();
    resetTemplateForm();
    await loadDashboard();
    setView("app");
  } catch (error) {
    showMessage(error.message || "Prospection est indisponible.", "error");
    setView("app");
  }
}

void init();
