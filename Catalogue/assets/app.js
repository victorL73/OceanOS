const API_URL = "api/catalogue.php";
const CART_KEY = "catalogueCart";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  priceChip: $("price-chip"),
  subtitle: $("catalogue-subtitle"),
  appMessage: $("app-message"),
  frontTabButton: $("front-tab-button"),
  backofficeTabButton: $("backoffice-tab-button"),
  clientButton: $("client-button"),
  frontView: $("front-view"),
  backofficeView: $("backoffice-view"),
  metricProducts: $("metric-products"),
  metricCategories: $("metric-categories"),
  metricCart: $("metric-cart"),
  metricOrders: $("metric-orders"),
  searchInput: $("search-input"),
  categoryFilter: $("category-filter"),
  productGrid: $("product-grid"),
  cartList: $("cart-list"),
  clearCartButton: $("clear-cart-button"),
  orderMessage: $("order-message"),
  cartTotalHt: $("cart-total-ht"),
  cartTotalTtc: $("cart-total-ttc"),
  placeOrderButton: $("place-order-button"),
  ordersPanel: $("orders-panel"),
  ordersList: $("orders-list"),
  adminMetricProducts: $("admin-metric-products"),
  adminMetricActive: $("admin-metric-active"),
  adminMetricPresta: $("admin-metric-presta"),
  adminMetricOrders: $("admin-metric-orders"),
  openFrontButton: $("open-front-button"),
  syncPrestashopButton: $("sync-prestashop-button"),
  newProductButton: $("new-product-button"),
  adminSearchInput: $("admin-search-input"),
  adminProductsList: $("admin-products-list"),
  adminOrdersList: $("admin-orders-list"),
  productForm: $("product-form"),
  editorTitle: $("editor-title"),
  productName: $("product-name"),
  productSku: $("product-sku"),
  productReference: $("product-reference"),
  productCategory: $("product-category"),
  productBrand: $("product-brand"),
  productPrice: $("product-price"),
  productTax: $("product-tax"),
  productStock: $("product-stock"),
  productShortDescription: $("product-short-description"),
  productDescription: $("product-description"),
  productActive: $("product-active"),
  productFeatured: $("product-featured"),
  productImages: $("product-images"),
  productPhotoList: $("product-photo-list"),
  saveProductButton: $("save-product-button"),
  disableProductButton: $("disable-product-button"),
  authModal: $("auth-modal"),
  authTitle: $("auth-title"),
  closeAuthButton: $("close-auth-button"),
  authForm: $("auth-form"),
  loginModeButton: $("login-mode-button"),
  registerModeButton: $("register-mode-button"),
  authNameField: $("auth-name-field"),
  authCompanyField: $("auth-company-field"),
  authName: $("auth-name"),
  authCompany: $("auth-company"),
  authEmail: $("auth-email"),
  authPassword: $("auth-password"),
  authSubmitButton: $("auth-submit-button"),
  productDetailModal: $("product-detail-modal"),
  productDetailTitle: $("product-detail-title"),
  productDetailContent: $("product-detail-content"),
  closeProductDetailButton: $("close-product-detail-button"),
};

const state = {
  products: [],
  orders: [],
  client: null,
  internalUser: null,
  isBackoffice: false,
  canSeePrices: false,
  company: null,
  backoffice: null,
  activeView: initialRequestedView(),
  authMode: "login",
  cart: loadCart(),
  selectedProductId: null,
  detailProductId: null,
};

function initialRequestedView() {
  const view = new URLSearchParams(window.location.search).get("view");
  return ["backoffice", "admin"].includes(String(view || "").toLowerCase()) ? "backoffice" : "front";
}

const money = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
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

