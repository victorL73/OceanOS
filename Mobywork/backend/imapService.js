const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./database');
const { analyzeEmail } = require('./aiService');
const { getReceiverAccountsFromSettings, storedImapUid } = require('./mailAccounts');
const { ATTACHMENTS_DIR, ensureWritableDirectory } = require('./attachmentStorage');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const IMAP_SOCKET_TIMEOUT_MS = Number(process.env.IMAP_SOCKET_TIMEOUT_MS || 30000);
const ATTACHMENT_BACKFILL_LIMIT = Math.max(0, Number(process.env.MOBYWORK_ATTACHMENT_BACKFILL_LIMIT || 5));
let syncInProgress = false;
let scheduledSyncCursor = 0;

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
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

function normalizeMailboxAddress(value = '') {
    return String(value || '').trim().toLowerCase();
}

function truncateText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

function mailActionUrl(emailId) {
    return `/Mobywork/?module=mail&id=${encodeURIComponent(String(emailId))}&nav_ts=${Date.now()}`;
}

function formatParsedAddresses(addresses) {
    return (addresses?.value || [])
        .map(item => item.address)
        .filter(Boolean)
        .join(', ');
}

async function createMailNotification(userId, emailId, mailboxAddress, fromAddress, subject) {
    if (!userId || !emailId) return;

    try {
        await dbRun(
            `INSERT OR IGNORE INTO mail_notifications (
                user_id, email_id, mailbox_address, from_address, subject, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                emailId,
                normalizeMailboxAddress(mailboxAddress),
                fromAddress || '',
                subject || 'Sans objet',
                new Date().toISOString(),
            ]
        );
    } catch (error) {
        console.warn('[IMAP] Notification mail non creee:', error.message);
    }

    try {
        const title = truncateText(`Nouveau mail recu : ${subject || 'Sans objet'}`, 190);
        const body = truncateText(
            [
                fromAddress ? `De : ${fromAddress}` : '',
                mailboxAddress ? `Boite : ${mailboxAddress}` : '',
            ].filter(Boolean).join(' - '),
            1000
        );
        const payload = JSON.stringify({
            app: 'Mobywork',
            module: 'mail',
            emailId,
            mailboxAddress: normalizeMailboxAddress(mailboxAddress),
            fromAddress: fromAddress || '',
            subject: subject || 'Sans objet',
        });

        await dbRun(
            `INSERT INTO oceanos_notifications (
                user_id, actor_user_id, module, type, severity, title, body, action_url, dedupe_key, payload_json
            ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                module = VALUES(module),
                type = VALUES(type),
                severity = VALUES(severity),
                title = VALUES(title),
                body = VALUES(body),
                action_url = VALUES(action_url),
                payload_json = VALUES(payload_json),
                read_at = NULL,
                updated_at = CURRENT_TIMESTAMP`,
            [
                userId,
                'Mobywork',
                'mail_received',
                'info',
                title,
                body || null,
                mailActionUrl(emailId),
                `mobywork-mail-${emailId}`,
                payload,
            ]
        );
    } catch (error) {
        console.warn('[IMAP] Notification OceanOS non creee:', error.message);
    }
}

function getMailboxMessageKey(mailboxAddress, rawUid) {
    const mailbox = normalizeMailboxAddress(mailboxAddress);
    const uid = String(rawUid || '').trim();
    return mailbox && uid ? `${mailbox}:${uid}` : '';
}

async function getDeletedMessageKeysForMailbox(mailboxAddress) {
    const mailbox = normalizeMailboxAddress(mailboxAddress);
    if (!mailbox) return new Set();

    const rows = await dbAll(
        `SELECT mailbox_address, CAST(raw_imap_uid AS CHAR) AS raw_imap_uid
         FROM mail_deleted_messages
         WHERE mailbox_address = ?`,
        [mailbox]
    ).catch(error => {
        console.warn(`[IMAP] Liste des mails supprimes indisponible pour ${mailbox}:`, error.message);
        return [];
    });

    return new Set(
        rows
            .map(row => getMailboxMessageKey(row.mailbox_address || mailbox, row.raw_imap_uid))
            .filter(Boolean)
    );
}

function accountMatchesEmailRow(account, row) {
    const mailboxAddress = normalizeMailboxAddress(row.mailbox_address);
    return String(account.id || '') === String(row.mailbox_id || '')
        || (!!mailboxAddress && normalizeMailboxAddress(account.email) === mailboxAddress);
}

function isDuplicateEmailError(error) {
    const message = String(error?.message || error || '');
    return /duplicate entry/i.test(message) && /uniq_mobywork_emails_uid_user|uid_user/i.test(message);
}

async function resolveMappedFolderId(account, rawUid) {
    const mailboxAddress = normalizeMailboxAddress(account.email);
    if (!mailboxAddress || !rawUid) return null;

    const row = await dbGet(
        `SELECT folder_id
         FROM mail_folder_assignments
         WHERE mailbox_address = ? AND raw_imap_uid = ?`,
        [mailboxAddress, String(rawUid)]
    ).catch(() => null);

    return row?.folder_id || null;
}

function defaultEmailAnalysis(subject, fromAddr) {
    return {
        categorie: 'autre',
        priorite: 'normal',
        resume: `Mail recu de ${fromAddr || 'expediteur inconnu'} : ${subject || 'Sans objet'}`,
        reponse_formelle: '',
        reponse_amicale: '',
        reponse_rapide: '',
        amount: null,
        due_date: null,
        action_recommandee: 'Répondre',
        is_business: false,
        is_advertising: false,
    };
}

function scheduleEmailAnalysis(mailId, subject, content, fromAddr, userId) {
    if (!mailId) return;

    setTimeout(async () => {
        try {
            console.log(`[IA] Analyse differee du mail #${mailId}: ${subject || 'Sans objet'}`);
            const aiResult = await analyzeEmail(subject, String(content || '').substring(0, 4000), fromAddr, userId);
            await dbRun(
                `UPDATE emails
                 SET categorie = ?,
                     priorite = ?,
                     resume = ?,
                     reponse_formelle = ?,
                     reponse_amicale = ?,
                     reponse_rapide = ?,
                     amount = ?,
                     due_date = ?,
                     action_recommandee = ?,
                     is_business = ?,
                     is_advertising = ?
                 WHERE id = ? AND user_id = ?`,
                [
                    aiResult.categorie || 'autre',
                    aiResult.priorite || 'normal',
                    aiResult.resume || '',
                    aiResult.reponse_formelle || '',
                    aiResult.reponse_amicale || '',
                    aiResult.reponse_rapide || '',
                    aiResult.amount || null,
                    aiResult.due_date || null,
                    aiResult.action_recommandee || 'Répondre',
                    aiResult.is_business ? 1 : 0,
                    aiResult.is_advertising ? 1 : 0,
                    mailId,
                    userId,
                ]
            );
            console.log(`[IA] Analyse differee appliquee au mail #${mailId}`);
        } catch (error) {
            console.warn(`[IA] Analyse differee impossible pour mail #${mailId}:`, error.message || error);
        }
    }, 0);
}

