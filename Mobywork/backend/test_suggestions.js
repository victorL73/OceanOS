const db = require('./database');
const dashboardService = require('./dashboardService');

async function test() {
    console.log("Démarrage du test de getAiSuggestions pour l'utilisateur 1...");
    try {
        const suggestions = await dashboardService.getAiSuggestions(1);
        console.log("Suggestions générées :", JSON.stringify(suggestions, null, 2));
    } catch (e) {
        console.error("Erreur lors de l'exécution :", e);
    }
}

test();
