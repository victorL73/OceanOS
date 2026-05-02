const API = {
  auth: "api/auth.php",
  devis: "api/devis.php",
};
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  connectionChip: $("connection-chip"),
  currentUser: $("current-user"),
  refreshButton: $("refresh-button"),
  newQuoteButton: $("new-quote-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricQuotes: $("metric-quotes"),
  metricProducts: $("metric-products"),
  metricDrafts: $("metric-drafts"),
  metricSent: $("metric-sent"),
  quoteSearch: $("quote-search"),
  quotesList: $("quotes-list"),
  builderTitle: $("builder-title"),
  quoteForm: $("quote-form"),
  downloadPdfButton: $("download-pdf-button"),
  savePdfButton: $("save-pdf-button"),
  saveQuoteButton: $("save-quote-button"),
  deleteQuoteButton: $("delete-quote-button"),
  clientName: $("client-name"),
  clientEmail: $("client-email"),
  quoteStatus: $("quote-status"),
  productSource: $("product-source"),
  b2bToggle: $("b2b-toggle"),
  b2bPercent: $("b2b-percent"),
  productSearch: $("product-search"),
  productResults: $("product-results"),
  feeType: $("fee-type"),
  feeLabel: $("fee-label"),
  feeAmount: $("fee-amount"),
  feeTaxRate: $("fee-tax-rate"),
  addFeeButton: $("add-fee-button"),
  quoteLines: $("quote-lines"),
  paymentTerms: $("payment-terms"),
  totalHt: $("total-ht"),
  totalVat: $("total-vat"),
  totalTtc: $("total-ttc"),
};

