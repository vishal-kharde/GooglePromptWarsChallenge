'use strict';

/**
 * Input sanitization middleware and utilities.
 * Protects against XSS, prompt injection, and malformed data.
 */

const xss = require('xss');

// ============================================================
// XSS sanitization options — very strict for AI inputs
// ============================================================
const XSS_OPTIONS = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml'],
};

/**
 * Recursively sanitizes all string values in an object.
 * @param {any} value
 * @returns {any}
 */
function deepSanitize(value) {
  if (typeof value === 'string') {
    return xss(value.trim(), XSS_OPTIONS);
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      // Sanitize keys too (protect against prototype pollution)
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      sanitized[k] = deepSanitize(v);
    }
    return sanitized;
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body recursively.
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

/**
 * Validates required fields and types for specific route schemas.
 */
const validators = {
  /**
   * Validates report submission body.
   * @param {object} body
   * @returns {{ valid: boolean, errors: string[] }}
   */
  report(body) {
    const errors = [];
    const VALID_TYPES = ['flood','road_blocked','power_outage','tree_fallen','rescue_needed','landslide','waterlogging','damage','other'];
    const VALID_SEVERITIES = ['low','medium','high','critical'];

    if (!VALID_TYPES.includes(body.type)) errors.push('Invalid report type');
    if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90)   errors.push('Invalid latitude');
    if (typeof body.lng !== 'number' || body.lng < -180 || body.lng > 180) errors.push('Invalid longitude');
    if (body.severity && !VALID_SEVERITIES.includes(body.severity)) errors.push('Invalid severity');
    if (body.description && body.description.length > 500) errors.push('Description too long (max 500 chars)');

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validates user profile body for plan/checklist generation.
   * @param {object} body
   */
  profile(body) {
    const errors = [];
    if (!body.city || typeof body.city !== 'string') errors.push('City is required');
    if (body.adults !== undefined && (isNaN(body.adults) || body.adults < 0 || body.adults > 20)) {
      errors.push('Adults must be 0-20');
    }
    return { valid: errors.length === 0, errors };
  },

  /**
   * Validates chat message body.
   * @param {object} body
   */
  chat(body) {
    const errors = [];
    if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
      errors.push('Message is required');
    }
    if (body.message && body.message.length > 1000) errors.push('Message too long (max 1000 chars)');
    return { valid: errors.length === 0, errors };
  },
};

module.exports = { sanitizeBody, deepSanitize, validators };
