const db = require('./database');
const bcrypt = require('bcryptjs');

const hash = bcrypt.hashSync('admin123', 10);
db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'admin@moby.com'], (err) => {
    if (err) console.error(err);
    else console.log('Fixed to admin123! Hash is:', hash);
    db.close();
});
