'use strict';

const express = require('express');
const router  = express.Router();
const weatherService = require('../services/weatherService');

// GET /api/weather?city=Mumbai  OR  ?lat=19.07&lon=72.87
router.get('/', async (req, res, next) => {
  try {
    let { city, lat, lon } = req.query;

    // Validate and parse coordinates
    if (lat !== undefined && lon !== undefined) {
      lat = parseFloat(lat);
      lon = parseFloat(lon);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({ error: 'Invalid latitude/longitude' });
      }
    } else if (city) {
      if (typeof city !== 'string' || city.trim() === '' || city.length > 100) {
        return res.status(400).json({ error: 'Invalid city name' });
      }
      const geo = await weatherService.geocodeCity(city.trim());
      if (!geo) {
        return res.status(404).json({ error: `City not found: "${city}"` });
      }
      lat = geo.lat;
      lon = geo.lon;
      res.locals.geoInfo = geo;
    } else {
      return res.status(400).json({ error: 'Provide either city or lat+lon query params' });
    }

    const forecast = await weatherService.getForecast(lat, lon);

    res.json({
      ...forecast,
      city: res.locals.geoInfo?.name || city || null,
      country: res.locals.geoInfo?.country,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/weather/geocode?city=Mumbai
router.get('/geocode', async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city || city.trim() === '') {
      return res.status(400).json({ error: 'City name required' });
    }
    const geo = await weatherService.geocodeCity(city.trim());
    if (!geo) return res.status(404).json({ error: 'City not found' });
    res.json(geo);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
