const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const cron = require('node-cron');
const multer = require('multer');
const db = require('./database');
const { fetchNewEmails, backfillEmailAttachments } = require('./imapService');
const { sendReply, sendNewMessage, buildSignature } = require('./smtpService');
const { getMailAccountsFromSettings } = require('./mailAccounts');
const { ATTACHMENTS_DIR, isInsideDirectory, resolveStoredAttachmentPath } = require('./attachmentStorage');
const { generateReply } = require('./aiService');
const crmService = require('./crmService');

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
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.groq.com https://api.x.ai; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self' blob: data:"
  );
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    index: false,
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    },
}));

const uploadMaxBytes = Number.parseInt(process.env.MOBYWORK_UPLOAD_MAX_BYTES || String(10 * 1024 * 1024), 10);
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: Number.isFinite(uploadMaxBytes) && uploadMaxBytes > 0 ? uploadMaxBytes : 10 * 1024 * 1024,
        files: 8,
    },
});

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
    const id = String(account.id || '').trim();
    const email = normalizeMailboxAddress(account.email);
    const clauses = [];
    const params = [];

    if (email) {
        clauses.push("LOWER(COALESCE(mailbox_address, '')) = ?");
        params.push(email);
    }
    if (id) {
        clauses.push("(mailbox_id = ? AND (mailbox_address IS NULL OR mailbox_address = ''))");
        params.push(id);
    }
    if (id === 'legacy') {
        clauses.push("((mailbox_id IS NULL OR mailbox_id = '') AND (mailbox_address IS NULL OR mailbox_address = ''))");
    }

    return clauses.length > 0
        ? { clause: ` AND (${clauses.join(' OR ')})`, params }
        : { clause: ' AND 1 = 0', params: [] };
}

function mailboxesFilterClause(accounts = []) {
    const clauses = [];
    const params = [];

    accounts.forEach(account => {
        const filter = mailboxFilterClause(account);
        if (!filter.clause || filter.clause === ' AND 1 = 0') return;
        clauses.push(filter.clause.replace(/^ AND /, ''));
        params.push(...filter.params);
    });

    return clauses.length > 0
        ? { clause: ` AND (${clauses.join(' OR ')})`, params }
        : { clause: ' AND 1 = 0', params: [] };
}

function rowBelongsToMailbox(row, account) {
    const rowAddress = normalizeMailboxAddress(row.mailbox_address);
    const rowMailboxId = String(row.mailbox_id || '').trim();
    const accountAddress = normalizeMailboxAddress(account.email);
    const accountId = String(account.id || '').trim();

    if (rowAddress) return rowAddress === accountAddress;
    if (accountId && rowMailboxId === accountId) return true;
    return accountId === 'legacy' && (!rowMailboxId || rowMailboxId === 'legacy');
}

