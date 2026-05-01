const API_URL = "api/visibility.php";
const AUTH_URL = "/OceanOS/api/auth.php";
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  currentUser: $("current-user"),
  connectionPill: $("connection-pill"),
  appMessage: $("app-message"),
  refreshButton: $("refresh-button"),
  auditButton: $("audit-button"),
  logoutButton: $("logout-button"),
  periodButtons: Array.from(document.querySelectorAll("[data-period]")),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  metricSessions: $("metric-sessions"),
  metricUsers: $("metric-users"),
  metricConversions: $("metric-conversions"),
  metricEngagement: $("metric-engagement"),
  metricClicks: $("metric-clicks"),
  metricImpressions: $("metric-impressions"),
  metricScore: $("metric-score"),
  metricPages: $("metric-pages"),
  recommendationCount: $("recommendation-count"),
  recommendationList: $("recommendation-list"),
  channelList: $("channel-list"),
  trackingSnippet: $("tracking-snippet"),
  copySnippetButton: $("copy-snippet-button"),
  auditSummary: $("audit-summary"),
  pagesTable: $("pages-table"),
  pagesEmpty: $("pages-empty"),
  queryList: $("query-list"),
  searchPageList: $("search-page-list"),
  saveSettingsButton: $("save-settings-button"),
  siteUrl: $("site-url"),
  targetCountry: $("target-country"),
  targetLanguage: $("target-language"),
  gaMeasurementId: $("ga-measurement-id"),
  gaPropertyId: $("ga-property-id"),
  searchConsoleSiteUrl: $("search-console-site-url"),
  targetKeywords: $("target-keywords"),
  competitors: $("competitors"),
  serviceAccountNote: $("service-account-note"),
  serviceAccountJson: $("service-account-json"),
  clearServiceAccount: $("clear-service-account"),
};

const state = {
  periodDays: 30,
  payload: null,
  settingsLoaded: false,
};

function setVisible(ready) {
  elements.loadingView.classList.toggle("hidden", ready);
  elements.appView.classList.toggle("hidden", !ready);
}

function setMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function formatNumber(value, digits = 0) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(number);
}

function formatPercent(value) {
  const number = Number(value || 0) * 100;
  return `${formatNumber(number, number < 10 ? 1 : 0)}%`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pathLabel(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.host : parsed.pathname;
  } catch (error) {
    return String(url || "/");
  }
}

function listFromTextarea(value) {
  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "Erreur Visiocean.");
  }
  return payload;
}

function createEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state inline";
  const strong = document.createElement("strong");
  strong.textContent = message;
  empty.appendChild(strong);
  return empty;
}

function priorityLabel(priority) {
  if (priority === "high") return "Haute";
  if (priority === "medium") return "Moyenne";
  return "Suivi";
}

function renderIdentity(payload) {
  const user = payload.currentUser || {};
  const label = user.displayName || user.email || "Utilisateur";
  elements.currentUser.textContent = label;

  const integrations = [
    payload.analytics?.available ? "GA4" : "",
    payload.search?.available ? "Search Console" : "",
    payload.audit?.available ? "Audit" : "",
  ].filter(Boolean);
  elements.connectionPill.textContent = integrations.length > 0 ? integrations.join(" + ") : "A configurer";
}

function renderMetrics(payload) {
  const analytics = payload.analytics || {};
  const search = payload.search || {};
  const audit = payload.audit || {};

  elements.metricSessions.textContent = analytics.available ? formatNumber(analytics.summary.sessions) : "-";
  elements.metricUsers.textContent = `${formatNumber(analytics.summary?.activeUsers || 0)} utilisateurs`;
  elements.metricConversions.textContent = analytics.available ? formatNumber(analytics.summary.conversions, 1) : "-";
  elements.metricEngagement.textContent = `${formatPercent(analytics.summary?.engagementRate || 0)} engagement`;
  elements.metricClicks.textContent = search.available ? formatNumber(search.summary.clicks) : "-";
  elements.metricImpressions.textContent = `${formatNumber(search.summary?.impressions || 0)} impressions`;
  elements.metricScore.textContent = audit.available ? `${formatNumber(audit.summary.averageScore, 1)}/100` : "-";
  elements.metricPages.textContent = `${formatNumber(audit.summary?.pageCount || 0)} page${Number(audit.summary?.pageCount || 0) > 1 ? "s" : ""} auditee${Number(audit.summary?.pageCount || 0) > 1 ? "s" : ""}`;
}

function renderRecommendations(payload) {
  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  elements.recommendationCount.textContent = `${recommendations.length} action${recommendations.length > 1 ? "s" : ""}`;
  elements.recommendationList.innerHTML = "";

  if (recommendations.length === 0) {
    elements.recommendationList.appendChild(createEmpty("Aucune action prioritaire"));
    return;
  }

  recommendations.forEach((item) => {
    const article = document.createElement("article");
    article.className = `recommendation-item priority-${item.priority || "low"}`;

    const meta = document.createElement("span");
    meta.className = "recommendation-meta";
    meta.textContent = `${priorityLabel(item.priority)} - ${item.area || "Suivi"}`;

    const title = document.createElement("strong");
    title.textContent = item.title || "Action";

    const body = document.createElement("p");
    body.textContent = item.body || "";

    article.append(meta, title, body);
    elements.recommendationList.appendChild(article);
  });
}

