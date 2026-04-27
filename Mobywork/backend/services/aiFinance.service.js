const { getGroqClient } = require('../sharedGroq');
require('dotenv').config();


const aiFinanceService = {
    /**
     * 8. ANALYSE FINANCIÈRE INTÉGRALE
     */
    async generateFinanceInsights(financeData, userId = 1) {
        let groq;
        try {
            groq = await getGroqClient(userId);
        } catch(e) {
            throw new Error(e);
        }

        const prompt = `Agis comme le Directeur Financier pragmatique et visionnaire de l'entreprise MobyWorkspace.
Voici les données financières clés calculées à l'instant :
- Chiffre d'Affaire Total évalué: ${financeData.totalRevenue.toFixed(2)} €
- Charges Totales détectées: ${financeData.totalExpenses.toFixed(2)} €
- Bénéfice Net Estimé: ${financeData.beneficeNetEstime.toFixed(2)} €
- Trésorerie Actuelle (cashflow glissant simulé): ${financeData.currentCashflow.toFixed(2)} €

Analyse ces données et retourne STRICTEMENT un objet JSON valide qui structure ta conclusion. 

Format attendu :
{
    "summary": "Résumé analytique de notre santé (3 phrases fortes et claires max)",
    "anomalies": ["Point d'attention 1: ...", "Point d'attention 2: ..."],
    "recommendations": ["Action urgente 1: ...", "Optimisation 2: ..."],
    "riskLevel": "Faible" | "Moyen" | "Élevé",
    "forecast": "Bref pronostic pour les 30 prochains jours (2 phrases)"
}`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch(e) {
            console.error("Erreur IA Finance:", e.message);
            return {
                summary: "Les données sont insuffisantes pour une analyse approfondie immédiate, ou le moteur IA n'a pas pu traiter la demande.",
                anomalies: ["Connexion au cerveau d'analyse momentanément perdue."],
                recommendations: ["Vérifiez vos paramètres de clé API Groq."],
                riskLevel: "Moyen",
                forecast: "Impossible à déterminer."
            };
        }
    }
};

module.exports = aiFinanceService;