async function recordSentMail({ userId, sender, to, cc = '', bcc = '', subject, text, html, replyToMailId = null }) {
    const senderEmail = sender?.sender?.email || sender?.info?.envelope?.from || sender?.user || '';
    const senderId = sender?.sender?.id || null;
    const now = new Date().toISOString();

    await dbRun(
        `INSERT INTO emails (
            uid, from_address, to_address, cc_address, bcc_address, subject, content, html_content,
            categorie, priorite, status, resume, date_reception, action_recommandee,
            is_business, user_id, mailbox_id, mailbox_address, raw_imap_uid, direction
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            null,
            senderEmail,
            to,
            cc || '',
            bcc || '',
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

function normalizeThreadSubject(subject = '') {
    return String(subject || '')
        .replace(/^(\s*(re|fw|fwd|tr)\s*:\s*)+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function extractEmails(value = '') {
    const matches = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    return Array.from(new Set((matches || []).map(email => email.toLowerCase())));
}

function rowEmails(row = {}) {
    return Array.from(new Set([
        ...extractEmails(row.from_address),
        ...extractEmails(row.to_address),
        ...extractEmails(row.cc_address),
        ...extractEmails(row.bcc_address),
        ...extractEmails(row.mailbox_address),
    ]));
}

function sameThread(base, candidate, counterpartEmails) {
    const baseSubject = normalizeThreadSubject(base.subject);
    const candidateSubject = normalizeThreadSubject(candidate.subject);
    if (!baseSubject || !candidateSubject || baseSubject !== candidateSubject) return false;
    if (Number(base.id) === Number(candidate.id)) return true;

    const candidateEmails = rowEmails(candidate);
    return counterpartEmails.length === 0 || counterpartEmails.some(email => candidateEmails.includes(email));
}

function normalizeMailboxAddress(value = '') {
    return String(value || '').trim().toLowerCase();
}

function rawImapUidForDeletion(row = {}) {
    const rawUid = String(row.raw_imap_uid || '').trim();
    if (rawUid) return rawUid;

    const storedUid = String(row.uid || '').trim();
    if (!storedUid) return '';

    if (/^\d+$/.test(storedUid) && storedUid.length > 10) {
        const suffix = storedUid.slice(-10).replace(/^0+/, '');
        return suffix || '0';
    }

    return storedUid;
}

async function getAllowedMailboxAddresses(userId) {
    const accounts = await getUserMailAccounts(userId);
    return accounts
        .map(account => normalizeMailboxAddress(account.email))
        .filter(Boolean);
}

async function resolveMailboxAddress(userId, mailbox) {
    const accounts = await getUserMailAccounts(userId);
    const requested = normalizeMailboxAddress(mailbox);
    const account = accounts.find(item =>
        normalizeMailboxAddress(item.id) === requested ||
        normalizeMailboxAddress(item.email) === requested
    );
    return normalizeMailboxAddress(account?.email || requested);
}

function parseAttachments(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function resolveAttachmentPath(att = {}) {
    return resolveStoredAttachmentPath(att.path);
}

function cleanupEmailAttachments(rows = []) {
    const touchedDirs = new Set();

    rows.forEach(row => {
        parseAttachments(row.attachments).forEach(att => {
            const filePath = resolveAttachmentPath(att);
            if (!filePath) return;
            touchedDirs.add(path.dirname(filePath));
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (error) {
                console.warn('[attachments] Suppression fichier impossible:', error.message);
            }
        });
    });

    touchedDirs.forEach(dir => {
        try {
            if (isInsideDirectory(dir, ATTACHMENTS_DIR) && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
                fs.rmdirSync(dir);
            }
        } catch (error) {
            console.warn('[attachments] Nettoyage dossier impossible:', error.message);
        }
    });
}

// ═══════════════════════════════════════════════════════════
// ROUTES EMAILS
// ═══════════════════════════════════════════════════════════

// Dashboard Stats
app.get('/api/stats', async (req, res) => {
    try {
        const accounts = await getUserMailAccounts(req.user.id);
        const mailboxFilter = mailboxesFilterClause(accounts);
        const row = await dbGet(`
        SELECT 
            SUM(CASE WHEN priorite = 'urgent' AND status = 'a_repondre' THEN 1 ELSE 0 END) as urgents,
            SUM(CASE WHEN status = 'a_repondre' THEN 1 ELSE 0 END) as a_traiter,
            SUM(CASE WHEN status = 'traite' THEN 1 ELSE 0 END) as traites,
            SUM(CASE WHEN categorie = 'facture' THEN 1 ELSE 0 END) as factures
        FROM emails WHERE user_id = ? AND (direction IS NULL OR direction != 'sent')
        ${mailboxFilter.clause}
    `, [req.user.id, ...mailboxFilter.params]);
        res.json({
            urgents:   row.urgents   || 0,
            a_traiter: row.a_traiter || 0,
            traites:   row.traites   || 0,
            factures:  row.factures  || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Impossible de charger les stats mail.' });
    }
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
            .filter(row => rowBelongsToMailbox(row, account))
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

app.get('/api/mail-folders', async (req, res) => {
    try {
        const allowedMailboxes = await getAllowedMailboxAddresses(req.user.id);
        if (allowedMailboxes.length === 0) return res.json([]);

        let mailboxes = allowedMailboxes;
        if (req.query.mailbox && req.query.mailbox !== 'all') {
            const selected = await resolveMailboxAddress(req.user.id, req.query.mailbox);
            mailboxes = allowedMailboxes.includes(selected) ? [selected] : [];
        }
        if (mailboxes.length === 0) return res.json([]);

        const placeholders = mailboxes.map(() => '?').join(',');
        const folders = await dbAll(
            `SELECT *
             FROM mail_folders
             WHERE LOWER(mailbox_address) IN (${placeholders})
             ORDER BY mailbox_address ASC, name ASC`,
            mailboxes
        );

        const counts = await dbAll(
            `SELECT folder_id, COUNT(*) as count
             FROM emails
             WHERE user_id = ? AND folder_id IS NOT NULL
             GROUP BY folder_id`,
            [req.user.id]
        );
        const countsByFolder = new Map(counts.map(row => [Number(row.folder_id), Number(row.count || 0)]));

        res.json(folders.map(folder => ({
            ...folder,
            count: countsByFolder.get(Number(folder.id)) || 0,
        })));
    } catch (error) {
        res.status(500).json({ error: error.message || 'Impossible de charger les dossiers.' });
    }
});

app.post('/api/mail-folders', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const color = String(req.body?.color || '#3b82f6').trim().slice(0, 32);
    const mailbox = String(req.body?.mailbox || '').trim();

    if (!name || name.length > 80 || !mailbox) {
        return res.status(400).json({ error: 'Nom ou boite mail invalide.' });
    }

    try {
        const mailboxAddress = await resolveMailboxAddress(req.user.id, mailbox);
        const allowedMailboxes = await getAllowedMailboxAddresses(req.user.id);
        if (!allowedMailboxes.includes(mailboxAddress)) {
            return res.status(403).json({ error: 'Boite mail non autorisee.' });
        }

        const result = await dbRun(
            `INSERT INTO mail_folders (mailbox_address, name, color, created_by, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [mailboxAddress, name, color, req.user.id, new Date().toISOString()]
        );

        const folder = await dbGet('SELECT * FROM mail_folders WHERE id = ?', [result.lastID]);
        res.status(201).json(folder);
    } catch (error) {
        const message = /duplicate|unique/i.test(error.message || '')
            ? 'Un dossier avec ce nom existe deja pour cette boite.'
            : (error.message || 'Creation du dossier impossible.');
        res.status(/existe deja/.test(message) ? 409 : 500).json({ error: message });
    }
});

