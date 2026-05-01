const API_URL = "api/events.php";
const AUTH_URL = "/OceanOS/api/auth.php";

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  currentUser: $("current-user"),
  periodPill: $("period-pill"),
  logoutButton: $("logout-button"),
  todayButton: $("today-button"),
  exportButton: $("export-button"),
  newEventButton: $("new-event-button"),
  message: $("app-message"),
  metricWeek: $("metric-week"),
  metricMeetings: $("metric-meetings"),
  metricModules: $("metric-modules"),
  metricUrgent: $("metric-urgent"),
  searchInput: $("search-input"),
  moduleFilter: $("module-filter"),
  statusFilter: $("status-filter"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  listTitle: $("list-title"),
  resultCount: $("result-count"),
  agendaList: $("agenda-list"),
  calendarTitle: $("calendar-title"),
  calendarGrid: $("calendar-grid"),
  previousMonth: $("previous-month"),
  nextMonth: $("next-month"),
  formPanel: $("event-form-panel"),
  formTitle: $("form-title"),
  cancelEditButton: $("cancel-edit-button"),
  form: $("event-form"),
  title: $("event-title"),
  category: $("event-category"),
  priority: $("event-priority"),
  allDay: $("event-all-day"),
  start: $("event-start"),
  end: $("event-end"),
  location: $("event-location"),
  description: $("event-description"),
  createMeeting: $("event-create-meeting"),
  attendeeList: $("attendee-list"),
  attendeeCount: $("attendee-count"),
  saveButton: $("save-event-button"),
  settingsList: $("settings-list"),
  saveSettingsButton: $("save-settings-button"),
};

const state = {
  currentUser: null,
  users: [],
  events: [],
  moduleTasks: [],
  items: [],
  settings: null,
  settingsCatalog: {},
  activeView: "list",
  currentMonth: startOfMonth(new Date()),
  editingId: null,
};

function setVisible(ready) {
  elements.loadingView.classList.toggle("hidden", ready);
  elements.appView.classList.toggle("hidden", !ready);
}

function showMessage(message = "", type = "") {
  elements.message.textContent = message;
  elements.message.dataset.type = type;
  elements.message.classList.toggle("hidden", message === "");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "Requete impossible.");
  }
  return payload;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toDatetimeLocal(value) {
  const date = parseDate(value);
  if (!date) return "";
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateInput(value) {
  const date = parseDate(value);
  return date ? dateKey(date) : "";
}

function defaultStartLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (date.getMinutes() === 0) date.setHours(date.getHours() + 1);
  return toDatetimeLocal(date.toISOString());
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return "Sans date";
  return new Intl.DateTimeFormat("fr-FR", options).format(date);
}

