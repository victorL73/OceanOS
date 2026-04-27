const API = {
  auth: "api/auth.php",
  forms: "api/forms.php",
  export: "api/export.php",
};
const OCEANOS_URL = "/OceanOS/";

const FIELD_TYPES = {
  short: "Texte court",
  paragraph: "Paragraphe",
  email: "Email",
  number: "Nombre",
  date: "Date",
  radio: "Choix unique",
  checkbox: "Cases a cocher",
  select: "Liste",
  rating: "Note",
  scale: "Echelle",
};

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  publicView: $("public-view"),
  workspaceView: $("workspace-view"),
  publicForm: $("public-form"),
  publicStatus: $("public-status"),
  publicTitle: $("public-title"),
  publicDescription: $("public-description"),
  publicFields: $("public-fields"),
  publicMessage: $("public-message"),
  publicSubmit: $("public-submit"),
  syncPill: $("sync-pill"),
  currentUser: $("current-user"),
  newFormButton: $("new-form-button"),
  refreshButton: $("refresh-button"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  formsCount: $("forms-count"),
  formsList: $("forms-list"),
  editorPanel: $("editor-panel"),
  emptyState: $("empty-state"),
  emptyNewForm: $("empty-new-form"),
  editorContent: $("editor-content"),
  editorKicker: $("editor-kicker"),
  editorTitleDisplay: $("editor-title-display"),
  editorMeta: $("editor-meta"),
  openPublicLink: $("open-public-link"),
  copyLinkButton: $("copy-link-button"),
  duplicateButton: $("duplicate-button"),
  deleteFormButton: $("delete-form-button"),
  saveFormButton: $("save-form-button"),
  formTitle: $("form-title"),
  formDescription: $("form-description"),
  formSlug: $("form-slug"),
  formStatus: $("form-status"),
  collectEmail: $("collect-email"),
  confirmationMessage: $("confirmation-message"),
  newFieldType: $("new-field-type"),
  addFieldButton: $("add-field-button"),
  fieldsList: $("fields-list"),
  responsesTitle: $("responses-title"),
  reloadResponsesButton: $("reload-responses-button"),
  exportLink: $("export-link"),
  summaryGrid: $("summary-grid"),
  responsesHead: $("responses-head"),
  responsesBody: $("responses-body"),
  responsesEmpty: $("responses-empty"),
  previewShell: $("preview-shell"),
};

