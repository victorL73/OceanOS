const AUTH_URL = "/OceanOS/api/auth.php";
const USERS_URL = "/OceanOS/api/users.php";
const AI_URL = "/OceanOS/api/ai.php";
const PRESTASHOP_URL = "/OceanOS/api/prestashop.php";
const COMPANY_URL = "/OceanOS/api/company.php";
  const SERVICES_URL = "/OceanOS/api/services.php?v=20260503-git-revision-pill";

const apps = [
  {
    id: "agenda",
    title: "Agenda",
    subtitle: "Calendrier personnel, taches modules et reunions MeetOcean.",
    href: "/Agenda/",
    mark: "AG",
    color: "#2d8f7b",
  },
  {
    id: "flowcean",
    title: "Flowcean",
    subtitle: "Workspace, notes, espaces et collaboration.",
    href: "/Flowcean/",
    mark: "FL",
    color: "#38a3ff",
  },
  {
    id: "invocean",
    title: "Invocean",
    subtitle: "Factures, exports et synchronisation PrestaShop.",
    href: "/Invocean/",
    mark: "IN",
    color: "#1fd1b2",
  },
  {
    id: "devis",
    title: "Devis",
    subtitle: "Devis PDF connectes aux produits PrestaShop.",
    href: "/Devis/",
    mark: "DV",
    color: "#35b6e8",
  },
  {
    id: "commandes",
    title: "Commandes",
    subtitle: "Commandes PrestaShop, details, clients et changements de statut.",
    href: "/Commandes/",
    mark: "CO",
    color: "#7ed66f",
  },
  {
    id: "sav",
    title: "SAV",
    subtitle: "Demandes clients PrestaShop, conversations et reponses support.",
    href: "/SAV/",
    mark: "SV",
    color: "#ff8a5b",
  },
  {
    id: "stockcean",
    title: "Stockcean",
    subtitle: "Stocks, achats et fournisseurs connectes a PrestaShop.",
    href: "/Stockcean/",
    mark: "ST",
    color: "#7ed66f",
  },
  {
    id: "tresorcean",
    title: "Tresorcean",
    subtitle: "Finance, tresorerie, benefices et TVA.",
    href: "/Tresorcean/",
    mark: "TR",
    color: "#256fbd",
  },
  {
    id: "nauticrm",
    title: "NautiCRM",
    subtitle: "CRM clients, contacts, relances et opportunites.",
    href: "/NautiCRM/",
    mark: "CRM",
    color: "#087d79",
  },
  {
    id: "nautimail",
    title: "NautiMail",
    subtitle: "Boites mail partagees, tri IA et reponses client.",
    href: "/NautiMail/",
    mark: "NM",
    color: "#2f6fb3",
  },
  {
    id: "nautipost",
    title: "NautiPost",
    subtitle: "Campagnes, messages et outils marketing.",
    href: "/NautiPost/",
    mark: "NP",
    color: "#ff8a5b",
  },
  {
    id: "nauticloud",
    title: "NautiCloud",
    subtitle: "Drive partage, apercus et edition en temps reel.",
    href: "/NautiCloud/",
    mark: "NC",
    color: "#087d79",
  },
  {
    id: "formcean",
    title: "Formcean",
    subtitle: "Formulaires, liens publics et analyse des reponses.",
    href: "/Formcean/",
    mark: "FO",
    color: "#d8c45f",
  },
  {
    id: "nautisign",
    title: "Nautisign",
    subtitle: "Signature de devis PDF avec liens publics.",
    href: "/Nautisign/",
    mark: "NS",
    color: "#36c9b6",
  },
  {
    id: "naviplan",
    title: "Naviplan",
    subtitle: "Agenda administratif, fiscal, social et juridique.",
    href: "/Naviplan/",
    mark: "NV",
    color: "#1a9d91",
  },
  {
    id: "visiocean",
    title: "SeoCean",
    subtitle: "Google Analytics, Search Console, SEO et recommandations.",
    href: "/SeoCean/",
    mark: "SC",
    color: "#168f83",
  },
  {
    id: "meetocean",
    title: "MeetOcean",
    subtitle: "Visioconference, transcription et traduction temps reel.",
    href: "/MeetOcean/",
    mark: "ME",
    color: "#2f6fb3",
  },
  {
    id: "admin",
    title: "Admin serveur",
    subtitle: "Configuration initiale, BDD et super-utilisateurs.",
    href: "/admin/",
    mark: "AD",
    color: "#9adf68",
    superOnly: true,
  },
  {
    id: "backup",
    title: "Backup",
    subtitle: "ZIP du dossier www et export complet de la BDD.",
    href: "/Backup/",
    mark: "BA",
    color: "#2fd0b5",
    superOnly: true,
  },
];

const $ = (id) => document.getElementById(id);

