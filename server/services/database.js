'use strict';

/**
 * Database service — wraps better-sqlite3 with prepared statements.
 * All queries use parameterized statements to prevent SQL injection.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '..', 'db', 'monsoonguard.db');

const SCHEMA_PATH = path.resolve(__dirname, '..', 'db', 'schema.sql');

/** @type {Database.Database | null} */
let _db = null;

/**
 * Opens (or returns cached) database connection.
 * @returns {Database.Database}
 */
function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Apply schema on first run
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  _db.exec(schema);

  return _db;
}

// ============================================================
// Reports
// ============================================================

const reportQueries = {
  getAll: () => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM reports
      WHERE created_at > datetime('now', '-48 hours')
      ORDER BY created_at DESC
      LIMIT 200
    `).all();
  },

  getInBounds: (minLat, maxLat, minLng, maxLng) => {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM reports
      WHERE lat BETWEEN ? AND ?
        AND lng BETWEEN ? AND ?
        AND created_at > datetime('now', '-48 hours')
      ORDER BY created_at DESC
      LIMIT 100
    `).all(minLat, maxLat, minLng, maxLng);
  },

  create: ({ type, lat, lng, description, severity, address }) => {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO reports (type, lat, lng, description, severity, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(type, lat, lng, description || '', severity || 'medium', address || '');
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid);
  },

  upvote: (id) => {
    const db = getDb();
    db.prepare('UPDATE reports SET upvotes = upvotes + 1 WHERE id = ?').run(id);
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  },
};

// ============================================================
// Shelters
// ============================================================

const shelterQueries = {
  getAll: () => {
    const db = getDb();
    return db.prepare('SELECT * FROM shelters WHERE active = 1 ORDER BY name').all();
  },

  getNearest: (lat, lng, limit = 20) => {
    const db = getDb();
    // Haversine approximation using SQLite (good enough for UI display)
    return db.prepare(`
      SELECT *,
        (6371 * acos(
          cos(radians(?)) * cos(radians(lat)) *
          cos(radians(lng) - radians(?)) +
          sin(radians(?)) * sin(radians(lat))
        )) AS distance_km
      FROM shelters
      WHERE active = 1
      ORDER BY distance_km ASC
      LIMIT ?
    `).all(lat, lng, lat, limit);
  },
};

// ============================================================
// Checklist
// ============================================================

const checklistQueries = {
  getBySession: (sessionId) => {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM checklist_items WHERE session_id = ? ORDER BY category, created_at'
    ).all(sessionId);
  },

  upsertItems: (sessionId, items) => {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO checklist_items (session_id, item_text, category, priority, completed)
      VALUES (?, ?, ?, ?, ?)
    `);
    const upsert = db.transaction((items) => {
      // Clear existing items for this session then re-insert
      db.prepare('DELETE FROM checklist_items WHERE session_id = ?').run(sessionId);
      for (const item of items) {
        insert.run(sessionId, item.text, item.category || 'general', item.priority || 'medium', item.completed ? 1 : 0);
      }
    });
    upsert(items);
    return checklistQueries.getBySession(sessionId);
  },

  updateItem: (id, sessionId, completed) => {
    const db = getDb();
    db.prepare(
      'UPDATE checklist_items SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND session_id = ?'
    ).run(completed ? 1 : 0, id, sessionId);
    return db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);
  },
};

// ============================================================
// Cleanup utilities
// ============================================================

function cleanupOldData() {
  const db = getDb();
  // Remove reports older than 7 days
  db.prepare("DELETE FROM reports WHERE created_at < datetime('now', '-7 days')").run();
  // Remove rate limit logs older than 1 hour
  db.prepare("DELETE FROM rate_limit_log WHERE created_at < datetime('now', '-1 hour')").run();
}

// Run cleanup every hour
// Unref so the interval doesn't keep Node.js alive in tests
const _cleanupInterval = setInterval(cleanupOldData, 60 * 60 * 1000);
if (_cleanupInterval.unref) _cleanupInterval.unref();

module.exports = {
  getDb,
  reports: reportQueries,
  shelters: shelterQueries,
  checklist: checklistQueries,
  cleanupOldData,
};