function formatItemTime(item) {
  if (!item.startsAt) return "Sans date";
  if (item.allDay) {
    return formatDate(item.startsAt, { weekday: "short", day: "2-digit", month: "short" });
  }
  return formatDate(item.startsAt, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayRange(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return [start, end];
}

function isDone(item) {
  return item.status === "done" || item.status === "cancelled";
}

function itemMatchesStatus(item) {
  const status = elements.statusFilter.value;
  if (status === "all") return true;
  if (status === "done") return isDone(item);
  if (status === "meetings") return item.category === "meeting";
  if (status === "external") return Boolean(item.external);
  return !isDone(item);
}

function visibleItems() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const module = elements.moduleFilter.value;
  return state.items.filter((item) => {
    if (module && item.module !== module) return false;
    if (!itemMatchesStatus(item)) return false;
    if (!query) return true;
    return [item.title, item.description, item.module, item.location]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function moduleClass(module) {
  return `module-${String(module || "agenda").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function renderIdentity(payload) {
  state.currentUser = payload.currentUser || null;
  const user = state.currentUser || {};
  elements.currentUser.textContent = user.displayName || user.email || "Utilisateur";
}

function renderModuleFilter() {
  const modules = Array.from(new Set(state.items.map((item) => item.module || "Agenda"))).sort();
  const current = elements.moduleFilter.value;
  elements.moduleFilter.innerHTML = '<option value="">Toutes</option>';
  modules.forEach((module) => {
    const option = document.createElement("option");
    option.value = module;
    option.textContent = module;
    option.selected = module === current;
    elements.moduleFilter.appendChild(option);
  });
}

function settingsCatalogEntries() {
  return Object.entries(state.settingsCatalog || {});
}

function moduleSettings(moduleKey) {
  return state.settings?.modules?.[moduleKey] || {};
}

function updateSettingsCount(card) {
  const count = card.querySelector(".settings-count");
  if (!count) return;
  const typeInputs = Array.from(card.querySelectorAll(".settings-type-toggle"));
  const enabled = typeInputs.filter((input) => input.checked).length;
  count.textContent = `${enabled}/${typeInputs.length}`;
}

function updateSettingsCard(card, enabled) {
  card.classList.toggle("is-disabled", !enabled);
  const typeInputs = Array.from(card.querySelectorAll(".settings-type-toggle"));
  typeInputs.forEach((input) => {
    input.disabled = !enabled;
  });
  if (enabled && typeInputs.length > 0 && !typeInputs.some((input) => input.checked)) {
    typeInputs.forEach((input) => {
      input.checked = true;
    });
  }
  updateSettingsCount(card);
}

function renderSettings() {
  if (!elements.settingsList) return;
  elements.settingsList.innerHTML = "";
  const entries = settingsCatalogEntries();
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun module configurable.";
    elements.settingsList.appendChild(empty);
    return;
  }

  entries.forEach(([moduleKey, definition]) => {
    const current = moduleSettings(moduleKey);
    const typeSettings = current.types || {};
    const card = document.createElement("article");
    card.className = "settings-card";

    const head = document.createElement("div");
    head.className = "settings-card-head";
    const label = document.createElement("label");
    label.className = "settings-module-label";
    const moduleInput = document.createElement("input");
    moduleInput.type = "checkbox";
    moduleInput.className = "settings-module-toggle";
    moduleInput.dataset.module = moduleKey;
    moduleInput.checked = current.enabled !== false;
    const chip = document.createElement("span");
    chip.className = `settings-module-dot ${moduleClass(moduleKey)}`;
    chip.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = definition.label || moduleKey;
    label.append(moduleInput, chip, title);

    const count = document.createElement("span");
    count.className = "settings-count";
    head.append(label, count);

    const grid = document.createElement("div");
    grid.className = "settings-type-grid";
    Object.entries(definition.types || {}).forEach(([type, typeLabel]) => {
      const option = document.createElement("label");
      option.className = "settings-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "settings-type-toggle";
      input.dataset.module = moduleKey;
      input.dataset.type = type;
      input.checked = typeSettings[type] !== false;
      input.disabled = !moduleInput.checked;
      input.addEventListener("change", () => updateSettingsCount(card));
      const span = document.createElement("span");
      span.textContent = typeLabel;
      option.append(input, span);
      grid.appendChild(option);
    });

    moduleInput.addEventListener("change", () => updateSettingsCard(card, moduleInput.checked));
    card.append(head, grid);
    elements.settingsList.appendChild(card);
    updateSettingsCard(card, moduleInput.checked);
  });
}

function collectSettingsFromForm() {
  const settings = { modules: {} };
  settingsCatalogEntries().forEach(([moduleKey, definition]) => {
    const moduleInput = Array.from(elements.settingsList.querySelectorAll(".settings-module-toggle"))
      .find((input) => input.dataset.module === moduleKey);
    const types = {};
    Object.keys(definition.types || {}).forEach((type) => {
      const typeInput = Array.from(elements.settingsList.querySelectorAll(".settings-type-toggle"))
        .find((input) => input.dataset.module === moduleKey && input.dataset.type === type);
      types[type] = typeInput ? typeInput.checked : true;
    });
    settings.modules[moduleKey] = {
      enabled: moduleInput ? moduleInput.checked : true,
      types,
    };
  });
  return settings;
}

function renderMetrics() {
  const [start, end] = todayRange(7);
  const upcoming = state.items.filter((item) => {
    const date = parseDate(item.startsAt);
    return date && date >= start && date <= end && !isDone(item);
  });
  elements.metricWeek.textContent = String(upcoming.length);
  elements.metricMeetings.textContent = String(state.items.filter((item) => item.category === "meeting" && !isDone(item)).length);
  elements.metricModules.textContent = String(state.moduleTasks.length);
  elements.metricUrgent.textContent = String(state.items.filter((item) => ["urgent", "high"].includes(item.priority) && !isDone(item)).length);
}

function renderList() {
  const items = visibleItems();
  elements.resultCount.textContent = `${items.length} element${items.length > 1 ? "s" : ""}`;
  elements.listTitle.textContent = elements.statusFilter.options[elements.statusFilter.selectedIndex]?.textContent || "Agenda";
  elements.agendaList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun element pour ces filtres.";
    elements.agendaList.appendChild(empty);
    return;
  }

  const groups = new Map();
  items.forEach((item) => {
    const date = parseDate(item.startsAt);
    const key = date ? dateKey(date) : "none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  groups.forEach((groupItems, key) => {
    const group = document.createElement("section");
    group.className = "agenda-group";
    const title = document.createElement("h3");
    title.textContent = key === "none"
      ? "Sans date"
      : formatDate(`${key} 12:00:00`, { weekday: "long", day: "2-digit", month: "long" });
    group.appendChild(title);
    groupItems.forEach((item) => group.appendChild(renderItemCard(item)));
    elements.agendaList.appendChild(group);
  });
}

function renderItemCard(item) {
  const card = document.createElement("article");
  card.className = `agenda-item ${item.external ? "is-external" : ""} ${isDone(item) ? "is-done" : ""}`;
  card.dataset.uid = item.uid || item.id;

  const head = document.createElement("div");
  head.className = "item-head";
  const module = document.createElement("span");
  module.className = `module-chip ${moduleClass(item.module)}`;
  module.textContent = item.module || "Agenda";
  const time = document.createElement("span");
  time.className = "item-time";
  time.textContent = formatItemTime(item);
  head.append(module, time);

  const title = document.createElement("h4");
  title.textContent = item.title || "Element";

  const meta = document.createElement("div");
  meta.className = "item-meta";
  const priority = document.createElement("span");
  priority.className = `priority ${item.priority || "normal"}`;
  priority.textContent = priorityLabel(item.priority);
  meta.appendChild(priority);
  if (item.location) {
    const location = document.createElement("span");
    location.textContent = item.location;
    meta.appendChild(location);
  }
  if (Array.isArray(item.attendees) && item.attendees.length > 0) {
    const attendees = document.createElement("span");
    attendees.textContent = `${item.attendees.length} participant${item.attendees.length > 1 ? "s" : ""}`;
    meta.appendChild(attendees);
  }

  const description = document.createElement("p");
  description.className = "item-description";
  description.textContent = item.description || "";
  description.hidden = !item.description;

  const actions = document.createElement("div");
  actions.className = "item-actions";
  if (item.meetOceanJoinUrl) {
    actions.appendChild(actionLink("Rejoindre", item.meetOceanJoinUrl, "primary-link"));
  }
  if (item.actionUrl && item.external) {
    actions.appendChild(actionLink("Ouvrir", item.actionUrl));
  }
  if (!item.external) {
    const edit = document.createElement("button");
    edit.className = "ghost-button compact-button";
    edit.type = "button";
    edit.textContent = "Modifier";
    edit.addEventListener("click", () => startEditing(item));
    actions.appendChild(edit);

    const done = document.createElement("button");
    done.className = "ghost-button compact-button";
    done.type = "button";
    done.textContent = item.status === "done" ? "Rouvrir" : "Terminer";
    done.addEventListener("click", () => setEventStatus(item, item.status === "done" ? "planned" : "done"));
    actions.appendChild(done);

    const remove = document.createElement("button");
    remove.className = "ghost-button compact-button danger-text";
    remove.type = "button";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", () => deleteEvent(item));
    actions.appendChild(remove);
  }

  card.append(head, title, meta, description, actions);
  return card;
}

function actionLink(label, href, className = "") {
  const link = document.createElement("a");
  link.className = `ghost-link ${className}`.trim();
  link.href = href;
  link.textContent = label;
  return link;
}

function priorityLabel(priority) {
  if (priority === "urgent") return "Urgent";
  if (priority === "high") return "Haute";
  if (priority === "low") return "Basse";
  return "Normale";
}

function renderCalendar() {
  const month = state.currentMonth;
  elements.calendarTitle.textContent = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month);
  elements.periodPill.textContent = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month);
  elements.calendarGrid.innerHTML = "";

  ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].forEach((day) => {
    const label = document.createElement("div");
    label.className = "calendar-weekday";
    label.textContent = day;
    elements.calendarGrid.appendChild(label);
  });

  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(first.getDate() - offset);
  const items = visibleItems();
  const byDay = new Map();
  items.forEach((item) => {
    const date = parseDate(item.startsAt);
    if (!date) return;
    const key = dateKey(date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  });

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(cursor);
    const key = dateKey(cellDate);
    const cell = document.createElement("article");
    cell.className = "calendar-day";
    if (cellDate.getMonth() !== month.getMonth()) cell.classList.add("muted");
    if (key === dateKey(new Date())) cell.classList.add("today");

    const number = document.createElement("strong");
    number.textContent = String(cellDate.getDate());
    cell.appendChild(number);

    (byDay.get(key) || []).slice(0, 4).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `calendar-event ${item.priority || "normal"}`;
      button.textContent = item.title || "Element";
      button.title = `${item.module || "Agenda"} - ${item.title || ""}`;
      button.addEventListener("click", () => focusItemInList(item));
      cell.appendChild(button);
    });
    const overflow = (byDay.get(key) || []).length - 4;
    if (overflow > 0) {
      const more = document.createElement("span");
      more.className = "calendar-more";
      more.textContent = `+${overflow}`;
      cell.appendChild(more);
    }

    elements.calendarGrid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }
}

function focusItemInList(item) {
  showView("list");
  window.setTimeout(() => {
    const node = elements.agendaList.querySelector(`[data-uid="${CSS.escape(item.uid || String(item.id))}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("pulse");
    window.setTimeout(() => node.classList.remove("pulse"), 1200);
  }, 50);
}

function renderAttendees(selectedIds = []) {
  const selected = new Set(selectedIds.map((id) => Number(id)));
  elements.attendeeList.innerHTML = "";
  state.users.forEach((user) => {
    const label = document.createElement("label");
    label.className = "attendee-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(user.id);
    input.checked = selected.has(Number(user.id)) || user.id === state.currentUser?.id;
    input.disabled = user.id === state.currentUser?.id;
    input.addEventListener("change", updateAttendeeCount);
    const name = document.createElement("span");
    name.textContent = user.displayName || user.email;
    label.append(input, name);
    elements.attendeeList.appendChild(label);
  });
  updateAttendeeCount();
}

function selectedAttendeeIds() {
  return Array.from(elements.attendeeList.querySelectorAll("input:checked")).map((input) => Number(input.value));
}

function updateAttendeeCount() {
  elements.attendeeCount.textContent = String(selectedAttendeeIds().length);
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  syncAllDayInputs();
  elements.formTitle.textContent = "Nouvel element";
  elements.saveButton.textContent = "Ajouter";
  elements.cancelEditButton.classList.add("hidden");
  elements.start.value = defaultStartLocal();
  elements.end.value = "";
  elements.category.value = "task";
  elements.priority.value = "normal";
  elements.createMeeting.checked = false;
  renderAttendees([state.currentUser?.id].filter(Boolean));
}

function startEditing(item) {
  state.editingId = Number(item.id);
  elements.formTitle.textContent = "Modifier";
  elements.saveButton.textContent = "Enregistrer";
  elements.cancelEditButton.classList.remove("hidden");
  elements.title.value = item.title || "";
  elements.category.value = item.category || "task";
  elements.priority.value = item.priority || "normal";
  elements.allDay.checked = Boolean(item.allDay);
  syncAllDayInputs();
  elements.start.value = item.allDay ? toDateInput(item.startsAt) : toDatetimeLocal(item.startsAt);
  elements.end.value = item.allDay ? toDateInput(item.endsAt) : toDatetimeLocal(item.endsAt);
  elements.location.value = item.location || "";
  elements.description.value = item.description || "";
  elements.createMeeting.checked = Boolean(item.meetOceanJoinUrl);
  renderAttendees(item.attendeeUserIds || []);
  elements.formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.title.focus();
}

function applyPayload(payload) {
  state.users = Array.isArray(payload.users) ? payload.users : [];
  state.events = Array.isArray(payload.events) ? payload.events : [];
  state.moduleTasks = Array.isArray(payload.moduleTasks) ? payload.moduleTasks : [];
  state.items = Array.isArray(payload.items) ? payload.items : [];
  state.settings = payload.settings || null;
  state.settingsCatalog = payload.settingsCatalog || {};
  renderIdentity(payload);
  renderModuleFilter();
  renderMetrics();
  renderAttendees([state.currentUser?.id].filter(Boolean));
  renderSettings();
  renderAll();
}

function renderAll() {
  renderList();
  renderCalendar();
}

function showView(view) {
  state.activeView = view;
  elements.viewTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
  elements.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== view);
  });
}

