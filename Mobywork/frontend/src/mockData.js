// ============================================================
// MOBYWORKSPACE — MOCK DATA CENTRALISÉES
// Structure prête pour connexion API PrestaShop
// ============================================================

// Générer des dates relatives
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// ─── VENTES (30 jours) ────────────────────────────────────
export const salesData = [
  { date: daysAgo(30), revenue: 1240, orders: 8 },
  { date: daysAgo(29), revenue: 890,  orders: 6 },
  { date: daysAgo(28), revenue: 2100, orders: 13 },
  { date: daysAgo(27), revenue: 1580, orders: 10 },
  { date: daysAgo(26), revenue: 760,  orders: 5 },
  { date: daysAgo(25), revenue: 980,  orders: 7 },
  { date: daysAgo(24), revenue: 1320, orders: 9 },
  { date: daysAgo(23), revenue: 3200, orders: 21 },
  { date: daysAgo(22), revenue: 1900, orders: 14 },
  { date: daysAgo(21), revenue: 2400, orders: 16 },
  { date: daysAgo(20), revenue: 1100, orders: 8 },
  { date: daysAgo(19), revenue: 1750, orders: 12 },
  { date: daysAgo(18), revenue: 940,  orders: 6 },
  { date: daysAgo(17), revenue: 2800, orders: 18 },
  { date: daysAgo(16), revenue: 3600, orders: 24 },
  { date: daysAgo(15), revenue: 2200, orders: 15 },
  { date: daysAgo(14), revenue: 1400, orders: 10 },
  { date: daysAgo(13), revenue: 1650, orders: 12 },
  { date: daysAgo(12), revenue: 2900, orders: 19 },
  { date: daysAgo(11), revenue: 3100, orders: 22 },
  { date: daysAgo(10), revenue: 1800, orders: 13 },
  { date: daysAgo(9),  revenue: 2400, orders: 17 },
  { date: daysAgo(8),  revenue: 1200, orders: 9 },
  { date: daysAgo(7),  revenue: 2600, orders: 18 },
  { date: daysAgo(6),  revenue: 3400, orders: 23 },
  { date: daysAgo(5),  revenue: 1950, orders: 14 },
  { date: daysAgo(4),  revenue: 2750, orders: 19 },
  { date: daysAgo(3),  revenue: 3800, orders: 26 },
  { date: daysAgo(2),  revenue: 2100, orders: 15 },
  { date: daysAgo(1),  revenue: 4200, orders: 29 },
];

// ─── STATS DU JOUR ────────────────────────────────────────
export const todayStats = {
  revenue: 4200,
  revenueYesterday: 2100,
  orders: 29,
  ordersYesterday: 15,
  newClients: 6,
  newClientsYesterday: 3,
  conversionRate: 3.8,
  conversionYesterday: 2.9,
};

// ─── TOP PRODUITS ─────────────────────────────────────────
export const topProducts = [
  {
    id: 1,
    name: "Winch Lewmar 44ST Inox",
    ref: "LW44ST",
    sales: 48,
    revenue: 18672,
    stock: 3,
    trend: +22,
    category: "Accastillage",
    alert: "stock_low",
  },
  {
    id: 2,
    name: "Cordage Dyneema 10mm (50m)",
    ref: "DYN-10-50",
    sales: 91,
    revenue: 8190,
    stock: 24,
    trend: +8,
    category: "Cordages",
    alert: null,
  },
  {
    id: 3,
    name: "Manille lyre inox 10mm – Lot 5",
    ref: "MAN-LYR-10",
    sales: 67,
    revenue: 4690,
    stock: 0,
    trend: -5,
    category: "Accastillage",
    alert: "out_of_stock",
  },
  {
    id: 4,
    name: "Pilote automatique ST2000+",
    ref: "ST2000P",
    sales: 12,
    revenue: 14400,
    stock: 8,
    trend: +31,
    category: "Électronique",
    alert: null,
  },
  {
    id: 5,
    name: "Harnais de sécurité ISO EN396",
    ref: "HAR-ISO396",
    sales: 38,
    revenue: 6080,
    stock: 15,
    trend: -12,
    category: "Sécurité",
    alert: null,
  },
];

