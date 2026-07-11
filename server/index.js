'use strict';

// Set DNS resolution order to default (verbatim). We previously forced ipv4first to workaround
// native fetch issues, but now that we use node-fetch, standard verbatim resolution is preferred
// to avoid DNS lookup failures on IPv6-only/NAT64 environments like Render.
// const dns = require('dns');
// if (dns.setDefaultResultOrder) {
//   dns.setDefaultResultOrder('ipv4first');
// }

/**
 * MonsoonGuard AI — Express server entry point.
 * Wires up all middleware, routes, and starts the HTTP server.
 */

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');

const aiRoutes        = require('./routes/ai');
const weatherRoutes   = require('./routes/weather');
const shelterRoutes   = require('./routes/shelters');
const checklistRoutes = require('./routes/checklist');
const reportsRoutes   = require('./routes/reports');
const { sanitizeBody }                = require('./middleware/sanitizer');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = parseInt(process.env.PORT) || 3000;

// ============================================================
// Security Middleware
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      fontSrc:     ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'unpkg.com'],
      connectSrc:  ["'self'"],
      workerSrc:   ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(cors({
  origin:      (origin, callback) => {
    if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ============================================================
// General Middleware
// ============================================================
app.use(compression());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(sanitizeBody);

// Request logging (simple)
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ============================================================
// Health check (before auth/rate limiting)
// ============================================================
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'MonsoonGuard AI',
    version: '1.0.0',
    uptime:  process.uptime(),
    env:     process.env.NODE_ENV || 'development',
    ai_configured: !!process.env.GEMINI_API_KEY,
  });
});

// ============================================================
// API Routes
// ============================================================
app.use('/api/ai',        aiRoutes);
app.use('/api/weather',   weatherRoutes);
app.use('/api/shelters',  shelterRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/reports',   reportsRoutes);

// ============================================================
// Static Files (Frontend SPA)
// ============================================================
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  etag:         true,
  lastModified: true,
  maxAge:       process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ============================================================
// Error Handling
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🌧️  MonsoonGuard AI — Server Started       ║
╠══════════════════════════════════════════════╣
║  URL:  http://localhost:${PORT}                  ║
║  Env:  ${(process.env.NODE_ENV || 'development').padEnd(20)}           ║
║  AI:   ${process.env.GEMINI_API_KEY ? '✅ Gemini configured' : '❌ No API key — set GEMINI_API_KEY'}  ║
╚══════════════════════════════════════════════╝
    `);

    // Run DB seed on first start if DB is empty
    try {
      const db = require('./services/database');
      const count = db.getDb().prepare('SELECT COUNT(*) as c FROM shelters').get();
      if (count.c === 0) {
        console.log('📦 Empty database detected — running seed...');
        require('./db/seed');
      }
    } catch (e) {
      console.warn('⚠️ Could not check database:', e.message);
    }
  });
}

module.exports = app; // Export for testing
