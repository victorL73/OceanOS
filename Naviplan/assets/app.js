const OCEANOS_URL = "/OceanOS/";
const AUTH_URL = "/OceanOS/api/auth.php";
const SETTINGS_URL = "api/settings.php";
const YEAR = 2026;

const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

const SHORT_MONTHS = ["jan", "fev", "mar", "avr", "mai", "jun", "jul", "aou", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

const SOURCES = [
  {
    id: "impots-calendar",
    title: "Calendrier fiscal des professionnels",
    url: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal",
    description: "Echeances DGFiP par mois : TVA, IS, CVAE, CFE, PAS, taxes annexes.",
  },
  {
    id: "dsn",
    title: "Declaration sociale nominative",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F34059",
    description: "DSN mensuelle, paiement des cotisations et signalements d'evenements.",
  },
  {
    id: "dpae",
    title: "Formalites d'embauche",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23107",
    description: "DPAE a transmettre avant l'embauche, au plus tot 8 jours avant.",
  },
  {
    id: "duerp",
    title: "Document unique DUERP",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F35360",
    description: "Evaluation des risques professionnels et mise a jour selon effectif.",
  },
  {
    id: "registers",
    title: "Registres obligatoires",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F1784",
    description: "Registre unique du personnel, DUERP et registres sante/securite.",
  },
  {
    id: "accounts",
    title: "Depot des comptes annuels",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F31214",
    description: "Approbation et depot des comptes annuels selon la forme de societe.",
  },
  {
    id: "cfe",
    title: "Cotisation fonciere des entreprises",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23547",
    description: "CFE, declaration initiale 1447-C et paiement acompte/solde.",
  },
  {
    id: "is",
    title: "Impot sur les societes",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23575",
    description: "Acomptes trimestriels et solde de l'IS.",
  },
  {
    id: "doeth",
    title: "DOETH",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F22523",
    description: "Declaration annuelle d'emploi des travailleurs handicapes via la DSN d'avril.",
  },
  {
    id: "apprenticeship",
    title: "Taxe d'apprentissage",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F22574",
    description: "Part principale en DSN, solde annuel declare en avril et paye en mai.",
  },
  {
    id: "egalite",
    title: "Index egalite professionnelle",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F35103",
    description: "Publication annuelle de l'index pour les entreprises d'au moins 50 salaries.",
  },
  {
    id: "rgpd",
    title: "Obligations RGPD",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F24270",
    description: "Registre des traitements, information des personnes et bases legales.",
  },
  {
    id: "electronic-invoicing",
    title: "Facturation electronique",
    url: "https://entreprendre.service-public.gouv.fr/actualites/A15683",
    description: "Reception, emission et e-reporting selon le calendrier de generalisation.",
  },
  {
    id: "company-registers",
    title: "Registres d'une societe",
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F37373",
    description: "Livre-journal, grand livre, inventaire annuel et conservation comptable.",
  },
];

const PROFILES = [
  ["fiscal", "Fiscal"],
  ["tva", "TVA / UE"],
  ["employer", "Employeur"],
  ["local", "CFE / local"],
  ["legal", "Juridique"],
  ["hr", "RH / prevention"],
  ["data", "RGPD"],
  ["sector", "Taxes specifiques"],
];

const LEGAL_FORM_LABELS = {
  micro: "Micro-entreprise",
  ei: "Entreprise individuelle",
  eurl: "EURL",
  sarl: "SARL",
  sasu: "SASU",
  sas: "SAS",
  sci: "SCI",
  association: "Association",
};

const TAX_REGIME_LABELS = {
  ir: "Impot sur le revenu",
  is: "Impot sur les societes",
};

const TVA_REGIME_LABELS = {
  franchise: "Franchise en base",
  normal_monthly: "Reel normal mensuel",
  normal_quarterly: "Reel normal trimestriel",
  simplified: "Reel simplifie",
  exempt: "Non assujetti / exonere",
};

const STAFF_LABELS = {
  none: "Sans salarie",
  under11: "1 a 10 salaries",
  under50: "11 a 49 salaries",
  over50: "50 salaries et plus",
};

const PAYROLL_LABELS = {
  monthly: "Cotisations mensuelles",
  quarterly: "Cotisations trimestrielles si eligible",
};

const OPTION_DEFINITIONS = [
  ["cfe", "CFE / IFER", "Acompte, solde, prelevements et declaration 1447-C."],
  ["cvae", "CVAE", "Declaration de valeur ajoutee et acomptes si l'entreprise est concernee."],
  ["intraEu", "Operations UE", "DES et etat recapitulatif TVA intracommunautaire."],
  ["rcm", "Dividendes / RCM", "Declarations 2753/2777 pour revenus de capitaux mobiliers."],
  ["taxOnSalaries", "Taxe sur les salaires", "Employeurs non soumis a TVA ou partiellement soumis."],
  ["apprenticeshipTax", "Taxe d'apprentissage", "Part principale et solde annuel declare en DSN."],
  ["doeth", "DOETH", "Declaration annuelle travailleurs handicapes, utile des 20 salaries."],
  ["companyAccounts", "Comptes annuels", "Approbation, depot et registres de societe."],
  ["rgpd", "RGPD", "Registre des traitements et revue des donnees personnelles."],
  ["electronicInvoicing", "Facturation electronique", "Reception, emission et e-reporting selon calendrier."],
  ["vehicles", "Vehicules", "Taxes liees aux vehicules utilises pour l'activite."],
  ["heavyVehicles", "Vehicules lourds", "Taxe annuelle poids lourds si l'activite est concernee."],
  ["insuranceTax", "Assurances", "Taxe sur les conventions d'assurances."],
  ["energyAccises", "Accises energie", "Electricite, gaz naturels, charbons et produits energetiques."],
];

const DEFAULT_SETTINGS = {
  legalForm: "sas",
  taxRegime: "is",
  tvaRegime: "normal_monthly",
  staffRange: "under50",
  payrollFrequency: "monthly",
  closingDate: "2025-12-31",
  activeProfiles: ["fiscal", "tva", "employer", "local", "legal", "hr", "data"],
  options: {
    cfe: true,
    cvae: false,
    intraEu: false,
    rcm: true,
    taxOnSalaries: false,
    apprenticeshipTax: true,
    doeth: false,
    companyAccounts: true,
    rgpd: true,
    electronicInvoicing: true,
    vehicles: false,
    heavyVehicles: false,
    insuranceTax: false,
    energyAccises: false,
  },
  notificationUserIds: [],
  notificationLeadDays: 30,
};

const CATEGORY_LABELS = {
  fiscal: "Fiscal",
  social: "Social",
  local: "Local",
  legal: "Juridique",
  hr: "RH",
  data: "Donnees",
  sector: "Specifique",
  accounting: "Comptable",
};

const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-04-06",
  "2026-05-01",
  "2026-05-08",
  "2026-05-14",
  "2026-05-25",
  "2026-07-14",
  "2026-08-15",
  "2026-11-01",
  "2026-11-11",
  "2026-12-25",
]);

const $ = (id) => document.getElementById(id);

const elements = {
  loadingView: $("loading-view"),
  appView: $("app-view"),
  currentUser: $("current-user"),
  logoutButton: $("logout-button"),
  todayButton: $("today-button"),
  notifyButton: $("notify-button"),
  printButton: $("print-button"),
  exportButton: $("export-button"),
  appMessage: $("app-message"),
  metricUpcoming: $("metric-upcoming"),
  metricCritical: $("metric-critical"),
  metricProfiles: $("metric-profiles"),
  metricSources: $("metric-sources"),
  searchInput: $("search-input"),
  monthFilter: $("month-filter"),
  rangeFilter: $("range-filter"),
  priorityFilter: $("priority-filter"),
  profileToolbar: $("profile-toolbar"),
  viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  viewSections: Array.from(document.querySelectorAll("[data-view-section]")),
  agendaTitle: $("agenda-title"),
  resultCount: $("result-count"),
  agendaList: $("agenda-list"),
  nextList: $("next-list"),
  settingSummary: $("setting-summary"),
  legalForm: $("legal-form"),
  taxRegime: $("tax-regime"),
  tvaRegime: $("tva-regime"),
  closingDate: $("closing-date"),
  staffFilter: $("staff-filter"),
  payrollFrequency: $("payroll-frequency"),
  optionGrid: $("option-grid"),
  notificationLeadDays: $("notification-lead-days"),
  notificationUsers: $("notification-users"),
  saveSettingsButton: $("save-settings-button"),
  resetSettingsButton: $("reset-settings-button"),
  previousMonth: $("previous-month"),
  nextMonth: $("next-month"),
  calendarTitle: $("calendar-title"),
  calendarGrid: $("calendar-grid"),
  obligationGrid: $("obligation-grid"),
  sourcesGrid: $("sources-grid"),
  detailModal: $("detail-modal"),
  detailBackdrop: $("detail-backdrop"),
  detailClose: $("detail-close"),
  detailCloseBottom: $("detail-close-bottom"),
  detailKicker: $("detail-kicker"),
  detailTitle: $("detail-title"),
  detailDate: $("detail-date"),
  detailSummary: $("detail-summary"),
  detailMeta: $("detail-meta"),
  detailSteps: $("detail-steps"),
  detailDocs: $("detail-docs"),
  detailRoute: $("detail-route"),
  detailWarning: $("detail-warning"),
  detailSource: $("detail-source"),
};

