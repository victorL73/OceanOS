const { bridgeToken } = require('./oceanosBridge');

const SQL_URL = process.env.MOBYWORK_SQL_URL || 'http://127.0.0.1/Mobywork/api/sql.php';
let sqlQueue = Promise.resolve();

function enqueueSql(action, sql = '', params = []) {
    sqlQueue = sqlQueue.then(() => callSql(action, sql, params), () => callSql(action, sql, params));
    return sqlQueue;
}

async function callSql(action, sql = '', params = []) {
    const response = await fetch(SQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Mobywork-Bridge': bridgeToken(),
        },
        body: JSON.stringify({ action, sql, params }),
    });

    const text = await response.text();
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Reponse SQL OceanOS invalide: ${text.slice(0, 160)}`);
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || 'Erreur SQL OceanOS.');
    }

    return payload;
}

function normalizeArgs(params, callback) {
    if (typeof params === 'function') {
        return { params: [], callback: params };
    }
    return {
        params: Array.isArray(params) ? params : (params === undefined ? [] : [params]),
        callback: typeof callback === 'function' ? callback : null,
    };
}

function normalizePreparedArgs(args) {
    const list = Array.from(args);
    const maybeCallback = typeof list[list.length - 1] === 'function' ? list.pop() : null;
    const params = list.length === 1 && Array.isArray(list[0]) ? list[0] : list;
    return { params, callback: maybeCallback };
}

const db = {
    serialize(callback) {
        if (typeof callback === 'function') callback();
    },

    run(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        enqueueSql('run', sql, args.params)
            .then((payload) => {
                if (args.callback) {
                    args.callback.call({
                        lastID: payload.lastID || 0,
                        changes: payload.changes || 0,
                    }, null);
                }
            })
            .catch((error) => {
                if (args.callback) args.callback.call({}, error);
                else console.warn('[OceanOS SQL]', error.message);
            });
        return this;
    },

    get(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        enqueueSql('get', sql, args.params)
            .then((payload) => {
                if (args.callback) args.callback(null, payload.row || undefined);
            })
            .catch((error) => {
                if (args.callback) args.callback(error);
                else console.warn('[OceanOS SQL]', error.message);
            });
        return this;
    },

    all(sql, params, callback) {
        const args = normalizeArgs(params, callback);
        enqueueSql('all', sql, args.params)
            .then((payload) => {
                if (args.callback) args.callback(null, payload.rows || []);
            })
            .catch((error) => {
                if (args.callback) args.callback(error);
                else console.warn('[OceanOS SQL]', error.message);
            });
        return this;
    },

    prepare(sql) {
        return {
            run(...args) {
                const parsed = normalizePreparedArgs(args);
                enqueueSql('run', sql, parsed.params)
                    .then((payload) => {
                        if (parsed.callback) {
                            parsed.callback.call({
                                lastID: payload.lastID || 0,
                                changes: payload.changes || 0,
                            }, null);
                        }
                    })
                    .catch((error) => {
                        if (parsed.callback) parsed.callback.call({}, error);
                        else console.warn('[OceanOS SQL]', error.message);
                    });
                return this;
            },
            finalize(callback) {
                if (typeof callback === 'function') callback();
            },
        };
    },
};

console.log('Connecte a OceanOS MySQL via tables mobywork_*');

module.exports = db;
