const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./database');
const { analyzeEmail } = require('./aiService');
const { getReceiverAccountsFromSettings, storedImapUid } = require('./mailAccounts');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ATTACHMENTS_DIR = path.join(__dirname, 'attachments');
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

const IMAP_SOCKET_TIMEOUT_MS = Number(process.env.IMAP_SOCKET_TIMEOUT_MS || 30000);
let syncInProgress = false;

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

async function fetchNewEmails(userId = null) {
    if (syncInProgress) {
        console.log('[IMAP] Synchronisation deja en cours, cycle ignore.');
        return;
    }

    syncInProgress = true;
    try {
        await fetchNewEmailsInternal(userId);
    } finally {
        syncInProgress = false;
    }
}

async function getUserMailSettings(userId = null) {
    let query = `
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
            smtp_default_sender
        FROM user_settings
        WHERE imap_host IS NOT NULL OR smtp_accounts IS NOT NULL
    `;
    const params = [];

    if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
    }

    return dbAll(query, params).catch(() => []);
}

function safeAttachmentName(filename) {
    return filename
        ? filename.replace(/[^a-zA-Z0-9._\- ]/g, '_')
        : `attachment_${Date.now()}`;
}

async function saveAttachments(parsed, account, rawUid) {
    const attachmentsMeta = [];
    if (!parsed.attachments || parsed.attachments.length === 0) return attachmentsMeta;

    const mailDir = path.join(ATTACHMENTS_DIR, `${account.id}_${rawUid}`);
    if (!fs.existsSync(mailDir)) fs.mkdirSync(mailDir, { recursive: true });

    for (const att of parsed.attachments) {
        const safeName = safeAttachmentName(att.filename);
        const filePath = path.join(mailDir, safeName);

        try {
            fs.writeFileSync(filePath, att.content);
            attachmentsMeta.push({
                filename: safeName,
                contentType: att.contentType || 'application/octet-stream',
                size: att.size || att.content.length,
                path: filePath,
            });
            console.log(`[IMAP] Piece jointe sauvegardee: ${safeName} (${att.size || att.content.length} octets)`);
        } catch (e) {
            console.error(`[IMAP] Erreur sauvegarde piece jointe ${safeName}:`, e.message);
        }
    }

    return attachmentsMeta;
}

async function syncMailbox(userConfig, account) {
    console.log(`[IMAP] Connexion au compte ${account.email} (user ${userConfig.user_id})...`);

    let imapConnectionError = null;
    const client = new ImapFlow({
        host: account.host,
        port: parseInt(account.imap_port || 993, 10),
        secure: account.imap_secure !== false,
        auth: {
            user: account.user,
            pass: account.pass,
        },
        socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
        logger: false,
    });

    client.on('error', (err) => {
        imapConnectionError = err;
        console.error(`[IMAP] Erreur socket ${account.email} USER ${userConfig.user_id}:`, err.message);
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        try {
            const rows = await dbAll('SELECT uid FROM emails WHERE user_id = ?', [userConfig.user_id]);
            const existingUids = new Set(rows.map(row => String(row.uid)));

            const uidsToProcess = [];
            for await (const msg of client.fetch('1:*', { uid: true })) {
                const internalUid = storedImapUid(account, msg.uid);
                if (internalUid && !existingUids.has(internalUid)) {
                    uidsToProcess.push({ rawUid: msg.uid, internalUid });
                }
            }

            if (uidsToProcess.length === 0) {
                console.log(`[IMAP] Aucun nouveau message pour ${account.email}.`);
            }

            for (const uidInfo of uidsToProcess) {
                const msgSource = await client.fetchOne(uidInfo.rawUid, { source: true });
                const parsed = await simpleParser(msgSource.source);

                const fromAddr = parsed.from?.value[0]?.address || 'Expediteur inconnu';
                const toAddr = (parsed.to?.value || []).map(item => item.address).filter(Boolean).join(', ');
                const subject = parsed.subject || 'Sans objet';
                const content = parsed.text || 'Pas de contenu textuel';
                const htmlContent = parsed.html || null;
                const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
                const attachmentsMeta = await saveAttachments(parsed, account, uidInfo.rawUid);

                console.log(`[IA] Analyse du message entrant: [${account.email} UID ${uidInfo.rawUid}] ${subject}`);
                const aiResult = await analyzeEmail(subject, content.substring(0, 4000), fromAddr, userConfig.user_id);

                await dbRun(
                    `INSERT INTO emails (
                        uid, from_address, subject, content, html_content,
                        categorie, priorite, resume,
                        reponse_formelle, reponse_amicale, reponse_rapide,
                        amount, due_date, attachments, date_reception, action_recommandee, is_business,
                        user_id, mailbox_id, mailbox_address, raw_imap_uid, direction, to_address
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uidInfo.internalUid,
                        fromAddr,
                        subject,
                        content,
                        htmlContent,
                        aiResult.categorie,
                        aiResult.priorite,
                        aiResult.resume,
                        aiResult.reponse_formelle,
                        aiResult.reponse_amicale,
                        aiResult.reponse_rapide,
                        aiResult.amount,
                        aiResult.due_date,
                        JSON.stringify(attachmentsMeta),
                        date,
                        aiResult.action_recommandee || 'Repondre',
                        aiResult.is_business ? 1 : 0,
                        userConfig.user_id,
                        account.id,
                        account.email,
                        String(uidInfo.rawUid),
                        'inbound',
                        toAddr,
                    ]
                );

                console.log(`[IMAP] Mail [${account.email} UID ${uidInfo.rawUid}] enregistre (${aiResult.categorie} - ${aiResult.priorite}) | ${attachmentsMeta.length} PJ`);
            }
        } finally {
            lock.release();
        }

        try {
            await client.logout();
        } catch (logoutError) {
            console.warn(`[IMAP] Fermeture session ${account.email}:`, logoutError.message);
        }
    } catch (error) {
        try {
            client.close();
        } catch {}
        const finalError = error?.message ? error : imapConnectionError;
        console.error(`[IMAP] Erreur connexion ${account.email} USER ${userConfig.user_id}:`, finalError?.message || 'Erreur inconnue');
    }
}

async function fetchNewEmailsInternal(userId = null) {
    console.log(`[IMAP] Lancement de la synchronisation mail (Utilisateur: ${userId || 'TOUS'})...`);

    const usersToSync = await getUserMailSettings(userId);
    if (usersToSync.length === 0) {
        console.log('[IMAP] Aucun compte mail parametre pour la synchronisation.');
        return;
    }

    for (const userConfig of usersToSync) {
        const accountsToSync = getReceiverAccountsFromSettings(userConfig)
            .filter(account => account.host && account.user && account.pass);

        if (accountsToSync.length === 0) {
            console.log(`[IMAP] Aucun compte reception complet pour user ${userConfig.user_id}.`);
            continue;
        }

        for (const account of accountsToSync) {
            await syncMailbox(userConfig, account);
        }
    }
}

module.exports = { fetchNewEmails };