const today = startOfDay(new Date());

const state = {
  user: null,
  users: [],
  settings: { ...DEFAULT_SETTINGS, options: { ...DEFAULT_SETTINGS.options } },
  canManage: false,
  activeProfiles: new Set(PROFILES.map(([id]) => id)),
  view: "agenda",
  calendarMonth: today.getFullYear() === YEAR ? today.getMonth() : 0,
  events: [],
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function makeDate(year, month, day) {
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
  return startOfDay(next);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isHoliday(date) {
  return HOLIDAYS.has(dateKey(date));
}

function nextBusinessDate(year, month, day) {
  let date = makeDate(year, month, day);
  while (isWeekend(date) || isHoliday(date)) {
    date = addDays(date, 1);
  }
  return date;
}

function lastDay(year, month) {
  return makeDate(year, month, daysInMonth(year, month - 1));
}

function sourceUrlForMonth(month) {
  return `https://www.impots.gouv.fr/professionnel/calendrier-fiscal/${YEAR}-${pad(month)}`;
}

function previousPeriodLabel(month) {
  const date = makeDate(YEAR, month, 1);
  date.setMonth(date.getMonth() - 1);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function sourceById(id) {
  return SOURCES.find((source) => source.id === id) || SOURCES[0];
}

function cloneSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    options: {
      ...DEFAULT_SETTINGS.options,
      ...(settings.options || {}),
    },
    activeProfiles: Array.isArray(settings.activeProfiles) && settings.activeProfiles.length
      ? settings.activeProfiles
      : DEFAULT_SETTINGS.activeProfiles,
    notificationUserIds: Array.isArray(settings.notificationUserIds) ? settings.notificationUserIds.map(Number) : [],
    notificationLeadDays: Number(settings.notificationLeadDays || DEFAULT_SETTINGS.notificationLeadDays),
  };
}

function currentSettings() {
  return state.settings || cloneSettings();
}

function isCompanyLegalForm(settings = currentSettings()) {
  return ["eurl", "sarl", "sasu", "sas", "sci"].includes(settings.legalForm);
}

function hasEmployees(settings = currentSettings()) {
  return settings.staffRange !== "none";
}

function optionEnabled(key) {
  return Boolean(currentSettings().options?.[key]);
}

function event(input) {
  const source = sourceById(input.sourceId || "impots-calendar");
  return {
    id: input.id,
    date: input.date,
    endDate: input.endDate || input.date,
    title: input.title,
    summary: input.summary,
    category: input.category || "fiscal",
    profiles: input.profiles || ["fiscal"],
    priority: input.priority || "normal",
    sourceId: source.id,
    sourceTitle: source.title,
    sourceUrl: input.sourceUrl || source.url,
    appliesTo: input.appliesTo || "Selon situation",
    staff: input.staff || "any",
    confidence: input.confidence || "source",
    floating: Boolean(input.floating),
  };
}

function buildMonthlyFiscalEvents() {
  const rows = [];
  for (let month = 1; month <= 12; month += 1) {
    const period = previousPeriodLabel(month);
    const monthSource = sourceUrlForMonth(month);
    const dsnLargeDate = nextBusinessDate(YEAR, month, 5);
    const dsnSmallDate = nextBusinessDate(YEAR, month, 15);
    const taxDate = nextBusinessDate(YEAR, month, 15);

    rows.push(event({
      id: `dsn-large-${month}`,
      date: dateKey(dsnLargeDate),
      title: "DSN et PAS - entreprises 50 salaries et plus",
      summary: `Teledeclaration DSN de ${period} et telepaiement, si paie sans decalage.`,
      category: "social",
      profiles: ["employer"],
      priority: "critical",
      sourceId: "dsn",
      appliesTo: "Employeur 50 salaries et plus",
      staff: "over50",
    }));

    rows.push(event({
      id: `pasrau-${month}`,
      date: dateKey(nextBusinessDate(YEAR, month, 10)),
      title: "PASRAU - revenus de remplacement",
      summary: `Teledeclaration PASRAU de ${period} et telepaiement mensuel.`,
      category: "fiscal",
      profiles: ["fiscal", "employer"],
      priority: "high",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Organismes ou revenus declares hors DSN",
    }));

    rows.push(event({
      id: `tva-intra-des-${month}`,
      date: dateKey(nextBusinessDate(YEAR, month, 11)),
      title: "DES et etat recapitulatif TVA intracommunautaire",
      summary: `Depot des declarations relatives aux operations intracommunautaires realisees en ${period}.`,
      category: "fiscal",
      profiles: ["tva"],
      priority: "high",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Entreprises soumises a TVA avec operations UE",
    }));

    rows.push(event({
      id: `tva-normal-${month}`,
      date: `${YEAR}-${pad(month)}-15`,
      endDate: `${YEAR}-${pad(month)}-24`,
      title: "TVA regime reel normal",
      summary: `Depot et paiement de la declaration mensuelle de TVA, selon la date affichee dans l'espace professionnel.`,
      category: "fiscal",
      profiles: ["tva"],
      priority: "critical",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Entreprises au regime reel normal mensuel",
    }));

    rows.push(event({
      id: `rcm-${month}`,
      date: dateKey(taxDate),
      title: "Prelevements et retenues a la source sur RCM",
      summary: `Declarations 2753 et 2777 relatives aux revenus de capitaux mobiliers de ${period}.`,
      category: "fiscal",
      profiles: ["fiscal"],
      priority: "high",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Societes versant revenus mobiliers, dividendes ou interets",
    }));

    rows.push(event({
      id: `taxe-salaires-${month}`,
      date: dateKey(taxDate),
      title: "Taxe sur les salaires - redevables mensuels",
      summary: `Telepaiement de la taxe concernant les salaires payes en ${period}.`,
      category: "social",
      profiles: ["employer", "fiscal"],
      priority: "high",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Employeurs redevables de la taxe sur les salaires",
      staff: "employer",
    }));

    rows.push(event({
      id: `dsn-small-${month}`,
      date: dateKey(dsnSmallDate),
      title: "DSN et cotisations - moins de 50 salaries",
      summary: `Teledeclaration DSN de ${period} et paiement mensuel des cotisations.`,
      category: "social",
      profiles: ["employer"],
      priority: "critical",
      sourceId: "dsn",
      appliesTo: "Employeur de moins de 50 salaries",
      staff: "under50",
    }));

    rows.push(event({
      id: `insurance-tax-${month}`,
      date: dateKey(taxDate),
      title: "Taxe sur les conventions d'assurances",
      summary: `Teledeclaration et telepaiement des primes, conventions et sommes echues en ${period}.`,
      category: "sector",
      profiles: ["sector", "fiscal"],
      priority: "normal",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Assureurs et redevables concernes",
    }));

    rows.push(event({
      id: `accises-${month}`,
      date: dateKey(nextBusinessDate(YEAR, month, 25)),
      title: "Accises energie - rythme mensuel",
      summary: "Depot de la declaration mensuelle 2040-TIC pour les redevables concernes.",
      category: "sector",
      profiles: ["sector", "fiscal"],
      priority: "normal",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Redevables des accises electricite, gaz naturels ou charbons",
    }));

    rows.push(event({
      id: `tva-franchise-${month}`,
      date: dateKey(lastDay(YEAR, month)),
      title: "TVA - option franchise en base",
      summary: `Date limite d'option pour le paiement de la TVA a partir du 1er ${MONTHS[month - 1]}.`,
      category: "fiscal",
      profiles: ["tva"],
      priority: "normal",
      sourceId: "impots-calendar",
      sourceUrl: monthSource,
      appliesTo: "Entreprises beneficiant de la franchise en base",
    }));
  }
  return rows;
}

function buildAnnualEvents() {
  const rows = [];
  const isDates = [
    ["2026-03-16", "1er acompte IS"],
    ["2026-06-15", "2e acompte IS"],
    ["2026-09-15", "3e acompte IS"],
    ["2026-12-15", "4e acompte IS"],
  ];

  isDates.forEach(([date, title], index) => {
    rows.push(event({
      id: `is-acompte-${index + 1}`,
      date,
      title,
      summary: "Telepaiement de l'acompte d'impot sur les societes via le releve 2571, sauf dispense.",
      category: "fiscal",
      profiles: ["fiscal"],
      priority: "critical",
      sourceId: "is",
      appliesTo: "Societes soumises a l'IS",
    }));
  });

  rows.push(event({
    id: "index-egalite",
    date: "2026-03-01",
    title: "Index egalite professionnelle",
    summary: "Calcul, publication et declaration EgaPro de l'index annuel.",
    category: "hr",
    profiles: ["hr", "employer"],
    priority: "critical",
    sourceId: "egalite",
    appliesTo: "Entreprises d'au moins 50 salaries",
    staff: "over50",
  }));

  rows.push(event({
    id: "electronic-invoicing-2026",
    date: "2026-09-01",
    title: "Facturation electronique - reception obligatoire",
    summary: "A partir du 1er septembre 2026, toutes les entreprises etablies en France doivent pouvoir recevoir les factures electroniques; emission obligatoire pour grandes entreprises et ETI.",
    category: "fiscal",
    profiles: ["fiscal", "tva", "data"],
    priority: "critical",
    sourceId: "electronic-invoicing",
    appliesTo: "Entreprises assujetties a TVA etablies en France",
  }));

  rows.push(event({
    id: "doeth-info-urssaf",
    date: "2026-03-15",
    title: "DOETH - controle des effectifs transmis",
    summary: "Les organismes sociaux transmettent les informations annuelles utiles avant la declaration DOETH.",
    category: "social",
    profiles: ["employer", "hr"],
    priority: "high",
    sourceId: "doeth",
    appliesTo: "Entreprises d'au moins 20 salaries",
    staff: "employer",
  }));

  rows.push(event({
    id: "dsn-quarter-q1",
    date: "2026-04-15",
    title: "Cotisations sociales trimestrielles - TPE option trimestrielle",
    summary: "Paiement des cotisations du 1er trimestre pour les entreprises de moins de 11 salaries ayant opte pour l'exigibilite trimestrielle.",
    category: "social",
    profiles: ["employer"],
    priority: "critical",
    sourceId: "dsn",
    appliesTo: "Moins de 11 salaries avec option trimestrielle",
    staff: "under50",
  }));

  rows.push(event({
    id: "fiscal-results-may",
    date: "2026-05-05",
    title: "Liasse fiscale, resultats BIC/BNC/BA, SCI et CVAE",
    summary: "Souscription des declarations de resultats 2025, annexes, declaration 1330-CVAE et declarations SCI; delai de 15 jours calendaires pour teleprocedures selon cas.",
    category: "fiscal",
    profiles: ["fiscal"],
    priority: "critical",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-05",
    appliesTo: "Entreprises cloturant au 31 decembre ou relevant des declarations visees",
  }));

  rows.push(event({
    id: "ca12-vehicles",
    date: "2026-05-05",
    title: "CA12, taxes vehicules et taxe annuelle poids lourds",
    summary: "Declaration annuelle de TVA au regime simplifie et taxes liees aux vehicules selon regime et detention.",
    category: "sector",
    profiles: ["tva", "sector"],
    priority: "high",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-05",
    appliesTo: "Regime simplifie TVA, vehicules utilises economiquement, poids lourds",
  }));

  rows.push(event({
    id: "doeth-over50",
    date: "2026-05-05",
    title: "DOETH annuelle via DSN d'avril",
    summary: "Depot de la DOETH 2025 dans la DSN d'avril pour les entreprises a echeance du 5 mai.",
    category: "social",
    profiles: ["employer", "hr"],
    priority: "critical",
    sourceId: "doeth",
    appliesTo: "Entreprises d'au moins 20 salaries, echeance DSN du 5",
    staff: "over50",
  }));

  rows.push(event({
    id: "apprentissage-over50",
    date: "2026-05-05",
    title: "Solde taxe d'apprentissage - echeance DSN du 5",
    summary: "Declaration en DSN d'avril et paiement en mai du solde de taxe d'apprentissage 2025.",
    category: "social",
    profiles: ["employer", "fiscal"],
    priority: "critical",
    sourceId: "apprenticeship",
    appliesTo: "Employeurs soumis, hors exemptions territoriales ou sectorielles",
    staff: "over50",
  }));

  rows.push(event({
    id: "doeth-under50",
    date: "2026-05-15",
    title: "DOETH annuelle via DSN d'avril",
    summary: "Depot de la DOETH 2025 dans la DSN d'avril pour les entreprises a echeance du 15 mai.",
    category: "social",
    profiles: ["employer", "hr"],
    priority: "critical",
    sourceId: "doeth",
    appliesTo: "Entreprises d'au moins 20 salaries, echeance DSN du 15",
    staff: "under50",
  }));

  rows.push(event({
    id: "apprentissage-under50",
    date: "2026-05-15",
    title: "Solde taxe d'apprentissage - echeance DSN du 15",
    summary: "Declaration en DSN d'avril et paiement en mai du solde de taxe d'apprentissage 2025.",
    category: "social",
    profiles: ["employer", "fiscal"],
    priority: "critical",
    sourceId: "apprenticeship",
    appliesTo: "Employeurs soumis, hors exemptions territoriales ou sectorielles",
    staff: "under50",
  }));

  rows.push(event({
    id: "cfe-acompte-prelevement",
    date: "2026-05-31",
    title: "CFE/IFER - option prelevement a l'echeance pour l'acompte",
    summary: "Dernier jour indique pour adherer au prelevement a l'echeance de l'acompte CFE/IFER.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "high",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-05",
    appliesTo: "Redevables CFE/IFER non mensualises",
  }));

  rows.push(event({
    id: "cfe-acompte",
    date: "2026-06-15",
    title: "CFE/IFER - acompte",
    summary: "Paiement en ligne de l'acompte CFE/IFER pour les entreprises non mensualisees ou sans prelevement a l'echeance.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "critical",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-06",
    appliesTo: "Redevables CFE/IFER concernes par un acompte",
  }));

  rows.push(event({
    id: "cvae-first",
    date: "2026-06-15",
    title: "CVAE - 1er acompte",
    summary: "Telepaiement du premier acompte CVAE via le formulaire 1329-AC.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "critical",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-06",
    appliesTo: "Entreprises redevables de CVAE",
  }));

  rows.push(event({
    id: "cfe-mensualisation",
    date: "2026-06-30",
    title: "CFE/IFER - adhesion au prelevement mensuel",
    summary: "Derniere fenetre utile pour mensualiser l'annee en cours selon le calendrier fiscal.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "normal",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-06",
    appliesTo: "Redevables CFE/IFER souhaitant mensualiser",
  }));

  rows.push(event({
    id: "dsn-quarter-q2",
    date: "2026-07-15",
    title: "Cotisations sociales trimestrielles - 2e trimestre",
    summary: "Paiement des cotisations du 2e trimestre pour les entreprises de moins de 11 salaries ayant opte pour l'exigibilite trimestrielle.",
    category: "social",
    profiles: ["employer"],
    priority: "critical",
    sourceId: "dsn",
    appliesTo: "Moins de 11 salaries avec option trimestrielle",
    staff: "under50",
  }));

  rows.push(event({
    id: "tva-simplified-july",
    date: "2026-07-15",
    title: "TVA regime simplifie - acompte de juillet",
    summary: "Versement de l'acompte semestriel de TVA au regime simplifie, selon l'echeancier de l'espace professionnel.",
    category: "fiscal",
    profiles: ["tva"],
    priority: "high",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-07",
    appliesTo: "Entreprises au regime simplifie TVA",
  }));

  rows.push(event({
    id: "cvae-second",
    date: "2026-09-15",
    title: "CVAE - 2e acompte",
    summary: "Telepaiement du second acompte CVAE via le formulaire 1329-AC.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "critical",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-09",
    appliesTo: "Entreprises redevables de CVAE",
  }));

  rows.push(event({
    id: "dsn-quarter-q3",
    date: "2026-10-15",
    title: "Cotisations sociales trimestrielles - 3e trimestre",
    summary: "Paiement des cotisations du 3e trimestre pour les entreprises de moins de 11 salaries ayant opte pour l'exigibilite trimestrielle.",
    category: "social",
    profiles: ["employer"],
    priority: "critical",
    sourceId: "dsn",
    appliesTo: "Moins de 11 salaries avec option trimestrielle",
    staff: "under50",
  }));

  rows.push(event({
    id: "cfe-solde-prelevement",
    date: "2026-11-30",
    title: "CFE/IFER - option prelevement a l'echeance pour le solde",
    summary: "Date repere pour adherer au prelevement a l'echeance du solde CFE/IFER.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "high",
    sourceId: "cfe",
    appliesTo: "Redevables CFE/IFER non mensualises",
  }));

  rows.push(event({
    id: "cfe-solde",
    date: "2026-12-15",
    title: "CFE/IFER - solde",
    summary: "Paiement du solde CFE/IFER; la CFE est due avant le 15 decembre selon situation.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "critical",
    sourceId: "cfe",
    appliesTo: "Redevables CFE/IFER",
  }));

  rows.push(event({
    id: "tva-simplified-december",
    date: "2026-12-15",
    title: "TVA regime simplifie - acompte de decembre",
    summary: "Versement de l'acompte semestriel de TVA au regime simplifie, selon l'echeancier de l'espace professionnel.",
    category: "fiscal",
    profiles: ["tva"],
    priority: "high",
    sourceId: "impots-calendar",
    sourceUrl: "https://www.impots.gouv.fr/professionnel/calendrier-fiscal/2026-12",
    appliesTo: "Entreprises au regime simplifie TVA",
  }));

  rows.push(event({
    id: "cfe-1447c",
    date: "2026-12-31",
    title: "CFE - declaration initiale 1447-C",
    summary: "Declaration initiale a adresser avant le 31 decembre pour les creations ou changements d'etablissement de l'annee.",
    category: "local",
    profiles: ["local", "fiscal"],
    priority: "critical",
    sourceId: "cfe",
    appliesTo: "Entreprises creees ou etablissements repris en 2026",
  }));

  rows.push(event({
    id: "duerp-annual",
    date: "2026-12-31",
    title: "DUERP - revue annuelle",
    summary: "Mise a jour annuelle du document unique pour les entreprises de 11 salaries et plus; mise a jour aussi a chaque changement de risque.",
    category: "hr",
    profiles: ["hr", "employer"],
    priority: "high",
    sourceId: "duerp",
    appliesTo: "Employeurs de 11 salaries et plus",
    staff: "employer",
  }));

  rows.push(event({
    id: "rgpd-annual",
    date: "2026-12-31",
    title: "RGPD - revue du registre des traitements",
    summary: "Verification annuelle des finalites, bases legales, durees de conservation, sous-traitants et droits des personnes.",
    category: "data",
    profiles: ["data", "legal"],
    priority: "high",
    sourceId: "rgpd",
    appliesTo: "Entreprises traitant donnees clients, salaries, prospects ou fournisseurs",
  }));

  return rows;
}

function buildClosingEvents() {
  const rows = [];
  const raw = elements.closingDate.value || "2025-12-31";
  let closing = dateFromKey(raw);
  if (Number.isNaN(closing.getTime())) {
    closing = makeDate(2025, 12, 31);
  }

  const approval = addMonths(closing, 6);
  const paperDeposit = addMonths(approval, 1);
  const onlineDeposit = addMonths(approval, 2);
  const nextClosing = new Date(closing);
  while (nextClosing.getFullYear() < YEAR) {
    nextClosing.setFullYear(nextClosing.getFullYear() + 1);
  }

  if (approval.getFullYear() === YEAR) {
    rows.push(event({
      id: "accounts-approval",
      date: dateKey(approval),
      title: "Approbation des comptes annuels",
      summary: "Assemblee ou decision annuelle d'approbation des comptes; delai de 6 mois obligatoire pour SA/SARL/EURL et pratique courante pour SAS/SASU.",
      category: "legal",
      profiles: ["legal", "fiscal"],
      priority: "critical",
      sourceId: "accounts",
      appliesTo: "Societes commerciales et civiles selon forme",
    }));
  }

  if (paperDeposit.getFullYear() === YEAR) {
    rows.push(event({
      id: "accounts-deposit-paper",
      date: dateKey(paperDeposit),
      title: "Depot des comptes - greffe",
      summary: "Depot dans le mois suivant l'approbation des comptes si depot au greffe, sur place ou par courrier.",
      category: "legal",
      profiles: ["legal"],
      priority: "critical",
      sourceId: "accounts",
      appliesTo: "Societes tenues au depot des comptes",
    }));
  }

  if (onlineDeposit.getFullYear() === YEAR) {
    rows.push(event({
      id: "accounts-deposit-online",
      date: dateKey(onlineDeposit),
      title: "Depot des comptes - guichet en ligne",
      summary: "Depot dans les 2 mois suivant l'approbation lorsque le depot est effectue par voie electronique.",
      category: "legal",
      profiles: ["legal"],
      priority: "high",
      sourceId: "accounts",
      appliesTo: "Societes tenues au depot en ligne des comptes",
    }));
  }

  if (nextClosing.getFullYear() === YEAR) {
    rows.push(event({
      id: "annual-inventory",
      date: dateKey(nextClosing),
      title: "Inventaire annuel et cloture comptable",
      summary: "Inventaire annuel des elements d'actif et de passif, preparation de la cloture et conservation des documents comptables.",
      category: "accounting",
      profiles: ["legal", "fiscal"],
      priority: "high",
      sourceId: "company-registers",
      appliesTo: "Societes et entreprises tenant une comptabilite commerciale",
    }));
  }

  return rows;
}

function buildOneOffObligations() {
  return [
    event({
      id: "dpae-floating",
      date: "2026-01-01",
      endDate: "2026-12-31",
      title: "DPAE avant chaque embauche",
      summary: "Declaration prealable a transmettre avant l'embauche, au plus tot 8 jours avant l'arrivee du salarie.",
      category: "hr",
      profiles: ["employer", "hr"],
      priority: "critical",
      sourceId: "dpae",
      appliesTo: "Tout employeur qui recrute",
      staff: "employer",
      floating: true,
    }),
    event({
      id: "staff-register-floating",
      date: "2026-01-01",
      endDate: "2026-12-31",
      title: "Registre unique du personnel",
      summary: "Ouverture et mise a jour du registre des la premiere embauche; mentions obligatoires pour salaries, stagiaires et volontaires.",
      category: "hr",
      profiles: ["employer", "hr"],
      priority: "high",
      sourceId: "registers",
      appliesTo: "Employeurs avec au moins un salarie",
      staff: "employer",
      floating: true,
    }),
  ];
}

function buildEvents() {
  return [
    ...buildMonthlyFiscalEvents(),
    ...buildAnnualEvents(),
    ...buildClosingEvents(),
    ...buildOneOffObligations(),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function eventStart(item) {
  return dateFromKey(item.date);
}

function eventEnd(item) {
  return dateFromKey(item.endDate || item.date);
}

function isEventPast(item) {
  return eventEnd(item) < today;
}

function isEventToday(item) {
  if (item.floating) return false;
  return eventStart(item) <= today && eventEnd(item) >= today;
}

function matchesStaff(item) {
  const settings = currentSettings();
  const staff = settings.staffRange;
  if (item.staff === "any") return true;
  if (staff === "none") return false;
  if (item.staff === "employer") return staff === "under11" || staff === "under50" || staff === "over50";
  if (item.staff === "under50") return staff === "under11" || staff === "under50";
  return item.staff === staff;
}

function matchesProfiles(item) {
  return item.profiles.some((profile) => state.activeProfiles.has(profile));
}

function appliesToSettings(item) {
  const settings = currentSettings();
  const id = item.id || "";
  const employees = hasEmployees(settings);

  if (!matchesStaff(item)) return false;

  if (id.startsWith("dsn-small-")) {
    return employees && settings.staffRange !== "over50" && settings.payrollFrequency === "monthly";
  }
  if (id.startsWith("dsn-large-")) {
    return settings.staffRange === "over50";
  }
  if (id.startsWith("dsn-quarter-")) {
    return settings.staffRange === "under11" && settings.payrollFrequency === "quarterly";
  }
  if (id.startsWith("tva-normal-")) {
    return ["normal_monthly", "normal_quarterly"].includes(settings.tvaRegime);
  }
  if (id.startsWith("tva-simplified-") || id === "ca12-vehicles") {
    return settings.tvaRegime === "simplified" || optionEnabled("vehicles") || optionEnabled("heavyVehicles");
  }
  if (id.startsWith("tva-franchise-")) {
    return settings.tvaRegime === "franchise";
  }
  if (id.startsWith("tva-intra-des-")) {
    return optionEnabled("intraEu") && settings.tvaRegime !== "exempt";
  }
  if (id.startsWith("is-acompte-")) {
    return settings.taxRegime === "is";
  }
  if (id.startsWith("rcm-")) {
    return optionEnabled("rcm") && isCompanyLegalForm(settings);
  }
  if (id.startsWith("taxe-salaires-")) {
    return employees && optionEnabled("taxOnSalaries");
  }
  if (id.startsWith("insurance-tax-")) {
    return optionEnabled("insuranceTax");
  }
  if (id.startsWith("accises-")) {
    return optionEnabled("energyAccises");
  }
  if (id.includes("doeth")) {
    return employees && (settings.staffRange === "over50" || optionEnabled("doeth"));
  }
  if (id.includes("apprentissage")) {
    return employees && optionEnabled("apprenticeshipTax");
  }
  if (id.startsWith("cfe-")) {
    return optionEnabled("cfe");
  }
  if (id.startsWith("cvae-") || id === "fiscal-results-may") {
    return id === "fiscal-results-may" || optionEnabled("cvae");
  }
  if (id.startsWith("accounts-")) {
    return optionEnabled("companyAccounts") && isCompanyLegalForm(settings);
  }
  if (id === "annual-inventory") {
    return settings.legalForm !== "micro";
  }
  if (id === "duerp-annual" || id === "dpae-floating" || id === "staff-register-floating") {
    return employees;
  }
  if (id === "rgpd-annual") {
    return optionEnabled("rgpd");
  }
  if (id === "electronic-invoicing-2026") {
    return optionEnabled("electronicInvoicing") && settings.tvaRegime !== "exempt";
  }

  return true;
}

function matchesRange(item) {
  const range = elements.rangeFilter.value;
  const start = eventStart(item);
  const end = eventEnd(item);
  if (range === "year") return true;
  if (range === "past") return end < today;
  if (range === "30" || range === "90") {
    const limit = addDays(today, Number(range));
    return end >= today && start <= limit;
  }
  return end >= today;
}

function matchesMonth(item) {
  const month = elements.monthFilter.value;
  if (month === "") return true;
  return eventStart(item).getMonth() + 1 === Number(month) || eventEnd(item).getMonth() + 1 === Number(month);
}

function matchesSearch(item) {
  const query = normalize(elements.searchInput.value);
  if (!query) return true;
  const text = normalize([
    item.title,
    item.summary,
    item.appliesTo,
    CATEGORY_LABELS[item.category],
    item.sourceTitle,
    item.profiles.join(" "),
  ].join(" "));
  return text.includes(query);
}

function matchesPriority(item) {
  const priority = elements.priorityFilter.value;
  return priority === "" || item.priority === priority;
}

function filteredEvents(options = {}) {
  return state.events.filter((item) => {
    if (!appliesToSettings(item) || !matchesProfiles(item) || !matchesSearch(item) || !matchesPriority(item)) {
      return false;
    }
    if (!options.ignoreMonth && !matchesMonth(item)) return false;
    if (!options.ignoreRange && !matchesRange(item)) return false;
    return true;
  });
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  const date = typeof value === "string" ? dateFromKey(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function compactDate(item) {
  const start = eventStart(item);
  const end = eventEnd(item);
  if (dateKey(start) === dateKey(end)) {
    return {
      day: String(start.getDate()),
      month: SHORT_MONTHS[start.getMonth()],
    };
  }
  return {
    day: `${start.getDate()}-${end.getDate()}`,
    month: SHORT_MONTHS[start.getMonth()],
  };
}

function priorityLabel(priority) {
  return {
    critical: "Critique",
    high: "Haute",
    normal: "Normale",
  }[priority] || "Normale";
}

function eventDateLabel(item) {
  return item.date === item.endDate ? formatDate(item.date) : `${formatDate(item.date)} - ${formatDate(item.endDate)}`;
}

function findEventById(eventId) {
  return state.events.find((item) => item.id === eventId);
}

function actionPlanForEvent(item) {
  const id = item.id || "";
  const category = item.category || "";

  if (id.startsWith("tva-normal-")) {
    return {
      steps: [
        "Controler le chiffre d'affaires et la TVA collectee de la periode concernee.",
        "Rapprocher la TVA deductible avec les factures fournisseurs et les avoirs.",
        "Preparer puis valider la declaration CA3 dans l'espace professionnel DGFiP.",
        "Telepayer le solde ou enregistrer le credit de TVA avec le justificatif.",
      ],
      docs: ["Journal des ventes", "Journal des achats", "Factures et avoirs", "Derniere declaration TVA"],
      route: "Declaration et paiement dans l'espace professionnel impots.gouv.fr, rubrique TVA.",
      warning: "Les dates exactes peuvent dependre du SIREN et de l'echeancier affiche par l'espace professionnel.",
    };
  }

  if (id.startsWith("tva-simplified-") || id === "ca12-vehicles") {
    return {
      steps: [
        "Verifier l'acompte ou la declaration annuelle attendue pour le regime simplifie.",
        "Controler les bases de TVA, les immobilisations et les regularisations de l'exercice.",
        "Valider le montant a payer ou le credit de TVA avant teletransmission.",
        "Archiver l'accuse de reception et l'ecriture de paiement.",
      ],
      docs: ["Balance TVA", "Factures de ventes et d'achats", "Immobilisations", "Echeancier fiscal"],
      route: "Declaration ou acompte dans l'espace professionnel DGFiP.",
      warning: "Pour les taxes vehicules, verifier la flotte et l'usage professionnel avant de valider la CA12.",
    };
  }

  if (id.startsWith("tva-franchise-")) {
    return {
      steps: [
        "Recalculer le chiffre d'affaires cumule depuis le debut de l'annee.",
        "Comparer le montant aux seuils applicables a l'activite.",
        "Identifier la date de depassement eventuelle et anticiper la facturation avec TVA.",
      ],
      docs: ["Livre des recettes", "Factures emises", "Tableau de suivi des seuils"],
      route: "Aucun depot mensuel si la franchise reste applicable; mise a jour a traiter avec l'expert-comptable si seuil depasse.",
      warning: "Un depassement de seuil peut faire basculer l'entreprise dans un regime TVA avec effet en cours d'annee.",
    };
  }

  if (id.startsWith("tva-intra-des-")) {
    return {
      steps: [
        "Lister les operations intracommunautaires de la periode.",
        "Verifier les numeros de TVA intracommunautaire des clients et fournisseurs.",
        "Preparer la DES ou l'etat recapitulatif selon la nature des operations.",
        "Transmettre puis conserver l'accuse de depot.",
      ],
      docs: ["Factures UE", "Numeros de TVA verifies", "Releve des prestations ou livraisons intracommunautaires"],
      route: "Depot via le service douanier ou fiscal indique par la source officielle.",
      warning: "Separer les livraisons de biens, les acquisitions et les prestations de services avant declaration.",
    };
  }

  if (id.startsWith("dsn-") || id.startsWith("pasrau-") || id.startsWith("taxe-salaires-")) {
    const isPasrau = id.startsWith("pasrau-");
    const isTaxeSalaires = id.startsWith("taxe-salaires-");
    return {
      steps: [
        "Collecter les variables de paie, absences, entrees, sorties et corrections de la periode.",
        isPasrau ? "Generer le flux PASRAU pour les revenus declares hors DSN." : "Generer la DSN depuis le logiciel de paie et controler les blocs sensibles.",
        isTaxeSalaires ? "Verifier l'assujettissement et calculer l'acompte de taxe sur les salaires." : "Verifier le paiement des cotisations et du prelevement a la source.",
        "Transmettre le fichier, traiter les retours et archiver le compte-rendu.",
      ],
      docs: ["Journal de paie", "Contrats et avenants", "Absences et temps de travail", "Taux PAS et cotisations"],
      route: isPasrau ? "Depot PASRAU sur net-entreprises ou le portail declare." : "Depot DSN et paiement sur net-entreprises ou le portail de paie connecte.",
      warning: "Controler les anomalies de retour avant l'echeance de paiement, surtout apres une embauche ou une sortie.",
    };
  }

  if (id.startsWith("is-acompte-")) {
    return {
      steps: [
        "Reprendre le dernier resultat fiscal connu et les acomptes deja payes.",
        "Calculer l'acompte d'impot sur les societes attendu.",
        "Valider le telepaiement et conserver la reference de transaction.",
      ],
      docs: ["Derniere liasse fiscale", "Releve des acomptes IS", "Situation comptable recente"],
      route: "Telepaiement dans l'espace professionnel DGFiP, rubrique impot sur les societes.",
      warning: "Verifier les dispenses ou modulations possibles avant de payer un acompte inhabituel.",
    };
  }

  if (id.startsWith("cfe-") || id.startsWith("cvae-")) {
    const isCvae = id.startsWith("cvae-");
    return {
      steps: [
        isCvae ? "Verifier la valeur ajoutee et l'eligibilite CVAE." : "Consulter l'avis CFE/IFER ou l'option de prelevement disponible.",
        "Rapprocher les etablissements, bases et montants avec les informations de l'entreprise.",
        "Valider le paiement ou l'option de prelevement avant la date limite.",
      ],
      docs: isCvae ? ["Declaration de valeur ajoutee", "Balance analytique", "Acomptes deja verses"] : ["Avis CFE/IFER", "Liste des etablissements", "Coordonnees bancaires"],
      route: "Espace professionnel DGFiP, rubrique payer puis CFE/IFER ou CVAE selon le cas.",
      warning: "Un changement d'etablissement, de surface ou d'activite peut modifier la base locale.",
    };
  }

  if (id.startsWith("rcm-")) {
    return {
      steps: [
        "Identifier les dividendes, interets ou revenus mobiliers verses pendant la periode.",
        "Calculer les prelevements et retenues applicables par beneficiaire.",
        "Preparer la declaration 2777 ou 2753 selon le flux concerne.",
        "Teledeclarer, telepayer et archiver le justificatif.",
      ],
      docs: ["Decisions de distribution", "Liste des beneficiaires", "Montants bruts et prelevements", "Releves bancaires"],
      route: "Declaration et paiement dans l'espace professionnel DGFiP.",
      warning: "Verifier les beneficiaires non residents et les conventions fiscales avant validation.",
    };
  }

  if (id === "fiscal-results-may") {
    return {
      steps: [
        "Finaliser la revision comptable et les ecritures d'inventaire de l'exercice.",
        "Preparer la liasse fiscale et les annexes attendues selon le regime.",
        "Controler les declarations CVAE ou SCI si l'entreprise est concernee.",
        "Teletransmettre puis conserver les accuses de reception.",
      ],
      docs: ["Balance generale", "Grand livre", "Annexes fiscales", "Justificatifs de cloture"],
      route: "Teleprocedure fiscale via l'espace professionnel ou le portail EDI de l'expert-comptable.",
      warning: "La date peut varier selon la date de cloture et les modalites EDI; verifier l'echeance affichee.",
    };
  }

  if (id.startsWith("accounts-") || id === "annual-inventory") {
    return {
      steps: [
        "Finaliser les comptes annuels et les documents sociaux requis.",
        "Organiser l'approbation des comptes ou la decision de l'associe unique.",
        "Signer les proces-verbaux puis deposer les comptes si la forme juridique l'impose.",
        "Classer les documents dans le dossier juridique annuel.",
      ],
      docs: ["Bilan et compte de resultat", "Annexe", "Rapport de gestion si requis", "Proces-verbal d'approbation"],
      route: "Depot au greffe ou via le guichet en ligne selon la modalite choisie.",
      warning: "Le delai de depot court apres l'approbation; la confidentialite des comptes peut etre possible selon la taille.",
    };
  }

  if (id.startsWith("dpae-") || id.startsWith("staff-register-")) {
    return {
      steps: [
        "Recueillir les informations du salarie avant son arrivee.",
        "Transmettre la DPAE dans le delai autorise avant l'embauche.",
        "Mettre a jour le registre unique du personnel et le dossier RH.",
      ],
      docs: ["Etat civil du salarie", "Contrat de travail", "Date et horaire d'embauche", "Informations de poste"],
      route: "Declaration via le portail URSSAF ou l'outil de paie connecte.",
      warning: "La DPAE doit etre transmise avant l'embauche; garder l'accuse de reception.",
    };
  }

  if (id.startsWith("duerp-")) {
    return {
      steps: [
        "Revoir les postes, risques et mesures de prevention de l'entreprise.",
        "Mettre a jour le DUERP apres tout changement significatif.",
        "Partager les actions de prevention avec les personnes concernees.",
      ],
      docs: ["DUERP existant", "Accidents et presque-accidents", "Plan d'actions prevention", "Retours terrain"],
      route: "Mise a jour interne du document unique et conservation dans l'entreprise.",
      warning: "La revue doit rester connectee aux risques reels, pas seulement au modele documentaire.",
    };
  }

  if (id.startsWith("doeth-") || id.startsWith("apprentissage-") || id === "index-egalite") {
    return {
      steps: [
        "Verifier l'effectif et les seuils applicables a l'obligation.",
        "Rassembler les donnees sociales de l'annee ou du mois de reference.",
        "Controler les montants ou indicateurs puis declarer via DSN ou publication requise.",
      ],
      docs: ["Effectif moyen", "DSN de reference", "Donnees RH annuelles", "Justificatifs d'exoneration ou de depense"],
      route: "Declaration via la DSN ou publication selon l'obligation concernee.",
      warning: "Les seuils d'effectif changent le niveau d'obligation; verifier le profil configure.",
    };
  }

  if (id.startsWith("rgpd-")) {
    return {
      steps: [
        "Passer en revue les traitements actifs de donnees personnelles.",
        "Verifier les bases legales, les durees de conservation et les sous-traitants.",
        "Mettre a jour le registre et les informations communiquees aux personnes.",
      ],
      docs: ["Registre des traitements", "Contrats sous-traitants", "Mentions d'information", "Demandes d'exercice de droits"],
      route: "Mise a jour interne du registre RGPD et des supports d'information.",
      warning: "Inclure aussi les donnees salaries, prospects, fournisseurs et outils SaaS.",
    };
  }

  if (id.startsWith("electronic-invoicing-")) {
    return {
      steps: [
        "Identifier les flux factures clients, fournisseurs et e-reporting.",
        "Choisir ou verifier la plateforme de dematerialisation utilisee.",
        "Tester la reception des factures electroniques et preparer l'emission selon la taille.",
      ],
      docs: ["Liste des outils de facturation", "SIREN/SIRET", "Processus achats et ventes", "Contacts comptables"],
      route: "Parametrage dans la plateforme de facturation ou l'outil comptable retenu.",
      warning: "La reception et l'emission n'arrivent pas toujours a la meme date; suivre le calendrier officiel.",
    };
  }

  if (id.startsWith("insurance-tax-") || id.startsWith("accises-")) {
    return {
      steps: [
        "Identifier les operations ou contrats concernes par la taxe specifique.",
        "Calculer la base taxable de la periode et verifier les exemptions.",
        "Declarer et payer via le portail fiscal ou douanier indique.",
      ],
      docs: ["Contrats ou factures concernes", "Tableau de calcul", "Justificatifs d'exoneration"],
      route: "Portail fiscal ou douanier selon la taxe specifique.",
      warning: "Ces taxes dependent fortement de l'activite; desactiver l'option si elle ne concerne pas l'entreprise.",
    };
  }

  return {
    steps: [
      "Verifier que l'echeance concerne bien le profil configure de l'entreprise.",
      "Rassembler les donnees comptables, fiscales, sociales ou juridiques de la periode.",
      "Realiser la declaration, le paiement ou la mise a jour attendue sur le portail indique.",
      "Archiver l'accuse de reception, le paiement et les pieces justificatives.",
    ],
    docs: ["Justificatifs de la periode", "Acces au portail officiel", "Derniere declaration comparable"],
    route: item.sourceTitle ? `Se referer a la source officielle : ${item.sourceTitle}.` : "Se referer au portail officiel indique.",
    warning: category ? `Verifier les regles propres au domaine ${CATEGORY_LABELS[category] || category}.` : "Verifier les seuils, options et dates affichees dans le portail officiel.",
  };
}

function renderDetailList(element, items) {
  element.innerHTML = items.map((text) => `<li>${escapeHtml(text)}</li>`).join("");
}

function openEventDetails(eventId) {
  const item = findEventById(eventId);
  if (!item) return;

  const plan = actionPlanForEvent(item);
  elements.detailKicker.textContent = `${CATEGORY_LABELS[item.category] || item.category} - ${priorityLabel(item.priority)}`;
  elements.detailTitle.textContent = item.title;
  elements.detailDate.textContent = eventDateLabel(item);
  elements.detailSummary.textContent = item.summary;
  elements.detailMeta.innerHTML = [
    item.appliesTo,
    item.sourceTitle,
    item.floating ? "Obligation permanente" : "Echeance datee",
  ].map((text) => `<span class="tag">${escapeHtml(text)}</span>`).join("");
  renderDetailList(elements.detailSteps, plan.steps);
  renderDetailList(elements.detailDocs, plan.docs);
  elements.detailRoute.textContent = plan.route;
  elements.detailWarning.textContent = plan.warning;
  elements.detailSource.href = item.sourceUrl;
  elements.detailSource.textContent = item.sourceTitle ? `Ouvrir ${item.sourceTitle}` : "Ouvrir la source";
  elements.detailModal.classList.remove("hidden");
  elements.detailModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("is-detail-open");
  elements.detailClose.focus();
}

function closeEventDetails() {
  elements.detailModal.classList.add("hidden");
  elements.detailModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-detail-open");
}

function handleEventClick(event) {
  if (event.target.closest("a")) return;
  const trigger = event.target.closest("[data-event-id]");
  if (!trigger) return;
  openEventDetails(trigger.dataset.eventId);
}

function handleEventKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("a")) return;
  const trigger = event.target.closest("[data-event-id]");
  if (!trigger) return;
  event.preventDefault();
  openEventDetails(trigger.dataset.eventId);
}

function renderEventCard(item) {
  const compact = compactDate(item);
  const classes = ["event-card"];
  if (isEventPast(item)) classes.push("is-past");
  if (isEventToday(item)) classes.push("is-today");
  const dateLabel = eventDateLabel(item);

  return `
    <article class="${classes.join(" ")}" data-event-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Voir les actions pour ${escapeHtml(item.title)}">
      <div class="date-block">
        <strong>${escapeHtml(compact.day)}</strong>
        <span>${escapeHtml(compact.month)}</span>
      </div>
      <div class="event-body">
        <div class="event-head">
          <strong class="event-title">${escapeHtml(item.title)}</strong>
          <span class="priority-badge ${escapeHtml(item.priority)}">${priorityLabel(item.priority)}</span>
        </div>
        <p class="event-summary">${escapeHtml(item.summary)}</p>
        <div class="event-meta">
          <span class="tag">${escapeHtml(dateLabel)}</span>
          <span class="tag">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</span>
          <span class="tag">${escapeHtml(item.appliesTo)}</span>
          <a class="source-link" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceTitle)}</a>
        </div>
      </div>
    </article>
  `;
}

function renderAgenda() {
  const events = filteredEvents();
  elements.resultCount.textContent = `${events.length} evenement${events.length > 1 ? "s" : ""}`;
  elements.agendaTitle.textContent = elements.monthFilter.value
    ? `Agenda de ${MONTHS[Number(elements.monthFilter.value) - 1]} ${YEAR}`
    : `Agenda administratif ${YEAR}`;

  if (events.length === 0) {
    elements.agendaList.innerHTML = '<div class="empty-state">Aucune echeance pour ces filtres.</div>';
    return;
  }

  elements.agendaList.innerHTML = events.map(renderEventCard).join("");
}

function renderNextList() {
  const events = filteredEvents({ ignoreMonth: true, ignoreRange: true })
    .filter((item) => !isEventPast(item))
    .filter((item) => !item.floating)
    .slice(0, 8);

  if (events.length === 0) {
    elements.nextList.innerHTML = '<div class="empty-state">Aucune alerte a venir.</div>';
    return;
  }

  elements.nextList.innerHTML = events.map((item) => `
    <article class="next-item" data-event-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="Voir les actions pour ${escapeHtml(item.title)}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(formatDate(item.date))} - ${escapeHtml(item.appliesTo)}</span>
    </article>
  `).join("");
}

function renderMetrics() {
  const scoped = filteredEvents({ ignoreMonth: true, ignoreRange: true });
  const next30 = scoped.filter((item) => !item.floating && eventEnd(item) >= today && eventStart(item) <= addDays(today, 30));
  elements.metricUpcoming.textContent = String(next30.length);
  elements.metricCritical.textContent = String(next30.filter((item) => item.priority === "critical").length);
  elements.metricProfiles.textContent = String(state.activeProfiles.size);
  elements.metricSources.textContent = String(SOURCES.length);
}

function renderCalendar() {
  const month = state.calendarMonth;
  elements.calendarTitle.textContent = `${MONTHS[month]} ${YEAR}`;
  const first = new Date(YEAR, month, 1);
  const firstGridDay = (first.getDay() + 6) % 7;
  const start = addDays(first, -firstGridDay);
  const events = filteredEvents({ ignoreMonth: true, ignoreRange: true });
  const eventsByDay = new Map();

  events.forEach((item) => {
    if (item.floating) return;
    let cursor = eventStart(item);
    const end = eventEnd(item);
    while (cursor <= end) {
      const key = dateKey(cursor);
      if (!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key).push(item);
      cursor = addDays(cursor, 1);
    }
  });

  const cells = WEEKDAYS.map((day) => `<div class="calendar-head">${day}</div>`);
  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const key = dateKey(date);
    const dayEvents = eventsByDay.get(key) || [];
    const classes = ["calendar-day"];
    if (date.getMonth() !== month) classes.push("outside");
    if (dateKey(date) === dateKey(today)) classes.push("today");
    cells.push(`
      <div class="${classes.join(" ")}">
        <span class="day-number">${date.getDate()}</span>
        ${dayEvents.slice(0, 4).map((item) => `<button class="calendar-event ${escapeHtml(item.priority)}" data-event-id="${escapeHtml(item.id)}" type="button">${escapeHtml(item.title)}</button>`).join("")}
        ${dayEvents.length > 4 ? `<div class="calendar-overflow">+${dayEvents.length - 4}</div>` : ""}
      </div>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function renderObligations() {
  const settings = currentSettings();
  const cards = [
    ["Profil retenu", `${LEGAL_FORM_LABELS[settings.legalForm] || settings.legalForm} - ${TAX_REGIME_LABELS[settings.taxRegime] || settings.taxRegime} - ${TVA_REGIME_LABELS[settings.tvaRegime] || settings.tvaRegime}.`],
    ["Fiscal", "TVA selon regime choisi, resultat fiscal, IS si applicable, CFE/IFER, CVAE si option active, RCM et taxes annexes selon activite."],
    ["Social", hasEmployees(settings) ? "DSN, cotisations, PAS, taxe d'apprentissage, DPAE, registre du personnel et obligations RH." : "Aucune DSN recurrente activee tant que le profil est sans salarie."],
    ["Juridique", isCompanyLegalForm(settings) ? "Approbation des comptes, depot des comptes, inventaire et registres de societe." : "Les obligations de depot de comptes sont masquees pour ce profil; gardez les pieces comptables selon regime."],
    ["RH / prevention", hasEmployees(settings) ? "DPAE avant embauche, registre unique du personnel, DUERP et suivi sante/securite." : "A activer des la premiere embauche."],
    ["Donnees", optionEnabled("rgpd") ? "Registre RGPD, information des personnes, bases legales, sous-traitants et durees de conservation." : "RGPD masque dans l'agenda; a reactiver si donnees clients, prospects, salaries ou fournisseurs."],
    ["A verifier", "Les echeances dependent de la forme juridique, du regime fiscal, de l'effectif, de l'activite et de l'espace professionnel DGFiP."],
  ];

  elements.obligationGrid.innerHTML = cards.map(([title, body]) => `
    <article class="obligation-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `).join("");
}

function renderSources() {
  elements.sourcesGrid.innerHTML = SOURCES.map((source) => `
    <article class="source-card">
      <h3>${escapeHtml(source.title)}</h3>
      <p>${escapeHtml(source.description)}</p>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Ouvrir la source</a>
    </article>
  `).join("");
}

function renderSettingSummary() {
  const settings = currentSettings();
  const recipients = state.users.filter((user) => settings.notificationUserIds.includes(Number(user.id)));
  elements.settingSummary.innerHTML = `
    <span>${escapeHtml(LEGAL_FORM_LABELS[settings.legalForm] || settings.legalForm)} - ${escapeHtml(TAX_REGIME_LABELS[settings.taxRegime] || settings.taxRegime)}</span>
    <span>${escapeHtml(TVA_REGIME_LABELS[settings.tvaRegime] || settings.tvaRegime)} - ${escapeHtml(STAFF_LABELS[settings.staffRange] || settings.staffRange)}</span>
    <span>${recipients.length} destinataire${recipients.length > 1 ? "s" : ""} - alerte J-${Number(settings.notificationLeadDays || 30)}</span>
  `;
}

function renderOptionControls() {
  elements.optionGrid.innerHTML = "";
  OPTION_DEFINITIONS.forEach(([key, label, description]) => {
    const row = document.createElement("label");
    row.className = "option-card";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.checked = Boolean(currentSettings().options?.[key]);
    input.disabled = !state.canManage;
    input.addEventListener("change", () => {
      state.settings.options[key] = input.checked;
      render();
    });
    const copy = document.createElement("span");
    copy.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span>`;
    row.append(input, copy);
    elements.optionGrid.appendChild(row);
  });
}

function renderNotificationUsers() {
  elements.notificationUsers.innerHTML = "";
  if (!state.canManage) {
    elements.notificationUsers.innerHTML = '<div class="empty-state">Configuration reservee aux administrateurs.</div>';
    return;
  }
  if (state.users.length === 0) {
    elements.notificationUsers.innerHTML = '<div class="empty-state">Aucun utilisateur actif trouve.</div>';
    return;
  }

  const selected = new Set(currentSettings().notificationUserIds.map(Number));
  state.users.forEach((user) => {
    const row = document.createElement("label");
    row.className = "user-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(user.id);
    input.checked = selected.has(Number(user.id));
    input.addEventListener("change", () => {
      const id = Number(input.value);
      const current = new Set(state.settings.notificationUserIds.map(Number));
      if (input.checked) {
        current.add(id);
      } else {
        current.delete(id);
      }
      state.settings.notificationUserIds = Array.from(current);
      renderSettingSummary();
    });
    const copy = document.createElement("span");
    copy.innerHTML = `<strong>${escapeHtml(user.displayName || user.email)}</strong><span>${escapeHtml(user.email || "")} - ${escapeHtml(user.role || "membre")}</span>`;
    row.append(input, copy);
    elements.notificationUsers.appendChild(row);
  });
}

function applySettingsToControls() {
  const settings = currentSettings();
  elements.legalForm.value = settings.legalForm;
  elements.taxRegime.value = settings.taxRegime;
  elements.tvaRegime.value = settings.tvaRegime;
  elements.closingDate.value = settings.closingDate;
  elements.staffFilter.value = settings.staffRange;
  elements.payrollFrequency.value = settings.payrollFrequency;
  elements.notificationLeadDays.value = String(settings.notificationLeadDays || 30);
  state.activeProfiles = new Set(settings.activeProfiles || DEFAULT_SETTINGS.activeProfiles);

  [
    elements.legalForm,
    elements.taxRegime,
    elements.tvaRegime,
    elements.closingDate,
    elements.staffFilter,
    elements.payrollFrequency,
    elements.notificationLeadDays,
    elements.saveSettingsButton,
    elements.resetSettingsButton,
    elements.notifyButton,
  ].forEach((control) => {
    control.disabled = !state.canManage;
  });

  renderProfiles();
  renderOptionControls();
  renderNotificationUsers();
}

function collectSettingsFromControls() {
  const selectedUsers = Array.from(elements.notificationUsers.querySelectorAll('input[type="checkbox"]:checked')).map((input) => Number(input.value));
  return cloneSettings({
    ...state.settings,
    legalForm: elements.legalForm.value,
    taxRegime: elements.taxRegime.value,
    tvaRegime: elements.tvaRegime.value,
    closingDate: elements.closingDate.value,
    staffRange: elements.staffFilter.value,
    payrollFrequency: elements.payrollFrequency.value,
    activeProfiles: Array.from(state.activeProfiles),
    notificationLeadDays: Number(elements.notificationLeadDays.value || 30),
    notificationUserIds: selectedUsers,
  });
}

function renderProfiles() {
  elements.profileToolbar.innerHTML = "";
  PROFILES.forEach(([id, label]) => {
    const chip = document.createElement("label");
    chip.className = "profile-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = id;
    input.checked = state.activeProfiles.has(id);
    input.disabled = !state.canManage;
    input.addEventListener("change", () => {
      if (input.checked) {
        state.activeProfiles.add(id);
      } else {
        state.activeProfiles.delete(id);
      }
      render();
    });
    chip.append(input, document.createTextNode(label));
    elements.profileToolbar.appendChild(chip);
  });
}

function setView(view) {
  state.view = view;
  elements.viewTabs.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.dataset.viewSection !== view);
  });
}

function setShell(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.appView.classList.toggle("hidden", view !== "app");
}

function showMessage(message = "", type = "") {
  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.classList.toggle("hidden", message === "");
}

function render() {
  state.events = buildEvents();
  renderMetrics();
  renderAgenda();
  renderNextList();
  renderCalendar();
  renderObligations();
  renderSources();
  renderSettingSummary();
  setView(state.view);
}

function populateMonthFilter() {
  elements.monthFilter.innerHTML = [
    '<option value="">Tous les mois</option>',
    ...MONTHS.map((month, index) => `<option value="${index + 1}">${month} ${YEAR}</option>`),
  ].join("");
}

function applyInitialMonth() {
  if (today.getFullYear() === YEAR) {
    elements.monthFilter.value = String(today.getMonth() + 1);
  }
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

async function loadNaviplanSettings() {
  const payload = await requestJson(SETTINGS_URL);
  state.user = payload.currentUser || state.user;
  state.settings = cloneSettings(payload.settings || {});
  state.users = Array.isArray(payload.users) ? payload.users : [];
  state.canManage = Boolean(payload.canManage);
  applySettingsToControls();
}

async function saveNaviplanSettings() {
  if (!state.canManage) return;
  elements.saveSettingsButton.disabled = true;
  showMessage("");
  try {
    const payload = await requestJson(SETTINGS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "settings",
        settings: collectSettingsFromControls(),
      }),
    });
    state.settings = cloneSettings(payload.settings || {});
    state.users = Array.isArray(payload.users) ? payload.users : state.users;
    applySettingsToControls();
    render();
    showMessage(payload.message || "Configuration Naviplan enregistree.", "success");
  } catch (error) {
    showMessage(error.message || "Configuration impossible.", "error");
  } finally {
    elements.saveSettingsButton.disabled = !state.canManage;
  }
}

async function resetSettings() {
  if (!state.canManage) return;
  state.settings = cloneSettings(DEFAULT_SETTINGS);
  if (state.users.length > 0) {
    state.settings.notificationUserIds = state.users
      .filter((user) => ["super", "admin"].includes(user.role))
      .map((user) => Number(user.id));
  }
  applySettingsToControls();
  render();
}

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

async function fetchAuth() {
  const payload = await requestJson(AUTH_URL);
  if (!payload.authenticated) {
    redirectToOceanOS();
    return false;
  }
  const modules = Array.isArray(payload.user?.visibleModules) ? payload.user.visibleModules : [];
  if (modules.length > 0 && !modules.map((item) => String(item).toLowerCase()).includes("naviplan")) {
    window.location.replace(OCEANOS_URL);
    return false;
  }
  state.user = payload.user || null;
  elements.currentUser.textContent = state.user?.displayName || state.user?.email || "Utilisateur";
  return true;
}

async function logout() {
  await requestJson(AUTH_URL, { method: "DELETE" }).catch(() => {});
  window.location.href = OCEANOS_URL;
}

function eventToIcs(item) {
  const start = dateFromKey(item.date);
  const end = addDays(dateFromKey(item.endDate || item.date), 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const fmt = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const text = (value) => String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

  return [
    "BEGIN:VEVENT",
    `UID:${item.id}@naviplan.oceanos`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${fmt(start)}`,
    `DTEND;VALUE=DATE:${fmt(end)}`,
    `SUMMARY:${text(item.title)}`,
    `DESCRIPTION:${text(`${item.summary} Source: ${item.sourceUrl}`)}`,
    `URL:${item.sourceUrl}`,
    "END:VEVENT",
  ].join("\r\n");
}

function exportIcs() {
  const events = filteredEvents();
  if (events.length === 0) {
    showMessage("Aucune echeance a exporter avec les filtres actuels.", "error");
    return;
  }

  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OceanOS//Naviplan//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Naviplan OceanOS",
    ...events.map(eventToIcs),
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naviplan-${YEAR}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage(`${events.length} echeance${events.length > 1 ? "s" : ""} exportee${events.length > 1 ? "s" : ""}.`, "success");
}

async function notifyUpcoming() {
  if (!state.canManage) return;
  const leadDays = Number(currentSettings().notificationLeadDays || 30);
  const limitDate = addDays(today, leadDays);
  const events = filteredEvents({ ignoreMonth: true, ignoreRange: true })
    .filter((item) => !item.floating)
    .filter((item) => eventEnd(item) >= today && eventStart(item) <= limitDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      summary: item.summary,
      priority: item.priority,
      sourceUrl: item.sourceUrl,
    }));

  if (events.length === 0) {
    showMessage("Aucune echeance a notifier dans la fenetre configuree.", "error");
    return;
  }

  elements.notifyButton.disabled = true;
  showMessage("");
  try {
    const payload = await requestJson(SETTINGS_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "notify",
        events,
        limit: 20,
      }),
    });
    showMessage(payload.message || "Notifications Naviplan envoyees.", "success");
  } catch (error) {
    showMessage(error.message || "Notification impossible.", "error");
  } finally {
    elements.notifyButton.disabled = !state.canManage;
  }
}