const elements = {
  shell: document.querySelector(".shell"),
  loadingView: $("loading-view"),
  loginView: $("login-view"),
  dashboardView: $("dashboard-view"),
  form: $("auth-form"),
  nameField: $("name-field"),
  displayName: $("display-name"),
  email: $("email"),
  password: $("password"),
  submitButton: $("submit-button"),
  message: $("form-message"),
  authKicker: $("auth-kicker"),
  authTitle: $("auth-title"),
  authSubtitle: $("auth-subtitle"),
  userChip: $("user-chip"),
  logoutButton: $("logout-button"),
  userMenu: $("user-menu"),
  userMenuBackdrop: $("user-menu-backdrop"),
  closeUserMenu: $("close-user-menu"),
  userTabAdmin: $("user-tab-admin"),
  userTabCompany: $("user-tab-company"),
  userTabPrestashop: $("user-tab-prestashop"),
  userTabServices: $("user-tab-services"),
  menuUserAvatar: $("menu-user-avatar"),
  menuUserName: $("menu-user-name"),
  menuUserEmail: $("menu-user-email"),
  menuUserRole: $("menu-user-role"),
  menuAdminPageButton: $("menu-admin-page-button"),
  menuLogoutButton: $("menu-logout-button"),
  aiForm: $("ai-form"),
  aiModel: $("ai-model"),
  aiKey: $("ai-key"),
  saveAiButton: $("save-ai-button"),
  testAiButton: $("test-ai-button"),
  deleteAiButton: $("delete-ai-button"),
  aiStatus: $("ai-status"),
  prestashopForm: $("prestashop-form"),
  prestashopShopUrl: $("prestashop-shop-url"),
  prestashopKey: $("prestashop-key"),
  prestashopClearKey: $("prestashop-clear-key"),
  prestashopSyncWindowDays: $("prestashop-sync-window-days"),
  savePrestashopButton: $("save-prestashop-button"),
  testPrestashopButton: $("test-prestashop-button"),
  deletePrestashopButton: $("delete-prestashop-button"),
  prestashopStatus: $("prestashop-status"),
  companyForm: $("company-form"),
  companyName: $("company-name"),
  companyPhone: $("company-phone"),
  companyAddress: $("company-address"),
  companyCity: $("company-city"),
  companyEmail: $("company-email"),
  companySiret: $("company-siret"),
  saveCompanyButton: $("save-company-button"),
  resetCompanyButton: $("reset-company-button"),
  companyStatus: $("company-status"),
  appGrid: $("app-grid"),
  adminPanel: $("admin-panel"),
  reloadUsers: $("reload-users"),
  userCreateForm: $("user-create-form"),
  newDisplayName: $("new-display-name"),
  newEmail: $("new-email"),
  newPassword: $("new-password"),
  newRole: $("new-role"),
  newRoleSuper: $("new-role-super"),
  createUserButton: $("create-user-button"),
  usersMessage: $("users-message"),
  usersList: $("users-list"),
  servicesPanel: $("services-panel"),
  gitRevisionPill: $("git-revision-pill"),
  reloadServices: $("reload-services"),
  updateServices: $("update-services"),
  servicesStatus: $("services-status"),
  servicesList: $("services-list"),
};

let authState = {
  authenticated: false,
  needsSetup: false,
  user: null,
};
let usersState = [];
let aiSettings = null;
let prestashopSettings = null;
let companySettings = null;
let servicesState = [];
let servicesControlAvailable = false;
let servicesUpdateAvailable = false;
let servicesGitState = null;

function setVisible(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.loginView.classList.toggle("hidden", view !== "login");
  elements.dashboardView.classList.toggle("hidden", view !== "dashboard");
  elements.shell.dataset.state = view;
}

function showMessage(message = "") {
  elements.message.textContent = message;
  elements.message.classList.toggle("hidden", message === "");
}

function showUsersMessage(message = "", type = "error") {
  elements.usersMessage.textContent = message;
  elements.usersMessage.dataset.type = type;
  elements.usersMessage.classList.toggle("hidden", message === "");
}

function showAiStatus(message = "", type = "") {
  elements.aiStatus.textContent = message;
  elements.aiStatus.dataset.type = type;
}

function showPrestashopStatus(message = "", type = "") {
  elements.prestashopStatus.textContent = message;
  elements.prestashopStatus.dataset.type = type;
}

function showCompanyStatus(message = "", type = "") {
  elements.companyStatus.textContent = message;
  elements.companyStatus.dataset.type = type;
}

function showServicesStatus(message = "", type = "") {
  elements.servicesStatus.textContent = message;
  elements.servicesStatus.dataset.type = type;
}

function roleLabel(role) {
  if (role === "super") return "Super-utilisateur";
  return role === "admin" ? "Administrateur" : "Membre";
}

function updateUserMenuIdentity() {
  const user = authState.user || {};
  const label = user.displayName || user.email || "Utilisateur";
  elements.menuUserAvatar.textContent = label.slice(0, 2).toUpperCase();
  elements.menuUserName.textContent = label;
  elements.menuUserEmail.textContent = user.email || "";
  elements.menuUserRole.textContent = roleLabel(user.role);
}

function canManageUsers() {
  return Boolean(authState.user?.permissions?.canManageUsers);
}

function canManagePrestashop() {
  return Boolean(authState.user?.permissions?.canManagePrestashop || canManageUsers());
}

function canManageCompany() {
  return Boolean(authState.user?.permissions?.canManageCompany || canManageUsers());
}

function canManageServices() {
  return Boolean(authState.user?.permissions?.canManageServices || canManageUsers());
}

function canManageSuperUsers() {
  return Boolean(authState.user?.permissions?.canAccessAllWorkspaces);
}

function managedApps() {
  return apps.filter((app) => !app.superOnly);
}

function visibleModuleSet(user = authState.user) {
  const configured = Array.isArray(user?.visibleModules)
    ? user.visibleModules
    : managedApps().map((app) => app.id);
  return new Set(configured.map((moduleId) => String(moduleId || "").toLowerCase()));
}

function isProtectedAdminRole(role) {
  const normalizedRole = String(role || "member").toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "super";
}

function rightsLockedForCurrentAdmin(user) {
  return !canManageSuperUsers() && isProtectedAdminRole(user.role);
}

function canDeleteAccount(user) {
  return user.id !== authState.user?.id && !rightsLockedForCurrentAdmin(user);
}

