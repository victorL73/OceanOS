const API = {
  auth: "api/auth.php",
  requests: "api/requests.php",
  document: "api/document.php",
};
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  publicView: $("public-view"),
  workspaceView: $("workspace-view"),
  publicStatus: $("public-status"),
  publicMessage: $("public-message"),
  publicPdf: $("public-pdf"),
  publicTitle: $("public-title"),
  publicMeta: $("public-meta"),
  signForm: $("sign-form"),
  publicSignerName: $("public-signer-name"),
  publicSignerEmail: $("public-signer-email"),
  signatureCanvas: $("signature-canvas"),
  clearSignature: $("clear-signature"),
  publicAccept: $("public-accept"),
  publicSubmit: $("public-submit"),
  currentUser: $("current-user"),
  refreshButton: $("refresh-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  createForm: $("create-form"),
  quoteSelect: $("quote-select"),
  signerName: $("signer-name"),
  signerEmail: $("signer-email"),
  expiresDays: $("expires-days"),
  createButton: $("create-button"),
  requestSearch: $("request-search"),
  requestsList: $("requests-list"),
  detailPanel: $("detail-panel"),
  detailEmpty: $("detail-empty"),
  detailContent: $("detail-content"),
  detailStatus: $("detail-status"),
  detailTitle: $("detail-title"),
  detailMeta: $("detail-meta"),
  copyLinkButton: $("copy-link-button"),
  openLinkButton: $("open-link-button"),
  downloadSignedButton: $("download-signed-button"),
  detailPdf: $("detail-pdf"),
  toggleStatusButton: $("toggle-status-button"),
  deleteRequestButton: $("delete-request-button"),
};

const state = {
  user: null,
  quotes: [],
  requests: [],
  selectedId: null,
  publicRequest: null,
  signatureDirty: false,
  isDrawing: false,
  lastPoint: null,
};

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.publicView.classList.toggle("hidden", view !== "public");
  elements.workspaceView.classList.toggle("hidden", view !== "workspace");
}

function absoluteUrl(path) {
  return new URL(path, window.location.origin).href;
}

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

