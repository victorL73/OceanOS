const API = {
  auth: "api/auth.php",
  messages: "api/messages.php",
};

const OCEANOS_URL = "/OceanOS/";
const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  imapChip: $("imap-chip"),
  aiChip: $("ai-chip"),
  currentUser: $("current-user"),
  accountSelect: $("account-select"),
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
  replyEmpty: $("reply-empty"),
  replyPanel: $("reply-panel"),
  replyTone: $("reply-tone"),
  replyAllButton: $("reply-all-button"),
  generateReplyButton: $("generate-reply-button"),
  replyForm: $("reply-form"),
  replyTo: $("reply-to"),
  replyCc: $("reply-cc"),
  replyBcc: $("reply-bcc"),
  replySubject: $("reply-subject"),
  replyBody: $("reply-body"),
  replyResetButton: $("reply-reset-button"),
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
  stats: {},
  currentView: "inbox",
  imapAvailable: false,
  aiSettings: null,
  replyAll: false,
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

function selectedAccount() {
  return state.accounts.find((account) => Number(account.id) === Number(state.selectedAccountId)) || null;
}

function selectedMessageId() {
  return Number(state.selectedMessage?.id || 0);
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
  const refresh = state.imapAvailable ? "&refreshParts=1" : "";
  const payload = await apiRequest(`${API.messages}?action=message&id=${encodeURIComponent(messageId)}${refresh}`);
  state.selectedMessage = payload.message || null;
  state.replyAll = false;
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
    const refreshed = state.messages.find((item) => Number(item.id) === Number(state.selectedMessage.id));
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
  elements.syncButton.disabled = !state.imapAvailable || state.selectedAccountId <= 0;
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

  const selectedId = selectedMessageId();
  elements.messagesList.innerHTML = state.messages.map((mail) => `
    <button class="mail-row${Number(mail.id) === selectedId ? " is-selected" : ""}" data-mail-open="${mail.id}" type="button">
      <span class="mail-sender">
        <strong>${escapeHtml(mail.senderName || mail.senderEmail || "Expediteur")}</strong>
        <small>${escapeHtml(mail.senderEmail || mail.accountEmail || "")}</small>
      </span>
      <span class="mail-subject">
        <strong>${escapeHtml(mail.subject || "(Sans objet)")}</strong>
        <small class="mail-preview">${escapeHtml(mail.aiSummary || mail.preview || "Aucun apercu")}</small>
      </span>
      <span class="mail-tags">
        ${(mail.attachments?.length || 0) > 0 ? badge(`${mail.attachments.length} PJ`, "attachment") : ""}
        ${badge(labels.category[mail.category] || mail.category, mail.category)}
        ${badge(labels.priority[mail.priority] || mail.priority, mail.priority)}
        ${badge(labels.status[mail.status] || mail.status, mail.status)}
      </span>
    </button>
  `).join("");
}

