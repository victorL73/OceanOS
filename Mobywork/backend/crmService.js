const prestashopService = require('./prestashopService');
const db = require('./database');
// Mettre à true uniquement quand PRESTASHOP_API_URL et PRESTASHOP_API_KEY sont configurés dans .env
const USE_PRESTASHOP_API = !!(process.env.PRESTASHOP_API_URL && process.env.PRESTASHOP_API_KEY && process.env.PRESTASHOP_API_KEY !== 'votre_cle_api_ici');

// --- IA LOGIC ---

function calculateInsights(totalSpent, ordersCount, lastOrderDate) {
    let tag = "Nouveau";
    let summary = "Client récent.";
    let recommendation = "Solliciter un avis sur son premier achat pour fidéliser.";
    
    const daysSinceLastOrder = lastOrderDate ? Math.floor((new Date() - new Date(lastOrderDate)) / (1000 * 60 * 60 * 24)) : 999;

    let score = 50;
    let probability = 30;
    let temperature = "Tiède ⚠️";

    // Scoring logic
    if (totalSpent > 0) score += Math.min(20, totalSpent / 50);
    if (ordersCount > 1) score += 10;
    if (daysSinceLastOrder < 30) score += 20;
    else if (daysSinceLastOrder > 120) score -= 20;

    score = Math.max(0, Math.min(100, score));
    score = Math.round(score * 10) / 10; // Round to 1 decimal place

    // Temperature & Probability
    if (score >= 75) {
        temperature = "Chaud 🔥";
        probability = Math.floor(70 + Math.random() * 25);
    } else if (score < 40) {
        temperature = "Froid ❄️";
        probability = Math.floor(5 + Math.random() * 20);
    } else {
        temperature = "Tiède ⚠️";
        probability = Math.floor(30 + Math.random() * 35);
    }

    // Tag Logic (Business rules overrides)
    if (totalSpent > 500) {
        tag = "VIP";
        summary = "Client à très forte valeur (LTV élevée). Excellent historique.";
        recommendation = "Proposer un accès gratuit au club premium ou devancer ses besoins d'entretien.";
    } else if (daysSinceLastOrder > 120) {
        tag = "Perdu";
        summary = `Inactif depuis plus de ${daysSinceLastOrder} jours.`;
        recommendation = "Dernière chance : offre agressive (-20%) ou sondage de désinscription.";
    } else if (daysSinceLastOrder > 60) {
        tag = "À relancer";
        summary = "Le client perdure dans l'inactivité. Risque de départ de la base.";
        recommendation = "Envoyer une promotion personnalisée ou un rappel pour des consommables.";
    } else if (ordersCount === 1) {
        tag = "Fragile";
        summary = "Un seul achat à date.";
        recommendation = "Valider sa satisfaction et proposer un complémentaire.";
    } else if (ordersCount === 0) {
        tag = "Prospect";
        summary = "Inscrit mais n'a passé aucune commande.";
        recommendation = "Envoyer un e-mail de bienvenue avec une offre de premier achat.";
        temperature = "Froid ❄️";
    } else {
        tag = "Normal";
        summary = "Client régulier sans alerte particulière.";
        recommendation = "Maintenir dans les boucles de newsletters classiques.";
    }

    return { tag, summary, recommendation, score, probability, temperature };
}

// --- SERVICES ---

