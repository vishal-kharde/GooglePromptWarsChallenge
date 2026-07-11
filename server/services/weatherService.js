'use strict';

/**
 * Weather service — proxies WeatherAPI.
 * Handles geocoding (city name → lat/lon) and forecast retrieval.
 */

require('dotenv').config();
 
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'b9e84736b2374d798c693623261107';
const WEATHER_API_BASE_URL = process.env.WEATHER_API_BASE_URL || 'https://api.weatherapi.com/v1';
const TIMEOUT_MS = 15000; // Increased to 15s to handle slower external API queries on Render

// Mapping of WeatherAPI condition codes to Open-Meteo's WMO weather codes.
// This allows reusing existing interpretWeatherCode and calculateRiskLevel functions.
const WEATHER_API_CODE_MAP = {
  1000: 0,   // Sunny / Clear
  1003: 2,   // Partly cloudy
  1006: 3,   // Cloudy
  1009: 3,   // Overcast
  1030: 45,  // Mist
  1135: 45,  // Fog
  1147: 48,  // Freezing fog
  1072: 51,  // Patchy freezing drizzle nearby
  1150: 51,  // Patchy light drizzle
  1153: 51,  // Light drizzle
  1168: 51,  // Freezing drizzle
  1171: 51,  // Heavy freezing drizzle
  1063: 51,  // Patchy rain nearby
  1180: 61,  // Patchy light rain
  1183: 61,  // Light rain
  1186: 63,  // Moderate rain at times
  1189: 63,  // Moderate rain
  1192: 65,  // Heavy rain at times
  1195: 65,  // Heavy rain
  1240: 80,  // Light rain shower
  1243: 81,  // Moderate or heavy rain shower
  1246: 82,  // Torrential rain shower
  1066: 71,  // Patchy snow nearby
  1114: 73,  // Blowing snow
  1117: 75,  // Blizzard
  1210: 71,  // Patchy light snow
  1213: 71,  // Light snow
  1216: 73,  // Patchy moderate snow
  1219: 73,  // Moderate snow
  1222: 75,  // Patchy heavy snow
  1225: 75,  // Heavy snow
  1255: 85,  // Light snow showers
  1258: 86,  // Moderate or heavy snow showers
  1069: 77,  // Patchy sleet nearby
  1204: 77,  // Light sleet
  1207: 77,  // Moderate or heavy sleet
  1249: 77,  // Light sleet showers
  1252: 77,  // Moderate or heavy sleet showers
  1237: 77,  // Ice pellets
  1261: 77,  // Light showers of ice pellets
  1264: 77,  // Moderate or heavy showers of ice pellets
  1087: 95,  // Thundery outbreaks possible
  1273: 95,  // Patchy light rain with thunder
  1276: 95,  // Moderate or heavy rain with thunder
  1279: 96,  // Patchy light snow with thunder
  1282: 99,  // Moderate or heavy snow with thunder
};
 
/**
 * Fetch with timeout wrapper.
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MonsoonGuard/1.0 (contact: vishalkharde02@gmail.com; Github: vishal-kharde/GooglePromptWarsChallenge)',
        'Accept': 'application/json'
      }
    });
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

  // Try WeatherAPI search first
  try {
    const url = `${WEATHER_API_BASE_URL}/search.json?key=${WEATHER_API_KEY}&q=${encoded}`;
    const data = await fetchWithTimeout(url);

    if (Array.isArray(data) && data.length > 0) {
      const r = data[0];
      return {
        lat:      r.lat,
        lon:      r.lon,
        name:     r.name,
        country:  r.country,
        timezone: 'auto',
      };
    }
  } catch (err) {
    console.warn(`[WeatherService] WeatherAPI Geocoding failed, trying Photon fallback: ${err.message}`);
  }

  // Fallback: Try Photon Komoot Geocoding API
  try {
    const fallbackUrl = `https://photon.komoot.io/api/?q=${encoded}&limit=1`;
    const data = await fetchWithTimeout(fallbackUrl);

    if (data && data.features && data.features.length > 0) {
      const f = data.features[0];
      const props = f.properties;
      const coords = f.geometry.coordinates; // Photon returns [lon, lat]
      return {
        lat:      coords[1],
        lon:      coords[0],
        name:     props.name || cityName,
        country:  props.country || 'Unknown',
        timezone: 'auto',
      };
    }
  } catch (err) {
    console.error(`[WeatherService] Photon fallback geocoding failed: ${err.message}`);
  }

  return null;
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
  const query = `${lat},${lon}`;
  const url = `${WEATHER_API_BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=7&aqi=no&alerts=no`;
  const raw = await fetchWithTimeout(url);
  return parseWeatherAPIResponse(raw);
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
 * Parses the raw WeatherAPI response into a clean object structured like Open-Meteo.
 * @param {object} raw
 * @returns {object}
 */