function loadCart() {
  try {
    const decoded = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(decoded) ? decoded : [];
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function setLoading(loading) {
  elements.loadingView.classList.toggle("hidden", !loading);
  elements.appView.classList.toggle("hidden", loading);
}

async function apiRequest(options = {}) {
  const response = await fetch(API_URL, {
    credentials: "same-origin",
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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

function applyDashboard(payload) {
  state.products = Array.isArray(payload.products) ? payload.products : [];
  state.orders = Array.isArray(payload.orders) ? payload.orders : [];
  state.client = payload.client || null;
  state.internalUser = payload.internalUser || null;
  state.isBackoffice = Boolean(payload.isBackoffice) && !state.client;
  state.canSeePrices = Boolean(payload.canSeePrices);
  state.company = payload.company || null;
  state.backoffice = state.isBackoffice ? payload.backoffice || null : null;
  if (!state.isBackoffice && state.activeView === "backoffice") {
    state.activeView = "front";
  }
  pruneCart();
}

async function loadDashboard() {
  const payload = await apiRequest();
  applyDashboard(payload);
  render();
}

function categories() {
  const values = new Set();
  state.products.forEach((product) => {
    const category = String(product.category || "").trim();
    if (category) values.add(category);
  });
  return [...values].sort((a, b) => a.localeCompare(b, "fr"));
}

function filteredProducts() {
  const query = normalize(elements.searchInput.value);
  const category = elements.categoryFilter.value;
  return state.products.filter((product) => {
    if (category && product.category !== category) return false;
    if (!query) return true;
    return normalize([
      product.name,
      product.sku,
      product.reference,
      product.category,
      product.brand,
      product.shortDescription,
    ].join(" ")).includes(query);
  });
}

function productById(productId) {
  return state.products.find((product) => Number(product.id) === Number(productId))
    || state.backoffice?.products?.find((product) => Number(product.id) === Number(productId))
    || null;
}

function detailProduct() {
  return state.detailProductId ? productById(state.detailProductId) : null;
}

function productInitials(product) {
  return String(product?.name || "CA")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function productPriceHt(product) {
  return Math.max(0, parseNumber(product?.priceHt));
}

function productPriceTtc(product) {
  if (product?.priceTtc !== undefined) return Math.max(0, parseNumber(product.priceTtc));
  return productPriceHt(product) * (1 + parseNumber(product?.taxRate || 20) / 100);
}

function cartQuantity(productId) {
  const item = state.cart.find((line) => Number(line.productId) === Number(productId));
  return item ? Number(item.quantity || 0) : 0;
}

function cartTotals() {
  let totalHt = 0;
  let totalTtc = 0;
  state.cart.forEach((item) => {
    const product = productById(item.productId);
    if (!product) return;
    const quantity = Math.max(0, Number(item.quantity || 0));
    totalHt += quantity * productPriceHt(product);
    totalTtc += quantity * productPriceTtc(product);
  });
  return { totalHt, totalTtc };
}

function pruneCart() {
  const availableIds = new Set(state.products.map((product) => Number(product.id)));
  const before = state.cart.length;
  state.cart = state.cart.filter((item) => availableIds.has(Number(item.productId)) && Number(item.quantity || 0) > 0);
  if (state.cart.length !== before) saveCart();
}

function renderChrome() {
  const hasClient = Boolean(state.client);
  elements.priceChip.textContent = state.canSeePrices ? "Prix visibles" : "Prix masques";
  elements.priceChip.className = state.canSeePrices ? "status-pill success-pill" : "status-pill muted-pill";
  elements.subtitle.textContent = state.company?.companyName
    ? `Catalogue produits ${state.company.companyName}.`
    : "Catalogue produits RenovBoat.";
  elements.clientButton.textContent = hasClient
    ? `Client: ${state.client.displayName || state.client.email}`
    : "Connexion client";
  elements.backofficeTabButton.classList.toggle("hidden", !state.isBackoffice);
  elements.frontTabButton.classList.toggle("is-active", state.activeView === "front");
  elements.backofficeTabButton.classList.toggle("is-active", state.activeView === "backoffice");
  elements.frontView.classList.toggle("hidden", state.activeView !== "front");
  elements.backofficeView.classList.toggle("hidden", state.activeView !== "backoffice");
}

function renderMetrics() {
  elements.metricProducts.textContent = String(state.products.length);
  elements.metricCategories.textContent = String(categories().length);
  elements.metricCart.textContent = String(state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
  elements.metricOrders.textContent = String(state.orders.length);

  const stats = state.backoffice?.stats || {};
  elements.adminMetricProducts.textContent = String(stats.products || 0);
  elements.adminMetricActive.textContent = String(stats.activeProducts || 0);
  elements.adminMetricPresta.textContent = String(stats.prestashopProducts || 0);
  elements.adminMetricOrders.textContent = String(stats.orders || 0);
}

function renderCategoryFilter() {
  const current = elements.categoryFilter.value;
  const options = categories();
  elements.categoryFilter.innerHTML = [
    '<option value="">Toutes</option>',
    ...options.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");
  elements.categoryFilter.value = options.includes(current) ? current : "";
}

function renderProducts() {
  const products = filteredProducts();
  if (products.length === 0) {
    elements.productGrid.innerHTML = '<div class="empty-state">Aucun produit trouve.</div>';
    return;
  }

  elements.productGrid.innerHTML = products.map((product) => {
    const inCart = cartQuantity(product.id);
    const price = state.canSeePrices
      ? `<strong class="price">${escapeHtml(money.format(productPriceTtc(product)))}</strong>`
      : '<strong class="price locked">Prix sur connexion</strong>';
    const image = product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<div class="product-placeholder">${escapeHtml(productInitials(product))}</div>`;
    const action = state.canSeePrices
      ? `<button class="ghost-button compact" data-add-product="${product.id}" type="button">${inCart > 0 ? `Ajoute (${inCart})` : "Ajouter"}</button>`
      : `<button class="ghost-button compact" data-open-auth type="button">Connexion</button>`;

    return `
      <article class="product-card" data-view-product="${product.id}" tabindex="0" role="button" aria-label="Voir ${escapeHtml(product.name || "produit")}">
        <div class="product-media">
          ${image}
          ${product.featured ? '<span class="product-badge">Selection</span>' : ""}
        </div>
        <div class="product-body">
          <div class="product-title">
            <strong title="${escapeHtml(product.name)}">${escapeHtml(product.name || "Produit")}</strong>
            <span>${escapeHtml(product.sku || product.reference || product.category || "Catalogue")}</span>
          </div>
          <p class="product-description">${escapeHtml(product.shortDescription || product.description || "")}</p>
          <div class="product-footer">
            ${price}
            ${action}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderCart() {
  if (state.cart.length === 0) {
    elements.cartList.innerHTML = '<div class="empty-state">Panier vide.</div>';
  } else {
    elements.cartList.innerHTML = state.cart.map((item) => {
      const product = productById(item.productId);
      if (!product) return "";
      const quantity = Number(item.quantity || 0);
      const total = quantity * productPriceTtc(product);
      return `
        <article class="cart-line" data-cart-product="${product.id}">
          <div class="cart-line-head">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(money.format(total))}</span>
          </div>
          <span>${escapeHtml(product.sku || product.reference || product.category || "")}</span>
          <div class="cart-line-actions">
            <input data-cart-quantity="${product.id}" type="number" min="1" step="1" value="${quantity}">
            <span>${escapeHtml(money.format(productPriceTtc(product)))} / ${escapeHtml(product.unit || "piece")}</span>
            <button class="remove-button" data-remove-product="${product.id}" type="button">x</button>
          </div>
        </article>
      `;
    }).join("");
  }

  const totals = cartTotals();
  elements.cartTotalHt.textContent = state.canSeePrices ? money.format(totals.totalHt) : "Connexion requise";
  elements.cartTotalTtc.textContent = state.canSeePrices ? money.format(totals.totalTtc) : "Connexion requise";
  elements.placeOrderButton.disabled = state.cart.length === 0;
}

function renderOrders() {
  elements.ordersPanel.classList.toggle("hidden", !state.client);
  if (!state.client) return;
  if (state.orders.length === 0) {
    elements.ordersList.innerHTML = '<div class="empty-state">Aucun devis genere.</div>';
    return;
  }

  elements.ordersList.innerHTML = state.orders.map((order) => `
    <article class="order-item">
      <div class="order-head">
        <strong>${escapeHtml(order.reference || `Commande #${order.id}`)}</strong>
        <span>${escapeHtml(money.format(order.totalTtc || 0))}</span>
      </div>
      <span>${escapeHtml(formatDate(order.createdAt))} - ${escapeHtml(order.status || "")}</span>
      <a class="ghost-link" href="${escapeHtml(order.pdfUrl)}">PDF</a>
    </article>
  `).join("");
}

function adminProducts() {
  const query = normalize(elements.adminSearchInput.value);
  const products = Array.isArray(state.backoffice?.products) ? state.backoffice.products : [];
  if (!query) return products;
  return products.filter((product) => normalize([
    product.name,
    product.sku,
    product.reference,
    product.category,
    product.brand,
    product.source,
  ].join(" ")).includes(query));
}

function renderAdminProducts() {
  if (!state.isBackoffice) return;
  const products = adminProducts();
  if (products.length === 0) {
    elements.adminProductsList.innerHTML = '<div class="empty-state">Aucun produit backoffice.</div>';
    return;
  }

  elements.adminProductsList.innerHTML = products.map((product) => {
    const active = Number(product.id) === Number(state.selectedProductId);
    const image = product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">`
      : escapeHtml(productInitials(product));
    return `
      <article class="admin-product${active ? " is-active" : ""}" data-admin-product="${product.id}">
        <div class="admin-thumb">${image}</div>
        <div class="admin-product-content">
          <div class="admin-product-head">
            <strong>${escapeHtml(product.name)}</strong>
            <span class="price">${escapeHtml(money.format(productPriceHt(product)))} HT</span>
          </div>
          <div class="admin-product-meta">
            <span>${escapeHtml(product.sku || "Sans SKU")}</span>
            <span>${escapeHtml(product.reference || "Sans ref")}</span>
            <span>${escapeHtml(product.category || "Sans categorie")}</span>
            <span class="source-pill">${escapeHtml(product.source || "manual")}</span>
            ${product.prestashopSyncLocked ? '<span class="lock-pill">Sync protegee</span>' : ""}
            <span>${product.active ? "Actif" : "Masque"}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderAdminOrders() {
  if (!state.isBackoffice) return;
  const orders = Array.isArray(state.backoffice?.orders) ? state.backoffice.orders : [];
  if (orders.length === 0) {
    elements.adminOrdersList.innerHTML = '<div class="empty-state">Aucune commande catalogue.</div>';
    return;
  }

  elements.adminOrdersList.innerHTML = orders.map((order) => `
    <article class="order-item">
      <div class="order-head">
        <strong>${escapeHtml(order.reference || `Commande #${order.id}`)}</strong>
        <span>${escapeHtml(money.format(order.totalTtc || 0))}</span>
      </div>
      <span>${escapeHtml(order.clientName || "Client")} - ${escapeHtml(order.clientEmail || "")}</span>
      <span>${escapeHtml(formatDate(order.createdAt))} - ${escapeHtml(order.status || "")}</span>
      <a class="ghost-link" href="${escapeHtml(order.pdfUrl)}">PDF</a>
    </article>
  `).join("");
}

function blankProduct() {
  return {
    id: null,
    name: "",
    sku: "",
    reference: "",
    category: "",
    brand: "",
    shortDescription: "",
    description: "",
    priceHt: 0,
    taxRate: 20,
    stockQuantity: 0,
    active: true,
    featured: false,
    images: [],
  };
}

function selectedAdminProduct() {
  if (!state.selectedProductId) return blankProduct();
  return state.backoffice?.products?.find((product) => Number(product.id) === Number(state.selectedProductId)) || blankProduct();
}

function fillProductForm(product) {
  elements.editorTitle.textContent = product.id ? product.name || "Produit" : "Nouveau produit";
  elements.productName.value = product.name || "";
  elements.productSku.value = product.sku || "";
  elements.productReference.value = product.reference || "";
  elements.productCategory.value = product.category || "";
  elements.productBrand.value = product.brand || "";
  elements.productPrice.value = product.priceHt ?? 0;
  elements.productTax.value = product.taxRate ?? 20;
  elements.productStock.value = product.stockQuantity ?? 0;
  elements.productShortDescription.value = product.shortDescription || "";
  elements.productDescription.value = product.description || "";
  elements.productActive.checked = product.active !== false;
  elements.productFeatured.checked = Boolean(product.featured);
  elements.productImages.value = "";
  elements.disableProductButton.disabled = !product.id;
  renderPhotoList(product);
}

function renderPhotoList(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  if (images.length === 0 && !product.imageUrl) {
    elements.productPhotoList.innerHTML = '<span class="photo-chip">Photo</span>';
    return;
  }
  const urls = images.length > 0 ? images.map((image) => image.imageUrl).filter(Boolean) : [product.imageUrl];
  elements.productPhotoList.innerHTML = urls.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name || "Produit")}">`).join("");
}

function productFromForm() {
  return {
    id: state.selectedProductId || null,
    name: elements.productName.value.trim(),
    sku: elements.productSku.value.trim(),
    reference: elements.productReference.value.trim(),
    category: elements.productCategory.value.trim(),
    brand: elements.productBrand.value.trim(),
    priceHt: parseNumber(elements.productPrice.value),
    taxRate: parseNumber(elements.productTax.value || 20),
    stockQuantity: parseNumber(elements.productStock.value),
    shortDescription: elements.productShortDescription.value.trim(),
    description: elements.productDescription.value.trim(),
    active: elements.productActive.checked,
    featured: elements.productFeatured.checked,
  };
}

function renderBackoffice() {
  if (!state.isBackoffice) return;
  renderAdminProducts();
  renderAdminOrders();
  fillProductForm(selectedAdminProduct());
}

function renderAuthModal() {
  const isRegister = state.authMode === "register";
  elements.authTitle.textContent = isRegister ? "Creation compte catalogue" : "Connexion catalogue";
  elements.authSubmitButton.textContent = isRegister ? "Creer le compte" : "Se connecter";
  elements.authNameField.classList.toggle("hidden", !isRegister);
  elements.authCompanyField.classList.toggle("hidden", !isRegister);
  elements.loginModeButton.classList.toggle("is-active", !isRegister);
  elements.registerModeButton.classList.toggle("is-active", isRegister);
  elements.authPassword.autocomplete = isRegister ? "new-password" : "current-password";
}

function renderProductDetail() {
  const product = detailProduct();
  elements.productDetailModal.classList.toggle("hidden", !product);
  if (!product) {
    elements.productDetailContent.innerHTML = "";
    return;
  }

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images.map((image) => image.imageUrl).filter(Boolean)
    : (product.imageUrl ? [product.imageUrl] : []);
  const imageMarkup = images.length > 0
    ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name || "Produit")}">`
    : `<div class="product-placeholder">${escapeHtml(productInitials(product))}</div>`;
  const galleryMarkup = images.length > 1
    ? `<div class="detail-gallery">${images.slice(1, 5).map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name || "Produit")}">`).join("")}</div>`
    : "";
  const description = product.description || product.shortDescription || "Description indisponible.";
  const price = state.canSeePrices
    ? `<strong class="price">${escapeHtml(money.format(productPriceTtc(product)))}</strong>`
    : '<strong class="price locked">Prix visible apres connexion</strong>';
  const action = state.canSeePrices
    ? `<button class="primary-button" data-detail-add="${product.id}" type="button">Ajouter au panier</button>`
    : '<button class="primary-button" data-detail-auth type="button">Se connecter</button>';

  elements.productDetailTitle.textContent = product.name || "Produit";
  elements.productDetailContent.innerHTML = `
    <div class="product-detail-grid">
      <div class="product-detail-media">
        ${imageMarkup}
        ${galleryMarkup}
      </div>
      <div class="product-detail-body">
        <div class="detail-tags">
          ${product.sku ? `<span>SKU ${escapeHtml(product.sku)}</span>` : ""}
          ${product.reference ? `<span>Ref. ${escapeHtml(product.reference)}</span>` : ""}
          ${product.category ? `<span>${escapeHtml(product.category)}</span>` : ""}
          ${product.brand ? `<span>${escapeHtml(product.brand)}</span>` : ""}
        </div>
        <p class="detail-description">${escapeHtml(description).replace(/\n/g, "<br>")}</p>
        <div class="detail-meta">
          <span>Unite</span><strong>${escapeHtml(product.unit || "piece")}</strong>
          <span>Stock</span><strong>${escapeHtml(String(product.stockQuantity ?? 0))}</strong>
          <span>TVA</span><strong>${escapeHtml(String(product.taxRate ?? 20))} %</strong>
        </div>
        <div class="detail-actions">
          ${price}
          ${action}
        </div>
      </div>
    </div>
  `;
}

function render() {
  renderChrome();
  renderMetrics();
  renderCategoryFilter();
  renderProducts();
  renderCart();
  renderOrders();
  renderBackoffice();
  renderAuthModal();
  renderProductDetail();
}

function setActiveView(view) {
  state.activeView = view === "backoffice" && state.isBackoffice ? "backoffice" : "front";
  const url = new URL(window.location.href);
  if (state.activeView === "backoffice") {
    url.searchParams.set("view", "backoffice");
  } else {
    url.searchParams.delete("view");
  }
  window.history.replaceState({}, "", url);
  render();
}

function openAuth(mode = "login") {
  state.authMode = mode;
  renderAuthModal();
  elements.authModal.classList.remove("hidden");
  elements.authEmail.focus();
}

function closeAuth() {
  elements.authModal.classList.add("hidden");
}

function openProductDetail(productId) {
  state.detailProductId = Number(productId);
  renderProductDetail();
}

function closeProductDetail() {
  state.detailProductId = null;
  renderProductDetail();
}

function addToCart(productId) {
  if (!state.canSeePrices) {
    openAuth("login");
    return;
  }
  const product = productById(productId);
  if (!product) return;
  const current = state.cart.find((item) => Number(item.productId) === Number(productId));
  if (current) {
    current.quantity = Number(current.quantity || 0) + 1;
  } else {
    state.cart.push({ productId: Number(productId), quantity: 1 });
  }
  saveCart();
  render();
}

function updateCartQuantity(productId, quantity) {
  const safeQuantity = Math.max(0, Math.floor(parseNumber(quantity)));
  state.cart = state.cart
    .map((item) => Number(item.productId) === Number(productId) ? { ...item, quantity: safeQuantity } : item)
    .filter((item) => Number(item.quantity || 0) > 0);
  saveCart();
  render();
}

function clearCart() {
  state.cart = [];
  saveCart();
  render();
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authSubmitButton.disabled = true;
  try {
    const action = state.authMode === "register" ? "client_register" : "client_login";
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({
        action,
        email: elements.authEmail.value.trim(),
        password: elements.authPassword.value,
        displayName: elements.authName.value.trim(),
        companyName: elements.authCompany.value.trim(),
      }),
    });
    applyDashboard(payload);
    closeAuth();
    elements.authPassword.value = "";
    showMessage(payload.message || "Session catalogue active.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Connexion impossible.", "error");
  } finally {
    elements.authSubmitButton.disabled = false;
  }
}

async function logoutClient() {
  try {
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({ action: "client_logout" }),
    });
    applyDashboard(payload);
    showMessage("Session catalogue fermee.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Deconnexion impossible.", "error");
  }
}

async function placeOrder() {
  if (!state.client || !state.canSeePrices) {
    openAuth("login");
    return;
  }
  if (state.cart.length === 0) {
    showMessage("Votre panier est vide.", "error");
    return;
  }
  elements.placeOrderButton.disabled = true;
  try {
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({
        action: "place_order",
        items: state.cart,
        message: elements.orderMessage.value.trim(),
      }),
    });
    applyDashboard(payload);
    clearCart();
    elements.orderMessage.value = "";
    showMessage(payload.message || "Commande envoyee.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Commande impossible.", "error");
  } finally {
    elements.placeOrderButton.disabled = false;
  }
}

function selectAdminProduct(productId) {
  state.selectedProductId = productId ? Number(productId) : null;
  fillProductForm(selectedAdminProduct());
  renderAdminProducts();
}

async function syncPrestashop() {
  elements.syncPrestashopButton.disabled = true;
  try {
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({ action: "sync_prestashop" }),
    });
    applyDashboard(payload);
    showMessage(payload.message || "Catalogue PrestaShop recupere.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Synchronisation impossible.", "error");
  } finally {
    elements.syncPrestashopButton.disabled = false;
  }
}

async function uploadSelectedImages(productId) {
  if (!elements.productImages.files || elements.productImages.files.length === 0) return null;
  const data = new FormData();
  data.append("action", "upload_images");
  data.append("product_id", String(productId));
  Array.from(elements.productImages.files).forEach((file) => data.append("images[]", file));
  return apiRequest({ method: "POST", body: data });
}

async function saveProduct(event) {
  event.preventDefault();
  elements.saveProductButton.disabled = true;
  try {
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({
        action: "save_product",
        product: productFromForm(),
      }),
    });
    let nextPayload = payload;
    const productId = payload.product?.id;
    if (productId) {
      const uploadPayload = await uploadSelectedImages(productId);
      if (uploadPayload) nextPayload = uploadPayload;
      state.selectedProductId = Number(productId);
    }
    applyDashboard(nextPayload);
    showMessage(nextPayload.message || "Produit enregistre.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Sauvegarde impossible.", "error");
  } finally {
    elements.saveProductButton.disabled = false;
  }
}

async function disableProduct() {
  const product = selectedAdminProduct();
  if (!product.id) return;
  if (!window.confirm("Masquer ce produit du catalogue ?")) return;
  elements.disableProductButton.disabled = true;
  try {
    const payload = await apiRequest({
      method: "POST",
      body: JSON.stringify({ action: "delete_product", id: product.id }),
    });
    applyDashboard(payload);
    state.selectedProductId = null;
    showMessage(payload.message || "Produit masque.", "success");
    render();
  } catch (error) {
    showMessage(error.message || "Action impossible.", "error");
  } finally {
    elements.disableProductButton.disabled = false;
  }
}

function installListeners() {
  elements.frontTabButton.addEventListener("click", () => {
    setActiveView("front");
  });
  elements.backofficeTabButton.addEventListener("click", () => {
    if (!state.isBackoffice) return;
    setActiveView("backoffice");
  });
  elements.openFrontButton.addEventListener("click", () => setActiveView("front"));
  elements.clientButton.addEventListener("click", () => {
    if (state.client) {
      void logoutClient();
      return;
    }
    openAuth("login");
  });
  elements.searchInput.addEventListener("input", renderProducts);
  elements.categoryFilter.addEventListener("change", renderProducts);
  elements.productGrid.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-auth]")) {
      openAuth("login");
      return;
    }
    const button = event.target.closest("[data-add-product]");
    if (button) {
      addToCart(button.dataset.addProduct);
      return;
    }
    const card = event.target.closest("[data-view-product]");
    if (card) openProductDetail(card.dataset.viewProduct);
  });
  elements.productGrid.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("button, a, input, select, textarea")) return;
    const card = event.target.closest("[data-view-product]");
    if (!card) return;
    event.preventDefault();
    openProductDetail(card.dataset.viewProduct);
  });
  elements.productDetailModal.addEventListener("click", (event) => {
    if (event.target === elements.productDetailModal) {
      closeProductDetail();
      return;
    }
    if (event.target.closest("[data-detail-auth]")) {
      closeProductDetail();
      openAuth("login");
      return;
    }
    const addButton = event.target.closest("[data-detail-add]");
    if (addButton) addToCart(addButton.dataset.detailAdd);
  });
  elements.closeProductDetailButton.addEventListener("click", closeProductDetail);
  elements.cartList.addEventListener("change", (event) => {
    const input = event.target.closest("[data-cart-quantity]");
    if (input) updateCartQuantity(input.dataset.cartQuantity, input.value);
  });
  elements.cartList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-product]");
    if (button) updateCartQuantity(button.dataset.removeProduct, 0);
  });
  elements.clearCartButton.addEventListener("click", clearCart);
  elements.placeOrderButton.addEventListener("click", () => { void placeOrder(); });
  elements.syncPrestashopButton.addEventListener("click", () => { void syncPrestashop(); });
  elements.newProductButton.addEventListener("click", () => selectAdminProduct(null));
  elements.adminSearchInput.addEventListener("input", renderAdminProducts);
  elements.adminProductsList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-admin-product]");
    if (item) selectAdminProduct(item.dataset.adminProduct);
  });
  elements.productForm.addEventListener("submit", (event) => { void saveProduct(event); });
  elements.disableProductButton.addEventListener("click", () => { void disableProduct(); });
  elements.closeAuthButton.addEventListener("click", closeAuth);
  elements.authModal.addEventListener("click", (event) => {
    if (event.target === elements.authModal) closeAuth();
  });
  elements.loginModeButton.addEventListener("click", () => {
    state.authMode = "login";
    renderAuthModal();
  });
  elements.registerModeButton.addEventListener("click", () => {
    state.authMode = "register";
    renderAuthModal();
  });
  elements.authForm.addEventListener("submit", (event) => { void submitAuth(event); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProductDetail();
      closeAuth();
    }
  });
}

async function init() {
  installListeners();
  setLoading(true);
  try {
    await loadDashboard();
  } catch (error) {
    showMessage(error.message || "Catalogue indisponible.", "error");
  } finally {
    setLoading(false);
  }
}

void init();
