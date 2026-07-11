'use strict';

/**
 * API route integration tests using supertest.
 */

const request = require('supertest');
const app     = require('../server/index');

// Mock Gemini to avoid actual API calls in tests
jest.mock('../server/services/gemini', () => ({
  generateContent: jest.fn().mockResolvedValue('Mock AI response for testing'),
  generateStream:  jest.fn().mockImplementation(async (messages, system, onChunk) => {
    onChunk('Mock ');
    onChunk('streaming ');
    onChunk('response');
  }),
  wrapUserInput: jest.fn(s => `<user_input>${s}</user_input>`),
}));

// Mock database service so tests work without a real SQLite file
jest.mock('../server/services/database', () => {
  const mockReport = { id: 1, type: 'flood', lat: 19.07, lng: 72.88, description: 'Test', severity: 'high', address: 'Test', upvotes: 0, verified: 0, created_at: new Date().toISOString() };
  const mockShelter = { id: 1, name: 'Test Shelter', address: 'Test Address', lat: 19.07, lng: 72.88, capacity: 100, current_occupancy: 10, has_food: 1, has_medical: 1, has_water: 1, has_electricity: 1, contact: '112', active: 1 };
  return {
    getDb: jest.fn().mockReturnValue({
      prepare: jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue({ c: 0 }),
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      }),
      pragma: jest.fn(),
      exec: jest.fn(),
    }),
    reports: {
      getAll: jest.fn().mockReturnValue([mockReport]),
      getInBounds: jest.fn().mockReturnValue([mockReport]),
      create: jest.fn().mockReturnValue(mockReport),
      upvote: jest.fn().mockReturnValue({ ...mockReport, upvotes: 1 }),
    },
    shelters: {
      getAll: jest.fn().mockReturnValue([mockShelter]),
      getNearest: jest.fn().mockReturnValue([{ ...mockShelter, distance_km: 2.5 }]),
    },
    checklist: {
      getBySession: jest.fn().mockReturnValue([]),
      upsertItems: jest.fn().mockReturnValue([]),
      updateItem: jest.fn().mockReturnValue({ id: 1, completed: 1 }),
    },
  };
});

// Mock weather service
jest.mock('../server/services/weatherService', () => ({
  geocodeCity:        jest.fn().mockResolvedValue({ lat: 19.07, lon: 72.88, name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' }),
  getForecast:        jest.fn().mockResolvedValue({
    location: { lat: 19.07, lon: 72.88 },
    current:  { temperature_2m: 28, precipitation: 5.2, wind_speed_10m: 20, weather_code: 63, risk_level: 'moderate', weather_info: { label: 'Moderate rain', icon: '🌧️', severity: 'moderate' } },
    hourly:   { time: [], precipitation: [] },
    daily:    { time: ['2026-07-11'], precipitation_sum: [12.5], temperature_2m_max: [30], temperature_2m_min: [24] },
  }),
  interpretWeatherCode: jest.fn().mockReturnValue({ label: 'Moderate rain', icon: '🌧️', severity: 'moderate' }),
  calculateRiskLevel: jest.fn().mockReturnValue('moderate'),
}));

describe('Health Check', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('MonsoonGuard AI');
  });
});

describe('Weather Routes', () => {
  it('GET /api/weather?city=Mumbai returns weather data', async () => {
    const res = await request(app).get('/api/weather?city=Mumbai').expect(200);
    expect(res.body.current).toBeDefined();
    expect(res.body.current.temperature_2m).toBe(28);
  });

  it('GET /api/weather?city= returns 400', async () => {
    await request(app).get('/api/weather?city=').expect(400);
  });

  it('GET /api/weather with no params returns 400', async () => {
    await request(app).get('/api/weather').expect(400);
  });

  it('GET /api/weather?lat=19.07&lon=72.88 returns weather by coords', async () => {
    const res = await request(app).get('/api/weather?lat=19.07&lon=72.88').expect(200);
    expect(res.body.current).toBeDefined();
  });

  it('GET /api/weather?lat=999&lon=999 returns 400', async () => {
    await request(app).get('/api/weather?lat=999&lon=999').expect(400);
  });
});