function installOceanOSReturnButton() {
  if (document.querySelector(".oceanos-return-button")) return;

  const link = document.createElement("a");
  link.className = "oceanos-return-button";
  link.href = OCEANOS_URL;
  link.setAttribute("aria-label", "Retourner sur OceanOS");
  link.innerHTML = "<span>O</span><strong>OceanOS</strong>";
  document.body.appendChild(link);
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function showPublicMessage(message = "", type = "") {
  elements.publicMessage.textContent = message;
  elements.publicMessage.dataset.type = type;
  elements.publicMessage.classList.toggle("hidden", message === "");
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
    const error = new Error(payload.message || payload.error || "Requete impossible.");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function formatDate(value) {
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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function statusLabel(status) {
  const labels = {
    pending: "A signer",
    signed: "Signe",
    revoked: "Desactive",
    expired: "Expire",
  };
  return labels[status] || status || "A signer";
}

function selectedRequest() {
  return state.requests.find((request) => request.id === state.selectedId) || null;
}

async function copyText(text, successMessage = "Lien copie.") {
  const value = absoluteUrl(text);
  try {
    await navigator.clipboard.writeText(value);
    showMessage(successMessage, "success");
  } catch (error) {
    window.prompt("Lien Nautisign", value);
  }
}

async function fetchAuth() {
  const payload = await apiRequest(API.auth);
  if (!payload.authenticated || !payload.allowed) {
    redirectToOceanOS();
    return false;
  }
  state.user = payload.user || null;
  elements.currentUser.textContent = state.user?.displayName || state.user?.email || "Utilisateur";
  return true;
}

async function loadWorkspace(selectId = null) {
  showMessage("");
  const payload = await apiRequest(`${API.requests}?action=list`);
  state.quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
  state.requests = Array.isArray(payload.requests) ? payload.requests : [];
  renderQuoteSelect();
  renderRequestsList();

  if (selectId) {
    state.selectedId = selectId;
  } else if (state.selectedId && !state.requests.some((request) => request.id === state.selectedId)) {
    state.selectedId = null;
  } else if (!state.selectedId && state.requests.length > 0) {
    state.selectedId = state.requests[0].id;
  }
  renderRequestsList();
  renderDetail();
}

function renderQuoteSelect() {
  elements.quoteSelect.innerHTML = "";
  if (state.quotes.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Aucun PDF dans Mobywork/storage/quotes";
    elements.quoteSelect.appendChild(option);
    elements.createButton.disabled = true;
    return;
  }

  elements.createButton.disabled = false;
  state.quotes.forEach((quote) => {
    const option = document.createElement("option");
    option.value = quote.filename;
    option.textContent = `${quote.label} (${formatBytes(quote.size)})`;
    elements.quoteSelect.appendChild(option);
  });
}

function filteredRequests() {
  const query = elements.requestSearch.value.trim().toLowerCase();
  if (!query) return state.requests;
  return state.requests.filter((request) => {
    const haystack = [
      request.quoteFilename,
      request.signerName,
      request.signerEmail,
      statusLabel(request.status),
      request.createdAt,
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function renderRequestsList() {
  const requests = filteredRequests();
  elements.requestsList.innerHTML = "";
  if (requests.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-inline";
    empty.textContent = state.requests.length === 0 ? "Aucune demande" : "Aucun resultat";
    elements.requestsList.appendChild(empty);
    return;
  }

  requests.forEach((request) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "request-item";
    button.classList.toggle("active", request.id === state.selectedId);
    button.innerHTML = `
      <span class="request-row">
        <strong></strong>
        <small data-status="${request.status}">${statusLabel(request.status)}</small>
      </span>
      <span class="request-meta"></span>
    `;
    button.querySelector("strong").textContent = request.quoteLabel || request.quoteFilename;
    button.querySelector(".request-meta").textContent = [
      request.signerName || "Client non renseigne",
      request.signedAt ? `signe le ${formatDate(request.signedAt)}` : `cree le ${formatDate(request.createdAt)}`,
    ].join(" - ");
    button.addEventListener("click", () => {
      state.selectedId = request.id;
      renderRequestsList();
      renderDetail();
    });
    elements.requestsList.appendChild(button);
  });
}

function requestPdfUrl(request) {
  const variant = request.status === "signed" ? "&variant=signed" : "";
  return `${API.document}?id=${encodeURIComponent(request.id)}${variant}`;
}

function renderDetail() {
  const request = selectedRequest();
  elements.detailEmpty.classList.toggle("hidden", Boolean(request));
  elements.detailContent.classList.toggle("hidden", !request);
  if (!request) return;

  elements.detailStatus.textContent = statusLabel(request.status);
  elements.detailStatus.dataset.status = request.status;
  elements.detailTitle.textContent = request.quoteLabel || request.quoteFilename;
  elements.detailMeta.textContent = [
    request.signerName || "Client non renseigne",
    request.signerEmail || "",
    request.signedAt ? `Signe le ${formatDate(request.signedAt)}` : `Cree le ${formatDate(request.createdAt)}`,
  ].filter(Boolean).join(" - ");
  elements.openLinkButton.href = absoluteUrl(request.shareUrl);
  elements.downloadSignedButton.href = request.downloadSignedUrl || "#";
  elements.downloadSignedButton.classList.toggle("hidden", request.status !== "signed" || !request.downloadSignedUrl);
  elements.detailPdf.src = requestPdfUrl(request);
  elements.toggleStatusButton.textContent = request.status === "revoked" ? "Reactiver" : "Desactiver";
  elements.toggleStatusButton.disabled = request.status === "signed";
}

async function createRequest(event) {
  event.preventDefault();
  showMessage("");
  const quoteFilename = elements.quoteSelect.value;
  if (!quoteFilename) return;
  elements.createButton.disabled = true;
  try {
    const payload = await apiRequest(API.requests, {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        quoteFilename,
        signerName: elements.signerName.value.trim(),
        signerEmail: elements.signerEmail.value.trim(),
        expiresInDays: Number(elements.expiresDays.value || 0),
      }),
    });
    state.requests = Array.isArray(payload.requests) ? payload.requests : state.requests;
    state.selectedId = payload.request?.id || state.selectedId;
    elements.signerName.value = "";
    elements.signerEmail.value = "";
    renderRequestsList();
    renderDetail();
    showMessage("Lien Nautisign cree.", "success");
    if (payload.request?.shareUrl) {
      await copyText(payload.request.shareUrl, "Lien Nautisign cree et copie.");
    }
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.createButton.disabled = state.quotes.length === 0;
  }
}

async function toggleSelectedStatus() {
  const request = selectedRequest();
  if (!request || request.status === "signed") return;
  const action = request.status === "revoked" ? "restore" : "revoke";
  try {
    const payload = await apiRequest(API.requests, {
      method: "POST",
      body: JSON.stringify({ action, id: request.id }),
    });
    state.requests = Array.isArray(payload.requests) ? payload.requests : state.requests;
    renderRequestsList();
    renderDetail();
    showMessage(payload.message || "Demande mise a jour.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteSelectedRequest() {
  const request = selectedRequest();
  if (!request) return;
  const ok = window.confirm("Supprimer cette demande Nautisign ?");
  if (!ok) return;
  try {
    const payload = await apiRequest(API.requests, {
      method: "DELETE",
      body: JSON.stringify({ id: request.id }),
    });
    state.requests = Array.isArray(payload.requests) ? payload.requests : [];
    state.selectedId = state.requests[0]?.id || null;
    renderRequestsList();
    renderDetail();
    showMessage("Demande supprimee.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function resizeSignatureCanvas() {
  const canvas = elements.signatureCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const previous = state.signatureDirty ? canvas.toDataURL("image/png") : "";
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2.8;
  context.strokeStyle = "#0b2527";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, rect.width, rect.height);
  if (previous) {
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
    image.src = previous;
  }
}

function canvasPoint(event) {
  const canvas = elements.signatureCanvas;
  const rect = canvas.getBoundingClientRect();
  const pointer = event.touches ? event.touches[0] : event;
  return {
    x: pointer.clientX - rect.left,
    y: pointer.clientY - rect.top,
  };
}

function startSignature(event) {
  if (!state.publicRequest || state.publicRequest.status !== "pending") return;
  event.preventDefault();
  state.isDrawing = true;
  state.signatureDirty = true;
  state.lastPoint = canvasPoint(event);
}

function drawSignature(event) {
  if (!state.isDrawing) return;
  event.preventDefault();
  const point = canvasPoint(event);
  const context = elements.signatureCanvas.getContext("2d");
  context.beginPath();
  context.moveTo(state.lastPoint.x, state.lastPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  state.lastPoint = point;
}

function stopSignature() {
  state.isDrawing = false;
  state.lastPoint = null;
}

function clearSignature() {
  state.signatureDirty = false;
  resizeSignatureCanvas();
}

async function loadPublicRequest(token) {
  const payload = await apiRequest(`${API.requests}?public=1&token=${encodeURIComponent(token)}`);
  state.publicRequest = payload.request;
  renderPublicRequest();
}

function renderPublicRequest() {
  const request = state.publicRequest;
  elements.publicTitle.textContent = request.quoteLabel || request.quoteFilename || "Devis";
  elements.publicMeta.textContent = request.expiresAt ? `Valable jusqu au ${formatDate(request.expiresAt)}` : "";
  elements.publicStatus.textContent = statusLabel(request.status);
  elements.publicStatus.dataset.status = request.status;
  elements.publicPdf.src = request.status === "signed" && request.signedDocumentUrl
    ? request.signedDocumentUrl
    : request.documentUrl;
  elements.publicSignerName.value = request.signerName || "";
  elements.publicSignerEmail.value = request.signerEmail || "";

  const canSign = request.status === "pending";
  elements.signForm.classList.toggle("locked", !canSign);
  Array.from(elements.signForm.elements).forEach((element) => {
    if (element.id === "clear-signature") return;
    element.disabled = !canSign;
  });
  elements.clearSignature.disabled = !canSign;
  elements.publicSubmit.classList.toggle("hidden", !canSign);
  if (!canSign) {
    const message = request.status === "signed"
      ? "Ce devis est deja signe."
      : "Ce lien Nautisign n est plus disponible.";
    showPublicMessage(message, request.status === "signed" ? "success" : "error");
  }
  setTimeout(resizeSignatureCanvas, 0);
}

async function submitPublicSignature(event) {
  event.preventDefault();
  const request = state.publicRequest;
  if (!request || request.status !== "pending") return;
  if (!state.signatureDirty) {
    showPublicMessage("Signature obligatoire.", "error");
    return;
  }

  elements.publicSubmit.disabled = true;
  showPublicMessage("");
  try {
    const payload = await apiRequest(`${API.requests}?public=1&token=${encodeURIComponent(new URLSearchParams(window.location.search).get("sign"))}`, {
      method: "POST",
      body: JSON.stringify({
        signerName: elements.publicSignerName.value.trim(),
        signerEmail: elements.publicSignerEmail.value.trim(),
        accepted: elements.publicAccept.checked,
        signatureData: elements.signatureCanvas.toDataURL("image/png"),
      }),
    });
    state.publicRequest = payload.request;
    renderPublicRequest();
    showPublicMessage(payload.message || "Devis signe.", "success");
  } catch (error) {
    showPublicMessage(error.message, "error");
  } finally {
    elements.publicSubmit.disabled = false;
  }
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => loadWorkspace().catch((error) => showMessage(error.message, "error")));
  elements.logoutButton.addEventListener("click", async () => {
    await apiRequest(API.auth, { method: "DELETE" }).catch(() => {});
    redirectToOceanOS();
  });
  elements.createForm.addEventListener("submit", createRequest);
  elements.requestSearch.addEventListener("input", () => renderRequestsList());
  elements.copyLinkButton.addEventListener("click", () => {
    const request = selectedRequest();
    if (request) void copyText(request.shareUrl);
  });
  elements.toggleStatusButton.addEventListener("click", () => toggleSelectedStatus());
  elements.deleteRequestButton.addEventListener("click", () => deleteSelectedRequest());

  elements.signForm.addEventListener("submit", submitPublicSignature);
  elements.clearSignature.addEventListener("click", clearSignature);
  elements.signatureCanvas.addEventListener("pointerdown", startSignature);
  elements.signatureCanvas.addEventListener("pointermove", drawSignature);
  window.addEventListener("pointerup", stopSignature);
  elements.signatureCanvas.addEventListener("touchstart", startSignature, { passive: false });
  elements.signatureCanvas.addEventListener("touchmove", drawSignature, { passive: false });
  window.addEventListener("touchend", stopSignature);
  window.addEventListener("resize", () => {
    if (!elements.publicView.classList.contains("hidden")) resizeSignatureCanvas();
  });
}

async function boot() {
  bindEvents();
  setView("loading");
  const token = new URLSearchParams(window.location.search).get("sign");
  try {
    if (token) {
      await loadPublicRequest(token);
      setView("public");
      return;
    }

    const ok = await fetchAuth();
    if (!ok) return;
    await loadWorkspace();
    installOceanOSReturnButton();
    setView("workspace");
  } catch (error) {
    if (token) {
      setView("public");
      elements.publicTitle.textContent = "Lien indisponible";
      elements.publicMeta.textContent = "";
      elements.publicPdf.removeAttribute("src");
      elements.publicSubmit.classList.add("hidden");
      showPublicMessage(error.message || "Lien Nautisign indisponible.", "error");
      return;
    }
    showMessage(error.message || "Nautisign est indisponible.", "error");
    setView("workspace");
  }
}

boot();
