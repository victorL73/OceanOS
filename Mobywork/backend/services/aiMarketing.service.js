const { getGroqClient } = require('../sharedGroq');
require('dotenv').config();


const aiMarketingService = {

    /**
     * Analyse les campagnes et génère des suggestions IA
     */
    async analyzeCampaigns(campaigns, kpis, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const campSummary = campaigns.map(c =>
            `- "${c.name}" (${c.platform}): Budget ${c.budget_daily}€/j, Dépensé ${c.spent}€, ROAS ${c.roas}x, CPC ${c.cpc}€, CTR ${c.ctr}%, Conv ${c.conversions}, Score ${c.score}, Statut: ${c.status}`
        ).join('\n');

        const prompt = `Tu es un expert en marketing digital et publicité (Google Ads + Meta Ads) pour une entreprise d'accastillage nautique.

Voici les KPIs globaux :
- Dépenses totales: ${kpis.totalSpent}€
- ROAS global: ${kpis.roas}x
- CPC moyen: ${kpis.cpcMoyen}€
- CTR moyen: ${kpis.ctrMoyen}%
- Conversions totales: ${kpis.totalConversions}
- Coût/Conversion: ${kpis.costPerConversion}€

Campagnes actives :
${campSummary}

Analyse ces données et génère EXACTEMENT un objet JSON avec des suggestions actionnables :
{
    "suggestions": [
        {
            "priority": "urgent" | "high" | "medium" | "low",
            "icon": "emoji approprié",
            "title": "Titre court de la suggestion",
            "description": "Explication détaillée (2-3 phrases)",
            "action": "Action recommandée concrète",
            "impact": "Impact estimé (ex: +15% ROAS, -0.30€ CPC)",
            "campaignId": null ou ID de la campagne concernée,
            "actionType": "pause" | "increase_budget" | "decrease_budget" | "optimize" | "alert" | "create"
        }
    ],
    "globalInsight": "Résumé en 2 phrases de la santé marketing globale"
}

Génère entre 3 et 6 suggestions pertinentes et variées.`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            console.error("❌ IA Marketing - Erreur analyse:", e.message);
            return {
                suggestions: [{
                    priority: "medium", icon: "⚠️", title: "Analyse temporairement indisponible",
                    description: "Le moteur IA n'a pas pu analyser les campagnes.", action: "Réessayer plus tard",
                    impact: "N/A", campaignId: null, actionType: "alert"
                }],
                globalInsight: "Analyse IA momentanément indisponible. Vérifiez la clé API Groq."
            };
        }
    },

    /**
     * Génère du contenu publicitaire
     */
    async generateAdContent(product, target, objective, platform, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const prompt = `Tu es un copywriter expert en publicité digitale pour l'accastillage et l'équipement nautique.

Génère une publicité complète pour :
- Produit/Service : ${product}
- Cible : ${target}
- Objectif : ${objective}
- Plateforme : ${platform}

Retourne UNIQUEMENT un objet JSON :
{
    "headlines": ["Headline principale (max 30 car.)", "Variante 2", "Variante 3"],
    "descriptions": ["Description principale (max 90 car.)", "Variante 2"],
    "longDescription": "Texte complet de la publicité (2-3 paragraphes)",
    "cta": "Call-to-action principal",
    "angles": ["Angle marketing 1: explication", "Angle 2: explication", "Angle 3: explication"],
    "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"],
    "targetingTips": "Conseil de ciblage spécifique pour cette pub"
}`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.5,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            console.error("❌ IA Marketing - Erreur génération pub:", e.message);
            throw new Error("Erreur de génération IA. Vérifiez la clé API.");
        }
    },

    /**
     * Copilote Marketing — Chat IA contextuel
     */
    async copilotChat(messages, campaignContext, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const systemPrompt = `Tu es le Copilote Marketing IA de MobyWorkspace, expert en Google Ads et Meta Ads pour une entreprise d'accastillage et d'équipement nautique (RenovBoat).

Tu as accès au contexte suivant des campagnes publicitaires :
${campaignContext}

Ton rôle :
1. Répondre aux questions sur les performances marketing
2. Proposer des optimisations concrètes
3. Expliquer les métriques (ROAS, CPC, CTR, etc.)
4. Suggérer des stratégies marketing

Réponds de manière concise, structurée avec des bullet points quand pertinent. Utilise des emojis pour la lisibilité. Propose toujours des actions concrètes.`;

        try {
            const chatMessages = [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content }))
            ];

            const completion = await groq.chat.completions.create({
                messages: chatMessages,
                model: "llama-3.1-8b-instant",
                temperature: 0.4,
                max_tokens: 1024
            });
            return { reply: completion.choices[0].message.content };
        } catch (e) {
            console.error("❌ IA Marketing - Erreur copilote:", e.message);
            throw new Error("Erreur du copilote IA.");
        }
    },

    /**
     * Suggestions d'audiences basées sur le CRM
     */
    async suggestAudiences(crmSummary, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const prompt = `Tu es un expert en ciblage publicitaire. Voici un résumé des données CRM :
${crmSummary}

Suggère 3 audiences publicitaires pertinentes au format JSON :
{
    "audiences": [
        { "name": "Nom de l'audience", "type": "lookalike|retargeting|interest|custom", "estimatedSize": 15000, "description": "Pourquoi cette audience", "platform": "google|meta|both" }
    ]
}`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.4,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            return { audiences: [] };
        }
    },

    /**
     * Génère une stratégie complète (Ads + Social) de manière cohérente
     */
    async generateCampaignStrategy(product, target, objective, tone, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const prompt = `Tu es un Directeur de Stratégie Marketing Digital Senior, expert en e-commerce nautique.
Ton objectif est de concevoir une stratégie OMNICANALE d'élite pour :
- Produit/Service : ${product}
- Cible initiale : ${target}
- Objectif : ${objective}
- Ton : ${tone}

Génère une stratégie unifiée et percutante. La cohérence doit être absolue entre le message payant et organique.

Retourne UNIQUEMENT un objet JSON très complet :
{
    "angle": "L'angle marketing unique (ex: L'innovation au service de la sécurité)",
    "hook": "La 'Big Idea' ou accroche principale de la campagne",
    "audiences": [
        { "segment": "Nom du segment cible", "interests": "Intérêts précis (ex: Plaisance, Voile, Yachting)", "logic": "Pourquoi cibler ce groupe ?" }
    ],
    "ads": {
        "google": { 
            "headlines": ["3 à 5 titres percutants (max 30 car.)"], 
            "descriptions": ["2 descriptions détaillées (max 90 car.)"], 
            "cta": "L'appel à l'action idéal" 
        },
        "meta": { 
            "headline": "Titre accrocheur", 
            "longDescription": "Texte de pub émotionnel et structuré (avec emojis)", 
            "cta": "Bouton recommandé" 
        }
    },
    "social": {
        "linkedin": "Post pro structuré (Accroche / Corps / Appel à l'action / Hashtags)",
        "facebook": "Post convivial et communautaire",
        "instagram": "Post lifestyle/visuel court avec focus sur l'image",
        "twitter": "Tweet percutant (< 280 car.)"
    },
    "budget_rec": {
        "daily": "Budget quotidien conseillé (€)",
        "split": "Répartition suggérée (ex: 60% Google, 40% Meta)",
        "duration": "Durée de campagne recommandée"
    },
    "strategyAdvice": "3 conseils critiques pour réussir ce lancement particulier"
}`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.3-70b-versatile", // Use latest versatile 70b model
                temperature: 0.7,
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            console.error("❌ IA Marketing - Erreur stratégie:", e.message);
            throw new Error("Erreur de génération stratégie IA.");
        }
    },

    /**
     * Transforme un contenu existant (Pub <-> Social)
     */
    async transformContent(sourceContent, sourceType, targetType, userId = 1) {
        let groq;
        try { groq = await getGroqClient(userId); } catch (e) { throw new Error(e); }

        const prompt = `Tu es un copywriter expert. Transforme le contenu suivant :
Source : [${sourceType}] -> ${sourceContent}
Cible : [${targetType}]

Garde le même angle marketing mais adapte le format, le ton et les contraintes (hashtags, longueur, style).
Retourne UNIQUEMENT le texte transformé, sans commentaires.`;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.5
            });
            return { transformedContent: completion.choices[0].message.content.trim() };
        } catch (e) {
            console.error("❌ IA Marketing - Erreur transformation:", e.message);
            throw new Error("Erreur de transformation IA.");
        }
    }
};

module.exports = aiMarketingService;
