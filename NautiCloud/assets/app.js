const API = {
  auth: "api/auth.php",
  files: "api/files.php",
  events: "api/events.php",
};
const OCEANOS_URL = "/OceanOS/";
const UPLOAD_BATCH_SIZE = 12;

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  driveView: $("drive-view"),
  syncPill: $("sync-pill"),
  currentUser: $("current-user"),
  logoutButton: $("logout-button"),
  refreshButton: $("refresh-button"),
  appMessage: $("app-message"),
  metricFiles: $("metric-files"),
  metricFolders: $("metric-folders"),
  metricSize: $("metric-size"),
  metricLive: $("metric-live"),
  searchForm: $("search-form"),
  searchInput: $("search-input"),
  allFilesButton: $("all-files-button"),
  currentPathLabel: $("current-path-label"),
  uploadButton: $("upload-button"),
  newFolderButton: $("new-folder-button"),
  newFileButton: $("new-file-button"),
  fileInput: $("file-input"),
  presenceCount: $("presence-count"),
  presenceList: $("presence-list"),
  breadcrumb: $("breadcrumb"),
  listViewButton: $("list-view-button"),
  mosaicViewButton: $("mosaic-view-button"),
  renameButton: $("rename-button"),
  copyButton: $("copy-button"),
  moveButton: $("move-button"),
  deleteButton: $("delete-button"),
  selectAll: $("select-all"),
  filesTable: document.querySelector(".files-table"),
  filesBody: $("files-body"),
  mosaicGrid: $("mosaic-grid"),
  emptyState: $("empty-state"),
  previewEmpty: $("preview-empty"),
  previewContent: $("preview-content"),
  previewKind: $("preview-kind"),
  previewTitle: $("preview-title"),
  previewMeta: $("preview-meta"),
  fullscreenButton: $("fullscreen-button"),
  closeFullscreenButton: $("close-fullscreen-button"),
  downloadLink: $("download-link"),
  conflictBanner: $("conflict-banner"),
  reloadFileButton: $("reload-file-button"),
  forceSaveButton: $("force-save-button"),
  editorToolbar: $("editor-toolbar"),
  saveState: $("save-state"),
  saveButton: $("save-button"),
  previewFrame: $("preview-frame"),
  entryModal: $("entry-modal"),
  entryModalBackdrop: $("entry-modal-backdrop"),
  entryForm: $("entry-form"),
  entryModalTitle: $("entry-modal-title"),
  entryName: $("entry-name"),
  entryCancel: $("entry-cancel"),
  entrySubmit: $("entry-submit"),
  destinationModal: $("destination-modal"),
  destinationBackdrop: $("destination-backdrop"),
  destinationForm: $("destination-form"),
  destinationTitle: $("destination-title"),
  destinationSelect: $("destination-select"),
  destinationCancel: $("destination-cancel"),
  destinationSubmit: $("destination-submit"),
};

const state = {
  user: null,
  currentPath: "",
  items: [],
  itemByPath: new Map(),
  selectedPaths: new Set(),
  selectedItem: null,
  editor: null,
  contentVersion: "",
  dirty: false,
  saveTimer: null,
  searchMode: false,
  searchQuery: "",
  latestEventId: 0,
  eventSource: null,
  clientId: getClientId(),
  entryMode: "folder",
  destinationMode: "move",
  editorType: "",
  workbook: null,
  activeSheetName: "",
  focusMode: false,
  activeFormulaInput: null,
  activeSpreadsheetCell: null,
  viewMode: localStorage.getItem("nauticloud_view_mode") === "mosaic" ? "mosaic" : "list",
  previewRequestId: 0,
};

