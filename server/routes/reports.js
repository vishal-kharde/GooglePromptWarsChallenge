'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../services/database');
const { validators } = require('../middleware/sanitizer');

// GET /api/reports — List recent reports (optionally in bounds)
router.get('/', (req, res, next) => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    let reports;
    if (minLat && maxLat && minLng && maxLng) {
      const parsedMinLat = parseFloat(minLat);
      const parsedMaxLat = parseFloat(maxLat);
      const parsedMinLng = parseFloat(minLng);
      const parsedMaxLng = parseFloat(maxLng);

      if (isNaN(parsedMinLat) || isNaN(parsedMaxLat) || isNaN(parsedMinLng) || isNaN(parsedMaxLng)) {
        return res.status(400).json({ error: 'Invalid bounds coordinates' });
      }
      reports = db.reports.getInBounds(parsedMinLat, parsedMaxLat, parsedMinLng, parsedMaxLng);
    } else {
      reports = db.reports.getAll();
    }

    res.json({ reports, count: reports.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports — Submit report
router.post('/', (req, res, next) => {
  try {
    const { valid, errors } = validators.report(req.body);
    if (!valid) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    const report = db.reports.create({
      type: req.body.type,
      lat: parseFloat(req.body.lat),
      lng: parseFloat(req.body.lng),
      description: req.body.description,
      severity: req.body.severity,
      address: req.body.address
    });

    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

// PUT /api/reports/:id/upvote — Upvote report
router.put('/:id/upvote', (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const report = db.reports.upvote(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
