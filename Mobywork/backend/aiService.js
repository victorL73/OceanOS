const { getGroqClient } = require('./sharedGroq');
require('dotenv').config();

const MODEL = "llama-3.1-8b-instant";


// ─── PROMPT DE BASE (Auto-Pilote / Analyse Initiale) ─────────────────────────
function buildPrompt(subject, content, from) {
    return `Tu es le "Cerveau" d'un client mail extrêmement intelligent de l'entreprise nautique MobyWorkspace.

Analyse cet email et réponds STRICTEMENT avec un unique objet JSON valide.

Email reçu :
- Expéditeur: ${from}
- Sujet: ${subject}
- Contenu: ${content.substring(0,2500)}

Ton rôle est ultra-proactif :
1) Détermine "action_recommandee" :
  - "Archiver" : si c'est une newsletter, du spam, ou une simple notification sans intérêt.
  - "Ignorer" : si c'est un mail purement informatif à garder mais sans y répondre.
  - "Répondre" : si le mail nécessite une réponse ou une attention humaine explicite.
2) Détermine "is_business": true si le mail indique une intention d'achat, de devis, de commande ou de partenariat majeur. false sinon.
3) Assigne "priorite" :
  - "urgent" (rouge) : alerte de sécurité, client fâché, transaction bloquée, deadline sous 2h.
  - "important" (orange) : opportunité commerciale, partenaire.
  - "normal" (bleu) : discussion classique.
  - "faible" (gris) : newsletter, notification.
4) Si "action_recommandee" vaut "Répondre", complète "reponse_formelle", "reponse_amicale" et "reponse_rapide". Sinon, laisse-les vides ("").

JSON Attendu :
{
  "categorie": "facture" | "client" | "partenaire" | "newsletter" | "interne" | "autre",
  "action_recommandee": "Répondre" | "Ignorer" | "Archiver",
  "is_business": boolean,
  "priorite": "urgent" | "important" | "normal" | "faible",
  "resume": "Résumé rapide (1 phrase)",
  "reponse_formelle": "Votre réponse structurée pour ce contexte",
  "reponse_amicale": "Une réponse plus cool",
  "reponse_rapide": "Très court",
  "amount": null,
  "due_date": null
}`;
}

async function analyzeEmail(subject, content, from, userId = 1) {
    const prompt = buildPrompt(subject, content, from);
    
    try {
        const groq = await getGroqClient(userId);
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.15,
            response_format: { type: "json_object" }
        });

        const responseText = completion.choices[0].message.content;
        const result = JSON.parse(responseText);

        // Fallbacks
        if (result.action_recommandee === 'Répondre') {
            if (!result.reponse_formelle) result.reponse_formelle = `Bonjour,\\n\\nBien reçu, merci.\\n\\nCdt`;
            if (!result.reponse_amicale) result.reponse_amicale = `Salut ! Bien reçu !\\nÀ bientôt`;
            if (!result.reponse_rapide) result.reponse_rapide = `Merci !`;
        }

        return result;

    } catch (error) {
        console.error("❌ [IA] Erreur analyse email:", error.message);
        return {
            categorie: "autre",
            action_recommandee: "Ignorer",
            is_business: false,
            priorite: "normal",
            resume: "Erreur IA.",
            reponse_formelle: "",
            reponse_amicale: "",
            reponse_rapide: "",
            amount: null,
            due_date: null
        };
    }
}

// ─── RE-GÉNÉRATION AVEC MÉMOIRE DE STYLE ─────────────────────────────────────────────
async function generateReply(subject, content, from, style = "Professionnel", userId = 1) {
    let tonInstruction = "professionnelle et standard";
    if (style === 'Cool / Amical') tonInstruction = "chaleureuse, amicale, avec enthousiasme (tu peux utiliser un discret emoji)";
    if (style === 'Très formel') tonInstruction = "extrêmement stricte, respectueuse, avec vouvoiement de rigueur";
    if (style === 'Direct / Concis') tonInstruction = "ultra directe, droit au but, en max 2 phrases";

    const prompt = `Tu es un assistant de messagerie.

Email reçu :
- Expéditeur: ${from}
- Sujet: ${subject}
- Contenu: ${content.substring(0, 2000)}

L'utilisateur te demande de générer des réponses en adoptant CE STYLE SPÉCIFIQUE : "${tonInstruction}".

Génère UNIQUEMENT un objet JSON :
{
  "resume": "Résumé de rappel de contexte (1 phrase)",
  "reponse_formelle": "Réponse adoptant parfaitement le style: ${tonInstruction}",
  "reponse_amicale": "Variante légèrement plus souple mais conservant le style: ${tonInstruction}",
  "reponse_rapide": "Variante d'une ligne adoptant le style: ${tonInstruction}"
}`;

    try {
        const groq = await getGroqClient(userId);
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL,
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        return result;

    } catch (error) {
        console.error("❌ [IA] Erreur génération:", error.message);
        throw new Error("Erreur de l'API IA.");
    }
}

module.exports = { analyzeEmail, generateReply };