function enrichClientData(client, allOrders, allActivities = []) {
    const orders = allOrders.filter(o => o.clientId === client.id) || [];
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const clientActivities = allActivities.filter(a => a.clientId === client.id) || [];

    const totalSpent = orders.reduce((sum, order) => sum + order.montant, 0);
    const ordersCount = orders.length;
    const lastOrderDate = ordersCount > 0 ? orders[0].date : null;
    const avgCart = ordersCount > 0 ? Math.round(totalSpent / ordersCount) : 0;
    
    // LTV factice estimée (totalSpent + propension projetée)
    const ltv = totalSpent > 0 ? Math.round(totalSpent * (1 + ordersCount * 0.2)) : 0;
    const freqDays = ordersCount > 1 ? Math.round((new Date(orders[0].date) - new Date(orders[orders.length-1].date)) / (1000 * 60 * 60 * 24) / (ordersCount - 1)) : 0;

    const ai = calculateInsights(totalSpent, ordersCount, lastOrderDate);

    // Timeline merge
    const orderEvents = orders.map(o => ({
        id: `order-${o.id}`,
        date: o.date,
        type: 'order',
        label: `Commande ${o.statut} (${o.montant}€)`,
        icon: 'package'
    }));

    const activityEvents = clientActivities.map(a => ({
        id: `activity-${a.id}`,
        date: a.date,
        type: a.type,
        label: a.label,
        icon: a.icon || 'send'
    }));

    let timeline = [...orderEvents, ...activityEvents].sort((a, b) => {
        // Robust date parsing (replace spaces with T and append Z for strict ISO if missing)
        const parseDate = (d) => {
            if (!d) return 0;
            if (d.includes('T')) return new Date(d).getTime();
            return new Date(d.replace(' ', 'T') + 'Z').getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });

    return {
        ...client,
        totalSpent,
        ordersCount,
        lastOrderDate,
        lastOrderDaysAgo: lastOrderDate ? Math.floor((new Date() - new Date(lastOrderDate)) / (1000 * 60 * 60 * 24)) : null,
        avgCart,
        ltv,
        freqDays,
        timeline,
        ai
    };
}

const crmService = {
    // Helpers de mapping
    _mapPrestaCustomer(psCust) {
        return {
            id: parseInt(psCust.id, 10),
            nom: `${psCust.firstname || ''} ${psCust.lastname || ''}`.trim(),
            email: psCust.email,
            telephone: "A vérifier", 
            dateInscription: psCust.date_add
        };
    },
    
    _mapPrestaOrder(psOrder) {
        return {
            id: parseInt(psOrder.id, 10),
            clientId: parseInt(psOrder.id_customer, 10),
            date: psOrder.date_add,
            montant: parseFloat(psOrder.total_paid || 0),
            statut: psOrder.current_state // État numérique par défaut dans PS, prévoir mapping string au besoin
        };
    },

    async getClients(userId) {
        try {
            const [psCustomers, psOrders, activities] = await Promise.all([
                prestashopService.getCustomers(),
                prestashopService.getOrders(),
                this._getAllActivities(userId)
            ]);

            const allOrders = (psOrders || []).map(this._mapPrestaOrder.bind(this));
            const rawClients = (psCustomers || []).map(this._mapPrestaCustomer.bind(this));

            // Dédupliquer par email : garder le client avec le plus grand ID (le plus récent)
            const emailMap = new Map();
            for (const c of rawClients) {
                const key = (c.email || '').toLowerCase().trim();
                if (!key) continue;
                if (!emailMap.has(key) || c.id > emailMap.get(key).id) {
                    emailMap.set(key, c);
                }
            }
            const clients = Array.from(emailMap.values());

            return clients.map(c => enrichClientData(c, allOrders, activities));
        } catch (error) {
            console.error("❌ CRM - Erreur API PrestaShop (getClients):", error.message);
            return [];
        }
    },

    async logActivity(clientId, type, label, message, icon = 'send', userId = 1) {
        return new Promise((resolve, reject) => {
            const isoDate = new Date().toISOString();
            const query = `INSERT INTO crm_activities (clientId, type, label, message, icon, date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(query, [clientId, type, label, message, icon, isoDate, userId], function(err) {
                if (err) {
                    console.error("❌ Erreur logActivity DB:", err.message);
                    return reject(err);
                }
                resolve({ id: this.lastID });
            });
        });
    },

    async _getAllActivities(userId) {
        return new Promise((resolve, reject) => {
            let query = "SELECT * FROM crm_activities";
            let params = [];
            if (userId) {
                query += " WHERE user_id = ?";
                params.push(userId);
            }
            query += " ORDER BY date DESC";
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },
    
    async getClientById(id, userId) {
        try {
            const clients = await this.getClients(userId);
            const client = clients.find(c => c.id === parseInt(id, 10));
            if (!client) throw new Error("Client introuvable");
            return client;
        } catch (error) {
            console.error("❌ CRM - Erreur getClientById:", error.message);
            throw error;
        }
    },
    
    async getOrdersByClient(id) {
        try {
            const psOrders = await prestashopService.getOrders();
            const allOrders = psOrders.map(this._mapPrestaOrder.bind(this));
            const orders = allOrders.filter(o => o.clientId === parseInt(id, 10));
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));
            return orders;
        } catch (error) {
            console.error("❌ Erreur CRM - getOrdersByClient:", error.message);
            return [];
        }
    }
};

module.exports = crmService;