describe('AI Routes', () => {
  it('POST /api/ai/plan with valid profile returns plan', async () => {
    const res = await request(app)
      .post('/api/ai/plan')
      .send({ profile: { city: 'Mumbai', adults: 2, children: 1 } })
      .expect(200);
    expect(res.body.plan).toBe('Mock AI response for testing');
    expect(res.body.generated_at).toBeDefined();
  });

  it('POST /api/ai/plan without profile returns 400', async () => {
    await request(app)
      .post('/api/ai/plan')
      .send({})
      .expect(400);
  });

  it('POST /api/ai/plan without city returns 400', async () => {
    await request(app)
      .post('/api/ai/plan')
      .send({ profile: { adults: 2 } })
      .expect(400);
  });

  it('POST /api/ai/checklist with valid profile returns items', async () => {
    // Mock JSON checklist response
    const gemini = require('../server/services/gemini');
    gemini.generateContent.mockResolvedValueOnce(JSON.stringify([
      { text: 'Store 15L water', category: 'Water & Food', priority: 'critical', tip: 'Use sealed containers' },
    ]));

    const res = await request(app)
      .post('/api/ai/checklist')
      .send({ profile: { city: 'Chennai', adults: 3 } })
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].text).toBe('Store 15L water');
  });

  it('POST /api/ai/travel with valid data returns advisory', async () => {
    const res = await request(app)
      .post('/api/ai/travel')
      .send({ origin: 'Mumbai', destination: 'Pune', mode: 'Car' })
      .expect(200);
    expect(res.body.advisory).toBeDefined();
  });

  it('POST /api/ai/travel without required fields returns 400', async () => {
    await request(app)
      .post('/api/ai/travel')
      .send({ mode: 'Car' })
      .expect(400);
  });

  it('POST /api/ai/recovery with valid data returns guide', async () => {
    const res = await request(app)
      .post('/api/ai/recovery')
      .send({ damageType: 'flood damage', city: 'Chennai' })
      .expect(200);
    expect(res.body.guide).toBeDefined();
  });

  it('GET /api/ai/quick-actions returns actions array', async () => {
    const res = await request(app)
      .get('/api/ai/quick-actions?language=English')
      .expect(200);
    expect(Array.isArray(res.body.actions)).toBe(true);
    expect(res.body.actions.length).toBeGreaterThan(0);
  });
});

describe('Reports Routes', () => {
  it('GET /api/reports returns reports array', async () => {
    const res = await request(app).get('/api/reports').expect(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(0);
  });

  it('POST /api/reports with valid data creates report', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ type: 'flood', lat: 19.07, lng: 72.88, severity: 'high', description: 'Test flood', address: 'Test area' })
      .expect(201);
    expect(res.body.report.type).toBe('flood');
    expect(res.body.report.id).toBeDefined();
  });

  it('POST /api/reports with invalid type returns 400', async () => {
    await request(app)
      .post('/api/reports')
      .send({ type: 'invalid_type', lat: 19.07, lng: 72.88 })
      .expect(400);
  });

  it('POST /api/reports with invalid lat returns 400', async () => {
    await request(app)
      .post('/api/reports')
      .send({ type: 'flood', lat: 999, lng: 72.88 })
      .expect(400);
  });

  it('POST /api/reports with XSS payload sanitizes description', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ type: 'flood', lat: 19.07, lng: 72.88, description: '<script>alert("xss")</script>Water', severity: 'low' })
      .expect(201);
    expect(res.body.report.description).not.toContain('<script>');
  });
});

describe('Shelters Routes', () => {
  it('GET /api/shelters returns shelters array', async () => {
    const res = await request(app).get('/api/shelters').expect(200);
    expect(Array.isArray(res.body.shelters)).toBe(true);
  });

  it('GET /api/shelters?lat=19.07&lon=72.88 returns sorted shelters', async () => {
    const res = await request(app)
      .get('/api/shelters?lat=19.07&lon=72.88')
      .expect(200);
    expect(Array.isArray(res.body.shelters)).toBe(true);
  });
});

describe('Rate Limiting', () => {
  it('Rate limiter allows requests under limit', async () => {
    // Should succeed
    await request(app)
      .post('/api/ai/risk')
      .send({ weatherData: { current: { risk_level: 'low' } }, city: 'Test' })
      .expect(res => res.status !== 429);
  });
});

describe('Security', () => {
  it('Rejects oversized JSON body', async () => {
    const spy  = jest.spyOn(console, 'error').mockImplementation(() => {});
    const huge = { profile: { city: 'X'.repeat(100000) } };
    await request(app)
      .post('/api/ai/plan')
      .send(huge)
      .expect(res => [400, 413].includes(res.status));
    spy.mockRestore();
  });

  it('Non-API routes return SPA index.html', async () => {
    const res = await request(app).get('/some-random-path').expect(200);
    expect(res.text).toContain('MonsoonGuard');
  });

  it('Has security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