function renderTriageBoard() {
  const categories = ["client", "vente", "gestion", "support", "finance", "spam", "autre"];
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  state.messages.forEach((mail) => {
    counts[mail.category] = (counts[mail.category] || 0) + 1;
  });

  elements.triageBoard.innerHTML = categories.map((category) => `
    <article class="triage-card">
      <strong>${escapeHtml(labels.category[category])}</strong>
      <small>${counts[category] || 0} mail(s)</small>
    </article>
  `).join("");
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
  elements.mailTriagePanel.classList.remove("hidden");
  const senderLine = [mail.senderName, mail.senderEmail ? `<${mail.senderEmail}>` : ""].filter(Boolean).join(" ");
  const bodyHtml = String(mail.bodyHtml || "").trim();
  elements.mailDetail.innerHTML = `
    <div class="detail-title">
      <div>
        <h2>${escapeHtml(mail.subject || "(Sans objet)")}</h2>
        <span class="detail-meta">${escapeHtml(formatDateTime(mail.receivedAt))}</span>
      </div>
      <div class="detail-tags">
        ${(mail.attachments?.length || 0) > 0 ? badge(`${mail.attachments.length} PJ`, "attachment") : ""}
        ${badge(labels.category[mail.category] || mail.category, mail.category)}
        ${badge(labels.priority[mail.priority] || mail.priority, mail.priority)}
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
    ${renderAttachments(mail)}
    ${mail.aiSummary || mail.aiActions ? `
      <section class="ai-summary">
        ${mail.aiSummary ? `<strong>Synthese IA</strong><span>${escapeHtml(mail.aiSummary)}</span>` : ""}
        ${mail.aiActions ? `<strong>Actions</strong><span>${escapeHtml(mail.aiActions)}</span>` : ""}
      </section>
    ` : ""}
    ${bodyHtml
      ? `<section class="mail-html-body">${bodyHtml}</section>`
      : `<pre class="mail-text-body">${escapeHtml(mail.bodyText || mail.preview || "")}</pre>`}
  `;

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
  if (!mail) return;
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

function renderReply() {
  const mail = state.selectedMessage;
  elements.replyEmpty.classList.toggle("hidden", Boolean(mail));
  elements.replyPanel.classList.toggle("hidden", !mail);
  if (mail) fillReplyDefaults(false);
}

function openReply(replyAll = false) {
  state.replyAll = Boolean(replyAll);
  fillReplyDefaults(true, state.replyAll);
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

async function syncSelectedAccount() {
  if (state.selectedAccountId <= 0) return;
  elements.syncButton.disabled = true;
  showMessage("Releve IMAP en cours...");
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "sync_account",
        accountId: state.selectedAccountId,
        limit: 50,
      }),
    });
    applyDashboard(payload);
    showMessage(payload.message || payload.syncSummary?.message || "Releve termine.", "success");
  } catch (error) {
    showMessage(error.message || "Releve impossible.", "error");
  } finally {
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

async function generateReply() {
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
  if (messageId <= 0) return;
  try {
    const payload = await apiRequest(API.messages, {
      method: "POST",
      body: JSON.stringify({
        action: "send_reply",
        messageId,
        toEmail: elements.replyTo.value.trim(),
        ccEmail: elements.replyCc.value.trim(),
        bccEmail: elements.replyBcc.value.trim(),
        subject: elements.replySubject.value.trim(),
        body: elements.replyBody.value.trim(),
      }),
    });
    state.selectedMessage = payload.mail || state.selectedMessage;
    applyDashboard(payload.dashboard || payload);
    showMessage(payload.message || "Reponse envoyee.", "success");
  } catch (error) {
    showMessage(error.message || "Envoi impossible.", "error");
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

function installListeners() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view || "inbox"));
  });

  elements.accountSelect.addEventListener("change", () => {
    state.selectedAccountId = Number(elements.accountSelect.value || 0);
    void loadDashboard().catch((error) => showMessage(error.message, "error"));
  });
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

  elements.messagesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mail-open]");
    if (button) {
      void loadMessage(button.dataset.mailOpen);
    }
  });

  elements.messageForm.addEventListener("submit", saveMessageTriage);
  elements.analyzeMessageButton.addEventListener("click", () => { void analyzeSelectedMessage(); });
  elements.openReplyButton.addEventListener("click", () => openReply(false));
  elements.openReplyAllButton.addEventListener("click", () => openReply(true));
  elements.replyAllButton.addEventListener("click", () => openReply(!state.replyAll));
  elements.generateReplyButton.addEventListener("click", () => { void generateReply(); });
  elements.replyForm.addEventListener("submit", sendReply);
  elements.replyResetButton.addEventListener("click", () => {
    elements.replyBody.value = "";
    fillReplyDefaults(true, state.replyAll);
  });

  elements.newAccountButton.addEventListener("click", resetAccountForm);
  elements.accountForm.addEventListener("submit", saveAccount);
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
    setView("app");
  } catch (error) {
    showMessage(error.message || "NautiMail est indisponible.", "error");
    setView("app");
  }
}

void init();
