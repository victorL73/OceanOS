const API = {
  auth: "api/auth.php",
  settings: "api/settings.php",
  invoices: "api/invoices.php",
  quotes: "api/quotes.php",
  sync: "api/sync.php",
};
const OCEANOS_URL = "/OceanOS/";

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

const STATUS_LABELS = {
  received: "Reçue",
  ready: "Prête",
  sent: "Transmise",
  accepted: "Acceptée",
  rejected: "Rejetée",
  archived: "Archivée",
};

const STATUS_CLASS = {
  received: "status-received",
  ready: "status-ready",
  sent: "status-sent",
  accepted: "status-accepted",
  rejected: "status-rejected",
  archived: "status-archived",
};

const state = {
  auth: {
    authenticated: false,
    needsSetup: false,
    user: null,
    flowceanUrl: "/OceanOS/",
  },
  settings: null,
  invoices: [],
  quotes: [],
  quoteStats: null,
  runs: [],
  stats: null,
  activeTab: "invoices",
  pagination: { page: 1, limit: 30, total: 0, pages: 1 },
  filters: {
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 30,
  },
  focusQuoteId: 0,
};

const $ = (id) => document.getElementById(id);

const elements = {
  authScreen: $("auth-screen"),
  appShell: $("app-shell"),
  authForm: $("auth-form"),
  authKicker: $("auth-kicker"),
  authTitle: $("auth-title"),
  authSubtitle: $("auth-subtitle"),
  authNameField: $("auth-name-field"),
  authName: $("auth-name"),
  authEmail: $("auth-email"),
  authPassword: $("auth-password"),
  authSubmit: $("auth-submit"),
  authMessage: $("auth-message"),
  flowceanLink: $("flowcean-link"),
  flowceanAppLink: $("flowcean-app-link"),
  currentUser: $("current-user"),
  logoutButton: $("logout-button"),
  refreshButton: $("refresh-button"),
  connectionChip: $("connection-chip"),
  tabInvoices: $("tab-invoices"),
  tabQuotes: $("tab-quotes"),
  invoicesView: $("invoices-view"),
  quotesView: $("quotes-view"),
  metricCount: $("metric-count"),
  metricTotal: $("metric-total"),
  metricReceived: $("metric-received"),
  metricRejected: $("metric-rejected"),
  quoteMetricCount: $("quote-metric-count"),
  quoteMetricSigned: $("quote-metric-signed"),
  quoteMetricConverted: $("quote-metric-converted"),
  quoteMetricTotal: $("quote-metric-total"),
  settingsForm: $("settings-form"),
  shopUrl: $("shop-url"),
  webserviceKey: $("webservice-key"),
  clearWebserviceKey: $("clear-webservice-key"),
  pdfUrlTemplate: $("pdf-url-template"),
  nautisignApiUrl: $("nautisign-api-url"),
  nautisignApiToken: $("nautisign-api-token"),
  clearNautisignApiToken: $("clear-nautisign-api-token"),
  syncWindowDays: $("sync-window-days"),
  saveSettings: $("save-settings"),
  testSettings: $("test-settings"),
  settingsMessage: $("settings-message"),
  syncButton: $("sync-button"),
  syncForm: $("sync-form"),
  syncDateFrom: $("sync-date-from"),
  syncDateTo: $("sync-date-to"),
  syncLimit: $("sync-limit"),
  syncMessage: $("sync-message"),
  filtersForm: $("filters-form"),
  filterSearch: $("filter-search"),
  filterStatus: $("filter-status"),
  filterDateFrom: $("filter-date-from"),
  filterDateTo: $("filter-date-to"),
  clearFilters: $("clear-filters"),
  exportButton: $("export-button"),
  exportPdfButton: $("export-pdf-button"),
  exportFacturxButton: $("export-facturx-button"),
  invoiceTableBody: $("invoice-table-body"),
  quotesTableBody: $("quotes-table-body"),
  syncQuotesButton: $("sync-quotes-button"),
  quotesMessage: $("quotes-message"),
  quoteJson: $("quote-json"),
  importQuoteButton: $("import-quote-button"),
  prevPage: $("prev-page"),
  nextPage: $("next-page"),
  pageLabel: $("page-label"),
  runsList: $("runs-list"),
  toast: $("toast"),
  sellerName: $("seller-name"),
  sellerVatNumber: $("seller-vat-number"),
  sellerSiret: $("seller-siret"),
  sellerStreet: $("seller-street"),
  sellerPostcode: $("seller-postcode"),
  sellerCity: $("seller-city"),
  sellerCountryIso: $("seller-country-iso"),
};

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function showMessage(element, message, type = "info") {
  element.textContent = message;
  element.dataset.type = type;
  setHidden(element, !message);
}

