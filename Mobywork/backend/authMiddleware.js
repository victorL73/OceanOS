const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { findSharedUserById, publicSharedUser, useSharedAccounts } = require('./flowceanAccounts');

const configuredJwtSecret = process.env.JWT_SECRET || process.env.FLOWCEAN_AI_SECRET;
const JWT_SECRET = configuredJwtSecret || crypto.randomBytes(48).toString('hex');
if (!configuredJwtSecret) {
    console.warn('JWT_SECRET absent: secret temporaire genere pour cette execution. Definissez JWT_SECRET en production.');
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non autorise: token manquant' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (useSharedAccounts()) {
            const sharedUser = await findSharedUserById(decoded.id);
            if (!sharedUser || !sharedUser.is_active) {
                return res.status(401).json({ error: 'Non autorise: compte inactif ou introuvable' });
            }
            req.user = publicSharedUser(sharedUser);
        } else {
            req.user = decoded;
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Non autorise: token invalide ou expire' });
    }
}

function adminMiddleware(req, res, next) {
    if (req.user && (req.user.role === 'admin' || ['super', 'admin'].includes(req.user.accountRole))) {
        next();
    } else {
        return res.status(403).json({ error: 'Acces refuse: reserve aux administrateurs' });
    }
}

module.exports = { authMiddleware, adminMiddleware, JWT_SECRET };
