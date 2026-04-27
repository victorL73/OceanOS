const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function bridgeSecretPath() {
    return path.join(__dirname, '.mobywork_bridge_secret');
}

function bridgeToken() {
    if (process.env.MOBYWORK_BRIDGE_TOKEN) {
        return process.env.MOBYWORK_BRIDGE_TOKEN;
    }

    const file = bridgeSecretPath();
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    }

    return fs.readFileSync(file, 'utf8').trim();
}

module.exports = {
    bridgeSecretPath,
    bridgeToken,
};
