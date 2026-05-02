const API = {
  auth: "api/auth.php",
  stock: "api/stock.php",
};
const OCEANOS_URL = "/OceanOS/";
const STOCK_WORKER_URL = "assets/stock-worker.js?v=20260502-reference-order";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  connectionChip: $("connection-chip"),
  currentUser: $("current-user"),
  lastSync: $("last-sync"),
  refreshButton: $("refresh-button"),
  syncButton: $("sync-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricProducts: $("metric-products"),
  metricLow: $("metric-low"),
  metricOut: $("metric-out"),
  metricValue: $("metric-value"),
  metricOrders: $("metric-orders"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  filtersForm: $("filters-form"),
  filterSearch: $("filter-search"),
  filterStock: $("filter-stock"),
  filterActive: $("filter-active"),
  productsBody: $("products-body"),
  supplierForm: $("supplier-form"),
  supplierId: $("supplier-id"),
  supplierName: $("supplier-name"),
  supplierContact: $("supplier-contact"),
  supplierEmail: $("supplier-email"),
  supplierPhone: $("supplier-phone"),
  supplierNotes: $("supplier-notes"),
  supplierSave: $("supplier-save"),
  suppliersList: $("suppliers-list"),
  purchaseForm: $("purchase-form"),
  purchaseSupplier: $("purchase-supplier"),
  purchaseLines: $("purchase-lines"),
  purchaseAddLine: $("purchase-add-line"),
  purchaseTotal: $("purchase-total"),
  purchaseExpected: $("purchase-expected"),
  purchaseNotes: $("purchase-notes"),
  purchaseCreate: $("purchase-create"),
  ordersList: $("orders-list"),
  runsList: $("runs-list"),
  catalogFiltersForm: $("catalog-filters-form"),
  catalogSearch: $("catalog-search"),
  catalogSupplierFilter: $("catalog-supplier-filter"),
  supplierCatalog: $("supplier-catalog"),
  historyFiltersForm: $("history-filters-form"),
  historySearch: $("history-search"),
  historyStatusFilter: $("history-status-filter"),
  orderHistory: $("order-history"),
};

const state = {
  user: null,
  settings: null,
  stats: {},
  products: [],
  catalogProducts: [],
  suppliers: [],
  purchaseOrders: [],
  runs: [],
  currentView: "stock",
  focusPurchaseOrderId: 0,
  purchaseLines: [],
  nextPurchaseLineId: 1,
};

let stockWorker = null;
let stockWorkerUnavailable = false;
const stockWorkerRequestIds = { catalog: 0, history: 0 };
let catalogRenderTimer = null;
let historyRenderTimer = null;

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

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

function ensureStockWorker() {
  if (stockWorkerUnavailable || stockWorker) return stockWorker;
  if (!("Worker" in window)) {
    stockWorkerUnavailable = true;
    return null;
  }

  try {
    stockWorker = new Worker(STOCK_WORKER_URL);
    stockWorker.addEventListener("message", handleStockWorkerMessage);
    stockWorker.addEventListener("error", () => {
      stockWorkerUnavailable = true;
      stockWorker?.terminate();
      stockWorker = null;
    });
  } catch (error) {
    stockWorkerUnavailable = true;
    stockWorker = null;
  }
  return stockWorker;
}

function shouldUseStockWorker(items) {
  return !stockWorkerUnavailable && Array.isArray(items) && items.length > 120;
}

function handleStockWorkerMessage(event) {
  const message = event.data || {};
  if (message.requestId !== stockWorkerRequestIds[message.type] || message.error) return;

  if (message.type === "catalog") {
    renderSupplierCatalogGroups(message.groups || []);
    return;
  }

  if (message.type === "history") {
    renderOrderHistoryList(message.orders || []);
  }
}

function debounceRender(key, callback) {
  const timerName = key === "catalog" ? "catalogRenderTimer" : "historyRenderTimer";
  window.clearTimeout(timerName === "catalogRenderTimer" ? catalogRenderTimer : historyRenderTimer);
  const timer = window.setTimeout(callback, 80);
  if (timerName === "catalogRenderTimer") {
    catalogRenderTimer = timer;
  } else {
    historyRenderTimer = timer;
  }
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
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

function isAdmin() {
  return ["super", "admin"].includes(String(state.user?.role || "member"));
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function setActiveView(view) {
  state.currentView = view || "stock";
  elements.viewTabs.forEach((button) => {
    const active = button.dataset.view === state.currentView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== state.currentView);
  });
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
  if (elements.filterStock.value) params.set("stock", elements.filterStock.value);
  if (elements.filterActive.value) params.set("active", elements.filterActive.value);
  return params;
}

function applyInitialFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const stock = params.get("stock");
  const active = params.get("active");
  const search = params.get("search");
  const view = params.get("view");
  const orderId = Number(params.get("order") || params.get("purchaseOrder") || 0);

  if (stock === "low" || stock === "out") {
    elements.filterStock.value = stock;
  }
  if (active === "1" || active === "0" || active === "") {
    elements.filterActive.value = active;
  }
  if (search) {
    elements.filterSearch.value = search;
  }
  if (["stock", "supplier-catalog", "order-history"].includes(view)) {
    setActiveView(view);
  }
  if (orderId > 0) {
    state.focusPurchaseOrderId = orderId;
    elements.historySearch.value = String(orderId);
    setActiveView("order-history");
  }
}

async function loadDashboard() {
  const query = queryFromFilters();
  const payload = await apiRequest(`${API.stock}?${query.toString()}`);
  applyDashboard(payload.dashboard || payload);
}

function applyDashboard(payload) {
  state.user = payload.user || state.user;
  state.settings = payload.settings || null;
  state.stats = payload.stats || {};
  state.products = payload.products || [];
  state.catalogProducts = payload.catalogProducts || state.products;
  state.suppliers = payload.suppliers || [];
  state.purchaseOrders = payload.purchaseOrders || [];
  state.runs = payload.runs || [];
  render();
}

function render() {
  renderChrome();
  renderMetrics();
  renderProducts();
  renderSuppliers();
  renderPurchaseFormOptions();
  renderSupplierCatalog();
  renderOrders();
  renderOrderHistory();
  renderRuns();
  setActiveView(state.currentView);
}

function renderChrome() {
  const user = state.user || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
  const connected = Boolean(state.settings?.shopUrl && state.settings?.hasWebserviceKey);
  elements.connectionChip.textContent = connected ? "PrestaShop connecte" : "PrestaShop non configure";
  elements.connectionChip.className = connected ? "status-pill success-pill" : "status-pill muted-pill";
  elements.syncButton.disabled = !isAdmin() || !connected;
  renderLastSync();

  [
    elements.supplierSave,
    elements.purchaseAddLine,
    elements.purchaseCreate,
  ].forEach((button) => {
    button.disabled = !isAdmin();
  });
}

function renderLastSync() {
  const latestRun = state.runs.find((run) => run.finishedAt || run.startedAt);
  if (!latestRun) {
    elements.lastSync.textContent = "Derniere synchronisation: jamais";
    elements.lastSync.dataset.status = "none";
    return;
  }

  const status = latestRun.status === "success" ? "reussie" : latestRun.status === "failed" ? "echouee" : "en cours";
  const date = formatDateTime(latestRun.finishedAt || latestRun.startedAt);
  elements.lastSync.textContent = `Derniere synchronisation: ${date} (${status})`;
  elements.lastSync.dataset.status = latestRun.status || "none";
}

function renderMetrics() {
  const stats = state.stats || {};
  elements.metricProducts.textContent = String(stats.productCount || 0);
  elements.metricLow.textContent = String(stats.lowStockCount || 0);
  elements.metricOut.textContent = String(stats.outStockCount || 0);
  elements.metricValue.textContent = money.format(Number(stats.stockValue || 0));
  elements.metricOrders.textContent = String((stats.draftPurchaseOrders || 0) + (stats.orderedPurchaseOrders || 0));
}

function supplierOptions(selectedId = null, includeEmpty = true) {
  const options = includeEmpty ? ['<option value="">Aucun</option>'] : [];
  state.suppliers.forEach((supplier) => {
    const selected = Number(selectedId || 0) === Number(supplier.id) ? " selected" : "";
    options.push(`<option value="${supplier.id}"${selected}>${escapeHtml(supplier.name)}</option>`);
  });
  return options.join("");
}

function productList() {
  return state.catalogProducts.length > 0 ? state.catalogProducts : state.products;
}

function productReferenceNumber(product) {
  const match = String(product?.reference || "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function compareProductsByReference(left, right) {
  const leftNumber = productReferenceNumber(left);
  const rightNumber = productReferenceNumber(right);
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  const referenceCompare = String(left?.reference || "").localeCompare(String(right?.reference || ""), "fr", {
    numeric: true,
    sensitivity: "base",
  });
  if (referenceCompare !== 0) return referenceCompare;

  return String(left?.name || "").localeCompare(String(right?.name || ""), "fr", {
    numeric: true,
    sensitivity: "base",
  });
}

function productsByReference(products) {
  return [...products].sort(compareProductsByReference);
}

function productById(productId) {
  return productList().find((item) => Number(item.id) === Number(productId)) || null;
}

function selectedPurchaseSupplierId() {
  return Number(elements.purchaseSupplier?.value || 0);
}

function productPurchasePrice(product, supplierId = null) {
  const prices = Array.isArray(product?.supplierPurchasePrices) ? product.supplierPurchasePrices : [];
  const selectedSupplierId = Number(supplierId || 0);
  if (selectedSupplierId > 0) {
    const supplierPrice = prices.find((entry) => Number(entry.supplierId || 0) === selectedSupplierId);
    if (supplierPrice && Number(supplierPrice.priceTaxExcl || 0) > 0) {
      return Number(supplierPrice.priceTaxExcl || 0);
    }
  }

  const defaultPrice = Number(product?.purchasePriceTaxExcl || 0);
  if (defaultPrice > 0) return defaultPrice;

  const firstSupplierPrice = prices.find((entry) => Number(entry.priceTaxExcl || 0) > 0);
  return firstSupplierPrice ? Number(firstSupplierPrice.priceTaxExcl || 0) : 0;
}

function productOptions(selectedId = null) {
  const products = productsByReference(productList());
  if (products.length === 0) {
    return '<option value="">Aucun produit synchronise</option>';
  }

  return products.map((product) => {
    const selected = Number(selectedId || 0) === Number(product.id) ? " selected" : "";
    const label = product.reference ? `${product.reference} - ${product.name}` : product.name;
    return `<option value="${product.id}" data-price="${productPurchasePrice(product, selectedPurchaseSupplierId())}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function createPurchaseLine(productId = null) {
  const product = productById(productId) || productsByReference(productList())[0] || null;
  const id = state.nextPurchaseLineId++;
  return {
    id,
    productId: product ? Number(product.id) : 0,
    quantity: 1,
    unitPriceTaxExcl: product ? productPurchasePrice(product, selectedPurchaseSupplierId()) : 0,
  };
}

function ensurePurchaseLines() {
  if (state.purchaseLines.length === 0 && productList().length > 0) {
    state.purchaseLines = [createPurchaseLine()];
  }
  state.purchaseLines = state.purchaseLines.filter((line) => productList().length === 0 || productById(line.productId));
  if (state.purchaseLines.length === 0 && productList().length > 0) {
    state.purchaseLines = [createPurchaseLine()];
  }
}

function syncPurchaseLinesFromDom() {
  state.purchaseLines = Array.from(elements.purchaseLines.querySelectorAll("[data-purchase-line]")).map((row) => ({
    id: Number(row.dataset.purchaseLine),
    productId: Number(row.querySelector("[data-line-product]")?.value || 0),
    quantity: Math.max(1, Number(row.querySelector("[data-line-quantity]")?.value || 1)),
    unitPriceTaxExcl: Math.max(0, Number(row.querySelector("[data-line-price]")?.value || 0)),
  }));
}

function purchaseTotal() {
  return state.purchaseLines.reduce((total, line) => total + (Number(line.quantity || 0) * Number(line.unitPriceTaxExcl || 0)), 0);
}

function renderProducts() {
  if (state.products.length === 0) {
    elements.productsBody.innerHTML = '<tr><td colspan="7" class="empty-state">Aucun produit synchronise.</td></tr>';
    return;
  }

  elements.productsBody.innerHTML = productsByReference(state.products).map((product) => {
    const stockClass = product.quantity <= 0 ? "out" : (product.isLowStock ? "low" : "");
    const disabled = isAdmin() ? "" : " disabled";
    return `
      <tr data-product-id="${product.id}">
        <td>
          <strong>${escapeHtml(product.name)}</strong>
          <span class="table-meta">ID PrestaShop ${product.prestashopProductId}${product.active ? "" : " - inactif"}</span>
        </td>
        <td>${escapeHtml(product.reference || "-")}</td>
        <td><span class="stock-badge ${stockClass}">${product.quantity}</span></td>
        <td><input class="threshold-input" data-product-threshold type="number" min="0" value="${product.minStockAlert}"${disabled}></td>
        <td><select class="supplier-select" data-product-supplier${disabled}>${supplierOptions(product.supplierId)}</select></td>
        <td>${money.format(productPurchasePrice(product, product.supplierId))}</td>
        <td><button class="ghost-button" data-product-save="${product.id}" type="button"${disabled}>Sauver</button></td>
      </tr>
    `;
  }).join("");
}

function renderSuppliers() {
  if (state.suppliers.length === 0) {
    elements.suppliersList.innerHTML = '<div class="empty-state">Aucun fournisseur.</div>';
    return;
  }

  elements.suppliersList.innerHTML = state.suppliers.map((supplier) => `
    <article class="list-card">
      <strong>${escapeHtml(supplier.name)}</strong>
      <small>${escapeHtml(supplier.contactName || supplier.email || supplier.phone || "Contact non renseigne")}</small>
      <small>${supplier.productCount} produit(s)</small>
      <div class="card-actions">
        <button class="ghost-button" data-supplier-edit="${supplier.id}" type="button"${isAdmin() ? "" : " disabled"}>Modifier</button>
        <button class="ghost-button" data-supplier-catalog="${supplier.id}" type="button">Catalogue</button>
      </div>
    </article>
  `).join("");
}

function renderPurchaseFormOptions() {
  elements.purchaseSupplier.innerHTML = supplierOptions(null, true);
  if (productList().length === 0) {
    elements.purchaseLines.innerHTML = '<div class="empty-state">Aucun produit synchronise.</div>';
    elements.purchaseTotal.textContent = "Total achat HT: 0,00 EUR";
    elements.purchaseCreate.disabled = true;
    elements.purchaseAddLine.disabled = true;
    return;
  }

  ensurePurchaseLines();
  renderPurchaseLines();
  elements.purchaseCreate.disabled = !isAdmin();
  elements.purchaseAddLine.disabled = !isAdmin();
}

function renderPurchaseLines() {
  const disabled = isAdmin() ? "" : " disabled";
  elements.purchaseLines.innerHTML = state.purchaseLines.map((line, index) => `
    <div class="purchase-line" data-purchase-line="${line.id}">
      <label class="field line-product-field">
        <span>Produit ${index + 1}</span>
        <select data-line-product${disabled}>${productOptions(line.productId)}</select>
      </label>
      <label class="field line-quantity-field">
        <span>Quantite</span>
        <input data-line-quantity type="number" min="1" value="${Number(line.quantity || 1)}"${disabled}>
      </label>
      <label class="field line-price-field">
        <span>Prix achat HT</span>
        <input data-line-price type="number" step="0.01" min="0" value="${Number(line.unitPriceTaxExcl || 0).toFixed(2)}"${disabled}>
      </label>
      <button class="ghost-button danger-text line-remove-button" data-line-remove type="button"${state.purchaseLines.length <= 1 || !isAdmin() ? " disabled" : ""}>Retirer</button>
    </div>
  `).join("");
  elements.purchaseTotal.textContent = `Total achat HT: ${money.format(purchaseTotal())}`;
}

function statusLabel(status) {
  return {
    draft: "Brouillon",
    ordered: "Commandee",
    received: "Receptionnee",
    cancelled: "Annulee",
  }[status] || status;
}

function isUnsupportedMovementMessage(value) {
  return String(value || "").includes("non supportes par le Webservice");
}

function renderCatalogFilters() {
  const selected = elements.catalogSupplierFilter.value;
  elements.catalogSupplierFilter.innerHTML = [
    '<option value="">Tous les fournisseurs</option>',
    '<option value="__none__">Sans fournisseur</option>',
    ...state.suppliers.map((supplier) => (
      `<option value="${supplier.id}">${escapeHtml(supplier.name)}</option>`
    )),
  ].join("");
  elements.catalogSupplierFilter.value = selected;
}

function renderSupplierCatalog() {
  renderCatalogFilters();

  const search = elements.catalogSearch.value.trim().toLowerCase();
  const supplierFilter = elements.catalogSupplierFilter.value;
  const products = productList();

  if (shouldUseStockWorker(products)) {
    const worker = ensureStockWorker();
    if (worker) {
      const requestId = stockWorkerRequestIds.catalog + 1;
      stockWorkerRequestIds.catalog = requestId;
      elements.supplierCatalog.innerHTML = '<div class="empty-state">Catalogue en cours de preparation...</div>';
      worker.postMessage({
        type: "catalog",
        requestId,
        products,
        search,
        supplierFilter,
      });
      return;
    }
  }

  const filteredProducts = productsByReference(products.filter((product) => {
    const matchesSupplier = supplierFilter === ""
      || (supplierFilter === "__none__" && !product.supplierId)
      || Number(product.supplierId || 0) === Number(supplierFilter);
    const text = `${product.name || ""} ${product.reference || ""} ${product.supplierName || ""}`.toLowerCase();
    return matchesSupplier && (search === "" || text.includes(search));
  }));

  if (filteredProducts.length === 0) {
    elements.supplierCatalog.innerHTML = '<div class="empty-state">Aucun produit dans ce catalogue.</div>';
    return;
  }

  const groups = new Map();
  filteredProducts.forEach((product) => {
    const key = product.supplierId ? `supplier-${product.supplierId}` : "none";
    if (!groups.has(key)) {
      groups.set(key, {
        name: product.supplierName || "Sans fournisseur",
        stockValue: 0,
        lowCount: 0,
        products: [],
      });
    }
    const group = groups.get(key);
    group.products.push(product);
    group.stockValue += Number(product.quantity || 0) * productPurchasePrice(product, product.supplierId);
    if (product.isLowStock) group.lowCount += 1;
  });

  renderSupplierCatalogGroups(Array.from(groups.values()));
}

function renderSupplierCatalogGroups(groups) {
  if (groups.length === 0) {
    elements.supplierCatalog.innerHTML = '<div class="empty-state">Aucun produit dans ce catalogue.</div>';
    return;
  }

  elements.supplierCatalog.innerHTML = groups.map((group) => `
      <article class="catalog-group">
        <div class="catalog-group-head">
          <div>
            <h3>${escapeHtml(group.name)}</h3>
            <p>${group.products.length} produit(s) - ${group.lowCount || 0} alerte(s) - ${money.format(Number(group.stockValue || 0))}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="catalog-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Reference</th>
                <th>Stock</th>
                <th>Alerte</th>
                <th>Prix achat HT</th>
              </tr>
            </thead>
            <tbody>
              ${productsByReference(group.products).map((product) => {
                const stockClass = product.quantity <= 0 ? "out" : (product.isLowStock ? "low" : "");
                return `
                  <tr>
                    <td>
                      <strong>${escapeHtml(product.name)}</strong>
                      <span class="table-meta">ID PrestaShop ${product.prestashopProductId}${product.active ? "" : " - inactif"}</span>
                    </td>
                    <td>${escapeHtml(product.reference || "-")}</td>
                    <td><span class="stock-badge ${stockClass}">${product.quantity}</span></td>
                    <td>${product.minStockAlert}</td>
                    <td>${money.format(productPurchasePrice(product, product.supplierId))}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `).join("");
}

function renderOrders() {
  if (state.purchaseOrders.length === 0) {
    elements.ordersList.innerHTML = '<div class="empty-state">Aucune commande fournisseur.</div>';
    return;
  }

  elements.ordersList.innerHTML = state.purchaseOrders.map((order) => `
    <article class="list-card">
      <strong>${escapeHtml(order.orderNumber)}</strong>
      <small>${escapeHtml(order.supplierName || "Fournisseur non renseigne")} - ${statusLabel(order.status)} - ${money.format(Number(order.totalTaxExcl || 0))}</small>
      <small>${order.lineCount} ligne(s)${order.expectedAt ? ` - livraison ${escapeHtml(order.expectedAt)}` : ""}</small>
      <div class="card-actions">
        <select data-order-status="${order.id}"${isAdmin() ? "" : " disabled"}>
          ${["draft", "ordered", "received", "cancelled"].map((status) => (
            `<option value="${status}"${status === order.status ? " selected" : ""}>${statusLabel(status)}</option>`
          )).join("")}
        </select>
        <button class="ghost-button" data-order-save="${order.id}" type="button"${isAdmin() ? "" : " disabled"}>Sauver</button>
        <button class="ghost-button" data-order-open="${order.id}" type="button">Historique</button>
        ${order.status === "cancelled" ? `<button class="danger-button" data-order-delete="${order.id}" type="button"${isAdmin() ? "" : " disabled"}>Supprimer</button>` : ""}
      </div>
    </article>
  `).join("");
}

function orderMatchesSearch(order, search) {
  if (search === "") return true;
  const lineText = (order.lines || []).map((line) => `${line.label || ""} ${line.productReference || ""}`).join(" ");
  const text = `${order.id || ""} ${order.orderNumber || ""} ${order.supplierName || ""} ${order.notes || ""} ${lineText}`.toLowerCase();
  return text.includes(search);
}

function renderOrderHistory() {
  const search = elements.historySearch.value.trim().toLowerCase();
  const status = elements.historyStatusFilter.value;
  const orders = state.purchaseOrders || [];
  const focusedOrderId = Number(state.focusPurchaseOrderId || 0);

  if (focusedOrderId > 0 && search === String(focusedOrderId)) {
    renderOrderHistoryList(orders.filter((order) => (
      Number(order.id) === focusedOrderId && (status === "" || order.status === status)
    )));
    return;
  }

  if (shouldUseStockWorker(orders)) {
    const worker = ensureStockWorker();
    if (worker) {
      const requestId = stockWorkerRequestIds.history + 1;
      stockWorkerRequestIds.history = requestId;
      elements.orderHistory.innerHTML = '<div class="empty-state">Historique en cours de preparation...</div>';
      worker.postMessage({
        type: "history",
        requestId,
        orders,
        search,
        status,
      });
      return;
    }
  }

  renderOrderHistoryList(orders.filter((order) => (
    (status === "" || order.status === status) && orderMatchesSearch(order, search)
  )));
}

function renderOrderHistoryList(orders) {
  if (orders.length === 0) {
    elements.orderHistory.innerHTML = '<div class="empty-state">Aucune commande dans cet historique.</div>';
    return;
  }

  elements.orderHistory.innerHTML = orders.map((order) => `
    <article class="history-card${Number(order.id) === Number(state.focusPurchaseOrderId) ? " is-focused" : ""}" data-purchase-order-id="${order.id}">
      <div class="history-head">
        <div>
          <strong>${escapeHtml(order.orderNumber)}</strong>
          <span>${escapeHtml(order.supplierName || "Fournisseur non renseigne")} - ${statusLabel(order.status)}</span>
        </div>
        <div class="history-total">${money.format(Number(order.totalTaxExcl || 0))}</div>
      </div>
      <div class="history-meta">
        <span>Creee le ${escapeHtml(formatDateTime(order.createdAt))}</span>
        ${order.expectedAt ? `<span>Livraison ${escapeHtml(order.expectedAt)}</span>` : ""}
        ${order.userDisplayName ? `<span>${escapeHtml(order.userDisplayName)}</span>` : ""}
      </div>
      ${(order.lines || []).length === 0 ? '<div class="empty-state compact-empty">Aucune ligne.</div>' : `
        <div class="table-wrap">
          <table class="history-lines-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Reference</th>
                <th>Quantite</th>
                <th>Recu</th>
                <th>PrestaShop</th>
                <th>Prix achat HT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.lines || []).map((line) => `
                <tr>
                  <td>${escapeHtml(line.label || "-")}</td>
                  <td>${escapeHtml(line.productReference || "-")}</td>
                  <td>${line.quantityOrdered}</td>
                  <td>${line.quantityReceived}</td>
                  <td>
                    <span>${line.prestashopStockDelta || 0} stock</span>
                    <span class="table-meta">${line.prestashopMovementDelta || 0} mouvement</span>
                    ${line.prestashopMovementError ? `<span class="table-meta ${isUnsupportedMovementMessage(line.prestashopMovementError) ? "" : "danger-text"}">${escapeHtml(line.prestashopMovementError)}</span>` : ""}
                  </td>
                  <td>${money.format(Number(line.unitPriceTaxExcl || 0))}</td>
                  <td>${money.format(Number(line.lineTotalTaxExcl || 0))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
      ${order.notes ? `<p class="history-notes">${escapeHtml(order.notes)}</p>` : ""}
      <div class="card-actions">
        <select data-order-status="${order.id}"${isAdmin() ? "" : " disabled"}>
          ${["draft", "ordered", "received", "cancelled"].map((item) => (
            `<option value="${item}"${item === order.status ? " selected" : ""}>${statusLabel(item)}</option>`
          )).join("")}
        </select>
        <button class="ghost-button" data-order-save="${order.id}" type="button"${isAdmin() ? "" : " disabled"}>Sauver</button>
        ${order.status === "cancelled" ? `<button class="danger-button" data-order-delete="${order.id}" type="button"${isAdmin() ? "" : " disabled"}>Supprimer</button>` : ""}
      </div>
    </article>
  `).join("");
  focusPurchaseOrder();
}

function renderRuns() {
  if (state.runs.length === 0) {
    elements.runsList.innerHTML = '<div class="empty-state">Aucune synchronisation.</div>';
    return;
  }

  elements.runsList.innerHTML = state.runs.map((run) => `
    <article class="list-card">
      <strong>${run.status === "success" ? "Succes" : run.status === "failed" ? "Echec" : "En cours"}</strong>
      <small>${escapeHtml(run.message || "")}</small>
      <small>${escapeHtml(run.startedAt || "")}</small>
    </article>
  `).join("");
}

function focusPurchaseOrder() {
  if (!state.focusPurchaseOrderId) return;
  window.requestAnimationFrame(() => {
    const card = elements.orderHistory.querySelector(`[data-purchase-order-id="${state.focusPurchaseOrderId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

async function syncStock() {
  elements.syncButton.disabled = true;
  showMessage("Synchronisation PrestaShop en cours...");
  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({ action: "sync", limit: 250 }),
    });
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Synchronisation terminee.", "success");
  } catch (error) {
    showMessage(error.message || "Synchronisation impossible.", "error");
  } finally {
    renderChrome();
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  elements.supplierSave.disabled = true;
  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({
        action: "save_supplier",
        id: Number(elements.supplierId.value || 0),
        name: elements.supplierName.value.trim(),
        contactName: elements.supplierContact.value.trim(),
        email: elements.supplierEmail.value.trim(),
        phone: elements.supplierPhone.value.trim(),
        notes: elements.supplierNotes.value.trim(),
      }),
    });
    elements.supplierForm.reset();
    elements.supplierId.value = "";
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Fournisseur enregistre.", "success");
  } catch (error) {
    showMessage(error.message || "Sauvegarde fournisseur impossible.", "error");
  } finally {
    elements.supplierSave.disabled = !isAdmin();
  }
}

async function saveProduct(productId) {
  const row = elements.productsBody.querySelector(`tr[data-product-id="${productId}"]`);
  if (!row) return;
  const threshold = row.querySelector("[data-product-threshold]");
  const supplier = row.querySelector("[data-product-supplier]");
  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({
        action: "update_product",
        id: Number(productId),
        minStockAlert: Number(threshold.value || 0),
        supplierId: Number(supplier.value || 0),
      }),
    });
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Produit mis a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour produit impossible.", "error");
  }
}

function editSupplier(supplierId) {
  const supplier = state.suppliers.find((item) => Number(item.id) === Number(supplierId));
  if (!supplier) return;
  elements.supplierId.value = supplier.id;
  elements.supplierName.value = supplier.name || "";
  elements.supplierContact.value = supplier.contactName || "";
  elements.supplierEmail.value = supplier.email || "";
  elements.supplierPhone.value = supplier.phone || "";
  elements.supplierNotes.value = supplier.notes || "";
  elements.supplierName.focus();
}

async function createPurchaseOrder(event) {
  event.preventDefault();
  elements.purchaseCreate.disabled = true;
  syncPurchaseLinesFromDom();
  const lines = state.purchaseLines
    .map((line) => {
      const product = productById(line.productId);
      return {
        productId: Number(line.productId || 0),
        label: product?.name || "",
        quantity: Number(line.quantity || 1),
        unitPriceTaxExcl: Number(line.unitPriceTaxExcl || 0),
      };
    })
    .filter((line) => line.productId > 0);

  if (lines.length === 0) {
    showMessage("Ajoutez au moins une ligne de produit.", "error");
    elements.purchaseCreate.disabled = !isAdmin();
    return;
  }

  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({
        action: "create_purchase_order",
        supplierId: Number(elements.purchaseSupplier.value || 0),
        expectedAt: elements.purchaseExpected.value,
        notes: elements.purchaseNotes.value.trim(),
        lines,
      }),
    });
    elements.purchaseForm.reset();
    state.purchaseLines = [];
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Commande fournisseur creee.", "success");
  } catch (error) {
    showMessage(error.message || "Creation de commande impossible.", "error");
  } finally {
    elements.purchaseCreate.disabled = !isAdmin();
  }
}

async function saveOrderStatus(orderId, context = document) {
  const select = context.querySelector(`[data-order-status="${orderId}"]`) || document.querySelector(`[data-order-status="${orderId}"]`);
  if (!select) return;
  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({
        action: "update_purchase_order_status",
        id: Number(orderId),
        status: select.value,
      }),
    });
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Commande mise a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour commande impossible.", "error");
  }
}

async function deleteOrder(orderId) {
  const order = state.purchaseOrders.find((item) => Number(item.id) === Number(orderId));
  if (!order || order.status !== "cancelled") {
    showMessage("Seules les commandes annulees peuvent etre supprimees.", "error");
    return;
  }
  const label = order.orderNumber || `commande #${orderId}`;
  if (!window.confirm(`Supprimer definitivement ${label} ?`)) {
    return;
  }

  try {
    const payload = await apiRequest(API.stock, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_purchase_order",
        id: Number(orderId),
      }),
    });
    applyDashboard(payload.dashboard || {});
    showMessage(payload.message || "Commande supprimee.", "success");
  } catch (error) {
    showMessage(error.message || "Suppression de commande impossible.", "error");
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
    button.addEventListener("click", () => setActiveView(button.dataset.view || "stock"));
  });

  elements.refreshButton.addEventListener("click", () => {
    void loadDashboard().then(() => showMessage("Donnees actualisees.", "success")).catch((error) => showMessage(error.message, "error"));
  });
  elements.syncButton.addEventListener("click", () => { void syncStock(); });
  elements.logoutButton.addEventListener("click", () => { void logout(); });
  elements.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadDashboard();
  });
  elements.supplierForm.addEventListener("submit", saveSupplier);
  elements.purchaseForm.addEventListener("submit", createPurchaseOrder);
  elements.purchaseAddLine.addEventListener("click", () => {
    syncPurchaseLinesFromDom();
    state.purchaseLines.push(createPurchaseLine());
    renderPurchaseLines();
  });
  elements.purchaseLines.addEventListener("change", (event) => {
    const row = event.target.closest("[data-purchase-line]");
    if (!row) return;
    if (event.target.matches("[data-line-product]")) {
      const product = productById(event.target.value);
      const price = row.querySelector("[data-line-price]");
      if (product && price) {
        price.value = productPurchasePrice(product, selectedPurchaseSupplierId()).toFixed(2);
      }
    }
    syncPurchaseLinesFromDom();
    renderPurchaseLines();
  });
  elements.purchaseLines.addEventListener("input", (event) => {
    if (!event.target.matches("[data-line-quantity], [data-line-price]")) return;
    syncPurchaseLinesFromDom();
    elements.purchaseTotal.textContent = `Total achat HT: ${money.format(purchaseTotal())}`;
  });
  elements.purchaseSupplier.addEventListener("change", () => {
    syncPurchaseLinesFromDom();
    state.purchaseLines = state.purchaseLines.map((line) => {
      const product = productById(line.productId);
      return {
        ...line,
        unitPriceTaxExcl: product ? productPurchasePrice(product, selectedPurchaseSupplierId()) : Number(line.unitPriceTaxExcl || 0),
      };
    });
    renderPurchaseLines();
  });
  elements.purchaseLines.addEventListener("click", (event) => {
    const button = event.target.closest("[data-line-remove]");
    if (!button) return;
    const row = button.closest("[data-purchase-line]");
    if (!row) return;
    syncPurchaseLinesFromDom();
    state.purchaseLines = state.purchaseLines.filter((line) => Number(line.id) !== Number(row.dataset.purchaseLine));
    ensurePurchaseLines();
    renderPurchaseLines();
  });
  elements.catalogFiltersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSupplierCatalog();
  });
  elements.catalogSearch.addEventListener("input", () => debounceRender("catalog", renderSupplierCatalog));
  elements.catalogSupplierFilter.addEventListener("change", renderSupplierCatalog);
  elements.historyFiltersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderOrderHistory();
  });
  elements.historySearch.addEventListener("input", () => debounceRender("history", renderOrderHistory));
  elements.historyStatusFilter.addEventListener("change", renderOrderHistory);

  elements.productsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-save]");
    if (button) {
      void saveProduct(button.dataset.productSave);
    }
  });

  elements.suppliersList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-supplier-edit]");
    if (button) {
      editSupplier(button.dataset.supplierEdit);
    }
    const catalogButton = event.target.closest("[data-supplier-catalog]");
    if (catalogButton) {
      elements.catalogSupplierFilter.value = catalogButton.dataset.supplierCatalog;
      setActiveView("supplier-catalog");
      renderSupplierCatalog();
    }
  });

  elements.ordersList.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-order-save]");
    if (saveButton) {
      void saveOrderStatus(saveButton.dataset.orderSave, saveButton.closest(".list-card") || elements.ordersList);
    }
    const openButton = event.target.closest("[data-order-open]");
    if (openButton) {
      elements.historySearch.value = openButton.dataset.orderOpen || "";
      setActiveView("order-history");
      renderOrderHistory();
    }
    const deleteButton = event.target.closest("[data-order-delete]");
    if (deleteButton) {
      void deleteOrder(deleteButton.dataset.orderDelete);
    }
  });

  elements.orderHistory.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-save]");
    if (button) {
      void saveOrderStatus(button.dataset.orderSave, button.closest(".history-card") || elements.orderHistory);
    }
    const deleteButton = event.target.closest("[data-order-delete]");
    if (deleteButton) {
      void deleteOrder(deleteButton.dataset.orderDelete);
    }
  });
}

async function init() {
  installListeners();
  try {
    const authenticated = await fetchAuth();
    if (!authenticated) return;
    applyInitialFiltersFromUrl();
    await loadDashboard();
    setView("app");
  } catch (error) {
    showMessage(error.message || "Stockcean est indisponible.", "error");
    setView("app");
  }
}

void init();
