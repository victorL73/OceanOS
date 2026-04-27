const db = require('../database');
const prestashopService = require('../prestashopService');

const financeService = {
    /**
     * 1. RÉCUPÉRATION CA (PRESTASHOP)
     */
    async getRevenue(startDate, endDate) {
        const orders = await prestashopService.getOrders();
        // Retourne un format simplifié
        return orders.map(o => ({
            date: o.date_add,
            total: parseFloat(o.total_paid || 0),
            order_id: o.id
        }));
    },

    /**
     * Récupère les factures de la table locale expenses
     */
    async getExpenses() {
        return new Promise(resolve => {
            db.all("SELECT * FROM expenses", (err, rows) => resolve(rows || []));
        });
    },

    async addExpense(data) {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO expenses (user_id, amount, supplier, date, category) VALUES (?, ?, ?, ?, ?)",
                [data.userId || 1, data.amount, data.supplier, data.date, data.category],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });
    },

    async deleteExpense(id, userId = 1) {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM expenses WHERE id = ? AND user_id = ?", [id, userId], function(err) {
                if (err) return reject(err);
                resolve({ success: true, changes: this.changes });
            });
        });
    },

    /**
     * 3. CALCULS FINANCIERS + 5. GRAPHIQUES + 6. TRÉSORERIE
     */
    async computeFinanceMetrics(userId = 1) {
        const orders = await prestashopService.getOrders();
        const expenses = await this.getExpenses();

        const settings = await new Promise(resolve => {
            db.get("SELECT finance_expense_coef, finance_client_delay, finance_supplier_delay FROM user_settings WHERE user_id = ?", [userId], (err, row) => resolve(row || {}));
        });

        const coef = settings.finance_expense_coef || 1.15;

        // --- Calculs globaux ---
        let totalRevenue = 0;
        orders.forEach(o => totalRevenue += parseFloat(o.total_paid || 0));

        let totalExpenses = 0;
        expenses.forEach(e => totalExpenses += parseFloat(e.amount || 0));

        const beneficeBrut = totalRevenue - totalExpenses;
        const beneficeNetEstime = totalRevenue - (totalExpenses * coef);

        // --- CASHFLOW COHÉRENT ---
        // Logique réelle: CA encaissé - Charges réglées = trésorerie nette estimée
        const currentCashflow = beneficeBrut;

        // -- Génération du graphique 30 jours glissants --
        const chartData = [];
        const historyMap = {};

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            historyMap[dateStr] = { date: dateStr, revenue: 0, expenses: 0, net: 0, cashflow: 0 };
        }

        orders.forEach(o => {
            const dateStr = (o.date_add || "").split(' ')[0];
            if (historyMap[dateStr]) historyMap[dateStr].revenue += parseFloat(o.total_paid || 0);
        });

        expenses.forEach(e => {
            const dateStr = (e.date || "").split('T')[0].split(' ')[0];
            if (historyMap[dateStr]) historyMap[dateStr].expenses += parseFloat(e.amount || 0);
        });

        // Cashflow glissant sur 30 jours (part de currentCashflow calculé)
        // On remonte 30 jours en arrière pour simuler l'évolution
        let runningCashflow = currentCashflow;
        // D'abord calculer les flux sur la période pour définir le point de départ
        let periodRevenue = 0, periodExpenses = 0;
        Object.values(historyMap).forEach(day => {
            periodRevenue += day.revenue;
            periodExpenses += day.expenses;
        });
        // Le cashflow de départ = caisseActuelle - flux30j
        let startingCashflow = currentCashflow - (periodRevenue - periodExpenses);

        runningCashflow = startingCashflow;
        Object.values(historyMap).forEach(day => {
            day.net = day.revenue - day.expenses;
            runningCashflow += day.net;
            day.cashflow = runningCashflow;
            chartData.push(day);
        });

        // Répartition des charges (Pie Chart)
        const catMap = {};
        expenses.forEach(e => {
            const cat = e.category || 'Autre';
            catMap[cat] = (catMap[cat] || 0) + parseFloat(e.amount || 0);
        });
        const pieData = Object.keys(catMap).map(k => ({ name: k, value: parseFloat(catMap[k].toFixed(2)) }));

        if (pieData.length === 0) {
            pieData.push({ name: "Aucune dépense", value: 0 });
        }

        return {
            totalRevenue,
            totalExpenses,
            beneficeBrut,
            beneficeNetEstime,
            currentCashflow,
            chartData,
            pieData,
            expenses: expenses
                .map(e => ({
                    ...e,
                    source: e.email_id ? 'auto' : 'manuel'
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
        };
    }
};

module.exports = financeService;
