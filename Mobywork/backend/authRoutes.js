const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { JWT_SECRET, authMiddleware, adminMiddleware } = require('./authMiddleware');
const {
    authenticateSharedUser,
    createSharedUser,
    deactivateSharedUser,
    listSharedUsers,
    useSharedAccounts,
} = require('./flowceanAccounts');

const router = express.Router();
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function loginThrottleKey(req) {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return `${forwardedFor || req.ip || req.socket?.remoteAddress || 'local'}|${req.headers['user-agent'] || ''}`;
}

function pruneLoginAttempts(now = Date.now()) {
    for (const [key, entry] of loginAttempts.entries()) {
        if (!entry || (entry.lastAt < now - 24 * 60 * 60 * 1000 && entry.lockedUntil < now)) {
            loginAttempts.delete(key);
        }
    }
}

function loginRateLimit(req, res, next) {
    pruneLoginAttempts();
    const entry = loginAttempts.get(loginThrottleKey(req));
    const lockedUntil = entry?.lockedUntil || 0;
    if (lockedUntil > Date.now()) {
        return res.status(429).json({ error: 'Trop de tentatives. Reessayez dans quelques minutes.' });
    }

    return next();
}

function recordLoginFailure(req) {
    const now = Date.now();
    const key = loginThrottleKey(req);
    const previous = loginAttempts.get(key);
    const entry = previous && now - previous.firstAt <= LOGIN_WINDOW_MS
        ? previous
        : { count: 0, firstAt: now, lastAt: 0, lockedUntil: 0 };

    entry.count += 1;
    entry.lastAt = now;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOGIN_LOCK_MS;
    }
    loginAttempts.set(key, entry);
}

function clearLoginFailures(req) {
    loginAttempts.delete(loginThrottleKey(req));
}

function signUser(user) {
    return jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.nom,
        displayName: user.displayName || user.nom,
        accountRole: user.accountRole || user.role,
        source: user.source || 'local',
    }, JWT_SECRET, { expiresIn: '7d' });
}

function localRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function localGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function localAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function ensureLocalUserProfile(user) {
    await localRun(
        `INSERT OR IGNORE INTO users (id, email, password_hash, nom, role)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, user.email, '', user.nom || user.displayName || user.email, user.role || 'user']
    ).catch(() => {});

    await localRun(
        `UPDATE users
         SET email = ?, nom = ?, role = ?
         WHERE id = ?`,
        [user.email, user.nom || user.displayName || user.email, user.role || 'user', user.id]
    ).catch((err) => {
        console.warn('Profil local Mobywork non synchronise:', err.message);
    });

    await localRun('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', [user.id]);

    await localRun(
        `UPDATE user_settings
         SET nom = COALESCE(NULLIF(nom, ''), ?)
         WHERE user_id = ?`,
        [user.nom || user.displayName || user.email, user.id]
    ).catch(() => {});
}

function publicLocalUser(user) {
    return {
        id: Number(user.id),
        email: user.email,
        nom: user.nom,
        displayName: user.nom,
        role: user.role === 'admin' ? 'admin' : 'user',
        accountRole: user.role === 'admin' ? 'admin' : 'member',
        source: 'local',
    };
}

function publicTeamUser(user) {
    return {
        id: Number(user.id),
        email: user.email,
        nom: user.nom || user.displayName || user.email,
        displayName: user.displayName || user.nom || user.email,
        role: user.role === 'admin' ? 'admin' : 'user',
        accountRole: user.accountRole || (user.role === 'admin' ? 'admin' : 'member'),
        created_at: user.created_at || user.createdAt || null,
    };
}

async function loginLocal(email, password) {
    const user = await localGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
        return null;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    return ok ? publicLocalUser(user) : null;
}

router.post('/login', loginRateLimit, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    try {
        const user = useSharedAccounts()
            ? await authenticateSharedUser(email, password)
            : await loginLocal(email, password);

        if (!user) {
            recordLoginFailure(req);
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        clearLoginFailures(req);
        await ensureLocalUserProfile(user);
        const token = signUser(user);
        res.json({ success: true, token, user });
    } catch (error) {
        console.error('Erreur authentification Mobywork:', error);
        res.status(500).json({
            error: useSharedAccounts()
                ? 'Connexion a la base utilisateurs Flowcean impossible.'
                : 'Erreur serveur',
        });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    await ensureLocalUserProfile(req.user);
    res.json({ success: true, user: req.user });
});

router.post('/register', authMiddleware, adminMiddleware, async (req, res) => {
    return res.status(410).json({
        error: 'La creation des comptes se fait maintenant dans OceanOS.',
        oceanosUrl: '/OceanOS/',
    });

    const { email, password, nom, role } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    try {
        if (useSharedAccounts()) {
            const user = await createSharedUser({ email, password, nom, role });
            await ensureLocalUserProfile(user);
            return res.status(201).json({
                success: true,
                message: 'Utilisateur cree dans les comptes Flowcean/Invocean.',
                id: user.id,
                user,
            });
        }

        const hash = await bcrypt.hash(password, 10);
        const result = await localRun(
            `INSERT INTO users (email, password_hash, nom, role)
             VALUES (?, ?, ?, ?)`,
            [email, hash, nom, role || 'user']
        );

        await localRun('INSERT INTO user_settings (user_id) VALUES (?)', [result.lastID]);
        res.status(201).json({ success: true, message: 'Utilisateur cree avec succes', id: result.lastID });
    } catch (error) {
        const status = error.statusCode || (String(error.message || '').includes('UNIQUE') ? 409 : 500);
        res.status(status).json({ error: error.message || 'Erreur creation utilisateur' });
    }
});

router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        if (useSharedAccounts()) {
            const users = await listSharedUsers();
            return res.json(users.map(publicTeamUser));
        }

        const users = await localAll('SELECT id, email, nom, role, created_at FROM users ORDER BY created_at ASC');
        res.json(users.map(publicTeamUser));
    } catch (error) {
        console.error('Erreur liste utilisateurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    return res.status(410).json({
        error: 'La gestion des droits se fait maintenant dans OceanOS.',
        oceanosUrl: '/OceanOS/',
    });

    const id = Number(req.params.id);
    if (id === Number(req.user.id)) {
        return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });
    }

    try {
        if (useSharedAccounts()) {
            await deactivateSharedUser(id);
            return res.json({ success: true, message: 'Utilisateur desactive dans les comptes Flowcean/Invocean.' });
        }

        await localRun('DELETE FROM user_settings WHERE user_id = ?', [id]);
        await localRun('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'Utilisateur supprime' });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Erreur lors de la suppression du compte' });
    }
});

module.exports = router;