const state = {
  user: null,
  settings: null,
  company: null,
  quotes: [],
  products: [],
  selectedId: "new",
  draft: null,
  b2bEnabled: false,
  b2bPercent: 50,
};

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const FEE_LABELS = {
  delivery: "Livraison",
  handling: "Manutention",
  other: "Frais annexe",
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

function formatDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseNumber(value) {
  const normalized = String(value ?? "").replace(/\s+/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatPercent(value) {
  const percent = Number(value || 0);
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1).replace(".", ",")} %`;
}

function b2bPercentValue() {
  const value = parseNumber(elements.b2bPercent?.value || state.b2bPercent || 50);
  return Math.max(1, Math.min(100, value || 50));
}

function syncB2bControls() {
  if (!elements.b2bToggle || !elements.b2bPercent) return;
  elements.b2bPercent.value = String(state.b2bPercent);
  elements.b2bPercent.disabled = !state.b2bEnabled;
  elements.b2bToggle.setAttribute("aria-pressed", state.b2bEnabled ? "true" : "false");
  elements.b2bToggle.classList.toggle("is-active", state.b2bEnabled);
}

function productBasePrice(product) {
  return Math.max(0, parseNumber(product?.price));
}

function productPriceFromBase(basePrice) {
  const base = Math.max(0, parseNumber(basePrice));
  return state.b2bEnabled ? roundMoney(base * (state.b2bPercent / 100)) : roundMoney(base);
}

function productBasePriceForLine(line) {
  const storedBase = parseNumber(line.catalog_price_ht ?? line.catalogPriceHt ?? line.base_unit_price_ht);
  if (storedBase > 0) return storedBase;
  const product = state.products.find((item) => Number(item.id) === Number(line.product_id));
  const catalogPrice = productBasePrice(product);
  return catalogPrice > 0 ? catalogPrice : Math.max(0, parseNumber(line.unit_price_ht));
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

function blankQuote() {
  return {
    id: null,
    client_id: "",
    client_name: "",
    client_email: "",
    reference: "Brouillon",
    status: "Brouillon",
    total_ht: 0,
    total_ttc: 0,
    lines: [],
  };
}

function cloneQuote(quote) {
  return {
    ...blankQuote(),
    ...(quote || {}),
    lines: Array.isArray(quote?.lines) ? quote.lines.map((line) => ({ ...line })) : [],
  };
}

function activeQuote() {
  if (state.draft && (state.selectedId === "new" || Number(state.draft.id) === Number(state.selectedId))) {
    return state.draft;
  }
  if (state.selectedId === "new") return blankQuote();
  return cloneQuote(state.quotes.find((quote) => Number(quote.id) === Number(state.selectedId)));
}

function recalculateDraft() {
  const draft = activeQuote();
  let totalHt = 0;
  let totalTtc = 0;
  draft.lines = (draft.lines || []).map((line) => {
    const quantity = Math.max(0, parseNumber(line.quantity));
    const unitPrice = Math.max(0, parseNumber(line.unit_price_ht));
    const taxRate = Math.max(0, parseNumber(line.tax_rate));
    const lineHt = quantity * unitPrice;
    const lineTtc = lineHt * (1 + taxRate / 100);
    totalHt += lineHt;
    totalTtc += lineTtc;
    return {
      ...line,
      line_type: line.line_type || (line.product_id ? "product" : "fee"),
      quantity,
      unit_price_ht: unitPrice,
      tax_rate: taxRate,
    };
  });
  draft.total_ht = totalHt;
  draft.total_ttc = totalTtc;
  state.draft = draft;
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

async function loadDashboard() {
  const payload = await apiRequest(API.devis);
  state.user = payload.user || state.user;
  state.settings = payload.settings || null;
  state.company = payload.company || null;
  state.quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
  state.products = Array.isArray(payload.products) ? payload.products : [];
  if (payload.productError) {
    showMessage(payload.productError, "error");
  }
  if (state.selectedId !== "new" && !state.quotes.some((quote) => Number(quote.id) === Number(state.selectedId))) {
    state.selectedId = "new";
    state.draft = blankQuote();
  }
  if (!state.draft) state.draft = state.selectedId === "new" ? blankQuote() : cloneQuote(state.quotes.find((quote) => Number(quote.id) === Number(state.selectedId)));
  render();
}

function renderChrome() {
  const user = state.user || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  const connected = Boolean(state.settings?.shopUrl && state.settings?.hasWebserviceKey);
  elements.connectionChip.textContent = connected ? "PrestaShop connecte" : "PrestaShop non configure";
  elements.connectionChip.className = connected ? "status-pill success-pill" : "status-pill muted-pill";
  elements.productSource.textContent = connected
    ? `${state.products.length} produit(s) PrestaShop charges`
    : "Configurez PrestaShop dans OceanOS";
  elements.paymentTerms.textContent = state.company?.paymentTerms || "Virement bancaire a 30 jours";
}

function renderMetrics() {
  elements.metricQuotes.textContent = String(state.quotes.length);
  elements.metricProducts.textContent = String(state.products.length);
  const draftTotal = state.quotes
    .filter((quote) => quote.status === "Brouillon")
    .reduce((sum, quote) => sum + Number(quote.total_ttc || 0), 0);
  const sentTotal = state.quotes
    .filter((quote) => quote.status === "Envoye")
    .reduce((sum, quote) => sum + Number(quote.total_ttc || 0), 0);
  elements.metricDrafts.textContent = money.format(draftTotal);
  elements.metricSent.textContent = money.format(sentTotal);
}

function filteredQuotes() {
  const search = normalizeText(elements.quoteSearch.value);
  if (!search) return state.quotes;
  return state.quotes.filter((quote) => normalizeText(`${quote.reference || ""} ${quote.client_name || ""} ${quote.client_email || ""}`).includes(search));
}

function renderQuotes() {
  const quotes = filteredQuotes();
  if (quotes.length === 0) {
    elements.quotesList.innerHTML = '<div class="empty-state">Aucun devis.</div>';
    return;
  }
  elements.quotesList.innerHTML = quotes.map((quote) => {
    const active = Number(quote.id) === Number(state.selectedId);
    return `
      <button class="quote-item${active ? " is-active" : ""}" data-quote-id="${quote.id}" type="button">
        <span class="quote-item-head">
          <strong>${escapeHtml(quote.reference || `DEV-${quote.id}`)}</strong>
          <span class="quote-status">${escapeHtml(quote.status || "Brouillon")}</span>
        </span>
        <span>${escapeHtml(quote.client_name || "Client non renseigne")}</span>
        <span class="quote-item-meta">
          <span>${escapeHtml(formatDate(quote.date_updated || quote.date_created))}</span>
          <span>${money.format(Number(quote.total_ttc || 0))}</span>
        </span>
      </button>
    `;
  }).join("");
}

function renderBuilder() {
  recalculateDraft();
  const draft = activeQuote();
  syncB2bControls();
  elements.builderTitle.textContent = draft.id ? (draft.reference || `DEV-${draft.id}`) : "Nouveau devis";
  elements.clientName.value = draft.client_name || "";
  elements.clientEmail.value = draft.client_email || "";
  elements.quoteStatus.value = draft.status || "Brouillon";
  elements.downloadPdfButton.disabled = !draft.id;
  elements.deleteQuoteButton.disabled = !draft.id;
  renderLines(draft);
  renderTotals(draft);
  renderProductResults();
}

function renderLines(draft) {
  if (!draft.lines || draft.lines.length === 0) {
    elements.quoteLines.innerHTML = '<tr><td colspan="6" class="empty-state">Ajoutez un produit ou un frais annexe.</td></tr>';
    return;
  }

  elements.quoteLines.innerHTML = draft.lines.map((line, index) => {
    const lineType = line.line_type || (line.product_id ? "product" : "fee");
    const isFee = lineType === "fee";
    const quantity = Number(line.quantity || 0);
    const unitPrice = Number(line.unit_price_ht || 0);
    const taxRate = Number(line.tax_rate || 0);
    const total = quantity * unitPrice * (1 + taxRate / 100);
    const reference = line.product_reference || line.reference || line.product_id || "";
    const meta = isFee
      ? `Frais annexe${line.fee_type ? ` - ${escapeHtml(feeTypeLabel(line.fee_type))}` : ""}`
      : `${reference ? `Ref. ${escapeHtml(reference)}` : "Produit manuel"}${line.price_mode === "b2b" ? ` - B2B ${escapeHtml(formatPercent(line.b2b_percent || 50))}` : ""}`;
    return `
      <tr data-line-index="${index}" class="${isFee ? "fee-line" : ""}">
        <td>
          <div class="line-name">
            <strong>${escapeHtml(line.name || "Produit")}</strong>
            <span>${meta}</span>
          </div>
        </td>
        <td><input class="line-number" data-line-field="quantity" type="number" min="0" step="1" value="${quantity}"></td>
        <td><input class="line-number" data-line-field="unit_price_ht" type="number" min="0" step="0.01" value="${unitPrice.toFixed(2)}"></td>
        <td><input class="line-number" data-line-field="tax_rate" type="number" min="0" step="0.1" value="${taxRate}"></td>
        <td><strong>${money.format(total)}</strong></td>
        <td><button class="line-remove" data-remove-line="${index}" type="button" title="Retirer">x</button></td>
      </tr>
    `;
  }).join("");
}

function renderTotals(draft) {
  const totalHt = Number(draft.total_ht || 0);
  const totalTtc = Number(draft.total_ttc || 0);
  elements.totalHt.textContent = money.format(totalHt);
  elements.totalVat.textContent = money.format(Math.max(0, totalTtc - totalHt));
  elements.totalTtc.textContent = money.format(totalTtc);
}

function productMatchesSearch(product, search) {
  if (!search || search.length < 2) return false;
  return normalizeText(`${product.id || ""} ${product.reference || ""} ${product.name || ""}`).includes(search);
}

function renderProductResults() {
  const search = normalizeText(elements.productSearch.value);
  const results = state.products.filter((product) => productMatchesSearch(product, search)).slice(0, 12);
  elements.productResults.classList.toggle("hidden", results.length === 0);
  if (results.length === 0) {
    elements.productResults.innerHTML = "";
    return;
  }
  elements.productResults.innerHTML = results.map((product) => {
    const basePrice = productBasePrice(product);
    const appliedPrice = productPriceFromBase(basePrice);
    const b2bNote = state.b2bEnabled
      ? `<span class="product-price-note">Catalogue ${escapeHtml(money.format(basePrice))} - B2B ${escapeHtml(formatPercent(state.b2bPercent))}</span>`
      : "";
    return `
      <div class="product-result">
        <div>
          <strong>${escapeHtml(product.name || `Produit #${product.id}`)}</strong>
          <span>${escapeHtml(product.reference || `ID ${product.id}`)}</span>
          ${b2bNote}
        </div>
        <button class="ghost-button" data-add-product="${product.id}" type="button">${money.format(appliedPrice)}</button>
      </div>
    `;
  }).join("");
}

function feeTypeLabel(type) {
  return FEE_LABELS[type] || FEE_LABELS.other;
}

function syncFeeLabel(force = false) {
  const current = elements.feeLabel.value.trim();
  const knownLabels = Object.values(FEE_LABELS);
  if (force || current === "" || knownLabels.includes(current)) {
    elements.feeLabel.value = feeTypeLabel(elements.feeType.value);
  }
}

function render() {
  renderChrome();
  renderMetrics();
  renderQuotes();
  renderBuilder();
}

function updateDraftFromInputs() {
  const draft = activeQuote();
  draft.client_name = elements.clientName.value.trim();
  draft.client_email = elements.clientEmail.value.trim();
  draft.status = elements.quoteStatus.value || "Brouillon";
  state.draft = draft;
}

function applyProductPricingToDraft() {
  updateDraftFromInputs();
  const draft = activeQuote();
  draft.lines = (draft.lines || []).map((line) => {
    const lineType = line.line_type || (line.product_id ? "product" : "fee");
    if (lineType !== "product") return line;
    const basePrice = productBasePriceForLine(line);
    return {
      ...line,
      line_type: "product",
      catalog_price_ht: basePrice,
      unit_price_ht: productPriceFromBase(basePrice),
      price_mode: state.b2bEnabled ? "b2b" : "standard",
      b2b_percent: state.b2bEnabled ? state.b2bPercent : null,
    };
  });
  state.draft = draft;
}

function addProduct(productId) {
  updateDraftFromInputs();
  const product = state.products.find((item) => Number(item.id) === Number(productId));
  if (!product) return;
  const draft = activeQuote();
  const catalogPrice = productBasePrice(product);
  draft.lines = [
    ...(draft.lines || []),
    {
      product_id: product.id,
      line_type: "product",
      product_reference: product.reference || "",
      name: product.name || `Produit #${product.id}`,
      quantity: 1,
      catalog_price_ht: catalogPrice,
      unit_price_ht: productPriceFromBase(catalogPrice),
      tax_rate: 20,
      price_mode: state.b2bEnabled ? "b2b" : "standard",
      b2b_percent: state.b2bEnabled ? state.b2bPercent : null,
    },
  ];
  state.draft = draft;
  elements.productSearch.value = "";
  renderBuilder();
}

