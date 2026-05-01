const nodemailer = require('nodemailer');
const db = require('./database');
const {
    getSenderAccountsFromSettings: getUnifiedSenderAccountsFromSettings,
} = require('./mailAccounts');
require('dotenv').config();

function parseSmtpAccounts(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function senderIdFromEmail(email = '', index = 0) {
    const safe = String(email || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return safe || `sender-${index + 1}`;
}

function normalizeSenderAccount(account = {}, index = 0, settings = {}) {
    const email = String(account.email || account.address || account.smtp_user || account.user || '').trim();
    if (!email) return null;

    const id = String(account.id || senderIdFromEmail(email, index)).trim();
    const host = account.smtp_host || account.host || settings.smtp_host || '';
    const port = account.smtp_port || account.port || settings.smtp_port || 465;
    const user = account.smtp_user || account.user || settings.smtp_user || email || '';
    const pass = account.smtp_pass || account.pass || settings.smtp_pass || '';
    const label = account.label || account.name || email;
    const fromName = account.from_name || account.fromName || settings.nom || label;

    return {
        id,
        label,
        email,
        fromName,
        smtp_host: host,
        smtp_port: port,
        smtp_user: user,
        smtp_pass: pass,
        secure: account.secure === false ? false : true,
        is_default: Number(account.is_default || 0) === 1,
    };
}

function getSenderAccountsFromSettings(settings = {}) {
    return getUnifiedSenderAccountsFromSettings(settings);
}

function publicSenderAccount(account, defaultId) {
    return {
        id: account.id,
        label: account.label,
        email: account.email,
        fromName: account.fromName,
        isDefault: account.id === defaultId,
        configured: !!(account.host && account.user && account.pass),
    };
}

function selectSenderAccount(settings, senderId = null) {
    const accounts = getSenderAccountsFromSettings(settings);
    if (accounts.length === 0) return null;

    const requested = String(senderId || '').trim().toLowerCase();
    const defaultId = String(settings.smtp_default_sender || '').trim().toLowerCase();

    return accounts.find(account => requested && (
        account.id.toLowerCase() === requested ||
        account.email.toLowerCase() === requested
    ))
        || accounts.find(account => defaultId && account.id.toLowerCase() === defaultId)
        || accounts.find(account => account.is_default)
        || accounts[0];
}

function formatFrom(account) {
    const email = account.email || account.user;
    const name = String(account.fromName || account.label || '').trim();
    return name ? `"${name.replace(/"/g, "'")}" <${email}>` : email;
}

function normalizeRecipients(value = '') {
    return String(value || '')
        .split(/[;,]/)
        .map(item => item.trim())
        .filter(Boolean)
        .join(', ');
}

function fetchSmtpSettings(userId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT
                nom,
                smtp_host,
                smtp_port,
                smtp_user,
                smtp_pass,
                smtp_accounts,
                smtp_default_sender,
                signature_email,
                signature_is_html,
                signature_photo,
                signature_illustration
            FROM user_settings
            WHERE user_id = ?
        `, [userId], (err, row) => {
            if (err) return reject('Erreur BDD SMTP');
            resolve(row || {});
        });
    });
}

async function getAvailableSenders(userId) {
    const settings = await fetchSmtpSettings(userId);
    const accounts = getSenderAccountsFromSettings(settings);
    const selected = selectSenderAccount(settings);
    const defaultId = selected?.id || '';
    return accounts.map(account => publicSenderAccount(account, defaultId));
}

async function getTransporter(userId, senderId = null) {
    const settings = await fetchSmtpSettings(userId);
    const account = selectSenderAccount(settings, senderId);

    if (!account) {
        throw new Error('Aucun compte SMTP configure pour cet utilisateur');
    }

    if (!account.host || !account.user || !account.pass) {
        throw new Error(`Compte SMTP incomplet pour ${account.email}`);
    }

    return {
        transporter: nodemailer.createTransport({
            host: account.host,
            port: parseInt(account.smtp_port || 465, 10),
            secure: account.smtp_secure !== false,
            auth: {
                user: account.user,
                pass: account.pass,
            },
        }),
        user: account.user,
        from: formatFrom(account),
        sender: publicSenderAccount(account, account.id),
        settings,
    };
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function textToHtml(value = '') {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

function stripHtml(value = '') {
    return String(value)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p\s*>/gi, '\n')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function sanitizeSignatureHtml(value = '') {
    return String(value)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[\s\S]*?>/gi, '')
        .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
}

function buildSignature(settings = {}) {
    const raw = String(settings.signature_email || '').trim();
    const isHtml = Number(settings.signature_is_html) === 1;
    const visual = settings.signature_photo || settings.signature_illustration || '';
    const htmlText = isHtml ? sanitizeSignatureHtml(raw) : textToHtml(raw);
    const text = isHtml ? stripHtml(raw) : raw;

    if (!htmlText && !visual) {
        return { text: '', html: '' };
    }

    const visualHtml = visual
        ? `<td style="padding-right:16px;vertical-align:middle;"><img src="${escapeHtml(visual)}" style="max-width:140px;max-height:70px;object-fit:contain;display:block;" /></td>`
        : '';

    return {
        text,
        html: `<div style="margin-top:20px;padding-top:14px;border-top:1px solid #dbe4ea;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
            ${visualHtml}
            <td style="vertical-align:middle;font-size:13px;color:#475569;line-height:1.6;">${htmlText}</td>
          </tr></table>
        </div>`,
    };
}

function buildMailBodies(messageText, settings, htmlBody = null) {
    if (htmlBody) {
        return { text: messageText, html: htmlBody };
    }

    const signature = buildSignature(settings);
    const text = signature.text ? `${messageText}\n\n${signature.text}` : messageText;
    const html = signature.html
        ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${textToHtml(messageText)}${signature.html}</div>`
        : null;

    return { text, html };
}

async function sendReply(emailId, replyText, attachments = [], userId = 1, senderId = null, ccAddress = '', bccAddress = '', toAddress = '') {
    return new Promise(async (resolve, reject) => {
        try {
            const config = await getTransporter(userId, senderId);

            db.get('SELECT * FROM emails WHERE id = ? AND user_id = ?', [emailId, userId], async (err, mail) => {
                if (err || !mail) return reject('Email introuvable dans la base !');

                try {
                    const bodies = buildMailBodies(replyText, config.settings);
                    const replyTo = normalizeRecipients(toAddress) || normalizeRecipients(mail.from_address) || mail.from_address;
                    const mailOptions = {
                        from: config.from,
                        to: replyTo,
                        subject: `Re: ${mail.subject}`,
                        text: bodies.text,
                    };
                    const cc = normalizeRecipients(ccAddress);
                    const bcc = normalizeRecipients(bccAddress);
                    if (cc) mailOptions.cc = cc;
                    if (bcc) mailOptions.bcc = bcc;
                    if (bodies.html) mailOptions.html = bodies.html;

                    if (attachments && attachments.length > 0) {
                        mailOptions.attachments = attachments;
                    }

                    const info = await config.transporter.sendMail(mailOptions);
                    resolve({
                        info,
                        sender: config.sender,
                        from: config.from,
                        to: replyTo,
                        user: config.user,
                        bodies,
                    });
                } catch (error) {
                    console.error('Erreur SMTP:', error);
                    reject(error);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function sendNewMessage(toAddress, subject, messageText, attachments = [], userId = 1, htmlBody = null, senderId = null, ccAddress = '', bccAddress = '') {
    try {
        const config = await getTransporter(userId, senderId);
        const bodies = buildMailBodies(messageText, config.settings, htmlBody);
        const cc = normalizeRecipients(ccAddress);
        const bcc = normalizeRecipients(bccAddress);
        const mailOptions = {
            from: config.from,
            to: toAddress,
            subject,
            text: bodies.text,
        };
        if (cc) mailOptions.cc = cc;
        if (bcc) mailOptions.bcc = bcc;

        if (bodies.html) {
            mailOptions.html = bodies.html;
        }

        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments;
        }

        const info = await config.transporter.sendMail(mailOptions);
        console.log(`Nouvel email envoye avec succes a ${toAddress}`);
        return {
            info,
            sender: config.sender,
            from: config.from,
            user: config.user,
            bodies,
        };
    } catch (error) {
        console.error('Erreur SMTP (Nouveau Message):', error);
        throw error;
    }
}

module.exports = {
    sendReply,
    sendNewMessage,
    buildSignature,
    sanitizeSignatureHtml,
    getAvailableSenders,
    getSenderAccountsFromSettings,
};
