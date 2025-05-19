const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = 5000;
const saltRounds = 10;

app.use(cors());
app.use(express.json());

// Connect to users DB
const db1 = new sqlite3.Database('./users.db', err => {
  if (err) return console.error(err.message);
  console.log('Connected to users.db');
});

// Create users table
db1.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT
)`);

// Connect to journal DB
const db2 = new sqlite3.Database('./journal.db', err => {
  if (err) return console.error(err.message);
  console.log('Connected to journal.db');
});

// Create journal table
db2.run(`CREATE TABLE IF NOT EXISTS journal (
  id TEXT PRIMARY KEY,
  date TEXT,
  pair TEXT,
  position TEXT,
  outcome TEXT,
  outcomeAmt REAL,
  riskReward TEXT,
  chartlink TEXT,
  balance REAL
)`);

// Register
app.post('/signup', (req, res) => {
  const { email, password } = req.body;

  // Check if the user already exists
  db1.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Server error.' });
    if (row) return res.status(400).json({ error: 'User already exists.' });

    // Insert the new user with plain password (not recommended)
    db1.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, password], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to register user.' });
      res.json({ message: 'User registered successfully.' });
    });
  });
});


// Login
// Login (without JWT)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db1.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Server error.' });
    if (!row) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    res.json({ message: 'Login successful' });
  });
});

// Create journal entry
app.post('/journal', (req, res) => {
  const id = uuid();
  const { date, pair, position, outcome, outcomeAmt, riskReward, chartlink, balance } = req.body;

  db2.run(
    `INSERT INTO journal (id, date, pair, position, outcome, outcomeAmt, riskReward, chartlink, balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, date, pair, position, outcome, outcomeAmt, riskReward, chartlink, balance],
    function(err) {
      if (err) return res.status(400).json({ error: 'Failed to insert journal entry' });
      res.json({ message: 'Journal entry added.' });
    }
  );
});

// Get journal entries for a specific month/year
app.get('/journal/data', (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ error: 'Month and year are required.' });
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-31`;

  db2.all(
    `SELECT * FROM journal WHERE date BETWEEN ? AND ? ORDER BY date ASC`,
    [startDate, endDate],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      res.json(rows);
    }
  );
});

// Delete journal entry
app.delete('/journal/:id', (req, res) => {
  const { id } = req.params;

  db2.run('DELETE FROM journal WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to delete entry.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Entry not found.' });
    res.json({ message: 'Entry deleted successfully.' });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
