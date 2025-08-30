const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Middleware: Auth
function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// GET all listings with filters
router.get('/', (req, res) => {
  let query = 'SELECT * FROM listings WHERE 1=1';
  const params = [];
  if (req.query.q) { query += ' AND title LIKE ?'; params.push(`%${req.query.q}%`); }
  if (req.query.city) { query += ' AND city = ?'; params.push(req.query.city); }
  if (req.query.type) { query += ' AND type = ?'; params.push(req.query.type); }
  if (req.query.category) { query += ' AND category = ?'; params.push(req.query.category); }
  if (req.query.minPrice) { query += ' AND price >= ?'; params.push(req.query.minPrice); }
  if (req.query.maxPrice) { query += ' AND price <= ?'; params.push(req.query.maxPrice); }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, images: JSON.parse(r.images || '[]') })));
  });
});

// GET single listing
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM listings WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    row.images = JSON.parse(row.images || '[]');
    res.json(row);
  });
});

// CREATE listing
router.post('/', auth, (req, res) => {
  const { title, type, category, price, age_months, description, images, city } = req.body;
  const stmt = db.prepare('INSERT INTO listings (title, type, category, price, age_months, description, images, city, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(title, type, category, price, age_months, description, JSON.stringify(images || []), city, req.user.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// UPDATE listing
router.put('/:id', auth, (req, res) => {
  const { title, type, category, price, age_months, description, images, city } = req.body;
  db.get('SELECT * FROM listings WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== req.user.id) return res.sendStatus(403);

    const stmt = db.prepare('UPDATE listings SET title=?, type=?, category=?, price=?, age_months=?, description=?, images=?, city=? WHERE id=?');
    stmt.run(title, type, category, price, age_months, description, JSON.stringify(images || []), city, req.params.id, function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ updated: true });
    });
  });
});

// DELETE listing
router.delete('/:id', auth, (req, res) => {
  db.get('SELECT * FROM listings WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== req.user.id) return res.sendStatus(403);

    const stmt = db.prepare('DELETE FROM listings WHERE id=?');
    stmt.run(req.params.id, function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: true });
    });
  });
});

module.exports = router;