function getClientId() {
  const existing = localStorage.getItem("nauticloud_client_id");
  if (existing) return existing;
  const id = `nc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("nauticloud_client_id", id);
  return id;
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.driveView.classList.toggle("hidden", view !== "drive");
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function setSyncState(label, stateName = "") {
  elements.syncPill.textContent = label;
  elements.syncPill.dataset.state = stateName;
  elements.metricLive.textContent = stateName === "offline" ? "Pause" : "Actif";
}

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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

function filesUrl(params = {}) {
  const search = new URLSearchParams(params);
  return `${API.files}?${search.toString()}`;
}

function pathLabel(path) {
  return path ? path.split("/").pop() : "Racine";
}

function kindLabel(item) {
  if (!item) return "";
  const labels = {
    folder: "Dossier",
    image: "Image",
    pdf: "PDF",
    text: "Texte",
    audio: "Audio",
    video: "Video",
    archive: "Archive",
    office: isSpreadsheetFile(item) ? "Tableur" : isWordFile(item) ? "Document Word" : "Document",
    binary: "Fichier",
  };
  return labels[item.kind] || labels[item.type] || "Fichier";
}

function fileIcon(item) {
  if (item.type === "folder") return "DIR";
  if (item.kind === "image") return "IMG";
  if (item.kind === "pdf") return "PDF";
  if (item.kind === "text") return "TXT";
  if (item.kind === "audio") return "AUD";
  if (item.kind === "video") return "VID";
  if (isSpreadsheetFile(item)) return "XLS";
  if (isWordFile(item)) return "DOC";
  if (item.kind === "archive") return "ZIP";
  if (item.extension) return item.extension.slice(0, 3).toUpperCase();
  return "FILE";
}

function isSpreadsheetFile(item) {
  return item?.type === "file" && ["xlsx", "xls", "ods", "csv"].includes(String(item.extension || "").toLowerCase());
}

function isWordFile(item) {
  return item?.type === "file" && String(item.extension || "").toLowerCase() === "docx";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function updateStats(stats = {}) {
  elements.metricFiles.textContent = String(stats.files || 0);
  elements.metricFolders.textContent = String(stats.folders || 0);
  elements.metricSize.textContent = stats.sizeLabel || "0 o";
}

function renderBreadcrumb() {
  elements.breadcrumb.innerHTML = "";
  if (state.searchMode) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Racine";
    button.addEventListener("click", () => navigate(""));
    elements.breadcrumb.append(button, document.createTextNode(" / "));
    const label = document.createElement("span");
    label.textContent = `Recherche: ${state.searchQuery}`;
    elements.breadcrumb.appendChild(label);
    elements.currentPathLabel.textContent = "Recherche";
    return;
  }

  const root = document.createElement("button");
  root.type = "button";
  root.textContent = "Racine";
  root.addEventListener("click", () => navigate(""));
  elements.breadcrumb.appendChild(root);

  const parts = state.currentPath ? state.currentPath.split("/") : [];
  let path = "";
  parts.forEach((part) => {
    path = path ? `${path}/${part}` : part;
    elements.breadcrumb.appendChild(document.createTextNode(" / "));
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = part;
    const targetPath = path;
    button.addEventListener("click", () => navigate(targetPath));
    elements.breadcrumb.appendChild(button);
  });

  elements.currentPathLabel.textContent = pathLabel(state.currentPath);
}

function updateActionState() {
  const count = state.selectedPaths.size;
  elements.renameButton.disabled = count !== 1;
  elements.copyButton.disabled = count === 0;
  elements.moveButton.disabled = count === 0;
  elements.deleteButton.disabled = count === 0;
  elements.selectAll.checked = state.items.length > 0 && state.items.every((item) => state.selectedPaths.has(item.path));
  elements.selectAll.indeterminate = !elements.selectAll.checked && state.items.some((item) => state.selectedPaths.has(item.path));
}

function setSelectedPaths(paths, render = true) {
  state.selectedPaths = new Set(paths);
  if (state.selectedPaths.size === 1) {
    const selectedPath = Array.from(state.selectedPaths)[0];
    state.selectedItem = state.itemByPath.get(selectedPath) || state.selectedItem;
  } else {
    state.selectedItem = null;
  }
  if (render) {
    renderTable();
    if (state.selectedItem) {
      void renderPreview(state.selectedItem);
    } else {
      clearPreview();
    }
  }
  updateActionState();
  void touchPresence();
}

function selectItem(item) {
  if (state.viewMode !== "mosaic") {
    setSelectedPaths([item.path]);
    return;
  }

  setSelectedPaths([item.path], false);
  refreshMosaicSelection();
  if (state.selectedItem) {
    void renderPreview(state.selectedItem);
  } else {
    clearPreview();
  }
}

async function openItem(item, options = {}) {
  if (item.type === "folder") {
    navigate(item.path);
    return;
  }
  if (!options.fullscreen) {
    selectItem(item);
    return;
  }

  state.selectedPaths = new Set([item.path]);
  state.selectedItem = item;
  renderTable();
  updateActionState();
  await renderPreview(item);
  setFocusMode(true);
}

function updateViewModeButtons() {
  elements.listViewButton.classList.toggle("is-active", state.viewMode === "list");
  elements.mosaicViewButton.classList.toggle("is-active", state.viewMode === "mosaic");
}

function setViewMode(mode) {
  state.viewMode = mode === "mosaic" ? "mosaic" : "list";
  localStorage.setItem("nauticloud_view_mode", state.viewMode);
  renderTable();
}

function previewUrlWithVersion(item) {
  if (!item.previewUrl) return "";
  const separator = item.previewUrl.includes("?") ? "&" : "?";
  return `${item.previewUrl}${separator}v=${encodeURIComponent(item.version || "")}`;
}

function toggleItemSelection(item, checked) {
  const next = new Set(state.selectedPaths);
  if (checked) {
    next.add(item.path);
  } else {
    next.delete(item.path);
  }
  setSelectedPaths(next);
}

function refreshMosaicSelection() {
  elements.mosaicGrid.querySelectorAll(".mosaic-card").forEach((card) => {
    const selected = state.selectedPaths.has(card.dataset.path || "");
    card.classList.toggle("is-selected", selected);
    const checkbox = card.querySelector(".mosaic-check");
    if (checkbox) checkbox.checked = selected;
  });
  updateActionState();
}

function renderMosaic() {
  elements.mosaicGrid.innerHTML = "";

  state.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "mosaic-card";
    card.dataset.path = item.path;
    card.tabIndex = 0;
    card.classList.toggle("is-selected", state.selectedPaths.has(item.path));
    card.setAttribute("aria-label", item.name);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "mosaic-check";
    checkbox.checked = state.selectedPaths.has(item.path);
    checkbox.setAttribute("aria-label", `Selectionner ${item.name}`);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => toggleItemSelection(item, checkbox.checked));

    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "mosaic-thumb";
    thumb.setAttribute("aria-label", item.type === "folder" ? `Ouvrir ${item.name}` : `Voir ${item.name}`);

    if (item.kind === "image" && item.previewUrl) {
      const image = document.createElement("img");
      image.alt = item.name;
      image.loading = "lazy";
      image.src = previewUrlWithVersion(item);
      thumb.appendChild(image);
    } else {
      const icon = document.createElement("span");
      icon.className = `file-icon mosaic-icon ${item.type === "folder" ? "folder" : item.kind}`;
      icon.textContent = fileIcon(item);
      thumb.appendChild(icon);
    }

    const title = document.createElement("strong");
    title.className = "mosaic-title";
    title.textContent = item.name;

    const meta = document.createElement("span");
    meta.className = "mosaic-meta";
    meta.textContent = item.type === "folder" ? "Dossier" : item.sizeLabel;

    thumb.addEventListener("click", (event) => {
      event.stopPropagation();
      selectItem(item);
    });
    thumb.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openItem(item, { fullscreen: item.type !== "folder" });
    });

    card.addEventListener("click", () => selectItem(item));
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      void openItem(item, { fullscreen: item.type !== "folder" });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void openItem(item, { fullscreen: item.type !== "folder" });
      }
      if (event.key === " ") {
        event.preventDefault();
        toggleItemSelection(item, !state.selectedPaths.has(item.path));
      }
    });

    card.append(checkbox, thumb, title, meta);
    elements.mosaicGrid.appendChild(card);
  });
}

function renderTable() {
  elements.filesBody.innerHTML = "";
  elements.mosaicGrid.innerHTML = "";
  state.itemByPath = new Map(state.items.map((item) => [item.path, item]));
  elements.emptyState.classList.toggle("hidden", state.items.length !== 0);
  elements.filesTable.classList.toggle("hidden", state.viewMode !== "list");
  elements.mosaicGrid.classList.toggle("hidden", state.viewMode !== "mosaic");
  updateViewModeButtons();

  if (state.viewMode === "mosaic") {
    renderMosaic();
    updateActionState();
    return;
  }

  state.items.forEach((item) => {
    const row = document.createElement("tr");
    row.classList.toggle("is-selected", state.selectedPaths.has(item.path));

    const selectCell = document.createElement("td");
    selectCell.className = "select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedPaths.has(item.path);
    checkbox.setAttribute("aria-label", `Selectionner ${item.name}`);
    checkbox.addEventListener("change", () => toggleItemSelection(item, checkbox.checked));
    selectCell.appendChild(checkbox);

    const nameCell = document.createElement("td");
    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "file-name-button";
    nameButton.addEventListener("click", () => openItem(item));
    nameButton.addEventListener("dblclick", (event) => {
      event.preventDefault();
      void openItem(item, { fullscreen: true });
    });
    const icon = document.createElement("span");
    icon.className = `file-icon ${item.type === "folder" ? "folder" : item.kind}`;
    icon.textContent = fileIcon(item);
    const label = document.createElement("span");
    label.className = "file-label";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const path = document.createElement("small");
    path.textContent = item.parentPath || "Racine";
    label.append(name, path);
    nameButton.append(icon, label);
    nameCell.appendChild(nameButton);

    const typeCell = document.createElement("td");
    typeCell.textContent = kindLabel(item);

    const sizeCell = document.createElement("td");
    sizeCell.textContent = item.type === "folder" ? "-" : item.sizeLabel;

    const modifiedCell = document.createElement("td");
    modifiedCell.textContent = formatDate(item.modifiedAt);

    const actionCell = document.createElement("td");
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "row-action";
    actionButton.textContent = item.type === "folder" ? "Ouvrir" : "Voir";
    actionButton.addEventListener("click", () => openItem(item));
    actionCell.appendChild(actionButton);

    row.append(selectCell, nameCell, typeCell, sizeCell, modifiedCell, actionCell);
    elements.filesBody.appendChild(row);
  });

  updateActionState();
}

function clearPreview() {
  state.previewRequestId += 1;
  state.editor = null;
  state.editorType = "";
  state.workbook = null;
  state.activeSheetName = "";
  state.contentVersion = "";
  state.dirty = false;
  window.clearTimeout(state.saveTimer);
  elements.previewEmpty.classList.remove("hidden");
  elements.previewContent.classList.add("hidden");
  elements.previewFrame.innerHTML = "";
  elements.editorToolbar.classList.add("hidden");
  elements.conflictBanner.classList.add("hidden");
  elements.downloadLink.classList.add("hidden");
  elements.fullscreenButton.classList.add("hidden");
  elements.closeFullscreenButton.classList.add("hidden");
  setFocusMode(false);
}

function isPreviewCurrent(requestId, item) {
  return requestId === state.previewRequestId && state.selectedItem?.path === item.path;
}

function setSaveState(message) {
  elements.saveState.textContent = message;
}

function showConflict(show = true) {
  elements.conflictBanner.classList.toggle("hidden", !show);
}

function setFocusMode(enabled) {
  state.focusMode = Boolean(enabled && state.selectedItem && state.selectedItem.type !== "folder");
  document.body.classList.toggle("focus-mode", state.focusMode);
  elements.fullscreenButton.classList.toggle("hidden", state.focusMode || !state.selectedItem || state.selectedItem.type === "folder");
  elements.closeFullscreenButton.classList.toggle("hidden", !state.focusMode);
}

async function renderPreview(item) {
  const requestId = state.previewRequestId + 1;
  state.previewRequestId = requestId;
  state.selectedItem = item;
  state.editor = null;
  state.editorType = "";
  state.workbook = null;
  state.activeSheetName = "";
  state.contentVersion = item.version || "";
  state.dirty = false;
  window.clearTimeout(state.saveTimer);
  showConflict(false);

  elements.previewEmpty.classList.add("hidden");
  elements.previewContent.classList.remove("hidden");
  elements.previewKind.textContent = kindLabel(item);
  elements.previewTitle.textContent = item.name;
  elements.previewMeta.textContent = `${item.sizeLabel || "Dossier"} - ${formatDate(item.modifiedAt)}`;
  elements.previewFrame.innerHTML = "";
  elements.editorToolbar.classList.add("hidden");

  if (item.downloadUrl) {
    elements.downloadLink.href = item.downloadUrl;
    elements.downloadLink.classList.remove("hidden");
  } else {
    elements.downloadLink.classList.add("hidden");
  }
  setFocusMode(state.focusMode);

  if (item.type === "folder") {
    renderFolderPreview(item);
    return;
  }

  if (item.editable) {
    await renderTextEditor(item, requestId);
    return;
  }

  if (isSpreadsheetFile(item)) {
    await renderSpreadsheetEditor(item, requestId);
    return;
  }

  if (isWordFile(item)) {
    await renderWordEditor(item, requestId);
    return;
  }

  if (item.kind === "image") {
    const image = document.createElement("img");
    image.alt = item.name;
    image.src = `${item.previewUrl}&v=${encodeURIComponent(item.version)}`;
    elements.previewFrame.appendChild(image);
    return;
  }

  if (item.kind === "pdf") {
    const frame = document.createElement("iframe");
    frame.title = item.name;
    frame.src = `${item.previewUrl}&v=${encodeURIComponent(item.version)}`;
    elements.previewFrame.appendChild(frame);
    return;
  }

  if (item.kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.src = `${item.previewUrl}&v=${encodeURIComponent(item.version)}`;
    elements.previewFrame.appendChild(video);
    return;
  }

  if (item.kind === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = `${item.previewUrl}&v=${encodeURIComponent(item.version)}`;
    elements.previewFrame.appendChild(audio);
    return;
  }

  renderBinaryPreview(item);
}

function renderFolderPreview(item) {
  const box = document.createElement("div");
  box.className = "binary-preview";
  const title = document.createElement("strong");
  title.textContent = item.name;
  const subtitle = document.createElement("span");
  subtitle.textContent = "Dossier NautiCloud";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-button";
  button.textContent = "Ouvrir";
  button.addEventListener("click", () => navigate(item.path));
  box.append(title, subtitle, button);
  elements.previewFrame.appendChild(box);
}

function renderBinaryPreview(item) {
  const box = document.createElement("div");
  box.className = "binary-preview";
  const title = document.createElement("strong");
  title.textContent = item.name;
  const subtitle = document.createElement("span");
  subtitle.textContent = `${kindLabel(item)} - ${item.sizeLabel}`;
  const link = document.createElement("a");
  link.className = "primary-button";
  link.href = item.downloadUrl;
  link.textContent = "Telecharger";
  box.append(title, subtitle, link);
  elements.previewFrame.appendChild(box);
}

async function renderTextEditor(item, requestId) {
  elements.editorToolbar.classList.remove("hidden");
  setSaveState("Chargement...");
  const payload = await apiRequest(filesUrl({ action: "content", path: item.path }));
  if (!isPreviewCurrent(requestId, item)) return;
  state.contentVersion = payload.version || payload.item?.version || item.version;

  const textarea = document.createElement("textarea");
  textarea.className = "text-editor";
  textarea.spellcheck = false;
  textarea.value = payload.content || "";
  textarea.addEventListener("input", () => {
    state.dirty = true;
    setSaveState("Modifications...");
    showConflict(false);
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      void saveCurrentFile(false);
    }, 800);
    void touchPresence();
  });

  elements.previewFrame.appendChild(textarea);
  state.editor = textarea;
  state.editorType = "text";
  setSaveState("Pret");
  void touchPresence();
}

function createWordTool(label, title, command, value = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-tool";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    state.editor?.focus();
    document.execCommand(command, false, value);
    markWordDirty();
  });
  return button;
}

function markWordDirty() {
  state.dirty = true;
  setSaveState("Modifications...");
  showConflict(false);
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    void saveCurrentFile(false);
  }, 1200);
  void touchPresence();
}

function renderWordToolbar(editor) {
  const toolbar = document.createElement("div");
  toolbar.className = "word-tools";

  const blockSelect = document.createElement("select");
  blockSelect.className = "word-format-select";
  blockSelect.setAttribute("aria-label", "Style du texte");
  [
    ["P", "Texte"],
    ["H1", "Titre 1"],
    ["H2", "Titre 2"],
    ["H3", "Titre 3"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    blockSelect.appendChild(option);
  });
  blockSelect.addEventListener("change", () => {
    editor.focus();
    document.execCommand("formatBlock", false, blockSelect.value);
    markWordDirty();
  });

  toolbar.append(
    blockSelect,
    createWordTool("B", "Gras", "bold"),
    createWordTool("I", "Italique", "italic"),
    createWordTool("U", "Souligne", "underline"),
    createWordTool("UL", "Liste a puces", "insertUnorderedList"),
    createWordTool("1.", "Liste numerotee", "insertOrderedList"),
    createWordTool("<", "Aligner a gauche", "justifyLeft"),
    createWordTool("=", "Centrer", "justifyCenter"),
    createWordTool(">", "Aligner a droite", "justifyRight"),
    createWordTool("Undo", "Annuler", "undo"),
    createWordTool("Redo", "Retablir", "redo"),
  );

  return toolbar;
}

async function renderWordEditor(item, requestId) {
  elements.editorToolbar.classList.remove("hidden");
  setSaveState("Chargement Word...");

  if (!window.mammoth || !window.JSZip) {
    if (!isPreviewCurrent(requestId, item)) return;
    elements.editorToolbar.classList.add("hidden");
    setSaveState("Apercu indisponible");
    renderBinaryPreview(item);
    return;
  }

  const response = await fetch(`${item.downloadUrl}&v=${encodeURIComponent(item.version)}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Impossible de charger le document Word.");
  }
  if (!isPreviewCurrent(requestId, item)) return;

  const data = await response.arrayBuffer();
  const result = await window.mammoth.convertToHtml({ arrayBuffer: data });
  if (!isPreviewCurrent(requestId, item)) return;

  const shell = document.createElement("div");
  shell.className = "word-editor-shell";

  const editor = document.createElement("article");
  editor.className = "word-editor";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.innerHTML = result.value || "<p><br></p>";
  editor.addEventListener("input", markWordDirty);
  editor.addEventListener("paste", () => {
    window.setTimeout(markWordDirty, 0);
  });

  shell.append(renderWordToolbar(editor), editor);
  elements.previewFrame.appendChild(shell);

  state.editor = editor;
  state.editorType = "word";
  state.contentVersion = item.version || "";
  state.dirty = false;
  setSaveState("Pret");
  void touchPresence();
}

