const db = require('../database');
const { cleanRawInput } = require('./prospectCleaner');

/**
 * Récupère tous les prospects avec filtres
 */
async function getProspects(filters = {}, userId = 1) {
    let query = "SELECT * FROM prospects WHERE user_id = ?";
    let params = [userId];

    if (filters.type) { query += " AND type = ?"; params.push(filters.type); }
    if (filters.status) { query += " AND status = ?"; params.push(filters.status); }
    if (filters.city) { query += " AND city LIKE ?"; params.push(`%${filters.city}%`); }
    if (filters.search) {
        query += " AND (company_name LIKE ? OR email LIKE ?)";
        const s = `%${filters.search}%`;
        params.push(s, s);
    }

    query += " ORDER BY created_at DESC";

    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Importe et nettoie des prospects (Gestion par Lots / Batch Processing)
 */
async function importProspect(rawData, userId = 1) {
    const lines = rawData.split('\n').filter(line => line.trim().length > 0);
    const BATCH_SIZE = 5;
    const results = [];

    console.log(`🚀 Début de l'import : ${lines.length} lignes détectées. Traitement par lots de ${BATCH_SIZE}...`);

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batchLines = lines.slice(i, i + BATCH_SIZE);
        const batchText = batchLines.join('\n');
        
        console.log(`📦 Traitement Lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(lines.length/BATCH_SIZE)}...`);

        try {
            const cleanedBatch = await cleanRawInput(batchText, userId);
            
            for (const cleaned of cleanedBatch) {
                // Détection de doublon
                const existing = await new Promise(resolve => {
                    db.get("SELECT id FROM prospects WHERE email = ? AND email != '' AND user_id = ?", 
                        [cleaned.email, userId], (err, row) => resolve(row));
                });

                if (existing) {
                    console.log(`⚠️ Prospect existant ignoré: ${cleaned.email}`);
                    continue;
                }

                const query = `
                    INSERT INTO prospects 
                    (company_name, email, phone, type, tags, status, score, city, country, street, comments, category, confidence, raw_data, cleaned_data, user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const params = [
                    cleaned.company_name,
                    cleaned.email,
                    cleaned.phone,
                    cleaned.type,
                    JSON.stringify(cleaned.tags),
                    'Nettoyé',
                    cleaned.confidence_score,
                    cleaned.address?.city,
                    cleaned.address?.country,
                    cleaned.address?.street,
                    '', // comments
                    '', // category
                    0,  // confidence (default 0)
                    batchText,
                    JSON.stringify(cleaned),
                    userId
                ];

                const saved = await new Promise((resolve, reject) => {
                    db.run(query, params, function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID, ...cleaned });
                    });
                });
                results.push(saved);
            }
        } catch (error) {
            console.error(`❌ Erreur lors du traitement du lot à l'index ${i}:`, error.message);
            // On continue avec les autres lots
        }
    }

    console.log(`✅ Import terminé. ${results.length} prospects ajoutés.`);
    return { importedCount: results.length, totalLines: lines.length };
}

/**
 * Met à jour un prospect (ex: changement de statut)
 */
async function updateProspect(id, updates, userId = 1) {
    const keys = Object.keys(updates);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const params = [...Object.values(updates), id, userId];

    return new Promise((resolve, reject) => {
        db.run(`UPDATE prospects SET ${sets} WHERE id = ? AND user_id = ?`, params, function(err) {
            if (err) reject(err);
            else resolve({ success: true, changes: this.changes });
        });
    });
}

/**
 * Supprime un prospect
 */
async function deleteProspect(id, userId = 1) {
    const numericId = parseInt(id, 10);
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM prospects WHERE id = ? AND user_id = ?`, [numericId, userId], function(err) {
            if (err) {
                console.error(`❌ Erreur SQL suppression prospect #${id}:`, err);
                reject(err);
            } else {
                console.log(`✅ Prospect #${id} supprimé (Changes: ${this.changes})`);
                resolve({ success: true, changes: this.changes });
            }
        });
    });
}

module.exports = { getProspects, importProspect, updateProspect, deleteProspect };