function showUserMenuSection(sectionId = "account") {
  const canShowAdmin = canManageUsers();
  const canShowPrestashop = canManagePrestashop();
  const canShowServices = canManageServices();
  const nextSectionId =
    (sectionId === "admin" && !canShowAdmin)
    || (sectionId === "prestashop" && !canShowPrestashop)
    || (sectionId === "services" && !canShowServices)
    ? "account"
    : sectionId;

  document.querySelectorAll(".user-control-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.userTab === nextSectionId);
  });

  document.querySelectorAll(".user-menu-section").forEach((section) => {
    section.classList.toggle("active", section.dataset.userSection === nextSectionId);
  });

  if (nextSectionId === "ai") {
    void loadAiSettings();
  }
  if (nextSectionId === "company") {
    void loadCompanySettings();
  }
  if (nextSectionId === "prestashop") {
    void loadPrestashopSettings();
  }
  if (nextSectionId === "admin") {
    void loadUsers();
  }
  if (nextSectionId === "services") {
    void loadServices();
  }
}

function openUserMenu(sectionId = "account") {
  if (!authState.authenticated) return;
  updateUserMenuIdentity();
  elements.userMenu.classList.remove("hidden");
  document.body.classList.add("user-menu-open");
  showUserMenuSection(sectionId);
}

function closeUserMenu() {
  elements.userMenu.classList.add("hidden");
  document.body.classList.remove("user-menu-open");
}

function safeNext() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "";
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/OceanOS")) {
    return "";
  }
  return next;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

function applyAuthState(payload) {
  authState = {
    authenticated: Boolean(payload.authenticated),
    needsSetup: Boolean(payload.needsSetup),
    user: payload.user || null,
  };

  if (authState.authenticated) {
    const user = authState.user || {};
    elements.userChip.textContent = `${user.displayName || user.email || "Utilisateur"} - ${user.role || "membre"}`;
    updateUserMenuIdentity();
    setVisible("dashboard");
    renderApps();
    setupAdminPanel();
    void loadAiSettings();
    if (window.location.hash === "#ia") {
      openUserMenu("ai");
    } else if (window.location.hash === "#entreprise") {
      openUserMenu("company");
    } else if (window.location.hash === "#prestashop") {
      openUserMenu("prestashop");
    } else if (window.location.hash === "#services") {
      openUserMenu("services");
    }
    return;
  }

  elements.authKicker.textContent = authState.needsSetup ? "Initialisation" : "Connexion";
  elements.authTitle.textContent = authState.needsSetup ? "Creer le premier administrateur" : "Acceder a OceanOS";
  elements.authSubtitle.textContent = authState.needsSetup
    ? "Aucun compte n'existe encore. Ce compte ouvrira ensuite toutes les apps."
    : "Connectez-vous ici, puis ouvrez les apps sans vous reconnecter.";
  elements.nameField.classList.toggle("hidden", !authState.needsSetup);
  elements.password.setAttribute("autocomplete", authState.needsSetup ? "new-password" : "current-password");
  elements.submitButton.textContent = authState.needsSetup ? "Creer le compte" : "Se connecter";
  setVisible("login");
  elements.adminPanel.classList.add("hidden");
  elements.menuAdminPageButton.classList.add("hidden");
  elements.userTabPrestashop.classList.add("hidden");
  elements.userTabServices.classList.add("hidden");
  document.querySelectorAll(".admin-only-action").forEach((element) => element.classList.add("hidden"));
  document.querySelectorAll(".services-only-action").forEach((element) => element.classList.add("hidden"));
  closeUserMenu();
}

async function refreshAuth() {
  const payload = await requestJson(AUTH_URL);
  applyAuthState(payload);
}

async function loadAiSettings() {
  if (!authState.authenticated) return;

  showAiStatus("Chargement de la configuration Groq...");
  try {
    const payload = await requestJson(AI_URL);
    aiSettings = payload.settings || null;
    elements.aiModel.value = aiSettings?.model || "llama-3.3-70b-versatile";
    elements.aiKey.value = "";
    showAiStatus(
      aiSettings?.hasApiKey
        ? `Cle Groq active pour toutes les apps - modele ${elements.aiModel.value}.`
        : "Aucune cle Groq configuree. Ajoutez une cle commencant par gsk_.",
      aiSettings?.hasApiKey ? "success" : ""
    );
  } catch (error) {
    showAiStatus(error.message || "Impossible de charger la configuration IA.", "error");
  }
}

async function saveAiSettings() {
  const rawKey = elements.aiKey.value.trim();
  if (rawKey !== "" && !rawKey.startsWith("gsk_")) {
    throw new Error("La cle Groq doit commencer par gsk_.");
  }

  const payload = await requestJson(AI_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "settings",
      model: elements.aiModel.value.trim() || "llama-3.3-70b-versatile",
      ...(rawKey !== "" ? { apiKey: rawKey } : {}),
    }),
  });
  aiSettings = payload.settings || null;
  elements.aiKey.value = "";
  showAiStatus(`Configuration Groq enregistree - modele ${aiSettings?.model || elements.aiModel.value}.`, "success");
}

async function testAiSettings() {
  const payload = await requestJson(AI_URL, {
    method: "POST",
    body: JSON.stringify({ action: "test" }),
  });
  showAiStatus(payload.answer || "Connexion Groq valide.", "success");
  aiSettings = payload.settings || aiSettings;
}

async function deleteAiSettings() {
  const ok = window.confirm("Supprimer la cle Groq OceanOS ? Les apps IA ne pourront plus utiliser Groq tant qu'une nouvelle cle n'est pas enregistree.");
  if (!ok) return;

  const payload = await requestJson(AI_URL, { method: "DELETE" });
  aiSettings = payload.settings || null;
  elements.aiKey.value = "";
  elements.aiModel.value = aiSettings?.model || "llama-3.3-70b-versatile";
  showAiStatus("Configuration Groq supprimee.", "success");
}