function toast(message) {
  elements.toast.textContent = message;
  setHidden(elements.toast, false);
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => setHidden(elements.toast, true), 3600);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { ok: response.ok, message: await response.text() };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "Requête impossible.");
  }

  return payload;
}

function filenameFromDisposition(disposition, fallback) {
  const header = String(disposition || "");
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
    } catch (error) {
      return utf8Match[1].replace(/"/g, "");
    }
  }

  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

async function downloadAuthenticatedFile(url, fallbackFilename) {
  const response = await fetch(url, { credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || contentType.includes("application/json")) {
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }

    if (response.status === 401 || payload?.error === "unauthenticated") {
      await fetchAuth().catch(() => {});
    }

    throw new Error(payload?.message || text || "Téléchargement impossible.");
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function formatMoney(value, currency = "EUR") {
  const amount = Number(value || 0);
  const safeCurrency = /^[A-Z]{3}$/.test(currency || "") ? currency : "EUR";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: safeCurrency,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function userLabel(user) {
  if (!user) return "";
  const role = user.role === "super" ? "Super" : user.role === "admin" ? "Admin" : "Membre";
  return `${user.displayName || user.email} · ${role}`;
}

function renderAuthGate() {
  if (elements.flowceanLink) {
    elements.flowceanLink.href = state.auth.flowceanUrl || "/OceanOS/";
  }

  if (state.auth.authenticated) {
    setHidden(elements.authScreen, true);
    setHidden(elements.appShell, false);
    return;
  }

  redirectToOceanOS();
  return;

  setHidden(elements.appShell, true);
  setHidden(elements.authScreen, false);
  showMessage(elements.authMessage, "");

  if (state.auth.needsSetup) {
    elements.authKicker.textContent = "Initialisation";
    elements.authTitle.textContent = "Créer le premier administrateur";
    elements.authSubtitle.textContent = "Ce compte sera enregistre dans la table utilisateurs OceanOS.";
    elements.authNameField.classList.remove("hidden");
    elements.authSubmit.textContent = "Créer le compte";
    elements.authPassword.setAttribute("autocomplete", "new-password");
  } else {
    elements.authKicker.textContent = "Connexion";
    elements.authTitle.textContent = "Connectez-vous à Invocean";
    elements.authSubtitle.textContent = "Les comptes et la session sont partages avec OceanOS.";
    elements.authNameField.classList.add("hidden");
    elements.authSubmit.textContent = "Se connecter";
    elements.authPassword.setAttribute("autocomplete", "current-password");
  }
}

async function fetchAuth() {
  const payload = await apiRequest(API.auth);
  state.auth = {
    authenticated: Boolean(payload.authenticated),
    needsSetup: Boolean(payload.needsSetup),
    flowceanUrl: payload.flowceanUrl || "/OceanOS/",
    user: payload.user || null,
  };
  renderAuthGate();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  elements.authSubmit.disabled = true;
  showMessage(elements.authMessage, "");

  try {
    const body = state.auth.needsSetup
      ? {
          action: "bootstrap",
          displayName: elements.authName.value.trim(),
          email: elements.authEmail.value.trim(),
          password: elements.authPassword.value,
        }
      : {
          action: "login",
          email: elements.authEmail.value.trim(),
          password: elements.authPassword.value,
        };

    const payload = await apiRequest(API.auth, {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.auth = {
      authenticated: Boolean(payload.authenticated),
      needsSetup: Boolean(payload.needsSetup),
      flowceanUrl: state.auth.flowceanUrl,
      user: payload.user || null,
    };
    elements.authPassword.value = "";
    renderAuthGate();
    await loadDashboard();
  } catch (error) {
    showMessage(elements.authMessage, error.message || "Connexion impossible.", "error");
  } finally {
    elements.authSubmit.disabled = false;
  }
}

async function logout() {
  try {
    await apiRequest(API.auth, { method: "DELETE" });
  } catch (error) {
    console.error(error);
  }
  state.auth = { authenticated: false, needsSetup: false, user: null, flowceanUrl: state.auth.flowceanUrl };
  localStorage.removeItem("moby_token");
  localStorage.removeItem("moby_user");
  window.location.href = OCEANOS_URL;
}

function renderChrome() {
  elements.currentUser.textContent = userLabel(state.auth.user);
  if (elements.flowceanAppLink) {
    elements.flowceanAppLink.href = state.auth.flowceanUrl || "/OceanOS/";
  }
}

function renderSettings() {
  const settings = state.settings || {};
  const canManage = Boolean(settings.canManage);
  elements.shopUrl.value = settings.shopUrl || "";
  elements.webserviceKey.value = "";
  elements.webserviceKey.placeholder = settings.hasWebserviceKey
    ? `Clé enregistrée (${settings.webserviceKeyHint || "masquée"})`
    : "Aucune clé enregistrée";
  elements.clearWebserviceKey.checked = false;
  elements.pdfUrlTemplate.value = settings.pdfUrlTemplate || "";
  elements.nautisignApiUrl.value = "";
  elements.nautisignApiToken.value = "";
  elements.clearNautisignApiToken.checked = false;
  elements.syncWindowDays.value = settings.syncWindowDays || 30;
  elements.sellerName.value = settings.sellerName || "";
  elements.sellerVatNumber.value = settings.sellerVatNumber || "";
  elements.sellerSiret.value = settings.sellerSiret || "";
  elements.sellerStreet.value = settings.sellerStreet || "";
  elements.sellerPostcode.value = settings.sellerPostcode || "";
  elements.sellerCity.value = settings.sellerCity || "";
  elements.sellerCountryIso.value = settings.sellerCountryIso || "FR";

  [
    elements.shopUrl,
    elements.webserviceKey,
    elements.clearWebserviceKey,
    elements.pdfUrlTemplate,
    elements.nautisignApiUrl,
    elements.nautisignApiToken,
    elements.clearNautisignApiToken,
    elements.syncWindowDays,
    elements.saveSettings,
    elements.testSettings,
  ].forEach((element) => {
    element.disabled = !canManage;
  });

  [
    elements.sellerName,
    elements.sellerSiret,
    elements.sellerStreet,
    elements.sellerPostcode,
    elements.sellerCity,
  ].forEach((element) => {
    element.disabled = true;
    element.title = "Information geree dans OceanOS";
  });

  [
    elements.sellerVatNumber,
    elements.sellerCountryIso,
  ].forEach((element) => {
    element.disabled = !canManage;
    element.title = "";
  });

  elements.connectionChip.textContent = settings.shopUrl && settings.hasWebserviceKey
    ? "PrestaShop connecté"
    : "PrestaShop non configuré";
  elements.connectionChip.className = settings.shopUrl && settings.hasWebserviceKey
    ? "status-pill success-pill"
    : "status-pill muted-pill";

  elements.syncButton.disabled = !canManage || !settings.shopUrl || !settings.hasWebserviceKey;
  elements.syncQuotesButton.disabled = !canManage;
  elements.importQuoteButton.disabled = !canManage;
}

async function loadSettings() {
  const payload = await apiRequest(API.settings);
  state.settings = payload.settings;
  renderSettings();
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  elements.saveSettings.disabled = true;
  showMessage(elements.settingsMessage, "");

  const body = {
    shopUrl: elements.shopUrl.value.trim(),
    pdfUrlTemplate: elements.pdfUrlTemplate.value.trim(),
    syncWindowDays: Number(elements.syncWindowDays.value || 30),
    sellerName: elements.sellerName.value.trim(),
    sellerVatNumber: elements.sellerVatNumber.value.trim(),
    sellerSiret: elements.sellerSiret.value.trim(),
    sellerStreet: elements.sellerStreet.value.trim(),
    sellerPostcode: elements.sellerPostcode.value.trim(),
    sellerCity: elements.sellerCity.value.trim(),
    sellerCountryIso: elements.sellerCountryIso.value.trim(),
    nautisignApiUrl: elements.nautisignApiUrl.value.trim(),
    clearNautisignApiToken: elements.clearNautisignApiToken.checked,
    clearWebserviceKey: elements.clearWebserviceKey.checked,
  };
  if (elements.webserviceKey.value.trim()) {
    body.webserviceKey = elements.webserviceKey.value.trim();
  }
  if (elements.nautisignApiToken.value.trim()) {
    body.nautisignApiToken = elements.nautisignApiToken.value.trim();
  }

  try {
    const payload = await apiRequest(API.settings, {
      method: "POST",
      body: JSON.stringify(body),
    });
    state.settings = payload.settings;
    renderSettings();
    showMessage(elements.settingsMessage, payload.message || "Configuration enregistrée.", "success");
    toast("Configuration enregistrée.");
  } catch (error) {
    showMessage(elements.settingsMessage, error.message || "Enregistrement impossible.", "error");
  } finally {
    elements.saveSettings.disabled = false;
    renderSettings();
  }
}

async function testSettings() {
  elements.testSettings.disabled = true;
  showMessage(elements.settingsMessage, "");

  const body = {
    action: "test",
    shopUrl: elements.shopUrl.value.trim(),
  };
  if (elements.webserviceKey.value.trim()) {
    body.webserviceKey = elements.webserviceKey.value.trim();
  }

  try {
    const payload = await apiRequest(API.settings, {
      method: "POST",
      body: JSON.stringify(body),
    });
    showMessage(elements.settingsMessage, payload.message || "Connexion valide.", "success");
    toast("Connexion PrestaShop validée.");
  } catch (error) {
    showMessage(elements.settingsMessage, error.message || "Test impossible.", "error");
  } finally {
    elements.testSettings.disabled = false;
    renderSettings();
  }
}

function invoiceQuery(extra = {}) {
  const params = new URLSearchParams();
  const merged = { ...state.filters, ...extra };
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      params.set(key, value);
    }
  });
  return params;
}

async function loadInvoices() {
  const payload = await apiRequest(`${API.invoices}?${invoiceQuery().toString()}`);
  state.invoices = payload.invoices || [];
  state.pagination = payload.pagination || state.pagination;
  state.stats = payload.stats || null;
  state.runs = payload.runs || [];
  renderInvoices();
  renderRuns();
  renderMetrics();
}

async function loadDashboard() {
  renderChrome();
  await loadSettings();
  await loadInvoices();
  await loadQuotes();
}

function renderMetrics() {
  const stats = state.stats || {};
  elements.metricCount.textContent = String(stats.invoiceCount || 0);
  elements.metricTotal.textContent = formatMoney(stats.totalTaxIncl || 0);
  elements.metricReceived.textContent = String(stats.receivedCount || 0);
  elements.metricRejected.textContent = String(stats.rejectedCount || 0);
}

async function loadQuotes() {
  const payload = await apiRequest(API.quotes);
  state.quotes = payload.quotes || [];
  state.quoteStats = payload.stats || null;
  renderQuoteMetrics();
  renderQuotes();
}

function renderQuoteMetrics() {
  const stats = state.quoteStats || {};
  elements.quoteMetricCount.textContent = String(stats.quoteCount || 0);
  elements.quoteMetricSigned.textContent = String(stats.signedCount || 0);
  elements.quoteMetricConverted.textContent = String(stats.convertedCount || 0);
  elements.quoteMetricTotal.textContent = formatMoney(stats.totalTaxIncl || 0);
}

function createCell(text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function createStatusSelect(invoice) {
  const select = document.createElement("select");
  select.className = `status-select ${STATUS_CLASS[invoice.status] || ""}`;
  Object.entries(STATUS_LABELS).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === invoice.status;
    select.append(option);
  });
  select.addEventListener("change", () => updateInvoiceStatus(invoice.id, select.value));
  return select;
}

function renderInvoices() {
  elements.invoiceTableBody.innerHTML = "";

  if (!state.invoices.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "empty-cell";
    cell.textContent = "Aucune facture pour cette sélection.";
    row.append(cell);
    elements.invoiceTableBody.append(row);
  }

  state.invoices.forEach((invoice) => {
    const row = document.createElement("tr");

    const invoiceCell = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = invoice.invoiceNumber || `PS-${invoice.prestashopInvoiceId}`;
    const meta = document.createElement("span");
    meta.className = "table-meta";
    meta.textContent = invoice.channel === "nautisign"
      ? `Depuis devis ${invoice.orderReference || invoice.orderId}`
      : `ID PrestaShop ${invoice.prestashopInvoiceId}`;
    invoiceCell.append(strong, meta);

    const clientCell = document.createElement("td");
    const clientName = document.createElement("strong");
    clientName.textContent = invoice.customerCompany || invoice.customerName || "Client";
    const clientMeta = document.createElement("span");
    clientMeta.className = "table-meta";
    clientMeta.textContent = invoice.customerEmail || invoice.vatNumber || "—";
    clientCell.append(clientName, clientMeta);

    const statusCell = document.createElement("td");
    statusCell.append(createStatusSelect(invoice));

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions-cell";
    const pdfLink = document.createElement("a");
    pdfLink.className = "table-link";
    const pdfDownloadUrl = `${API.invoices}?download=pdf&id=${encodeURIComponent(invoice.id)}`;
    pdfLink.href = pdfDownloadUrl;
    pdfLink.textContent = invoice.pdfReady ? "PDF" : "Récupérer PDF";
    pdfLink.addEventListener("click", (event) => {
      event.preventDefault();
      void downloadAuthenticatedFile(pdfDownloadUrl, `${invoice.invoiceNumber || invoice.id}.pdf`)
        .then(() => {
          toast("PDF téléchargé.");
          return loadInvoices();
        })
        .catch((error) => toast(error.message || "Téléchargement PDF impossible."));
    });
    actionsCell.append(pdfLink);
    const facturxLink = document.createElement("a");
    facturxLink.className = "table-link";
    const facturxDownloadUrl = `${API.invoices}?download=facturx&id=${encodeURIComponent(invoice.id)}`;
    facturxLink.href = facturxDownloadUrl;
    facturxLink.textContent = "Factur-X";
    facturxLink.addEventListener("click", (event) => {
      event.preventDefault();
      void downloadAuthenticatedFile(facturxDownloadUrl, `${invoice.invoiceNumber || invoice.id}-factur-x.pdf`)
        .then(() => {
          toast("Factur-X téléchargé.");
          return loadInvoices();
        })
        .catch((error) => toast(error.message || "Téléchargement Factur-X impossible."));
    });
    actionsCell.append(facturxLink);

    row.append(
      invoiceCell,
      createCell(formatDate(invoice.invoiceDate)),
      clientCell,
      createCell(invoice.orderReference || String(invoice.orderId)),
      createCell(formatMoney(invoice.totalTaxIncl, invoice.currencyIso), "amount-cell"),
      statusCell,
      actionsCell,
    );
    elements.invoiceTableBody.append(row);
  });

  const page = state.pagination.page || 1;
  const pages = Math.max(1, state.pagination.pages || 1);
  elements.pageLabel.textContent = `Page ${page} / ${pages}`;
  elements.prevPage.disabled = page <= 1;
  elements.nextPage.disabled = page >= pages;
}

function quoteStatusLabel(status) {
  if (status === "converted") return "Converti";
  if (status === "ignored") return "Ignoré";
  return "Signé";
}

function renderQuotes() {
  elements.quotesTableBody.innerHTML = "";

  if (!state.quotes.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-cell";
    cell.textContent = "Aucun devis signé récupéré.";
    row.append(cell);
    elements.quotesTableBody.append(row);
    return;
  }

  state.quotes.forEach((quote) => {
    const row = document.createElement("tr");
    row.dataset.quoteId = String(quote.id);
    row.classList.toggle("is-focused", Number(quote.id) === Number(state.focusQuoteId));

    const quoteCell = document.createElement("td");
    const quoteTitle = document.createElement("strong");
    quoteTitle.textContent = quote.quoteNumber || quote.externalId || `Devis ${quote.id}`;
    const quoteMeta = document.createElement("span");
    quoteMeta.className = "table-meta";
    quoteMeta.textContent = quote.source === "nautisign" ? "Nautisign" : "Import manuel";
    quoteCell.append(quoteTitle, quoteMeta);

    const clientCell = document.createElement("td");
    const clientName = document.createElement("strong");
    clientName.textContent = quote.customerCompany || quote.customerName || "Client";
    const clientMeta = document.createElement("span");
    clientMeta.className = "table-meta";
    clientMeta.textContent = quote.customerEmail || quote.vatNumber || "—";
    clientCell.append(clientName, clientMeta);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status-badge quote-status-${quote.status || "signed"}`;
    status.textContent = quoteStatusLabel(quote.status);
    statusCell.append(status);

    const actionCell = document.createElement("td");
    actionCell.className = "actions-cell";
    if (quote.status === "converted") {
      const link = document.createElement("a");
      link.className = "table-link";
      link.href = `${API.invoices}?download=facturx&id=${encodeURIComponent(quote.invoiceId)}`;
      link.textContent = quote.invoiceNumber ? `Facture ${quote.invoiceNumber}` : "Facture";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void downloadAuthenticatedFile(link.href, `${quote.invoiceNumber || quote.invoiceId}-factur-x.pdf`)
          .catch((error) => toast(error.message || "Téléchargement impossible."));
      });
      actionCell.append(link);
    } else {
      const button = document.createElement("button");
      button.className = "primary-button small-button";
      button.type = "button";
      button.textContent = "Transformer";
      button.addEventListener("click", () => { void convertQuote(quote.id); });
      actionCell.append(button);
    }

    row.append(
      quoteCell,
      createCell(formatDateTime(quote.signedAt || quote.quoteDate)),
      clientCell,
      createCell(formatMoney(quote.totalTaxIncl, quote.currencyIso), "amount-cell"),
      statusCell,
      actionCell,
    );
    elements.quotesTableBody.append(row);
  });
  focusQuoteRow();
}

async function syncQuotes() {
  elements.syncQuotesButton.disabled = true;
  showMessage(elements.quotesMessage, "Lecture des devis signés Nautisign...");

  try {
    const payload = await apiRequest(API.quotes, {
      method: "POST",
      body: JSON.stringify({ action: "sync" }),
    });
    state.quotes = payload.quotes || [];
    state.quoteStats = payload.stats || null;
    renderQuoteMetrics();
    renderQuotes();
    showMessage(elements.quotesMessage, payload.message || "Devis récupérés.", "success");
    toast("Devis Nautisign récupérés.");
  } catch (error) {
    showMessage(elements.quotesMessage, error.message || "Lecture Nautisign impossible.", "error");
  } finally {
    renderSettings();
  }
}

async function importQuoteJson() {
  const raw = elements.quoteJson.value.trim();
  if (!raw) {
    showMessage(elements.quotesMessage, "Collez un devis JSON avant d'importer.", "error");
    return;
  }

  elements.importQuoteButton.disabled = true;
  showMessage(elements.quotesMessage, "");
  try {
    const payload = await apiRequest(API.quotes, {
      method: "POST",
      body: JSON.stringify({ action: "import", quote: raw }),
    });
    state.quotes = payload.quotes || [];
    state.quoteStats = payload.stats || null;
    elements.quoteJson.value = "";
    renderQuoteMetrics();
    renderQuotes();
    showMessage(elements.quotesMessage, payload.message || "Devis importé.", "success");
    toast("Devis importé.");
  } catch (error) {
    showMessage(elements.quotesMessage, error.message || "Import impossible.", "error");
  } finally {
    renderSettings();
  }
}

async function convertQuote(id) {
  showMessage(elements.quotesMessage, "Transformation en facture...");
  try {
    const payload = await apiRequest(API.quotes, {
      method: "POST",
      body: JSON.stringify({ action: "convert", id }),
    });
    state.quotes = payload.quotes || [];
    state.quoteStats = payload.stats || null;
    renderQuoteMetrics();
    renderQuotes();
    await loadInvoices();
    showMessage(elements.quotesMessage, payload.message || "Facture créée.", "success");
    toast("Facture créée depuis le devis.");
  } catch (error) {
    showMessage(elements.quotesMessage, error.message || "Transformation impossible.", "error");
  }
}

async function updateInvoiceStatus(id, status) {
  try {
    await apiRequest(API.invoices, {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    toast("Statut mis à jour.");
    await loadInvoices();
  } catch (error) {
    toast(error.message || "Mise à jour impossible.");
    await loadInvoices();
  }
}

function renderRuns() {
  elements.runsList.innerHTML = "";

  if (!state.runs.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aucune synchronisation enregistrée.";
    elements.runsList.append(empty);
    return;
  }

  state.runs.forEach((run) => {
    const item = document.createElement("article");
    item.className = `run-item run-${run.status}`;

    const top = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = run.status === "success" ? "Succès" : run.status === "failed" ? "Échec" : "En cours";
    const date = document.createElement("span");
    date.textContent = formatDateTime(run.finishedAt || run.startedAt);
    top.append(title, date);

    const body = document.createElement("p");
    body.textContent = run.message || `${run.invoicesSeen} facture(s) lue(s).`;

    item.append(top, body);
    elements.runsList.append(item);
  });
}

async function syncInvoices() {
  elements.syncButton.disabled = true;
  showMessage(elements.syncMessage, "Synchronisation en cours...");

  try {
    const payload = await apiRequest(API.sync, {
      method: "POST",
      body: JSON.stringify({
        dateFrom: elements.syncDateFrom.value,
        dateTo: elements.syncDateTo.value,
        limit: Number(elements.syncLimit.value || 80),
      }),
    });
    showMessage(elements.syncMessage, payload.message || "Synchronisation terminée.", "success");
    toast("Synchronisation terminée.");
    state.runs = payload.runs || state.runs;
    await loadInvoices();
  } catch (error) {
    showMessage(elements.syncMessage, error.message || "Synchronisation impossible.", "error");
  } finally {
    renderSettings();
  }
}

function applyFiltersFromForm() {
  state.filters = {
    ...state.filters,
    search: elements.filterSearch.value.trim(),
    status: elements.filterStatus.value,
    dateFrom: elements.filterDateFrom.value,
    dateTo: elements.filterDateTo.value,
    page: 1,
  };
}

async function exportCsv() {
  const params = invoiceQuery({ export: "csv", page: "", limit: "" });
  await downloadAuthenticatedFile(`${API.invoices}?${params.toString()}`, "invocean-factures.csv");
  toast("Export CSV téléchargé.");
}

async function exportPdf() {
  const params = invoiceQuery({ export: "pdf", page: "", limit: "" });
  await downloadAuthenticatedFile(`${API.invoices}?${params.toString()}`, "invocean-pdf.zip");
  toast("Export PDF téléchargé.");
}

async function exportFacturx() {
  const params = invoiceQuery({ export: "facturx", page: "", limit: "" });
  await downloadAuthenticatedFile(`${API.invoices}?${params.toString()}`, "invocean-factur-x.zip");
  toast("Export Factur-X PDF téléchargé.");
}

function switchTab(tab) {
  state.activeTab = tab === "quotes" ? "quotes" : "invoices";
  const showQuotes = state.activeTab === "quotes";
  setHidden(elements.invoicesView, showQuotes);
  setHidden(elements.quotesView, !showQuotes);
  elements.tabInvoices.classList.toggle("active", !showQuotes);
  elements.tabQuotes.classList.toggle("active", showQuotes);
}

function applyInitialRouteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const quoteId = Number(params.get("quote") || 0);
  const tab = params.get("tab");

  if (quoteId > 0) {
    state.focusQuoteId = quoteId;
    switchTab("quotes");
  } else if (tab === "quotes") {
    switchTab("quotes");
  }
}

function focusQuoteRow() {
  if (!state.focusQuoteId || state.activeTab !== "quotes") return;
  window.requestAnimationFrame(() => {
    const row = elements.quotesTableBody.querySelector(`[data-quote-id="${state.focusQuoteId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function installListeners() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.logoutButton.addEventListener("click", logout);
  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard().then(() => toast("Données actualisées.")).catch((error) => toast(error.message));
  });
  elements.settingsForm.addEventListener("submit", handleSettingsSubmit);
  elements.testSettings.addEventListener("click", () => { void testSettings(); });
  elements.syncButton.addEventListener("click", () => { void syncInvoices(); });
  elements.syncQuotesButton.addEventListener("click", () => { void syncQuotes(); });
  elements.importQuoteButton.addEventListener("click", () => { void importQuoteJson(); });
  elements.tabInvoices.addEventListener("click", () => switchTab("invoices"));
  elements.tabQuotes.addEventListener("click", () => switchTab("quotes"));
  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFiltersFromForm();
    void loadInvoices();
  });
  elements.clearFilters.addEventListener("click", () => {
    elements.filtersForm.reset();
    state.filters = { search: "", status: "", dateFrom: "", dateTo: "", page: 1, limit: 30 };
    void loadInvoices();
  });
  elements.exportButton.addEventListener("click", () => {
    void exportCsv().catch((error) => toast(error.message || "Export CSV impossible."));
  });
  elements.exportPdfButton.addEventListener("click", () => {
    void exportPdf().catch((error) => toast(error.message || "Export PDF impossible."));
  });
  elements.exportFacturxButton.addEventListener("click", () => {
    void exportFacturx().catch((error) => toast(error.message || "Export Factur-X impossible."));
  });
  elements.prevPage.addEventListener("click", () => {
    if ((state.pagination.page || 1) > 1) {
      state.filters.page = (state.pagination.page || 1) - 1;
      void loadInvoices();
    }
  });
  elements.nextPage.addEventListener("click", () => {
    if ((state.pagination.page || 1) < (state.pagination.pages || 1)) {
      state.filters.page = (state.pagination.page || 1) + 1;
      void loadInvoices();
    }
  });
}

async function init() {
  installListeners();
  try {
    await fetchAuth();
    if (state.auth.authenticated) {
      applyInitialRouteFromUrl();
      await loadDashboard();
    }
  } catch (error) {
    redirectToOceanOS();
  }
}

void init();
