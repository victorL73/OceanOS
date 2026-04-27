const express = require('express');
const router = express.Router();
const ordersService = require('../ordersService');
const prestashopService = require('../prestashopService');

// Récupérer la liste des commandes enrichies
router.get('/', async (req, res) => {
    try {
        const orders = await ordersService.getOrdersEnriched(req.user.id);
        res.json(orders);
    } catch (err) {
        console.error("Erreur GET /api/orders:", err);
        res.status(500).json({ error: err.toString() });
    }
});

// Récupérer les détails d'une commande
router.get('/:id', async (req, res) => {
    try {
        const order = await ordersService.getOrderById(req.params.id, req.user.id);
        res.json(order);
    } catch (err) {
        console.error("Erreur GET /api/orders/:id :", err);
        res.status(404).json({ error: err.toString() });
    }
});

// Action rapide sur la commande (mock)
router.post('/:id/action', async (req, res) => {
    try {
        const { action } = req.body;
        console.log(`Action demandée sur la commande ${req.params.id}: ${action}`);
        
        // Mettre à jour virtuellement le statut dans le cache (Mock)
        if (action === 'marquer_traite' || action === 'marquer_expedie') {
            const orders = await prestashopService.getOrders();
            const orderIndex = orders.findIndex(o => parseInt(o.id) === parseInt(req.params.id));
            if (orderIndex >= 0) {
                // Force status to Expédié (4)
                orders[orderIndex].current_state = '4';
            }
        } else if (action === 'marquer_annule') {
            const orders = await prestashopService.getOrders();
            const orderIndex = orders.findIndex(o => parseInt(o.id) === parseInt(req.params.id));
            if (orderIndex >= 0) {
                // Force status to Annulé (6)
                orders[orderIndex].current_state = '6';
            }
        }

        res.json({ success: true, message: `Action '${action}' effectuée.` });
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// Téléchargement bordereau (Mock txt file)
router.get('/:id/bordereau', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await ordersService.getOrderById(orderId, req.user.id);
        
        const content = `===========================================
           BORDEREAU D'EXPEDITION
===========================================

Commande Ref : ${order.reference}
Date : ${new Date(order.date).toLocaleString()}
Transporteur : ${order.transporteur}

CLIENT:
${order.client.nom}
${order.client.email}

ADRESSE DE LIVRAISON:
${order.adresseLivraison}

PRODUITS:
${order.produits.map(p => `- ${p.qty}x ${p.name} (${p.price} EUR/u)`).join('\n')}

===========================================
Merci pour votre commande !`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="bordereau_${order.reference}.txt"`);
        res.send(content);

    } catch(err) {
        res.status(500).send("Erreur lors de la génération du bordereau : " + err.toString());
    }
});

module.exports = router;
