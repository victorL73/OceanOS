const API = {
  auth: "api/auth.php",
  orders: "api/orders.php",
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
  metricOrders: $("metric-orders"),
  metricTotal: $("metric-total"),
  metricPaid: $("metric-paid"),
  metricShipped: $("metric-shipped"),
  filtersForm: $("filters-form"),
  searchInput: $("search-input"),
  stateFilter: $("state-filter"),
  ordersList: $("orders-list"),
  detailTitle: $("detail-title"),
  detailStatus: $("detail-status"),
  detailEmpty: $("detail-empty"),
  detailContent: $("detail-content"),
  detailCustomer: $("detail-customer"),
  detailEmail: $("detail-email"),
  detailPayment: $("detail-payment"),
  detailDate: $("detail-date"),
  detailTotal: $("detail-total"),
  detailShipping: $("detail-shipping"),
  shipmentTitle: $("shipment-title"),
  shipmentList: $("shipment-list"),
  statusForm: $("status-form"),
  nextState: $("next-state"),
  statusButton: $("status-button"),
  linesBody: $("lines-body"),
};

const state = {
  user: null,
  settings: null,
  orders: [],
  states: [],
  selectedOrderId: null,
  selectedOrder: null,
};

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

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

function stateById(id) {
  return state.states.find((item) => Number(item.id) === Number(id)) || null;
}

function safeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#8fa7b0";
}

function stateLabelMarkup(order) {
  const orderState = order?.currentState || stateById(order?.currentStateId) || {};
  const color = safeColor(orderState.color);
  return `
    <span class="state-label" title="${escapeHtml(orderState.name || "Statut")}">
      <span class="state-dot" style="--state-color:${escapeHtml(color)}"></span>
      ${escapeHtml(orderState.name || "Sans statut")}
      ${order?.excludedFromRevenue ? '<em>hors CA</em>' : ""}
    </span>
  `;
}

function fillStateSelects() {
  const selectedFilter = elements.stateFilter.value;
  elements.stateFilter.innerHTML = '<option value="">Tous les statuts</option>';
  state.states.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    elements.stateFilter.appendChild(option);
  });
  elements.stateFilter.value = selectedFilter;

  elements.nextState.innerHTML = "";
  state.states.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    elements.nextState.appendChild(option);
  });
}

function renderMetrics(metrics = {}) {
  elements.metricOrders.textContent = String(metrics.orders || state.orders.length || 0);
  elements.metricTotal.textContent = money.format(Number(metrics.totalPaid || 0));
  elements.metricPaid.textContent = String(metrics.paid || 0);
  elements.metricShipped.textContent = String(metrics.shipped || 0);
}

function filteredOrders() {
  const needle = normalizeText(elements.searchInput.value);
  if (!needle) return state.orders;
  return state.orders.filter((order) => {
    const customer = order.customer || {};
    return [
      order.reference,
      customer.name,
      customer.email,
      order.payment,
      order.currentState?.name,
    ].some((value) => normalizeText(value).includes(needle));
  });
}

function renderOrders() {
  const orders = filteredOrders();
  elements.ordersList.innerHTML = "";

  if (orders.length === 0) {
    elements.ordersList.innerHTML = '<div class="empty-state">Aucune commande trouvee.</div>';
    return;
  }

  orders.forEach((order) => {
    const customer = order.customer || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `order-card ${Number(order.id) === Number(state.selectedOrderId) ? "is-active" : ""}`;
    button.innerHTML = `
      <span class="order-card-head">
        <strong>${escapeHtml(order.reference || `Commande #${order.id}`)}</strong>
        <span>${money.format(Number(order.totalPaid || 0))}</span>
      </span>
      ${stateLabelMarkup(order)}
      <small>${escapeHtml(customer.name || "Client")} ${customer.email ? "- " + escapeHtml(customer.email) : ""}</small>
      <span class="order-card-meta">
        <span>${escapeHtml(order.payment || "Paiement")}</span>
        <span>${escapeHtml(formatDateTime(order.dateAdd))}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      void selectOrder(order.id);
    });
    elements.ordersList.appendChild(button);
  });
}

