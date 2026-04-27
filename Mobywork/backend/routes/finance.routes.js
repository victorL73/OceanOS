const express = require('express');
const router = express.Router();
const financeService = require('../services/finance.service');
const emailParserService = require('../services/emailParser.service');
const aiFinanceService = require('../services/aiFinance.service');
const { authMiddleware } = require('../authMiddleware');

router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const metrics = await financeService.computeFinanceMetrics(req.user.id);
        res.json(metrics);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const result = await emailParserService.extractInvoicesFromEmails(req.user.id);
        res.json({ success: true, ...result });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/analyze', authMiddleware, async (req, res) => {
    try {
        const metrics = await financeService.computeFinanceMetrics(req.user.id);
        const insights = await aiFinanceService.generateFinanceInsights(metrics, req.user.id);
        res.json(insights);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/expenses', authMiddleware, async (req, res) => {
    try {
        const { amount, supplier, date, category } = req.body;
        if(!amount || !supplier) return res.status(400).json({ error: "Missing fields" });
        const result = await financeService.addExpense({ ...req.body, userId: req.user.id });
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/expenses/:id', authMiddleware, async (req, res) => {
    try {
        const result = await financeService.deleteExpense(req.params.id, req.user.id);
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
