const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const multer = require('multer');
const db = require('./database');
const { fetchNewEmails } = require('./imapService');
const { sendReply, sendNewMessage, buildSignature } = require('./smtpService');
const { getMailAccountsFromSettings } = require('./mailAccounts');
const { generateReply } = require('./aiService');
const crmService = require('./crmService');
require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('Erreur non interceptee:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Promesse non interceptee:', reason);
});

const { authMiddleware } = require('./authMiddleware');

const settingsRoutes = require('./settingsRoutes');
const authRoutes = require('./authRoutes');

// --- NOUVEAU MODULE: FINANCE IA ---
const financeRoutes = require('./routes/finance.routes');
const emailParserService = require('./services/emailParser.service');

const app = express();

// ─── CORS (prod: FRONTEND_URL, dev: localhost:5173) ─────────────────────────
const allowedOrigins = [
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:3002',
  'http://interne.renovboat.com',
  'https://interne.renovboat.com',
  'http://www.interne.renovboat.com',
  'https://www.interne.renovboat.com',
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()),
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour l'origine: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger middleware pour debugger la connectivité
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms (Origin: ${req.headers.origin || 'N/A'})`);
    });
    next();
});

// Route de santé publique (pour que les points indicateurs passent au vert sans auth)
app.get('/api-public/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Routes publiques
app.use('/api/auth', authRoutes);

// Routes protégées par défaut en global (sauf auth)
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth')) return next();
    return authMiddleware(req, res, next);
});

// Routes Paramètres
app.use('/api/settings', settingsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/marketing', require('./routes/marketing.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/prospects', require('./routes/prospect.routes'));
app.use('/api/quotes', require('./routes/quotes.routes'));

// Exposer les produits PrestaShop pour les devis
const prestashopService = require('./prestashopService');
app.get('/api/prestashop/products', async (req, res) => {
    try {
        const products = await prestashopService.getProducts();
        res.json(products);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dossiers Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({ dest: 'uploads/' });

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

async function getUserMailAccounts(userId) {
    const settings = await dbGet(`
        SELECT
            user_id,
            imap_host,
            imap_port,
            imap_user,
            imap_pass,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass,
            smtp_accounts,
            smtp_default_sender,
            nom
        FROM user_settings
        WHERE user_id = ?
    `, [userId]).catch(() => ({}));
    return getMailAccountsFromSettings(settings || {});
}

function mailboxFilterClause(account) {
    if (!account) return { clause: '', params: [] };
    const params = [account.id, account.email];
    let clause = ' AND (mailbox_id = ? OR mailbox_address = ?';
    if (account.id === 'legacy') {
        clause += " OR mailbox_id IS NULL OR mailbox_id = ''";
    }
    clause += ')';
    return { clause, params };
}

async function recordSentMail({ userId, sender, to, subject, text, html, replyToMailId = null }) {
    const senderEmail = sender?.sender?.email || sender?.info?.envelope?.from || sender?.user || '';
    const senderId = sender?.sender?.id || null;
    const now = new Date().toISOString();

    await dbRun(
        `INSERT INTO emails (
            uid, from_address, to_address, subject, content, html_content,
            categorie, priorite, status, resume, date_reception, action_recommandee,
            is_business, user_id, mailbox_id, mailbox_address, raw_imap_uid, direction
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            null,
            senderEmail,
            to,
            subject || 'Sans objet',
            text || '',
            html || null,
            'envoye',
            'normal',
            'sent',
            replyToMailId ? `Reponse envoyee a ${to}` : `Message envoye a ${to}`,
            now,
            'Envoye',
            0,
            userId,
            senderId,
            senderEmail,
            replyToMailId ? String(replyToMailId) : null,
            'sent',
        ]
    );
}

// ═══════════════════════════════════════════════════════════
// ROUTES EMAILS
// ═══════════════════════════════════════════════════════════

// Dashboard Stats
app.get('/api/stats', (req, res) => {
    db.get(`
        SELECT 
            SUM(CASE WHEN priorite = 'urgent' AND status = 'a_repondre' THEN 1 ELSE 0 END) as urgents,
            SUM(CASE WHEN status = 'a_repondre' THEN 1 ELSE 0 END) as a_traiter,
            SUM(CASE WHEN status = 'traite' THEN 1 ELSE 0 END) as traites,
            SUM(CASE WHEN categorie = 'facture' THEN 1 ELSE 0 END) as factures
        FROM emails WHERE user_id = ? AND (direction IS NULL OR direction != 'sent')
    `, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err });
        res.json({
            urgents:   row.urgents   || 0,
            a_traiter: row.a_traiter || 0,
            traites:   row.traites   || 0,
            factures:  row.factures  || 0
        });
    });
});

