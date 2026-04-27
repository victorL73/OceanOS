const express = require('express');
const db = require('./database');
const { authMiddleware, adminMiddleware } = require('./authMiddleware');
const { getSharedCompanySettings, getSharedPrestashopSettings } = require('./flowceanAccounts');
const { getAvailableSenders } = require('./smtpService');

const router = express.Router();
router.use(authMiddleware);

const ALL_FIELDS = [
    'imap_host', 'imap_port', 'imap_user', 'imap_pass',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_accounts', 'smtp_default_sender',
    'nom', 'poste', 'signature_email', 'signature_is_html', 'signature_photo', 'signature_illustration',
    'ai_tone', 'ai_langue',
    'crm_template_promo', 'crm_template_vip', 'crm_template_relance',
    'ps_api_url', 'ps_api_key',
    'autopilot_archive_noreply', 'autopilot_archive_promo', 'autopilot_delay_relance',
    'notif_panier_abandon', 'notif_stock_critique', 'notif_email_sans_reponse',
    'finance_expense_coef', 'finance_client_delay', 'finance_supplier_delay',
    'marketing_target_roas', 'marketing_auto_pilot', 'marketing_daily_budget',
    'marketing_google_ads_id', 'marketing_meta_ads_id', 'marketing_tiktok_ads_id',
    'quote_company_logo', 'quote_html_template',
];

function quoteSettingsFromCompany(settings = {}) {
    return {
        quote_company_name: settings.companyName || '',
        quote_company_address: settings.companyAddress || '',
        quote_company_city: settings.companyCity || '',
        quote_company_phone: settings.companyPhone || '',
        quote_company_email: settings.companyEmail || '',
        quote_company_siret: settings.companySiret || '',
        quote_payment_terms: settings.paymentTerms || 'Virement bancaire a 30 jours',
        quote_validity_days: settings.quoteValidityDays || 30,
        quote_footer_note: settings.footerNote || 'Merci de votre confiance.',
        company_managed_by: 'OceanOS',
    };
}

router.get('/', async (req, res) => {
    const sharedCompany = await getSharedCompanySettings().catch(() => ({}));
    db.get(`SELECT ${ALL_FIELDS.join(',')} FROM user_settings WHERE user_id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message || 'Erreur lors de la recuperation des parametres' });
        res.json({ ...(row || {}), ...quoteSettingsFromCompany(sharedCompany) });
    });
});

router.get('/mail-senders', async (req, res) => {
    try {
        const senders = await getAvailableSenders(req.user.id);
        res.json(senders);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Impossible de charger les adresses email.' });
    }
});

router.post('/', (req, res) => {
    const fields = Object.keys(req.body).filter((key) => ALL_FIELDS.includes(key));
    if (fields.length === 0) {
        return res.json({ success: true, message: 'Rien a mettre a jour' });
    }

    db.get('SELECT user_id FROM user_settings WHERE user_id = ?', [req.user.id], (readErr, row) => {
        if (readErr) {
            console.error('[settings] read error:', readErr);
            return res.status(500).json({ error: readErr.message || 'Impossible de lire les parametres utilisateur' });
        }

        if (!row) {
            const insertColumns = ['user_id', ...fields];
            const placeholders = insertColumns.map(() => '?').join(', ');
            const insertValues = [req.user.id, ...fields.map((field) => req.body[field])];

            db.run(`INSERT INTO user_settings (${insertColumns.join(', ')}) VALUES (${placeholders})`, insertValues, function(insertErr) {
                if (insertErr) {
                    console.error('[settings] insert error:', insertErr);
                    return res.status(500).json({ error: insertErr.message || 'Impossible de creer les parametres utilisateur' });
                }
                res.json({ success: true, message: 'Parametres mis a jour' });
            });
            return;
        }

        const setClauses = fields.map((field) => `${field} = ?`).join(', ');
        const updateValues = fields.map((field) => req.body[field]);
        updateValues.push(req.user.id);

        db.run(`UPDATE user_settings SET ${setClauses} WHERE user_id = ?`, updateValues, function(updateErr) {
            if (updateErr) {
                console.error('[settings] update error:', updateErr);
                return res.status(500).json({ error: updateErr.message || 'Impossible de sauvegarder les parametres' });
            }
            res.json({ success: true, message: 'Parametres mis a jour' });
        });
    });
});

router.get('/status', async (req, res) => {
    try {
        const sharedPrestashop = await getSharedPrestashopSettings().catch(() => ({}));
        db.get('SELECT imap_host, imap_user, ps_api_url, ps_api_key FROM user_settings WHERE user_id = ?', [req.user.id], async (err, row) => {
            const status = {
                backend: true,
                imap: false,
                prestashop: !!(sharedPrestashop.shopUrl && sharedPrestashop.apiKey),
            };
            if (!err && row) {
                status.imap = !!(row.imap_host && row.imap_user);
                status.prestashop = status.prestashop || !!(row.ps_api_url && row.ps_api_key && row.ps_api_key.length > 5);
            }
            res.json(status);
        });
    } catch (e) {
        res.json({ backend: true, imap: false, prestashop: false });
    }
});

module.exports = router;