async function loadAgenda() {
  const payload = await requestJson(API_URL);
  applyPayload(payload);
  resetForm();
  setVisible(true);
}

async function saveEvent(event) {
  event.preventDefault();
  elements.saveButton.disabled = true;
  showMessage("");
  try {
    const payload = {
      action: state.editingId ? "update_event" : "create_event",
      id: state.editingId,
      title: elements.title.value.trim(),
      category: elements.category.value,
      priority: elements.priority.value,
      allDay: elements.allDay.checked,
      startsAt: elements.start.value,
      endsAt: elements.end.value,
      location: elements.location.value.trim(),
      description: elements.description.value.trim(),
      createMeeting: elements.createMeeting.checked,
      attendeeUserIds: selectedAttendeeIds(),
    };
    const response = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    applyPayload(response);
    resetForm();
    showMessage(response.message || "Agenda mis a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Enregistrement impossible.", "error");
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function saveSettings() {
  if (!elements.saveSettingsButton) return;
  elements.saveSettingsButton.disabled = true;
  showMessage("");
  try {
    const response = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "save_settings",
        settings: collectSettingsFromForm(),
      }),
    });
    applyPayload(response);
    showMessage(response.message || "Parametres enregistres.", "success");
  } catch (error) {
    showMessage(error.message || "Enregistrement des parametres impossible.", "error");
  } finally {
    elements.saveSettingsButton.disabled = false;
  }
}

