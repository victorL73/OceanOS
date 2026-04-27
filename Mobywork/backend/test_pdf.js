const pdfParse = require('pdf-parse');
const fs = require('fs');

const file = 'E:\\projet site\\Mobywork\\outils de poste site\\backend\\attachments\\62\\FILE_220002042182_20260330.pdf';
console.log("Fichier existe:", fs.existsSync(file));
console.log("Type de pdfParse:", typeof pdfParse);

if (fs.existsSync(file)) {
  const buf = fs.readFileSync(file);
  pdfParse(buf).then(data => {
    console.log("=== TEXTE PDF (800 premiers chars) ===");
    console.log(data.text.substring(0, 800));
    process.exit(0);
  }).catch(e => {
    console.error("Erreur:", e.message);
    process.exit(1);
  });
}
