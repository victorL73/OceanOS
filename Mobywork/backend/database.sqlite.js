const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'emails.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error("Erreur d'ouverture DB:", err);
    console.log("✅ Connecté au moteur SQLite local");
});

db.serialize(() => {
    // Création de la table des utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        nom TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Création de la table des paramètres par utilisateur
    db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        imap_host TEXT,
        imap_port INTEGER,
        imap_user TEXT,
        imap_pass TEXT,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Graine du premier Super Admin automatiquement (Mot de passe: admin123)
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err && row.count === 0) {
            console.log('🌱 Création du premier utilisateur Administrateur par défaut...');
            db.run(`INSERT INTO users (email, password_hash, nom, role) VALUES ('admin@moby.com', '$2b$10$FR5VFY.WBEaahIDHyo8k6.tyM1TQt9qWvELreoKcqC8P.uS/OAGBu', 'Super Admin', 'admin')`, function(err) {
                if (!err) {
                    db.run(`INSERT INTO user_settings (user_id) VALUES (?)`, [this.lastID]);
                }
            });
        }
    });

    // Création de la table principale
    db.run(`CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid INTEGER UNIQUE,
        from_address TEXT,
        subject TEXT,
        content TEXT,
        categorie TEXT,
        priorite TEXT,
        status TEXT DEFAULT 'a_repondre',
        resume TEXT,
        reponse_suggeree TEXT,
        date_reception DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mail_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_address TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(mailbox_address, name)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mail_folder_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_address TEXT NOT NULL,
        raw_imap_uid TEXT NOT NULL,
        folder_id INTEGER NOT NULL,
        assigned_by INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(mailbox_address, raw_imap_uid)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mail_deleted_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_address TEXT NOT NULL,
        raw_imap_uid TEXT NOT NULL,
        deleted_by INTEGER,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(mailbox_address, raw_imap_uid)
    )`);

    // Table pour l'historique des actions CRM
    db.run(`CREATE TABLE IF NOT EXISTS crm_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clientId INTEGER,
        type TEXT,
        label TEXT,
        message TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        icon TEXT
    )`);

    // Table pour les paniers abandonnés ignorés sur le tableau de bord
    db.run(`CREATE TABLE IF NOT EXISTS dismissed_carts (
        user_id INTEGER,
        cart_id INTEGER,
        PRIMARY KEY (user_id, cart_id)
    )`);

    // Table pour les suggestions IA ignorées
    db.run(`CREATE TABLE IF NOT EXISTS dismissed_suggestions (
        user_id INTEGER,
        suggestion_id TEXT,
        PRIMARY KEY (user_id, suggestion_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS mail_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_id INTEGER NOT NULL,
        mailbox_address TEXT,
        from_address TEXT,
        subject TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        dismissed_at DATETIME,
        UNIQUE(user_id, email_id)
    )`);

    // Table pour les factures extraites des emails
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        amount REAL,
        supplier TEXT,
        date TEXT,
        category TEXT,
        email_id INTEGER UNIQUE
    )`);

    // Table pour les devis
    db.run(`CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        client_id INTEGER,
        client_name TEXT,
        client_email TEXT,
        reference TEXT UNIQUE,
        status TEXT DEFAULT 'Brouillon',
        total_ht REAL DEFAULT 0,
        total_ttc REAL DEFAULT 0,
        lines_json TEXT,
        date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
        date_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        pdf_file_path TEXT,
        pdf_generated_at DATETIME
    )`);

    // Migrations : Ajout des colonnes pour la facturation et les réponses multiples
    [
        { name: "pdf_file_path", type: "TEXT" },
        { name: "pdf_generated_at", type: "DATETIME" }
    ].forEach(col => {
        db.run(`ALTER TABLE quotes ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err && !err.message.includes("duplicate column name")) {
                console.warn(`Info Migration quotes [${col.name}]:`, err.message);
            }
        });
    });

    const columnsToMigrate = [
        { name: "amount",          type: "REAL" },
        { name: "due_date",        type: "TEXT" },
        { name: "reponse_formelle",type: "TEXT" },
        { name: "reponse_amicale", type: "TEXT" },
        { name: "reponse_rapide",  type: "TEXT" },
        { name: "html_content",    type: "TEXT" },
        { name: "attachments",     type: "TEXT" },  // JSON: [{filename, contentType, size, path}]
        { name: "attachments_checked_at", type: "DATETIME" },
        { name: "action_recommandee", type: "TEXT" },
        { name: "is_business",     type: "INTEGER" },
        { name: "is_advertising",  type: "INTEGER DEFAULT 0" },
        { name: "user_id",         type: "INTEGER DEFAULT 1" },
        { name: "mailbox_id",      type: "TEXT" },
        { name: "mailbox_address", type: "TEXT" },
        { name: "raw_imap_uid",    type: "TEXT" },
        { name: "direction",       type: "TEXT DEFAULT 'inbound'" },
        { name: "to_address",      type: "TEXT" },
        { name: "cc_address",      type: "TEXT" },
        { name: "bcc_address",     type: "TEXT" },
        { name: "folder_id",       type: "INTEGER" }
    ];

    columnsToMigrate.forEach(col => {
        db.run(`ALTER TABLE emails ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (!err.message.includes("duplicate column name")) {
                    console.warn(`Info Migration emails [${col.name}]:`, err.message);
                }
            } else {
                console.log(`🛠️ Migration : Colonne ${col.name} ajoutée à emails.`);
            }
        });
    });

    // Migration CRM activities
    db.run(`ALTER TABLE crm_activities ADD COLUMN user_id INTEGER DEFAULT 1`, (err) => {
        if (err) {
            if (!err.message.includes("duplicate column name")) {
                console.warn(`Info Migration crm_activities [user_id]:`, err.message);
            }
        } else {
            console.log(`🛠️ Migration : Colonne user_id ajoutée à crm_activities.`);
        }
    });
    // Migration user_settings : nouvelles colonnes
    const settingsColumns = [
        { name: 'nom',                   type: 'TEXT' },
        { name: 'poste',                 type: 'TEXT' },
        { name: 'smtp_accounts',         type: 'TEXT' },
        { name: 'smtp_default_sender',   type: 'TEXT' },
        { name: 'signature_email',       type: 'TEXT' },
        { name: 'signature_is_html',     type: 'INTEGER DEFAULT 0' },
        { name: 'signature_photo',       type: 'TEXT' },
        { name: 'ai_tone',               type: "TEXT DEFAULT 'professionnel'" },
        { name: 'ai_langue',             type: "TEXT DEFAULT 'fr'" },
        { name: 'crm_template_promo',    type: 'TEXT' },
        { name: 'crm_template_vip',      type: 'TEXT' },
        { name: 'crm_template_relance',  type: 'TEXT' },
        { name: 'ps_api_url',            type: 'TEXT' },
        { name: 'ps_api_key',            type: 'TEXT' },
        { name: 'autopilot_archive_noreply',  type: "INTEGER DEFAULT 1" },
        { name: 'autopilot_archive_promo',    type: "INTEGER DEFAULT 1" },
        { name: 'autopilot_delay_relance',    type: "INTEGER DEFAULT 3" },
        { name: 'notif_panier_abandon',       type: "INTEGER DEFAULT 1" },
        { name: 'notif_stock_critique',       type: "INTEGER DEFAULT 1" },
        { name: 'notif_email_sans_reponse',   type: "INTEGER DEFAULT 1" },
        { name: 'finance_expense_coef',       type: "REAL DEFAULT 1.15" },
        { name: 'finance_client_delay',       type: "INTEGER DEFAULT 30" },
        { name: 'finance_supplier_delay',     type: "INTEGER DEFAULT 30" },
        { name: 'signature_illustration',     type: 'TEXT' },
        { name: 'marketing_target_roas',     type: 'REAL DEFAULT 3.0' },
        { name: 'marketing_auto_pilot',      type: 'INTEGER DEFAULT 0' },
        { name: 'marketing_daily_budget',    type: 'REAL DEFAULT 50.0' },
        { name: 'marketing_google_ads_id',   type: 'TEXT' },
        { name: 'marketing_meta_ads_id',     type: 'TEXT' },
        { name: 'marketing_tiktok_ads_id',   type: 'TEXT' },
        // Template Devis
        { name: 'quote_company_name',        type: 'TEXT' },
        { name: 'quote_company_address',     type: 'TEXT' },
        { name: 'quote_company_city',        type: 'TEXT' },
        { name: 'quote_company_phone',       type: 'TEXT' },
        { name: 'quote_company_email',       type: 'TEXT' },
        { name: 'quote_company_siret',       type: 'TEXT' },
        { name: 'quote_company_logo',        type: 'TEXT' },
        { name: 'quote_payment_terms',       type: 'TEXT' },
        { name: 'quote_validity_days',       type: 'INTEGER DEFAULT 30' },
        { name: 'quote_footer_note',         type: 'TEXT' },
        { name: 'quote_html_template',       type: 'TEXT' },
    ];
    settingsColumns.forEach(col => {
        db.run(`ALTER TABLE user_settings ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.warn(`Info Migration user_settings [${col.name}]:`, err.message);
            }
        });
    });
    // ═══════════════════════════════════════════════════════════
    // TABLES MARKETING IA
    // ═══════════════════════════════════════════════════════════
    db.run(`CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        platform TEXT DEFAULT 'google',
        type TEXT DEFAULT 'search',
        budget_daily REAL DEFAULT 10,
        spent REAL DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        revenue REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        score TEXT DEFAULT 'B',
        audience_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketing_audiences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'custom',
        size INTEGER DEFAULT 0,
        source TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'active',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketing_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        condition_metric TEXT,
        condition_operator TEXT,
        condition_value REAL,
        action_type TEXT,
        action_value TEXT,
        mode TEXT DEFAULT 'manual',
        enabled INTEGER DEFAULT 1,
        last_triggered DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS marketing_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        action_type TEXT,
        description TEXT,
        source TEXT DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER DEFAULT 1
    )`);

    // Seed données mock Marketing
    db.get('SELECT COUNT(*) as count FROM marketing_campaigns', (err, row) => {
        if (!err && row && row.count === 0) {
            console.log('🌱 Seed Marketing IA : Création des campagnes de démonstration...');
            const campaigns = [
                ['Search - Winch Lewmar 44ST', 'google', 'search', 25, 487, 12400, 198, 23, 1196, 'active', 'A', 1],
                ['Retargeting Visiteurs Site', 'meta', 'retargeting', 15, 312, 18500, 296, 31, 2121, 'active', 'A', 1],
                ['Display - Accastillage Pro', 'google', 'display', 30, 623, 45000, 430, 12, 1308, 'active', 'C', 1],
                ['Lookalike FR Plaisanciers', 'meta', 'lookalike', 20, 401, 22000, 264, 18, 1360, 'active', 'B', 1],
                ['Search - Peinture Bateau', 'google', 'search', 18, 289, 8900, 156, 19, 912, 'paused', 'A', 1],
                ['Instagram Stories Nautique', 'meta', 'stories', 12, 198, 31000, 186, 6, 228, 'active', 'D', 1],
                ['Shopping - Cordages Marine', 'google', 'shopping', 22, 356, 15200, 212, 15, 735, 'active', 'B', 1],
                ['Audience Custom Acheteurs', 'meta', 'custom_audience', 8, 124, 9800, 147, 9, 468, 'active', 'B', 1],
            ];
            const stmt = db.prepare('INSERT INTO marketing_campaigns (name, platform, type, budget_daily, spent, impressions, clicks, conversions, revenue, status, score, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            campaigns.forEach(c => stmt.run(c));
            stmt.finalize();

            // Audiences mock
            const audiences = [
                ['Plaisanciers 35-65 ans', 'interest', 45000, 'google', 'active', 'Propriétaires de bateaux, intérêt voile/moteur'],
                ['Visiteurs site 30j', 'retargeting', 3200, 'pixel', 'active', 'Visiteurs du site dans les 30 derniers jours'],
                ['Lookalike Acheteurs FR', 'lookalike', 120000, 'crm', 'active', 'Audience similaire aux clients existants'],
                ['Acheteurs récents 90j', 'custom', 890, 'crm', 'active', 'Clients ayant acheté dans les 90 derniers jours'],
                ['Abandons panier', 'retargeting', 450, 'pixel', 'active', 'Visiteurs ayant abandonné leur panier'],
            ];
            const stmtAud = db.prepare('INSERT INTO marketing_audiences (name, type, size, source, status, description) VALUES (?,?,?,?,?,?)');
            audiences.forEach(a => stmtAud.run(a));
            stmtAud.finalize();

            // Règles mock
            const rules = [
                ['ROAS élevé → Augmenter budget', 'roas', '>', 4.0, 'increase_budget', '20', 'semi_auto', 1],
                ['ROAS faible → Pause campagne', 'roas', '<', 1.5, 'pause', null, 'manual', 1],
                ['CPC trop élevé → Alerte', 'cpc', '>', 1.5, 'alert', 'CPC anormalement élevé', 'auto', 1],
                ['CTR faible → Notification', 'ctr', '<', 1.0, 'alert', 'CTR sous le seuil minimum', 'auto', 0],
            ];
            const stmtRule = db.prepare('INSERT INTO marketing_rules (name, condition_metric, condition_operator, condition_value, action_type, action_value, mode, enabled) VALUES (?,?,?,?,?,?,?,?)');
            rules.forEach(r => stmtRule.run(r));
            stmtRule.finalize();

            // Actions historique mock
            const actions = [
                [1, 'budget_increase', 'Budget augmenté de 20% (ROAS 5.2x)', 'ia'],
                [3, 'alert', 'Alerte CPC élevé détectée (1.45€)', 'ia'],
                [2, 'budget_increase', 'Budget augmenté de 10%', 'manual'],
                [6, 'score_downgrade', 'Score passé de C à D — performances en baisse', 'ia'],
                [5, 'pause', 'Campagne mise en pause pour optimisation', 'manual'],
            ];
            const stmtAct = db.prepare('INSERT INTO marketing_actions (campaign_id, action_type, description, source) VALUES (?,?,?,?)');
            actions.forEach(a => stmtAct.run(a));
            stmtAct.finalize();
        }
    });

    // ═══════════════════════════════════════════════════════════
    // TABLES PROSPECTION IA
    // ═══════════════════════════════════════════════════════════
    db.run(`CREATE TABLE IF NOT EXISTS prospects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT,
        email TEXT,
        phone TEXT,
        type TEXT,
        tags TEXT, -- JSON array
        status TEXT DEFAULT 'Nouveau', -- Nouveau, Nettoyé, À contacter, Email envoyé, Relance, Chaud, Perdu
        score INTEGER DEFAULT 0,
        source TEXT,
        raw_data TEXT,
        cleaned_data TEXT, -- JSON object
        last_contact_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER DEFAULT 1
    )`);

    // Migration prospects : Ajout de colonnes pour filtres
    db.run(`ALTER TABLE prospects ADD COLUMN city TEXT`, (err) => {});
    db.run(`ALTER TABLE prospects ADD COLUMN country TEXT`, (err) => {});
    db.run(`ALTER TABLE prospects ADD COLUMN street TEXT`, (err) => {});
    db.run(`ALTER TABLE prospects ADD COLUMN comments TEXT`, (err) => {});
    db.run(`ALTER TABLE prospects ADD COLUMN category TEXT`, (err) => {});
    db.run(`ALTER TABLE prospects ADD COLUMN confidence INTEGER DEFAULT 0`, (err) => {});

    // Seed/Exemple Prospect
    db.get('SELECT COUNT(*) as count FROM prospects', (err, row) => {
        if (!err && row && row.count === 0) {
            console.log('🌱 Seed Prospection : Création d\'un prospect exemple...');
            db.run(`INSERT INTO prospects (company_name, email, type, status, score, city, country, user_id) 
                    VALUES ('Chantier Naval de l''Atlantique', 'contact@atlantique-naval.fr', 'chantier naval', 'Nouveau', 85, 'Saint-Nazaire', 'France', 1)`);
        }
    });
});

module.exports = db;