function addFee() {
  updateDraftFromInputs();
  syncFeeLabel(false);
  const amount = Math.max(0, parseNumber(elements.feeAmount.value));
  if (amount <= 0) {
    showMessage("Renseignez un montant HT pour le frais annexe.", "error");
    return;
  }

  const draft = activeQuote();
  const feeType = elements.feeType.value || "other";
  draft.lines = [
    ...(draft.lines || []),
    {
      product_id: null,
      line_type: "fee",
      fee_type: feeType,
      product_reference: "",
      name: elements.feeLabel.value.trim() || feeTypeLabel(feeType),
      quantity: 1,
      unit_price_ht: amount,
      tax_rate: Math.max(0, parseNumber(elements.feeTaxRate.value)),
    },
  ];
  state.draft = draft;
  elements.feeAmount.value = "";
  renderBuilder();
}

function removeLine(index) {
  updateDraftFromInputs();
  const draft = activeQuote();
  draft.lines = (draft.lines || []).filter((_, lineIndex) => Number(lineIndex) !== Number(index));
  state.draft = draft;
  renderBuilder();
}

function updateLine(row, input) {
  updateDraftFromInputs();
  const index = Number(row.dataset.lineIndex);
  const field = input.dataset.lineField;
  const draft = activeQuote();
  if (!draft.lines[index] || !field) return;
  draft.lines[index][field] = parseNumber(input.value);
  if (field === "unit_price_ht" && (draft.lines[index].line_type || "product") === "product") {
    draft.lines[index].catalog_price_ht = parseNumber(input.value);
    draft.lines[index].price_mode = "standard";
    draft.lines[index].b2b_percent = null;
  }
  state.draft = draft;
  renderBuilder();
}