function renderPrestashopSettings() {
  const settings = prestashopSettings || {};
  const canManage = Boolean(settings.canManage);
  elements.prestashopShopUrl.value = settings.shopUrl || "";
  elements.prestashopKey.value = "";
  elements.prestashopKey.placeholder = settings.hasWebserviceKey
    ? `Cle enregistree (${settings.webserviceKeyHint || "masquee"})`
    : "Aucune cle enregistree";
  elements.prestashopClearKey.checked = false;
  elements.prestashopSyncWindowDays.value = settings.syncWindowDays || 30;

  [
    elements.prestashopShopUrl,
    elements.prestashopKey,
    elements.prestashopClearKey,
    elements.prestashopSyncWindowDays,
    elements.savePrestashopButton,
    elements.testPrestashopButton,
    elements.deletePrestashopButton,
  ].forEach((element) => {
    element.disabled = !canManage;
  });
}

async function loadPrestashopSettings() {
  if (!authState.authenticated) return;

  showPrestashopStatus("Chargement de la configuration PrestaShop...");
  try {
    const payload = await requestJson(PRESTASHOP_URL);
    prestashopSettings = payload.settings || null;
    renderPrestashopSettings();
    showPrestashopStatus(
      prestashopSettings?.shopUrl && prestashopSettings?.hasWebserviceKey
        ? "Connecteur PrestaShop actif pour toutes les apps."
        : "Ajoutez l URL boutique et une cle Webservice PrestaShop.",
      prestashopSettings?.shopUrl && prestashopSettings?.hasWebserviceKey ? "success" : ""
    );
  } catch (error) {
    showPrestashopStatus(error.message || "Impossible de charger la configuration PrestaShop.", "error");
  }
}

async function savePrestashopSettings() {
  const payload = await requestJson(PRESTASHOP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "settings",
      shopUrl: elements.prestashopShopUrl.value.trim(),
      syncWindowDays: Number(elements.prestashopSyncWindowDays.value || 30),
      clearWebserviceKey: elements.prestashopClearKey.checked,
      ...(elements.prestashopKey.value.trim() !== "" ? { webserviceKey: elements.prestashopKey.value.trim() } : {}),
    }),
  });
  prestashopSettings = payload.settings || null;
  renderPrestashopSettings();
  showPrestashopStatus(payload.message || "Configuration PrestaShop enregistree.", "success");
}

async function testPrestashopSettings() {
  const payload = await requestJson(PRESTASHOP_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "test",
      shopUrl: elements.prestashopShopUrl.value.trim(),
      ...(elements.prestashopKey.value.trim() !== "" ? { webserviceKey: elements.prestashopKey.value.trim() } : {}),
    }),
  });
  prestashopSettings = payload.settings || prestashopSettings;
  renderPrestashopSettings();
  showPrestashopStatus(payload.message || "Connexion PrestaShop valide.", "success");
}

async function deletePrestashopSettings() {
  const ok = window.confirm("Supprimer la configuration PrestaShop OceanOS ? Les synchronisations e-commerce seront bloquees.");
  if (!ok) return;

  const payload = await requestJson(PRESTASHOP_URL, { method: "DELETE" });
  prestashopSettings = payload.settings || null;
  renderPrestashopSettings();
  showPrestashopStatus(payload.message || "Configuration PrestaShop supprimee.", "success");
}

function renderCompanySettings() {
  const settings = companySettings || {};
  const canManage = Boolean(settings.canManage);
  elements.companyName.value = settings.companyName || "";
  elements.companyPhone.value = settings.companyPhone || "";
  elements.companyAddress.value = settings.companyAddress || "";
  elements.companyCity.value = settings.companyCity || "";
  elements.companyEmail.value = settings.companyEmail || "";
  elements.companySiret.value = settings.companySiret || "";

  [
    elements.companyName,
    elements.companyPhone,
    elements.companyAddress,
    elements.companyCity,
    elements.companyEmail,
    elements.companySiret,
    elements.saveCompanyButton,
    elements.resetCompanyButton,
  ].forEach((element) => {
    element.disabled = !canManage;
  });
}

async function loadCompanySettings() {
  if (!authState.authenticated) return;

  showCompanyStatus("Chargement des informations entreprise...");
  try {
    const payload = await requestJson(COMPANY_URL);
    companySettings = payload.settings || null;
    renderCompanySettings();
    showCompanyStatus(
      companySettings?.canManage
        ? "Ces informations sont partagees avec les modules OceanOS."
        : "Consultation seule : seuls les administrateurs peuvent modifier ces informations.",
      companySettings?.canManage ? "success" : ""
    );
  } catch (error) {
    showCompanyStatus(error.message || "Impossible de charger les informations entreprise.", "error");
  }
}

async function saveCompanySettings() {
  const payload = await requestJson(COMPANY_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "settings",
      companyName: elements.companyName.value.trim(),
      companyPhone: elements.companyPhone.value.trim(),
      companyAddress: elements.companyAddress.value.trim(),
      companyCity: elements.companyCity.value.trim(),
      companyEmail: elements.companyEmail.value.trim(),
      companySiret: elements.companySiret.value.trim(),
    }),
  });
  companySettings = payload.settings || null;
  renderCompanySettings();
  showCompanyStatus(payload.message || "Informations entreprise enregistrees.", "success");
}