const state = {
  user: null,
  forms: [],
  currentForm: null,
  responses: [],
  summary: [],
  tab: "design",
  publicForm: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fieldId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicClientToken(slug) {
  const safeSlug = String(slug || "form").replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = `formcean_public_client_${safeSlug}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const token = crypto.randomUUID
      ? crypto.randomUUID()
      : `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(key, token);
    return token;
  } catch (error) {
    return `fc_session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }
}

function setView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.publicView.classList.toggle("hidden", view !== "public");
  elements.workspaceView.classList.toggle("hidden", view !== "workspace");
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
    const error = new Error(payload.message || payload.error || "Requete impossible.");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function absoluteUrl(path) {
  return new URL(path, window.location.origin).href;
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

function defaultSettings() {
  return {
    collectEmail: false,
    confirmationMessage: "Merci, votre reponse a bien ete envoyee.",
    closedMessage: "Ce formulaire ne collecte pas de reponses pour le moment.",
  };
}

function defaultField(type = "short") {
  return {
    id: fieldId(),
    type,
    label: "Nouvelle question",
    required: false,
    placeholder: "",
    help: "",
    options: ["Option 1"],
    min: type === "scale" ? 0 : 1,
    max: 5,
    minLabel: "",
    maxLabel: "",
  };
}

function ensureFormShape(form) {
  const next = clone(form);
  next.fields = Array.isArray(next.fields) && next.fields.length ? next.fields : [defaultField()];
  next.settings = { ...defaultSettings(), ...(next.settings || {}) };
  return next;
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

async function loadForms(selectId = null) {
  showMessage("");
  const payload = await apiRequest(`${API.forms}?action=list`);
  state.forms = Array.isArray(payload.forms) ? payload.forms.map(ensureFormShape) : [];
  renderFormsList();

  if (selectId) {
    await selectForm(selectId);
  } else if (state.currentForm) {
    const existing = state.forms.find((form) => form.id === state.currentForm.id);
    if (existing) {
      state.currentForm = ensureFormShape(existing);
      renderEditor();
    } else {
      state.currentForm = null;
      renderEditor();
    }
  } else if (state.forms.length > 0) {
    await selectForm(state.forms[0].id);
  } else {
    renderEditor();
  }
}

function renderFormsList() {
  elements.formsCount.textContent = String(state.forms.length);
  elements.formsList.innerHTML = "";

  if (state.forms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sidebar-empty";
    empty.textContent = "Aucun formulaire";
    elements.formsList.appendChild(empty);
    return;
  }

  state.forms.forEach((form) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "form-list-item";
    button.classList.toggle("active", state.currentForm?.id === form.id);
    const status = form.status === "published" ? "Publie" : "Brouillon";
    button.innerHTML = `
      <span class="form-list-head">
        <strong></strong>
      </span>
      <span class="form-list-meta"><small data-status="${form.status || "draft"}">${status}</small>${form.responseCount || 0} reponse(s)</span>
    `;
    button.querySelector("strong").textContent = form.title || "Sans titre";
    button.addEventListener("click", () => {
      void selectForm(form.id);
    });
    elements.formsList.appendChild(button);
  });
}

async function selectForm(id) {
  const payload = await apiRequest(`${API.forms}?action=get&id=${encodeURIComponent(id)}`);
  state.currentForm = ensureFormShape(payload.form);
  state.responses = [];
  state.summary = [];
  renderFormsList();
  renderEditor();
  if (state.tab === "responses") {
    await loadResponses();
  }
}

function updateFormFromControls() {
  if (!state.currentForm) return;
  state.currentForm.title = elements.formTitle.value.trim() || "Nouveau formulaire";
  state.currentForm.description = elements.formDescription.value.trim();
  state.currentForm.slug = elements.formSlug.value.trim();
  state.currentForm.status = elements.formStatus.value;
  state.currentForm.settings = {
    ...(state.currentForm.settings || defaultSettings()),
    collectEmail: elements.collectEmail.checked,
    confirmationMessage: elements.confirmationMessage.value.trim() || defaultSettings().confirmationMessage,
  };
}

function renderEditorHeader() {
  if (!state.currentForm) return;
  const form = state.currentForm;
  elements.editorKicker.textContent = form.status === "published" ? "Publie" : "Brouillon";
  elements.editorKicker.dataset.status = form.status;
  elements.editorTitleDisplay.textContent = form.title || "Nouveau formulaire";
  elements.editorMeta.textContent = `${form.responseCount || 0} reponse(s) - ${formatDate(form.updatedAt)}`;
  elements.openPublicLink.href = absoluteUrl(`/Formcean/?form=${encodeURIComponent(form.slug || "")}`);
  elements.openPublicLink.classList.toggle("hidden", form.status !== "published");
  elements.exportLink.href = `${API.export}?id=${encodeURIComponent(form.id)}`;
}

function renderEditor() {
  const hasForm = Boolean(state.currentForm);
  elements.emptyState.classList.toggle("hidden", hasForm);
  elements.editorContent.classList.toggle("hidden", !hasForm);
  if (!hasForm) return;

  const form = state.currentForm;
  elements.formTitle.value = form.title || "";
  elements.formDescription.value = form.description || "";
  elements.formSlug.value = form.slug || "";
  elements.formStatus.value = form.status || "draft";
  elements.collectEmail.checked = Boolean(form.settings?.collectEmail);
  elements.confirmationMessage.value = form.settings?.confirmationMessage || defaultSettings().confirmationMessage;
  renderEditorHeader();
  renderFieldsEditor();
  updateTab();
}

function updateTab() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.tab);
  });
  document.querySelectorAll(".tab-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.section === state.tab);
  });

  if (state.tab === "preview" && state.currentForm) {
    updateFormFromControls();
    renderPreview();
  }
  if (state.tab === "responses" && state.currentForm) {
    void loadResponses();
  }
}

function renderFieldsEditor() {
  const fields = state.currentForm.fields || [];
  elements.fieldsList.innerHTML = "";

  fields.forEach((field, index) => {
    const card = document.createElement("article");
    card.className = "field-card";

    const top = document.createElement("div");
    top.className = "field-card-top";

    const number = document.createElement("span");
    number.className = "field-number";
    number.textContent = String(index + 1);

    const typeSelect = document.createElement("select");
    Object.entries(FIELD_TYPES).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      typeSelect.appendChild(option);
    });
    typeSelect.value = field.type || "short";
    typeSelect.addEventListener("change", () => {
      field.type = typeSelect.value;
      if (["radio", "checkbox", "select"].includes(field.type) && (!Array.isArray(field.options) || field.options.length === 0)) {
        field.options = ["Option 1"];
      }
      if (field.type === "scale") {
        field.min = Number(field.min ?? 0);
        field.max = Math.max(Number(field.max ?? 5), field.min + 1);
      }
      renderFieldsEditor();
    });

    const required = document.createElement("label");
    required.className = "mini-check";
    const requiredInput = document.createElement("input");
    requiredInput.type = "checkbox";
    requiredInput.checked = Boolean(field.required);
    requiredInput.addEventListener("change", () => {
      field.required = requiredInput.checked;
    });
    required.append(requiredInput, document.createTextNode("Obligatoire"));

    const actions = document.createElement("div");
    actions.className = "field-actions";
    const up = fieldAction("Haut", () => moveField(index, -1), index === 0);
    const down = fieldAction("Bas", () => moveField(index, 1), index === fields.length - 1);
    const copy = fieldAction("Copier", () => duplicateField(index));
    const remove = fieldAction("Retirer", () => removeField(index), fields.length === 1);
    actions.append(up, down, copy, remove);

    top.append(number, typeSelect, required, actions);

    const body = document.createElement("div");
    body.className = "field-card-body";
    body.append(
      editorField("Question", field.label || "", (value) => {
        field.label = value;
      }),
      editorField("Aide", field.help || "", (value) => {
        field.help = value;
      })
    );

    if (["short", "paragraph", "email", "number"].includes(field.type)) {
      body.append(editorField("Placeholder", field.placeholder || "", (value) => {
        field.placeholder = value;
      }));
    }
    if (["radio", "checkbox", "select"].includes(field.type)) {
      body.append(renderOptionsEditor(field));
    }
    if (["rating", "scale"].includes(field.type)) {
      body.append(renderScaleEditor(field));
    }

    card.append(top, body);
    elements.fieldsList.appendChild(card);
  });
}

function fieldAction(label, handler, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = label === "Retirer" ? "field-button danger-text" : "field-button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function editorField(label, value, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "field compact";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
  wrapper.append(span, input);
  return wrapper;
}

function renderOptionsEditor(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "options-editor";
  const title = document.createElement("span");
  title.className = "option-title";
  title.textContent = "Options";
  const list = document.createElement("div");
  list.className = "option-list";

  field.options = Array.isArray(field.options) && field.options.length ? field.options : ["Option 1"];
  field.options.forEach((option, optionIndex) => {
    const row = document.createElement("div");
    row.className = "option-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = option;
    input.addEventListener("input", () => {
      field.options[optionIndex] = input.value;
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Retirer";
    remove.disabled = field.options.length === 1;
    remove.addEventListener("click", () => {
      field.options.splice(optionIndex, 1);
      renderFieldsEditor();
    });
    row.append(input, remove);
    list.appendChild(row);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "ghost-button compact-button";
  add.textContent = "Ajouter option";
  add.addEventListener("click", () => {
    field.options.push(`Option ${field.options.length + 1}`);
    renderFieldsEditor();
  });
  wrapper.append(title, list, add);
  return wrapper;
}

function renderScaleEditor(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "scale-editor";
  const min = editorNumber("Min", field.type === "rating" ? 1 : Number(field.min ?? 0), (value) => {
    field.min = Number(value);
    if (Number(field.max) <= Number(field.min)) field.max = Number(field.min) + 1;
  });
  const max = editorNumber("Max", Number(field.max ?? 5), (value) => {
    field.max = Math.max(Number(value), Number(field.min ?? 1) + 1);
  });
  if (field.type === "rating") {
    min.querySelector("input").disabled = true;
  }
  wrapper.append(min, max);
  if (field.type === "scale") {
    wrapper.append(
      editorField("Libelle min", field.minLabel || "", (value) => {
        field.minLabel = value;
      }),
      editorField("Libelle max", field.maxLabel || "", (value) => {
        field.maxLabel = value;
      })
    );
  }
  return wrapper;
}

function editorNumber(label, value, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "field compact";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "10";
  input.value = String(value);
  input.addEventListener("input", () => onChange(input.value));
  wrapper.append(span, input);
  return wrapper;
}

function moveField(index, delta) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= state.currentForm.fields.length) return;
  const [field] = state.currentForm.fields.splice(index, 1);
  state.currentForm.fields.splice(nextIndex, 0, field);
  renderFieldsEditor();
}

function duplicateField(index) {
  const copy = clone(state.currentForm.fields[index]);
  copy.id = fieldId();
  copy.label = `${copy.label || "Question"} copie`;
  state.currentForm.fields.splice(index + 1, 0, copy);
  renderFieldsEditor();
}

function removeField(index) {
  if (state.currentForm.fields.length <= 1) return;
  state.currentForm.fields.splice(index, 1);
  renderFieldsEditor();
}

async function createForm() {
  elements.newFormButton.disabled = true;
  try {
    const payload = await apiRequest(API.forms, {
      method: "POST",
      body: JSON.stringify({ action: "create", title: "Nouveau formulaire" }),
    });
    state.forms = payload.forms.map(ensureFormShape);
    state.currentForm = ensureFormShape(payload.form);
    state.tab = "design";
    renderFormsList();
    renderEditor();
    showMessage("Formulaire cree.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.newFormButton.disabled = false;
  }
}

async function saveCurrentForm() {
  if (!state.currentForm) return;
  updateFormFromControls();
  elements.saveFormButton.disabled = true;
  showMessage("Enregistrement...", "success");
  try {
    const payload = await apiRequest(API.forms, {
      method: "PATCH",
      body: JSON.stringify(state.currentForm),
    });
    state.currentForm = ensureFormShape(payload.form);
    state.forms = payload.forms.map(ensureFormShape);
    renderFormsList();
    renderEditor();
    showMessage("Formulaire enregistre.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    elements.saveFormButton.disabled = false;
  }
}

async function duplicateCurrentForm() {
  if (!state.currentForm) return;
  const payload = await apiRequest(API.forms, {
    method: "POST",
    body: JSON.stringify({ action: "duplicate", id: state.currentForm.id }),
  });
  state.forms = payload.forms.map(ensureFormShape);
  state.currentForm = ensureFormShape(payload.form);
  state.tab = "design";
  renderFormsList();
  renderEditor();
  showMessage("Formulaire duplique.", "success");
}

async function deleteCurrentForm() {
  if (!state.currentForm) return;
  const ok = window.confirm(`Supprimer "${state.currentForm.title}" et ses reponses ?`);
  if (!ok) return;
  const payload = await apiRequest(API.forms, {
    method: "DELETE",
    body: JSON.stringify({ id: state.currentForm.id }),
  });
  state.forms = payload.forms.map(ensureFormShape);
  state.currentForm = null;
  renderFormsList();
  await loadForms();
  showMessage("Formulaire supprime.", "success");
}

async function copyPublicLink() {
  if (!state.currentForm) return;
  updateFormFromControls();
  const link = absoluteUrl(`/Formcean/?form=${encodeURIComponent(state.currentForm.slug || "")}`);
  try {
    await navigator.clipboard.writeText(link);
    showMessage("Lien copie.", "success");
  } catch (error) {
    window.prompt("Lien public", link);
  }
}

async function loadResponses() {
  if (!state.currentForm) return;
  const payload = await apiRequest(`${API.forms}?action=responses&id=${encodeURIComponent(state.currentForm.id)}`);
  state.responses = Array.isArray(payload.responses) ? payload.responses : [];
  state.summary = Array.isArray(payload.summary) ? payload.summary : [];
  state.currentForm = ensureFormShape(payload.form);
  renderEditorHeader();
  renderResponses();
}

function renderResponses() {
  const count = state.responses.length;
  elements.responsesTitle.textContent = `${count} reponse${count > 1 ? "s" : ""}`;
  elements.exportLink.href = `${API.export}?id=${encodeURIComponent(state.currentForm.id)}`;
  renderSummary();
  renderResponsesTable();
}

function renderSummary() {
  elements.summaryGrid.innerHTML = "";
  if (state.summary.length === 0) {
    const empty = document.createElement("div");
    empty.className = "summary-card";
    empty.innerHTML = "<strong>0</strong><span>Question</span>";
    elements.summaryGrid.appendChild(empty);
    return;
  }

  state.summary.forEach((item) => {
    const card = document.createElement("article");
    card.className = "summary-card";
    const title = document.createElement("strong");
    title.textContent = item.label || "Question";
    const meta = document.createElement("span");
    meta.textContent = item.average !== null ? `Moyenne ${item.average}` : `${item.total || 0} reponse(s)`;
    card.append(title, meta);

    const choices = item.choices || {};
    Object.entries(choices).slice(0, 5).forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "choice-bar";
      const width = item.total ? Math.max(6, Math.round((Number(value) / Number(item.total)) * 100)) : 0;
      row.innerHTML = `<span>${escapeHtml(label)}</span><em>${value}</em><i style="width:${width}%"></i>`;
      card.appendChild(row);
    });

    elements.summaryGrid.appendChild(card);
  });
}

function renderResponsesTable() {
  const fields = state.currentForm.fields || [];
  const collectEmail = Boolean(state.currentForm.settings?.collectEmail);
  elements.responsesHead.innerHTML = "";
  elements.responsesBody.innerHTML = "";
  elements.responsesEmpty.classList.toggle("hidden", state.responses.length !== 0);

  const headRow = document.createElement("tr");
  ["Date", ...(collectEmail ? ["Email"] : []), ...fields.map((field) => field.label || "Question")].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  elements.responsesHead.appendChild(headRow);

  state.responses.forEach((response) => {
    const answersById = new Map((response.answers || []).map((answer) => [answer.id, answer.displayValue || ""]));
    const row = document.createElement("tr");
    const cells = [formatDate(response.createdAt)];
    if (collectEmail) cells.push(response.respondent?.email || "");
    fields.forEach((field) => cells.push(answersById.get(field.id) || ""));
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      row.appendChild(td);
    });
    elements.responsesBody.appendChild(row);
  });
}

function renderPreview() {
  elements.previewShell.innerHTML = "";
  const panel = document.createElement("section");
  panel.className = "preview-form";
  renderFormHeader(panel, state.currentForm);
  renderFormFields(panel, state.currentForm, { disabled: true });
  elements.previewShell.appendChild(panel);
}

function renderFormHeader(container, form) {
  const header = document.createElement("div");
  header.className = "rendered-form-head";
  const title = document.createElement("h2");
  title.textContent = form.title || "Formulaire";
  header.appendChild(title);
  if (form.description) {
    const description = document.createElement("p");
    description.textContent = form.description;
    header.appendChild(description);
  }
  container.appendChild(header);
}

function renderFormFields(container, form, options = {}) {
  if (form.settings?.collectEmail) {
    const email = publicQuestionShell({
      id: "respondent-email",
      label: "Email",
      help: "Une seule reponse est autorisee par email et par appareil.",
      required: true,
      type: "email",
    });
    const input = document.createElement("input");
    input.type = "email";
    input.name = "respondentEmail";
    input.required = true;
    input.disabled = Boolean(options.disabled);
    email.appendChild(input);
    container.appendChild(email);
  }

  (form.fields || []).forEach((field) => {
    container.appendChild(renderQuestion(field, options));
  });
}

function publicQuestionShell(field) {
  const wrapper = document.createElement("section");
  wrapper.className = "rendered-question";
  const title = document.createElement("label");
  title.className = "rendered-label";
  title.textContent = `${field.label || "Question"}${field.required ? " *" : ""}`;
  wrapper.appendChild(title);
  if (field.help) {
    const help = document.createElement("p");
    help.className = "rendered-help";
    help.textContent = field.help;
    wrapper.appendChild(help);
  }
  return wrapper;
}

function renderQuestion(field, options = {}) {
  const disabled = Boolean(options.disabled);
  const wrapper = publicQuestionShell(field);
  const name = field.id;

  if (["short", "email", "number", "date"].includes(field.type)) {
    const input = document.createElement("input");
    input.type = field.type === "short" ? "text" : field.type;
    input.name = name;
    input.placeholder = field.placeholder || "";
    input.required = Boolean(field.required);
    input.disabled = disabled;
    wrapper.appendChild(input);
    return wrapper;
  }

  if (field.type === "paragraph") {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.rows = 4;
    textarea.placeholder = field.placeholder || "";
    textarea.required = Boolean(field.required);
    textarea.disabled = disabled;
    wrapper.appendChild(textarea);
    return wrapper;
  }

  if (field.type === "select") {
    const select = document.createElement("select");
    select.name = name;
    select.required = Boolean(field.required);
    select.disabled = disabled;
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "";
    select.appendChild(empty);
    (field.options || []).forEach((option) => {
      const item = document.createElement("option");
      item.value = option;
      item.textContent = option;
      select.appendChild(item);
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  if (["radio", "checkbox"].includes(field.type)) {
    const group = document.createElement("div");
    group.className = "choice-list";
    (field.options || []).forEach((option, optionIndex) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = field.type;
      input.name = name;
      input.value = option;
      input.required = field.type === "radio" && Boolean(field.required);
      input.disabled = disabled;
      if (disabled && optionIndex === 0) input.checked = true;
      label.append(input, document.createTextNode(option));
      group.appendChild(label);
    });
    wrapper.appendChild(group);
    return wrapper;
  }

  if (["rating", "scale"].includes(field.type)) {
    const group = document.createElement("div");
    group.className = "scale-list";
    const min = Number(field.min ?? 1);
    const max = Number(field.max ?? 5);
    for (let value = min; value <= max; value++) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = String(value);
      input.required = Boolean(field.required);
      input.disabled = disabled;
      label.append(input, document.createElement("span"));
      label.querySelector("span").textContent = String(value);
      group.appendChild(label);
    }
    wrapper.appendChild(group);
    if (field.type === "scale" && (field.minLabel || field.maxLabel)) {
      const scaleLabels = document.createElement("div");
      scaleLabels.className = "scale-labels";
      scaleLabels.innerHTML = `<span>${escapeHtml(field.minLabel || "")}</span><span>${escapeHtml(field.maxLabel || "")}</span>`;
      wrapper.appendChild(scaleLabels);
    }
    return wrapper;
  }

  return wrapper;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadPublicForm(slug) {
  setView("public");
  showPublicMessage("");
  const payload = await apiRequest(`${API.forms}?public=1&slug=${encodeURIComponent(slug)}`);
  state.publicForm = ensureFormShape(payload.form);
  renderPublicForm();
}

function renderPublicForm() {
  const form = state.publicForm;
  elements.publicTitle.textContent = form.title || "Formulaire";
  elements.publicDescription.textContent = form.description || "";
  elements.publicStatus.textContent = form.isPublished ? "Formulaire" : "Ferme";
  elements.publicFields.innerHTML = "";
  elements.publicSubmit.classList.toggle("hidden", !form.isPublished);
  elements.publicSubmit.disabled = !form.isPublished;
  if (!form.isPublished) {
    showPublicMessage(form.settings?.closedMessage || defaultSettings().closedMessage, "error");
    return;
  }
  const fieldContainer = document.createElement("div");
  fieldContainer.className = "rendered-fields";
  renderFormFields(fieldContainer, form, { disabled: false });
  elements.publicFields.appendChild(fieldContainer);
}

function collectPublicAnswers() {
  const form = state.publicForm;
  const answers = {};
  (form.fields || []).forEach((field) => {
    if (field.type === "checkbox") {
      answers[field.id] = Array.from(elements.publicForm.querySelectorAll(`input[name="${field.id}"]:checked`)).map((input) => input.value);
      return;
    }
    if (["radio", "rating", "scale"].includes(field.type)) {
      const checked = elements.publicForm.querySelector(`input[name="${field.id}"]:checked`);
      answers[field.id] = checked ? checked.value : "";
      return;
    }
    const control = elements.publicForm.querySelector(`[name="${field.id}"]`);
    answers[field.id] = control ? control.value : "";
  });

  const emailInput = elements.publicForm.querySelector('[name="respondentEmail"]');
  return {
    slug: form.slug,
    respondentEmail: emailInput ? emailInput.value.trim() : "",
    clientToken: publicClientToken(form.slug),
    answers,
  };
}

async function submitPublicForm(event) {
  event.preventDefault();
  if (!state.publicForm?.isPublished) return;
  elements.publicSubmit.disabled = true;
  showPublicMessage("");
  try {
    const payload = await apiRequest(`${API.forms}?public=1&slug=${encodeURIComponent(state.publicForm.slug)}`, {
      method: "POST",
      body: JSON.stringify(collectPublicAnswers()),
    });
    elements.publicFields.innerHTML = "";
    elements.publicSubmit.classList.add("hidden");
    showPublicMessage(payload.message || "Reponse envoyee.", "success");
  } catch (error) {
    showPublicMessage(error.message, "error");
  } finally {
    elements.publicSubmit.disabled = false;
  }
}

function bindEvents() {
  elements.newFormButton.addEventListener("click", () => createForm());
  elements.emptyNewForm.addEventListener("click", () => createForm());
  elements.refreshButton.addEventListener("click", () => loadForms().catch((error) => showMessage(error.message, "error")));
  elements.logoutButton.addEventListener("click", async () => {
    await apiRequest(API.auth, { method: "DELETE" }).catch(() => {});
    redirectToOceanOS();
  });
  elements.saveFormButton.addEventListener("click", () => saveCurrentForm());
  elements.duplicateButton.addEventListener("click", () => duplicateCurrentForm().catch((error) => showMessage(error.message, "error")));
  elements.deleteFormButton.addEventListener("click", () => deleteCurrentForm().catch((error) => showMessage(error.message, "error")));
  elements.copyLinkButton.addEventListener("click", () => copyPublicLink());
  elements.addFieldButton.addEventListener("click", () => {
    if (!state.currentForm) return;
    state.currentForm.fields.push(defaultField(elements.newFieldType.value));
    renderFieldsEditor();
  });
  [
    elements.formTitle,
    elements.formDescription,
    elements.formSlug,
    elements.formStatus,
    elements.collectEmail,
    elements.confirmationMessage,
  ].forEach((element) => {
    element.addEventListener("input", () => {
      updateFormFromControls();
      renderEditorHeader();
    });
    element.addEventListener("change", () => {
      updateFormFromControls();
      renderEditorHeader();
    });
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab || "design";
      updateTab();
    });
  });
  elements.reloadResponsesButton.addEventListener("click", () => loadResponses().catch((error) => showMessage(error.message, "error")));
  elements.publicForm.addEventListener("submit", submitPublicForm);
}

async function boot() {
  bindEvents();
  setView("loading");
  const slug = new URLSearchParams(window.location.search).get("form");
  try {
    if (slug) {
      await loadPublicForm(slug);
      return;
    }

    const ok = await fetchAuth();
    if (!ok) return;
    await loadForms();
    installOceanOSReturnButton();
    setView("workspace");
  } catch (error) {
    if (slug) {
      setView("public");
      elements.publicTitle.textContent = "Formulaire indisponible";
      elements.publicDescription.textContent = "";
      elements.publicFields.innerHTML = "";
      elements.publicSubmit.classList.add("hidden");
      showPublicMessage(error.message || "Formulaire indisponible.", "error");
      return;
    }
    showMessage(error.message || "Formcean est indisponible.", "error");
    setView("workspace");
  }
}

boot();
