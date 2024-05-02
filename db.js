const { Pool } = require('pg');

const pool = new Pool({
    user: 'euroexplorer_db_user',
    host: 'dpg-coprqg4f7o1s73e63230-a.oregon-postgres.render.com',
    database: 'euroexplorer_db',
    password: 'fJ8tN9zgWcFdoOnCaJTUgswAckGm9mvu',
    port: 5432,
    ssl: true
  });

module.exports = {
    query: (text, params) => pool.query(text, params)
}