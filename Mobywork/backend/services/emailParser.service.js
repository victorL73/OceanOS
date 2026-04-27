const { getGroqClient } = require('../sharedGroq');
const fs = require('fs');
const path = require('path');
let pdfParse = null;
try { 
    pdfParse = require('pdf-parse');
    if (typeof pdfParse !== 'function') pdfParse = null; // safety check
} catch(e) { pdfParse = null; }
require('dotenv').config();


/**
 * Extrait le texte d'un PDF sur le disque.
 * Retourne une chaîne vide si impossible.
 */
async function extractPdfText(filePath) {
    if (!pdfParse) return '';
    try {
        if (!fs.existsSync(filePath)) return '';
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text || '';
    } catch (e) {
        console.error('[PDF] Erreur lecture PDF:', e.message);
        return '';
    }
}

const emailParserService = {
    /**
     * 2. EXTRACTION FACTURES (EMAIL IA)
     * Scanne les emails locaux, tente d'extraire les PJ PDF, et envoie le tout à Groq.
     */
    async extractInvoicesFromEmails(userId = 1) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT e.id, e.subject, e.content, e.date_reception, e.from_address, e.attachments
                FROM emails e
                LEFT JOIN expenses ex ON e.id = ex.email_id
                WHERE ex.email_id IS NULL
                AND (
                    LOWER(e.subject) LIKE '%facture%' OR LOWER(e.content) LIKE '%facture%' OR
                    LOWER(e.subject) LIKE '%invoice%'  OR LOWER(e.content) LIKE '%invoice%' OR
                    LOWER(e.subject) LIKE '%paiement%' OR LOWER(e.content) LIKE '%paiement%' OR
                    LOWER(e.subject) LIKE '%reçu%'     OR LOWER(e.content) LIKE '%reçu%' OR
                    LOWER(e.attachments) LIKE '%.pdf%'
                )
                ORDER BY e.date_reception DESC
                LIMIT 20
            `;

            db.all(query, async (err, emails) => {
                if (err) return reject(err);
                if (!emails || emails.length === 0) return resolve({ processed: 0, message: "Aucune nouvelle facture à extraire." });

                let groq;
                try {
                    groq = await getGroqClient(userId);
                } catch(e) {
                    return reject(e);
                }

                let processedCount = 0;

                for (let email of emails) {
                    // --- Lecture des pièces jointes PDF ---
                    let pdfContent = '';
                    try {
                        const attachments = JSON.parse(email.attachments || '[]');
                        for (const att of attachments) {
                            const ext = (att.filename || '').toLowerCase();
                            if (ext.endsWith('.pdf') && att.path) {
                                const text = await extractPdfText(att.path);
                                if (text) {
                                    pdfContent += `\n\n[Contenu PDF "${att.filename}"]:\n${text.substring(0, 2000)}`;
                                }
                            }
                        }
                    } catch(e) {
                        console.error('[PDF] Erreur parsing attachments JSON:', e.message);
                    }

                    // --- Contexte total pour l'IA ---
                    const emailContext = `
- Expéditeur: ${email.from_address}
- Sujet: ${email.subject}
- Corps de l'email: ${(email.content || '').substring(0, 1000)}
${pdfContent ? `- Contenu des pièces jointes PDF:${pdfContent}` : ''}`.trim();

                    const prompt = `Tu es un extracteur de données de facturation STRICT. Ton unique rôle est d'extraire des informations RÉELLES déjà présentes dans le texte.

RÈGLES ABSOLUES:
1. N'invente JAMAIS un montant. Si tu ne vois pas de chiffre monétaire explicite (ex: "15,80 €", "150.00", "montant total"), retourne amount: 0.
2. N'invente JAMAIS un fournisseur à partir d'une mention indirecte. Utilise le NOM de l'émetteur visible dans la signature de la facture/reçu.
3. Si le texte décrit une notification (réseaux sociaux, newsletter, email transactionnel sans montant), retourne OBLIGATOIREMENT amount: 0.
4. Pour les péages, utilise le "Montant total payé" ou la somme des lignes.

SOURCE À ANALYSER:
${emailContext}

JSON (ne retourne QUE ce JSON, rien d'autre):
{"amount": 0, "supplier": "Nom émetteur ou inconnu", "date": "YYYY-MM-DD", "category": "transport"}`;


                    try {
                        const completion = await groq.chat.completions.create({
                            messages: [{ role: 'user', content: prompt }],
                            model: "llama-3.1-8b-instant",
                            temperature: 0.1,
                            response_format: { type: "json_object" }
                        });
                        const data = JSON.parse(completion.choices[0].message.content);

                        // Normaliser le montant (virgule française -> point)
                        let rawAmount = data.amount;
                        if (typeof rawAmount === 'string') {
                            rawAmount = rawAmount.replace(',', '.').replace(/[^0-9.]/g, '');
                        }
                        const parsedAmount = parseFloat(rawAmount);

                        // On insère seulement si le montant est valide et non nul
                        if (!isNaN(parsedAmount) && parsedAmount > 0 && data.supplier) {
                            await new Promise(res => {
                                db.run(
                                    "INSERT OR IGNORE INTO expenses (user_id, amount, supplier, date, category, email_id) VALUES (?, ?, ?, ?, ?, ?)",
                                    [userId, parsedAmount, data.supplier, data.date || email.date_reception.split(' ')[0], data.category || 'autre', email.id],
                                    (err) => {
                                        if (err) console.error("Err INSERT expense", err.message);
                                        else processedCount++;
                                        res();
                                    }
                                );
                            });
                        } else {
                            console.log(`[Finance] Montant non trouvé pour email id=${email.id} (${email.subject}) — ignoré.`);
                        }
                    } catch(e) {
                        console.error("Erreur parsing email id " + email.id, e.message);
                    }
                }
                resolve({ processed: processedCount, message: processedCount + " nouvelles factures analysées." });
            });
        });
    }
};

module.exports = emailParserService;