async function resetCompanySettings() {
  const ok = window.confirm("Reinitialiser les informations entreprise OceanOS ?");
  if (!ok) return;

  const payload = await requestJson(COMPANY_URL, {
    method: "POST",
    body: JSON.stringify({ action: "reset" }),
  });
  companySettings = payload.settings || null;
  renderCompanySettings();
  showCompanyStatus(payload.message || "Informations entreprise reinitialisees.", "success");
}

function serviceStatusType(service) {
  if (service.active === "active") return "success";
  if (service.active === "failed") return "error";
  if (service.active === "unknown") return "";
  return "warning";
}

function serviceActionLabel(action) {
  if (action === "start") return "Allumer";
  if (action === "stop") return "Eteindre";
  if (action === "update") return "Mettre a jour";
  return "Relancer";
}

function gitRevisionText(git = servicesGitState) {
  const current = git?.current || "";
  if (!current) return "";
  const branch = git?.branch && git.branch !== "HEAD" ? ` / ${git.branch}` : "";
  return ` Revision Git : ${current}${branch}.`;
}

function renderGitRevision(git = servicesGitState) {
  if (!elements.gitRevisionPill) return;

  const current = git?.current || "";
  if (!current) {
    elements.gitRevisionPill.textContent = "Git : revision indisponible";
    elements.gitRevisionPill.dataset.state = "missing";
    return;
  }

  const branch = git?.branch && git.branch !== "HEAD" ? ` / ${git.branch}` : "";
  elements.gitRevisionPill.textContent = `Git : ${current}${branch}`;
  elements.gitRevisionPill.dataset.state = "ready";
}

async function loadServices() {
  if (!canManageServices()) return;

  showServicesStatus("Chargement de l'etat serveur...");
  renderGitRevision();
  elements.servicesList.innerHTML = '<div class="users-empty">Chargement des services...</div>';
  try {
    const payload = await requestJson(SERVICES_URL);
    servicesState = payload.services || [];
    servicesControlAvailable = Boolean(payload.controlAvailable);
    servicesUpdateAvailable = Boolean(payload.updateAvailable);
    servicesGitState = payload.git || null;
    renderGitRevision(payload.git);
    elements.updateServices.disabled = !servicesUpdateAvailable;
    renderServices();
    const updateHint = servicesUpdateAvailable && !servicesControlAvailable
      ? " Mise a jour Git disponible, mais le redemarrage des services reste desactive sur cet environnement."
      : "";
    showServicesStatus(`${payload.message || "Etat des services charge."}${gitRevisionText(payload.git)}${updateHint}`, servicesUpdateAvailable ? "success" : "");
  } catch (error) {
    servicesState = [];
    servicesGitState = null;
    renderGitRevision();
    elements.updateServices.disabled = true;
    servicesUpdateAvailable = false;
    elements.servicesList.innerHTML = "";
    showServicesStatus(error.message || "Impossible de charger les services.", "error");
  }
}

async function runServerUpdate() {
  const confirmMessage = "Mettre a jour OceanOS depuis Git ?";
  const ok = window.confirm(confirmMessage);
  if (!ok) return;

  elements.updateServices.disabled = true;
  elements.reloadServices.disabled = true;
  showServicesStatus("Mise a jour Git en cours...");
  try {
    const payload = await requestJson(SERVICES_URL, {
      method: "POST",
      body: JSON.stringify({ service: "all", action: "update" }),
    });
    servicesState = payload.services || [];
    servicesControlAvailable = Boolean(payload.controlAvailable);
    servicesUpdateAvailable = Boolean(payload.updateAvailable);
    servicesGitState = payload.git || null;
    renderServices();
    const result = payload.actionResult || {};
    renderGitRevision(result.current ? { current: result.current, branch: result.branch } : payload.git);
    const suffix = result.before && result.after
      ? ` Revision Git : ${result.before} -> ${result.after}.`
      : gitRevisionText(result.current ? { current: result.current, branch: result.branch } : payload.git);
    showServicesStatus(`${result.message || "Mise a jour terminee."}${suffix} Rechargement de la page...`, "success");
    window.setTimeout(() => {
      window.location.reload();
    }, 1800);
  } catch (error) {
    showServicesStatus(error.message || "Mise a jour impossible.", "error");
    await loadServices();
  } finally {
    elements.reloadServices.disabled = false;
    elements.updateServices.disabled = !servicesUpdateAvailable;
  }
}

async function runServiceAction(serviceId, action) {
  const service = servicesState.find((item) => item.id === serviceId);
  const label = service?.label || serviceId;
  if (action === "stop") {
    const warning = serviceId === "web"
      ? " OceanOS ne repondra plus tant qu'Apache ne sera pas relance."
      : serviceId === "database"
        ? " Les modules qui utilisent MySQL seront indisponibles tant que la base ne sera pas relancee."
        : "";
    const ok = window.confirm(`Eteindre ${label} ?${warning}`);
    if (!ok) return;
  }

  showServicesStatus(`${serviceActionLabel(action)} ${label}...`);
  try {
    const payload = await requestJson(SERVICES_URL, {
      method: "POST",
      body: JSON.stringify({ service: serviceId, action }),
    });
    servicesState = payload.services || [];
    servicesControlAvailable = Boolean(payload.controlAvailable);
    renderServices();
    showServicesStatus(`${label} : action ${serviceActionLabel(action).toLowerCase()} terminee.`, "success");
  } catch (error) {
    showServicesStatus(error.message || "Action service impossible.", "error");
    await loadServices();
  }
}