function renderChannels(payload) {
  const channels = Array.isArray(payload.analytics?.channels) ? payload.analytics.channels : [];
  elements.channelList.innerHTML = "";

  if (!payload.analytics?.available) {
    elements.channelList.appendChild(createEmpty(payload.analytics?.message || "GA4 non configure"));
    return;
  }
  if (channels.length === 0) {
    elements.channelList.appendChild(createEmpty("Aucun canal disponible"));
    return;
  }

  const maxSessions = Math.max(...channels.map((channel) => Number(channel.sessions || 0)), 1);
  channels.forEach((channel) => {
    const row = document.createElement("div");
    row.className = "channel-row";

    const label = document.createElement("span");
    label.textContent = channel.name || "Non defini";

    const value = document.createElement("strong");
    value.textContent = formatNumber(channel.sessions);

    const bar = document.createElement("i");
    bar.style.setProperty("--bar-width", `${Math.max(6, (Number(channel.sessions || 0) / maxSessions) * 100)}%`);

    row.append(label, value, bar);
    elements.channelList.appendChild(row);
  });
}

function renderSnippet(payload) {
  const snippet = payload.trackingSnippet || "";
  elements.trackingSnippet.textContent = snippet || "Ajoutez un ID de mesure GA4 pour generer la balise.";
  elements.copySnippetButton.disabled = snippet === "";
}

function renderPages(payload) {
  const pages = Array.isArray(payload.audit?.pages) ? payload.audit.pages : [];
  elements.auditSummary.textContent = payload.audit?.available
    ? `${formatNumber(payload.audit.summary.pageCount)} page${Number(payload.audit.summary.pageCount) > 1 ? "s" : ""} - ${formatNumber(payload.audit.summary.issueCount)} point${Number(payload.audit.summary.issueCount) > 1 ? "s" : ""}`
    : "0 page";
  elements.pagesTable.innerHTML = "";
  elements.pagesEmpty.classList.toggle("hidden", pages.length > 0);

  pages.forEach((page) => {
    const row = document.createElement("tr");

    const urlCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = page.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = pathLabel(page.url);
    const checked = document.createElement("small");
    checked.textContent = formatDate(page.checkedAt);
    urlCell.append(link, checked);

    const scoreCell = document.createElement("td");
    const score = document.createElement("span");
    score.className = `score-badge ${Number(page.score || 0) < 75 ? "is-low" : Number(page.score || 0) < 90 ? "is-mid" : "is-good"}`;
    score.textContent = `${formatNumber(page.score)}/100`;
    scoreCell.appendChild(score);

    const titleCell = document.createElement("td");
    titleCell.textContent = page.title || "Title manquant";

    const metaCell = document.createElement("td");
    metaCell.textContent = page.metaDescription || "Meta description manquante";

    const issuesCell = document.createElement("td");
    const issues = Array.isArray(page.issues) ? page.issues : [];
    issuesCell.textContent = issues.length > 0 ? issues.slice(0, 4).join(", ") : "OK";

    row.append(urlCell, scoreCell, titleCell, metaCell, issuesCell);
    elements.pagesTable.appendChild(row);
  });
}

function createSearchRow(item) {
  const row = document.createElement("article");
  row.className = "query-row";

  const head = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.key || "Non defini";
  const position = document.createElement("span");
  position.textContent = `Pos. ${formatNumber(item.position || 0, 1)}`;
  head.append(title, position);

  const stats = document.createElement("p");
  stats.textContent = `${formatNumber(item.clicks)} clics - ${formatNumber(item.impressions)} impressions - CTR ${formatPercent(item.ctr || 0)}`;

  row.append(head, stats);
  return row;
}

function renderSearch(payload) {
  const queries = Array.isArray(payload.search?.queries) ? payload.search.queries : [];
  const pages = Array.isArray(payload.search?.pages) ? payload.search.pages : [];
  elements.queryList.innerHTML = "";
  elements.searchPageList.innerHTML = "";

  if (!payload.search?.available) {
    const empty = createEmpty(payload.search?.message || "Search Console non configuree");
    elements.queryList.appendChild(empty);
    elements.searchPageList.appendChild(createEmpty("Aucune page organique"));
    return;
  }

  (queries.length > 0 ? queries : []).forEach((item) => elements.queryList.appendChild(createSearchRow(item)));
  (pages.length > 0 ? pages : []).forEach((item) => elements.searchPageList.appendChild(createSearchRow(item)));
  if (queries.length === 0) elements.queryList.appendChild(createEmpty("Aucune requete disponible"));
  if (pages.length === 0) elements.searchPageList.appendChild(createEmpty("Aucune page disponible"));
}

