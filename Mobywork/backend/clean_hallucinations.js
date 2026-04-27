const db = require('./database');

// Supprimer les expenses hallucinées (IDs 10, 11, 9 — doublons/faux)
// garder seulement: [3] Sonepar, [8] test, [12] SAPN (vraie), emails manuels
db.run("DELETE FROM expenses WHERE id IN (9, 10, 11)", function(err) {
  if (err) { console.error(err); process.exit(1); }
  console.log(`✅ ${this.changes} expenses erronées supprimées.`);
  
  // Vérification
  db.all("SELECT * FROM expenses ORDER BY id", (err2, rows) => {
    console.log("\n=== EXPENSES RESTANTES ===");
    rows.forEach(r => console.log(`[${r.id}] ${r.supplier} | ${r.amount}€ | email_id=${r.email_id}`));
    process.exit(0);
  });
});