app.delete('/api/mail-folders/:id', async (req, res) => {
    try {
        const folder = await dbGet('SELECT * FROM mail_folders WHERE id = ?', [req.params.id]);
        if (!folder) return res.status(404).json({ error: 'Dossier introuvable.' });

        const allowedMailboxes = await getAllowedMailboxAddresses(req.user.id);
        if (!allowedMailboxes.includes(normalizeMailboxAddress(folder.mailbox_address))) {
            return res.status(403).json({ error: 'Dossier non autorise.' });
        }

        await dbRun('UPDATE emails SET folder_id = NULL WHERE folder_id = ?', [req.params.id]);
        await dbRun('DELETE FROM mail_folder_assignments WHERE folder_id = ?', [req.params.id]);
        await dbRun('DELETE FROM mail_folders WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Suppression du dossier impossible.' });
    }
});

// Lister les emails avec filtres
app.get('/api/emails', async (req, res) => {
    const { categorie, status, priorite, search, mailbox, folder, folderId, unfiled } = req.query;
    let query = "SELECT * FROM emails WHERE user_id = ?";
    let params = [req.user.id];
    const isSentFolder = folder === 'sent';
    const customFolderId = folderId ? Number(folderId) : null;
    const onlyUnfiled = ['1', 'true', 'yes'].includes(String(unfiled || '').toLowerCase());

    if (isSentFolder) {
        query += " AND direction = 'sent'";
    } else {
        query += " AND (direction IS NULL OR direction != 'sent')";
    }

    const accounts = await getUserMailAccounts(req.user.id);
    if (mailbox && mailbox !== 'all') {
        const account = accounts.find(item => item.id === mailbox || item.email === mailbox);
        const mailboxFilter = mailboxFilterClause(account || { id: mailbox, email: mailbox });
        query += mailboxFilter.clause;
        params.push(...mailboxFilter.params);
    } else {
        const mailboxFilter = mailboxesFilterClause(accounts);
        query += mailboxFilter.clause;
        params.push(...mailboxFilter.params);
    }

    if (customFolderId) {
        const targetFolder = await dbGet('SELECT * FROM mail_folders WHERE id = ?', [customFolderId]).catch(() => null);
        const allowedMailboxes = await getAllowedMailboxAddresses(req.user.id);
        if (!targetFolder || !allowedMailboxes.includes(normalizeMailboxAddress(targetFolder.mailbox_address))) {
            return res.status(403).json({ error: 'Dossier non autorise.' });
        }
        query += ' AND folder_id = ?';
        params.push(customFolderId);
    } else if (onlyUnfiled && !isSentFolder) {
        query += ' AND folder_id IS NULL';
    }

    if (!customFolderId && categorie && categorie !== 'tous') {
        if (categorie === 'opportunite') {
             query += " AND is_business = 1";
        } else {
             query += " AND categorie = ?"; params.push(categorie); 
        }
    }
    if (!customFolderId && !isSentFolder && status && status !== 'tous') { query += " AND status = ?";    params.push(status);    }
    if (!customFolderId && priorite)                          { query += " AND priorite = ?";  params.push(priorite);  }
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
app.get('/api/emails/:id/thread', async (req, res) => {
    try {
        const base = await dbGet("SELECT * FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
        if (!base) return res.status(404).json({ error: "Non trouve" });

        const threadSubject = normalizeThreadSubject(base.subject);
        if (!threadSubject) {
            return res.json({ subject: '', counterpartEmails: [], count: 1, thread: [base] });
        }

        const accounts = await getUserMailAccounts(req.user.id).catch(() => []);
        const ownEmails = new Set(
            accounts
                .map(account => String(account.email || '').toLowerCase())
                .filter(Boolean)
        );
        if (base.mailbox_address) ownEmails.add(String(base.mailbox_address).toLowerCase());

        const baseEmails = rowEmails(base);
        let counterpartEmails = baseEmails.filter(email => !ownEmails.has(email));
        if (counterpartEmails.length === 0) counterpartEmails = baseEmails;

        const candidates = await dbAll(
            `SELECT *
             FROM emails
             WHERE user_id = ?
               AND subject IS NOT NULL
               AND LOWER(subject) LIKE ?
             ORDER BY date_reception ASC
             LIMIT 500`,
            [req.user.id, `%${threadSubject.slice(0, 80).toLowerCase()}%`]
        );

        const thread = candidates.filter(candidate => sameThread(base, candidate, counterpartEmails));
        if (!thread.some(candidate => Number(candidate.id) === Number(base.id))) {
            thread.push(base);
        }

        thread.sort((a, b) => new Date(a.date_reception || 0) - new Date(b.date_reception || 0));

        res.json({
            subject: threadSubject,
            counterpartEmails,
            count: thread.length,
            thread,
        });
    } catch (error) {
        res.status(500).json({ error: error.message || "Impossible de charger l'historique." });
    }
});

app.get('/api/emails/:id', (req, res) => {
    db.get("SELECT * FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Non trouvé" });
        res.json(row);
    });
});

