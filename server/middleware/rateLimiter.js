'use strict';

/**
 * Rate limiter middleware — enforces per-IP, per-endpoint limits
 * using SQLite for persistence (survives server restarts).
 * Falls back to in-memory if DB fails.
 */

require('dotenv').config();

const MAX_REQUESTS   = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10;
const WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15;
const WINDOW_MS      = WINDOW_MINUTES * 60 * 1000;

// In-memory fallback store
const memoryStore = new Map();

/**
 * Gets the real client IP, accounting for proxies.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Creates a rate limiter middleware for AI endpoints.
 * @param {number} [maxRequests] - Override default max
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter(maxRequests = MAX_REQUESTS) {
  return function rateLimiter(req, res, next) {
    const ip       = getClientIp(req);
    const endpoint = req.path;
    const key      = `${ip}:${endpoint}`;
    const now      = Date.now();

    // Try SQLite-backed rate limiting
    try {
      const db = require('./../../services/database').getDb();

      // Count recent requests in window
      const count = db.prepare(`
        SELECT COUNT(*) as c FROM rate_limit_log
        WHERE ip = ? AND endpoint = ?
          AND created_at > datetime('now', '-${WINDOW_MINUTES} minutes')
      `).get(ip, endpoint);

      if (count.c >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit: ${maxRequests} requests per ${WINDOW_MINUTES} minutes`,
          retryAfter: WINDOW_MINUTES * 60,
        });
      }

      // Log this request
      db.prepare('INSERT INTO rate_limit_log (ip, endpoint) VALUES (?, ?)').run(ip, endpoint);

    } catch (dbErr) {
      // Fallback to in-memory
      const entry = memoryStore.get(key);
      if (!entry || now - entry.start > WINDOW_MS) {
        memoryStore.set(key, { count: 1, start: now });
      } else {
        entry.count++;
        if (entry.count > maxRequests) {
          return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit: ${maxRequests} requests per ${WINDOW_MINUTES} minutes`,
          });
        }
      }
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Window', `${WINDOW_MINUTES}m`);

    next();
  };
}

module.exports = { createRateLimiter };
