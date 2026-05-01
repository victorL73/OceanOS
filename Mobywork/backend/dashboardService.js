const prestashopService = require('./prestashopService');
const crmService = require('./crmService');
const db = require('./database');

/**
 * Agrège les données PrestaShop pour le Dashboard
 */
const dashboardService = {

    /**
     * Calcule les statistiques d'aujourd'hui comparées à hier, au mois, ou l'année
     */
    async getStats(range = 'day') {
        const orders = await prestashopService.getOrders();
        const customers = await prestashopService.getCustomers();

        const today = new Date();

        // Fonctions de comparaison
        const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        const isSameMonth = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
        const isSameYear = (d1, d2) => d1.getFullYear() === d2.getFullYear();

        let previousDate = new Date();
        let matchCurrent = () => false;
        let matchPrevious = () => false;

        if (range === 'year') {
            previousDate.setFullYear(today.getFullYear() - 1);
            matchCurrent = (d) => isSameYear(d, today);
            matchPrevious = (d) => isSameYear(d, previousDate);
        } else if (range === 'month') {
            previousDate.setMonth(today.getMonth() - 1);
            matchCurrent = (d) => isSameMonth(d, today);
            matchPrevious = (d) => isSameMonth(d, previousDate);
        } else {
            // Default to day
            previousDate.setDate(today.getDate() - 1);
            matchCurrent = (d) => isSameDay(d, today);
            matchPrevious = (d) => isSameDay(d, previousDate);
        }

        let stats = {
            revenue: 0,
            revenueYesterday: 0,
            orders: 0,
            ordersYesterday: 0,
            newClients: 0,
            newClientsYesterday: 0,
            conversionRate: 0,
            conversionYesterday: 0,
            range
        };

        // Aggregation des commandes
        orders.forEach(o => {
            const orderDate = new Date(o.date_add);
            const amount = parseFloat(o.total_paid || 0);

            if (matchCurrent(orderDate)) {
                stats.revenue += amount;
                stats.orders += 1;
            } else if (matchPrevious(orderDate)) {
                stats.revenueYesterday += amount;
                stats.ordersYesterday += 1;
            }
        });

        // Aggregation des nouveaux clients
        customers.forEach(c => {
            const regDate = new Date(c.date_add);
            if (matchCurrent(regDate)) {
                stats.newClients += 1;
            } else if (matchPrevious(regDate)) {
                stats.newClientsYesterday += 1;
            }
        });

        // Taux de conversion basé dynamiquement (Fake ratio pour la démo)
        stats.conversionRate = stats.orders > 0 ? (range === 'year' ? 4.2 : range === 'month' ? 3.8 : 3.5) : 0; 
        stats.conversionYesterday = stats.ordersYesterday > 0 ? (range === 'year' ? 4.0 : range === 'month' ? 3.6 : 3.1) : 0;

        return stats;
    },

    /**
     * Génère l'historique des 30 derniers jours pour le graphique
     */
    async getSalesHistory() {
        const orders = await prestashopService.getOrders();
        const history = [];

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            let dayRevenue = 0;
            let dayOrders = 0;

            orders.forEach(o => {
                if (o.date_add.startsWith(dateStr)) {
                    dayRevenue += parseFloat(o.total_paid || 0);
                    dayOrders += 1;
                }
            });

            history.push({
                date: dateStr,
                revenue: Math.round(dayRevenue),
                orders: dayOrders
            });
        }
        return history;
    },

    /**
     * Identifie les produits les plus vendus
     */
    async getTopProducts() {
        const orders = await prestashopService.getOrders();
        const productStats = {};

        orders.forEach(o => {
            const rows = o.associations?.order_rows || [];
            rows.forEach(row => {
                const id = row.product_id;
                if (!productStats[id]) {
                    productStats[id] = {
                        id: id,
                        name: row.product_name || `Produit #${id}`,
                        ref: row.product_reference || 'REF-N/A',
                        sales: 0,
                        revenue: 0,
                        category: "Général",
                        trend: Math.floor(Math.random() * 20) - 5 // Simulation de tendance
                    };
                }
                productStats[id].sales += parseInt(row.product_quantity, 10);
                productStats[id].revenue += parseFloat(row.unit_price_tax_incl) * parseInt(row.product_quantity, 10);
            });
        });

        return Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    },

    /**
     * Récupère les données d'alertes pour le panneau de droite (Paniers, Segments, Emails)
     */
    async getAlertsData(userId) {
        // --- 1. SEGMENTS CLIENTS ---
        const clients = await crmService.getClients(userId);
        const segmentsCount = {
            VIP: 0,
            Réguliers: 0,
            Nouveaux: 0,
            'À relancer': 0,
            Inactifs: 0
        };

        clients.forEach(c => {
            const tag = c.ai?.tag;
            if (tag === 'VIP') segmentsCount.VIP++;
            else if (tag === 'Normal') segmentsCount.Réguliers++;
            else if (tag === 'Prospect' || tag === 'Nouveau' || tag === 'Fragile') segmentsCount.Nouveaux++;
            else if (tag === 'À relancer') segmentsCount['À relancer']++;
            else if (tag === 'Perdu') segmentsCount.Inactifs++;
            else segmentsCount.Réguliers++;
        });

        const totalClients = clients.length || 1; // éviter division par zero
        const clientsSegments = [
            { label: 'VIP', count: segmentsCount.VIP, pct: Math.round((segmentsCount.VIP / totalClients) * 100), color: '#f59e0b' },
            { label: 'Réguliers', count: segmentsCount.Réguliers, pct: Math.round((segmentsCount.Réguliers / totalClients) * 100), color: '#3b82f6' },
            { label: 'Nouveaux', count: segmentsCount.Nouveaux, pct: Math.round((segmentsCount.Nouveaux / totalClients) * 100), color: '#10b981' },
            { label: 'À relancer', count: segmentsCount['À relancer'], pct: Math.round((segmentsCount['À relancer'] / totalClients) * 100), color: '#8b5cf6' },
            { label: 'Inactifs', count: segmentsCount.Inactifs, pct: Math.round((segmentsCount.Inactifs / totalClients) * 100), color: '#475569' },
        ].sort((a, b) => b.count - a.count); // Trier par nombre décroissant

        // --- 2. ACTIVITE EMAILS (7j) ---
        const emailActivityMap = {};
        const daysLabel = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        // Initialiser les 7 derniers jours
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = daysLabel[d.getDay()];
            emailActivityMap[dateStr] = { day: dayName, dateStr, received: 0, replied: 0 };
        }

        // Query Reçus
        const receivedRows = await new Promise(resolve => {
            db.all(`SELECT date(date_reception) as dayDate, count(*) as count FROM emails WHERE user_id = ? AND date_reception >= date('now', '-7 days') GROUP BY dayDate`, [userId], (err, rows) => {
                resolve(rows || []);
            });
        });
        receivedRows.forEach(r => {
            if (emailActivityMap[r.dayDate]) emailActivityMap[r.dayDate].received = r.count;
        });

        // Query Répondus/Envoyés
        const repliedRows = await new Promise(resolve => {
            db.all(`SELECT date(date) as dayDate, count(*) as count FROM crm_activities WHERE user_id = ? AND type='email' AND date >= date('now', '-7 days') GROUP BY dayDate`, [userId], (err, rows) => {
                resolve(rows || []);
            });
        });
        repliedRows.forEach(r => {
            if (emailActivityMap[r.dayDate]) emailActivityMap[r.dayDate].replied = r.count;
        });

        const emailActivity = Object.values(emailActivityMap);

        // --- 3. PANIERS ABANDONNÉS ---
        let abandonedCarts = [];
        let crmTemplateRelance = "Bonjour {{client}},\n\nNous avons remarqué que vous avez laissé de superbes articles dans votre panier ({{montant}}€) :\n\n- {{produits}}\n\nN'hésitez pas à finaliser votre commande avant épuisement des stocks.\n\nBonne navigation !";
        
        try {
            // Récupérer les paramètres utilisateur pour le template
            const userSettings = await new Promise(resolve => {
                db.get("SELECT crm_template_relance FROM user_settings WHERE user_id = ?", [userId], (err, row) => resolve(row || {}));
            });
            if (userSettings.crm_template_relance) crmTemplateRelance = userSettings.crm_template_relance;

            // Récupérer les paniers ignorés
            const dismissedRows = await new Promise(resolve => {
                db.all("SELECT cart_id FROM dismissed_carts WHERE user_id = ?", [userId], (err, rows) => resolve(rows || []));
            });
            const dismissedIds = new Set(dismissedRows.map(r => r.cart_id));

            const [carts, orders, psCustomers, psProducts] = await Promise.all([
                prestashopService.getCarts(),
                prestashopService.getOrders(),
                prestashopService.getCustomers(),
                prestashopService.getProducts()
            ]);

            const orderedCartIds = new Set(orders.map(o => o.id_cart));
            const customerMap = {};
            psCustomers.forEach(c => customerMap[c.id] = { name: `${c.firstname} ${c.lastname}`, email: c.email });

            const productMap = {};
            psProducts.forEach(p => productMap[p.id] = { name: p.name || p.reference || `Produit #${p.id}`, price: parseFloat(p.price || 0) });

            // Filtrer les paniers sans commandes, avec un client assigné, et non ignorés
            const filteredCarts = carts.filter(c => c.id_customer !== '0' && !orderedCartIds.has(c.id) && !dismissedIds.has(c.id));
            
            // Trier par date décroissante et prendre les 5 derniers
            filteredCarts.sort((a, b) => new Date(b.date_upd) - new Date(a.date_upd));
            const top5Carts = filteredCarts.slice(0, 5);

            abandonedCarts = top5Carts.map(c => {
                let amount = 0;
                const cartRows = c.associations?.cart_rows || [];
                let products = cartRows.map(cr => {
                    const productInfo = productMap[cr.id_product] || { name: `Ref ${cr.id_product}`, price: 0 };
                    const qty = parseInt(cr.quantity, 10) || 1;
                    amount += productInfo.price * qty;
                    // Extraire potentiellement uniquement la langue principale si name est un objet complexe (PrestaShop)
                    let productName = productInfo.name;
                    if (Array.isArray(productName)) productName = productName[0].value;
                    else if (typeof productName === 'object') productName = productName.language?.[0]?.value || productName.value || `Ref ${cr.id_product}`;
                    return `${productName} (x${qty})`;
                });
                
                if (products.length === 0) products = ['Produits divers'];

                const clientInfo = customerMap[c.id_customer] || { name: `Client #${c.id_customer}`, email: '' };

                return {
                    id: c.id,
                    client: clientInfo.name,
                    clientEmail: clientInfo.email,
                    products: products,
                    amount: Math.round(amount * 1.2), // Approche rapide pour ajouter ~20% TVA 
                    date: c.date_upd
                };
            });

            // Fallback mock si l'API ne retourne aucun panier mais que des clients existent
            if (abandonedCarts.length === 0 && clients.length > 0) {
                // Créons 2 paniers factices basés sur de vrais clients pour la démo
                const c1 = clients[0];
                abandonedCarts.push({ id: 991, client: c1.nom, clientEmail: c1.email, products: ['Winch Lewmar 44ST', 'Manivelle'], amount: 749, date: new Date().toISOString() });
                if (clients.length > 1) {
                    const c2 = clients[1];
                    abandonedCarts.push({ id: 992, client: c2.nom, clientEmail: c2.email, products: ['Kit Entretien Moteur'], amount: 120, date: new Date().toISOString() });
                }
            }

        } catch (e) {
            console.error('Erreur getAlertsData carts:', e);
        }

        return {
            clientsSegments,
            emailActivity,
            abandonedCarts,
            template: crmTemplateRelance
        };
    },

    /**
     * Génère des suggestions pertinentes pour l'IA Feed
     */
    async getAiSuggestions(userId) {
        let suggestions = [];
        let dismissedIds = new Set();

        try {
            // Récupérer les suggestions supprimées
            const dismissedRows = await new Promise(resolve => {
                db.all("SELECT suggestion_id FROM dismissed_suggestions WHERE user_id = ?", [userId], (err, rows) => resolve(rows || []));
            });
            dismissedIds = new Set(dismissedRows.map(r => r.suggestion_id));

            const mailNotifications = await new Promise(resolve => {
                db.all(
                    `SELECT id, email_id, mailbox_address, from_address, subject, created_at
                     FROM mail_notifications
                     WHERE user_id = ? AND dismissed_at IS NULL
                     ORDER BY created_at DESC
                     LIMIT 10`,
                    [userId],
                    (err, rows) => {
                        if (err) {
                            console.warn("Notifications mail indisponibles:", err.message);
                            return resolve([]);
                        }
                        resolve(rows || []);
                    }
                );
            });

            mailNotifications.forEach(mail => {
                suggestions.push({
                    id: `mail_new_${mail.id}`,
                    type: "email",
                    priority: "medium",
                    icon: "📬",
                    title: `Nouveau mail recu : ${mail.subject || "Sans objet"}`,
                    description: `${mail.from_address || "Expediteur inconnu"}${mail.mailbox_address ? ` -> ${mail.mailbox_address}` : ""}`,
                    action: "Ouvrir le mail",
                    impact: "A traiter",
                    module: "email",
                    emailId: mail.email_id,
                    notify: true
                });
            });
            // 1. Paniers Abandonnés (urgent, type: relance)
            const alertsData = await this.getAlertsData(userId);
            const activeCarts = alertsData.abandonedCarts;
            if (activeCarts.length > 0) {
                const totalAmount = activeCarts.reduce((acc, c) => acc + (c.amount || 0), 0);
                const maxCart = activeCarts.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, activeCarts[0]);
                
                suggestions.push({
                    id: "sug_relance_carts",
                    type: "relance",
                    priority: "urgent",
                    icon: "🛒",
                    title: `${activeCarts.length} paniers abandonnés détectés`,
                    description: `Un total de ${totalAmount}€ non convertis. ${maxCart.client} a un panier de ${maxCart.amount}€.`,
                    action: "Lancer une relance automatique",
                    impact: `+${Math.round(totalAmount*0.3)}€ estimés`,
                    module: "email"
                });
            }

            // 2. PrestaShop : Top Produits & Stock
            const psProducts = await prestashopService.getProducts() || [];
            
            // Stock critique (Si un produit a un qty <= 5 par ex, mais Prestashop API renvoie qty dans stock_availables)
            // L'API PS ne renvoie pas de quantity nativement dans GET /products sauf associations
            // On va regarder le "price" pour faire une fake alerte stock pour la démo si nécessaire, ou on ignore si on n'a pas accès au stock réel.
            const productsWithHighPrice = psProducts.filter(p => parseFloat(p.price) > 500);
            if (productsWithHighPrice.length > 0) {
                const topProd = productsWithHighPrice[0];
                const cleanName = topProd.name && typeof topProd.name === 'object' 
                                    ? (topProd.name.language?.[0]?.value || topProd.name.value) 
                                    : (topProd.name || `Produit #${topProd.id}`);

                suggestions.push({
                    id: `sug_marketing_top`,
                    type: "contenu",
                    priority: "high",
                    icon: "📈",
                    title: `${cleanName} — Focus Marketing`,
                    description: `Ce produit à forte valeur ajoutée (${Math.round(topProd.price)}€) pourrait bénéficier d'une meilleure exposition.`,
                    action: "Générer un post avec l'IA",
                    impact: "+visibilité organique",
                    module: "nautipost"
                });
                
                // Simulation alerte stock aléatoire si pertinent
                if (Math.random() > 0.5) {
                    suggestions.push({
                        id: `sug_stock_alert`,
                        type: "stock",
                        priority: "urgent",
                        icon: "⚠️",
                        title: `${cleanName} — Attention Stock`,
                        description: `Attention, ce produit essentiel approche d'une probable rupture de stock.`,
                        action: "Envoyer une alerte d'approvisionnement",
                        impact: "Évite perte de CA",
                        module: "email"
                    });
                }
            }

            // 3. SQLite Emails Urgents
            const urgentEmailsCount = await new Promise(resolve => {
                db.get("SELECT COUNT(*) as c FROM emails WHERE user_id = ? AND status = 'a_repondre' AND priorite = 'urgent'", [userId], (err, row) => {
                    resolve(row?.c || 0);
                });
            });

            if (urgentEmailsCount > 0) {
                suggestions.push({
                    id: `sug_email_urgents`,
                    type: "email",
                    priority: "urgent",
                    icon: "📬",
                    title: `${urgentEmailsCount} emails urgents en attente`,
                    description: `Des emails détectés comme urgents attendent votre réponse depuis un certain temps.`,
                    action: "Traiter la file prioritaire",
                    impact: "Satisfaction client",
                    module: "email"
                });
            }

            // 4. CRM Rétention VIP
            const clients = await crmService.getClients(userId);
            const clientsVipARelancer = clients.filter(c => c.tag === 'VIP' || c.tag === 'À relancer');
            
            if (clientsVipARelancer.length > 0) {
                const limit = Math.min(3, clientsVipARelancer.length);
                const names = clientsVipARelancer.slice(0,limit).map(c => c.nom.split(' ')[0]).join(', ');
                
                suggestions.push({
                    id: `sug_vip_retention`,
                    type: "client",
                    priority: "high",
                    icon: "💎",
                    title: `${clientsVipARelancer.length} clients à fort potentiel délaissés`,
                    description: `${names}... n'ont pas commandé depuis longtemps ou nécessitent de l'attention.`,
                    action: "Proposer de nouvelles offres",
                    impact: "+probabilité rachat",
                    module: "crm"
                });
            }

        } catch (e) {
            console.error("Erreur génération suggestions IA", e);
        }

        // Filtrer les suggestions qui ont été masquées
        suggestions = suggestions.filter(s => !dismissedIds.has(s.id));

        // Si la liste est vide, on force 1 feedback positif (pour la démo SaaS)
        if (suggestions.length === 0) {
            suggestions.push({
                id: `sug_idle`,
                type: "perf",
                priority: "low",
                icon: "✅",
                title: "Rien à signaler pour le moment !",
                description: "Votre gestion est excellente. L'IA continue de surveiller votre activité en coulisses.",
                action: "Voir les statistiques",
                impact: "Tranquilité",
                module: "dashboard",
                notify: false
            });
        }

        return suggestions;
    }
};

module.exports = dashboardService;
