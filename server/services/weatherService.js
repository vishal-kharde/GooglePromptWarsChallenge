'use strict';

/**
 * Weather service — proxies Open-Meteo API (free, no API key required).
 * Handles geocoding (city name → lat/lon) and forecast retrieval.
 */

require('dotenv').config();
 
const BASE_URL   = process.env.OPEN_METEO_BASE_URL  || 'https://api.open-meteo.com/v1';
const GEO_URL    = process.env.OPEN_METEO_GEO_URL   || 'https://geocoding-api.open-meteo.com/v1';
const TIMEOUT_MS = 15000; // Increased to 15s to handle slower external API queries on Render
 
/**
 * Fetch with timeout wrapper.
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`[WeatherService] Fetch failure for URL: ${url}`);
    console.error(`[WeatherService] Error message: ${err.message}`);
    if (err.stack) console.error(`[WeatherService] Error stack:`, err.stack);
    if (err.cause) console.error(`[WeatherService] Error cause:`, err.cause);
 
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a city name to { lat, lon, name, country, timezone }.
 * Returns null if not found.
 *
 * @param {string} cityName
 * @returns {Promise<{lat: number, lon: number, name: string, country: string, timezone: string} | null>}
 */
async function geocodeCity(cityName) {
  const encoded = encodeURIComponent(cityName.trim());
  const url = `${GEO_URL}/search?name=${encoded}&count=1&language=en&format=json`;
  const data = await fetchWithTimeout(url);

  if (!data.results || data.results.length === 0) return null;

  const r = data.results[0];
  return {
    lat:      r.latitude,
    lon:      r.longitude,
    name:     r.name,
    country:  r.country,
    timezone: r.timezone,
  };
}

/**
 * Fetches comprehensive weather forecast for given coordinates.
 * Includes hourly and daily data with rainfall, wind, temperature.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} [timezone='auto']
 * @returns {Promise<object>} Parsed weather object
 */
async function getForecast(lat, lon, timezone = 'auto') {
  const params = new URLSearchParams({
    latitude:   lat,
    longitude:  lon,
    timezone:   timezone,
    current:    [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'weather_code', 'wind_speed_10m', 'wind_direction_10m',
      'precipitation', 'cloud_cover', 'visibility', 'surface_pressure',
    ].join(','),
    hourly: [
      'temperature_2m', 'precipitation', 'precipitation_probability',
      'wind_speed_10m', 'weather_code', 'visibility', 'relative_humidity_2m',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_sum', 'precipitation_probability_max',
      'wind_speed_10m_max', 'sunrise', 'sunset',
    ].join(','),
    forecast_days:  7,
    hourly_time_limit: 24,
  });

  const url = `${BASE_URL}/forecast?${params.toString()}`;
  const raw = await fetchWithTimeout(url);
  return parseWeatherResponse(raw);
}

/**
 * Interprets WMO weather code into a human-readable label.
 * @param {number} code
 * @returns {{ label: string, icon: string, severity: 'clear'|'light'|'moderate'|'heavy'|'storm' }}
 */
function interpretWeatherCode(code) {
  const MAP = {
    0:  { label: 'Clear sky',             icon: '☀️',  severity: 'clear'    },
    1:  { label: 'Mainly clear',          icon: '🌤️', severity: 'clear'    },
    2:  { label: 'Partly cloudy',         icon: '⛅',  severity: 'clear'    },
    3:  { label: 'Overcast',              icon: '☁️',  severity: 'light'    },
    45: { label: 'Foggy',                 icon: '🌫️', severity: 'light'    },
    48: { label: 'Icy fog',               icon: '🌫️', severity: 'moderate' },
    51: { label: 'Light drizzle',         icon: '🌦️', severity: 'light'    },
    53: { label: 'Moderate drizzle',      icon: '🌦️', severity: 'moderate' },
    55: { label: 'Dense drizzle',         icon: '🌧️', severity: 'moderate' },
    61: { label: 'Slight rain',           icon: '🌧️', severity: 'light'    },
    63: { label: 'Moderate rain',         icon: '🌧️', severity: 'moderate' },
    65: { label: 'Heavy rain',            icon: '🌧️', severity: 'heavy'    },
    71: { label: 'Slight snowfall',       icon: '🌨️', severity: 'light'    },
    73: { label: 'Moderate snowfall',     icon: '🌨️', severity: 'moderate' },
    75: { label: 'Heavy snowfall',        icon: '❄️',  severity: 'heavy'    },
    77: { label: 'Snow grains',           icon: '❄️',  severity: 'light'    },
    80: { label: 'Slight showers',        icon: '🌦️', severity: 'light'    },
    81: { label: 'Moderate showers',      icon: '🌧️', severity: 'moderate' },
    82: { label: 'Violent showers',       icon: '⛈️',  severity: 'heavy'    },
    85: { label: 'Slight snow showers',   icon: '🌨️', severity: 'light'    },
    86: { label: 'Heavy snow showers',    icon: '🌨️', severity: 'heavy'    },
    95: { label: 'Thunderstorm',          icon: '⛈️',  severity: 'storm'    },
    96: { label: 'Thunderstorm w/ hail',  icon: '⛈️',  severity: 'storm'    },
    99: { label: 'Thunderstorm + heavy hail', icon: '⛈️', severity: 'storm' },
  };
  return MAP[code] || { label: 'Unknown', icon: '❓', severity: 'clear' };
}

/**
 * Calculates monsoon risk level from weather data.
 * @returns {'low'|'moderate'|'high'|'extreme'}
 */
function calculateRiskLevel(current) {
  const rain   = current.precipitation || 0;
  const wind   = current.wind_speed_10m || 0;
  const code   = current.weather_code || 0;
  const humid  = current.relative_humidity_2m || 0;

  let score = 0;
  if (rain > 20)   score += 3;
  else if (rain > 10) score += 2;
  else if (rain > 2)  score += 1;

  if (wind > 60)   score += 3;
  else if (wind > 40) score += 2;
  else if (wind > 25) score += 1;

  if ([95, 96, 99].includes(code)) score += 3;
  else if ([82].includes(code))    score += 2;
  else if ([65, 81].includes(code)) score += 1;

  if (humid > 90) score += 1;

  if (score >= 6)  return 'extreme';
  if (score >= 4)  return 'high';
  if (score >= 2)  return 'moderate';
  return 'low';
}

/**
 * Parses the raw Open-Meteo response into a clean object.
 * @param {object} raw
 * @returns {object}
 */
function parseWeatherResponse(raw) {
  const currentCode = raw.current?.weather_code;
  const weatherInfo = interpretWeatherCode(currentCode);
  const riskLevel   = calculateRiskLevel(raw.current || {});

  return {
    location: { lat: raw.latitude, lon: raw.longitude, timezone: raw.timezone },
    current: {
      ...raw.current,
      weather_info: weatherInfo,
      risk_level: riskLevel,
    },
    hourly: raw.hourly,
    daily:  raw.daily,
    units:  raw.current_units,
  };
}

module.exports = { geocodeCity, getForecast, interpretWeatherCode, calculateRiskLevel };
