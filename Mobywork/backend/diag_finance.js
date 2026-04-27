const db = require('./database');

db.all("SELECT * FROM expenses ORDER BY id", (err, expenses) => {
  console.log("=== TOUTES LES EXPENSES ===");
  if (err) { console.error(err); process.exit(1); }
  expenses.forEach(e => {
    console.log(`[${e.id}] ${e.supplier} | ${e.amount}EUR | email_id=${e.email_id} | date=${e.date} | cat=${e.category}`);
  });
  
  db.all("SELECT e.id, e.subject, e.from_address, e.attachments, ex.amount FROM emails e JOIN expenses ex ON e.id = ex.email_id WHERE (ex.amount = 0 OR ex.amount IS NULL)", (err2, rows) => {
    console.log("\n=== EMAILS LIES A DES EXPENSES A 0EUR ===");
    if (!rows) { console.log("aucun"); process.exit(0); return; }
    rows.forEach(r => {
      let atts = [];
      try { atts = JSON.parse(r.attachments || '[]'); } catch(e2) {}
      console.log(`\n[email.id=${r.id}] "${r.subject}"`);
      console.log(`  from: ${r.from_address}`);
      console.log(`  PJ count: ${atts.length}`);
      atts.forEach(a => console.log(`    - ${a.filename} => ${a.path}`));
    });
    process.exit(0);
  });
});