async function renderSpreadsheetEditor(item, requestId) {
  elements.editorToolbar.classList.remove("hidden");
  setSaveState("Chargement tableur...");

  if (!window.XLSX) {
    if (!isPreviewCurrent(requestId, item)) return;
    setSaveState("Apercu indisponible");
    renderBinaryPreview(item);
    return;
  }

  const response = await fetch(`${item.downloadUrl}&v=${encodeURIComponent(item.version)}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Impossible de charger le tableur.");
  }
  if (!isPreviewCurrent(requestId, item)) return;

  const data = await response.arrayBuffer();
  const workbook = window.XLSX.read(data, {
    type: "array",
    cellDates: true,
  });
  if (!isPreviewCurrent(requestId, item)) return;

  state.workbook = workbook;
  state.activeSheetName = workbook.SheetNames[0] || "";
  state.editorType = "spreadsheet";
  state.editor = workbook;
  state.contentVersion = item.version || "";
  state.dirty = false;

  renderSpreadsheetSheet(item);
  setSaveState("Pret");
  void touchPresence();
}

function spreadsheetBookType(item) {
  const extension = String(item?.extension || "").toLowerCase();
  if (extension === "xls") return "biff8";
  if (extension === "ods") return "ods";
  if (extension === "csv") return "csv";
  return "xlsx";
}

function spreadsheetMime(item) {
  const extension = String(item?.extension || "").toLowerCase();
  if (extension === "xls") return "application/vnd.ms-excel";
  if (extension === "ods") return "application/vnd.oasis.opendocument.spreadsheet";
  if (extension === "csv") return "text/csv;charset=utf-8";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function spreadsheetRange(worksheet) {
  const ref = worksheet["!ref"] || "A1:A1";
  return window.XLSX.utils.decode_range(ref);
}

function spreadsheetMergeForCell(worksheet, rowIndex, columnIndex) {
  const merges = Array.isArray(worksheet["!merges"]) ? worksheet["!merges"] : [];
  return merges.find((merge) => (
    rowIndex >= merge.s.r
    && rowIndex <= merge.e.r
    && columnIndex >= merge.s.c
    && columnIndex <= merge.e.c
  )) || null;
}

function spreadsheetCellAnchor(worksheet, rowIndex, columnIndex) {
  const merge = spreadsheetMergeForCell(worksheet, rowIndex, columnIndex);
  return {
    rowIndex: merge ? merge.s.r : rowIndex,
    columnIndex: merge ? merge.s.c : columnIndex,
    merge,
  };
}

function spreadsheetMergeRangeLabel(merge) {
  return merge ? window.XLSX.utils.encode_range(merge) : "";
}

function spreadsheetCellSelector(rowIndex, columnIndex) {
  return `[data-row="${rowIndex}"][data-column="${columnIndex}"]`;
}

function spreadsheetDisplayValue(cell) {
  if (!cell) return "";
  if (cell.__formulaPending) return spreadsheetEditValue(cell);
  return window.XLSX.utils.format_cell(cell);
}

function spreadsheetEditValue(cell) {
  if (!cell) return "";
  if (cell.f) return `=${cell.f}`;
  if (cell.v === undefined || cell.v === null) return "";
  if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  return String(cell.v);
}

function preserveSpreadsheetCellMeta(nextCell, previousCell, keepCachedValue = false) {
  if (!previousCell || !nextCell) return nextCell;
  if (previousCell.z) nextCell.z = previousCell.z;
  if (previousCell.s) nextCell.s = previousCell.s;
  if (previousCell.l) nextCell.l = previousCell.l;
  if (previousCell.c) nextCell.c = previousCell.c;
  if (keepCachedValue && previousCell.v !== undefined) {
    nextCell.v = previousCell.v;
    nextCell.t = previousCell.t || nextCell.t;
    if (previousCell.w) nextCell.w = previousCell.w;
  }
  return nextCell;
}

function spreadsheetCellValue(rawValue, previousCell = null) {
  const raw = String(rawValue ?? "").trim();
  if (raw === "") return null;
  if (raw.startsWith("=") && raw.length > 1) {
    const formula = raw.slice(1);
    const nextCell = {
      t: previousCell?.t && previousCell.t !== "z" ? previousCell.t : "n",
      f: formula,
    };
    preserveSpreadsheetCellMeta(nextCell, previousCell);
    if (previousCell?.v !== undefined) {
      nextCell.v = previousCell.v;
      nextCell.t = previousCell.t || nextCell.t;
      if (previousCell.w) nextCell.w = previousCell.w;
    } else {
      nextCell.t = "n";
      nextCell.v = 0;
    }
    if (previousCell?.f !== formula) {
      nextCell.__formulaPending = true;
      delete nextCell.w;
    }
    return nextCell;
  }
  if (/^-?\d+([,.]\d+)?$/.test(raw)) {
    return preserveSpreadsheetCellMeta({ t: "n", v: Number(raw.replace(",", ".")) }, previousCell);
  }
  if (/^(true|false)$/i.test(raw)) {
    return preserveSpreadsheetCellMeta({ t: "b", v: raw.toLowerCase() === "true" }, previousCell);
  }
  return preserveSpreadsheetCellMeta({ t: "s", v: rawValue }, previousCell);
}

function setSpreadsheetCell(worksheet, rowIndex, columnIndex, value) {
  const anchor = spreadsheetCellAnchor(worksheet, rowIndex, columnIndex);
  const address = window.XLSX.utils.encode_cell({ r: anchor.rowIndex, c: anchor.columnIndex });
  const previousCell = worksheet[address] || null;
  const nextCell = spreadsheetCellValue(value, previousCell);
  if (nextCell === null) {
    delete worksheet[address];
    return;
  }
  const currentRange = spreadsheetRange(worksheet);
  currentRange.s.r = Math.min(currentRange.s.r, anchor.rowIndex);
  currentRange.s.c = Math.min(currentRange.s.c, anchor.columnIndex);
  currentRange.e.r = Math.max(currentRange.e.r, anchor.merge ? anchor.merge.e.r : anchor.rowIndex);
  currentRange.e.c = Math.max(currentRange.e.c, anchor.merge ? anchor.merge.e.c : anchor.columnIndex);
  worksheet["!ref"] = window.XLSX.utils.encode_range(currentRange);
  worksheet[address] = nextCell;
  return nextCell;
}

function updateSpreadsheetCellDisplay(cellElement, cell, editing = false) {
  const hasFormula = Boolean(cell?.f);
  cellElement.classList.toggle("has-formula", hasFormula);
  cellElement.classList.toggle("is-editing", editing);
  cellElement.title = hasFormula ? `=${cell.f}` : "";
  cellElement.textContent = editing
    ? spreadsheetEditValue(cell)
    : (spreadsheetDisplayValue(cell) || spreadsheetEditValue(cell));
}

function markSpreadsheetDirty() {
  state.dirty = true;
  setSaveState("Modifications...");
  showConflict(false);
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    void saveCurrentFile(false);
  }, 1200);
  void touchPresence();
}

function pasteSpreadsheetGrid(event, cell, worksheet) {
  const text = event.clipboardData?.getData("text/plain") || "";
  if (!text.includes("\t") && !text.includes("\n")) return;
  event.preventDefault();

  const startRow = Number(cell.dataset.row || 0);
  const startColumn = Number(cell.dataset.column || 0);
  const rows = text.replace(/\r/g, "").split("\n").filter((row, index, allRows) => row !== "" || index < allRows.length - 1);
  rows.forEach((rowText, rowOffset) => {
    rowText.split("\t").forEach((value, columnOffset) => {
      const rowIndex = startRow + rowOffset;
      const columnIndex = startColumn + columnOffset;
      const anchor = spreadsheetCellAnchor(worksheet, rowIndex, columnIndex);
      const nextCell = setSpreadsheetCell(worksheet, rowIndex, columnIndex, value);
      const target = elements.previewFrame.querySelector(spreadsheetCellSelector(anchor.rowIndex, anchor.columnIndex));
      if (target) updateSpreadsheetCellDisplay(target, nextCell, target === cell);
    });
  });
  markSpreadsheetDirty();
}

function setFormulaInputValue(value) {
  if (state.activeFormulaInput) {
    state.activeFormulaInput.value = value || "";
  }
}

function renderSpreadsheetSheet(item) {
  elements.previewFrame.innerHTML = "";
  const workbook = state.workbook;
  if (!workbook || workbook.SheetNames.length === 0) {
    renderBinaryPreview(item);
    return;
  }

  const controls = document.createElement("div");
  controls.className = "sheet-controls";

  const sheetSelect = document.createElement("select");
  workbook.SheetNames.forEach((sheetName) => {
    const option = document.createElement("option");
    option.value = sheetName;
    option.textContent = sheetName;
    sheetSelect.appendChild(option);
  });
  sheetSelect.value = state.activeSheetName;
  sheetSelect.addEventListener("change", () => {
    state.activeSheetName = sheetSelect.value;
    renderSpreadsheetSheet(item);
  });

  const formulaBar = document.createElement("label");
  formulaBar.className = "formula-bar";
  const fx = document.createElement("span");
  fx.textContent = "fx";
  const formulaInput = document.createElement("input");
  formulaInput.type = "text";
  formulaInput.placeholder = "Selectionnez une cellule";
  formulaInput.autocomplete = "off";
  formulaInput.addEventListener("input", () => {
    const active = state.activeSpreadsheetCell;
    if (!active) return;
    const nextCell = setSpreadsheetCell(worksheet, active.rowIndex, active.columnIndex, formulaInput.value);
    updateSpreadsheetCellDisplay(active.element, nextCell, active.element === document.activeElement);
    markSpreadsheetDirty();
  });
  formulaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.activeSpreadsheetCell?.element?.focus();
    }
  });
  formulaBar.append(fx, formulaInput);
  state.activeFormulaInput = formulaInput;

  controls.append(sheetSelect, formulaBar);
  elements.previewFrame.appendChild(controls);

  const worksheet = workbook.Sheets[state.activeSheetName] || {};
  if (!worksheet["!ref"]) worksheet["!ref"] = "A1:A1";
  const range = spreadsheetRange(worksheet);
  const rowLimit = Math.min(Math.max(range.e.r + 20, range.s.r + 40), range.s.r + 999);
  const columnLimit = Math.min(Math.max(range.e.c + 5, range.s.c + 9), range.s.c + 79);

  const shell = document.createElement("div");
  shell.className = "spreadsheet-shell";
  const table = document.createElement("table");
  table.className = "spreadsheet-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "sheet-row-heading";
  headerRow.appendChild(corner);
  for (let columnIndex = range.s.c; columnIndex <= columnLimit; columnIndex++) {
    const th = document.createElement("th");
    th.textContent = window.XLSX.utils.encode_col(columnIndex);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let rowIndex = range.s.r; rowIndex <= rowLimit; rowIndex++) {
    const tr = document.createElement("tr");
    const rowHeading = document.createElement("th");
    rowHeading.className = "sheet-row-heading";
    rowHeading.textContent = String(rowIndex + 1);
    tr.appendChild(rowHeading);

    for (let columnIndex = range.s.c; columnIndex <= columnLimit; columnIndex++) {
      const merge = spreadsheetMergeForCell(worksheet, rowIndex, columnIndex);
      if (merge && (rowIndex !== merge.s.r || columnIndex !== merge.s.c)) {
        continue;
      }

      const td = document.createElement("td");
      td.contentEditable = "true";
      td.spellcheck = false;
      const anchor = spreadsheetCellAnchor(worksheet, rowIndex, columnIndex);
      const cellRowIndex = anchor.rowIndex;
      const cellColumnIndex = anchor.columnIndex;
      td.dataset.row = String(cellRowIndex);
      td.dataset.column = String(cellColumnIndex);
      const address = window.XLSX.utils.encode_cell({ r: cellRowIndex, c: cellColumnIndex });
      if (merge) {
        td.classList.add("is-merged");
        td.rowSpan = Math.max(1, Math.min(merge.e.r, rowLimit) - rowIndex + 1);
        td.colSpan = Math.max(1, Math.min(merge.e.c, columnLimit) - columnIndex + 1);
        td.dataset.merge = spreadsheetMergeRangeLabel(merge);
      }

      updateSpreadsheetCellDisplay(td, worksheet[address]);
      td.addEventListener("focus", () => {
        state.activeSpreadsheetCell = { element: td, rowIndex: cellRowIndex, columnIndex: cellColumnIndex, address };
        updateSpreadsheetCellDisplay(td, worksheet[address], true);
        setFormulaInputValue(spreadsheetEditValue(worksheet[address]));
      });
      td.addEventListener("input", () => {
        const nextCell = setSpreadsheetCell(worksheet, cellRowIndex, cellColumnIndex, td.textContent);
        setFormulaInputValue(spreadsheetEditValue(nextCell));
        markSpreadsheetDirty();
      });
      td.addEventListener("blur", () => {
        updateSpreadsheetCellDisplay(td, worksheet[address]);
      });
      td.addEventListener("paste", (event) => pasteSpreadsheetGrid(event, td, worksheet));
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  shell.appendChild(table);
  elements.previewFrame.appendChild(shell);
}

async function saveSpreadsheetFile(force) {
  if (!state.selectedItem || !state.workbook) return;
  if (!state.dirty && !force) return;

  window.clearTimeout(state.saveTimer);
  setSaveState("Enregistrement...");
  try {
    state.workbook.Workbook = state.workbook.Workbook || {};
    state.workbook.Workbook.CalcPr = {
      ...(state.workbook.Workbook.CalcPr || {}),
      calcMode: "auto",
      fullCalcOnLoad: "1",
      forceFullCalc: "1",
    };
    const output = window.XLSX.write(state.workbook, {
      bookType: spreadsheetBookType(state.selectedItem),
      type: "array",
    });
    const blob = new Blob([output], { type: spreadsheetMime(state.selectedItem) });
    const form = new FormData();
    form.append("action", "save_binary");
    form.append("path", state.selectedItem.path);
    form.append("expectedVersion", state.contentVersion);
    form.append("force", force ? "1" : "0");
    form.append("file", blob, state.selectedItem.name);

    const payload = await apiRequest(API.files, {
      method: "POST",
      body: form,
    });
    state.dirty = false;
    state.contentVersion = payload.version || payload.item?.version || "";
    state.selectedItem = payload.item || state.selectedItem;
    showConflict(false);
    setSaveState("Enregistre");
    updateStats(payload.stats || {});
    await loadList({ keepSelection: true, quiet: true });
  } catch (error) {
    if (error.payload?.error === "version_conflict") {
      showConflict(true);
      setSaveState("Conflit de version");
      return;
    }
    setSaveState("Erreur");
    showMessage(error.message, "error");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wordMime() {
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function wordRunPropertiesXml(marks = {}) {
  const props = [];
  if (marks.bold) props.push("<w:b/>");
  if (marks.italic) props.push("<w:i/>");
  if (marks.underline) props.push('<w:u w:val="single"/>');
  if (marks.size) props.push(`<w:sz w:val="${Number(marks.size)}"/>`);
  return props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
}

function wordRunXml(value, marks = {}) {
  const text = String(value ?? "").replace(/\r/g, "");
  if (text === "") return "";
  return text.split("\n").map((part, index) => {
    const lineBreak = index > 0 ? "<w:r><w:br/></w:r>" : "";
    if (part === "") return lineBreak;
    return `${lineBreak}<w:r>${wordRunPropertiesXml(marks)}<w:t xml:space="preserve">${escapeHtml(part)}</w:t></w:r>`;
  }).join("");
}

function wordMarksForElement(element, inherited = {}) {
  const tagName = String(element.tagName || "").toLowerCase();
  const marks = { ...inherited };
  if (tagName === "strong" || tagName === "b") marks.bold = true;
  if (tagName === "em" || tagName === "i") marks.italic = true;
  if (tagName === "u") marks.underline = true;

  const style = element.style || {};
  if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) marks.bold = true;
  if (style.fontStyle === "italic") marks.italic = true;
  if (String(style.textDecoration || style.textDecorationLine || "").includes("underline")) marks.underline = true;
  return marks;
}

function wordInlineXmlFromNode(node, marks = {}) {
  if (node.nodeType === 3) return wordRunXml(node.nodeValue, marks);
  if (node.nodeType !== 1) return "";

  const tagName = String(node.tagName || "").toLowerCase();
  if (tagName === "br") return "<w:r><w:br/></w:r>";
  if (tagName === "img") {
    const label = node.getAttribute("alt") || node.getAttribute("title") || "";
    return label ? wordRunXml(`[${label}]`, marks) : "";
  }

  const nextMarks = wordMarksForElement(node, marks);
  return Array.from(node.childNodes || []).map((child) => wordInlineXmlFromNode(child, nextMarks)).join("");
}

function wordAlignment(element) {
  const value = String(element.style?.textAlign || element.getAttribute?.("align") || "").toLowerCase();
  if (["center", "right", "both"].includes(value)) return value;
  if (value === "justify") return "both";
  return "";
}

function wordParagraphXml(inlineXml, options = {}) {
  const paragraphProps = [];
  if (options.align) paragraphProps.push(`<w:jc w:val="${options.align}"/>`);
  const propsXml = paragraphProps.length ? `<w:pPr>${paragraphProps.join("")}</w:pPr>` : "";
  return `<w:p>${propsXml}${inlineXml || "<w:r/>"}</w:p>`;
}

function wordBlockTagName(node) {
  return String(node?.tagName || "").toLowerCase();
}

function wordHasBlockChildren(element) {
  return Array.from(element.childNodes || []).some((child) => {
    const tagName = wordBlockTagName(child);
    return ["p", "div", "h1", "h2", "h3", "ul", "ol", "table"].includes(tagName);
  });
}

function wordListXml(listElement) {
  const ordered = wordBlockTagName(listElement) === "ol";
  let index = 1;
  return Array.from(listElement.children || []).filter((child) => wordBlockTagName(child) === "li").map((item) => {
    const prefix = ordered ? `${index++}. ` : "- ";
    const inlineXml = wordRunXml(prefix, {}) + Array.from(item.childNodes || []).filter((child) => {
      const tagName = wordBlockTagName(child);
      return tagName !== "ul" && tagName !== "ol";
    }).map((child) => wordInlineXmlFromNode(child)).join("");
    const nested = Array.from(item.children || []).filter((child) => ["ul", "ol"].includes(wordBlockTagName(child))).map(wordListXml).join("");
    return wordParagraphXml(inlineXml, { align: wordAlignment(item) }) + nested;
  }).join("");
}

function wordTableXml(tableElement) {
  const rows = Array.from(tableElement.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tr"));
  const rowXml = rows.map((row) => {
    const cells = Array.from(row.children || []).filter((cell) => ["td", "th"].includes(wordBlockTagName(cell)));
    const cellXml = cells.map((cell) => {
      const content = wordBlockXmlFromNodes(Array.from(cell.childNodes || [])) || wordParagraphXml("");
      return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${content}</w:tc>`;
    }).join("");
    return `<w:tr>${cellXml}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7E0E8"/><w:left w:val="single" w:sz="4" w:color="D7E0E8"/><w:bottom w:val="single" w:sz="4" w:color="D7E0E8"/><w:right w:val="single" w:sz="4" w:color="D7E0E8"/><w:insideH w:val="single" w:sz="4" w:color="D7E0E8"/><w:insideV w:val="single" w:sz="4" w:color="D7E0E8"/></w:tblBorders></w:tblPr>${rowXml}</w:tbl>`;
}

