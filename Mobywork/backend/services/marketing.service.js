const db = require('../database');
const psService = require('../prestashopService');

const marketingService = {

    // ═══════════════════════════════════════════════════════════
    // CAMPAGNES
    // ═══════════════════════════════════════════════════════════

    getCampaigns(userId = 1) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM marketing_campaigns WHERE user_id = ? ORDER BY id', [userId], (err, rows) => {
                if (err) return reject(err);
                // Enrichir chaque campagne avec des métriques calculées
                const enriched = (rows || []).map(c => {
                    const cpc = c.clicks > 0 ? +(c.spent / c.clicks).toFixed(2) : 0;
                    const ctr = c.impressions > 0 ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0;
                    const roas = c.spent > 0 ? +(c.revenue / c.spent).toFixed(2) : 0;
                    const costPerConversion = c.conversions > 0 ? +(c.spent / c.conversions).toFixed(2) : 0;
                    return { ...c, cpc, ctr, roas, costPerConversion };
                });
                resolve(enriched);
            });
        });
    },

    async getDashboard(userId = 1) {
        try {
            // 1. Récupérer les paramètres et les commandes réelles
            const [settings, campaigns, allOrders] = await Promise.all([
                new Promise(res => db.get('SELECT * FROM user_settings WHERE user_id = ?', [userId], (err, row) => res(row || {}))),
                this.getCampaigns(userId),
                psService.getOrders().catch(() => [])
            ]);

            const active = campaigns.filter(c => c.status === 'active');
            const totalSpent = active.reduce((s, c) => s + c.spent, 0);
            
            // 2. Traiter les commandes réelles (30 derniers jours)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentOrders = allOrders.filter(o => {
                const orderDate = new Date(o.date_add);
                return orderDate >= thirtyDaysAgo;
            });

            // Calcul réels
            const totalRevenueReal = recentOrders.reduce((sum, o) => sum + parseFloat(o.total_paid_tax_incl || 0), 0);
            const totalConversionsReal = recentOrders.length;
            
            // KPIs Globaux
            const roas = totalSpent > 0 ? +(totalRevenueReal / totalSpent).toFixed(2) : 0;
            const totalClicks = active.reduce((s, c) => s + c.clicks, 0);
            const totalImpressions = active.reduce((s, c) => s + c.impressions, 0);
            const cpcMoyen = totalClicks > 0 ? +(totalSpent / totalClicks).toFixed(2) : 0;
            const ctrMoyen = totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
            const costPerConversion = totalConversionsReal > 0 ? +(totalSpent / totalConversionsReal).toFixed(2) : 0;

            // 3. Générer l'historique 30 jours BASÉ SUR LE RÉEL
            const history = [];
            const ordersByDay = {};
            
            recentOrders.forEach(o => {
                const dateKey = o.date_add.split(' ')[0];
                if (!ordersByDay[dateKey]) ordersByDay[dateKey] = { rev: 0, count: 0 };
                ordersByDay[dateKey].rev += parseFloat(o.total_paid_tax_incl || 0);
                ordersByDay[dateKey].count += 1;
            });

            const dailyBaseSpent = totalSpent / 30;

            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                
                const realData = ordersByDay[dateStr] || { rev: 0, count: 0 };
                
                // On simule un spent quotidien variable pour le graphique (car non stocké en DB par jour)
                const variance = 0.8 + Math.random() * 0.4;
                const daySpent = +(dailyBaseSpent * variance).toFixed(2);
                
                history.push({
                    date: dateStr,
                    spent: daySpent,
                    conversions: realData.count,
                    revenue: +realData.rev.toFixed(2),
                    roas: daySpent > 0 ? +(realData.rev / daySpent).toFixed(2) : 0
                });
            }

            // 4. Scoring des campagnes (utilisant le ROAS cible des paramètres)
            const targetRoas = settings.marketing_target_roas || 3.0;
            const scoring = campaigns.map(c => {
                let score = 'C';
                if (c.roas >= targetRoas * 1.5) score = 'A+';
                else if (c.roas >= targetRoas) score = 'A';
                else if (c.roas >= targetRoas * 0.7) score = 'B';
                else if (c.roas < targetRoas * 0.4) score = 'D';
                
                return {
                    id: c.id,
                    name: c.name,
                    platform: c.platform,
                    score: score,
                    roas: c.roas,
                    cpc: c.cpc
                };
            });

            return {
                kpis: { 
                    totalSpent, 
                    roas, 
                    cpcMoyen, 
                    ctrMoyen, 
                    totalConversions: totalConversionsReal, 
                    costPerConversion,
                    totalRevenue: totalRevenueReal
                },
                history,
                scoring,
                campaignsCount: campaigns.length,
                activeCount: active.length,
                isDemo: campaigns.some(c => c.name.includes('Winch Lewmar') || c.name.includes('Retargeting Visiteurs')),
                settings: {
                    targetRoas,
                    autoPilot: !!settings.marketing_auto_pilot,
                    dailyBudget: settings.marketing_daily_budget
                }
            };
        } catch (e) {
            console.error("❌ Erreur Dashboard Marketing RÉEL:", e.message);
            throw e;
        }
    },

    updateCampaignStatus(id, status, userId = 1) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE marketing_campaigns SET status = ? WHERE id = ? AND user_id = ?', [status, id, userId], function (err) {
                if (err) return reject(err);
                // Log action
                db.run('INSERT INTO marketing_actions (campaign_id, action_type, description, source, user_id) VALUES (?,?,?,?,?)',
                    [id, status === 'active' ? 'activate' : 'pause', `Campagne ${status === 'active' ? 'activée' : 'mise en pause'}`, 'manual', userId]);
                resolve({ success: true, changes: this.changes });
            });
        });
    },

    updateCampaignBudget(id, action, userId = 1) {
        const multipliers = { 'increase_10': 1.10, 'increase_20': 1.20, 'decrease_10': 0.90, 'decrease_20': 0.80 };
        const mult = multipliers[action] || 1;
        const label = mult > 1 ? `+${Math.round((mult - 1) * 100)}%` : `${Math.round((mult - 1) * 100)}%`;

        return new Promise((resolve, reject) => {
            db.run(`UPDATE marketing_campaigns SET budget_daily = ROUND(budget_daily * ?, 2) WHERE id = ? AND user_id = ?`, [mult, id, userId], function (err) {
                if (err) return reject(err);
                db.run('INSERT INTO marketing_actions (campaign_id, action_type, description, source, user_id) VALUES (?,?,?,?,?)',
                    [id, 'budget_change', `Budget modifié de ${label}`, 'manual', userId]);
                resolve({ success: true, changes: this.changes });
            });
        });
    },

    duplicateCampaign(id, userId = 1) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM marketing_campaigns WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
                if (err || !row) return reject(new Error('Campagne introuvable'));
                db.run(`INSERT INTO marketing_campaigns (name, platform, type, budget_daily, spent, impressions, clicks, conversions, revenue, status, score, user_id)
                    VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 'paused', 'B', ?)`,
                    [`${row.name} (copie)`, row.platform, row.type, row.budget_daily, userId], function (err2) {
                        if (err2) return reject(err2);
                        db.run('INSERT INTO marketing_actions (campaign_id, action_type, description, source, user_id) VALUES (?,?,?,?,?)',
                            [this.lastID, 'duplicate', `Dupliquée depuis la campagne #${id}`, 'manual', userId]);
                        resolve({ success: true, newId: this.lastID });
                    });
            });
        });
    },

    // ═══════════════════════════════════════════════════════════
    // AUDIENCES
    // ═══════════════════════════════════════════════════════════

    getAudiences(userId = 1) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM marketing_audiences WHERE user_id = ? OR user_id = 1 ORDER BY id', [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    createAudience(data, userId = 1) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO marketing_audiences (name, type, size, source, status, description, user_id) VALUES (?,?,?,?,?,?,?)',
                [data.name, data.type || 'custom', data.size || 0, data.source || 'manual', 'active', data.description || '', userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ success: true, id: this.lastID });
                });
        });
    },

    // ═══════════════════════════════════════════════════════════
    // RULES AUTOMATION
    // ═══════════════════════════════════════════════════════════

    getRules(userId = 1) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM marketing_rules WHERE user_id = ? OR user_id = 1 ORDER BY id', [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    saveRule(data, userId = 1) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO marketing_rules (name, condition_metric, condition_operator, condition_value, action_type, action_value, mode, user_id) VALUES (?,?,?,?,?,?,?,?)',
                [data.name, data.condition_metric, data.condition_operator, data.condition_value, data.action_type, data.action_value || null, data.mode || 'manual', userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ success: true, id: this.lastID });
                });
        });
    },

    toggleRule(id, userId = 1) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE marketing_rules SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ? AND (user_id = ? OR user_id = 1)', [id, userId], function (err) {
                if (err) return reject(err);
                resolve({ success: true, changes: this.changes });
            });
        });
    },

    // ═══════════════════════════════════════════════════════════
    // HISTORIQUE ACTIONS
    // ═══════════════════════════════════════════════════════════

    getActionHistory(userId = 1) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT ma.*, mc.name as campaign_name FROM marketing_actions ma 
                    LEFT JOIN marketing_campaigns mc ON ma.campaign_id = mc.id 
                    WHERE ma.user_id = ? OR ma.user_id = 1 
                    ORDER BY ma.created_at DESC LIMIT 50`, [userId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    // ═══════════════════════════════════════════════════════════
    // NETTOYAGE DÉMO
    // ═══════════════════════════════════════════════════════════

    clearDemoData(userId = 1) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM marketing_actions WHERE user_id = ? OR user_id = 1', [userId]);
                db.run('DELETE FROM marketing_campaigns WHERE user_id = ? OR user_id = 1', [userId], function(err) {
                    if (err) return reject(err);
                    resolve({ success: true, count: this.changes });
                });
            });
        });
    }
};

module.exports = marketingService;