async function setEventStatus(item, status) {
  try {
    const response = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "set_status", id: item.id, status }),
    });
    applyPayload(response);
    showMessage(response.message || "Statut mis a jour.", "success");
  } catch (error) {
    showMessage(error.message || "Mise a jour impossible.", "error");
  }
}

async function deleteEvent(item) {
  if (!window.confirm(`Supprimer "${item.title || "cet evenement"}" ?`)) return;
  try {
    const response = await requestJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete_event", id: item.id }),
    });
    applyPayload(response);
    resetForm();
    showMessage(response.message || "Evenement supprime.", "success");
  } catch (error) {
    showMessage(error.message || "Suppression impossible.", "error");
  }
}

function exportIcs() {
  const items = visibleItems().filter((item) => item.startsAt);
  if (items.length === 0) {
    showMessage("Aucun element date a exporter.", "error");
    return;
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OceanOS//Agenda//FR",
    ...items.map(itemToIcs).flat(),
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agenda-oceanos-${dateKey(new Date())}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
  showMessage(`${items.length} element${items.length > 1 ? "s" : ""} exporte${items.length > 1 ? "s" : ""}.`, "success");
}

function itemToIcs(item) {
  const start = parseDate(item.startsAt);
  const end = parseDate(item.endsAt) || new Date(start.getTime() + 30 * 60 * 1000);
  const allDayEnd = new Date(start);
  allDayEnd.setDate(allDayEnd.getDate() + 1);
  const stamp = icsDate(new Date());
  const description = [item.description || "", item.meetOceanJoinUrl || item.actionUrl || ""].filter(Boolean).join("\\n");
  return [
    "BEGIN:VEVENT",
    `UID:${String(item.uid || item.id).replace(/[^a-zA-Z0-9_.:-]/g, "-")}@oceanos-agenda`,
    `DTSTAMP:${stamp}`,
    item.allDay ? `DTSTART;VALUE=DATE:${dateKey(start).replaceAll("-", "")}` : `DTSTART:${icsDate(start)}`,
    item.allDay ? `DTEND;VALUE=DATE:${dateKey(allDayEnd).replaceAll("-", "")}` : `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(item.title || "Agenda")}`,
    description ? `DESCRIPTION:${icsEscape(description)}` : "",
    item.location ? `LOCATION:${icsEscape(item.location)}` : "",
    "END:VEVENT",
  ].filter(Boolean);
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

async function logout() {
  try {
    await fetch(AUTH_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {}
  window.location.href = "/OceanOS/";
}

function bindEvents() {
  elements.form.addEventListener("submit", saveEvent);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.saveSettingsButton?.addEventListener("click", () => void saveSettings());
  elements.newEventButton.addEventListener("click", () => {
    resetForm();
    elements.formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.title.focus();
  });
  elements.todayButton.addEventListener("click", () => {
    state.currentMonth = startOfMonth(new Date());
    elements.statusFilter.value = "open";
    renderAll();
  });
  elements.exportButton.addEventListener("click", exportIcs);
  elements.previousMonth.addEventListener("click", () => {
    state.currentMonth = addMonths(state.currentMonth, -1);
    renderCalendar();
  });
  elements.nextMonth.addEventListener("click", () => {
    state.currentMonth = addMonths(state.currentMonth, 1);
    renderCalendar();
  });
  elements.searchInput.addEventListener("input", renderAll);
  elements.moduleFilter.addEventListener("change", renderAll);
  elements.statusFilter.addEventListener("change", renderAll);
  elements.category.addEventListener("change", () => {
    if (elements.category.value === "meeting") {
      elements.createMeeting.checked = true;
    }
  });
  elements.allDay.addEventListener("change", () => {
    syncAllDayInputs();
  });
  elements.logoutButton.addEventListener("click", () => void logout());
  elements.viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view || "list"));
  });
}

function syncAllDayInputs() {
  elements.start.type = elements.allDay.checked ? "date" : "datetime-local";
  elements.end.type = elements.allDay.checked ? "date" : "datetime-local";
}

bindEvents();
loadAgenda().catch((error) => {
  setVisible(true);
  showMessage(error.message || "Chargement impossible.", "error");
});
