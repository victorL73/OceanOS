const driver = (process.env.MOBYWORK_DB_DRIVER || 'oceanos').toLowerCase();

module.exports = driver === 'sqlite'
    ? require('./database.sqlite')
    : require('./oceanosDatabase');