app.get('/api/mailboxes', async (req, res) => {
    try {
        const accounts = await getUserMailAccounts(req.user.id);
        const counts = await dbAll(`
            SELECT
                COALESCE(mailbox_id, 'legacy') as mailbox_id,
                COALESCE(mailbox_address, '') as mailbox_address,
                SUM(CASE WHEN direction = 'sent' THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN direction IS NULL OR direction != 'sent' THEN 1 ELSE 0 END) as inbox_count
            FROM emails
            WHERE user_id = ?
            GROUP BY COALESCE(mailbox_id, 'legacy'), COALESCE(mailbox_address, '')
        `, [req.user.id]);

        const countFor = (account, field) => counts
            .filter(row => row.mailbox_id === account.id || String(row.mailbox_address).toLowerCase() === String(account.email).toLowerCase() || (account.id === 'legacy' && row.mailbox_id === 'legacy'))
            .reduce((sum, row) => sum + Number(row[field] || 0), 0);

        res.json(accounts.map(account => ({
            id: account.id,
            label: account.label,
            email: account.email,
            canReceive: account.receive_enabled !== false,
            canSend: account.send_enabled !== false,
            isDefault: account.is_default,
            inboxCount: countFor(account, 'inbox_count'),
            sentCount: countFor(account, 'sent_count'),
        })));
    } catch (error) {
        res.status(500).json({ error: error.message || 'Impossible de charger les boites mail.' });
    }
});

// Lister les emails avec filtres
app.get('/api/emails', async (req, res) => {
    const { categorie, status, priorite, search, mailbox, folder } = req.query;
    let query = "SELECT * FROM emails WHERE user_id = ?";
    let params = [req.user.id];
    const isSentFolder = folder === 'sent';

    if (isSentFolder) {
        query += " AND direction = 'sent'";
    } else {
        query += " AND (direction IS NULL OR direction != 'sent')";
    }

    if (mailbox && mailbox !== 'all') {
        const accounts = await getUserMailAccounts(req.user.id);
        const account = accounts.find(item => item.id === mailbox || item.email === mailbox);
        const mailboxFilter = mailboxFilterClause(account || { id: mailbox, email: mailbox });
        query += mailboxFilter.clause;
        params.push(...mailboxFilter.params);
    }

    if (categorie && categorie !== 'tous') { 
        if (categorie === 'opportunite') {
             query += " AND is_business = 1";
        } else {
             query += " AND categorie = ?"; params.push(categorie); 
        }
    }
    if (!isSentFolder && status && status !== 'tous') { query += " AND status = ?";    params.push(status);    }
    if (priorite)                          { query += " AND priorite = ?";  params.push(priorite);  }
    if (search) {
        query += " AND (from_address LIKE ? OR to_address LIKE ? OR subject LIKE ? OR content LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }

    query += " ORDER BY date_reception DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
});

// Détail d'un email
app.get('/api/emails/:id', (req, res) => {
    db.get("SELECT * FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Non trouvé" });
        res.json(row);
    });
});

// Mise à jour du statut
app.patch('/api/emails/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE emails SET status = ? WHERE id = ?", [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true, id: req.params.id, status });
    });
});

