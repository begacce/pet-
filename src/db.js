const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
dotenv.config();

const db = new sqlite3.Database(process.env.DB_FILE || './besisat.sqlite');

module.exports = db;