function wordElementToBlocks(element) {
  const tagName = wordBlockTagName(element);
  if (tagName === "table") return wordTableXml(element);
  if (tagName === "ul" || tagName === "ol") return wordListXml(element);
  if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
    const size = tagName === "h1" ? 32 : tagName === "h2" ? 28 : 24;
    const inlineXml = Array.from(element.childNodes || []).map((child) => wordInlineXmlFromNode(child, { bold: true, size })).join("");
    return wordParagraphXml(inlineXml, { align: wordAlignment(element) });
  }
  if (tagName === "p" || tagName === "li" || (tagName === "div" && !wordHasBlockChildren(element))) {
    const inlineXml = Array.from(element.childNodes || []).map((child) => wordInlineXmlFromNode(child)).join("");
    return wordParagraphXml(inlineXml, { align: wordAlignment(element) });
  }
  return wordBlockXmlFromNodes(Array.from(element.childNodes || []));
}

function wordBlockXmlFromNodes(nodes) {
  return nodes.map((node) => {
    if (node.nodeType === 3) {
      const text = String(node.nodeValue || "");
      return text.trim() ? wordParagraphXml(wordRunXml(text)) : "";
    }
    if (node.nodeType !== 1) return "";
    return wordElementToBlocks(node);
  }).join("");
}