// Envoyer une réponse SMTP
app.post('/api/emails/:id/reply', upload.array('attachments'), async (req, res) => {
    const { message, senderId } = req.body;
    const files = req.files || [];
    
    // Convertir les fichiers multer en format attendu par nodemailer
    const attachments = files.map(file => ({
        filename: file.originalname,
        path: file.path
    }));

    try {
        const info = await sendReply(req.params.id, message, attachments, req.user.id, senderId);
        const originalMail = await dbGet("SELECT from_address, subject FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]).catch(() => null);
        if (originalMail) {
            await recordSentMail({
                userId: req.user.id,
                sender: info,
                to: originalMail.from_address,
                subject: `Re: ${originalMail.subject || 'Sans objet'}`,
                text: info.bodies?.text || message,
                html: info.bodies?.html || null,
                replyToMailId: req.params.id,
            }).catch(err => console.warn('[sent-mail] Sauvegarde reponse impossible:', err.message));
        }
        db.run("UPDATE emails SET status = 'traite' WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
        
        // Optionnel : nettopayer les fichiers du dossier uploads/ après l'envoi
        files.forEach(f => {
            try { fs.unlinkSync(f.path); } catch (e) {}
        });

        res.json({ success: true, message: "Email expédié !", info });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Envoyer un NOUVEAU message
app.post('/api/emails/compose', upload.array('attachments'), async (req, res) => {
    const { to, subject, message, senderId } = req.body;
    const files = req.files || [];
    
    const attachments = files.map(file => ({
        filename: file.originalname,
        path: file.path
    }));

    try {
        const info = await sendNewMessage(to, subject, message, attachments, req.user.id, null, senderId);
        await recordSentMail({
            userId: req.user.id,
            sender: info,
            to,
            subject,
            text: info.bodies?.text || message,
            html: info.bodies?.html || null,
        }).catch(err => console.warn('[sent-mail] Sauvegarde message impossible:', err.message));
        
        // Nettoyer les fichiers uploadés temporaires
        files.forEach(f => {
            try { fs.unlinkSync(f.path); } catch (e) {}
        });

        res.json({ success: true, message: "Email envoyé !", info });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Synchronisation manuelle IMAP
app.post('/api/sync', async (req, res) => {
    try {
        const result = await fetchNewEmails(req.user.id);
        const statusCode = result?.errors?.length && Number(result.imported || 0) === 0 ? 500 : 200;
        res.status(statusCode).json({
            success: statusCode < 400,
            skipped: !!result?.skipped,
            ...result,
            message: result?.skipped
                ? "Une synchronisation est déjà en cours."
                : result?.errors?.length
                    ? "Synchronisation terminée avec erreurs."
                : "Synchronisation effectuée."
        });
    } catch (error) {
        console.error("Erreur sync IMAP manuelle:", error.message);
        res.status(500).json({ success: false, error: error.message || "Synchronisation impossible." });
    }
});

// Auto-Pilote IA
app.post('/api/autopilot', async (req, res) => {
    // Archiver selon recommandation IA ou présence de "noreply"
    const query = "UPDATE emails SET status = 'archive' WHERE user_id = ? AND (action_recommandee = 'Archiver' OR LOWER(from_address) LIKE '%noreply%') AND status != 'archive'";
    db.run(query, [req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.toString() });
        const archivedCount = this.changes;
        res.json({ success: true, archived: archivedCount, message: `Auto-Pilote : ${archivedCount} emails inintéressants archivés.` });
    });
});

// ═══════════════════════════════════════════════════════════
// ROUTES IA
// ═══════════════════════════════════════════════════════════

// Re-générer les réponses IA pour un mail existant avec style
app.post('/api/ai/generate-reply/:id', async (req, res) => {
    const { style } = req.body;
    db.get("SELECT * FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], async (err, mail) => {
        if (err || !mail) return res.status(404).json({ error: "Mail introuvable" });

        try {
            console.log(`🤖 [IA] Re-génération des réponses pour mail #${req.params.id} (Style: ${style || 'Normal'})`);
            const result = await generateReply(mail.subject, mail.content, mail.from_address, style, req.user.id);

            // Mettre à jour les colonnes en base
            db.run(
                `UPDATE emails SET 
                    resume = ?,
                    reponse_formelle = ?,
                    reponse_amicale = ?,
                    reponse_rapide = ?
                WHERE id = ?`,
                [result.resume, result.reponse_formelle, result.reponse_amicale, result.reponse_rapide, req.params.id],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ error: updateErr.toString() });
                    res.json({
                        success: true,
                        resume:            result.resume,
                        reponse_formelle:  result.reponse_formelle,
                        reponse_amicale:   result.reponse_amicale,
                        reponse_rapide:    result.reponse_rapide
                    });
                }
            );
        } catch (aiError) {
            console.error("❌ [IA] Erreur re-génération:", aiError.message);
            res.status(500).json({ error: aiError.message });
        }
    });
});

// ═══════════════════════════════════════════════════════════
// ROUTES PIÈCES JOINTES
// ═══════════════════════════════════════════════════════════

// Télécharger une pièce jointe
// GET /api/emails/:id/attachments/:filename
app.get('/api/emails/:id/attachments/:filename', (req, res) => {
    db.get("SELECT uid, attachments FROM emails WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Mail introuvable" });

        let attachments = [];
        try { attachments = JSON.parse(row.attachments || '[]'); } catch(e) {}

        const att = attachments.find(a => a.filename === req.params.filename);
        if (!att) return res.status(404).json({ error: "Pièce jointe introuvable" });

        // Vérifier que le fichier existe sur disque
        if (!fs.existsSync(att.path)) {
            return res.status(404).json({ error: "Fichier introuvable sur le serveur" });
        }

        // Forcer le téléchargement (Content-Disposition: attachment)
        res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
        res.setHeader('Content-Type', att.contentType || 'application/octet-stream');
        
        // Streamer le fichier directement depuis le disque
        const fileStream = fs.createReadStream(att.path);
        fileStream.on('error', () => res.status(500).json({ error: "Erreur lecture fichier" }));
        fileStream.pipe(res);
    });
});

