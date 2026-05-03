const API = {
  auth: "api/auth.php",
  finance: "api/finance.php",
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
  periodForm: $("period-form"),
  periodStart: $("period-start"),
  periodEnd: $("period-end"),
  fundsSpotlight: $("funds-spotlight"),
  fundsAvailable: $("funds-available"),
  fundsCaption: $("funds-caption"),
  fundsBar: $("funds-bar"),
  fundsVatBar: $("funds-vat-bar"),
  fundsAfterVat: $("funds-after-vat"),
  fundsVatReserve: $("funds-vat-reserve"),
  fundsOut: $("funds-out"),
  metricCash: $("metric-cash"),
  metricRevenue: $("metric-revenue"),
  metricSuppliers: $("metric-suppliers"),
  metricProfit: $("metric-profit"),
  metricVat: $("metric-vat"),
  tabs: Array.from(document.querySelectorAll("[data-view]")),
  sections: Array.from(document.querySelectorAll("[data-view-section]")),
  cashChart: $("cash-chart"),
  profitChart: $("profit-chart"),
  vatChart: $("vat-chart"),
  summaryList: $("summary-list"),
  warningList: $("warning-list"),
  entryForm: $("entry-form"),
  entryId: $("entry-id"),
  entryType: $("entry-type"),
  entryDirection: $("entry-direction"),
  entryTaxScope: $("entry-tax-scope"),
  entryDate: $("entry-date"),
  entryLabel: $("entry-label"),
  entryCounterparty: $("entry-counterparty"),
  entryAmountHt: $("entry-amount-ht"),
  entryTaxRate: $("entry-tax-rate"),
  entryTaxAmount: $("entry-tax-amount"),
  entryAmountTtc: $("entry-amount-ttc"),
  entryNotes: $("entry-notes"),
  entryAttachments: $("entry-attachments"),
  entrySave: $("entry-save"),
  entryReset: $("entry-reset"),
  entriesList: $("entries-list"),
  expenseForm: $("expense-form"),
  expenseId: $("expense-id"),
  expenseEmployee: $("expense-employee"),
  expenseStatus: $("expense-status"),
  expenseDate: $("expense-date"),
  expenseReimbursedAt: $("expense-reimbursed-at"),
  expenseLabel: $("expense-label"),
  expenseMerchant: $("expense-merchant"),
  expenseTaxScope: $("expense-tax-scope"),
  expenseTaxRate: $("expense-tax-rate"),
  expenseAmountHt: $("expense-amount-ht"),
  expenseTaxAmount: $("expense-tax-amount"),
  expenseAmountTtc: $("expense-amount-ttc"),
  expenseReceipt: $("expense-receipt"),
  expenseNotes: $("expense-notes"),
  expenseSave: $("expense-save"),
  expenseReset: $("expense-reset"),
  expenseCount: $("expense-count"),
  expenseList: $("expense-list"),
  ordersCount: $("orders-count"),
  ordersList: $("orders-list"),
  supplierCount: $("supplier-count"),
  supplierOrdersList: $("supplier-orders-list"),
  convertedCount: $("converted-count"),
  convertedQuotesList: $("converted-quotes-list"),
  vatCards: $("vat-cards"),
  settingsForm: $("settings-form"),
  settingSalesRate: $("setting-sales-rate"),
  settingPurchaseRate: $("setting-purchase-rate"),
  settingOrderLimit: $("setting-order-limit"),
  settingsSave: $("settings-save"),
};

const state = {
  user: null,
  dashboard: null,
  currentView: "dashboard",
};

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

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

