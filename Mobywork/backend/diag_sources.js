// Vérifie les emails sources des expenses suspectes
const db = require('./database');

// Vérifier les emails 18 et 61 (sources des doublons)
db.all("SELECT id, subject, from_address, SUBSTR(content, 1, 400) as content_preview FROM emails WHERE id IN (18, 61, 63)", (err, rows) => {
  rows.forEach(r => {
    console.log(`\n=== Email ID=${r.id} ===`);
    console.log(`  Sujet: ${r.subject}`);
    console.log(`  De: ${r.from_address}`);
    console.log(`  Contenu: ${r.content_preview}`);
  });
  process.exit(0);
});