function toggleB2bMode() {
  state.b2bEnabled = !state.b2bEnabled;
  state.b2bPercent = b2bPercentValue();
  applyProductPricingToDraft();
  renderBuilder();
}

function updateB2bPercent() {
  state.b2bPercent = b2bPercentValue();
  elements.b2bPercent.value = String(state.b2bPercent);
  if (state.b2bEnabled) {
    applyProductPricingToDraft();
  }
  renderBuilder();
}

async function saveQuote(downloadAfter = false) {
  updateDraftFromInputs();
  recalculateDraft();
  const draft = activeQuote();
  elements.saveQuoteButton.disabled = true;
  elements.savePdfButton.disabled = true;
  try {
    const payload = await apiRequest(API.devis, {
      method: "POST",
      body: JSON.stringify({
        action: "save_quote",
        quote: draft,
      }),
    });
    state.quotes = Array.isArray(payload.quotes) ? payload.quotes : state.quotes;
    state.selectedId = payload.quote?.id || draft.id || "new";
    state.draft = cloneQuote(payload.quote || state.quotes.find((quote) => Number(quote.id) === Number(state.selectedId)));
    render();
    await loadDashboard();
    showMessage(payload.message || "Devis enregistre. PDF genere localement.", "success");
    if (downloadAfter && payload.quote?.id) {
      window.location.href = `${API.devis}?action=download&id=${encodeURIComponent(payload.quote.id)}`;
    }
  } catch (error) {
    try {
      await loadDashboard();
    } catch (refreshError) {}
    showMessage(error.message || "Sauvegarde impossible.", "error");
  } finally {
    elements.saveQuoteButton.disabled = false;
    elements.savePdfButton.disabled = false;
  }
}

