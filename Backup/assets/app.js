const API_URL = "/Backup/api/backup.php";
const AUTH_URL = "/OceanOS/api/auth.php";
const OCEANOS_URL = "/OceanOS/";

const $ = (id) => document.getElementById(id);

const elements = {
  currentUser: $("current-user"),
  logoutButton: $("logout-button"),
  appMessage: $("app-message"),
  metricCount: $("metric-count"),
  metricSize: $("metric-size"),
  metricLast: $("metric-last"),
  metricNext: $("metric-next"),
  wwwRoot: $("www-root"),
  backupDirectory: $("backup-directory"),
  zipRequirement: $("zip-requirement"),
  refreshButton: $("refresh-button"),
  createBackupButton: $("create-backup-button"),
  runState: $("run-state"),
  scheduleForm: $("schedule-form"),
  scheduleEnabled: $("schedule-enabled"),
  scheduleFrequency: $("schedule-frequency"),
  scheduleTime: $("schedule-time"),
  scheduleWeekday: $("schedule-weekday"),
  scheduleMonthday: $("schedule-monthday"),
  retentionCount: $("retention-count"),
  weekdayField: $("weekday-field"),
  monthdayField: $("monthday-field"),
  saveScheduleButton: $("save-schedule-button"),
  runScheduledButton: $("run-scheduled-button"),
  cronCommand: $("cron-command"),
  copyCronButton: $("copy-cron-button"),
  backupList: $("backup-list"),
};

const state = {
  loading: false,
  backups: [],
  schedule: null,
};

function showMessage(message, type = "info") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", !message);
}

function setBusy(isBusy, label = "Traitement...") {
  state.loading = isBusy;
  elements.createBackupButton.disabled = isBusy;
  elements.refreshButton.disabled = isBusy;
  elements.saveScheduleButton.disabled = isBusy;
  elements.runScheduledButton.disabled = isBusy;
  elements.runState.textContent = isBusy ? label : "Pret";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "Erreur Backup.");
  }
  return payload;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function backupLabel(backup) {
  const date = formatDate(backup.createdAt);
  return date || backup.fileName || "Backup";
}

function updateScheduleVisibility() {
  const frequency = elements.scheduleFrequency.value;
  elements.weekdayField.classList.toggle("hidden", frequency !== "weekly");
  elements.monthdayField.classList.toggle("hidden", frequency !== "monthly");
}

function renderScheduleControls() {
  const schedule = state.schedule;
  if (!schedule) return;

  elements.scheduleEnabled.checked = Boolean(schedule.enabled);
  elements.scheduleFrequency.value = schedule.frequency || "daily";
  elements.scheduleTime.value = schedule.time || "02:00";
  elements.scheduleWeekday.value = String(schedule.weekday || 1);
  elements.scheduleMonthday.value = String(schedule.monthday || 1);
  elements.retentionCount.value = String(schedule.retentionCount || 12);
  elements.cronCommand.textContent = schedule.cronCommand || "";
  updateScheduleVisibility();
}

function renderMetrics(payload) {
  const backups = payload.backups || [];
  const totals = payload.totals || {};
  const schedule = payload.schedule || {};
  const last = backups[0] || null;

  elements.metricCount.textContent = String(totals.count || backups.length || 0);
  elements.metricSize.textContent = formatBytes(totals.bytes || 0);
  elements.metricLast.textContent = last ? formatDate(last.createdAt) : "Aucun";
  elements.metricNext.textContent = schedule.enabled ? (formatDate(schedule.nextRunAt) || "En attente") : "Desactive";
  elements.wwwRoot.textContent = payload.paths?.wwwRoot || "-";
  elements.backupDirectory.textContent = payload.paths?.backupDirectory || "-";
  elements.zipRequirement.textContent = payload.requirements?.zipArchive ? "Disponible" : "Manquant";
  elements.zipRequirement.dataset.type = payload.requirements?.zipArchive ? "success" : "error";
}

