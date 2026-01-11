require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        const res = await pool.query('SELECT version();');
        console.log('✅ Connected! PostgreSQL version:', res.rows[0].version);
        await pool.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
})();
