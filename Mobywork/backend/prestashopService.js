const axios = require('axios');
const https = require('https');
const { getSharedPrestashopSettings } = require('./flowceanAccounts');
require('dotenv').config();

async function resolvePrestashopConfig() {
    try {
        const shared = await getSharedPrestashopSettings();
        if (shared.shopUrl && shared.apiKey) {
            let baseUrl = shared.apiUrl || `${String(shared.shopUrl).replace(/\/+$/, '')}/api/`;
            if (!baseUrl.endsWith('/')) baseUrl += '/';
            return { baseUrl, apiKey: shared.apiKey, source: 'OceanOS' };
        }
    } catch (error) {
        console.warn('Configuration PrestaShop OceanOS indisponible:', error.message);
    }

    let baseUrl = process.env.PRESTASHOP_API_URL;
    if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/';
    return {
        baseUrl,
        apiKey: process.env.PRESTASHOP_API_KEY,
        source: '.env',
    };
}

async function createPsClient() {
    const config = await resolvePrestashopConfig();
    if (!config.baseUrl || !config.apiKey) {
        return null;
    }

    const client = axios.create({
        baseURL: config.baseUrl,
        params: {
            ws_key: config.apiKey,
            output_format: 'JSON',
            display: 'full'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    // Intercepteur pour nettoyer les éventuels warnings PHP avant le JSON
    client.interceptors.response.use(response => {
        if (typeof response.data === 'string') {
            try {
                // Chercher le premier '{' ou '[' pour isoler le JSON si du texte (PHP warnings) est présent avant
                const firstBrace = response.data.indexOf('{');
                const firstBracket = response.data.indexOf('[');
                let start = -1;
                if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) start = firstBrace;
                else if (firstBracket !== -1) start = firstBracket;

                if (start > 0) {
                    console.log("🧹 Nettoyage de la réponse API (PHP Warnings détectés)");
                    response.data = JSON.parse(response.data.substring(start));
                }
            } catch (e) {
                console.error("❌ Erreur lors du nettoyage JSON:", e.message);
            }
        }
        return response;
    });

    return client;
}

// Système de cache en mémoire
const cache = {
    customers: null,
    orders: null,
    carts: null,
    products: null,
    timestamp: 0,
    TTL: 5 * 60 * 1000 // 5 minutes en ms
};

/**
 * Vérifie si le cache est encore valide
 */
function isCacheValid() {
    return (Date.now() - cache.timestamp) < cache.TTL;
}

/**
 * Récupère les clients de PrestaShop avec mise en cache
 */
async function getCustomers() {
    if (cache.customers && isCacheValid()) {
        console.log('⚡ PrestaShop API: Fetching customers (from cache)');
        return cache.customers;
    }

    try {
        console.log('🌐 PrestaShop API: Fetching customers (network GET)');
        const client = await createPsClient();
        if (!client) {
            console.warn("PrestaShop API non configuree dans OceanOS, donnees vides retournees.");
            return [];
        }
        const response = await client.get('customers');
        
        let data = response.data.customers || [];
        if (!Array.isArray(data)) data = [data]; // Au cas où un seul objet est retourné

        console.log(`✅ PrestaShop API: ${data.length} clients trouvés.`);
        cache.customers = data;
        // Met à jour le timestamp seulement si les orders ont aussi été mis en cache avec succès ou qu'on recrée le cycle
        cache.timestamp = Date.now();
        return data;
    } catch (error) {
        console.error('❌ Erreur API PrestaShop - getCustomers:', error.message);
        throw new Error('Erreur lors de la récupération des clients PrestaShop');
    }
}

/**
 * Récupère les commandes de PrestaShop avec mise en cache
 */
async function getOrders() {
    if (cache.orders && isCacheValid()) {
        console.log('⚡ PrestaShop API: Fetching orders (from cache)');
        return cache.orders;
    }

    try {
        console.log('🌐 PrestaShop API: Fetching orders (network GET)');
        const client = await createPsClient();
        if (!client) {
            return [];
        }
        const response = await client.get('orders');
        
        let data = response.data.orders || [];
        if (!Array.isArray(data)) data = [data];

        console.log(`✅ PrestaShop API: ${data.length} commandes trouvées.`);
        cache.orders = data;
        return data;
    } catch (error) {
        console.error('❌ Erreur API PrestaShop - getOrders:', error.message);
        throw new Error('Erreur lors de la récupération des commandes PrestaShop');
    }
}

/**
 * Vide le cache manuellement (pour un bouton "Rafraichir" par ex)
 */
function clearCache() {
    cache.customers = null;
    cache.orders = null;
    cache.carts = null;
    cache.products = null;
    cache.timestamp = 0;
    console.log('🧹 Cache PrestaShop vidé.');
}

/**
 * Récupère les produits de PrestaShop avec mise en cache
 */
async function getProducts() {
    if (cache.products && isCacheValid()) {
        console.log('⚡ PrestaShop API: Fetching products (from cache)');
        return cache.products;
    }

    try {
        console.log('🌐 PrestaShop API: Fetching products (network GET)');
        const client = await createPsClient();
        if (!client) {
            return [];
        }
        const response = await client.get('products');
        
        let data = response.data.products || [];
        if (!Array.isArray(data)) data = [data];

        console.log(`✅ PrestaShop API: ${data.length} produits trouvés.`);
        cache.products = data;
        return data;
    } catch (error) {
        console.warn('⚠️ Erreur API PrestaShop - getProducts. L API products n est peut-être pas activée dans le Webservice:', error.message);
        return []; 
    }
}

/**
 * Récupère les paniers de PrestaShop avec mise en cache
 */
async function getCarts() {
    if (cache.carts && isCacheValid()) {
        console.log('⚡ PrestaShop API: Fetching carts (from cache)');
        return cache.carts;
    }

    try {
        console.log('🌐 PrestaShop API: Fetching carts (network GET)');
        const client = await createPsClient();
        if (!client) {
            return [];
        }
        const response = await client.get('carts');
        
        let data = response.data.carts || [];
        if (!Array.isArray(data)) data = [data];

        console.log(`✅ PrestaShop API: ${data.length} paniers trouvés.`);
        cache.carts = data;
        return data;
    } catch (error) {
        console.warn('⚠️ Erreur API PrestaShop - getCarts. L API carts n est peut-être pas activée dans le Webservice:', error.message);
        return []; // Ne pas crash si carts n'est pas dispo
    }
}

module.exports = {
    getCustomers,
    getOrders,
    getCarts,
    getProducts,
    clearCache
};