function renderBackups() {
  elements.backupList.innerHTML = "";
  if (state.backups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun backup disponible.";
    elements.backupList.appendChild(empty);
    return;
  }

  state.backups.forEach((backup) => {
    const item = document.createElement("article");
    item.className = "backup-item";

    const info = document.createElement("div");
    info.className = "backup-info";
    const title = document.createElement("strong");
    title.textContent = backupLabel(backup);
    const meta = document.createElement("span");
    const method = backup.databaseDumpMethod ? `SQL ${backup.databaseDumpMethod}` : "SQL";
    meta.textContent = `${formatBytes(backup.size)} - ${backup.filesCount || 0} fichiers - ${method}`;
    info.append(title, meta);

    if (backup.databaseDumpWarning) {
      const warning = document.createElement("small");
      warning.className = "backup-warning";
      warning.textContent = backup.databaseDumpWarning;
      info.appendChild(warning);
    }

    const actions = document.createElement("div");
    actions.className = "backup-actions";
    const download = document.createElement("a");
    download.className = "ghost-link";
    download.href = backup.downloadUrl;
    download.textContent = "Telecharger";
    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.type = "button";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", () => deleteBackup(backup));
    actions.append(download, remove);

    item.append(info, actions);
    elements.backupList.appendChild(item);
  });
}

function applyPayload(payload) {
  state.backups = Array.isArray(payload.backups) ? payload.backups : [];
  state.schedule = payload.schedule || null;
  if (payload.currentUser?.displayName) {
    elements.currentUser.textContent = payload.currentUser.displayName;
  }
  renderMetrics(payload);
  renderScheduleControls();
  renderBackups();
}

async function loadStatus() {
  const payload = await fetchJson(API_URL);
  applyPayload(payload);
}

async function createBackup() {
  if (state.loading) return;
  const confirmed = window.confirm("Creer un backup complet maintenant ?");
  if (!confirmed) return;

  setBusy(true, "Backup en cours...");
  showMessage("Creation du backup en cours.", "info");
  try {
    const payload = await fetchJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "create" }),
    });
    applyPayload(payload);
    showMessage(payload.message || "Backup cree.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function schedulePayload() {
  return {
    enabled: elements.scheduleEnabled.checked,
    frequency: elements.scheduleFrequency.value,
    time: elements.scheduleTime.value || "02:00",
    weekday: Number(elements.scheduleWeekday.value || 1),
    monthday: Number(elements.scheduleMonthday.value || 1),
    retentionCount: Number(elements.retentionCount.value || 12),
  };
}

async function saveSchedule(event) {
  event.preventDefault();
  if (state.loading) return;

  setBusy(true, "Enregistrement...");
  try {
    const payload = await fetchJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "save_schedule", schedule: schedulePayload() }),
    });
    applyPayload(payload);
    showMessage(payload.message || "Planification enregistree.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function runScheduledNow() {
  if (state.loading) return;
  setBusy(true, "Cron en cours...");
  try {
    const payload = await fetchJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "run_scheduled" }),
    });
    applyPayload(payload);
    const run = payload.scheduledRun || {};
    showMessage(run.ran ? "Backup planifie execute." : run.message || "Aucun backup planifie.", run.ran ? "success" : "info");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function deleteBackup(backup) {
  if (state.loading) return;
  const confirmed = window.confirm(`Supprimer ${backup.fileName} ?`);
  if (!confirmed) return;

  setBusy(true, "Suppression...");
  try {
    const payload = await fetchJson(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete", fileName: backup.fileName }),
    });
    applyPayload(payload);
    showMessage(payload.message || "Backup supprime.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function copyCronCommand() {
  const command = elements.cronCommand.textContent.trim();
  if (!command) return;
  try {
    await navigator.clipboard.writeText(command);
    showMessage("Commande cron copiee.", "success");
  } catch (error) {
    showMessage(command, "info");
  }
}

async function logout() {
  elements.logoutButton.disabled = true;
  try {
    await fetch(AUTH_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {}
  window.location.href = OCEANOS_URL;
}

elements.createBackupButton.addEventListener("click", createBackup);
elements.refreshButton.addEventListener("click", () => {
  void loadStatus().catch((error) => showMessage(error.message, "error"));
});
elements.scheduleForm.addEventListener("submit", saveSchedule);
elements.scheduleFrequency.addEventListener("change", updateScheduleVisibility);
elements.runScheduledButton.addEventListener("click", runScheduledNow);
elements.copyCronButton.addEventListener("click", copyCronCommand);
elements.logoutButton.addEventListener("click", logout);

void loadStatus().catch((error) => showMessage(error.message, "error"));