function parseNumber(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${numberFormat.format(size / 1024)} Ko`;
  return `${numberFormat.format(size / (1024 * 1024))} Mo`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateWithinPeriod(date, start, end) {
  if (!date) return false;
  return (!start || date >= start) && (!end || date <= end);
}

function defaultEntryDate() {
  const today = todayIso();
  const start = elements.periodStart.value || "";
  const end = elements.periodEnd.value || "";
  if (dateWithinPeriod(today, start, end)) return today;
  return end || start || today;
}

function moduleUrl(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      search.set(key, String(value));
    }
  });
  return `${path}${search.toString() ? `?${search.toString()}` : ""}`;
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function setMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function setActiveView(view) {
  state.currentView = view || "dashboard";
  elements.tabs.forEach((button) => {
    const active = button.dataset.view === state.currentView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.sections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== state.currentView);
  });
  if (state.currentView === "dashboard" && state.dashboard) {
    window.requestAnimationFrame(renderCharts);
  }
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

function periodQuery(overrides = {}) {
  const params = new URLSearchParams();
  const start = overrides.start ?? elements.periodStart.value;
  const end = overrides.end ?? elements.periodEnd.value;
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return params.toString();
}

function periodForEntryDate(date) {
  let start = elements.periodStart.value || date;
  let end = elements.periodEnd.value || date;
  if (date) {
    if (!start || date < start) start = date;
    if (!end || date > end) end = date;
  }

  return {
    query: periodQuery({ start, end }),
    expanded: start !== (elements.periodStart.value || "") || end !== (elements.periodEnd.value || ""),
  };
}

async function loadDashboard() {
  const query = periodQuery();
  const payload = await apiRequest(query ? `${API.finance}?${query}` : API.finance);
  applyDashboard(payload);
}

function applyDashboard(payload) {
  state.dashboard = payload;
  state.user = payload.user || state.user;

  const userLabel = state.user?.displayName || state.user?.email || "Utilisateur";
  elements.currentUser.textContent = `${userLabel} - ${state.user?.role || "membre"}`;

  if (payload.period) {
    elements.periodStart.value = payload.period.start || "";
    elements.periodEnd.value = payload.period.end || "";
    const editingEntry = Boolean(elements.entryId.value);
    const hasDraft = Boolean(elements.entryLabel.value.trim() || elements.entryAmountHt.value || elements.entryAmountTtc.value);
    if (!editingEntry && !hasDraft) {
      elements.entryDate.value = defaultEntryDate();
    }
    const editingExpense = Boolean(elements.expenseId.value);
    const hasExpenseDraft = Boolean(elements.expenseEmployee.value.trim() || elements.expenseLabel.value.trim() || elements.expenseAmountTtc.value);
    if (!editingExpense && !hasExpenseDraft) {
      elements.expenseDate.value = defaultEntryDate();
    }
  }

  const connected = Boolean(payload.prestashop?.connected);
  elements.connectionChip.textContent = connected ? "PrestaShop connecte" : "PrestaShop non configure";
  elements.connectionChip.classList.toggle("success-pill", connected);
  elements.connectionChip.classList.toggle("muted-pill", !connected);

  const summary = payload.summary || {};
  const cashAfterVat = Number(summary.cashBalance || 0) - Math.max(0, Number(summary.vatDue || 0));
  elements.metricCash.textContent = formatMoney(cashAfterVat);
  elements.metricRevenue.textContent = formatMoney(summary.revenueTaxExcl);
  elements.metricSuppliers.textContent = formatMoney(summary.supplierOrdersTaxExcl);
  elements.metricProfit.textContent = formatMoney(summary.estimatedProfitTaxExcl);
  elements.metricVat.textContent = formatMoney(summary.vatDue);
  elements.metricCash.closest(".metric-card").classList.toggle("negative", cashAfterVat < 0);
  elements.metricProfit.closest(".metric-card").classList.toggle("negative", Number(summary.estimatedProfitTaxExcl || 0) < 0);
  elements.metricVat.closest(".metric-card").classList.toggle("negative", Number(summary.vatDue || 0) < 0);

  renderFundsSpotlight();
  renderSummary();
  renderWarnings();
  renderEntries();
  renderExpenses();
  renderOrders();
  renderSupplierOrders();
  renderConvertedQuotes();
  renderVatCards();
  renderSettings();
  renderCharts();
}

function renderFundsSpotlight() {
  const summary = state.dashboard?.summary || {};
  const grossAvailable = Number(summary.cashBalance || 0);
  const vatReserve = Math.max(0, Number(summary.vatDue || 0));
  const afterVat = grossAvailable - vatReserve;
  const cashOut = Number(summary.cashOut || 0);
  const totalForRail = Math.max(1, Math.abs(afterVat) + vatReserve);
  const availablePct = afterVat > 0 ? Math.max(4, Math.min(100, (afterVat / totalForRail) * 100)) : 0;
  const vatPct = vatReserve > 0 ? Math.max(4, Math.min(100 - availablePct, (vatReserve / totalForRail) * 100)) : 0;

  elements.fundsAvailable.textContent = formatMoney(afterVat);
  elements.fundsAfterVat.textContent = formatMoney(grossAvailable);
  elements.fundsVatReserve.textContent = formatMoney(vatReserve);
  elements.fundsOut.textContent = formatMoney(cashOut);
  elements.fundsBar.style.width = `${availablePct}%`;
  elements.fundsVatBar.style.width = `${vatPct}%`;
  elements.fundsSpotlight.classList.toggle("negative", afterVat < 0);
  elements.fundsSpotlight.classList.toggle("caution", afterVat >= 0 && grossAvailable < vatReserve);

  if (afterVat < 0) {
    elements.fundsCaption.textContent = `Apres TVA, il manque ${formatMoney(Math.abs(afterVat))}.`;
  } else if (vatReserve > 0) {
    elements.fundsCaption.textContent = `${formatMoney(grossAvailable)} brut, dont ${formatMoney(vatReserve)} de TVA a reserver.`;
  } else {
    elements.fundsCaption.textContent = "Disponible apres TVA sur la periode selectionnee.";
  }
}

function renderSummary() {
  const summary = state.dashboard?.summary || {};
  const items = [
    ["Entrees TTC", summary.cashIn],
    ["Sorties TTC", summary.cashOut],
    ["CA PrestaShop HT", summary.prestashopRevenueTaxExcl],
    ["Devis Invocean HT", summary.invoceanQuotesTaxExcl],
    ["Notes de frais remboursees", summary.expenseNotesTaxExcl],
    ["TVA payee", summary.vatPaid],
    ["Marge brute HT", summary.grossMarginTaxExcl],
    ["Couts produits estimes", summary.estimatedCostOfGoodsTaxExcl],
    ["Commandes incluses", summary.includedOrders, "number"],
    ["Devis convertis", summary.convertedQuotes, "number"],
    ["Mouvements manuels", summary.manualEntries, "number"],
    ["Notes de frais", summary.expenseNotes, "number"],
  ];

  elements.summaryList.innerHTML = items.map(([label, value, type]) => `
    <div class="kpi-row">
      <span>${escapeHtml(label)}</span>
      <strong>${type === "number" ? numberFormat.format(Number(value || 0)) : formatMoney(value)}</strong>
    </div>
  `).join("");
}

function renderWarnings() {
  const warnings = [...(state.dashboard?.warnings || [])];
  const missing = Number(state.dashboard?.summary?.missingCostLines || 0);
  if (missing > 0) {
    warnings.push(`${missing} ligne(s) produit sans cout fournisseur moyen dans Stockcean.`);
  }

  elements.warningList.innerHTML = warnings.map((warning) => `
    <div class="warning-item">${escapeHtml(warning)}</div>
  `).join("");
}

function renderSettings() {
  const settings = state.dashboard?.settings || {};
  elements.settingSalesRate.value = Number(settings.defaultSalesTaxRate ?? 20);
  elements.settingPurchaseRate.value = Number(settings.defaultPurchaseTaxRate ?? 20);
  elements.settingOrderLimit.value = Number(settings.prestashopOrderLimit ?? 80);
  elements.entryTaxRate.value ||= Number(settings.defaultSalesTaxRate ?? 20);
  elements.expenseTaxRate.value ||= Number(settings.defaultPurchaseTaxRate ?? 20);
}

function orderStatusClass(order) {
  if (!order.includedInRevenue) return "muted";
  if (Number(order.estimatedMarginTaxExcl || 0) < 0) return "danger";
  return "success";
}

function renderOrders() {
  const orders = state.dashboard?.orders || [];
  elements.ordersCount.textContent = `${orders.length} commande${orders.length > 1 ? "s" : ""}`;

  if (orders.length === 0) {
    elements.ordersList.innerHTML = '<div class="empty-state">Aucune commande PrestaShop sur la periode.</div>';
    return;
  }

  elements.ordersList.innerHTML = orders.map((order) => `
    <a class="order-card order-link" href="${escapeHtml(moduleUrl("/Commandes/", { order: order.id }))}" title="Ouvrir cette commande dans Commandes">
      <div class="order-head">
        <div>
          <strong>${escapeHtml(order.reference)}</strong>
          <span>${formatDate(order.dateAdd)} - ${escapeHtml(order.payment || "Paiement")}</span>
        </div>
        <span class="status-pill ${orderStatusClass(order)}">${escapeHtml(order.currentState?.name || "Statut")}</span>
      </div>
      <div class="order-values">
        <span><small>CA HT</small><b>${formatMoney(order.totalTaxExcl)}</b></span>
        <span><small>TVA</small><b>${formatMoney(order.vatAmount)}</b></span>
        <span><small>Cout estime</small><b>${formatMoney(order.estimatedCostTaxExcl)}</b></span>
        <span><small>Marge HT</small><b>${formatMoney(order.estimatedMarginTaxExcl)}</b></span>
      </div>
      ${order.missingCostLines ? `<p class="muted-note">${order.missingCostLines} cout(s) fournisseur manquant(s).</p>` : ""}
    </a>
  `).join("");
}

function supplierStatusLabel(status) {
  return {
    draft: "Brouillon",
    ordered: "Commandee",
    received: "Receptionnee",
    cancelled: "Annulee",
  }[status] || status || "Statut";
}

function renderSupplierOrders() {
  const orders = state.dashboard?.supplierOrders || [];
  elements.supplierCount.textContent = `${orders.length} achat${orders.length > 1 ? "s" : ""}`;

  if (orders.length === 0) {
    elements.supplierOrdersList.innerHTML = '<div class="empty-state">Aucune commande fournisseur sur la periode.</div>';
    return;
  }

  elements.supplierOrdersList.innerHTML = orders.map((order) => `
    <a class="order-card order-link" href="${escapeHtml(moduleUrl("/Stockcean/", { view: "order-history", order: order.id }))}" title="Ouvrir cette commande dans Stockcean">
      <div class="order-head">
        <div>
          <strong>${escapeHtml(order.orderNumber)}</strong>
          <span>${escapeHtml(order.supplierName || "Sans fournisseur")} - ${formatDate(order.createdAt)}</span>
        </div>
        <span class="status-pill ${order.includedInExpenses ? "success" : "muted"}">${escapeHtml(supplierStatusLabel(order.status))}</span>
      </div>
      <div class="order-values">
        <span><small>Total HT</small><b>${formatMoney(order.totalTaxExcl)}</b></span>
        <span><small>TVA deduite</small><b>${formatMoney(order.taxAmount)}</b></span>
        <span><small>Total TTC</small><b>${formatMoney(order.totalTaxIncl)}</b></span>
        <span><small>Lignes</small><b>${numberFormat.format(Number(order.lineCount || 0))}</b></span>
      </div>
    </a>
  `).join("");
}

function renderConvertedQuotes() {
  const quotes = state.dashboard?.convertedQuotes || [];
  elements.convertedCount.textContent = `${quotes.length} devis`;

  if (quotes.length === 0) {
    elements.convertedQuotesList.innerHTML = '<div class="empty-state">Aucun devis Invocean converti sur la periode.</div>';
    return;
  }

  elements.convertedQuotesList.innerHTML = quotes.map((quote) => {
    const customer = quote.customerCompany || quote.customerName || "Client";
    const invoice = quote.invoiceNumber ? `Facture ${quote.invoiceNumber}` : "Facture creee";
    const date = quote.invoiceDate || quote.accountingDate || quote.convertedAt;

    return `
      <a class="order-card order-link" href="${escapeHtml(moduleUrl("/Invocean/", { tab: "quotes", quote: quote.id }))}" title="Ouvrir ce devis dans Invocean">
        <div class="order-head">
          <div>
            <strong>${escapeHtml(quote.quoteNumber || `Devis #${quote.id}`)}</strong>
            <span>${escapeHtml(customer)} - ${formatDate(date)}</span>
          </div>
          <span class="status-pill success">Converti</span>
        </div>
        <div class="order-values">
          <span><small>CA HT</small><b>${formatMoney(quote.totalTaxExcl)}</b></span>
          <span><small>TVA</small><b>${formatMoney(quote.vatAmount)}</b></span>
          <span><small>Total TTC</small><b>${formatMoney(quote.totalTaxIncl)}</b></span>
          <span><small>${escapeHtml(invoice)}</small><b>${escapeHtml(quote.source || "Invocean")}</b></span>
        </div>
      </a>
    `;
  }).join("");
}

function entryTypeLabel(type) {
  return {
    fund: "Fonds",
    income: "Recette",
    expense: "Depense",
    supplier: "Fournisseur",
    tax_adjustment: "TVA",
  }[type] || type;
}

function taxScopeLabel(scope) {
  return {
    neutral: "Sans TVA",
    collected: "TVA collectee",
    deductible: "TVA deductible",
  }[scope] || scope;
}

function expenseStatusLabel(status) {
  return {
    received: "Recu",
    approved: "Valide",
    reimbursed: "Rembourse",
    rejected: "Refuse",
  }[status] || status || "Statut";
}

function expenseStatusClass(status) {
  return {
    received: "muted",
    approved: "success",
    reimbursed: "success",
    rejected: "danger",
  }[status] || "muted";
}

function renderEntryAttachments(entry) {
  const attachments = entry.attachments || [];
  if (attachments.length === 0) return "";

  return `
    <div class="attachment-list">
      ${attachments.map((attachment) => `
        <span class="attachment-chip">
          <a href="${escapeHtml(attachment.downloadUrl)}" target="_blank" rel="noopener">
            <span class="attachment-name">${escapeHtml(attachment.name)}</span>
            <small>${formatFileSize(attachment.fileSize)}</small>
          </a>
          <button type="button" data-attachment-delete="${attachment.id}" title="Supprimer cette piece jointe">Supprimer</button>
        </span>
      `).join("")}
    </div>
  `;
}

function renderEntries() {
  const entries = (state.dashboard?.entries || []).map((entry) => ({ kind: "entry", date: entry.occurredAt || "", item: entry }));
  const expenseEntries = (state.dashboard?.expenseNotes || [])
    .filter((note) => note.includedInMovements)
    .map((note) => ({ kind: "expense", date: note.accountingAt || note.reimbursedAt || note.expenseAt || "", item: note }));
  const vatEntries = (state.dashboard?.vatPayments || []).map((payment) => ({ kind: "vat", date: payment.paidAt || "", item: payment }));
  const rows = [...entries, ...expenseEntries, ...vatEntries].sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.item.id || 0) - Number(a.item.id || 0));
  if (rows.length === 0) {
    elements.entriesList.innerHTML = '<div class="empty-state">Aucun mouvement sur la periode.</div>';
    return;
  }

  elements.entriesList.innerHTML = rows.map(({ kind, item }) => {
    if (kind === "expense") {
      return `
        <article class="entry-row" data-expense-note-id="${item.id}">
          <div>
            <span class="entry-type out">Note de frais</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${formatDate(item.accountingAt)} - ${escapeHtml(item.employeeName)}${item.merchant ? ` - ${escapeHtml(item.merchant)}` : ""}</small>
            ${renderExpenseAttachment(item)}
          </div>
          <div class="entry-money">
            <strong>-${formatMoney(item.amountTaxIncl)}</strong>
            <small>${escapeHtml(taxScopeLabel(item.taxScope))} ${item.taxAmount ? `- ${formatMoney(item.taxAmount)}` : ""}</small>
          </div>
          <div class="row-actions">
            <button class="ghost-button" data-expense-edit="${item.id}" type="button">Voir</button>
          </div>
        </article>
      `;
    }

    if (kind === "vat") {
      return `
        <article class="entry-row" data-vat-payment-id="${item.id}">
          <div>
            <span class="entry-type out">TVA payee</span>
            <strong>${escapeHtml(item.label || "Paiement TVA")}</strong>
            <small>${formatDate(item.paidAt)} - periode ${formatDate(item.periodStart)} au ${formatDate(item.periodEnd)}</small>
          </div>
          <div class="entry-money">
            <strong>-${formatMoney(item.amount)}</strong>
            <small>Reglement fiscal</small>
          </div>
          <div class="row-actions">
            <button class="ghost-button danger-text" data-vat-payment-delete="${item.id}" type="button">Annuler</button>
          </div>
        </article>
      `;
    }

    const entry = item;
    return `
      <article class="entry-row" data-entry-id="${entry.id}">
        <div>
          <span class="entry-type ${entry.direction === "out" ? "out" : "in"}">${escapeHtml(entryTypeLabel(entry.entryType))}</span>
          <strong>${escapeHtml(entry.label)}</strong>
          <small>${formatDate(entry.occurredAt)}${entry.counterparty ? ` - ${escapeHtml(entry.counterparty)}` : ""}</small>
          ${renderEntryAttachments(entry)}
        </div>
        <div class="entry-money">
          <strong>${entry.direction === "out" ? "-" : "+"}${formatMoney(entry.amountTaxIncl)}</strong>
          <small>${escapeHtml(taxScopeLabel(entry.taxScope))} ${entry.taxAmount ? `- ${formatMoney(entry.taxAmount)}` : ""}</small>
        </div>
        <div class="row-actions">
          <button class="ghost-button" data-entry-edit="${entry.id}" type="button">Modifier</button>
          <button class="ghost-button danger-text" data-entry-delete="${entry.id}" type="button">Supprimer</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderExpenseAttachment(note) {
  if (!note.attachment) return "";
  const attachment = note.attachment;
  return `
    <div class="attachment-list">
      <span class="attachment-chip">
        <a href="${escapeHtml(attachment.downloadUrl)}" target="_blank" rel="noopener">
          <span class="attachment-name">${escapeHtml(attachment.name)}</span>
          <small>${formatFileSize(attachment.fileSize)}</small>
        </a>
      </span>
    </div>
  `;
}

function renderExpenses() {
  const notes = state.dashboard?.expenseNotes || [];
  elements.expenseCount.textContent = `${notes.length} note${notes.length > 1 ? "s" : ""}`;

  if (notes.length === 0) {
    elements.expenseList.innerHTML = '<div class="empty-state">Aucune note de frais sur la periode.</div>';
    return;
  }

  elements.expenseList.innerHTML = notes.map((note) => `
    <article class="entry-row expense-note-row" data-expense-note-id="${note.id}">
      <div>
        <span class="entry-type ${note.status === "reimbursed" ? "out" : ""}">${escapeHtml(expenseStatusLabel(note.status))}</span>
        <strong>${escapeHtml(note.label)}</strong>
        <small>${escapeHtml(note.employeeName)} - ${formatDate(note.expenseAt)}${note.merchant ? ` - ${escapeHtml(note.merchant)}` : ""}</small>
        ${renderExpenseAttachment(note)}
      </div>
      <div class="entry-money">
        <strong>${formatMoney(note.amountTaxIncl)}</strong>
        <small>${note.includedInMovements ? `Mouvement le ${formatDate(note.accountingAt)}` : "Hors mouvements"}</small>
      </div>
      <div class="row-actions">
        <button class="ghost-button" data-expense-edit="${note.id}" type="button">Modifier</button>
        <button class="ghost-button danger-text" data-expense-delete="${note.id}" type="button">Supprimer</button>
      </div>
    </article>
  `).join("");
}

function renderVatCards() {
  const vat = state.dashboard?.vat || {};
  const due = Number(vat.due || 0);
  const beforePayments = Number(vat.beforePayments ?? due);
  const paid = Number(vat.paid || 0);
  const cards = [
    ["TVA collectee", vat.collected?.total, `PrestaShop ${formatMoney(vat.collected?.prestashop)} - Invocean ${formatMoney(vat.collected?.invocean)} - manuel ${formatMoney(vat.collected?.manual)}`],
    ["TVA deductible", vat.deductible?.total, `Fournisseurs ${formatMoney(vat.deductible?.supplierOrders)} - notes ${formatMoney(vat.deductible?.expenseNotes)} - manuel ${formatMoney(vat.deductible?.manual)}`],
    ["TVA payee", paid, beforePayments > 0 ? `Sur ${formatMoney(beforePayments)} a regulariser` : "Aucun paiement necessaire"],
    [due >= 0 ? "Reste a payer" : "Credit TVA", due, due >= 0 ? "Montant restant pour l Etat" : "Credit estime a reporter", due > 0],
  ];

  elements.vatCards.innerHTML = cards.map(([label, value, detail, payable]) => `
    <article class="vat-card ${label.includes("Credit") ? "credit" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${formatMoney(value)}</strong>
      <small>${escapeHtml(detail)}</small>
      ${payable ? '<button class="primary-button vat-pay-button" data-vat-pay-due type="button">Marquer payee</button>' : ""}
    </article>
  `).join("");
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width || canvas.parentElement.clientWidth || 320));
  const fallbackHeight = Number(canvas.getAttribute("height") || 180);
  const height = Math.max(150, Math.floor(rect.height || fallbackHeight));
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawText(context, text, x, y, options = {}) {
  context.fillStyle = options.color || "#66736b";
  context.font = `${options.weight || 700} ${options.size || 12}px Inter, Segoe UI, sans-serif`;
  context.textAlign = options.align || "left";
  context.fillText(text, x, y);
}

