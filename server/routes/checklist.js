'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../services/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/checklist/:sessionId
router.get('/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || sessionId.length > 64) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const items = db.checklist.getBySession(sessionId);
    res.json({ items, sessionId });
  } catch (err) {
    next(err);
  }
});

// POST /api/checklist — Upsert full checklist
router.post('/', (req, res, next) => {
  try {
    let { sessionId, items } = req.body;

    if (!sessionId) sessionId = uuidv4();
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: 'Max 100 items per checklist' });
    }

    const saved = db.checklist.upsertItems(sessionId, items);
    res.status(201).json({ items: saved, sessionId });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/checklist/:sessionId/items/:itemId — Toggle item completion
router.patch('/:sessionId/items/:itemId', (req, res, next) => {
  try {
    const { sessionId, itemId } = req.params;
    const { completed } = req.body;

    if (completed === undefined) {
      return res.status(400).json({ error: 'completed field required' });
    }

    const item = db.checklist.updateItem(parseInt(itemId), sessionId, completed);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
