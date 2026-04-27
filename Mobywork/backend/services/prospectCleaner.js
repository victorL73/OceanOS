const { getGroqClient } = require('../sharedGroq');
require('dotenv').config();

const MODEL = "llama-3.1-8b-instant";


/**
 * Nettoie une entrée brute (texte libre ou ligne CSV) via Groq
 */
async function cleanRawInput(rawText, userId = 1) {
    const prompt = `Tu es une IA spécialisée dans la prospection B2B pour le secteur NAUTIQUE.
Ton rôle est d'analyser ce texte brut (qui peut contenir plusieurs prospects/lignes) et d'en extraire des informations structurées.

TEXTE BRUT :
"${rawText}"

Tâches pour CHAQUE prospect détecté :
1. Extraire le nom de l'entreprise.
2. Détecter le type (chantier naval, revendeur, maintenance, broker, autre).
3. Extraire l'email et le téléphone.
4. Analyser l'adresse (rue, ville, pays).
5. Générer 3 à 5 tags (ex: "Acier", "Voile", "Luxe", "Moteur").
6. Attribuer un confidence_score (0-100).
7. Définir une priorité (low, medium, high).

RÈGLES :
- Format français.
- Retourne UNIQUEMENT une liste JSON d'objets.
- Si une donnée est manquante, mets chaine vide ou null.

JSON Attendu :
{
  "prospects": [
    {
      "company_name": "",
      "type": "",
      "email": "",
      "phone": "",
      "address": { "street": "", "city": "", "country": "" },
      "tags": [],
      "confidence_score": 0,
      "priority": "low"
    }
  ]
}`;

    try {
        const groq = await getGroqClient(userId);
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const data = JSON.parse(completion.choices[0].message.content);
        return data.prospects || [];
    } catch (error) {
        console.error("❌ [IA Cleaner] Erreur:", error.message);
        throw error;
    }
}

/**
 * Génère des variantes d'emails de prospection
 */
async function generateEmailVariants(prospectData, userId = 1) {
    const prompt = `Génère 3 variantes d'emails de prospection pour ce prospect du secteur nautique.
    
PROSPECT :
- Nom : ${prospectData.company_name}
- Type : ${prospectData.type}
- Ville : ${prospectData.city || 'Inconnue'}
- Tags : ${prospectData.tags}

VARIANTES ATTENDUES :
1. "Courte" : Directe, max 3 phrases.
2. "Commerciale" : Argumentée, mettant en avant une expertise nautique.
3. "Agressive" : Très axée sur le ROI et l'urgence.

Contexte Mobywork : nous proposons des solutions logicielles/IA pour les pros du nautisme.

Retourne un JSON :
{
  "short": "",
  "commercial": "",
  "aggressive": ""
}`;

    try {
        const groq = await getGroqClient(userId);
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("❌ [IA Email] Erreur:", error.message);
        throw error;
    }
}

module.exports = { cleanRawInput, generateEmailVariants };
