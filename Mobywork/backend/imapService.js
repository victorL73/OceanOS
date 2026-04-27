const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./database');
const { analyzeEmail } = require('./aiService');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Dossier de stockage des pièces jointes sur disque
const ATTACHMENTS_DIR = path.join(__dirname, 'attachments');
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

const IMAP_SOCKET_TIMEOUT_MS = Number(process.env.IMAP_SOCKET_TIMEOUT_MS || 30000);
let syncInProgress = false;

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

async function fetchNewEmailsInternal(userId = null) {
    console.log(`📥 [IMAP] Lancement de la synchronisation de la boîte mail (Utilisateur: ${userId || 'TOUS'})...`);

    // Obtenir la liste des utilisateurs à synchroniser
    const usersToSync = await new Promise((resolve) => {
        let query = "SELECT user_id, imap_host, imap_port, imap_user, imap_pass FROM user_settings WHERE imap_host IS NOT NULL";
        let params = [];
        if (userId) {
            query += " AND user_id = ?";
            params.push(userId);
        }
        db.all(query, params, (err, rows) => {
            resolve(err ? [] : rows);
        });
    });

    if (usersToSync.length === 0) {
        console.log("⏳ [IMAP] Aucun compte mail paramétré pour la synchronisation.");
        return;
    }

    for (const userConfig of usersToSync) {
        if (!userConfig.imap_host || !userConfig.imap_user || !userConfig.imap_pass) continue;

        console.log(`📥 [IMAP] Connexion au compte de l'utilisateur ${userConfig.user_id}...`);
        
        let imapConnectionError = null;
        const client = new ImapFlow({
            host: userConfig.imap_host,
            port: parseInt(userConfig.imap_port || 993),
            secure: true,
            auth: {
                user: userConfig.imap_user,
                pass: userConfig.imap_pass
            },
            socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
            logger: false
        });

        client.on('error', (err) => {
            imapConnectionError = err;
            console.error(`[IMAP] Erreur socket USER ${userConfig.user_id}:`, err.message);
        });

    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');

        try {
            // Récupérer les UIDs déjà en base pour CET utilisateur
            const existingUids = await new Promise((resolve, reject) => {
                db.all("SELECT uid FROM emails WHERE user_id = ?", [userConfig.user_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(new Set(rows.map(r => r.uid)));
                });
            });

            const uidsToProcess = [];
            for await (let msg of client.fetch('1:*', { uid: true })) {
                if (!existingUids.has(msg.uid)) uidsToProcess.push(msg.uid);
            }

            if (uidsToProcess.length === 0) {
                console.log("⏳ [IMAP] Aucun nouveau message à traiter.");
            }

            for (let uid of uidsToProcess) {
                let msgSource = await client.fetchOne(uid, { source: true });
                let parsed = await simpleParser(msgSource.source);

                const fromAddr  = parsed.from?.value[0]?.address || "Expéditeur inconnu";
                const subject   = parsed.subject || "Sans objet";
                const content   = parsed.text   || "Pas de contenu textuel";
                const htmlContent = parsed.html  || null;
                const date      = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

                // ─── PIÈCES JOINTES ────────────────────────────────────────
                const attachmentsMeta = [];

                if (parsed.attachments && parsed.attachments.length > 0) {
                    // Créer un sous-dossier par UID de mail
                    const mailDir = path.join(ATTACHMENTS_DIR, String(uid));
                    if (!fs.existsSync(mailDir)) fs.mkdirSync(mailDir, { recursive: true });

                    for (const att of parsed.attachments) {
                        // Nettoyer le nom de fichier pour éviter les path traversals
                        const safeName = att.filename
                            ? att.filename.replace(/[^a-zA-Z0-9._\- ]/g, '_')
                            : `attachment_${Date.now()}`;
                        
                        const filePath = path.join(mailDir, safeName);
                        
                        try {
                            fs.writeFileSync(filePath, att.content);
                            attachmentsMeta.push({
                                filename:    safeName,
                                contentType: att.contentType || 'application/octet-stream',
                                size:        att.size || att.content.length,
                                path:        filePath   // chemin absolu sur le serveur
                            });
                            console.log(`📎 [IMAP] Pièce jointe sauvegardée : ${safeName} (${att.size || att.content.length} octets)`);
                        } catch (e) {
                            console.error(`❌ [IMAP] Erreur sauvegarde pièce jointe ${safeName}:`, e.message);
                        }
                    }
                }
                // ───────────────────────────────────────────────────────────

                console.log(`🤖 [IA] Analyse du message entrant: [UID ${uid}] ${subject}`);
                // Passer user_id pour chercher sa propore clef API
                const aiResult = await analyzeEmail(subject, content.substring(0, 4000), fromAddr, userConfig.user_id);

                // Insertion BD
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO emails (
                            uid, from_address, subject, content, html_content,
                            categorie, priorite, resume,
                            reponse_formelle, reponse_amicale, reponse_rapide,
                            amount, due_date, attachments, date_reception, action_recommandee, is_business, user_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            uid, fromAddr, subject, content, htmlContent,
                            aiResult.categorie, aiResult.priorite, aiResult.resume,
                            aiResult.reponse_formelle, aiResult.reponse_amicale, aiResult.reponse_rapide,
                            aiResult.amount, aiResult.due_date,
                            JSON.stringify(attachmentsMeta),
                            date,
                            aiResult.action_recommandee || 'Répondre',
                            aiResult.is_business ? 1 : 0,
                            userConfig.user_id
                        ],
                        function(err) {
                            if (err) {
                                console.error("Erreur insertion DB:", err);
                                reject(err);
                            } else {
                                console.log(`✅ Mail [UID ${uid}] enregistré (${aiResult.categorie} - ${aiResult.priorite}) | ${attachmentsMeta.length} PJ`);
                                resolve();
                            }
                        }
                    );
                });
            }
        } finally {
            lock.release();
        }
        try {
            await client.logout();
        } catch (logoutError) {
            console.warn(`[IMAP] Fermeture session USER ${userConfig.user_id}:`, logoutError.message);
        }
    } catch (error) {
        try {
            client.close();
        } catch (closeError) {}
        if (!error?.message && imapConnectionError?.message) {
            error = imapConnectionError;
        }
        console.error(`❌ ERREUR CONNEXION IMAP POUR USER ${userConfig.user_id}:`, error.message);
    }
    } // fin du for loop users
}

module.exports = { fetchNewEmails };