function renderSettings(payload) {
  const settings = payload.settings || {};
  if (!state.settingsLoaded) {
    elements.siteUrl.value = settings.siteUrl || "";
    elements.targetCountry.value = settings.targetCountry || "FR";
    elements.targetLanguage.value = settings.targetLanguage || "fr";
    elements.gaMeasurementId.value = settings.gaMeasurementId || "";
    elements.gaPropertyId.value = settings.gaPropertyId || "";
    elements.searchConsoleSiteUrl.value = settings.searchConsoleSiteUrl || "";
    elements.targetKeywords.value = (settings.targetKeywords || []).join("\n");
    elements.competitors.value = (settings.competitors || []).join("\n");
    elements.serviceAccountJson.value = "";
    elements.clearServiceAccount.checked = false;
    state.settingsLoaded = true;
  }

  elements.serviceAccountNote.textContent = settings.hasServiceAccount
    ? `Compte enregistre : ${settings.serviceAccountHint || "cle chiffree"}`
    : "Aucun compte de service enregistre.";

  const disabled = !payload.canManage;
  [
    elements.siteUrl,
    elements.targetCountry,
    elements.targetLanguage,
    elements.gaMeasurementId,
    elements.gaPropertyId,
    elements.searchConsoleSiteUrl,
    elements.targetKeywords,
    elements.competitors,
    elements.serviceAccountJson,
    elements.clearServiceAccount,
    elements.saveSettingsButton,
    elements.auditButton,
  ].forEach((element) => {
    element.disabled = disabled;
  });
}

function render(payload) {
  state.payload = payload;
  renderIdentity(payload);
  renderMetrics(payload);
  renderRecommendations(payload);
  renderChannels(payload);
  renderSnippet(payload);
  renderPages(payload);
  renderSearch(payload);
  renderSettings(payload);
}

async function loadDashboard(message = "") {
  if (message) setMessage(message);
  const payload = await requestJson(`${API_URL}?days=${state.periodDays}`);
  render(payload);
  setVisible(true);
  if (payload.analytics?.available || payload.search?.available) {
    setMessage("");
  } else if (!message) {
    setMessage("Visiocean est pret. Configurez les sources Google pour activer les donnees live.", "info");
  }
}

function collectSettings() {
  return {
    siteUrl: elements.siteUrl.value,
    targetCountry: elements.targetCountry.value,
    targetLanguage: elements.targetLanguage.value,
    gaMeasurementId: elements.gaMeasurementId.value,
    gaPropertyId: elements.gaPropertyId.value,
    searchConsoleSiteUrl: elements.searchConsoleSiteUrl.value,
    targetKeywords: listFromTextarea(elements.targetKeywords.value),
    competitors: listFromTextarea(elements.competitors.value),
    serviceAccountJson: elements.serviceAccountJson.value,
    clearServiceAccount: elements.clearServiceAccount.checked,
  };
}

async function saveSettings() {
  elements.saveSettingsButton.disabled = true;
  setMessage("Enregistrement de la configuration...");
  try {
    state.settingsLoaded = false;
    const payload = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "save_settings",
        days: state.periodDays,
        settings: collectSettings(),
      }),
    });
    render(payload);
    setMessage(payload.message || "Configuration enregistree.", "success");
  } catch (error) {
    setMessage(error.message || "Impossible d enregistrer la configuration.", "error");
  } finally {
    elements.saveSettingsButton.disabled = Boolean(state.payload && !state.payload.canManage);
  }
}

async function runAudit() {
  elements.auditButton.disabled = true;
  setMessage("Audit SEO en cours...");
  try {
    const payload = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "audit_site",
        days: state.periodDays,
        limit: 12,
      }),
    });
    render(payload);
    setMessage(payload.message || "Audit termine.", "success");
  } catch (error) {
    setMessage(error.message || "Audit impossible.", "error");
  } finally {
    elements.auditButton.disabled = Boolean(state.payload && !state.payload.canManage);
  }
}

async function refreshGoogle() {
  elements.refreshButton.disabled = true;
  setMessage("Actualisation des indicateurs...");
  try {
    const payload = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "refresh_google",
        days: state.periodDays,
      }),
    });
    render(payload);
    setMessage(payload.message || "Donnees actualisees.", "success");
  } catch (error) {
    setMessage(error.message || "Actualisation impossible.", "error");
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function logout() {
  try {
    await fetch(AUTH_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

function setView(view) {
  elements.viewTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
  elements.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== view);
  });
}

function bindEvents() {
  elements.viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  elements.periodButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      state.periodDays = Number(button.dataset.period || 30);
      elements.periodButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      await loadDashboard("Changement de periode...");
    });
  });
  elements.refreshButton.addEventListener("click", () => void refreshGoogle());
  elements.auditButton.addEventListener("click", () => void runAudit());
  elements.saveSettingsButton.addEventListener("click", () => void saveSettings());
  elements.logoutButton.addEventListener("click", () => void logout());
  elements.copySnippetButton.addEventListener("click", async () => {
    const snippet = state.payload?.trackingSnippet || "";
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setMessage("Balise GA4 copiee.", "success");
    } catch (error) {
      setMessage("Copie impossible depuis ce navigateur.", "error");
    }
  });
}

async function boot() {
  bindEvents();
  try {
    await loadDashboard();
  } catch (error) {
    setVisible(true);
    setMessage(error.message || "Visiocean indisponible.", "error");
  }
}

boot();
