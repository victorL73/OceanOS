const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateQuotePdf } = require('../services/quotePdf.service');
const { getSharedCompanySettings } = require('../flowceanAccounts');

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function sqlDate(value = new Date()) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
}

function parseLines(linesJson) {
    try {
        const lines = JSON.parse(linesJson || '[]');
        return Array.isArray(lines) ? lines : [];
    } catch {
        return [];
    }
}

async function getQuoteSettings(userId) {
    const localSettings = await dbGet(`
        SELECT
            nom,
            quote_company_name,
            quote_company_address,
            quote_company_city,
            quote_company_phone,
            quote_company_email,
            quote_company_siret,
            quote_payment_terms,
            quote_validity_days,
            quote_footer_note
        FROM user_settings
        WHERE user_id = ?
    `, [userId]) || {};
    const sharedCompany = await getSharedCompanySettings().catch(() => ({}));

    return {
        ...localSettings,
        quote_company_name: sharedCompany.companyName || localSettings.quote_company_name || '',
        quote_company_address: sharedCompany.companyAddress || localSettings.quote_company_address || '',
        quote_company_city: sharedCompany.companyCity || localSettings.quote_company_city || '',
        quote_company_phone: sharedCompany.companyPhone || localSettings.quote_company_phone || '',
        quote_company_email: sharedCompany.companyEmail || localSettings.quote_company_email || '',
        quote_company_siret: sharedCompany.companySiret || localSettings.quote_company_siret || '',
        quote_payment_terms: sharedCompany.paymentTerms || localSettings.quote_payment_terms || '',
        quote_validity_days: sharedCompany.quoteValidityDays || localSettings.quote_validity_days || 30,
        quote_footer_note: sharedCompany.footerNote || localSettings.quote_footer_note || '',
    };
}

async function saveQuotePdf(quote, userId) {
    const settings = await getQuoteSettings(userId);
    const pdf = generateQuotePdf(quote, settings);
    const generatedAt = sqlDate();
    await dbRun(
        `UPDATE quotes SET pdf_file_path = ?, pdf_generated_at = ?, date_updated = ? WHERE id = ? AND user_id = ?`,
        [pdf.relativePath, generatedAt, generatedAt, quote.id, userId]
    );
    return { ...pdf, generatedAt };
}

// Recuperer tous les devis
router.get('/', async (req, res) => {
    try {
        const rows = await dbAll(`SELECT * FROM quotes WHERE user_id = ? ORDER BY date_updated DESC`, [req.user.id]);
        res.json(rows.map((row) => ({
            ...row,
            lines: parseLines(row.lines_json),
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Creer un devis et generer sa copie PDF locale
router.post('/', async (req, res) => {
    const userId = req.user.id;
    const { client_id, client_name, client_email, status, lines, total_ht, total_ttc } = req.body;
    const safeLines = Array.isArray(lines) ? lines : [];
    const linesJson = JSON.stringify(safeLines);
    const year = new Date().getFullYear();

    try {
        const row = await dbGet(`SELECT COUNT(*) as count FROM quotes WHERE user_id = ? AND reference LIKE ?`, [userId, `DEV-${year}-%`]);
        const nextId = (row?.count || 0) + 1;
        const reference = `DEV-${year}-${String(nextId).padStart(4, '0')}`;
        const insert = await dbRun(
            `INSERT INTO quotes (user_id, client_id, client_name, client_email, reference, status, total_ht, total_ttc, lines_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, client_id, client_name, client_email, reference, status || 'Brouillon', total_ht || 0, total_ttc || 0, linesJson]
        );

        const quote = {
            id: insert.lastID,
            user_id: userId,
            client_id,
            client_name,
            client_email,
            reference,
            status: status || 'Brouillon',
            total_ht: total_ht || 0,
            total_ttc: total_ttc || 0,
            lines: safeLines,
            date_created: sqlDate(),
        };

        let pdf = null;
        try {
            pdf = await saveQuotePdf(quote, userId);
        } catch (pdfErr) {
            console.error('[Quotes] Generation PDF impossible:', pdfErr.message);
        }

        res.json({
            success: true,
            id: insert.lastID,
            reference,
            pdf_file_path: pdf?.relativePath || null,
            pdf_generated_at: pdf?.generatedAt || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mettre a jour un devis et regenerer sa copie PDF locale
router.put('/:id', async (req, res) => {
    const userId = req.user.id;
    const quoteId = req.params.id;
    const { client_id, client_name, client_email, status, lines, total_ht, total_ttc } = req.body;
    const safeLines = Array.isArray(lines) ? lines : [];
    const linesJson = JSON.stringify(safeLines);
    const dateUpdated = sqlDate();

    try {
        const update = await dbRun(
            `UPDATE quotes SET client_id=?, client_name=?, client_email=?, status=?, total_ht=?, total_ttc=?, lines_json=?, date_updated=? WHERE id=? AND user_id=?`,
            [client_id, client_name, client_email, status, total_ht, total_ttc, linesJson, dateUpdated, quoteId, userId]
        );
        if (update.changes === 0) return res.status(404).json({ error: 'Quote not found' });

        const existing = await dbGet(`SELECT reference, date_created FROM quotes WHERE id=? AND user_id=?`, [quoteId, userId]);
        let pdf = null;
        try {
            pdf = await saveQuotePdf({
                id: quoteId,
                user_id: userId,
                client_id,
                client_name,
                client_email,
                reference: existing?.reference || `DEV-${quoteId}`,
                status: status || 'Brouillon',
                total_ht: total_ht || 0,
                total_ttc: total_ttc || 0,
                lines: safeLines,
                date_created: existing?.date_created || dateUpdated,
            }, userId);
        } catch (pdfErr) {
            console.error('[Quotes] Regeneration PDF impossible:', pdfErr.message);
        }

        res.json({
            success: true,
            changes: update.changes,
            pdf_file_path: pdf?.relativePath || null,
            pdf_generated_at: pdf?.generatedAt || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Supprimer un devis
router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const quoteId = req.params.id;

    db.run(`DELETE FROM quotes WHERE id=? AND user_id=?`, [quoteId, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Quote not found' });
        res.json({ success: true, changes: this.changes });
    });
});

module.exports = router;
