// Diagnostic précis email 62
const db = require('./database');
const pdfParse = require('pdf-parse');
const fs = require('fs');

db.get("SELECT id, subject, content, from_address, attachments FROM emails WHERE id = 62", async (err, email) => {
  if (err || !email) { console.error("email 62 introuvable", err); process.exit(1); }
  
  console.log("Subject:", email.subject);
  console.log("From:", email.from_address);
  console.log("Corps (300 chars):", email.content.substring(0, 300));
  
  let atts = [];
  try { atts = JSON.parse(email.attachments || '[]'); } catch(e) {}
  console.log("\nPièces jointes:", JSON.stringify(atts, null, 2));
  
  for (const att of atts) {
    if (att.path) {
      const exists = fs.existsSync(att.path);
      console.log(`\nFichier ${att.filename}: existe=${exists}, path=${att.path}`);
      if (exists && att.filename.endsWith('.pdf')) {
        const buf = fs.readFileSync(att.path);
        const data = await pdfParse(buf);
        console.log("Texte PDF complet (1000 chars):", data.text.substring(0, 1000));
      }
    }
  }
  process.exit(0);
});