function renderServices() {
  elements.servicesList.innerHTML = "";

  if (servicesState.length === 0) {
    elements.servicesList.innerHTML = '<div class="users-empty">Aucun service detecte.</div>';
    return;
  }

  servicesState.forEach((service) => {
    const row = document.createElement("article");
    row.className = "service-row";

    const head = document.createElement("div");
    head.className = "service-row-head";

    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = service.label || service.id || "Service";
    const meta = document.createElement("small");
    meta.textContent = service.unit ? `${service.unit} - ${service.description || ""}` : service.description || "";
    title.append(name, meta);

    const badge = document.createElement("span");
    badge.className = `service-status ${serviceStatusType(service)}`;
    badge.textContent = service.stateLabel || service.active || "Inconnu";
    head.append(title, badge);

    const details = document.createElement("div");
    details.className = "service-details";
    const enabled = document.createElement("span");
    enabled.textContent = `Activation : ${service.enabled || "unknown"}`;
    const subState = document.createElement("span");
    subState.textContent = `Etat : ${service.subState || "unknown"}`;
    details.append(enabled, subState);

    const actions = document.createElement("div");
    actions.className = "service-actions";
    [
      ["start", "Allumer"],
      ["restart", "Relancer"],
      ["stop", "Eteindre"],
    ].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "stop" ? "danger-button" : "ghost-button";
      button.textContent = label;
      button.disabled = !servicesControlAvailable || service.canControl === false;
      button.addEventListener("click", async () => {
        actions.querySelectorAll("button").forEach((item) => {
          item.disabled = true;
        });
        await runServiceAction(service.id, action);
      });
      actions.appendChild(button);
    });

    if (service.message) {
      const message = document.createElement("p");
      message.className = "service-message";
      message.textContent = service.message;
      row.append(head, details, message, actions);
    } else {
      row.append(head, details, actions);
    }

    elements.servicesList.appendChild(row);
  });
}

function renderApps() {
  elements.appGrid.innerHTML = "";
  const userVisibleModules = visibleModuleSet();
  const visibleApps = apps.filter((app) => {
    if (app.superOnly) return canManageSuperUsers();
    return userVisibleModules.has(app.id);
  });

  if (visibleApps.length === 0) {
    elements.appGrid.innerHTML = '<div class="users-empty">Aucun module visible pour ce compte.</div>';
    return;
  }

  visibleApps.forEach((app) => {
    const button = document.createElement("button");
    button.className = `app-card ${app.superOnly ? "super-app" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="app-icon" style="background:${app.color}">${app.mark}</span>
      <h3>${app.title}</h3>
      <p>${app.subtitle}</p>
      <small>Ouvrir</small>
    `;
    button.addEventListener("click", async () => {
      window.location.href = app.href;
    });
    elements.appGrid.appendChild(button);
  });
}

function setupAdminPanel() {
  const admin = canManageUsers();
  const prestashopAdmin = canManagePrestashop();
  const servicesAdmin = canManageServices();
  elements.menuAdminPageButton.classList.toggle("hidden", !canManageSuperUsers());
  elements.adminPanel.classList.toggle("hidden", !admin);
  elements.userTabAdmin.classList.toggle("hidden", !admin);
  elements.userTabPrestashop.classList.toggle("hidden", !prestashopAdmin);
  elements.servicesPanel.classList.toggle("hidden", !servicesAdmin);
  elements.userTabServices.classList.toggle("hidden", !servicesAdmin);
  document.querySelectorAll(".admin-only-action").forEach((element) => {
    element.classList.toggle("hidden", !prestashopAdmin);
  });
  document.querySelectorAll(".services-only-action").forEach((element) => {
    element.classList.toggle("hidden", !servicesAdmin);
  });
  if (!admin) {
    showUserMenuSection("account");
    return;
  }

  elements.newRoleSuper.hidden = !canManageSuperUsers();
  if (!canManageSuperUsers() && elements.newRole.value === "super") {
    elements.newRole.value = "member";
  }
  void loadUsers();
}

async function handleLogout(triggerButton = null) {
  if (triggerButton) triggerButton.disabled = true;
  elements.logoutButton.disabled = true;
  elements.menuLogoutButton.disabled = true;
  try {
    await requestJson(AUTH_URL, { method: "DELETE" });
  } catch (error) {
    console.warn(error);
  }
  authState = { authenticated: false, needsSetup: false, user: null };
  elements.logoutButton.disabled = false;
  elements.menuLogoutButton.disabled = false;
  if (triggerButton) triggerButton.disabled = false;
  await refreshAuth();
}

async function loadUsers() {
  if (!canManageUsers()) return;

  showUsersMessage("");
  elements.usersList.innerHTML = '<div class="users-empty">Chargement des comptes...</div>';
  try {
    const payload = await requestJson(USERS_URL);
    usersState = payload.users || [];
    if (payload.currentUser) {
      authState.user = payload.currentUser;
    }
    renderUsers();
  } catch (error) {
    elements.usersList.innerHTML = "";
    showUsersMessage(error.message || "Impossible de charger les comptes.");
  }
}