function renderDetail() {
  const order = state.selectedOrder;
  const hasOrder = Boolean(order?.id);
  elements.detailEmpty.classList.toggle("hidden", hasOrder);
  elements.detailContent.classList.toggle("hidden", !hasOrder);

  if (!hasOrder) {
    elements.detailTitle.textContent = "Selectionnez une commande";
    elements.detailStatus.textContent = "En attente";
    return;
  }

  const customer = order.customer || {};
  const currentState = order.currentState || stateById(order.currentStateId) || {};
  elements.detailTitle.textContent = order.reference || `Commande #${order.id}`;
  elements.detailStatus.innerHTML = stateLabelMarkup(order);
  elements.detailCustomer.textContent = customer.company || customer.name || "Client";
  elements.detailEmail.textContent = customer.email || "";
  elements.detailPayment.textContent = order.payment || "-";
  elements.detailDate.textContent = formatDateTime(order.dateAdd || order.dateUpd);
  elements.detailTotal.textContent = money.format(Number(order.totalPaid || 0));
  elements.detailShipping.textContent = `Livraison ${money.format(Number(order.totalShipping || 0))}`;
  elements.nextState.value = String(currentState.id || order.currentStateId || "");
  renderShipments(order.shipments || []);

  elements.linesBody.innerHTML = "";
  const lines = Array.isArray(order.lines) ? order.lines : [];
  if (lines.length === 0) {
    elements.linesBody.innerHTML = '<tr><td colspan="5">Aucune ligne produit.</td></tr>';
    return;
  }

  lines.forEach((line) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(line.name || "Produit")}</td>
      <td>${escapeHtml(line.reference || "-")}</td>
      <td class="numeric">${Number(line.quantity || 0)}</td>
      <td class="numeric">${money.format(Number(line.unitPriceTaxIncl || line.unitPriceTaxExcl || 0))}</td>
      <td class="numeric">${money.format(Number(line.totalTaxIncl || line.totalTaxExcl || 0))}</td>
    `;
    elements.linesBody.appendChild(tr);
  });
}

function renderShipments(shipments) {
  const items = Array.isArray(shipments) ? shipments : [];
  elements.shipmentTitle.textContent = items.length > 0
    ? `${items.length} expedition${items.length > 1 ? "s" : ""}`
    : "Aucune expedition";
  elements.shipmentList.innerHTML = "";

  if (items.length === 0) {
    elements.shipmentList.innerHTML = '<div class="shipment-empty">Aucun colis ou numero de suivi remonte par PrestaShop.</div>';
    return;
  }

  items.forEach((shipment) => {
    const card = document.createElement("article");
    card.className = "shipment-card";

    const trackingNumber = shipment.trackingNumber || "";
    const tracking = shipment.trackingUrl && trackingNumber
      ? `<a href="${escapeHtml(shipment.trackingUrl)}" target="_blank" rel="noreferrer">${escapeHtml(trackingNumber)}</a>`
      : `<strong>${escapeHtml(trackingNumber || "Suivi non renseigne")}</strong>`;

    card.innerHTML = `
      <div>
        <span>Transporteur</span>
        <strong>${escapeHtml(shipment.carrierName || "Transporteur")}</strong>
      </div>
      <div>
        <span>Numero de suivi</span>
        ${tracking}
      </div>
      <div>
        <span>Expedition</span>
        <strong>${escapeHtml(formatDateTime(shipment.dateAdd) || "-")}</strong>
      </div>
      <div>
        <span>Frais TTC</span>
        <strong>${money.format(Number(shipment.shippingCostTaxIncl || 0))}</strong>
      </div>
    `;
    elements.shipmentList.appendChild(card);
  });
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
  if (elements.stateFilter.value) {
    params.set("state", elements.stateFilter.value);
  }

  const payload = await apiRequest(`${API.orders}${params.toString() ? `?${params}` : ""}`);
  state.settings = payload.settings || null;
  state.orders = Array.isArray(payload.orders) ? payload.orders : [];
  state.states = Array.isArray(payload.states) ? payload.states : [];
  setConnection(state.settings);
  fillStateSelects();
  renderMetrics(payload.metrics || {});
  renderOrders();

  if (state.selectedOrderId && state.orders.some((order) => Number(order.id) === Number(state.selectedOrderId))) {
    await selectOrder(state.selectedOrderId, false);
  } else {
    state.selectedOrder = null;
    state.selectedOrderId = null;
    renderDetail();
  }
}

async function selectOrder(orderId, rerenderList = true) {
  state.selectedOrderId = Number(orderId);
  if (rerenderList) renderOrders();
  elements.detailTitle.textContent = "Chargement...";
  const payload = await apiRequest(`${API.orders}?action=detail&id=${encodeURIComponent(orderId)}`);
  state.selectedOrder = payload.order || null;
  renderDetail();
}

async function changeStatus(event) {
  event.preventDefault();
  if (!state.selectedOrder?.id) return;

  const nextStateId = Number(elements.nextState.value || 0);
  if (!nextStateId) {
    showMessage("Choisissez un statut.", "error");
    return;
  }

  elements.statusButton.disabled = true;
  showMessage("");
  try {
    const payload = await apiRequest(API.orders, {
      method: "POST",
      body: JSON.stringify({
        action: "change_status",
        orderId: state.selectedOrder.id,
        stateId: nextStateId,
      }),
    });
    state.selectedOrder = payload.order || state.selectedOrder;
    if (payload.dashboard) {
      state.settings = payload.dashboard.settings || state.settings;
      state.orders = Array.isArray(payload.dashboard.orders) ? payload.dashboard.orders : state.orders;
      state.states = Array.isArray(payload.dashboard.states) ? payload.dashboard.states : state.states;
      fillStateSelects();
      renderMetrics(payload.dashboard.metrics || {});
      renderOrders();
    }
    renderDetail();
    showMessage(payload.message || "Statut mis a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour impossible.", "error");
  } finally {
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
    const targetOrderId = Number(new URLSearchParams(window.location.search).get("order") || 0);
    if (targetOrderId > 0) {
      await selectOrder(targetOrderId);
    }
  } catch (error) {
    setView("app");
    showMessage(error.message || "Commandes est indisponible.", "error");
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

elements.searchInput.addEventListener("input", renderOrders);
elements.statusForm.addEventListener("submit", changeStatus);
elements.logoutButton.addEventListener("click", async () => {
  await apiRequest(API.auth, { method: "DELETE" }).catch(() => {});
  redirectToOceanOS();
});

void boot();