function wordDocumentXmlFromEditor(editor) {
  const bodyXml = wordBlockXmlFromNodes(Array.from(editor.childNodes || [])) || wordParagraphXml("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
}

async function wordDocxBlobFromEditor(editor, title) {
  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.folder("word").file("document.xml", wordDocumentXmlFromEditor(editor));
  zip.folder("docProps").file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeHtml(title)}</dc:title>
  <dc:creator>NautiCloud</dc:creator>
  <cp:lastModifiedBy>NautiCloud</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`);
  zip.folder("docProps").file("app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>NautiCloud</Application>
</Properties>`);
  return zip.generateAsync({
    type: "blob",
    mimeType: wordMime(),
    compression: "DEFLATE",
  });
}

async function saveWordFile(force) {
  if (!state.selectedItem || !state.editor) return;
  if (!state.dirty && !force) return;
  if (!window.JSZip) {
    showMessage("L export Word n est pas disponible.", "error");
    return;
  }

  window.clearTimeout(state.saveTimer);
  setSaveState("Enregistrement...");
  try {
    const blob = await wordDocxBlobFromEditor(state.editor, state.selectedItem.name);
    const form = new FormData();
    form.append("action", "save_binary");
    form.append("path", state.selectedItem.path);
    form.append("expectedVersion", state.contentVersion);
    form.append("force", force ? "1" : "0");
    form.append("file", blob, state.selectedItem.name);

    const payload = await apiRequest(API.files, {
      method: "POST",
      body: form,
    });
    state.dirty = false;
    state.contentVersion = payload.version || payload.item?.version || "";
    state.selectedItem = payload.item || state.selectedItem;
    showConflict(false);
    setSaveState("Enregistre");
    updateStats(payload.stats || {});
    await loadList({ keepSelection: true, quiet: true });
  } catch (error) {
    if (error.payload?.error === "version_conflict") {
      showConflict(true);
      setSaveState("Conflit de version");
      return;
    }
    setSaveState("Erreur");
    showMessage(error.message, "error");
  }
}