async function deleteQuote() {
  const draft = activeQuote();
  if (!draft.id) return;
  if (!window.confirm("Supprimer ce devis ?")) return;
  elements.deleteQuoteButton.disabled = true;
  try {
    const payload = await apiRequest(API.devis, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_quote",
        id: draft.id,
      }),
    });
    state.quotes = Array.isArray(payload.quotes) ? payload.quotes : state.quotes.filter((quote) => Number(quote.id) !== Number(draft.id));
    state.selectedId = "new";
    state.draft = blankQuote();
    render();
    showMessage(payload.message || "Devis supprime.", "success");
  } catch (error) {
    showMessage(error.message || "Suppression impossible.", "error");
  } finally {
    elements.deleteQuoteButton.disabled = !activeQuote().id;
  }
}

async function logout() {
  try {
    await apiRequest(API.auth, { method: "DELETE" });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

function selectQuote(id) {
  state.selectedId = id === "new" ? "new" : Number(id);
  state.draft = state.selectedId === "new"
    ? blankQuote()
    : cloneQuote(state.quotes.find((quote) => Number(quote.id) === Number(state.selectedId)));
  elements.productSearch.value = "";
  render();
}

function installListeners() {
  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard().then(() => showMessage("Donnees actualisees.", "success")).catch((error) => showMessage(error.message, "error"));
  });
  elements.quoteForm.addEventListener("submit", (event) => event.preventDefault());
  elements.newQuoteButton.addEventListener("click", () => selectQuote("new"));
  elements.logoutButton.addEventListener("click", () => { void logout(); });
  elements.quoteSearch.addEventListener("input", renderQuotes);
  elements.quotesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quote-id]");
    if (!button) return;
    selectQuote(button.dataset.quoteId);
  });
  elements.clientName.addEventListener("input", updateDraftFromInputs);
  elements.clientEmail.addEventListener("input", updateDraftFromInputs);
  elements.quoteStatus.addEventListener("change", updateDraftFromInputs);
  elements.b2bToggle.addEventListener("click", toggleB2bMode);
  elements.b2bPercent.addEventListener("change", updateB2bPercent);
  elements.b2bPercent.addEventListener("input", () => {
    state.b2bPercent = b2bPercentValue();
    syncB2bControls();
    renderProductResults();
  });
  elements.productSearch.addEventListener("input", renderProductResults);
  elements.feeType.addEventListener("change", () => syncFeeLabel(false));
  elements.addFeeButton.addEventListener("click", addFee);
  elements.productResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-product]");
    if (!button) return;
    addProduct(button.dataset.addProduct);
  });
  elements.quoteLines.addEventListener("change", (event) => {
    const input = event.target.closest("[data-line-field]");
    const row = event.target.closest("[data-line-index]");
    if (input && row) updateLine(row, input);
  });
  elements.quoteLines.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-line]");
    if (!button) return;
    removeLine(button.dataset.removeLine);
  });
  elements.saveQuoteButton.addEventListener("click", () => { void saveQuote(false); });
  elements.savePdfButton.addEventListener("click", () => { void saveQuote(true); });
  elements.downloadPdfButton.addEventListener("click", () => {
    const draft = activeQuote();
    if (draft.id) window.location.href = `${API.devis}?action=download&id=${encodeURIComponent(draft.id)}`;
  });
  elements.deleteQuoteButton.addEventListener("click", () => { void deleteQuote(); });
}

async function init() {
  installListeners();
  try {
    const authenticated = await fetchAuth();
    if (!authenticated) return;
    state.draft = blankQuote();
    await loadDashboard();
    setView("app");
  } catch (error) {
    showMessage(error.message || "Devis est indisponible.", "error");
    setView("app");
  }
}

void init();
