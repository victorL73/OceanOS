const db = require('./database');
const path = require('path');

// 1. Corriger le chemin des PJ pour les expenses liees a des emails avec PDF
// Le chemin stocké est E:\projet site\outils de poste site\backend\attachments\...
// Le vrai chemin est   E:\projet site\Mobywork\outils de poste site\backend\attachments\...
const CORRECT_BASE = path.join(__dirname, 'attachments');
console.log("Correct base:", CORRECT_BASE);

db.all("SELECT id, attachments FROM emails WHERE attachments IS NOT NULL AND attachments != '[]'", (err, rows) => {
  if (err) { console.error(err); process.exit(1); }
  
  let updateCount = 0;
  let processed = 0;

  if (rows.length === 0) { console.log("Aucun email avec PJ"); process.exit(0); return; }
  
  rows.forEach(row => {
    let atts;
    try { atts = JSON.parse(row.attachments); } catch(e) { processed++; checkDone(); return; }
    
    let changed = false;
    atts = atts.map(att => {
      if (att.path && !att.path.startsWith(CORRECT_BASE)) {
        // Extraire juste le nom du sous-dossier (uid) et le fichier
        const parts = att.path.replace(/\\/g, '/').split('/attachments/');
        if (parts.length > 1) {
          const relativePart = parts[parts.length - 1];
          att.path = path.join(CORRECT_BASE, relativePart);
          changed = true;
          console.log(`  Corrigé: ${att.path}`);
        }
      }
      return att;
    });
    
    if (changed) {
      db.run("UPDATE emails SET attachments = ? WHERE id = ?", [JSON.stringify(atts), row.id], (err2) => {
        if (err2) console.error("Err update email id=" + row.id, err2.message);
        else updateCount++;
        processed++;
        checkDone();
      });
    } else {
      processed++;
      checkDone();
    }
  });
  
  function checkDone() {
    if (processed >= rows.length) {
      console.log(`\n✅ ${updateCount} chemins de PJ corrigés.`);
      
      // 2. Supprimer les expenses à 0€ liées à des emails (pour permettre la re-synchro)
      db.run("DELETE FROM expenses WHERE amount = 0 AND email_id IS NOT NULL", function(err3) {
        if (err3) { console.error(err3); process.exit(1); }
        console.log(`✅ ${this.changes} expenses à 0€ supprimées (seront re-analysées au prochain sync).`);
        
        // 3. Supprimer les expenses clairement fausses (LinkedIn = pas une facture)
        db.run("DELETE FROM expenses WHERE supplier IN ('LinkedIn', 'PMM CAEN OUEST', 'BT Formation') AND amount = 0", function(err4) {
          console.log("✅ Nettoyage terminé.");
          process.exit(0);
        });
      });
    }
  }
});