// ─── PANIERS ABANDONNÉS ───────────────────────────────────
export const abandonedCarts = [
  { id: 1, client: "François Lebrun", email: "f.lebrun@gmail.com", amount: 429, items: 3, abandonedAt: daysAgo(1), products: ["Winch Lewmar 44ST", "Cordage 10mm"] },
  { id: 2, client: "Marine Péchard",  email: "mpechard@orange.fr", amount: 186, items: 2, abandonedAt: daysAgo(2), products: ["Harnais ISO396"] },
  { id: 3, client: "Yann Kerléo",     email: "y.kerleo@voilier.fr", amount: 1200, items: 1, abandonedAt: daysAgo(0.5), products: ["Pilote ST2000+"] },
  { id: 4, client: "Sophie Marin",    email: "s.marin@renov.com",  amount: 94,  items: 4, abandonedAt: daysAgo(3), products: ["Manilles x5", "Visserie marine"] },
  { id: 5, client: "Patrick Galoyer", email: "p.galoyer@mer.fr",   amount: 312, items: 2, abandonedAt: daysAgo(1), products: ["Cordage Dyneema", "Chaumard"] },
];

// ─── SUGGESTIONS IA ───────────────────────────────────────
export const aiSuggestions = [
  {
    id: "sug_1",
    type: "relance",
    priority: "urgent",
    icon: "🛒",
    title: "5 paniers abandonnés détectés",
    description: "Un total de 2 221€ non convertis. Yann Kerléo a abandonné un panier de 1 200€ il y a 2h.",
    action: "Lancer une campagne de relance automatique",
    impact: "+340€ estimés",
    module: "email",
  },
  {
    id: "sug_2",
    type: "contenu",
    priority: "high",
    icon: "📈",
    title: "Pilote ST2000+ en hausse de +31%",
    description: "Ce produit performe très bien cette semaine. C'est le bon moment pour créer un post réseaux sociaux.",
    action: "Générer un post marketing",
    impact: "+visibilité réseau",
    module: "nautipost",
  },
  {
    id: "sug_3",
    type: "stock",
    priority: "urgent",
    icon: "⚠️",
    title: "Winch Lewmar 44ST — Rupture imminente",
    description: "Stock critique : 3 unités restantes. Ce produit représente 18 672€ de CA ce mois-ci.",
    action: "Envoyer une alerte fournisseur",
    impact: "Évite rupture de stock",
    module: "email",
  },
  {
    id: "sug_4",
    type: "client",
    priority: "medium",
    icon: "💎",
    title: "3 clients VIP sans contact depuis 45j",
    description: "Jacques Cousteau, Capitaine Haddock et Marie Curie n'ont pas commandé depuis plus de 6 semaines.",
    action: "Envoyer un email personnalisé VIP",
    impact: "+probabilité rachat",
    module: "crm",
  },
  {
    id: "sug_5",
    type: "perf",
    priority: "low",
    icon: "📊",
    title: "Mardi = votre meilleur jour de vente",
    description: "L'analyse des 30 derniers jours montre que les mardis génèrent en moyenne 32% de CA en plus.",
    action: "Planifier une promo pour mardi prochain",
    impact: "+estimé 800€",
    module: "dashboard",
  },
  {
    id: "sug_6",
    type: "email",
    priority: "high",
    icon: "📬",
    title: "2 emails clients sans réponse depuis >48h",
    description: "Un email prioritaire de François Lebrun (client VIP) attend une réponse depuis 2 jours.",
    action: "Voir et répondre automatiquement",
    impact: "Satisfaction client",
    module: "email",
  },
];

// ─── CLIENTS (résumé pour dashboard) ─────────────────────
export const clientsSegments = [
  { label: "VIP",        count: 12, color: "#f59e0b", pct: 8  },
  { label: "Réguliers",  count: 67, color: "#3b82f6", pct: 44 },
  { label: "Nouveaux",   count: 38, color: "#10b981", pct: 25 },
  { label: "À relancer", count: 21, color: "#8b5cf6", pct: 14 },
  { label: "Inactifs",   count: 14, color: "#475569", pct: 9  },
];

// ─── ACTIVITÉ EMAIL (derniers 7j) ─────────────────────────
export const emailActivity = [
  { day: "Lun", received: 12, replied: 8  },
  { day: "Mar", received: 18, replied: 14 },
  { day: "Mer", received: 9,  replied: 5  },
  { day: "Jeu", received: 22, replied: 19 },
  { day: "Ven", received: 15, replied: 11 },
  { day: "Sam", received: 4,  replied: 2  },
  { day: "Dim", received: 3,  replied: 1  },
];