function renderUsers() {
  elements.usersList.innerHTML = "";

  if (usersState.length === 0) {
    elements.usersList.innerHTML = '<div class="users-empty">Aucun compte trouve.</div>';
    return;
  }

  usersState.forEach((user) => {
    const rightsLocked = rightsLockedForCurrentAdmin(user);
    const deleteAllowed = canDeleteAccount(user);
    const row = document.createElement("article");
    row.className = ["user-row", user.isActive ? "" : "inactive", rightsLocked ? "rights-locked" : ""]
      .filter(Boolean)
      .join(" ");

    const identity = document.createElement("div");
    identity.className = "user-row-identity";

    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    avatar.textContent = (user.displayName || user.email || "?").slice(0, 2).toUpperCase();

    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = user.displayName || "Utilisateur";
    const email = document.createElement("small");
    email.textContent = user.email || "";
    copy.append(name, email);
    identity.append(avatar, copy);

    const fields = document.createElement("div");
    fields.className = "user-row-fields";

    const nameInput = document.createElement("input");
    nameInput.value = user.displayName || "";
    nameInput.setAttribute("aria-label", "Nom");

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.value = user.email || "";
    emailInput.setAttribute("aria-label", "Email");

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.placeholder = "Nouveau mot de passe";
    passwordInput.minLength = 8;
    passwordInput.setAttribute("aria-label", "Nouveau mot de passe");

    const roleSelect = document.createElement("select");
    const roleOptions = [
      ["member", "Membre"],
      ["admin", "Administrateur"],
      ...(canManageSuperUsers() ? [["super", "Super-utilisateur"]] : []),
    ];
    if (user.role === "super" && !roleOptions.some(([value]) => value === "super")) {
      roleOptions.push(["super", "Super-utilisateur"]);
    }
    roleOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      roleSelect.appendChild(option);
    });
    roleSelect.value = user.role || "member";
    roleSelect.disabled = rightsLocked;
    if (rightsLocked) {
      roleSelect.title = "Protege : seul un super-utilisateur peut modifier ces droits.";
    }

    const activeLabel = document.createElement("label");
    activeLabel.className = "active-toggle";
    if (rightsLocked) {
      activeLabel.classList.add("locked");
    }
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = Boolean(user.isActive);
    activeInput.disabled = user.id === authState.user?.id || rightsLocked;
    if (rightsLocked) {
      activeLabel.title = "Protege : seul un super-utilisateur peut modifier cette activation.";
    }
    activeLabel.append(activeInput, document.createTextNode("Actif"));

    fields.append(nameInput, emailInput, passwordInput, roleSelect, activeLabel);

    const moduleAccess = document.createElement("div");
    moduleAccess.className = "user-module-access";
    if (rightsLocked) {
      moduleAccess.classList.add("locked");
    }
    const moduleTitle = document.createElement("span");
    moduleTitle.className = "module-access-title";
    moduleTitle.textContent = "Modules visibles";
    const moduleGrid = document.createElement("div");
    moduleGrid.className = "module-access-grid";
    const userVisibleModules = visibleModuleSet(user);
    const moduleInputs = managedApps().map((app) => {
      const label = document.createElement("label");
      label.className = "module-access-chip";
      if (rightsLocked) {
        label.classList.add("locked");
        label.title = "Protege : seul un super-utilisateur peut modifier ces modules.";
      }

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = app.id;
      input.checked = userVisibleModules.has(app.id);
      input.disabled = rightsLocked;

      label.append(input, document.createTextNode(app.title));
      moduleGrid.appendChild(label);
      return input;
    });
    moduleAccess.append(moduleTitle, moduleGrid);

    const actions = document.createElement("div");
    actions.className = "user-row-actions";

    const roleBadge = document.createElement("span");
    roleBadge.className = `role-badge ${user.role || "member"}`;
    roleBadge.textContent = roleLabel(user.role);

    const saveButton = document.createElement("button");
    saveButton.className = "ghost-button";
    saveButton.type = "button";
    saveButton.textContent = "Enregistrer";
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      showUsersMessage("");
      try {
        const payload = {
          id: user.id,
          displayName: nameInput.value.trim(),
          email: emailInput.value.trim(),
          role: rightsLocked ? user.role || "member" : roleSelect.value,
          isActive: rightsLocked ? Boolean(user.isActive) : activeInput.checked,
        };
        if (!rightsLocked) {
          payload.visibleModules = moduleInputs
            .filter((input) => input.checked)
            .map((input) => input.value);
        }
        if (passwordInput.value) {
          payload.password = passwordInput.value;
        }
        const response = await requestJson(USERS_URL, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        usersState = response.users || [];
        if (response.currentUser) {
          authState.user = response.currentUser;
        }
        renderUsers();
        showUsersMessage("Compte mis a jour.", "success");
      } catch (error) {
        showUsersMessage(error.message || "Mise a jour impossible.");
      } finally {
        saveButton.disabled = false;
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Supprimer";
    deleteButton.disabled = !deleteAllowed;
    if (!deleteAllowed) {
      deleteButton.title = user.id === authState.user?.id
        ? "Vous ne pouvez pas supprimer votre propre compte."
        : "Protege : seul un super-utilisateur peut supprimer ce compte.";
    }
    deleteButton.addEventListener("click", async () => {
      const ok = window.confirm(`Supprimer le compte ${user.email} ? Cette action retirera son acces OceanOS.`);
      if (!ok) return;

      deleteButton.disabled = true;
      showUsersMessage("");
      try {
        const response = await requestJson(USERS_URL, {
          method: "DELETE",
          body: JSON.stringify({ id: user.id }),
        });
        usersState = response.users || [];
        renderUsers();
        showUsersMessage("Compte supprime.", "success");
      } catch (error) {
        showUsersMessage(error.message || "Suppression impossible.");
      } finally {
        deleteButton.disabled = !deleteAllowed;
      }
    });

    actions.append(roleBadge, saveButton, deleteButton);
    row.append(identity, fields, moduleAccess, actions);
    elements.usersList.appendChild(row);
  });
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  elements.submitButton.disabled = true;

  try {
    const body = authState.needsSetup
      ? {
          action: "bootstrap",
          displayName: elements.displayName.value.trim(),
          email: elements.email.value.trim(),
          password: elements.password.value,
        }
      : {
          action: "login",
          email: elements.email.value.trim(),
          password: elements.password.value,
        };

    const payload = await requestJson(AUTH_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    applyAuthState(payload);
    elements.password.value = "";
    const next = safeNext();
    if (next) {
      window.location.href = next;
    }
  } catch (error) {
    showMessage(error.message || "Connexion impossible.");
  } finally {
    elements.submitButton.disabled = false;
  }
});

