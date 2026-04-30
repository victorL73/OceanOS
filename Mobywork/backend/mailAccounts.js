function parseMailAccounts(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function accountIdFromEmail(email = '', index = 0) {
    const safe = String(email || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return safe || `mail-account-${index + 1}`;
}

function flagEnabled(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return Number(value) !== 0;
}

function sameEmail(a = '', b = '') {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function stableNumericPrefix(value = '') {
    let hash = 2166136261;
    const str = String(value || 'mail-account');
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return String((Math.abs(hash) % 90000000) + 10000000);
}

function normalizeMailAccount(account = {}, index = 0, settings = {}) {
    const email = String(account.email || account.address || account.smtp_user || account.imap_user || account.user || '').trim();
    if (!email) return null;

    const id = String(account.id || accountIdFromEmail(email, index)).trim();
    const globalHost = settings.imap_host || settings.smtp_host || '';
    const isLegacyMailbox = sameEmail(email, settings.imap_user) || sameEmail(email, settings.smtp_user);
    const user = account.user
        || account.login
        || account.imap_user
        || account.smtp_user
        || (isLegacyMailbox ? (settings.imap_user || settings.smtp_user) : email);
    const pass = account.pass || account.password || account.imap_pass || account.smtp_pass || settings.imap_pass || settings.smtp_pass || '';
    const label = account.label || account.name || email;

    return {
        id,
        label,
        email,
        fromName: account.from_name || account.fromName || settings.nom || label,
        host: account.host || account.imap_host || account.smtp_host || globalHost,
        imap_port: account.imap_port || settings.imap_port || 993,
        smtp_port: account.smtp_port || settings.smtp_port || 465,
        user,
        pass,
        send_enabled: flagEnabled(account.send_enabled, true),
        receive_enabled: flagEnabled(account.receive_enabled, true),
        is_default: Number(account.is_default || 0) === 1,
        secure: account.secure === false ? false : true,
        imap_secure: account.imap_secure === false ? false : true,
        smtp_secure: account.smtp_secure === false ? false : true,
        use_legacy_uid: isLegacyMailbox,
        uid_prefix: isLegacyMailbox ? '' : stableNumericPrefix(id || email),
    };
}

function getMailAccountsFromSettings(settings = {}) {
    const savedAccounts = parseMailAccounts(settings.smtp_accounts)
        .map((account, index) => normalizeMailAccount(account, index, settings))
        .filter(Boolean);

    const legacyEmail = String(settings.imap_user || settings.smtp_user || '').trim();
    const hasLegacyInSaved = legacyEmail && savedAccounts.some(account => sameEmail(account.email, legacyEmail));

    if (legacyEmail && !hasLegacyInSaved) {
        savedAccounts.unshift(normalizeMailAccount({
            id: 'legacy',
            label: 'Compte principal',
            email: legacyEmail,
            user: settings.imap_user || settings.smtp_user,
            pass: settings.imap_pass || settings.smtp_pass,
            host: settings.imap_host || settings.smtp_host,
            imap_port: settings.imap_port,
            smtp_port: settings.smtp_port,
            is_default: !settings.smtp_default_sender,
        }, 0, settings));
    }

    return savedAccounts.filter(Boolean);
}

function getSenderAccountsFromSettings(settings = {}) {
    return getMailAccountsFromSettings(settings).filter(account => account.send_enabled);
}

function getReceiverAccountsFromSettings(settings = {}) {
    return getMailAccountsFromSettings(settings).filter(account => account.receive_enabled);
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

function storedImapUid(account, rawUid) {
    const uid = String(rawUid || '').trim();
    if (!uid) return '';
    if (account.use_legacy_uid) return uid;
    return `${account.uid_prefix}${uid.padStart(10, '0').slice(-10)}`;
}

module.exports = {
    accountIdFromEmail,
    getMailAccountsFromSettings,
    getReceiverAccountsFromSettings,
    getSenderAccountsFromSettings,
    normalizeMailAccount,
    parseMailAccounts,
    publicSenderAccount,
    storedImapUid,
};
