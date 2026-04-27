const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Users/azrod/OneDrive/Bureau/projet site/projet site/outils de poste site/backend/emails.db');

db.serialize(() => {
    db.all("SELECT * FROM crm_activities", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);
    });
});