elements.reloadUsers.addEventListener("click", () => {
  void loadUsers();
});

elements.reloadServices.addEventListener("click", () => {
  void loadServices();
});

elements.updateServices.addEventListener("click", () => {
  void runServerUpdate();
});

elements.userChip.addEventListener("click", () => {
  openUserMenu("account");
});

elements.closeUserMenu.addEventListener("click", () => {
  closeUserMenu();
});

elements.userMenuBackdrop.addEventListener("click", () => {
  closeUserMenu();
});

document.querySelectorAll(".user-control-tab").forEach((tab) => {
  tab.addEventListener("click", () => showUserMenuSection(tab.dataset.userTab));
});

document.querySelectorAll("[data-user-jump]").forEach((button) => {
  button.addEventListener("click", () => showUserMenuSection(button.dataset.userJump));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.userMenu.classList.contains("hidden")) {
    closeUserMenu();
  }
});

elements.aiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.saveAiButton.disabled = true;
  showAiStatus("");
  try {
    await saveAiSettings();
  } catch (error) {
    showAiStatus(error.message || "Impossible d'enregistrer la configuration Groq.", "error");
  } finally {
    elements.saveAiButton.disabled = false;
  }
});

elements.testAiButton.addEventListener("click", async () => {
  elements.testAiButton.disabled = true;
  showAiStatus("Test de connexion Groq...");
  try {
    await testAiSettings();
  } catch (error) {
    showAiStatus(error.message || "Test Groq impossible.", "error");
  } finally {
    elements.testAiButton.disabled = false;
  }
});

elements.deleteAiButton.addEventListener("click", async () => {
  elements.deleteAiButton.disabled = true;
  showAiStatus("");
  try {
    await deleteAiSettings();
  } catch (error) {
    showAiStatus(error.message || "Suppression impossible.", "error");
  } finally {
    elements.deleteAiButton.disabled = false;
  }
});

elements.prestashopForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.savePrestashopButton.disabled = true;
  showPrestashopStatus("");
  try {
    await savePrestashopSettings();
  } catch (error) {
    showPrestashopStatus(error.message || "Impossible d'enregistrer la configuration PrestaShop.", "error");
  } finally {
    elements.savePrestashopButton.disabled = false;
    renderPrestashopSettings();
  }
});

elements.testPrestashopButton.addEventListener("click", async () => {
  elements.testPrestashopButton.disabled = true;
  showPrestashopStatus("Test de connexion PrestaShop...");
  try {
    await testPrestashopSettings();
  } catch (error) {
    showPrestashopStatus(error.message || "Test PrestaShop impossible.", "error");
  } finally {
    elements.testPrestashopButton.disabled = false;
    renderPrestashopSettings();
  }
});

elements.deletePrestashopButton.addEventListener("click", async () => {
  elements.deletePrestashopButton.disabled = true;
  showPrestashopStatus("");
  try {
    await deletePrestashopSettings();
  } catch (error) {
    showPrestashopStatus(error.message || "Suppression impossible.", "error");
  } finally {
    elements.deletePrestashopButton.disabled = false;
    renderPrestashopSettings();
  }
});

elements.companyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageCompany()) return;

  elements.saveCompanyButton.disabled = true;
  showCompanyStatus("");
  try {
    await saveCompanySettings();
  } catch (error) {
    showCompanyStatus(error.message || "Impossible d'enregistrer les informations entreprise.", "error");
  } finally {
    elements.saveCompanyButton.disabled = false;
    renderCompanySettings();
  }
});

elements.resetCompanyButton.addEventListener("click", async () => {
  if (!canManageCompany()) return;

  elements.resetCompanyButton.disabled = true;
  showCompanyStatus("");
  try {
    await resetCompanySettings();
  } catch (error) {
    showCompanyStatus(error.message || "Reinitialisation impossible.", "error");
  } finally {
    elements.resetCompanyButton.disabled = false;
    renderCompanySettings();
  }
});

elements.userCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canManageUsers()) return;

  showUsersMessage("");
  elements.createUserButton.disabled = true;
  try {
    const payload = await requestJson(USERS_URL, {
      method: "POST",
      body: JSON.stringify({
        displayName: elements.newDisplayName.value.trim(),
        email: elements.newEmail.value.trim(),
        password: elements.newPassword.value,
        role: elements.newRole.value,
      }),
    });
    usersState = payload.users || [];
    elements.userCreateForm.reset();
    elements.newRole.value = "member";
    renderUsers();
    showUsersMessage("Compte cree dans OceanOS.", "success");
  } catch (error) {
    showUsersMessage(error.message || "Creation impossible.");
  } finally {
    elements.createUserButton.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", () => {
  void handleLogout(elements.logoutButton);
});

elements.menuLogoutButton.addEventListener("click", () => {
  void handleLogout(elements.menuLogoutButton);
});

elements.menuAdminPageButton.addEventListener("click", () => {
  if (!canManageSuperUsers()) return;
  window.location.href = "/admin/";
});

window.addEventListener("hashchange", () => {
  if (window.location.hash === "#ia") {
    openUserMenu("ai");
  } else if (window.location.hash === "#entreprise") {
    openUserMenu("company");
  } else if (window.location.hash === "#prestashop") {
    openUserMenu("prestashop");
  } else if (window.location.hash === "#services") {
    openUserMenu("services");
  }
});

refreshAuth()
  .catch((error) => {
    showMessage(error.message || "OceanOS est indisponible.");
    setVisible("login");
  });