// Prévisualiser une pièce jointe (inline pour images et PDFs)
// GET /api/emails/:id/attachments/:filename/preview
app.get('/api/emails/:id/attachments/:filename/preview', (req, res) => {
    db.get("SELECT uid, attachments FROM emails WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Mail introuvable" });

        let attachments = [];
        try { attachments = JSON.parse(row.attachments || '[]'); } catch(e) {}

        const att = attachments.find(a => a.filename === req.params.filename);
        if (!att || !fs.existsSync(att.path)) {
            return res.status(404).json({ error: "Fichier introuvable" });
        }

        // Inline pour preview (navigateur affiche, ne télécharge pas)
        res.setHeader('Content-Disposition', `inline; filename="${att.filename}"`);
        res.setHeader('Content-Type', att.contentType || 'application/octet-stream');

        const fileStream = fs.createReadStream(att.path);
        fileStream.on('error', () => res.status(500).json({ error: "Erreur lecture fichier" }));
        fileStream.pipe(res);
    });
});

// ═══════════════════════════════════════════════════════════
// ROUTES CRM
// ═══════════════════════════════════════════════════════════

app.get('/api/crm/clients', async (req, res) => {
    try {
        const clients = await crmService.getClients(req.user.id);
        res.json(clients);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

app.get('/api/crm/clients/:id', async (req, res) => {
    try {
        // PrestaShop est global, mais on mixe avec l'historique de l'utilisateur courant
        const client = await crmService.getClientById(req.params.id, req.user.id);
        const orders = await crmService.getOrdersByClient(req.params.id);
        res.json({ client, orders });
    } catch (err) {
        res.status(404).json({ error: err.toString() });
    }
});

// CRM - Envoi d'email
app.post('/api/crm/send-email', async (req, res) => {
    const { to, subject, message, clientId, type, senderId } = req.body;
    if (!to || !subject || !message) {
        return res.status(400).json({ error: "Champs manquants (to, subject, message)" });
    }

    try {
        console.log(`📨 Tentative d'envoi d'un email CRM à: ${to}`);

        // Récupérer la signature et l'illustration depuis les settings
        const userSettings = await new Promise(resolve => {
            db.get('SELECT signature_email, signature_is_html, signature_photo, signature_illustration FROM user_settings WHERE user_id = ?',
                [req.user.id], (err, row) => resolve(row || {}));
        });

        const signature = buildSignature(userSettings);
        const bodyHtml = message.replace(/\n/g, '<br>');

        // Construire le HTML de l'email avec illustration en bas
        const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:30px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Corps du message -->
        <tr><td style="padding:36px 40px;font-size:15px;line-height:1.7;color:#1e293b;">
          ${bodyHtml}
        </td></tr>
        ${signature.html ? `<tr><td style="background:#f1f5f9;padding:20px 40px;border-top:3px solid #3b82f6;">${signature.html}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body></html>`;

        await sendNewMessage(to, subject, message, [], req.user.id, htmlBody, senderId);
        
        // Log de l'activité si on a un ID client
        if (clientId) {
            let label = "Email envoyé";
            let icon = "send";
            
            if (type === 'promo') { label = "Offre promotionnelle envoyée"; icon = "tag"; }
            else if (type === 'vip') { label = "Invitation VIP envoyée"; icon = "star"; }
            else if (type === 'relance') { label = "Email de relance envoyé"; icon = "clock"; }
            
            await crmService.logActivity(clientId, type || 'email', label, message, icon, req.user.id);
        }

        res.json({ success: true, message: "Email envoyé avec succès" });
    } catch (err) {
        console.error("❌ Erreur envoi email CRM:", err);
        res.status(500).json({ error: err.message || "Erreur lors de l'envoi de l'email via SMTP" });
    }
});


// ═══════════════════════════════════════════════════════════
// ROUTES DASHBOARD (REAL PRESTASHOP)
// ═══════════════════════════════════════════════════════════

const dashboardService = require('./dashboardService');

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = await dashboardService.getStats(req.query.range || 'day');
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

app.get('/api/dashboard/sales', async (req, res) => {
    try {
        const history = await dashboardService.getSalesHistory();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

app.get('/api/dashboard/top-products', async (req, res) => {
    try {
        const top = await dashboardService.getTopProducts();
        res.json(top);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

app.get('/api/dashboard/alerts', async (req, res) => {
    try {
        const alerts = await dashboardService.getAlertsData(req.user.id);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

app.post('/api/dashboard/dismiss-cart', (req, res) => {
    const { cartId } = req.body;
    if (!cartId) return res.status(400).json({ error: "cartId manquant" });
    
    db.run("INSERT OR IGNORE INTO dismissed_carts (user_id, cart_id) VALUES (?, ?)", [req.user.id, cartId], function(err) {
        if (err) return res.status(500).json({ error: err.toString() });
        res.json({ success: true, message: "Panier masqué." });
    });
});

app.post('/api/dashboard/dismiss-suggestion', (req, res) => {
    const { suggestionId } = req.body;
    if (!suggestionId) return res.status(400).json({ error: "suggestionId manquant" });
    
    db.run("INSERT OR IGNORE INTO dismissed_suggestions (user_id, suggestion_id) VALUES (?, ?)", [req.user.id, suggestionId], function(err) {
        if (err) return res.status(500).json({ error: err.toString() });
        res.json({ success: true, message: "Suggestion masquée." });
    });
});

app.post('/api/dashboard/dismiss-all-suggestions', (req, res) => {
    const { suggestionIds } = req.body;
    if (!suggestionIds || !Array.isArray(suggestionIds)) return res.status(400).json({ error: "suggestionIds (array) manquant" });
    
    if (suggestionIds.length === 0) {
        return res.json({ success: true, message: "Aucune suggestion à vider." });
    }

    const placeholders = suggestionIds.map(() => "(?, ?)").join(", ");
    const params = [];
    suggestionIds.forEach(id => {
        params.push(req.user.id, id);
    });

    db.run(`INSERT OR IGNORE INTO dismissed_suggestions (user_id, suggestion_id) VALUES ${placeholders}`, params, function(err) {
        if (err) return res.status(500).json({ error: err.toString() });
        res.json({ success: true, message: "Suggestions masquées." });
    });
});

app.get('/api/dashboard/suggestions', async (req, res) => {
    try {
        const suggs = await dashboardService.getAiSuggestions(req.user.id);
        res.json(suggs);
    } catch (err) {
        res.status(500).json({ error: err.toString() });
    }
});

// ═══════════════════════════════════════════════════════════
// SERVEUR STATIQUE (NautiPost)
// ═══════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname, '..'), { index: 'index.html' }));

app.use((err, req, res, next) => {
    console.error('[express]', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.status || err.statusCode || 500).json({
        error: err.message || 'Erreur interne serveur',
    });
});

// ═══════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════
cron.schedule('*/30 * * * * *', () => {
    console.log("⏰ Vérification des nouveaux mails OVH...");
    fetchNewEmails().catch(err => console.error("Erreur sync IMAP planifiee:", err.message));
});

// Analyse automatique des emails pour les factures (Toutes les 6 Heures)
cron.schedule('0 */6 * * *', () => {
    console.log("⏰ Lancement auto du scanner de factures IA (6h)...");
    emailParserService.extractInvoicesFromEmails(1)
        .then(res => console.log(`👉 Scanner terminé: ${res.processed} factures importées.`))
        .catch(err => console.error("Erreur Scanner Factures:", err.message));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Serveur Backend OVH+IA démarré sur http://localhost:${PORT}`);
    fetchNewEmails().catch(err => console.error("Erreur sync IMAP initiale:", err.message));
});

