const prestashopService = require('./prestashopService');
const crmService = require('./crmService');

const ordersService = {

    // Helper pour avoir le nom lisible d'un statut PrestaShop (par défaut, IDs)
    _mapStatus(id) {
        const statuses = {
            1: "En attente de paiement",
            2: "Paiement accepté",
            3: "En cours de préparation",
            4: "Expédié",
            5: "Livré",
            6: "Annulé",
            7: "Remboursé",
            8: "Erreur de paiement",
            10: "En attente de réapprovisionnement",
            11: "En attente de paiement par virement",
        };
        const stId = parseInt(id, 10);
        return statuses[stId] || `Statut ${stId}`;
    },

    // Détermine la catégorie principale du statut
    _getStatusCategory(id) {
        const stId = parseInt(id, 10);
        if ([1, 10, 11].includes(stId)) return "attente";
        if ([2, 3].includes(stId)) return "a_traiter";
        if ([4, 5].includes(stId)) return "expedie";
        if ([6, 7, 8].includes(stId)) return "annule";
        return "inconnu";
    },

    _calculatePriority(order, clientData) {
        let tag = "NORMAL";
        let color = "green";
        let reason = [];
        let score = 20;

        const isVIP = clientData?.tag === "VIP";
        const hoursSince = Math.floor((new Date() - new Date(order.date_add)) / (1000 * 60 * 60));
        const amount = parseFloat(order.total_paid || 0);
        const statusCat = this._getStatusCategory(order.current_state);

        if (statusCat === "attente" || statusCat === "a_traiter") {
            // Scoring
            if (hoursSince > 0) {
                const timeScore = Math.min(40, hoursSince); // Max +40 for time
                score += timeScore;
                if (hoursSince > 24) reason.push(`Délai > ${hoursSince}h`);
            }
            if (amount > 0) {
                const amountScore = Math.min(30, Math.floor(amount / 20)); // Max +30
                score += amountScore;
                if (amount > 500) reason.push("Commande > 500€");
            }
            if (isVIP) {
                score += 20;
                reason.push("Client VIP");
            }

            score = Math.max(0, Math.min(100, score));

            if (score >= 75) {
                tag = "URGENT";
                color = "red";
            } else if (score >= 40) {
                tag = "HAUTE";
                color = "orange";
            } else {
                tag = "NORMAL";
                color = "green";
            }
            
            if (reason.length === 0) reason.push("À traiter standard");
            
        } else {
            score = 0;
            tag = "NORMAL";
            color = "green";
            reason.push(statusCat === "expedie" ? "Commande expédiée" : "Commande annulée/fermée");
        }

        return { tag, color, reason: reason.join(" + "), score };
    },

    async getOrdersEnriched(userId) {
        try {
            // 1. Fetch raw orders and customers
            let [orders, customers] = await Promise.all([
                prestashopService.getOrders(),
                prestashopService.getCustomers()
            ]);

            // Ensure they are arrays
            orders = orders || [];
            customers = customers || [];

            // 2. Fetch CRM clients for VIP detection
            const crmClients = await crmService.getClients(userId);

            // 3. Map for quick access
            const customerMap = {};
            customers.forEach(c => {
                customerMap[c.id] = {
                    id: c.id,
                    nom: `${c.firstname} ${c.lastname}`,
                    email: c.email
                };
            });

            const crmMap = {};
            crmClients.forEach(c => {
                crmMap[c.id] = c.ai; // Contains tag, etc.
            });

            // 4. Enrich Orders
            const enriched = orders.map(o => {
                const clientId = o.id_customer;
                const custInfo = customerMap[clientId] || { nom: `Client #${clientId}`, email: '' };
                const crmInfo = crmMap[clientId] || {};

                // Associations (produits)
                let productsCount = 0;
                let productsList = [];
                if (o.associations && o.associations.order_rows) {
                    const rows = Array.isArray(o.associations.order_rows) ? o.associations.order_rows : [o.associations.order_rows];
                    productsCount = rows.length;
                    productsList = rows.map(r => ({
                        id: r.product_id,
                        name: r.product_name,
                        qty: r.product_quantity,
                        price: r.unit_price_tax_incl
                    }));
                }

                const statusName = this._mapStatus(o.current_state);
                const statusCategory = this._getStatusCategory(o.current_state);
                const priority = this._calculatePriority(o, crmInfo);

                return {
                    id: o.id,
                    reference: o.reference,
                    date: o.date_add,
                    client: {
                        id: clientId,
                        nom: custInfo.nom,
                        email: custInfo.email,
                        isVIP: crmInfo.tag === 'VIP'
                    },
                    montant: parseFloat(o.total_paid || 0),
                    statut: statusName,
                    statutId: parseInt(o.current_state, 10),
                    statutCategory: statusCategory,
                    priorite: priority,
                    produitsCount: productsCount,
                    produits: productsList,
                    adresseLivraison: "Adresse PrestaShop #" + o.id_address_delivery,
                    transporteur: "Transporteur #" + o.id_carrier
                };
            });

            // Trier par: 'à traiter' en premier, puis ID descendant
            return enriched.sort((a, b) => {
                const aNeedsProcessing = a.statutCategory === 'attente' || a.statutCategory === 'a_traiter';
                const bNeedsProcessing = b.statutCategory === 'attente' || b.statutCategory === 'a_traiter';
                if (aNeedsProcessing && !bNeedsProcessing) return -1;
                if (!aNeedsProcessing && bNeedsProcessing) return 1;
                // Ensuite par priorité IA si les deux sont à traiter
                if (aNeedsProcessing && bNeedsProcessing) {
                    const weight = { 'URGENT': 3, 'HAUTE': 2, 'NORMAL': 1 };
                    const wa = weight[a.priorite.tag] || 0;
                    const wb = weight[b.priorite.tag] || 0;
                    if (wa !== wb) return wb - wa;
                }
                return b.id - a.id;
            });

        } catch (err) {
            console.error("❌ ordersService - Erreur getOrdersEnriched:", err);
            return [];
        }
    },

    async getOrderById(orderId, userId) {
        const orders = await this.getOrdersEnriched(userId);
        const order = orders.find(o => o.id == orderId);
        if (!order) throw new Error("Commande introuvable");

        // Mock IA Suggestions
        const aiRecommendations = [];
        if (order.priorite.tag === "URGENT") {
            aiRecommendations.push({
                type: 'alert',
                text: "Commande non traitée depuis plus de 48h. Un email de prévention au client est recommandé."
            });
        }
        if (order.client.isVIP) {
            aiRecommendations.push({
                type: 'info',
                text: "Client VIP. Assurez-vous d'ajouter un petit 'plus' dans le colis."
            });
        }
        if (order.statutCategory === "annule") {
            aiRecommendations.push({
                type: 'warning',
                text: "Commande annulée. Pensez à vérifier l'état du remboursement."
            });
        }

        if (aiRecommendations.length === 0) {
            aiRecommendations.push({
                type: 'success',
                text: "Tout semble en ordre pour cette commande."
            });
        }

        // Mock timeline
        const timeline = [
            { date: order.date, label: `Commande créée (#${order.reference})`, icon: 'shopping-cart' }
        ];
        
        if (order.statutId >= 2) {
            const payDate = new Date(new Date(order.date).getTime() + 1000 * 60 * 5).toISOString(); // +5 min
            timeline.unshift({ date: payDate, label: "Paiement accepté", icon: 'credit-card' });
        }

        if (order.statutId >= 4 && order.statutId !== 6 && order.statutId !== 8) {
             const expDate = new Date(new Date(order.date).getTime() + 1000 * 60 * 60 * 24).toISOString(); // +24h
             timeline.unshift({ date: expDate, label: "Commande expédiée", icon: 'truck' });
        }

        return { ...order, aiRecommendations, timeline };
    }
};

module.exports = ordersService;
