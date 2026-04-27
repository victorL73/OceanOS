const Groq = require('groq-sdk');
const { getSharedAiSettings } = require('./flowceanAccounts');

async function resolveGroqSettings(userId = 1) {
    const shared = await getSharedAiSettings(userId);
    return {
        apiKey: shared.apiKey || '',
        model: shared.model || 'llama-3.3-70b-versatile',
    };
}

async function getGroqClient(userId = 1) {
    const settings = await resolveGroqSettings(userId);
    if (!settings.apiKey) {
        throw new Error("Cle API Groq non configuree dans OceanOS.");
    }
    return new Groq({ apiKey: settings.apiKey });
}

async function getGroqConfig(userId = 1) {
    return resolveGroqSettings(userId);
}

module.exports = {
    getGroqClient,
    getGroqConfig,
};
