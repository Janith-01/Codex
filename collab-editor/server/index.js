const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// API Endpoints

// CREATE a new document
app.post('/api/documents', async (req, res) => {
    try {
        const result = await pool.query(
            'INSERT INTO documents (content) VALUES ($1) RETURNING id',
            ['']
        );
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// GET a document by ID
app.get('/api/documents/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT content FROM documents WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Document not found');
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