function niceRange(values) {
  const max = Math.max(1, ...values.map((value) => Math.abs(Number(value || 0))));
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / pow) * pow;
}

function renderLineChart(canvas, datasets) {
  const series = state.dashboard?.series || [];
  const { context, width, height } = canvasContext(canvas);
  const pad = { left: 52, right: 18, top: 18, bottom: 34 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const allValues = datasets.flatMap((dataset) => series.map((item) => Number(item[dataset.key] || 0)));
  const max = niceRange(allValues);

  context.strokeStyle = "#dce5df";
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    drawText(context, formatMoney(max - (max / 4) * i).replace(",00", ""), 8, y + 4, { size: 10, weight: 700 });
  }

  const step = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;
  series.forEach((item, index) => {
    const x = pad.left + step * index;
    drawText(context, item.label || item.month, x, height - 10, { size: 10, align: "center" });
  });

  datasets.forEach((dataset) => {
    context.strokeStyle = dataset.color;
    context.lineWidth = 3;
    context.beginPath();
    series.forEach((item, index) => {
      const x = pad.left + step * index;
      const y = pad.top + chartHeight - (Number(item[dataset.key] || 0) / max) * chartHeight;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    series.forEach((item, index) => {
      const x = pad.left + step * index;
      const y = pad.top + chartHeight - (Number(item[dataset.key] || 0) / max) * chartHeight;
      context.fillStyle = dataset.color;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
    });
  });

  let legendX = pad.left;
  datasets.forEach((dataset) => {
    context.fillStyle = dataset.color;
    context.fillRect(legendX, 8, 10, 10);
    drawText(context, dataset.label, legendX + 16, 17, { size: 11 });
    legendX += context.measureText(dataset.label).width + 44;
  });
}

function renderBarChart(canvas) {
  const series = state.dashboard?.series || [];
  const { context, width, height } = canvasContext(canvas);
  const pad = { left: 44, right: 18, top: 20, bottom: 34 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const values = series.map((item) => Number(item.profitTaxExcl || 0));
  const max = niceRange(values);
  const zeroY = pad.top + chartHeight / 2;

  context.strokeStyle = "#dce5df";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pad.left, zeroY);
  context.lineTo(width - pad.right, zeroY);
  context.stroke();

  const gap = 10;
  const barWidth = Math.max(18, (chartWidth - gap * Math.max(0, series.length - 1)) / Math.max(1, series.length));
  series.forEach((item, index) => {
    const value = Number(item.profitTaxExcl || 0);
    const x = pad.left + index * (barWidth + gap);
    const barHeight = Math.min(chartHeight / 2, Math.abs(value) / max * (chartHeight / 2));
    const y = value >= 0 ? zeroY - barHeight : zeroY;
    context.fillStyle = value >= 0 ? "#237a57" : "#c74444";
    context.fillRect(x, y, barWidth, Math.max(2, barHeight));
    drawText(context, item.label || item.month, x + barWidth / 2, height - 10, { size: 10, align: "center" });
  });

  drawText(context, formatMoney(max).replace(",00", ""), 8, pad.top + 8, { size: 10 });
  drawText(context, `-${formatMoney(max).replace(",00", "")}`, 8, height - pad.bottom, { size: 10 });
}

function renderDonutChart(canvas) {
  const vat = state.dashboard?.vat || {};
  const collected = Math.max(0, Number(vat.collected?.total || 0));
  const deductible = Math.max(0, Number(vat.deductible?.total || 0));
  const due = Number(vat.due || 0);
  const total = Math.max(1, collected + deductible);
  const { context, width, height } = canvasContext(canvas);
  const cx = width / 2;
  const cy = height / 2 + 4;
  const radius = Math.min(width, height) * 0.30;
  const line = Math.max(22, radius * 0.28);
  let start = -Math.PI / 2;

  [
    [collected, "#256fbd"],
    [deductible, "#237a57"],
  ].forEach(([value, color]) => {
    const angle = (value / total) * Math.PI * 2;
    context.strokeStyle = color;
    context.lineWidth = line;
    context.beginPath();
    context.arc(cx, cy, radius, start, start + angle);
    context.stroke();
    start += angle;
  });

  context.strokeStyle = "#e1e8e3";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(cx, cy, radius - line / 2, 0, Math.PI * 2);
  context.stroke();

  drawText(context, due >= 0 ? "A reverser" : "Credit", cx, cy - 4, { align: "center", size: 12 });
  drawText(context, formatMoney(due), cx, cy + 18, {
    align: "center",
    size: 17,
    weight: 900,
    color: due >= 0 ? "#17211b" : "#237a57",
  });

  drawText(context, "Collectee", 18, 24, { size: 11, color: "#256fbd" });
  drawText(context, "Deductible", width - 18, 24, { size: 11, align: "right", color: "#237a57" });
}

function renderCharts() {
  if (!state.dashboard || state.currentView !== "dashboard") return;
  renderLineChart(elements.cashChart, [
    { key: "cashIn", label: "Entrees TTC", color: "#256fbd" },
    { key: "cashOut", label: "Sorties TTC", color: "#c98316" },
  ]);
  renderBarChart(elements.profitChart);
  renderDonutChart(elements.vatChart);
}

function resetEntryForm() {
  elements.entryId.value = "";
  elements.entryType.value = "fund";
  elements.entryDirection.value = "in";
  elements.entryTaxScope.value = "neutral";
  elements.entryDate.value = defaultEntryDate();
  elements.entryLabel.value = "";
  elements.entryCounterparty.value = "";
  elements.entryAmountHt.value = "";
  elements.entryTaxRate.value = Number(state.dashboard?.settings?.defaultSalesTaxRate ?? 20);
  elements.entryTaxAmount.value = "";
  elements.entryAmountTtc.value = "";
  elements.entryNotes.value = "";
  elements.entryAttachments.value = "";
}

function applyEntryDefaults() {
  const type = elements.entryType.value;
  if (type === "fund") {
    elements.entryDirection.value = "in";
    elements.entryTaxScope.value = "neutral";
  } else if (type === "income") {
    elements.entryDirection.value = "in";
    elements.entryTaxScope.value = "collected";
  } else if (type === "expense" || type === "supplier") {
    elements.entryDirection.value = "out";
    elements.entryTaxScope.value = "deductible";
  } else if (type === "tax_adjustment") {
    elements.entryDirection.value = "out";
    elements.entryTaxScope.value = "neutral";
  }
  syncEntryAmounts();
}

function syncEntryAmounts() {
  const ht = parseNumber(elements.entryAmountHt.value);
  if (ht <= 0) return;
  const scope = elements.entryTaxScope.value;
  const rate = parseNumber(elements.entryTaxRate.value);
  const tax = scope === "neutral" ? 0 : ht * (rate / 100);
  elements.entryTaxAmount.value = tax.toFixed(2);
  elements.entryAmountTtc.value = (ht + tax).toFixed(2);
}

function fillEntryForm(entry) {
  elements.entryId.value = entry.id;
  elements.entryType.value = entry.entryType || "fund";
  elements.entryDirection.value = entry.direction || "in";
  elements.entryTaxScope.value = entry.taxScope || "neutral";
  elements.entryDate.value = entry.occurredAt || defaultEntryDate();
  elements.entryLabel.value = entry.label || "";
  elements.entryCounterparty.value = entry.counterparty || "";
  elements.entryAmountHt.value = Number(entry.amountTaxExcl || 0).toFixed(2);
  elements.entryTaxRate.value = Number(entry.taxRate || 0);
  elements.entryTaxAmount.value = Number(entry.taxAmount || 0).toFixed(2);
  elements.entryAmountTtc.value = Number(entry.amountTaxIncl || 0).toFixed(2);
  elements.entryNotes.value = entry.notes || "";
  elements.entryAttachments.value = "";
  setActiveView("entries");
  elements.entryLabel.focus();
}

function resetExpenseForm() {
  elements.expenseId.value = "";
  elements.expenseEmployee.value = "";
  elements.expenseStatus.value = "received";
  elements.expenseDate.value = defaultEntryDate();
  elements.expenseReimbursedAt.value = "";
  elements.expenseLabel.value = "";
  elements.expenseMerchant.value = "";
  elements.expenseTaxScope.value = "deductible";
  elements.expenseTaxRate.value = Number(state.dashboard?.settings?.defaultPurchaseTaxRate ?? 20);
  elements.expenseAmountHt.value = "";
  elements.expenseTaxAmount.value = "";
  elements.expenseAmountTtc.value = "";
  elements.expenseReceipt.value = "";
  elements.expenseNotes.value = "";
}

function syncExpenseAmounts() {
  const ht = parseNumber(elements.expenseAmountHt.value);
  if (ht <= 0) return;
  const scope = elements.expenseTaxScope.value;
  const rate = parseNumber(elements.expenseTaxRate.value);
  const tax = scope === "neutral" ? 0 : ht * (rate / 100);
  elements.expenseTaxAmount.value = tax.toFixed(2);
  elements.expenseAmountTtc.value = (ht + tax).toFixed(2);
}

function syncExpenseStatusDate() {
  if (elements.expenseStatus.value === "reimbursed" && !elements.expenseReimbursedAt.value) {
    elements.expenseReimbursedAt.value = elements.expenseDate.value || defaultEntryDate();
  }
}

function fillExpenseForm(note) {
  elements.expenseId.value = note.id;
  elements.expenseEmployee.value = note.employeeName || "";
  elements.expenseStatus.value = note.status || "received";
  elements.expenseDate.value = note.expenseAt || defaultEntryDate();
  elements.expenseReimbursedAt.value = note.reimbursedAt || "";
  elements.expenseLabel.value = note.label || "";
  elements.expenseMerchant.value = note.merchant || "";
  elements.expenseTaxScope.value = note.taxScope || "deductible";
  elements.expenseTaxRate.value = Number(note.taxRate || 0);
  elements.expenseAmountHt.value = Number(note.amountTaxExcl || 0).toFixed(2);
  elements.expenseTaxAmount.value = Number(note.taxAmount || 0).toFixed(2);
  elements.expenseAmountTtc.value = Number(note.amountTaxIncl || 0).toFixed(2);
  elements.expenseReceipt.value = "";
  elements.expenseNotes.value = note.notes || "";
  setActiveView("expenses");
  elements.expenseEmployee.focus();
}

async function saveEntry(event) {
  event.preventDefault();
  elements.entrySave.disabled = true;
  setMessage("");
  try {
    const payload = {
      action: "save_entry",
      id: elements.entryId.value ? Number(elements.entryId.value) : 0,
      entryType: elements.entryType.value,
      direction: elements.entryDirection.value,
      taxScope: elements.entryTaxScope.value,
      label: elements.entryLabel.value.trim(),
      counterparty: elements.entryCounterparty.value.trim(),
      amountTaxExcl: elements.entryAmountHt.value,
      taxRate: elements.entryTaxRate.value,
      taxAmount: elements.entryTaxAmount.value,
      amountTaxIncl: elements.entryAmountTtc.value,
      occurredAt: elements.entryDate.value,
      notes: elements.entryNotes.value.trim(),
    };
    const entryPeriod = periodForEntryDate(payload.occurredAt);
    const files = Array.from(elements.entryAttachments.files || []);
    const body = files.length > 0
      ? (() => {
          const formData = new FormData();
          Object.entries(payload).forEach(([key, value]) => formData.append(key, value ?? ""));
          files.forEach((file) => formData.append("attachments[]", file));
          return formData;
        })()
      : JSON.stringify(payload);
    const response = await apiRequest(`${API.finance}?${entryPeriod.query}`, {
      method: "POST",
      body,
    });
    applyDashboard(response.dashboard);
    resetEntryForm();
    setMessage(
      entryPeriod.expanded ? "Mouvement enregistre. Periode ajustee pour l afficher." : response.message || "Mouvement enregistre.",
      "success"
    );
  } catch (error) {
    setMessage(error.message || "Enregistrement impossible.", "error");
  } finally {
    elements.entrySave.disabled = false;
  }
}

async function deleteEntry(id) {
  if (!window.confirm("Supprimer ce mouvement ?")) return;
  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({ action: "delete_entry", id }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Mouvement supprime.", "success");
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

async function deleteAttachment(id) {
  if (!window.confirm("Supprimer cette piece jointe ?")) return;
  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({ action: "delete_attachment", id }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Piece jointe supprimee.", "success");
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

async function saveExpense(event) {
  event.preventDefault();
  elements.expenseSave.disabled = true;
  setMessage("");
  try {
    syncExpenseStatusDate();
    const payload = {
      action: "save_expense_note",
      id: elements.expenseId.value ? Number(elements.expenseId.value) : 0,
      employeeName: elements.expenseEmployee.value.trim(),
      status: elements.expenseStatus.value,
      expenseAt: elements.expenseDate.value,
      reimbursedAt: elements.expenseReimbursedAt.value,
      label: elements.expenseLabel.value.trim(),
      merchant: elements.expenseMerchant.value.trim(),
      taxScope: elements.expenseTaxScope.value,
      taxRate: elements.expenseTaxRate.value,
      amountTaxExcl: elements.expenseAmountHt.value,
      taxAmount: elements.expenseTaxAmount.value,
      amountTaxIncl: elements.expenseAmountTtc.value,
      notes: elements.expenseNotes.value.trim(),
    };
    const accountingDate = payload.status === "reimbursed" ? payload.reimbursedAt || payload.expenseAt : payload.expenseAt;
    const expensePeriod = periodForEntryDate(accountingDate);
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => formData.append(key, value ?? ""));
    const file = elements.expenseReceipt.files?.[0];
    if (file) {
      formData.append("receipt", file);
    }
    const response = await apiRequest(`${API.finance}?${expensePeriod.query}`, {
      method: "POST",
      body: formData,
    });
    applyDashboard(response.dashboard);
    resetExpenseForm();
    setMessage(
      expensePeriod.expanded ? "Note de frais enregistree. Periode ajustee pour l afficher." : response.message || "Note de frais enregistree.",
      "success"
    );
  } catch (error) {
    setMessage(error.message || "Enregistrement impossible.", "error");
  } finally {
    elements.expenseSave.disabled = false;
  }
}

async function deleteExpense(id) {
  if (!window.confirm("Supprimer cette note de frais ?")) return;
  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({ action: "delete_expense_note", id }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Note de frais supprimee.", "success");
  } catch (error) {
    setMessage(error.message || "Suppression impossible.", "error");
  }
}

async function saveVatPayment() {
  const period = state.dashboard?.period || {};
  const due = Math.max(0, Number(state.dashboard?.vat?.due || 0));
  if (due <= 0) {
    setMessage("Aucune TVA a payer sur cette periode.", "success");
    return;
  }
  if (!window.confirm(`Marquer ${formatMoney(due)} de TVA comme payee ?`)) return;

  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({
        action: "save_vat_payment",
        amount: due.toFixed(2),
        periodStart: period.start || elements.periodStart.value,
        periodEnd: period.end || elements.periodEnd.value,
        paidAt: defaultEntryDate(),
        label: "Paiement TVA",
      }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Paiement TVA enregistre.", "success");
  } catch (error) {
    setMessage(error.message || "Paiement TVA impossible.", "error");
  }
}

async function deleteVatPayment(id) {
  if (!window.confirm("Annuler ce paiement TVA ?")) return;
  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({ action: "delete_vat_payment", id }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Paiement TVA annule.", "success");
  } catch (error) {
    setMessage(error.message || "Annulation impossible.", "error");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  elements.settingsSave.disabled = true;
  setMessage("");
  try {
    const response = await apiRequest(`${API.finance}?${periodQuery()}`, {
      method: "POST",
      body: JSON.stringify({
        action: "save_settings",
        defaultSalesTaxRate: elements.settingSalesRate.value,
        defaultPurchaseTaxRate: elements.settingPurchaseRate.value,
        prestashopOrderLimit: elements.settingOrderLimit.value,
      }),
    });
    applyDashboard(response.dashboard);
    setMessage(response.message || "Reglages enregistres.", "success");
  } catch (error) {
    setMessage(error.message || "Reglages impossibles.", "error");
  } finally {
    elements.settingsSave.disabled = false;
  }
}

async function logout() {
  try {
    await apiRequest(API.auth, { method: "DELETE" });
  } catch (error) {}
  redirectToOceanOS();
}

function bindEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });
  elements.refreshButton.addEventListener("click", () => loadDashboard().catch((error) => setMessage(error.message, "error")));
  elements.logoutButton.addEventListener("click", logout);
  elements.periodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadDashboard()
      .then(() => setMessage("Filtre de date enregistre pour ce compte.", "success"))
      .catch((error) => setMessage(error.message, "error"));
  });
  elements.entryForm.addEventListener("submit", saveEntry);
  elements.entryReset.addEventListener("click", resetEntryForm);
  elements.entryType.addEventListener("change", applyEntryDefaults);
  elements.entryTaxScope.addEventListener("change", syncEntryAmounts);
  elements.entryTaxRate.addEventListener("input", syncEntryAmounts);
  elements.entryAmountHt.addEventListener("input", syncEntryAmounts);
  elements.expenseForm.addEventListener("submit", saveExpense);
  elements.expenseReset.addEventListener("click", resetExpenseForm);
  elements.expenseStatus.addEventListener("change", syncExpenseStatusDate);
  elements.expenseTaxScope.addEventListener("change", syncExpenseAmounts);
  elements.expenseTaxRate.addEventListener("input", syncExpenseAmounts);
  elements.expenseAmountHt.addEventListener("input", syncExpenseAmounts);
  elements.entriesList.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const attachmentDelete = target.closest("[data-attachment-delete]");
    if (attachmentDelete) {
      event.preventDefault();
      void deleteAttachment(Number(attachmentDelete.dataset.attachmentDelete));
      return;
    }
    const vatPaymentDelete = target.closest("[data-vat-payment-delete]");
    if (vatPaymentDelete) {
      void deleteVatPayment(Number(vatPaymentDelete.dataset.vatPaymentDelete));
      return;
    }
    const expenseEdit = target.closest("[data-expense-edit]");
    if (expenseEdit) {
      const id = Number(expenseEdit.dataset.expenseEdit);
      const note = (state.dashboard?.expenseNotes || []).find((item) => Number(item.id) === id);
      if (note) fillExpenseForm(note);
      return;
    }
    const edit = target.closest("[data-entry-edit]");
    if (edit) {
      const id = Number(edit.dataset.entryEdit);
      const entry = (state.dashboard?.entries || []).find((item) => Number(item.id) === id);
      if (entry) fillEntryForm(entry);
      return;
    }
    const del = target.closest("[data-entry-delete]");
    if (del) {
      void deleteEntry(Number(del.dataset.entryDelete));
    }
  });
  elements.expenseList.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const edit = target.closest("[data-expense-edit]");
    if (edit) {
      const id = Number(edit.dataset.expenseEdit);
      const note = (state.dashboard?.expenseNotes || []).find((item) => Number(item.id) === id);
      if (note) fillExpenseForm(note);
      return;
    }
    const del = target.closest("[data-expense-delete]");
    if (del) {
      void deleteExpense(Number(del.dataset.expenseDelete));
    }
  });
  elements.vatCards.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    if (target.closest("[data-vat-pay-due]")) {
      void saveVatPayment();
    }
  });
  elements.settingsForm.addEventListener("submit", saveSettings);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderCharts, 120);
  });
}

async function init() {
  bindEvents();
  resetEntryForm();
  resetExpenseForm();
  setView("loading");
  try {
    const ok = await fetchAuth();
    if (!ok) return;
    await loadDashboard();
    setView("app");
    window.requestAnimationFrame(renderCharts);
  } catch (error) {
    setView("app");
    setMessage(error.message || "Chargement impossible.", "error");
  }
}

void init();