// Mise à jour du statut
app.post('/api/emails/:id/attachments/sync', async (req, res) => {
    try {
        const result = await backfillEmailAttachments(req.user.id, req.params.id);
        const statusCode = result.success ? 200 : 500;
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Impossible de verifier les pieces jointes.',
        });
    }
});

app.patch('/api/emails/bulk/status', async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map(id => Number(id)).filter(Number.isFinite)
        : [];
    const status = String(req.body?.status || '').trim();
    const allowedStatuses = new Set(['a_repondre', 'traite', 'archive']);

    if (ids.length === 0 || !allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Selection ou statut invalide.' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        const result = await dbRun(
            `UPDATE emails SET status = ? WHERE user_id = ? AND id IN (${placeholders})`,
            [status, req.user.id, ...ids]
        );
        res.json({ success: true, updated: result.changes || 0, status });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Mise a jour groupee impossible.' });
    }
});

app.patch('/api/emails/bulk/folder', async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map(id => Number(id)).filter(Number.isFinite)
        : [];
    const folderId = req.body?.folderId === null || req.body?.folderId === '' || req.body?.folderId === undefined
        ? null
        : Number(req.body.folderId);

    if (ids.length === 0 || (folderId !== null && !Number.isFinite(folderId))) {
        return res.status(400).json({ error: 'Selection ou dossier invalide.' });
    }

    try {
        const allowedMailboxes = await getAllowedMailboxAddresses(req.user.id);
        let targetFolder = null;
        let targetMailbox = null;

        if (folderId !== null) {
            targetFolder = await dbGet('SELECT * FROM mail_folders WHERE id = ?', [folderId]);
            if (!targetFolder) return res.status(404).json({ error: 'Dossier introuvable.' });
            targetMailbox = normalizeMailboxAddress(targetFolder.mailbox_address);
            if (!allowedMailboxes.includes(targetMailbox)) {
                return res.status(403).json({ error: 'Dossier non autorise.' });
            }
        }

        const placeholders = ids.map(() => '?').join(',');
        const rows = await dbAll(
            `SELECT id, mailbox_address, raw_imap_uid
             FROM emails
             WHERE user_id = ? AND id IN (${placeholders})`,
            [req.user.id, ...ids]
        );

        let updated = 0;
        let skipped = 0;

        for (const row of rows) {
            const mailboxAddress = normalizeMailboxAddress(row.mailbox_address);
            if (!mailboxAddress || !allowedMailboxes.includes(mailboxAddress)) {
                skipped += 1;
                continue;
            }
            if (targetMailbox && mailboxAddress !== targetMailbox) {
                skipped += 1;
                continue;
            }

            const rawUid = String(row.raw_imap_uid || '').trim();
            if (rawUid) {
                await dbRun(
                    'UPDATE emails SET folder_id = ? WHERE LOWER(mailbox_address) = ? AND raw_imap_uid = ?',
                    [folderId, mailboxAddress, rawUid]
                );
                await dbRun(
                    'DELETE FROM mail_folder_assignments WHERE LOWER(mailbox_address) = ? AND raw_imap_uid = ?',
                    [mailboxAddress, rawUid]
                );
                if (folderId !== null) {
                    await dbRun(
                        `INSERT INTO mail_folder_assignments (mailbox_address, raw_imap_uid, folder_id, assigned_by, assigned_at)
                         VALUES (?, ?, ?, ?, ?)`,
                        [mailboxAddress, rawUid, folderId, req.user.id, new Date().toISOString()]
                    );
                }
            } else {
                await dbRun(
                    'UPDATE emails SET folder_id = ? WHERE user_id = ? AND id = ?',
                    [folderId, req.user.id, row.id]
                );
            }
            updated += 1;
        }

        res.json({ success: true, updated, skipped, folderId });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Classement groupe impossible.' });
    }
});

