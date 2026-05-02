const API = {
  auth: "api/auth.php",
  sav: "api/sav.php",
};
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  connectionChip: $("connection-chip"),
  currentUser: $("current-user"),
  refreshButton: $("refresh-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricThreads: $("metric-threads"),
  metricOpen: $("metric-open"),
  metricPending: $("metric-pending"),
  metricClosed: $("metric-closed"),
  filtersForm: $("filters-form"),
  searchInput: $("search-input"),
  statusFilter: $("status-filter"),
  threadsList: $("threads-list"),
  detailTitle: $("detail-title"),
  detailStatus: $("detail-status"),
  detailEmpty: $("detail-empty"),
  detailContent: $("detail-content"),
  detailCustomer: $("detail-customer"),
  detailEmail: $("detail-email"),
  detailOrder: $("detail-order"),
  detailContact: $("detail-contact"),
  detailDate: $("detail-date"),
  detailUpdated: $("detail-updated"),
  messagesList: $("messages-list"),
  replyForm: $("reply-form"),
  replyMessage: $("reply-message"),
  nextStatus: $("next-status"),
  privateReply: $("private-reply"),
  replyButton: $("reply-button"),
  statusButton: $("status-button"),
};

const state = {
  user: null,
  settings: null,
  threads: [],
  statuses: [],
  selectedThreadId: null,
  selectedThread: null,
};

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function setConnection(settings) {
  const connected = Boolean(settings?.shopUrl && settings?.hasWebserviceKey);
  elements.connectionChip.textContent = connected ? "PrestaShop connecte" : "PrestaShop non configure";
  elements.connectionChip.dataset.tone = connected ? "success" : "";
}

function statusById(id) {
  return state.statuses.find((item) => item.id === id) || null;
}

function statusTone(status) {
  return statusById(status)?.tone || (status === "closed" ? "muted" : "success");
}

function statusLabel(status) {
  return statusById(status)?.label || status || "Sans statut";
}

function fillStatusSelects() {
  const selectedFilter = elements.statusFilter.value;
  elements.statusFilter.innerHTML = '<option value="">Tous les statuts</option>';
  state.statuses.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    elements.statusFilter.appendChild(option);
  });
  elements.statusFilter.value = selectedFilter;

  const selectedNext = elements.nextStatus.value;
  elements.nextStatus.innerHTML = "";
  state.statuses.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    elements.nextStatus.appendChild(option);
  });
  elements.nextStatus.value = selectedNext || "open";
}

function renderMetrics(metrics = {}) {
  elements.metricThreads.textContent = String(metrics.threads || state.threads.length || 0);
  elements.metricOpen.textContent = String(metrics.open || 0);
  elements.metricPending.textContent = String(metrics.pending || 0);
  elements.metricClosed.textContent = String(metrics.closed || 0);
}

function filteredThreads() {
  const needle = normalizeText(elements.searchInput.value);
  if (!needle) return state.threads;
  return state.threads.filter((thread) => {
    const customer = thread.customer || {};
    return [
      customer.name,
      customer.email,
      thread.email,
      thread.orderReference,
      thread.contactName,
      thread.statusLabel,
    ].some((value) => normalizeText(value).includes(needle));
  });
}

function renderThreads() {
  const threads = filteredThreads();
  elements.threadsList.innerHTML = "";

  if (threads.length === 0) {
    elements.threadsList.innerHTML = '<div class="empty-state">Aucune demande trouvee.</div>';
    return;
  }

  threads.forEach((thread) => {
    const customer = thread.customer || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `thread-card ${Number(thread.id) === Number(state.selectedThreadId) ? "is-active" : ""}`;
    button.innerHTML = `
      <span class="thread-card-head">
        <strong>${escapeHtml(customer.name || thread.email || `Demande #${thread.id}`)}</strong>
        <span class="status-pill" data-tone="${escapeHtml(statusTone(thread.status))}">${escapeHtml(thread.statusLabel || statusLabel(thread.status))}</span>
      </span>
      <small>${escapeHtml(customer.email || thread.email || "Email inconnu")}</small>
      <span class="thread-card-meta">
        <span>${thread.orderReference ? "Commande " + escapeHtml(thread.orderReference) : escapeHtml(thread.contactName || "SAV")}</span>
        <span>${escapeHtml(formatDateTime(thread.dateUpd || thread.dateAdd))}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      void selectThread(thread.id);
    });
    elements.threadsList.appendChild(button);
  });
}

function renderMessages() {
  const messages = Array.isArray(state.selectedThread?.messages) ? state.selectedThread.messages : [];
  elements.messagesList.innerHTML = "";
  if (messages.length === 0) {
    elements.messagesList.innerHTML = '<div class="empty-state">Aucun message dans ce fil.</div>';
    return;
  }

  messages.forEach((message) => {
    const card = document.createElement("article");
    card.className = [
      "message-card",
      message.fromEmployee ? "employee" : "",
      message.private ? "private" : "",
    ].filter(Boolean).join(" ");

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const author = document.createElement("span");
    author.textContent = message.private
      ? "Note interne"
      : (message.fromEmployee ? "Equipe SAV" : "Client");
    const date = document.createElement("span");
    date.textContent = formatDateTime(message.dateAdd);
    meta.append(author, date);

    const body = document.createElement("p");
    body.className = "message-body";
    body.textContent = message.message || "";

    card.append(meta, body);
    elements.messagesList.appendChild(card);
  });
}

