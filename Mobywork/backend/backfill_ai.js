const db = require('./database');
const { analyzeEmail } = require('./aiService');

console.log("🚀 Démarrage du rattrapage de l'IA pour les anciens emails...");

db.all("SELECT id, subject, content, from_address FROM emails WHERE action_recommandee IS NULL OR action_recommandee = 'Non défini' OR action_recommandee = ''", [], async (err, rows) => {
    if (err) {
        console.error("Erreur lecture DB:", err);
        return;
    }

    if (rows.length === 0) {
        console.log("✅ Tous les emails sont déjà à jour avec les décisions de l'IA !");
        return;
    }

    console.log(`📥 ${rows.length} anciens e-mails trouvés. L'IA va les analyser l'un après l'autre...`);

    for (let i = 0; i < rows.length; i++) {
        const mail = rows[i];
        console.log(`[${i+1}/${rows.length}] Analyse de : "${mail.subject}" ...`);
        
        try {
            const aiResult = await analyzeEmail(
                mail.subject, 
                mail.content ? mail.content.substring(0, 2000) : "", 
                mail.from_address
            );

            await new Promise((resolve, reject) => {
                db.run(
                    "UPDATE emails SET action_recommandee = ?, is_business = ?, priorite = ? WHERE id = ?",
                    [
                        aiResult.action_recommandee || "Répondre", 
                        aiResult.is_business ? 1 : 0, 
                        aiResult.priorite || "normal", 
                        mail.id
                    ],
                    (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else resolve();
                    }
                );
            });
            
            // Légère pause pour ne pas surcharger l'API Groq (Rate Limit)
            await new Promise(r => setTimeout(r, 1200));

        } catch (e) {
            console.error(`❌ Erreur sur l'email [${mail.id}]:`, e.message);
        }
    }

    console.log("🎉 Opération terminée ! Vos anciens mails ont maintenant leur décision de l'IA !");
});