app.delete('/api/emails/bulk', async (req, res) => {
    const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map(id => Number(id)).filter(Number.isFinite)
        : [];

    if (ids.length === 0) {
        return res.status(400).json({ error: 'Selection invalide.' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        const rows = await dbAll(
            `SELECT id, CAST(uid AS CHAR) AS uid, mailbox_address, CAST(raw_imap_uid AS CHAR) AS raw_imap_uid, attachments
             FROM emails
             WHERE user_id = ? AND status = 'archive' AND id IN (${placeholders})`,
            [req.user.id, ...ids]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Aucun mail archive dans la selection.' });
        }

        const deletedAt = new Date().toISOString();
        for (const row of rows) {
            const mailboxAddress = normalizeMailboxAddress(row.mailbox_address);
            const rawUid = rawImapUidForDeletion(row);
            if (!mailboxAddress || !rawUid) continue;

            await dbRun(
                `INSERT OR IGNORE INTO mail_deleted_messages (
                    mailbox_address, raw_imap_uid, deleted_by, deleted_at
                ) VALUES (?, ?, ?, ?)`,
                [mailboxAddress, rawUid, req.user.id, deletedAt]
            );
            await dbRun(
                'DELETE FROM mail_folder_assignments WHERE LOWER(mailbox_address) = ? AND raw_imap_uid = ?',
                [mailboxAddress, rawUid]
            );
        }

        cleanupEmailAttachments(rows);
        const result = await dbRun(
            `DELETE FROM emails WHERE user_id = ? AND status = 'archive' AND id IN (${placeholders})`,
            [req.user.id, ...ids]
        );
        res.json({ success: true, deleted: result.changes || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Suppression definitive impossible.' });
    }
});

app.patch('/api/emails/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE emails SET status = ? WHERE id = ? AND user_id = ?", [status, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true, id: req.params.id, status });
    });
});

// Envoyer une réponse SMTP
app.post('/api/emails/:id/reply', upload.array('attachments'), async (req, res) => {
    const { message, senderId, to = '', cc = '', bcc = '' } = req.body;
    const files = req.files || [];
    
    // Convertir les fichiers multer en format attendu par nodemailer
    const attachments = files.map(file => ({
        filename: file.originalname,
        path: file.path
    }));

    try {
        const info = await sendReply(req.params.id, message, attachments, req.user.id, senderId, cc, bcc, to);
        const originalMail = await dbGet("SELECT from_address, subject FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]).catch(() => null);
        if (originalMail) {
            await recordSentMail({
                userId: req.user.id,
                sender: info,
                to: info.to || to || originalMail.from_address,
                cc,
                bcc,
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
    const { to, cc = '', bcc = '', subject, message, senderId } = req.body;
    const files = req.files || [];
    
    const attachments = files.map(file => ({
        filename: file.originalname,
        path: file.path
    }));

    try {
        const info = await sendNewMessage(to, subject, message, attachments, req.user.id, null, senderId, cc, bcc);
        await recordSentMail({
            userId: req.user.id,
            sender: info,
            to,
            cc,
            bcc,
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
        const result = await fetchNewEmails(req.user.id, { attachmentBackfillLimit: 50 });
        const statusCode = result?.errors?.length
            && Number(result.imported || 0) === 0
            && Number(result.attachmentsChecked || 0) === 0
            ? 500
            : 200;
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
                WHERE id = ? AND user_id = ?`,
                [result.resume, result.reponse_formelle, result.reponse_amicale, result.reponse_rapide, req.params.id, req.user.id],
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
    db.get("SELECT uid, attachments FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Mail introuvable" });

        const attachments = parseAttachments(row.attachments);

        const att = attachments.find(a => a.filename === req.params.filename);
        const filePath = resolveAttachmentPath(att || {});
        if (!att) return res.status(404).json({ error: "Pièce jointe introuvable" });

        // Vérifier que le fichier existe sur disque
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Fichier introuvable sur le serveur" });
        }

        // Forcer le téléchargement (Content-Disposition: attachment)
        res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
        res.setHeader('Content-Type', att.contentType || 'application/octet-stream');
        
        // Streamer le fichier directement depuis le disque
        const fileStream = fs.createReadStream(filePath);
        fileStream.on('error', () => res.status(500).json({ error: "Erreur lecture fichier" }));
        fileStream.pipe(res);
    });
});

// Prévisualiser une pièce jointe (inline pour images et PDFs)
// GET /api/emails/:id/attachments/:filename/preview
app.get('/api/emails/:id/attachments/:filename/preview', (req, res) => {
    db.get("SELECT uid, attachments FROM emails WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Mail introuvable" });

        const attachments = parseAttachments(row.attachments);

        const att = attachments.find(a => a.filename === req.params.filename);
        const filePath = resolveAttachmentPath(att || {});
        if (!att || !filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Fichier introuvable" });
        }

        // Inline pour preview (navigateur affiche, ne télécharge pas)
        res.setHeader('Content-Disposition', `inline; filename="${att.filename}"`);
        res.setHeader('Content-Type', att.contentType || 'application/octet-stream');

        const fileStream = fs.createReadStream(filePath);
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
const AUTO_SYNC_ACCOUNTS_PER_TICK = Math.max(1, Number(process.env.MOBYWORK_AUTO_SYNC_ACCOUNTS_PER_TICK || 1));
const AUTO_SYNC_ENABLED = String(process.env.MOBYWORK_AUTO_SYNC_ENABLED || '1') !== '0';
const SYNC_ON_START = String(process.env.MOBYWORK_SYNC_ON_START || '0') === '1';

if (AUTO_SYNC_ENABLED) {
    cron.schedule('*/30 * * * * *', () => {
        console.log("⏰ Vérification des nouveaux mails OVH...");
        fetchNewEmails(null, { limitAccounts: AUTO_SYNC_ACCOUNTS_PER_TICK })
            .catch(err => console.error("Erreur sync IMAP planifiee:", err.message));
    });
} else {
    console.log('Synchronisation IMAP automatique desactivee (MOBYWORK_AUTO_SYNC_ENABLED=0).');
}

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
    if (SYNC_ON_START) {
        fetchNewEmails(null, { limitAccounts: AUTO_SYNC_ACCOUNTS_PER_TICK })
            .catch(err => console.error("Erreur sync IMAP initiale:", err.message));
    }
});