async function saveCurrentFile(force) {
  if (!state.selectedItem || !state.editor) return;
  if (state.editorType === "spreadsheet") {
    await saveSpreadsheetFile(force);
    return;
  }
  if (state.editorType === "word") {
    await saveWordFile(force);
    return;
  }
  if (!state.dirty && !force) return;

  window.clearTimeout(state.saveTimer);
  setSaveState("Enregistrement...");
  try {
    const payload = await apiRequest(API.files, {
      method: "POST",
      body: JSON.stringify({
        action: "save_file",
        path: state.selectedItem.path,
        content: state.editor.value,
        expectedVersion: state.contentVersion,
        force,
      }),
    });
    state.dirty = false;
    state.contentVersion = payload.version || payload.item?.version || "";
    state.selectedItem = payload.item || state.selectedItem;
    showConflict(false);
    setSaveState("Enregistre");
    updateStats(payload.stats || {});
    await loadList({ keepSelection: true, quiet: true });
  } catch (error) {
    if (error.payload?.error === "version_conflict") {
      showConflict(true);
      setSaveState("Conflit de version");
      return;
    }
    setSaveState("Erreur");
    showMessage(error.message, "error");
  }
}

async function reloadSelectedFile() {
  if (!state.selectedItem) return;
  state.dirty = false;
  showConflict(false);
  await renderPreview(state.selectedItem);
}

