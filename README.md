# 🌧️ MonsoonGuard AI

> **GenAI-powered Monsoon Preparedness & Citizen Assistance Platform**
> Built for the Google Prompt Wars Hackathon Challenge

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%203.5%20Flash-blue)](https://aistudio.google.com)
[![Open-Meteo](https://img.shields.io/badge/Weather-Open--Meteo%20API-teal)](https://open-meteo.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📌 Problem Statement

Every monsoon season, millions of South/Southeast Asian citizens face:
- **No structured preparation** — generic alerts don't provide personalized, actionable guidance
- **Language barriers** — government advisories only available in English/Hindi
- **Vulnerable populations ignored** — elderly, disabled, families with infants have unique needs
- **Post-disaster helplessness** — no guidance on recovery, insurance claims, government schemes
- **Information fragmentation** — weather, shelters, advisories, emergency numbers all scattered

## 💡 Solution: MonsoonGuard AI

A complete, production-grade platform with **real AI** (no mocks), **real weather data** (no hardcoding), and **real community features** — built to actually help citizens survive and recover from monsoon disasters.

---

## ✨ Features

| Feature | Description | AI? |
|---|---|---|
| 🏠 **Dashboard** | Live weather + animated risk gauge + AI risk narrative | ✅ Gemini |
| 📋 **Preparedness Plan** | Personalized plan based on household profile | ✅ Gemini |
| ✅ **Smart Checklist** | AI-generated, category-filtered, progress-tracked | ✅ Gemini |
| 🤖 **AI Chat** | Streaming multilingual chat in 14 Indian languages | ✅ Gemini (streaming) |
| 🗺️ **Community Map** | Citizen incident reports on Leaflet.js map | — |
| 🏥 **Shelter Finder** | Nearest shelters with capacity & amenities | — |
| 🚗 **Travel Advisory** | AI route safety analysis with live weather | ✅ Gemini |
| 🔄 **Recovery Guide** | Post-disaster AI recovery + govt scheme reference | ✅ Gemini |
| 👤 **Profile** | Preferences that power all AI personalization | — |

---

## 🏗️ Architecture

```
Frontend (SPA)          Backend (Express)         External APIs
━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━
Vanilla JS/CSS/HTML  ←→  Node.js + Express    →   Google Gemini 3.5 Flash
Hash-based routing       Rate limiting            Open-Meteo Weather API
Streaming SSE client     Input sanitization       OpenStreetMap tiles
DOMPurify XSS guard      Helmet.js security
Service Worker (PWA)     SQLite (better-sqlite3)
Chart.js + Leaflet.js    Prepared statements
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- A free Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

### Installation

```bash
# Clone / navigate to project
cd monsoon-guard

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Seed the database (shelter data + sample reports)
npm run seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
NODE_ENV=production npm start
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **YES** | — | Google Gemini API key |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `RATE_LIMIT_MAX_REQUESTS` | No | `10` | AI requests per IP per window |
| `RATE_LIMIT_WINDOW_MINUTES` | No | `15` | Rate limit window in minutes |
| `DB_PATH` | No | `./server/db/monsoonguard.db` | SQLite database path |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` | Gemini model name |
| `GEMINI_MAX_TOKENS` | No | `2048` | Max output tokens per AI call |

**Note:** Open-Meteo is used for weather — no API key required!

---

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Watch mode
npm run test:watch
```

Tests cover:
- ✅ API route integration (health, weather, AI, reports, shelters)
- ✅ Input sanitization (XSS, prototype pollution)
- ✅ Validator schemas (report, profile, chat)
- ✅ Security (headers, oversized requests)

---

## 📁 Project Structure

```
monsoon-guard/
├── server/
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   ├── ai.js             # AI endpoints (plan, chat, checklist, travel, recovery)
│   │   ├── weather.js        # Open-Meteo proxy
│   │   ├── reports.js        # Community reports CRUD
│   │   ├── shelters.js       # Shelter data
│   │   └── checklist.js      # Checklist server sync
│   ├── middleware/
│   │   ├── rateLimiter.js    # Per-IP, per-endpoint rate limiting
│   │   ├── sanitizer.js      # XSS/injection protection
│   │   └── errorHandler.js   # Global error handling
│   ├── services/
│   │   ├── gemini.js         # Gemini API client (retry, streaming)
│   │   ├── weatherService.js # Open-Meteo client + risk calculation
│   │   └── database.js       # SQLite with prepared statements
│   ├── prompts/
│   │   ├── preparedness.js   # Plan generation prompts
│   │   ├── chat.js           # Multilingual chat prompts
│   │   └── travel.js         # Travel + checklist + recovery prompts
│   └── db/
│       ├── schema.sql        # Database schema
│       └── seed.js           # Initial data (16 shelters, sample reports)
├── public/
│   ├── index.html            # SPA shell
│   ├── css/                  # Design system + components + animations
│   ├── js/
│   │   ├── app.js            # SPA router, toast, rain animation
│   │   ├── api.js            # API client (SSE streaming)
│   │   ├── state.js          # Reactive state store
│   │   ├── pages/            # 9 page modules
│   │   └── utils/            # storage, sanitize, location, i18n
│   ├── sw.js                 # Service Worker (PWA)
│   └── manifest.json         # PWA manifest
├── tests/
│   ├── api.test.js           # Integration tests
│   └── sanitizer.test.js     # Security unit tests
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Security

| Threat | Mitigation |
|---|---|
| XSS | DOMPurify on all AI output; no innerHTML with user data |
| Prompt Injection | User input wrapped in `<user_input>` delimiters; injection keywords filtered |
| SQL Injection | 100% prepared statements via better-sqlite3 |
| CSRF | Same-origin CORS policy |
| Rate Abuse | 10 AI requests / IP / 15 min via SQLite-backed limiter |
| Secrets Exposure | API key server-side only; never sent to client |
| Clickjacking | `X-Frame-Options: DENY` via Helmet.js |
| Prototype Pollution | Keys `__proto__`, `constructor`, `prototype` stripped in sanitizer |

---

## 🌐 Supported Languages (AI Chat)

English · हिन्दी (Hindi) · বাংলা (Bengali) · தமிழ் (Tamil) · తెలుగు (Telugu) · मराठी (Marathi) · ગુજરાતી (Gujarati) · ಕನ್ನಡ (Kannada) · മലയാളം (Malayalam) · ଓଡ଼ିଆ (Odia) · ਪੰਜਾਬੀ (Punjabi) · اردو (Urdu) · অসমীয়া (Assamese) · नेपाली (Nepali)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + D` | Dashboard |
| `Alt + C` | AI Chat |
| `Alt + M` | Community Map |
| `Alt + K` | Checklist |
| `Alt + T` | Travel Advisory |
| `Alt + P` | Profile |

---

## 🔌 API Reference

### AI Endpoints

```
POST /api/ai/plan       # Personalized preparedness plan
POST /api/ai/chat       # Streaming multilingual chat (SSE)
POST /api/ai/checklist  # Smart emergency checklist (JSON)
POST /api/ai/travel     # Route safety advisory
POST /api/ai/recovery   # Post-disaster recovery guide
POST /api/ai/risk       # Brief risk narrative
GET  /api/ai/quick-actions?language=Hindi  # Quick prompts by language
```

### Weather

```
GET /api/weather?city=Mumbai    # Forecast by city name
GET /api/weather?lat=19&lon=72  # Forecast by coordinates
GET /api/weather/geocode?city=  # City → lat/lon lookup
```

### Community Data

```
GET  /api/reports                           # All recent reports
POST /api/reports                           # Submit report
PUT  /api/reports/:id/upvote               # Upvote report
GET  /api/shelters                          # All shelters
GET  /api/shelters?lat=19&lon=72           # Nearest shelters
GET  /api/checklist/:sessionId             # Get saved checklist
POST /api/checklist                         # Save checklist
PATCH /api/checklist/:sid/items/:iid       # Toggle item
```

---

## 🚀 Future Enhancements

- [ ] SMS/WhatsApp alerts for non-smartphone users via Twilio
- [ ] Offline-first with background sync for community reports
- [ ] District Collector admin dashboard with resource allocation AI
- [ ] Push notifications for severe weather (Web Push API)
- [ ] Voice interface for low-literacy users (Web Speech API)
- [ ] Integration with IMD (India Meteorological Department) live feeds
- [ ] Crowdsourced shelter verification with photo upload
- [ ] Farmer-specific crop advisory module
- [ ] Multi-district coordination for NGOs/govt

---

## 🏆 Evaluation Criteria Mapping

| Criteria | Implementation |
|---|---|
| **Code Quality** | SOLID principles, small focused modules, prepared statements, no giant files |
| **Problem Alignment** | All 7 challenge requirements implemented with real AI |
| **Security** | Helmet, DOMPurify, rate limiting, prepared statements, prompt injection protection |
| **Efficiency** | Parallel weather fetching, SSE streaming, debounced inputs, service worker caching |
| **Testing** | Integration + unit tests, AI mocked, coverage threshold enforced |
| **Accessibility** | ARIA labels, semantic HTML, keyboard navigation, focus indicators, reduced motion |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

*Built with ❤️ for India's citizens · Powered by Google Gemini AI*