function renderDetail() {
  const thread = state.selectedThread;
  const hasThread = Boolean(thread?.id);
  elements.detailEmpty.classList.toggle("hidden", hasThread);
  elements.detailContent.classList.toggle("hidden", !hasThread);

  if (!hasThread) {
    elements.detailTitle.textContent = "Selectionnez une demande";
    elements.detailStatus.textContent = "En attente";
    elements.detailStatus.dataset.tone = "";
    return;
  }

  const customer = thread.customer || {};
  elements.detailTitle.textContent = `Demande #${thread.id}`;
  elements.detailStatus.textContent = statusLabel(thread.status);
  elements.detailStatus.dataset.tone = statusTone(thread.status);
  elements.detailCustomer.textContent = customer.company || customer.name || thread.email || "Client";
  elements.detailEmail.textContent = customer.email || thread.email || "";
  elements.detailOrder.textContent = thread.orderReference || "-";
  elements.detailContact.textContent = thread.contactName || "SAV";
  elements.detailDate.textContent = formatDateTime(thread.dateUpd || thread.dateAdd);
  elements.detailUpdated.textContent = `Fil PrestaShop #${thread.id}`;
  elements.nextStatus.value = thread.status || "open";
  renderMessages();
}

async function loadAuth() {
  const payload = await apiRequest(API.auth);
  if (!payload.authenticated) {
    redirectToOceanOS();
    return false;
  }
  state.user = payload.user || null;
  elements.currentUser.textContent = state.user?.displayName || state.user?.email || "Utilisateur";
  return true;
}

async function loadDashboard() {
  const params = new URLSearchParams();
  if (elements.statusFilter.value) {
    params.set("status", elements.statusFilter.value);
  }

  const payload = await apiRequest(`${API.sav}${params.toString() ? `?${params}` : ""}`);
  state.settings = payload.settings || null;
  state.threads = Array.isArray(payload.threads) ? payload.threads : [];
  state.statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
  setConnection(state.settings);
  fillStatusSelects();
  renderMetrics(payload.metrics || {});
  renderThreads();

  if (state.selectedThreadId && state.threads.some((thread) => Number(thread.id) === Number(state.selectedThreadId))) {
    await selectThread(state.selectedThreadId, false);
  } else {
    state.selectedThread = null;
    state.selectedThreadId = null;
    renderDetail();
  }
}

async function selectThread(threadId, rerenderList = true) {
  state.selectedThreadId = Number(threadId);
  if (rerenderList) renderThreads();
  elements.detailTitle.textContent = "Chargement...";
  const payload = await apiRequest(`${API.sav}?action=detail&id=${encodeURIComponent(threadId)}`);
  state.selectedThread = payload.thread || null;
  renderDetail();
}

function applyDashboardPayload(payload) {
  if (!payload?.dashboard) return;
  state.settings = payload.dashboard.settings || state.settings;
  state.threads = Array.isArray(payload.dashboard.threads) ? payload.dashboard.threads : state.threads;
  state.statuses = Array.isArray(payload.dashboard.statuses) ? payload.dashboard.statuses : state.statuses;
  setConnection(state.settings);
  fillStatusSelects();
  renderMetrics(payload.dashboard.metrics || {});
  renderThreads();
}

async function replyToThread(event) {
  event.preventDefault();
  if (!state.selectedThread?.id) return;

  const message = elements.replyMessage.value.trim();
  if (!message) {
    showMessage("La reponse SAV est vide.", "error");
    return;
  }

  elements.replyButton.disabled = true;
  elements.statusButton.disabled = true;
  showMessage("");
  try {
    const payload = await apiRequest(API.sav, {
      method: "POST",
      body: JSON.stringify({
        action: "reply",
        threadId: state.selectedThread.id,
        message,
        private: elements.privateReply.checked,
        nextStatus: elements.nextStatus.value || "open",
      }),
    });
    state.selectedThread = payload.thread || state.selectedThread;
    applyDashboardPayload(payload);
    renderDetail();
    elements.replyMessage.value = "";
    elements.privateReply.checked = false;
    showMessage(payload.message || "Reponse ajoutee.", "success");
  } catch (error) {
    showMessage(error.message || "Reponse impossible.", "error");
  } finally {
    elements.replyButton.disabled = false;
    elements.statusButton.disabled = false;
  }
}

async function changeStatusOnly() {
  if (!state.selectedThread?.id) return;

  elements.replyButton.disabled = true;
  elements.statusButton.disabled = true;
  showMessage("");
  try {
    const payload = await apiRequest(API.sav, {
      method: "POST",
      body: JSON.stringify({
        action: "change_status",
        threadId: state.selectedThread.id,
        status: elements.nextStatus.value || "open",
      }),
    });
    state.selectedThread = payload.thread || state.selectedThread;
    applyDashboardPayload(payload);
    renderDetail();
    showMessage(payload.message || "Statut mis a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour impossible.", "error");
  } finally {
    elements.replyButton.disabled = false;
    elements.statusButton.disabled = false;
  }
}

async function boot() {
  setView("loading");
  try {
    const authenticated = await loadAuth();
    if (!authenticated) return;
    setView("app");
    await loadDashboard();
  } catch (error) {
    setView("app");
    showMessage(error.message || "SAV est indisponible.", "error");
    setConnection(null);
  }
}

elements.refreshButton.addEventListener("click", () => {
  void loadDashboard().then(() => showMessage("Donnees actualisees.", "success")).catch((error) => showMessage(error.message, "error"));
});

elements.filtersForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadDashboard().catch((error) => showMessage(error.message, "error"));
});

elements.searchInput.addEventListener("input", renderThreads);
elements.replyForm.addEventListener("submit", replyToThread);
elements.statusButton.addEventListener("click", () => {
  void changeStatusOnly();
});
elements.logoutButton.addEventListener("click", async () => {
  await apiRequest(API.auth, { method: "DELETE" }).catch(() => {});
  redirectToOceanOS();
});

void boot();
