const API = {
  auth: "api/auth.php",
  messages: "api/messages.php",
};

const OCEANOS_URL = "/OceanOS/";
const AUTO_REFRESH_INTERVAL_MS = 10000;
const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  imapChip: $("imap-chip"),
  aiChip: $("ai-chip"),
  currentUser: $("current-user"),
  accountSelect: $("account-select"),
  composeButton: $("compose-button"),
  syncButton: $("sync-button"),
  analyzePendingButton: $("analyze-pending-button"),
  refreshButton: $("refresh-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricAccounts: $("metric-accounts"),
  metricMessages: $("metric-messages"),
  metricNew: $("metric-new"),
  metricUrgent: $("metric-urgent"),
  metricAi: $("metric-ai"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  filtersForm: $("filters-form"),
  filterSearch: $("filter-search"),
  filterCategory: $("filter-category"),
  filterStatus: $("filter-status"),
  messagesList: $("messages-list"),
  triageBoard: $("triage-board"),
  accountCards: $("account-cards"),
  mailDetailEmpty: $("mail-detail-empty"),
  mailDetail: $("mail-detail"),
  mailTriagePanel: $("mail-triage-panel"),
  messageForm: $("message-form"),
  messageCategory: $("message-category"),
  messagePriority: $("message-priority"),
  messageStatus: $("message-status"),
  messageAssigned: $("message-assigned"),
  analyzeMessageButton: $("analyze-message-button"),
  openReplyButton: $("open-reply-button"),
  openReplyAllButton: $("open-reply-all-button"),
  deleteMessageButton: $("delete-message-button"),
  replyEmpty: $("reply-empty"),
  replyPanel: $("reply-panel"),
  replyEyebrow: $("reply-eyebrow"),
  replyTitle: $("reply-title"),
  replyTone: $("reply-tone"),
  replyAllButton: $("reply-all-button"),
  generateReplyButton: $("generate-reply-button"),
  replyForm: $("reply-form"),
  replyTo: $("reply-to"),
  replyCc: $("reply-cc"),
  replyBcc: $("reply-bcc"),
  replySubject: $("reply-subject"),
  replyBody: $("reply-body"),
  replyAttachments: $("reply-attachments"),
  replyAttachmentsList: $("reply-attachments-list"),
  replySignaturePreview: $("reply-signature-preview"),
  replySubmitButton: $("reply-submit-button"),
  replyResetButton: $("reply-reset-button"),
  replyCancelButton: $("reply-cancel-button"),
  accountFormTitle: $("account-form-title"),
  newAccountButton: $("new-account-button"),
  accountForm: $("account-form"),
  accountId: $("account-id"),
  accountLabel: $("account-label"),
  accountEmail: $("account-email"),
  accountDisplayName: $("account-display-name"),
  accountUsername: $("account-username"),
  accountPassword: $("account-password"),
  accountImapHost: $("account-imap-host"),
  accountImapPort: $("account-imap-port"),
  accountImapEncryption: $("account-imap-encryption"),
  accountImapFolder: $("account-imap-folder"),
  accountSmtpHost: $("account-smtp-host"),
  accountSmtpPort: $("account-smtp-port"),
  accountSmtpEncryption: $("account-smtp-encryption"),
  accountReplyTo: $("account-reply-to"),
  accountSignature: $("account-signature"),
  accountSignaturePreview: $("account-signature-preview"),
  accountActive: $("account-active"),
  accountShares: $("account-shares"),
  accountResetButton: $("account-reset-button"),
  accountDeactivateButton: $("account-deactivate-button"),
  accountsList: $("accounts-list"),
};

const state = {
  user: null,
  users: [],
  accounts: [],
  messages: [],
  selectedAccountId: 0,
  selectedMessage: null,
  conversation: null,
  stats: {},
  currentView: "inbox",
  imapAvailable: false,
  aiSettings: null,
  replyAll: false,
  composeMode: false,
  selectedConversationKey: "",
  autoRefreshTimer: null,
  syncInProgress: false,
};

const labels = {
  category: {
    client: "Client",
    vente: "Vente",
    gestion: "Gestion",
    support: "Support",
    finance: "Finance",
    spam: "Spam",
    autre: "Autre",
  },
  priority: {
    low: "Basse",
    normal: "Normale",
    high: "Haute",
    urgent: "Urgente",
  },
  status: {
    new: "Nouveau",
    triaged: "Trie",
    read: "Lu",
    replied: "Repondu",
    archived: "Archive",
    sent: "Envoye",
    failed: "Erreur",
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

function formatBytes(value) {
  const size = Number(value || 0);
  if (size <= 0) return "Taille inconnue";
  const units = ["o", "Ko", "Mo", "Go"];
  let current = size;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function selectedDraftAttachments() {
  return Array.from(elements.replyAttachments?.files || []);
}

function renderDraftAttachments() {
  if (!elements.replyAttachmentsList) return;
  const files = selectedDraftAttachments();
  if (files.length === 0) {
    elements.replyAttachmentsList.innerHTML = "";
    return;
  }

  elements.replyAttachmentsList.innerHTML = files.map((file) => `
    <span class="draft-attachment-chip">
      <strong>${escapeHtml(file.name || "piece-jointe")}</strong>
      <small>${escapeHtml(formatBytes(file.size))}</small>
    </span>
  `).join("");
}

function clearDraftAttachments() {
  if (elements.replyAttachments) elements.replyAttachments.value = "";
  renderDraftAttachments();
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
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
  state.currentView = view || "inbox";
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
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

function selectedAccount() {
  return state.accounts.find((account) => Number(account.id) === Number(state.selectedAccountId)) || null;
}

function currentAccountSignature() {
  return String(selectedAccount()?.signature || "");
}

function cleanSignaturePreviewHtml(value) {
  return String(value || "")
    .replace(/<\s*(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .trim();
}

function signatureFrameDocument(signatureHtml) {
  const baseHref = escapeAttribute(window.location.href);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <base href="${baseHref}" target="_blank">
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; }
    body { overflow-wrap: anywhere; font: 14px Arial, sans-serif; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style>
</head>
<body>${signatureHtml}</body>
</html>`;
}

function renderSignaturePreview(container, signature) {
  if (!container) return;
  const frameHost = container.querySelector("[data-signature-frame]");
  const signatureHtml = cleanSignaturePreviewHtml(signature);
  container.classList.toggle("hidden", signatureHtml === "");
  if (!frameHost) return;
  frameHost.innerHTML = "";
  if (signatureHtml === "") return;

  const frame = document.createElement("iframe");
  frame.className = "signature-preview-frame";
  frame.title = "Signature";
  frame.setAttribute("sandbox", "allow-same-origin allow-popups");
  frame.addEventListener("load", () => {
    resizeMailFrame(frame);
    window.setTimeout(() => resizeMailFrame(frame), 250);
  });
  frame.srcdoc = signatureFrameDocument(signatureHtml);
  frameHost.appendChild(frame);
}

function updateSignaturePreviews() {
  renderSignaturePreview(elements.replySignaturePreview, currentAccountSignature());
  renderSignaturePreview(elements.accountSignaturePreview, elements.accountSignature?.value || "");
}

function selectedMessageId() {
  const value = Number(state.selectedMessage?.id || 0);
  return Number.isFinite(value) ? value : 0;
}

function selectedMailKey() {
  return String(state.selectedMessage?.id || "");
}

function initialMessageIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const messageId = Number(params.get("messageId") || params.get("mailId") || params.get("id") || 0);
  return Number.isFinite(messageId) && messageId > 0 ? messageId : 0;
}

function queryFromFilters() {
  const params = new URLSearchParams();
  if (state.selectedAccountId > 0) params.set("accountId", String(state.selectedAccountId));
  if (elements.filterSearch.value.trim()) params.set("search", elements.filterSearch.value.trim());
  if (elements.filterCategory.value) params.set("category", elements.filterCategory.value);
  if (elements.filterStatus.value) params.set("status", elements.filterStatus.value);
  return params;
}

async function loadDashboard() {
  const query = queryFromFilters();
  const payload = await apiRequest(`${API.messages}?${query.toString()}`);
  applyDashboard(payload);
}

async function loadMessage(messageId, activate = true) {
  const isSent = String(messageId).startsWith("sent:");
  const refresh = !isSent && state.imapAvailable ? "&refreshParts=1" : "";
  const payload = await apiRequest(`${API.messages}?action=message&id=${encodeURIComponent(messageId)}${refresh}`);
  state.selectedMessage = payload.message || null;
  state.conversation = payload.conversation || null;
  state.replyAll = false;
  state.composeMode = false;
  state.selectedConversationKey = "";
  renderDetail();
  renderReply();
  if (activate) setActiveView("detail");
}

function applyDashboard(payload) {
  state.user = payload.user || state.user;
  state.users = payload.users || [];
  state.accounts = payload.accounts || [];
  state.messages = payload.messages || [];
  state.stats = payload.stats || {};
  state.imapAvailable = Boolean(payload.imapAvailable);
  state.aiSettings = payload.aiSettings || null;
  state.selectedAccountId = Number(payload.selectedAccountId || state.selectedAccountId || 0);
  if (state.selectedMessage) {
    const refreshed = state.messages.find((item) => String(item.id) === String(state.selectedMessage.id));
    if (refreshed) state.selectedMessage = refreshed;
  }
  render();
}

function badge(value, type = "") {
  const className = `${type || value}`.replace(/[^a-z0-9_-]/gi, "");
  return `<span class="mini-pill ${className}">${escapeHtml(value)}</span>`;
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

function render() {
  renderChrome();
  renderMetrics();
  renderMessages();
  renderTriageBoard();
  renderAccountCards();
  renderDetail();
  renderReply();
  updateSignaturePreviews();
  renderAccounts();
  renderShares();
  setActiveView(state.currentView);
}

function renderChrome() {
  elements.currentUser.textContent = userLabel(state.user);
  elements.imapChip.textContent = state.imapAvailable ? "IMAP actif" : "IMAP inactif";
  elements.imapChip.className = state.imapAvailable ? "status-pill success-pill" : "status-pill warning-pill";
  elements.aiChip.textContent = state.aiSettings?.hasApiKey ? "IA active" : "IA non configuree";
  elements.aiChip.className = state.aiSettings?.hasApiKey ? "status-pill success-pill" : "status-pill muted-pill";

  const previous = String(state.selectedAccountId || "");
  elements.accountSelect.innerHTML = state.accounts.length === 0
    ? '<option value="">Aucune adresse</option>'
    : state.accounts.map((account) => {
        const selected = String(account.id) === previous ? " selected" : "";
        return `<option value="${account.id}"${selected}>${escapeHtml(account.label || account.emailAddress)}</option>`;
      }).join("");
  elements.accountSelect.value = previous;
  if (elements.composeButton) elements.composeButton.disabled = state.selectedAccountId <= 0;
  elements.syncButton.disabled = state.syncInProgress || !state.imapAvailable || state.selectedAccountId <= 0;
  elements.analyzePendingButton.disabled = !state.aiSettings?.hasApiKey || state.messages.length === 0;
}

function renderMetrics() {
  const stats = state.stats || {};
  elements.metricAccounts.textContent = String(stats.accountCount || 0);
  elements.metricMessages.textContent = String(stats.messageCount || 0);
  elements.metricNew.textContent = String(stats.newCount || 0);
  elements.metricUrgent.textContent = String(stats.urgentCount || 0);
  elements.metricAi.textContent = String(stats.aiCount || 0);
}

function renderMessages() {
  if (state.accounts.length === 0) {
    elements.messagesList.innerHTML = '<div class="empty-state">Aucune adresse mail configuree.</div>';
    return;
  }
  if (state.messages.length === 0) {
    elements.messagesList.innerHTML = '<div class="empty-state">Aucun mail pour ce filtre.</div>';
    return;
  }

  const selectedKey = selectedMailKey();
  elements.messagesList.innerHTML = state.messages.map((mail) => `
    <button class="mail-row${String(mail.id) === selectedKey ? " is-selected" : ""}" data-mail-open="${escapeAttribute(mail.id)}" type="button">
      <span class="mail-sender">
        <strong>${escapeHtml(mail.isOutgoing ? `A ${mail.recipientText || "destinataire"}` : (mail.senderName || mail.senderEmail || "Expediteur"))}</strong>
        <small>${escapeHtml(mail.isOutgoing ? (mail.accountEmail || "") : (mail.senderEmail || mail.accountEmail || ""))}</small>
      </span>
      <span class="mail-subject">
        <strong>${escapeHtml(mail.subject || "(Sans objet)")}</strong>
        <small class="mail-preview">${escapeHtml(mail.aiSummary || mail.preview || "Aucun apercu")}</small>
      </span>
      <span class="mail-tags">
        ${(mail.attachments?.length || 0) > 0 ? badge(`${mail.attachments.length} PJ`, "attachment") : ""}
        ${mail.isOutgoing ? "" : badge(labels.category[mail.category] || mail.category, mail.category)}
        ${mail.isOutgoing ? "" : badge(labels.priority[mail.priority] || mail.priority, mail.priority)}
        ${badge(labels.status[mail.status] || mail.status, mail.status)}
      </span>
    </button>
  `).join("");
}

function renderTriageBoard() {
  const categories = ["client", "vente", "gestion", "support", "finance", "spam", "autre"];
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  state.messages.forEach((mail) => {
    if (mail.isOutgoing) return;
    counts[mail.category] = (counts[mail.category] || 0) + 1;
  });

  const activeCategory = elements.filterCategory.value;
  elements.triageBoard.innerHTML = categories.map((category) => `
    <button class="triage-card${activeCategory === category ? " is-active" : ""}" data-category-filter="${category}" type="button" aria-pressed="${activeCategory === category ? "true" : "false"}">
      <strong>${escapeHtml(labels.category[category])}</strong>
      <small>${counts[category] || 0} mail(s)</small>
    </button>
  `).join("");
}

function applyCategoryShortcut(category) {
  const nextCategory = elements.filterCategory.value === category ? "" : category;
  elements.filterCategory.value = nextCategory;
  setActiveView("inbox");
  void loadDashboard()
    .then(() => showMessage(nextCategory ? `Filtre ${labels.category[nextCategory] || nextCategory} applique.` : "Filtre categorie retire.", "success"))
    .catch((error) => showMessage(error.message, "error"));
}

function renderAccountCards() {
  if (state.accounts.length === 0) {
    elements.accountCards.innerHTML = '<div class="empty-state">Aucune adresse partagee.</div>';
    return;
  }

  elements.accountCards.innerHTML = state.accounts.map((account) => `
    <article class="list-card">
      <strong>${escapeHtml(account.label || account.emailAddress)}</strong>
      <small>${escapeHtml(account.emailAddress)}${account.lastSyncAt ? ` - releve ${escapeHtml(formatDateTime(account.lastSyncAt))}` : ""}</small>
      <div class="card-tags">
        ${badge(account.isActive ? "Active" : "Inactive", account.isActive ? "success" : "danger")}
        ${badge(`${account.sharedUserIds?.length || 0} utilisateur(s)`)}
      </div>
    </article>
  `).join("");
}

function renderHeaderRow(label, value, full = false) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `
    <div class="message-header-row${full ? " full" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(text)}</strong>
    </div>
  `;
}

function renderAttachments(mail) {
  const attachments = Array.isArray(mail.attachments) ? mail.attachments : [];
  if (attachments.length === 0) return "";

  return `
    <section class="attachments-panel">
      <div class="section-heading">
        <strong>Pieces jointes</strong>
        <span>${attachments.length}</span>
      </div>
      <div class="attachments-list">
        ${attachments.map((attachment, index) => `
          <a class="attachment-card" href="${escapeHtml(attachment.url || `${API.messages}?action=attachment&id=${encodeURIComponent(mail.id)}&index=${encodeURIComponent(attachment.index ?? index)}`)}">
            ${String(attachment.contentType || "").startsWith("image/")
              ? `<img class="attachment-thumb" src="${escapeHtml(attachment.inlineUrl || attachment.url || `${API.messages}?action=attachment&id=${encodeURIComponent(mail.id)}&index=${encodeURIComponent(attachment.index ?? index)}&inline=1`)}" alt="">`
              : '<span class="attachment-icon">PJ</span>'}
            <span>
              <strong>${escapeHtml(attachment.filename || "piece-jointe")}</strong>
              <small>${attachment.isInline ? "Image integree" : "Piece jointe"} - ${escapeHtml(attachment.contentType || "fichier")} - ${escapeHtml(formatBytes(attachment.size))}</small>
            </span>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOutgoingAttachments(item) {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
  if (attachments.length === 0) return "";

  return `
    <section class="attachments-panel">
      <div class="section-heading">
        <strong>Pieces jointes envoyees</strong>
        <span>${attachments.length}</span>
      </div>
      <div class="attachments-list">
        ${attachments.map((attachment) => `
          <div class="attachment-card">
            <span class="attachment-icon">PJ</span>
            <span>
              <strong>${escapeHtml(attachment.filename || "piece-jointe")}</strong>
              <small>${escapeHtml(attachment.contentType || "fichier")} - ${escapeHtml(formatBytes(attachment.size))}</small>
            </span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function compactText(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function conversationItemKey(item) {
  const type = item.type || "incoming";
  const id = item.replyId || item.sentId || item.messageId || item.id || 0;
  return `${type}:${id}`;
}

function renderConversationItem(item) {
  const type = item.type || "incoming";
  const isIncoming = type === "incoming";
  const isReply = type === "reply";
  const itemKey = conversationItemKey(item);
  const selectedKey = state.selectedConversationKey || conversationItemKey((state.conversation?.items || []).find((candidate) => candidate.isCurrent) || {});
  const isSelected = itemKey === selectedKey;
  const title = isIncoming
    ? [item.fromName, item.fromEmail ? `<${item.fromEmail}>` : ""].filter(Boolean).join(" ") || "Expediteur"
    : `A ${item.toEmail || "destinataire"}`;
  const subtitleParts = [
    item.subject || "(Sans objet)",
    item.ccEmail ? `Cc ${item.ccEmail}` : "",
    item.bccEmail ? `Cci ${item.bccEmail}` : "",
  ].filter(Boolean);
  const preview = isIncoming ? item.preview : item.bodyText;
  const action = isIncoming && !item.isCurrent
    ? `<button class="ghost-button tiny-button" type="button" data-history-mail-open="${escapeAttribute(item.messageId)}">Ouvrir</button>`
    : "";
  const label = isIncoming ? (item.isCurrent ? "Mail ouvert" : "Recu") : (isReply ? "Reponse envoyee" : "Mail envoye");
  const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;

  return `
    <article class="conversation-item ${escapeAttribute(type)}${item.isCurrent ? " is-current" : ""}${isSelected ? " is-selected" : ""}">
      <span class="conversation-marker">${escapeHtml(label)}</span>
      <div class="conversation-content">
        <div class="conversation-head">
          <button class="conversation-title-button" type="button" data-history-item-open="${escapeAttribute(itemKey)}">${escapeHtml(title)}</button>
          <span>${escapeHtml(formatDateTime(item.date))}</span>
        </div>
        <small>${escapeHtml(subtitleParts.join(" - "))}</small>
        ${preview ? `<p>${escapeHtml(compactText(preview, isIncoming ? 180 : 260))}</p>` : ""}
        <div class="conversation-actions">
          ${attachmentCount > 0 ? badge(`${attachmentCount} PJ`, "attachment") : ""}
          ${item.status ? badge(labels.status[item.status] || item.status, item.status) : ""}
          ${item.errorMessage ? badge("Erreur", "danger") : ""}
          ${action}
        </div>
      </div>
    </article>
  `;
}

function renderConversation() {
  const conversation = state.conversation || {};
  const items = Array.isArray(conversation.items) ? conversation.items : [];
  if (items.length <= 1 && Number(conversation.replyCount || 0) <= 0 && Number(conversation.sentCount || 0) <= 0) {
    return "";
  }

  const countLabel = [
    `${Number(conversation.incomingCount || 0)} recu(s)`,
    `${Number(conversation.replyCount || 0) + Number(conversation.sentCount || 0)} envoye(s)`,
  ].join(" - ");

  return `
    <section class="conversation-panel">
      <div class="section-heading">
        <strong>Historique du fil</strong>
        <span>${escapeHtml(countLabel)}</span>
      </div>
      <div class="conversation-list">
        ${items.map(renderConversationItem).join("")}
      </div>
    </section>
  `;
}

function currentConversationItem(mail) {
  const messageId = Number(mail?.id || 0);
  const items = Array.isArray(state.conversation?.items) ? state.conversation.items : [];
  const selectedKey = state.selectedConversationKey || "";
  if (selectedKey !== "") {
    const selected = items.find((item) => conversationItemKey(item) === selectedKey);
    if (selected) return selected;
  }
  return items.find((item) => item.type === "incoming" && Number(item.messageId || 0) === messageId) || null;
}

function selectedConversationItem(mail) {
  const item = currentConversationItem(mail);
  return item?.type === "incoming" ? item : null;
}

function mailFallbackText(mail) {
  const item = currentConversationItem(mail);
  if (item && item.type !== "incoming") {
    return String(item.bodyText || "").trim();
  }

  return [mail?.bodyText, mail?.preview, item?.preview, mail?.aiSummary]
    .map((value) => String(value || "").trim())
    .find((value) => value !== "") || "";
}

function renderMailBodyMarkup(mail, bodyHtml) {
  const fallbackText = mailFallbackText(mail);
  if (bodyHtml) {
    return `
      <iframe class="mail-html-frame" data-mail-html-frame sandbox="allow-same-origin allow-popups" title="Apercu du mail"></iframe>
      ${fallbackText ? `<pre class="mail-text-body mail-text-fallback">${escapeHtml(fallbackText)}</pre>` : ""}
    `;
  }
  if (fallbackText) {
    return `<pre class="mail-text-body">${escapeHtml(fallbackText)}</pre>`;
  }

  return '<div class="mail-text-body mail-text-empty">Aucun contenu lisible pour ce mail.</div>';
}

function mailFrameDocument(bodyHtml) {
  const baseHref = escapeAttribute(window.location.href);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <base href="${baseHref}" target="_blank">
  <style>
    html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
    body { overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function resizeMailFrame(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    const body = doc.body;
    const root = doc.documentElement;
    const height = Math.max(
      body?.scrollHeight || 0,
      root?.scrollHeight || 0,
      body?.offsetHeight || 0,
      root?.offsetHeight || 0,
      320,
    );
    frame.style.height = `${height + 24}px`;
  } catch (error) {
    frame.style.height = "720px";
  }
}

function hydrateMailFrame(bodyHtml) {
  const frame = elements.mailDetail.querySelector("[data-mail-html-frame]");
  if (!frame) return;
  frame.addEventListener("load", () => {
    resizeMailFrame(frame);
    window.setTimeout(() => resizeMailFrame(frame), 250);
    window.setTimeout(() => resizeMailFrame(frame), 1000);
  });
  frame.srcdoc = mailFrameDocument(bodyHtml);
}

function emailListFromText(value) {
  const matches = String(value || "").match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase())));
}

function replyTargets(mail, replyAll = false) {
  const account = selectedAccount();
  const to = emailListFromText(mail?.senderEmail || "").slice(0, 10);
  const excluded = new Set([
    ...(account?.emailAddress ? emailListFromText(account.emailAddress) : []),
    ...(mail?.accountEmail ? emailListFromText(mail.accountEmail) : []),
    ...to,
  ]);
  const cc = [];
  if (replyAll) {
    [...emailListFromText(mail?.recipientText || ""), ...emailListFromText(mail?.ccText || "")].forEach((email) => {
      if (!excluded.has(email) && !cc.includes(email)) {
        cc.push(email);
      }
    });
  }

  return {
    to: to.join(", "),
    cc: cc.slice(0, 20).join(", "),
    bcc: "",
  };
}

function renderDetail() {
  const mail = state.selectedMessage;
  if (!mail) {
    elements.mailDetailEmpty.classList.remove("hidden");
    elements.mailDetail.classList.add("hidden");
    elements.mailTriagePanel.classList.add("hidden");
    return;
  }

  elements.mailDetailEmpty.classList.add("hidden");
  elements.mailDetail.classList.remove("hidden");
  elements.mailTriagePanel.classList.toggle("hidden", Boolean(mail.isOutgoing));
  const senderLine = [mail.senderName, mail.senderEmail ? `<${mail.senderEmail}>` : ""].filter(Boolean).join(" ");
  const activeConversationItem = currentConversationItem(mail);
  const activeIsIncoming = !mail.isOutgoing && (!activeConversationItem || activeConversationItem.type === "incoming");
  const bodyHtml = activeIsIncoming ? String(mail.bodyHtml || "").trim() : "";
  const conversationHtml = renderConversation();
  const bodyMarkup = renderMailBodyMarkup(mail, bodyHtml);
  elements.mailDetail.innerHTML = `
    <div class="detail-title">
      <div>
        <h2>${escapeHtml(mail.subject || "(Sans objet)")}</h2>
        <span class="detail-meta">${escapeHtml(formatDateTime(mail.receivedAt))}</span>
      </div>
      <div class="detail-tags">
        ${(mail.attachments?.length || 0) > 0 ? badge(`${mail.attachments.length} PJ`, "attachment") : ""}
        ${mail.isOutgoing ? "" : badge(labels.category[mail.category] || mail.category, mail.category)}
        ${mail.isOutgoing ? "" : badge(labels.priority[mail.priority] || mail.priority, mail.priority)}
        ${badge(labels.status[mail.status] || mail.status, mail.status)}
      </div>
    </div>
    <section class="message-headers">
      ${renderHeaderRow("De", senderLine || "Expediteur", true)}
      ${renderHeaderRow("A", mail.recipientText || mail.accountEmail, true)}
      ${renderHeaderRow("Cc", mail.ccText, true)}
      ${renderHeaderRow("Cci", mail.bccText, true)}
      ${renderHeaderRow("Boite", mail.accountLabel || mail.accountEmail)}
      ${renderHeaderRow("Dossier", mail.mailbox)}
    </section>
    ${activeIsIncoming ? renderAttachments(mail) : renderOutgoingAttachments(activeConversationItem || mail)}
    ${mail.aiSummary || mail.aiActions ? `
      <section class="ai-summary">
        ${mail.aiSummary ? `<strong>Synthese IA</strong><span>${escapeHtml(mail.aiSummary)}</span>` : ""}
        ${mail.aiActions ? `<strong>Actions</strong><span>${escapeHtml(mail.aiActions)}</span>` : ""}
      </section>
    ` : ""}
    ${conversationHtml ? `
      <section class="mail-reading-layout">
        <aside class="mail-history-column">${conversationHtml}</aside>
        <section class="mail-preview-column">${bodyMarkup}</section>
      </section>
    ` : `
      <section class="mail-reading-layout single">
        <section class="mail-preview-column">${bodyMarkup}</section>
      </section>
    `}
  `;
  if (bodyHtml) hydrateMailFrame(bodyHtml);
  if (mail.isOutgoing) return;

  elements.messageCategory.value = mail.category || "autre";
  elements.messagePriority.value = mail.priority || "normal";
  elements.messageStatus.value = mail.status || "triaged";
  elements.messageAssigned.innerHTML = userOptions(mail.assignedUserId || "", true);
}

function replySubject(subject) {
  const clean = String(subject || "(Sans objet)").trim();
  return /^re\s*:/i.test(clean) ? clean : `Re: ${clean}`;
}

function fillReplyDefaults(force = false, replyAll = state.replyAll) {
  const mail = state.selectedMessage;
  if (!mail || mail.isOutgoing || state.composeMode) return;
  const targets = replyTargets(mail, replyAll);
  state.replyAll = Boolean(replyAll);
  if (force || !elements.replyTo.value) elements.replyTo.value = targets.to;
  if (force || !elements.replyCc.value) elements.replyCc.value = targets.cc;
  if (force || !elements.replyBcc.value) elements.replyBcc.value = targets.bcc;
  if (force || !elements.replySubject.value) elements.replySubject.value = replySubject(mail.subject);
  if (elements.replyAllButton) {
    elements.replyAllButton.classList.toggle("is-active", state.replyAll);
  }
}

function clearReplyForm() {
  elements.replyTo.value = "";
  elements.replyCc.value = "";
  elements.replyBcc.value = "";
  elements.replySubject.value = "";
  elements.replyBody.value = "";
  clearDraftAttachments();
}

function renderReply() {
  const mail = state.selectedMessage;
  const canCompose = state.selectedAccountId > 0;
  const showPanel = state.composeMode ? canCompose : Boolean(mail && !mail.isOutgoing);
  elements.replyEmpty.classList.toggle("hidden", showPanel);
  elements.replyPanel.classList.toggle("hidden", !showPanel);
  if (elements.replyEyebrow) elements.replyEyebrow.textContent = state.composeMode ? "Ecriture" : "Reponse";
  if (elements.replyTitle) elements.replyTitle.textContent = state.composeMode ? "Nouveau mail" : "Brouillon";
  if (elements.replyAllButton) elements.replyAllButton.classList.toggle("hidden", state.composeMode);
  if (elements.generateReplyButton) elements.generateReplyButton.classList.toggle("hidden", state.composeMode);
  if (elements.replyTone) elements.replyTone.disabled = state.composeMode;
  updateSignaturePreviews();
  if (!showPanel) return;
  if (state.composeMode) {
    return;
  }
  fillReplyDefaults(false);
}

function openReply(replyAll = false) {
  if (state.selectedMessage?.isOutgoing) {
    showMessage("Ce mail envoye est deja consultable dans l historique.", "error");
    return;
  }
  const wasComposing = state.composeMode;
  state.composeMode = false;
  state.replyAll = Boolean(replyAll);
  if (wasComposing) clearReplyForm();
  fillReplyDefaults(true, state.replyAll);
  setActiveView("reply");
}

function openCompose() {
  if (state.selectedAccountId <= 0) {
    showMessage("Selectionnez une adresse mail pour ecrire.", "error");
    return;
  }
  state.composeMode = true;
  state.replyAll = false;
  clearReplyForm();
  renderReply();
  setActiveView("reply");
}

function renderShares(selectedIds = null) {
  const selected = new Set((selectedIds || []).map((value) => Number(value)));
  if (selectedIds === null) {
    const currentId = Number(elements.accountId.value || 0);
    const account = state.accounts.find((item) => Number(item.id) === currentId);
    (account?.sharedUserIds || [state.user?.id]).forEach((value) => selected.add(Number(value)));
  }

  elements.accountShares.innerHTML = state.users.map((user) => {
    const checked = selected.has(Number(user.id)) ? " checked" : "";
    return `
      <label class="share-chip">
        <input type="checkbox" value="${user.id}"${checked}>
        <span>${escapeHtml(userLabel(user))}</span>
      </label>
    `;
  }).join("");
}

function resetAccountForm() {
  elements.accountForm.reset();
  elements.accountId.value = "";
  elements.accountFormTitle.textContent = "Nouvelle adresse";
  elements.accountImapPort.value = "993";
  elements.accountImapEncryption.value = "ssl";
  elements.accountImapFolder.value = "INBOX";
  elements.accountSmtpPort.value = "587";
  elements.accountSmtpEncryption.value = "tls";
  elements.accountActive.checked = true;
  elements.accountDeactivateButton.classList.add("hidden");
  renderShares([state.user?.id].filter(Boolean));
  updateSignaturePreviews();
}

function populateAccountForm(account) {
  elements.accountId.value = account.id || "";
  elements.accountFormTitle.textContent = account.id ? "Adresse mail" : "Nouvelle adresse";
  elements.accountLabel.value = account.label || "";
  elements.accountEmail.value = account.emailAddress || "";
  elements.accountDisplayName.value = account.displayName || "";
  elements.accountUsername.value = account.username || "";
  elements.accountPassword.value = "";
  elements.accountImapHost.value = account.imapHost || "";
  elements.accountImapPort.value = account.imapPort || 993;
  elements.accountImapEncryption.value = account.imapEncryption || "ssl";
  elements.accountImapFolder.value = account.imapFolder || "INBOX";
  elements.accountSmtpHost.value = account.smtpHost || "";
  elements.accountSmtpPort.value = account.smtpPort || 587;
  elements.accountSmtpEncryption.value = account.smtpEncryption || "tls";
  elements.accountReplyTo.value = account.replyTo || "";
  elements.accountSignature.value = account.signature || "";
  elements.accountActive.checked = Boolean(account.isActive);
  elements.accountDeactivateButton.classList.toggle("hidden", !account.id);
  renderShares(account.sharedUserIds || []);
  updateSignaturePreviews();
  setActiveView("accounts");
}

function selectedShareIds() {
  return Array.from(elements.accountShares.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => Number(input.value))
    .filter((value) => value > 0);
}

function renderAccounts() {
  if (state.accounts.length === 0) {
    elements.accountsList.innerHTML = '<div class="empty-state">Aucune adresse mail.</div>';
    return;
  }

  elements.accountsList.innerHTML = state.accounts.map((account) => `
    <article class="list-card">
      <strong>${escapeHtml(account.label || account.emailAddress)}</strong>
      <small>${escapeHtml(account.emailAddress)} - IMAP ${escapeHtml(account.imapHost)}:${account.imapPort}</small>
      <small>${account.smtpHost ? `SMTP ${escapeHtml(account.smtpHost)}:${account.smtpPort}` : "SMTP non renseigne"}</small>
      <div class="card-tags">
        ${badge(account.hasPassword ? "Secret OK" : "Secret absent", account.hasPassword ? "success" : "danger")}
        ${badge(account.isActive ? "Active" : "Inactive", account.isActive ? "success" : "danger")}
      </div>
      <div class="card-actions">
        <button class="ghost-button" data-account-edit="${account.id}" type="button">Editer</button>
        <button class="ghost-button" data-account-use="${account.id}" type="button">Ouvrir</button>
      </div>
    </article>
  `).join("");
}

async function syncSelectedAccount(options = {}) {
  const silent = Boolean(options.silent);
  if (state.selectedAccountId <= 0 || !state.imapAvailable || state.syncInProgress) return;
  state.syncInProgress = true;
  renderChrome();
  if (!silent) showMessage("Releve IMAP en cours...");
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "sync_account",
        accountId: state.selectedAccountId,
        limit: Number(options.limit || 50),
      }),
    });
    applyDashboard(payload);
    if (!silent) showMessage(payload.message || payload.syncSummary?.message || "Releve termine.", "success");
  } catch (error) {
    if (!silent) showMessage(error.message || "Releve impossible.", "error");
  } finally {
    state.syncInProgress = false;
    renderChrome();
  }
}

async function analyzeSelectedMessage() {
  const messageId = selectedMessageId();
  if (messageId <= 0) return;
  elements.analyzeMessageButton.disabled = true;
  showMessage("Synthese IA en cours...");
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({ action: "analyze_message", messageId }),
    });
    state.selectedMessage = payload.mail || state.selectedMessage;
    applyDashboard(payload.dashboard || payload);
    renderDetail();
    showMessage(payload.message || "Mail analyse.", "success");
  } catch (error) {
    showMessage(error.message || "Analyse impossible.", "error");
  } finally {
    elements.analyzeMessageButton.disabled = false;
  }
}

async function analyzePendingMessages() {
  if (state.selectedAccountId <= 0) return;
  elements.analyzePendingButton.disabled = true;
  showMessage("Analyse IA des mails en attente...");
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "analyze_pending",
        accountId: state.selectedAccountId,
        limit: 5,
      }),
    });
    applyDashboard(payload);
    showMessage(payload.message || "Analyse terminee.", "success");
  } catch (error) {
    showMessage(error.message || "Analyse impossible.", "error");
  } finally {
    renderChrome();
  }
}

async function saveMessageTriage(event) {
  event.preventDefault();
  const messageId = selectedMessageId();
  if (messageId <= 0) return;
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "update_message",
        messageId,
        category: elements.messageCategory.value,
        priority: elements.messagePriority.value,
        status: elements.messageStatus.value,
        assignedUserId: Number(elements.messageAssigned.value || 0),
      }),
    });
    state.selectedMessage = payload.mail || state.selectedMessage;
    applyDashboard(payload.dashboard || payload);
    renderDetail();
    showMessage(payload.message || "Tri enregistre.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour impossible.", "error");
  }
}

async function deleteSelectedMessage() {
  const messageId = selectedMessageId();
  if (messageId <= 0) return;
  const ok = window.confirm("Supprimer ce mail de NautiMail ? Il ne reviendra pas aux prochains releves.");
  if (!ok) return;

  if (elements.deleteMessageButton) elements.deleteMessageButton.disabled = true;
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_message",
        messageId,
      }),
    });
    state.selectedMessage = null;
    state.conversation = null;
    state.replyAll = false;
    state.composeMode = false;
    applyDashboard(payload.dashboard || payload);
    renderDetail();
    renderReply();
    setActiveView("inbox");
    showMessage(payload.message || "Mail supprime.", "success");
  } catch (error) {
    showMessage(error.message || "Suppression impossible.", "error");
  } finally {
    if (elements.deleteMessageButton) elements.deleteMessageButton.disabled = false;
  }
}

async function generateReply() {
  if (state.composeMode) return;
  const messageId = selectedMessageId();
  if (messageId <= 0) return;
  elements.generateReplyButton.disabled = true;
  showMessage("Generation de la reponse IA...");
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "generate_reply",
        messageId,
        tone: elements.replyTone.value,
        replyAll: state.replyAll,
      }),
    });
    elements.replyTo.value = payload.draft?.toEmail || state.selectedMessage?.senderEmail || "";
    elements.replyCc.value = payload.draft?.ccEmail || "";
    elements.replyBcc.value = payload.draft?.bccEmail || "";
    elements.replySubject.value = payload.draft?.subject || replySubject(state.selectedMessage?.subject);
    elements.replyBody.value = payload.draft?.body || "";
    showMessage(payload.message || "Brouillon prepare.", "success");
  } catch (error) {
    showMessage(error.message || "Generation impossible.", "error");
  } finally {
    elements.generateReplyButton.disabled = false;
  }
}

async function sendReply(event) {
  event.preventDefault();
  const messageId = selectedMessageId();
  const isCompose = state.composeMode || messageId <= 0;
  const submitButton = event.submitter || elements.replySubmitButton;
  const submitLabel = submitButton?.textContent || "Envoyer";
  if (isCompose && state.selectedAccountId <= 0) {
    showMessage("Selectionnez une adresse mail pour envoyer.", "error");
    return;
  }
  if (!isCompose && messageId <= 0) return;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Envoi...";
  }
  showMessage(isCompose ? "Envoi du mail en cours..." : "Envoi de la reponse en cours...");
  try {
    const files = selectedDraftAttachments();
    let requestBody;
    if (files.length > 0) {
      requestBody = new FormData();
      requestBody.append("action", isCompose ? "send_message" : "send_reply");
      requestBody.append("accountId", String(state.selectedAccountId));
      requestBody.append("toEmail", elements.replyTo.value.trim());
      requestBody.append("ccEmail", elements.replyCc.value.trim());
      requestBody.append("bccEmail", elements.replyBcc.value.trim());
      requestBody.append("subject", elements.replySubject.value.trim());
      requestBody.append("body", elements.replyBody.value.trim());
      if (!isCompose) requestBody.append("messageId", String(messageId));
      files.forEach((file) => requestBody.append("attachments[]", file, file.name));
    } else {
      requestBody = {
        action: isCompose ? "send_message" : "send_reply",
        accountId: state.selectedAccountId,
        toEmail: elements.replyTo.value.trim(),
        ccEmail: elements.replyCc.value.trim(),
        bccEmail: elements.replyBcc.value.trim(),
        subject: elements.replySubject.value.trim(),
        body: elements.replyBody.value.trim(),
      };
      if (!isCompose) requestBody.messageId = messageId;
    }

    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: requestBody instanceof FormData ? requestBody : JSON.stringify(requestBody),
    });
    clearDraftAttachments();
    if (isCompose) {
      applyDashboard(payload.dashboard || payload);
      state.composeMode = false;
      clearReplyForm();
      if (payload.sentId) {
        try {
          await loadMessage(`sent:${payload.sentId}`, true);
        } catch (openSentError) {
          setActiveView("inbox");
        }
      } else {
        setActiveView("inbox");
      }
    } else {
      state.selectedMessage = payload.mail || state.selectedMessage;
      if (payload.dashboard) {
        applyDashboard(payload.dashboard);
      }
      try {
        await loadMessage(messageId, false);
      } catch (refreshError) {
        renderDetail();
      }
      setActiveView("detail");
    }
    showMessage(payload.message || (isCompose ? "Mail envoye." : "Reponse envoyee."), "success");
  } catch (error) {
    showMessage(error.message || "Envoi impossible.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }
}

async function saveAccount(event) {
  event.preventDefault();
  const accountId = Number(elements.accountId.value || 0);
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "save_account",
        id: accountId,
        label: elements.accountLabel.value.trim(),
        emailAddress: elements.accountEmail.value.trim(),
        displayName: elements.accountDisplayName.value.trim(),
        username: elements.accountUsername.value.trim(),
        password: elements.accountPassword.value,
        imapHost: elements.accountImapHost.value.trim(),
        imapPort: Number(elements.accountImapPort.value || 993),
        imapEncryption: elements.accountImapEncryption.value,
        imapFolder: elements.accountImapFolder.value.trim() || "INBOX",
        smtpHost: elements.accountSmtpHost.value.trim(),
        smtpPort: Number(elements.accountSmtpPort.value || 587),
        smtpEncryption: elements.accountSmtpEncryption.value,
        replyTo: elements.accountReplyTo.value.trim(),
        signature: elements.accountSignature.value.trim(),
        isActive: elements.accountActive.checked,
        sharedUserIds: selectedShareIds(),
      }),
    });
    applyDashboard(payload.dashboard || payload);
    const saved = payload.account || null;
    if (saved) populateAccountForm(saved);
    showMessage(payload.message || "Adresse enregistree.", "success");
  } catch (error) {
    showMessage(error.message || "Enregistrement impossible.", "error");
  }
}

async function deactivateAccount() {
  const accountId = Number(elements.accountId.value || 0);
  if (accountId <= 0) return;
  const ok = window.confirm("Desactiver cette adresse mail ?");
  if (!ok) return;
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({ action: "deactivate_account", accountId }),
    });
    applyDashboard(payload.dashboard || payload);
    resetAccountForm();
    showMessage(payload.message || "Adresse desactivee.", "success");
  } catch (error) {
    showMessage(error.message || "Desactivation impossible.", "error");
  }
}

async function logout() {
  try {
    await apiRequest(API.auth, { method: "DELETE" });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

function startAutoRefresh() {
  if (state.autoRefreshTimer) {
    window.clearInterval(state.autoRefreshTimer);
  }
  state.autoRefreshTimer = window.setInterval(() => {
    if (document.hidden || state.currentView === "reply") {
      return;
    }
    void loadDashboard().catch(() => {});
  }, AUTO_REFRESH_INTERVAL_MS);
}

function installListeners() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view || "inbox";
      if (view === "reply" && !state.selectedMessage) {
        openCompose();
        return;
      }
      setActiveView(view);
    });
  });

  elements.accountSelect.addEventListener("change", () => {
    state.selectedAccountId = Number(elements.accountSelect.value || 0);
    void loadDashboard().catch((error) => showMessage(error.message, "error"));
  });
  elements.composeButton?.addEventListener("click", openCompose);
  elements.syncButton.addEventListener("click", () => { void syncSelectedAccount(); });
  elements.analyzePendingButton.addEventListener("click", () => { void analyzePendingMessages(); });
  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard()
      .then(() => showMessage("Donnees actualisees.", "success"))
      .catch((error) => showMessage(error.message, "error"));
  });
  elements.logoutButton.addEventListener("click", () => { void logout(); });
  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadDashboard().catch((error) => showMessage(error.message, "error"));
  });
  elements.triageBoard.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-filter]");
    if (button) {
      applyCategoryShortcut(button.dataset.categoryFilter || "");
    }
  });

  elements.messagesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mail-open]");
    if (button) {
      void loadMessage(button.dataset.mailOpen);
    }
  });

  elements.mailDetail.addEventListener("click", (event) => {
    const itemButton = event.target.closest("[data-history-item-open]");
    if (itemButton) {
      state.selectedConversationKey = itemButton.dataset.historyItemOpen || "";
      renderDetail();
      return;
    }
    const button = event.target.closest("[data-history-mail-open]");
    if (button) {
      void loadMessage(button.dataset.historyMailOpen);
    }
  });

  elements.messageForm.addEventListener("submit", saveMessageTriage);
  elements.analyzeMessageButton.addEventListener("click", () => { void analyzeSelectedMessage(); });
  elements.openReplyButton.addEventListener("click", () => openReply(false));
  elements.openReplyAllButton.addEventListener("click", () => openReply(true));
  elements.deleteMessageButton?.addEventListener("click", () => { void deleteSelectedMessage(); });
  elements.replyAllButton?.addEventListener("click", () => openReply(!state.replyAll));
  elements.generateReplyButton?.addEventListener("click", () => { void generateReply(); });
  elements.replyForm.addEventListener("submit", sendReply);
  elements.replyAttachments?.addEventListener("change", renderDraftAttachments);
  elements.replyResetButton.addEventListener("click", () => {
    if (state.composeMode) {
      clearReplyForm();
      return;
    }
    elements.replyBody.value = "";
    fillReplyDefaults(true, state.replyAll);
  });
  elements.replyCancelButton.addEventListener("click", () => {
    if (state.composeMode) {
      state.composeMode = false;
      clearReplyForm();
      renderReply();
      setActiveView("inbox");
      return;
    }
    setActiveView(state.selectedMessage ? "detail" : "inbox");
  });

  elements.newAccountButton.addEventListener("click", resetAccountForm);
  elements.accountForm.addEventListener("submit", saveAccount);
  elements.accountSignature?.addEventListener("input", updateSignaturePreviews);
  elements.accountResetButton.addEventListener("click", resetAccountForm);
  elements.accountDeactivateButton.addEventListener("click", () => { void deactivateAccount(); });

  elements.accountsList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-account-edit]");
    const useButton = event.target.closest("[data-account-use]");
    if (editButton) {
      const account = state.accounts.find((item) => Number(item.id) === Number(editButton.dataset.accountEdit));
      if (account) populateAccountForm(account);
    }
    if (useButton) {
      state.selectedAccountId = Number(useButton.dataset.accountUse || 0);
      setActiveView("inbox");
      void loadDashboard().catch((error) => showMessage(error.message, "error"));
    }
  });
}

async function init() {
  installListeners();
  try {
    const authenticated = await fetchAuth();
    if (!authenticated) return;
    resetAccountForm();
    await loadDashboard();
    const initialMessageId = initialMessageIdFromUrl();
    if (initialMessageId > 0) {
      try {
        await loadMessage(initialMessageId, true);
      } catch (openError) {
        showMessage("Impossible d ouvrir le mail demande.", "error");
      }
    }
    startAutoRefresh();
    setView("app");
  } catch (error) {
    showMessage(error.message || "NautiMail est indisponible.", "error");
    setView("app");
  }
}

void init();
