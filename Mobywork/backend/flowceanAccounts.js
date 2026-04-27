const { bridgeToken } = require('./oceanosBridge');

function useSharedAccounts() {
    return (process.env.MOBYWORK_AUTH_DRIVER || 'oceanos').toLowerCase() !== 'local';
}

function bridgeUrl() {
    return process.env.MOBYWORK_SHARED_AUTH_URL || 'http://127.0.0.1/Mobywork/api/shared-auth.php';
}

async function callBridge(action, payload = {}) {
    const response = await fetch(bridgeUrl(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Mobywork-Bridge': bridgeToken(),
        },
        body: JSON.stringify({ action, ...payload }),
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Reponse auth OceanOS invalide: ${text.slice(0, 160)}`);
    }

    if (!response.ok || data.ok === false) {
        const error = new Error(data.error || data.message || 'Erreur auth OceanOS.');
        error.statusCode = response.status;
        throw error;
    }

    return data;
}

function toMobyRole(sharedRole) {
    return ['super', 'admin'].includes(String(sharedRole || '').toLowerCase()) ? 'admin' : 'user';
}

async function authenticateSharedUser(email, password) {
    try {
        const data = await callBridge('login', { email, password });
        return data.user || null;
    } catch (error) {
        if (error.statusCode === 401) {
            return null;
        }
        throw error;
    }
}

async function findSharedUserById(userId) {
    const data = await callBridge('find', { id: userId });
    return data.user || null;
}

function publicSharedUser(user) {
    return user;
}

async function listSharedUsers() {
    const data = await callBridge('list');
    return data.users || [];
}

async function createSharedUser(input) {
    const data = await callBridge('create', input);
    return data.user;
}

async function deactivateSharedUser(userId) {
    await callBridge('deactivate', { id: userId });
}

async function getSharedAiSettings(userId) {
    const data = await callBridge('ai', { id: userId });
    return data.settings || {};
}

async function getSharedPrestashopSettings() {
    const data = await callBridge('prestashop');
    return data.settings || {};
}

async function getSharedCompanySettings() {
    const data = await callBridge('company');
    return data.settings || {};
}

module.exports = {
    authenticateSharedUser,
    createSharedUser,
    deactivateSharedUser,
    findSharedUserById,
    getSharedAiSettings,
    getSharedCompanySettings,
    getSharedPrestashopSettings,
    listSharedUsers,
    publicSharedUser,
    toMobyRole,
    useSharedAccounts,
};
