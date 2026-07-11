'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../services/database');

// GET /api/shelters?lat=&lon=&limit=
router.get('/', (req, res, next) => {
  try {
    const { lat, lon, limit } = req.query;

    let shelters;
    if (lat && lon) {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);
      if (isNaN(parsedLat) || isNaN(parsedLon)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }
      shelters = db.shelters.getNearest(parsedLat, parsedLon, parseInt(limit) || 20);
    } else {
      shelters = db.shelters.getAll();
    }

    res.json({ shelters, count: shelters.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
