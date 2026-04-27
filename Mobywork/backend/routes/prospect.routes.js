const express = require('express');
const router = express.Router();
const prospectService = require('../services/prospectService');
const prospectCleaner = require('../services/prospectCleaner');

// Lister les prospects
router.get('/', async (req, res) => {
    try {
        const prospects = await prospectService.getProspects(req.query, req.user.id);
        res.json(prospects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route de test (Verify mount)
router.get('/ping', (req, res) => {
    res.json({ status: 'ok', module: 'prospection', user: req.user.id });
});

// Importer un prospect (raw text)
router.post('/import', async (req, res) => {
    const { rawData } = req.body;
    if (!rawData) return res.status(400).json({ error: "rawData manquant" });

    try {
        const result = await prospectService.importProspect(rawData, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update prospect (statut, etc)
router.patch('/:id', async (req, res) => {
    try {
        const result = await prospectService.updateProspect(req.params.id, req.body, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Générer variantes email
router.post('/:id/generate-email', async (req, res) => {
    try {
        // Récupérer les données du prospect pour le prompt
        const prospects = await prospectService.getProspects({ search: "" }, req.user.id);
        const prospect = prospects.find(p => p.id == req.params.id);
        
        if (!prospect) return res.status(404).json({ error: "Prospect non trouvé" });

        const variants = await prospectCleaner.generateEmailVariants(prospect, req.user.id);
        res.json(variants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Supprimer un prospect
router.delete('/:id', async (req, res) => {
    console.log(`🗑️ Requête de suppression reçue pour l'ID: ${req.params.id} (User: ${req.user.id})`);
    try {
        const result = await prospectService.deleteProspect(req.params.id, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