async function fetchAuth() {
  const payload = await apiRequest(API.auth);
  if (!payload.authenticated) {
    redirectToOceanOS();
    return false;
  }
  if (!payload.allowed) {
    showMessage("NautiCloud n est pas active pour ce compte.");
    window.setTimeout(redirectToOceanOS, 1200);
    return false;
  }
  state.user = payload.user || null;
  const label = state.user?.displayName || state.user?.email || "Utilisateur";
  elements.currentUser.textContent = label;
  return true;
}

async function loadList(options = {}) {
  const { keepSelection = false, quiet = false } = options;
  if (!quiet) showMessage("");
  const payload = await apiRequest(filesUrl({ action: "list", path: state.currentPath }));
  state.searchMode = false;
  state.searchQuery = "";
  state.items = Array.isArray(payload.items) ? payload.items : [];
  state.latestEventId = Number(payload.latestEventId || state.latestEventId || 0);
  updateStats(payload.stats || {});
  renderBreadcrumb();

  if (keepSelection) {
    const existing = Array.from(state.selectedPaths).filter((path) => state.items.some((item) => item.path === path));
    state.selectedPaths = new Set(existing);
    if (state.selectedPaths.size === 1) {
      state.selectedItem = state.items.find((item) => state.selectedPaths.has(item.path)) || state.selectedItem;
    }
  } else {
    state.selectedPaths.clear();
    state.selectedItem = null;
    clearPreview();
  }

  renderTable();
  renderPresence(payload.presence || []);
  if (keepSelection && state.selectedItem && !state.dirty) {
    state.selectedItem = state.itemByPath.get(state.selectedItem.path) || state.selectedItem;
  }
  void touchPresence();
}

async function navigate(path) {
  state.currentPath = path || "";
  elements.searchInput.value = "";
  await loadList();
}

async function runSearch(query) {
  const q = query.trim();
  if (!q) {
    await loadList();
    return;
  }

  const payload = await apiRequest(filesUrl({ action: "search", path: state.currentPath, q }));
  state.searchMode = true;
  state.searchQuery = q;
  state.items = Array.isArray(payload.items) ? payload.items : [];
  state.selectedPaths.clear();
  state.selectedItem = null;
  clearPreview();
  renderBreadcrumb();
  renderTable();
}

function uploadLabel(count) {
  return count > 1 ? `${count} fichiers` : "1 fichier";
}

async function uploadFileBatch(files) {
  const form = new FormData();
  form.append("action", "upload");
  form.append("path", state.currentPath);
  Array.from(files).forEach((file) => form.append("files[]", file));
  return apiRequest(API.files, { method: "POST", body: form });
}

async function uploadFiles(files) {
  const selectedFiles = Array.from(files || []);
  if (selectedFiles.length === 0) return;

  const uploaded = [];
  let latestStats = null;
  showMessage(`Import de ${uploadLabel(selectedFiles.length)} en cours...`, "success");

  for (let index = 0; index < selectedFiles.length; index += UPLOAD_BATCH_SIZE) {
    const batch = selectedFiles.slice(index, index + UPLOAD_BATCH_SIZE);
    const payload = await uploadFileBatch(batch);
    uploaded.push(...(payload.items || []));
    latestStats = payload.stats || latestStats;
  }

  updateStats(latestStats || {});
  showMessage(`${uploadLabel(uploaded.length)} importe(s).`, "success");
  await loadList();
}

function openEntryModal(mode) {
  state.entryMode = mode;
  elements.entryModalTitle.textContent = mode === "folder"
    ? "Nouveau dossier"
    : mode === "file"
      ? "Nouveau fichier"
      : "Renommer";
  elements.entrySubmit.textContent = mode === "rename" ? "Renommer" : "Creer";
  elements.entryName.value = mode === "rename" && state.selectedItem ? state.selectedItem.name : "";
  elements.entryModal.classList.remove("hidden");
  window.setTimeout(() => elements.entryName.focus(), 0);
}

function closeEntryModal() {
  elements.entryModal.classList.add("hidden");
  elements.entryForm.reset();
}

async function submitEntry() {
  const name = elements.entryName.value.trim();
  if (!name) return;
  if (state.entryMode === "folder") {
    await apiRequest(API.files, {
      method: "POST",
      body: JSON.stringify({ action: "create_folder", path: state.currentPath, name }),
    });
  } else if (state.entryMode === "file") {
    await apiRequest(API.files, {
      method: "POST",
      body: JSON.stringify({ action: "create_file", path: state.currentPath, name, content: "" }),
    });
  } else if (state.entryMode === "rename" && state.selectedItem) {
    await apiRequest(API.files, {
      method: "POST",
      body: JSON.stringify({ action: "rename", path: state.selectedItem.path, name }),
    });
  }
  closeEntryModal();
  await loadList();
}

async function deleteSelection() {
  const paths = Array.from(state.selectedPaths);
  if (paths.length === 0) return;
  const ok = window.confirm(`Supprimer ${paths.length} element(s) de NautiCloud ?`);
  if (!ok) return;
  await apiRequest(API.files, {
    method: "POST",
    body: JSON.stringify({ action: "delete", paths }),
  });
  state.selectedPaths.clear();
  state.selectedItem = null;
  clearPreview();
  await loadList();
}

async function collectFolders(path = "", folders = [{ path: "", name: "Racine" }]) {
  const payload = await apiRequest(filesUrl({ action: "list", path }));
  const children = (payload.items || []).filter((item) => item.type === "folder");
  for (const child of children) {
    folders.push({ path: child.path, name: child.path || child.name });
    await collectFolders(child.path, folders);
  }
  return folders;
}

function folderAllowedAsDestination(folderPath) {
  for (const selectedPath of state.selectedPaths) {
    if (folderPath === selectedPath || folderPath.startsWith(`${selectedPath}/`)) {
      return false;
    }
  }
  return true;
}

