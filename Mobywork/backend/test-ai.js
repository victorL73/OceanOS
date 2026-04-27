const { analyzeEmail } = require('./aiService');

async function runTest() {
    console.log("Démarrage du test IA...");
    try {
        const result = await analyzeEmail("Objet de test", "Contenu de la facture 123.", "fournisseur@nautic.fr");
        console.log("Résultat:", result);
    } catch (e) {
        console.error("Exception globale:", e);
    }
}
runTest();