function installListeners() {
  elements.viewTabs.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view || "agenda"));
  });

  [
    elements.searchInput,
    elements.monthFilter,
    elements.rangeFilter,
    elements.priorityFilter,
  ].forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  [elements.agendaList, elements.nextList, elements.calendarGrid].forEach((container) => {
    container.addEventListener("click", handleEventClick);
    container.addEventListener("keydown", handleEventKeydown);
  });

  [elements.detailBackdrop, elements.detailClose, elements.detailCloseBottom].forEach((control) => {
    control.addEventListener("click", closeEventDetails);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.detailModal.classList.contains("hidden")) {
      closeEventDetails();
    }
  });

  [
    elements.legalForm,
    elements.taxRegime,
    elements.tvaRegime,
    elements.staffFilter,
    elements.closingDate,
    elements.payrollFrequency,
    elements.notificationLeadDays,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      state.settings = collectSettingsFromControls();
      render();
    });
    control.addEventListener("change", () => {
      state.settings = collectSettingsFromControls();
      render();
    });
  });

  elements.previousMonth.addEventListener("click", () => {
    state.calendarMonth = (state.calendarMonth + 11) % 12;
    renderCalendar();
  });

  elements.nextMonth.addEventListener("click", () => {
    state.calendarMonth = (state.calendarMonth + 1) % 12;
    renderCalendar();
  });

  elements.todayButton.addEventListener("click", () => {
    if (today.getFullYear() === YEAR) {
      elements.monthFilter.value = String(today.getMonth() + 1);
      state.calendarMonth = today.getMonth();
    }
    elements.rangeFilter.value = "30";
    render();
  });

  elements.printButton.addEventListener("click", () => window.print());
  elements.exportButton.addEventListener("click", exportIcs);
  elements.notifyButton.addEventListener("click", () => { void notifyUpcoming(); });
  elements.saveSettingsButton.addEventListener("click", () => { void saveNaviplanSettings(); });
  elements.resetSettingsButton.addEventListener("click", resetSettings);
  elements.logoutButton.addEventListener("click", () => { void logout(); });
}

async function boot() {
  populateMonthFilter();
  applyInitialMonth();
  installListeners();

  try {
    const ok = await fetchAuth();
    if (!ok) return;
    await loadNaviplanSettings();
    render();
    setShell("app");
  } catch (error) {
    showMessage(error.message || "Naviplan est indisponible.", "error");
    setShell("app");
  }
}

void boot();