async function openDestinationModal(mode) {
  state.destinationMode = mode;
  elements.destinationTitle.textContent = mode === "copy" ? "Copier vers" : "Deplacer vers";
  elements.destinationSubmit.textContent = mode === "copy" ? "Copier" : "Deplacer";
  elements.destinationSelect.innerHTML = "";
  const folders = (await collectFolders()).filter((folder) => folderAllowedAsDestination(folder.path));
  folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.path;
    option.textContent = folder.path || "Racine";
    elements.destinationSelect.appendChild(option);
  });
  elements.destinationSelect.value = state.currentPath;
  elements.destinationModal.classList.remove("hidden");
}

function closeDestinationModal() {
  elements.destinationModal.classList.add("hidden");
}

async function submitDestination() {
  const paths = Array.from(state.selectedPaths);
  if (paths.length === 0) return;
  await apiRequest(API.files, {
    method: "POST",
    body: JSON.stringify({
      action: state.destinationMode,
      paths,
      destination: elements.destinationSelect.value,
    }),
  });
  closeDestinationModal();
  state.selectedPaths.clear();
  state.selectedItem = null;
  clearPreview();
  await loadList();
}

function renderPresence(presence) {
  const items = Array.isArray(presence) ? presence : [];
  elements.presenceCount.textContent = String(items.length);
  elements.presenceList.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "presence-item";
    const title = document.createElement("strong");
    title.textContent = "Aucune presence";
    const text = document.createElement("span");
    text.textContent = "Le drive est disponible.";
    empty.append(title, text);
    elements.presenceList.appendChild(empty);
    return;
  }

  items.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "presence-item";
    const title = document.createElement("strong");
    const user = entry.user || {};
    title.textContent = `${user.displayName || user.email || "Utilisateur"}${entry.clientId === state.clientId ? " (vous)" : ""}`;
    const text = document.createElement("span");
    const suffix = entry.editing ? "edition" : "lecture";
    text.textContent = `${entry.path || "Racine"} - ${suffix}`;
    item.append(title, text);
    elements.presenceList.appendChild(item);
  });
}

async function touchPresence() {
  if (!state.user) return;
  try {
    const payload = await apiRequest(API.files, {
      method: "POST",
      body: JSON.stringify({
        action: "presence",
        clientId: state.clientId,
        path: state.selectedItem?.path || state.currentPath,
        editing: Boolean(state.editor && state.dirty),
      }),
    });
    renderPresence(payload.presence || []);
  } catch (error) {}
}

async function leavePresence() {
  try {
    await navigator.sendBeacon?.(API.files, new Blob([JSON.stringify({
      action: "leave_presence",
      clientId: state.clientId,
    })], { type: "application/json" }));
  } catch (error) {}
}

function shouldRefreshForEvent(event) {
  const eventPath = String(event.path || "");
  if (state.currentPath === "") {
    return eventPath.split("/").length <= 1 || state.items.some((item) => item.path === eventPath);
  }
  return eventPath === state.currentPath
    || eventPath.startsWith(`${state.currentPath}/`)
    || state.items.some((item) => item.path === eventPath);
}

function handleDriveChange(event) {
  state.latestEventId = Math.max(state.latestEventId, Number(event.id || 0));
  if (shouldRefreshForEvent(event)) {
    void loadList({ keepSelection: true, quiet: true }).catch(() => {});
  }

  if (!state.selectedItem || event.path !== state.selectedItem.path) return;
  const sameActor = Number(event.actor?.id || 0) === Number(state.user?.id || 0);
  if (sameActor) return;

  if (state.editor && state.dirty) {
    showConflict(true);
    setSaveState("Version distante");
    return;
  }

  const fresh = event.payload?.item;
  if (fresh) {
    state.selectedItem = fresh;
    void renderPreview(fresh).catch(() => {});
  }
}

function startRealtime() {
  if (!("EventSource" in window)) {
    setSyncState("Polling", "offline");
    window.setInterval(() => loadList({ keepSelection: true, quiet: true }).catch(() => {}), 12000);
    return;
  }

  state.eventSource = new EventSource(`${API.events}?sinceEventId=${encodeURIComponent(state.latestEventId)}`);
  state.eventSource.addEventListener("drive.ready", (event) => {
    const payload = JSON.parse(event.data || "{}");
    state.latestEventId = Number(payload.lastEventId || state.latestEventId || 0);
    updateStats(payload.stats || {});
    setSyncState("Temps reel", "live");
  });
  state.eventSource.addEventListener("drive.change", (event) => {
    const payload = JSON.parse(event.data || "{}");
    handleDriveChange(payload);
    setSyncState("Synchronise", "live");
  });
  state.eventSource.addEventListener("presence.sync", (event) => {
    const payload = JSON.parse(event.data || "{}");
    renderPresence(payload.presence || []);
  });
  state.eventSource.addEventListener("error", () => {
    setSyncState("Reconnexion", "offline");
  });
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => loadList({ keepSelection: true }).catch((error) => showMessage(error.message)));
  elements.logoutButton.addEventListener("click", async () => {
    await apiRequest(API.auth, { method: "DELETE" }).catch(() => {});
    redirectToOceanOS();
  });
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(elements.searchInput.value).catch((error) => showMessage(error.message));
  });
  elements.allFilesButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    loadList().catch((error) => showMessage(error.message));
  });
  elements.uploadButton.addEventListener("click", () => {
    elements.fileInput.value = "";
    elements.fileInput.click();
  });
  elements.fileInput.addEventListener("change", () => {
    const files = Array.from(elements.fileInput.files || []);
    elements.fileInput.value = "";
    uploadFiles(files).catch((error) => showMessage(error.message));
  });
  elements.newFolderButton.addEventListener("click", () => openEntryModal("folder"));
  elements.newFileButton.addEventListener("click", () => openEntryModal("file"));
  elements.renameButton.addEventListener("click", () => openEntryModal("rename"));
  elements.deleteButton.addEventListener("click", () => deleteSelection().catch((error) => showMessage(error.message)));
  elements.copyButton.addEventListener("click", () => openDestinationModal("copy").catch((error) => showMessage(error.message)));
  elements.moveButton.addEventListener("click", () => openDestinationModal("move").catch((error) => showMessage(error.message)));
  elements.selectAll.addEventListener("change", () => {
    setSelectedPaths(elements.selectAll.checked ? state.items.map((item) => item.path) : []);
  });
  elements.listViewButton.addEventListener("click", () => setViewMode("list"));
  elements.mosaicViewButton.addEventListener("click", () => setViewMode("mosaic"));
  elements.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitEntry().catch((error) => showMessage(error.message));
  });
  elements.entryCancel.addEventListener("click", closeEntryModal);
  elements.entryModalBackdrop.addEventListener("click", closeEntryModal);
  elements.destinationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitDestination().catch((error) => showMessage(error.message));
  });
  elements.destinationCancel.addEventListener("click", closeDestinationModal);
  elements.destinationBackdrop.addEventListener("click", closeDestinationModal);
  elements.fullscreenButton.addEventListener("click", () => setFocusMode(true));
  elements.closeFullscreenButton.addEventListener("click", () => setFocusMode(false));
  elements.saveButton.addEventListener("click", () => saveCurrentFile(false));
  elements.forceSaveButton.addEventListener("click", () => saveCurrentFile(true));
  elements.reloadFileButton.addEventListener("click", () => reloadSelectedFile().catch((error) => showMessage(error.message)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.focusMode) {
      setFocusMode(false);
    }
  });
  window.addEventListener("beforeunload", () => {
    leavePresence();
    if (state.eventSource) state.eventSource.close();
  });
  window.setInterval(touchPresence, 15000);
}

async function boot() {
  bindEvents();
  setView("loading");
  try {
    const ok = await fetchAuth();
    if (!ok) return;
    await loadList();
    setView("drive");
    startRealtime();
  } catch (error) {
    showMessage(error.message || "NautiCloud est indisponible.");
    setView("drive");
  }
}

boot();
