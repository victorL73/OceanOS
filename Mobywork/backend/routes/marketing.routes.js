const express = require('express');
const router = express.Router();
const marketingService = require('../services/marketing.service');
const aiMarketingService = require('../services/aiMarketing.service');
const { authMiddleware } = require('../authMiddleware');

// Dashboard KPIs + historique
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const data = await marketingService.getDashboard(req.user.id);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Liste campagnes
router.get('/campaigns', authMiddleware, async (req, res) => {
    try {
        const campaigns = await marketingService.getCampaigns(req.user.id);
        res.json(campaigns);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Activer / Pauser
router.patch('/campaigns/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const result = await marketingService.updateCampaignStatus(req.params.id, status, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Modifier budget
router.patch('/campaigns/:id/budget', authMiddleware, async (req, res) => {
    try {
        const { action } = req.body;
        const result = await marketingService.updateCampaignBudget(req.params.id, action, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dupliquer campagne
router.post('/campaigns/:id/duplicate', authMiddleware, async (req, res) => {
    try {
        const result = await marketingService.duplicateCampaign(req.params.id, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Analyse IA
router.post('/analyze', authMiddleware, async (req, res) => {
    try {
        const campaigns = await marketingService.getCampaigns(req.user.id);
        const dashboard = await marketingService.getDashboard(req.user.id);
        const analysis = await aiMarketingService.analyzeCampaigns(campaigns, dashboard.kpis, req.user.id);
        res.json(analysis);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Générateur pub IA
router.post('/generate-ad', authMiddleware, async (req, res) => {
    try {
        const { product, target, objective, platform } = req.body;
        if (!product) return res.status(400).json({ error: "Le produit est requis" });
        const result = await aiMarketingService.generateAdContent(product, target || '', objective || 'conversion', platform || 'google', req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Copilote IA
router.post('/copilot', authMiddleware, async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0) return res.status(400).json({ error: "Messages requis" });

        const campaigns = await marketingService.getCampaigns(req.user.id);
        const dashboard = await marketingService.getDashboard(req.user.id);

        const context = `KPIs globaux: Dépenses ${dashboard.kpis.totalSpent}€, ROAS ${dashboard.kpis.roas}x, CPC ${dashboard.kpis.cpcMoyen}€, CTR ${dashboard.kpis.ctrMoyen}%, Conversions ${dashboard.kpis.totalConversions}
Campagnes: ${campaigns.map(c => `"${c.name}" (${c.platform}, ${c.status}): ROAS ${c.roas}x, CPC ${c.cpc}€, Score ${c.score}`).join(' | ')}`;

        const result = await aiMarketingService.copilotChat(messages, context, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Audiences
router.get('/audiences', authMiddleware, async (req, res) => {
    try {
        const audiences = await marketingService.getAudiences(req.user.id);
        res.json(audiences);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/audiences', authMiddleware, async (req, res) => {
    try {
        const result = await marketingService.createAudience(req.body, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Règles d'automatisation
router.get('/rules', authMiddleware, async (req, res) => {
    try {
        const rules = await marketingService.getRules(req.user.id);
        res.json(rules);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/rules', authMiddleware, async (req, res) => {
    try {
        const result = await marketingService.saveRule(req.body, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/rules/:id/toggle', authMiddleware, async (req, res) => {
    try {
        const result = await marketingService.toggleRule(req.params.id, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Historique actions
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const history = await marketingService.getActionHistory(req.user.id);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Suggestions audiences IA
router.post('/suggest-audiences', authMiddleware, async (req, res) => {
    try {
        const { crmSummary } = req.body;
        const result = await aiMarketingService.suggestAudiences(crmSummary || '', req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Génération Stratégie Omnicanale
router.post('/strategy/generate', authMiddleware, async (req, res) => {
    try {
        const { product, target, objective, tone } = req.body;
        if (!product) return res.status(400).json({ error: "Le produit est requis" });
        const result = await aiMarketingService.generateCampaignStrategy(product, target || '', objective || 'conversion', tone || 'expert', req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Transformation de contenu (Pub <-> Social)
router.post('/strategy/transform', authMiddleware, async (req, res) => {
    try {
        const { content, sourceType, targetType } = req.body;
        if (!content) return res.status(400).json({ error: "Le contenu est requis" });
        const result = await aiMarketingService.transformContent(content, sourceType, targetType, req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Purger démo
router.delete('/demo', authMiddleware, async (req, res) => {
    try {
        const result = await marketingService.clearDemoData(req.user.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
