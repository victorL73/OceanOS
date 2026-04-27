// Test complet du emailParser avec le PDF Sanef
const emailParserService = require('./services/emailParser.service');

async function test() {
  try {
    console.log("🔄 Lancement de l'extraction des factures...");
    const result = await emailParserService.extractInvoicesFromEmails(1);
    console.log("✅ Résultat:", result);
  } catch(e) {
    console.error("❌ Erreur:", e);
  }
  process.exit(0);
}
test();
