function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function purchasePrice(product) {
  const directPrice = Number(product?.purchasePriceTaxExcl || 0);
  if (directPrice > 0) return directPrice;
  const prices = Array.isArray(product?.supplierPurchasePrices) ? product.supplierPurchasePrices : [];
  const firstSupplierPrice = prices.find((entry) => Number(entry.priceTaxExcl || 0) > 0);
  return firstSupplierPrice ? Number(firstSupplierPrice.priceTaxExcl || 0) : 0;
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

function productMatchesCatalog(product, search, supplierFilter) {
  const matchesSupplier = supplierFilter === ""
    || (supplierFilter === "__none__" && !product.supplierId)
    || Number(product.supplierId || 0) === Number(supplierFilter);
  const text = normalizeText(`${product.name || ""} ${product.reference || ""} ${product.supplierName || ""}`);
  return matchesSupplier && (search === "" || text.includes(search));
}

function buildCatalogGroups(products, search, supplierFilter) {
  const groups = new Map();
  products
    .filter((product) => productMatchesCatalog(product, search, supplierFilter))
    .forEach((product) => {
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
      group.stockValue += Number(product.quantity || 0) * purchasePrice(product);
      if (product.isLowStock) group.lowCount += 1;
    });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    products: [...group.products].sort(compareProductsByReference),
  }));
}

function orderMatchesSearch(order, search) {
  if (search === "") return true;
  const lineText = (order.lines || [])
    .map((line) => `${line.label || ""} ${line.productReference || ""}`)
    .join(" ");
  const text = normalizeText(`${order.id || ""} ${order.orderNumber || ""} ${order.supplierName || ""} ${order.notes || ""} ${lineText}`);
  return text.includes(search);
}

function filterOrders(orders, search, status) {
  return orders.filter((order) => (
    (status === "" || order.status === status) && orderMatchesSearch(order, search)
  ));
}

self.onmessage = (event) => {
  const message = event.data || {};
  try {
    if (message.type === "catalog") {
      self.postMessage({
        type: "catalog",
        requestId: message.requestId,
        groups: buildCatalogGroups(
          message.products || [],
          normalizeText(message.search),
          String(message.supplierFilter || ""),
        ),
      });
      return;
    }

    if (message.type === "history") {
      self.postMessage({
        type: "history",
        requestId: message.requestId,
        orders: filterOrders(
          message.orders || [],
          normalizeText(message.search),
          String(message.status || ""),
        ),
      });
    }
  } catch (error) {
    self.postMessage({
      type: message.type || "error",
      requestId: message.requestId,
      error: error?.message || "Worker Stockcean indisponible.",
    });
  }
};