async function fetchNewEmails(userId = null, options = {}) {
    if (syncInProgress) {
        console.log('[IMAP] Synchronisation deja en cours, cycle ignore.');
        return { success: true, skipped: true, reason: 'sync_in_progress' };
    }

    syncInProgress = true;
    try {
        const summary = await fetchNewEmailsInternal(userId, options);
        return { success: summary.errors.length === 0, skipped: false, ...summary };
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
    if (!ensureWritableDirectory(mailDir)) {
        console.warn(`[IMAP] Pieces jointes ignorees pour ${account.email} UID ${rawUid}: dossier non accessible.`);
        return attachmentsMeta;
    }

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

function parseAttachmentsMeta(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function shouldBackfillAttachments(row) {
    return !!row && !row.attachments_checked_at;
}

function attachmentsCheckedAt(parsed, attachmentsMeta) {
    const expectedCount = parsed.attachments?.length || 0;
    return expectedCount === 0 || attachmentsMeta.length >= expectedCount
        ? new Date().toISOString()
        : null;
}

async function backfillAttachmentsForExistingMail(client, account, row, rawUid, summary) {
    try {
        const msgSource = await client.fetchOne(rawUid, { source: true }, { uid: true });
        if (!msgSource?.source) {
            summary.errors.push(`UID ${rawUid}: source introuvable pour recuperer les pieces jointes`);
            return;
        }

        const parsed = await simpleParser(msgSource.source);
        const expectedCount = parsed.attachments?.length || 0;
        const attachmentsMeta = expectedCount > 0
            ? await saveAttachments(parsed, account, rawUid)
            : parseAttachmentsMeta(row.attachments);
        const checkedAt = attachmentsCheckedAt(parsed, attachmentsMeta);

        if (expectedCount > 0 && attachmentsMeta.length === 0 && !checkedAt) {
            summary.errors.push(`UID ${rawUid}: pieces jointes presentes mais non sauvegardees`);
            return;
        }

        await dbRun(
            `UPDATE emails
             SET attachments = ?,
                 attachments_checked_at = ?
             WHERE id = ? AND user_id = ?`,
            [
                JSON.stringify(attachmentsMeta),
                checkedAt,
                row.id,
                summary.userId,
            ]
        );

        summary.attachmentsChecked += 1;
        summary.attachmentsBackfilled += attachmentsMeta.length;
        if (attachmentsMeta.length > 0) {
            console.log(`[IMAP] Pieces jointes recuperees pour ${account.email} UID ${rawUid}: ${attachmentsMeta.length}`);
        }
    } catch (error) {
        const errorMessage = `UID ${rawUid}: PJ non recuperees (${error.message || error})`;
        summary.errors.push(errorMessage);
        console.error(`[IMAP] ${account.email} ${errorMessage}`);
    }
}

async function syncMailbox(userConfig, account, options = {}) {
    const attachmentBackfillLimit = Math.max(
        0,
        Number(options.attachmentBackfillLimit ?? ATTACHMENT_BACKFILL_LIMIT)
    );
    const summary = {
        userId: userConfig.user_id,
        mailboxId: account.id,
        mailbox: account.email,
        imported: 0,
        attachmentsChecked: 0,
        attachmentsBackfilled: 0,
        checked: 0,
        errors: [],
    };

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
            const rows = await dbAll(
                `SELECT
                    id,
                    user_id,
                    CAST(uid AS CHAR) AS uid,
                    mailbox_address,
                    CAST(raw_imap_uid AS CHAR) AS raw_imap_uid,
                    attachments,
                    attachments_checked_at
                 FROM emails
                 WHERE user_id = ? AND direction != 'sent'`,
                [userConfig.user_id]
            );
            const existingUids = new Set(rows.map(row => String(row.uid || '')).filter(Boolean));
            const existingByUid = new Map(rows.map(row => [String(row.uid || ''), row]).filter(([uid]) => uid));
            const existingByMessageKey = new Map(
                rows
                    .map(row => [getMailboxMessageKey(row.mailbox_address, row.raw_imap_uid), row])
                    .filter(([key]) => key)
            );
            const existingMessageKeys = new Set(existingByMessageKey.keys());
            const deletedMessageKeys = await getDeletedMessageKeysForMailbox(account.email);

            const uidsToProcess = [];
            const attachmentsToBackfill = [];
            for await (const msg of client.fetch('1:*', { uid: true })) {
                const internalUid = storedImapUid(account, msg.uid);
                const mailboxKey = getMailboxMessageKey(account.email, msg.uid);
                if (deletedMessageKeys.has(mailboxKey)) {
                    continue;
                }

                const existingRow = existingByMessageKey.get(mailboxKey)
                    || existingByUid.get(String(internalUid || ''));

                if (
                    internalUid &&
                    !existingUids.has(String(internalUid)) &&
                    !existingMessageKeys.has(mailboxKey)
                ) {
                    uidsToProcess.push({ rawUid: msg.uid, internalUid });
                } else if (
                    attachmentsToBackfill.length < attachmentBackfillLimit &&
                    shouldBackfillAttachments(existingRow)
                ) {
                    attachmentsToBackfill.push({ row: existingRow, rawUid: msg.uid });
                }
            }
            summary.checked = uidsToProcess.length;

            if (uidsToProcess.length === 0) {
                console.log(`[IMAP] Aucun nouveau message pour ${account.email}.`);
            }

            for (const uidInfo of uidsToProcess) {
                try {
                    const msgSource = await client.fetchOne(uidInfo.rawUid, { source: true }, { uid: true });
                    if (!msgSource?.source) {
                        console.warn(`[IMAP] Source introuvable pour ${account.email} UID ${uidInfo.rawUid}.`);
                        summary.errors.push(`UID ${uidInfo.rawUid}: source introuvable`);
                        continue;
                    }
                    const parsed = await simpleParser(msgSource.source);

                    const fromAddr = parsed.from?.value[0]?.address || 'Expediteur inconnu';
                    const toAddr = formatParsedAddresses(parsed.to);
                    const ccAddr = formatParsedAddresses(parsed.cc);
                    const bccAddr = formatParsedAddresses(parsed.bcc);
                    const subject = parsed.subject || 'Sans objet';
                    const content = parsed.text || 'Pas de contenu textuel';
                    const htmlContent = parsed.html || null;
                    const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
                    const attachmentsMeta = await saveAttachments(parsed, account, uidInfo.rawUid);
                    const checkedAt = attachmentsCheckedAt(parsed, attachmentsMeta);
                    const folderId = await resolveMappedFolderId(account, uidInfo.rawUid);

                    const aiResult = defaultEmailAnalysis(subject, fromAddr);

                    const insertResult = await dbRun(
                        `INSERT INTO emails (
                            uid, from_address, subject, content, html_content,
                            categorie, priorite, resume,
                            reponse_formelle, reponse_amicale, reponse_rapide,
                            amount, due_date, attachments, attachments_checked_at, date_reception, action_recommandee, is_business,
                            is_advertising, user_id, mailbox_id, mailbox_address, raw_imap_uid, direction, to_address, cc_address, bcc_address, folder_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                            checkedAt,
                            date,
                            aiResult.action_recommandee || 'Repondre',
                            aiResult.is_business ? 1 : 0,
                            aiResult.is_advertising ? 1 : 0,
                            userConfig.user_id,
                            account.id,
                            account.email,
                            String(uidInfo.rawUid),
                            'inbound',
                            toAddr,
                            ccAddr,
                            bccAddr,
                            folderId,
                        ]
                    );

                    summary.imported += 1;
                    existingUids.add(String(uidInfo.internalUid));
                    existingMessageKeys.add(getMailboxMessageKey(account.email, uidInfo.rawUid));
                    console.log(`[IMAP] Mail [${account.email} UID ${uidInfo.rawUid}] enregistre sans attendre l'IA | ${attachmentsMeta.length} PJ`);
                    await createMailNotification(userConfig.user_id, insertResult.lastID, account.email, fromAddr, subject);
                    scheduleEmailAnalysis(insertResult.lastID, subject, content, fromAddr, userConfig.user_id);
                } catch (messageError) {
                    if (isDuplicateEmailError(messageError)) {
                        existingUids.add(String(uidInfo.internalUid));
                        existingMessageKeys.add(getMailboxMessageKey(account.email, uidInfo.rawUid));
                        console.log(`[IMAP] Mail deja present ignore [${account.email} UID ${uidInfo.rawUid}]`);
                        continue;
                    }
                    const errorMessage = `UID ${uidInfo.rawUid}: ${messageError.message || messageError}`;
                    summary.errors.push(errorMessage);
                    console.error(`[IMAP] Erreur import ${account.email} ${errorMessage}`);
                }
            }

            for (const item of attachmentsToBackfill) {
                await backfillAttachmentsForExistingMail(client, account, item.row, item.rawUid, summary);
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
        summary.errors.push(finalError?.message || 'Erreur connexion IMAP inconnue');
    }

    return summary;
}

async function backfillEmailAttachments(userId, emailId) {
    const row = await dbGet(
        `SELECT
            *,
            CAST(uid AS CHAR) AS uid,
            CAST(raw_imap_uid AS CHAR) AS raw_imap_uid
         FROM emails
         WHERE id = ? AND user_id = ?`,
        [emailId, userId]
    );

    if (!row) {
        return { success: false, skipped: true, error: 'Mail introuvable.' };
    }

    const rawUid = String(row.raw_imap_uid || row.uid || '').trim();
    if (row.direction === 'sent' || !rawUid || row.attachments_checked_at) {
        return { success: true, skipped: true, mail: row };
    }

    const userConfig = (await getUserMailSettings(userId))[0];
    if (!userConfig) {
        return { success: false, skipped: true, error: 'Configuration mail introuvable.', mail: row };
    }

    const accounts = getReceiverAccountsFromSettings(userConfig)
        .filter(account => account.host && account.user && account.pass);
    const account = accounts.find(item => accountMatchesEmailRow(item, row)) || accounts[0];
    if (!account) {
        return { success: false, skipped: true, error: 'Compte de reception introuvable.', mail: row };
    }

    const summary = {
        userId,
        mailboxId: account.id,
        mailbox: account.email,
        imported: 0,
        attachmentsChecked: 0,
        attachmentsBackfilled: 0,
        checked: 0,
        errors: [],
    };

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
        console.error(`[IMAP] Erreur socket ${account.email} USER ${userId}:`, err.message);
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            await backfillAttachmentsForExistingMail(client, account, row, rawUid, summary);
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
        summary.errors.push(finalError?.message || 'Erreur connexion IMAP inconnue');
    }

    const updated = await dbGet("SELECT * FROM emails WHERE id = ? AND user_id = ?", [emailId, userId]).catch(() => row);
    return {
        success: summary.errors.length === 0,
        skipped: false,
        ...summary,
        mail: updated || row,
    };
}

function rotateWorkItems(workItems, limit) {
    if (!limit || limit <= 0 || workItems.length <= limit) return workItems;

    const start = scheduledSyncCursor % workItems.length;
    const rotated = [...workItems.slice(start), ...workItems.slice(0, start)];
    scheduledSyncCursor = (start + limit) % workItems.length;
    return rotated.slice(0, limit);
}

async function fetchNewEmailsInternal(userId = null, options = {}) {
    console.log(`[IMAP] Lancement de la synchronisation mail (Utilisateur: ${userId || 'TOUS'})...`);
    const summary = {
        users: 0,
        accounts: 0,
        availableAccounts: 0,
        imported: 0,
        attachmentsChecked: 0,
        attachmentsBackfilled: 0,
        mailboxes: [],
        errors: [],
    };

    const usersToSync = await getUserMailSettings(userId);
    summary.users = usersToSync.length;
    if (usersToSync.length === 0) {
        console.log('[IMAP] Aucun compte mail parametre pour la synchronisation.');
        return summary;
    }

    const workItems = [];
    for (const userConfig of usersToSync) {
        const accountsToSync = getReceiverAccountsFromSettings(userConfig)
            .filter(account => account.host && account.user && account.pass);
        summary.availableAccounts += accountsToSync.length;

        if (accountsToSync.length === 0) {
            const message = `Aucun compte reception complet pour user ${userConfig.user_id}.`;
            console.log(`[IMAP] ${message}`);
            summary.errors.push(message);
            continue;
        }

        accountsToSync.forEach(account => workItems.push({ userConfig, account }));
    }

    const limitAccounts = Number(options.limitAccounts || 0);
    const selectedWorkItems = userId ? workItems : rotateWorkItems(workItems, limitAccounts);
    summary.accounts = selectedWorkItems.length;

    for (const { userConfig, account } of selectedWorkItems) {
        const mailboxSummary = await syncMailbox(userConfig, account, options);
        summary.imported += mailboxSummary.imported;
        summary.attachmentsChecked += mailboxSummary.attachmentsChecked;
        summary.attachmentsBackfilled += mailboxSummary.attachmentsBackfilled;
        summary.mailboxes.push(mailboxSummary);
        summary.errors.push(...mailboxSummary.errors.map(error => `${account.email}: ${error}`));
    }

    return summary;
}

module.exports = { fetchNewEmails, backfillEmailAttachments };