function parseWeatherAPIResponse(raw) {
  if (!raw || !raw.current || !raw.forecast || !raw.forecast.forecastday) {
    throw new Error('Invalid response structure from WeatherAPI');
  }

  const currentVal = raw.current;
  const locationVal = raw.location;
  const forecastdays = raw.forecast.forecastday;
  const firstDay = forecastdays[0];
  const hours = firstDay ? (firstDay.hour || []) : [];

  const currentWmoCode = WEATHER_API_CODE_MAP[currentVal.condition?.code] || 0;
  const weatherInfo = interpretWeatherCode(currentWmoCode);

  const currentMapped = {
    temperature_2m: currentVal.temp_c,
    relative_humidity_2m: currentVal.humidity,
    apparent_temperature: currentVal.feelslike_c,
    weather_code: currentWmoCode,
    wind_speed_10m: currentVal.wind_kph,
    wind_direction_10m: currentVal.wind_degree,
    precipitation: currentVal.precip_mm,
    cloud_cover: currentVal.cloud,
    visibility: (currentVal.vis_km || 0) * 1000,
    surface_pressure: currentVal.pressure_mb,
  };

  const riskLevel = calculateRiskLevel(currentMapped);

  const daily = {
    time: forecastdays.map(f => f.date),
    weather_code: forecastdays.map(f => WEATHER_API_CODE_MAP[f.day?.condition?.code] || 0),
    temperature_2m_max: forecastdays.map(f => f.day?.maxtemp_c),
    temperature_2m_min: forecastdays.map(f => f.day?.mintemp_c),
    precipitation_sum: forecastdays.map(f => f.day?.totalprecip_mm),
    precipitation_probability_max: forecastdays.map(f => f.day?.daily_chance_of_rain || f.day?.daily_chance_of_snow || 0),
    wind_speed_10m_max: forecastdays.map(f => f.day?.maxwind_kph),
    sunrise: forecastdays.map(f => f.astro?.sunrise),
    sunset: forecastdays.map(f => f.astro?.sunset),
  };

  const hourly = {
    time: hours.map(h => h.time),
    temperature_2m: hours.map(h => h.temp_c),
    precipitation: hours.map(h => h.precip_mm),
    precipitation_probability: hours.map(h => h.chance_of_rain || h.chance_of_snow || 0),
    wind_speed_10m: hours.map(h => h.wind_kph),
    weather_code: hours.map(h => WEATHER_API_CODE_MAP[h.condition?.code] || 0),
    visibility: hours.map(h => (h.vis_km || 0) * 1000),
    relative_humidity_2m: hours.map(h => h.humidity),
  };

  return {
    location: {
      lat: locationVal.lat,
      lon: locationVal.lon,
      timezone: locationVal.tz_id || 'auto',
    },
    current: {
      ...currentMapped,
      weather_info: weatherInfo,
      risk_level: riskLevel,
    },
    hourly,
    daily,
    units: {
      temperature_2m: '°C',
      precipitation: 'mm',
      wind_speed_10m: 'km/h',
    },
  };
}

module.exports = { geocodeCity, getForecast, interpretWeatherCode, calculateRiskLevel };

