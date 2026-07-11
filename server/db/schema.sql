-- MonsoonGuard AI — SQLite Database Schema
-- Run via: node server/db/seed.js

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- Community incident reports submitted by citizens
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL CHECK(type IN (
                'flood','road_blocked','power_outage',
                'tree_fallen','rescue_needed','landslide',
                'waterlogging','damage','other'
              )),
  lat         REAL    NOT NULL CHECK(lat BETWEEN -90 AND 90),
  lng         REAL    NOT NULL CHECK(lng BETWEEN -180 AND 180),
  description TEXT    NOT NULL DEFAULT '',
  severity    TEXT    NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high','critical')),
  address     TEXT,
  upvotes     INTEGER NOT NULL DEFAULT 0,
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type    ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_lat_lng ON reports(lat, lng);

-- ============================================================
-- Relief shelters and emergency camps
-- ============================================================
CREATE TABLE IF NOT EXISTS shelters (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  address            TEXT    NOT NULL,
  lat                REAL    NOT NULL,
  lng                REAL    NOT NULL,
  capacity           INTEGER NOT NULL DEFAULT 0,
  current_occupancy  INTEGER NOT NULL DEFAULT 0,
  has_food           INTEGER NOT NULL DEFAULT 1,
  has_medical        INTEGER NOT NULL DEFAULT 0,
  has_water          INTEGER NOT NULL DEFAULT 1,
  has_electricity    INTEGER NOT NULL DEFAULT 0,
  contact            TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shelters_active  ON shelters(active);
CREATE INDEX IF NOT EXISTS idx_shelters_lat_lng ON shelters(lat, lng);

-- ============================================================
-- User checklist items (synced server-side for persistence)
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL,
  item_text   TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'general',
  priority    TEXT    NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
  completed   INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_session ON checklist_items(session_id);

-- ============================================================
-- Rate limiting tracking (cleaned periodically)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT    NOT NULL,
  endpoint     TEXT    NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_ip_endpoint ON rate_limit_log(ip, endpoint, created_at);
