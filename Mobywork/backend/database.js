const driver = (process.env.MOBYWORK_DB_DRIVER || 'sqlite').toLowerCase();

module.exports = driver === 'sqlite'
    ? require('./database.sqlite')
    : require('./oceanosDatabase');
