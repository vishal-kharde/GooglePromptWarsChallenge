'use strict';

/**
 * AI routes — all Gemini API endpoints.
 * Every route validates input, calls Gemini, and returns structured responses.
 */

const express  = require('express');
const router   = express.Router();
const gemini   = require('../services/gemini');
const weather  = require('../services/weatherService');
const { createRateLimiter }              = require('../middleware/rateLimiter');
const { validators }                     = require('../middleware/sanitizer');
const { getPreparednessSystemPrompt, buildPlanPrompt }   = require('../prompts/preparedness');
const { getChatSystemPrompt, buildChatMessages, QUICK_ACTIONS } = require('../prompts/chat');
const {
  getTravelSystemPrompt, buildTravelPrompt,
  getChecklistSystemPrompt, buildChecklistPrompt,
  getRecoverySystemPrompt, buildRecoveryPrompt,
} = require('../prompts/travel');

const aiLimiter = createRateLimiter(10);

// ============================================================
// POST /api/ai/plan — Generate personalized preparedness plan
// ============================================================
router.post('/plan', aiLimiter, async (req, res, next) => {
  try {
    const { profile } = req.body;
    const { valid, errors } = validators.profile(profile || {});

    if (!valid) {
      return res.status(400).json({ error: 'Invalid profile', details: errors });
    }

    // Fetch live weather for context (optional — don't fail if weather fails)
    let weatherData = null;
    try {
      const geo = await weather.geocodeCity(profile.city);
      if (geo) weatherData = await weather.getForecast(geo.lat, geo.lon);
    } catch (e) {
      console.warn('⚠️ Weather fetch failed for plan generation:', e.message);
    }

    const systemPrompt  = getPreparednessSystemPrompt();
    const userPrompt    = buildPlanPrompt(profile, weatherData);
    const planText      = await gemini.generateContent(userPrompt, systemPrompt, {
      temperature: 0.6,
      maxOutputTokens: 3000,
    });

    res.json({
      plan:    planText,
      weather: weatherData ? {
        current:    weatherData.current,
        city:       profile.city,
        risk_level: weatherData.current?.risk_level,
      } : null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/ai/chat — Streaming multilingual chat
// ============================================================
router.post('/chat', aiLimiter, async (req, res, next) => {
  try {
    const { message, history = [], language = 'English', city = 'India' } = req.body;
    const { valid, errors } = validators.chat(req.body);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid request', details: errors });
    }

    const systemPrompt = getChatSystemPrompt(language, city);
    const messages     = buildChatMessages(history, message);

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    let fullText = '';
    await gemini.generateStream(messages, systemPrompt, (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
    res.end();

  } catch (err) {
    // If headers not sent yet, send error JSON; otherwise send SSE error event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
});

// ============================================================
// GET /api/ai/quick-actions — Quick action prompts by language
// ============================================================
router.get('/quick-actions', (req, res) => {
  const { language = 'English' } = req.query;
  const actions = QUICK_ACTIONS[language] || QUICK_ACTIONS.English;
  res.json({ actions });
});

// ============================================================
// POST /api/ai/checklist — Generate AI-powered checklist
// ============================================================
router.post('/checklist', aiLimiter, async (req, res, next) => {
  try {
    const { profile } = req.body;
    const { valid, errors } = validators.profile(profile || {});
    if (!valid) return res.status(400).json({ error: 'Invalid profile', details: errors });

    const systemPrompt  = getChecklistSystemPrompt();
    const userPrompt    = buildChecklistPrompt(profile);
    const rawText       = await gemini.generateContent(userPrompt, systemPrompt, {
      temperature: 0.4,
      maxOutputTokens: 2000,
    });

    // Parse JSON response from Gemini
    let items;
    try {
      // Strip any markdown fences if model added them
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) throw new Error('Response is not an array');
    } catch (parseErr) {
      console.error('Gemini checklist JSON parse error:', parseErr.message, '\nRaw:', rawText.slice(0, 200));
      return res.status(502).json({
        error: 'AI response parsing failed',
        message: 'Gemini returned malformed checklist data. Please try again.',
      });
    }

    res.json({ items, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/ai/travel — Travel safety advisory
// ============================================================
router.post('/travel', aiLimiter, async (req, res, next) => {
  try {
    const { origin, destination, travelDate, mode, travelers, notes } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // Fetch weather for both origin and destination in parallel
    const [originWeather, destWeather] = await Promise.allSettled([
      (async () => {
        const geo = await weather.geocodeCity(origin);
        return geo ? weather.getForecast(geo.lat, geo.lon) : null;
      })(),
      (async () => {
        const geo = await weather.geocodeCity(destination);
        return geo ? weather.getForecast(geo.lat, geo.lon) : null;
      })(),
    ]);

    const originW = originWeather.status === 'fulfilled' ? originWeather.value : null;
    const destW   = destWeather.status   === 'fulfilled' ? destWeather.value   : null;

    const systemPrompt = getTravelSystemPrompt();
    const userPrompt   = buildTravelPrompt(
      { origin, destination, travelDate, mode, travelers, notes },
      originW, destW
    );

    const advisory = await gemini.generateContent(userPrompt, systemPrompt, {
      temperature: 0.5,
      maxOutputTokens: 1500,
    });

    res.json({
      advisory,
      origin_weather:      originW ? originW.current : null,
      destination_weather: destW   ? destW.current   : null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/ai/recovery — Post-disaster recovery guide
// ============================================================
router.post('/recovery', aiLimiter, async (req, res, next) => {
  try {
    const { city, damageType, homeDamage, cropLoss, medical, family, hasInsurance, language } = req.body;

    if (!damageType) {
      return res.status(400).json({ error: 'Damage type is required' });
    }

    const systemPrompt = getRecoverySystemPrompt();
    const userPrompt   = buildRecoveryPrompt(req.body);
    const guide        = await gemini.generateContent(userPrompt, systemPrompt, {
      temperature: 0.6,
      maxOutputTokens: 2500,
    });

    res.json({ guide, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/ai/risk — AI risk narrative from weather data
// ============================================================
router.post('/risk', aiLimiter, async (req, res, next) => {
  try {
    const { weatherData, city, language = 'English' } = req.body;
    if (!weatherData) return res.status(400).json({ error: 'Weather data required' });

    const prompt = `You are a weather risk communicator. Write a 2-3 sentence monsoon risk summary for ${city} in ${language}.
Current conditions: ${weatherData.current?.weather_info?.label || 'Unknown'}, 
Rainfall: ${weatherData.current?.precipitation || 0}mm, 
Wind: ${weatherData.current?.wind_speed_10m || 0}km/h,
Risk Level: ${weatherData.current?.risk_level || 'moderate'}.
Be concise, specific, and actionable. Do not use markdown.`;

    const narrative = await gemini.generateContent(prompt, '', { temperature: 0.7, maxOutputTokens: 200 });
    res.json({ narrative, risk_level: weatherData.current?.risk_level });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
