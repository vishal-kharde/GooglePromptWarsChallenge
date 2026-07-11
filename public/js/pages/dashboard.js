/**
 * Dashboard page — weather widget, risk gauge, AI narrative, recent alerts.
 */

import { api } from '../api.js';
import { state, setState, setWeather } from '../state.js';
import { markdownToSafeHtml, escapeText } from '../utils/sanitize.js';
import { getCurrentPosition, reverseGeocode } from '../utils/location.js';

let _weatherChart = null;
let _rainCanvas = null;

export function renderDashboard() {
  const profile = state.profile;

  document.getElementById('page-title').textContent = 'Dashboard';
  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>🌧️ Monsoon Dashboard</h1>
      <p>Real-time conditions and personalized risk assessment for ${escapeText(profile.city)}</p>
    </div>

    <!-- Weather Search -->
    <div class="card card-sm" style="margin-bottom:1.5rem">
      <div style="display:flex;gap:0.75rem;align-items:center">
        <input
          type="text"
          id="city-search"
          class="form-input"
          style="flex:1;margin:0"
          placeholder="Search city (e.g., Mumbai, Chennai, Dhaka...)"
          value="${escapeText(profile.city)}"
          aria-label="Search city"
        />
        <button class="btn btn-primary btn-sm" id="city-search-btn" aria-label="Search">
          🔍 Search
        </button>
        <button class="btn btn-ghost btn-sm" id="location-btn" aria-label="Use my location" title="Use my location">
          📍
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid-4 card-animate" style="margin-bottom:1.5rem" id="stats-row">
      <div class="stat-card">
        <div class="stat-label">🌡️ Temperature</div>
        <div class="stat-value" id="stat-temp"><div class="skeleton" style="height:2rem;width:80px"></div></div>
        <div class="stat-change" id="stat-feels">Feels like —</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🌧️ Rainfall</div>
        <div class="stat-value" id="stat-rain"><div class="skeleton" style="height:2rem;width:80px"></div></div>
        <div class="stat-change" id="stat-rain-prob">Probability —</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💨 Wind Speed</div>
        <div class="stat-value" id="stat-wind"><div class="skeleton" style="height:2rem;width:80px"></div></div>
        <div class="stat-change" id="stat-humidity">Humidity —</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">👁️ Visibility</div>
        <div class="stat-value" id="stat-vis"><div class="skeleton" style="height:2rem;width:80px"></div></div>
        <div class="stat-change" id="stat-pressure">Pressure —</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid-2" style="margin-bottom:1.5rem">

      <!-- Risk Gauge Card -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">⚠️</span> Monsoon Risk Level</div>
          <span class="badge badge-moderate" id="risk-badge">Assessing...</span>
        </div>
        <div class="risk-gauge-wrapper">
          <svg width="200" height="120" viewBox="0 0 200 120" aria-label="Risk gauge">
            <!-- Track -->
            <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" stroke-linecap="round"/>
            <!-- Fill -->
            <path id="gauge-fill" d="M 20 110 A 80 80 0 0 1 180 110" fill="none"
                  stroke="var(--risk-moderate)" stroke-width="16" stroke-linecap="round"
                  stroke-dasharray="251" stroke-dashoffset="125"
                  style="transition:stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1),stroke 0.5s ease"/>
            <!-- Center text -->
            <text x="100" y="95" text-anchor="middle" fill="var(--text-primary)" font-size="28" font-weight="700" font-family="Space Grotesk, Inter, sans-serif" id="gauge-text">—</text>
            <!-- Labels -->
            <text x="18" y="118" fill="var(--text-muted)" font-size="9">LOW</text>
            <text x="156" y="118" fill="var(--text-muted)" font-size="9">EXTREME</text>
          </svg>
          <div class="gauge-label" id="gauge-label">Loading...</div>
          <div class="gauge-sublabel" id="gauge-condition">Fetching weather data...</div>
        </div>
      </div>

      <!-- AI Risk Narrative -->
      <div class="card card-animate" id="ai-narrative-card">
        <div class="card-header">
          <div class="card-title"><span class="icon">🤖</span> AI Risk Analysis</div>
          <div class="spinner" id="narrative-spinner" aria-label="Loading AI analysis"></div>
        </div>
        <div id="ai-narrative" class="markdown-content">
          <div class="skeleton" style="height:1rem;margin-bottom:8px"></div>
          <div class="skeleton" style="height:1rem;margin-bottom:8px;width:90%"></div>
          <div class="skeleton" style="height:1rem;width:75%"></div>
        </div>
        <div style="margin-top:1rem;font-size:0.75rem;color:var(--text-muted)" id="narrative-time"></div>
      </div>
    </div>

    <!-- 7-Day Forecast Chart -->
    <div class="card card-animate" style="margin-bottom:1.5rem">
      <div class="card-header">
        <div class="card-title"><span class="icon">📅</span> 7-Day Rainfall Forecast</div>
        <span style="font-size:0.75rem;color:var(--text-muted)">Source: Open-Meteo</span>
      </div>
      <div class="chart-container" style="height:200px">
        <canvas id="forecast-chart" aria-label="7-day rainfall forecast chart"></canvas>
      </div>
    </div>

    <!-- Bottom Row: Quick Actions + Recent Alerts -->
    <div class="grid-2">
      <!-- Quick Actions -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">⚡</span> Quick Actions</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem">
          <button class="btn btn-secondary" style="justify-content:flex-start;gap:0.75rem" onclick="window._navigate('plan')" id="qa-plan">
            📋 Generate My Preparedness Plan
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start;gap:0.75rem" onclick="window._navigate('checklist')" id="qa-checklist">
            ✅ View My Emergency Checklist
          </button>
          <button class="btn btn-secondary" style="justify-content:flex-start;gap:0.75rem" onclick="window._navigate('chat')" id="qa-chat">
            🤖 Ask AI Assistant
          </button>
          <button class="btn btn-danger btn-sm" style="justify-content:flex-start;gap:0.75rem" onclick="window.open('tel:112')" id="qa-emergency">
            🚨 Call Emergency: 112
          </button>
        </div>
      </div>

      <!-- Recent Community Alerts -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">📢</span> Recent Community Reports</div>
          <button class="btn btn-ghost btn-sm" onclick="window._navigate('map')">View All →</button>
        </div>
        <div id="recent-reports">
          <div class="skeleton" style="height:3rem;margin-bottom:8px;border-radius:8px"></div>
          <div class="skeleton" style="height:3rem;margin-bottom:8px;border-radius:8px"></div>
          <div class="skeleton" style="height:3rem;border-radius:8px"></div>
        </div>
      </div>
    </div>
  `;

  // Bind city search
  document.getElementById('city-search-btn').addEventListener('click', () => {
    const city = document.getElementById('city-search').value.trim();
    if (city) loadWeather(city);
  });

  document.getElementById('city-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const city = document.getElementById('city-search').value.trim();
      if (city) loadWeather(city);
    }
  });

  document.getElementById('location-btn').addEventListener('click', async () => {
    const btn = document.getElementById('location-btn');
    btn.textContent = '⏳';
    btn.disabled = true;
    try {
      const pos = await getCurrentPosition();
      await loadWeatherByCoords(pos.lat, pos.lon);
    } catch (e) {
      showToast('error', 'Location Error', e.message);
    } finally {
      btn.textContent = '📍';
      btn.disabled = false;
    }
  });

  // Load initial data
  loadWeather(profile.city);
  loadRecentReports();
}

async function loadWeather(city) {
  try {
    setState('weatherLoading', true);
    const data = await api.weather.byCity(city);
    setWeather(data, city);
    updateWeatherUI(data, city);
    updateTopbar(data, city);

    // Load AI narrative
    loadAINarrative(data, city);

    // Load forecast chart
    renderForecastChart(data);
  } catch (err) {
    showToast('error', 'Weather Error', err.message);
    document.getElementById('gauge-label').textContent = 'Unable to load weather';
  } finally {
    setState('weatherLoading', false);
  }
}

async function loadWeatherByCoords(lat, lon) {
  try {
    // Fetch weather and reverse-geocode in parallel
    const [data, placeName] = await Promise.all([
      api.weather.byCoords(lat, lon),
      reverseGeocode(lat, lon),
    ]);
    // Prefer reverse-geocoded place name; data.city is null for coord-based lookups
    const city = placeName || data.city || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    setWeather(data, city);
    updateWeatherUI(data, city);
    updateTopbar(data, city);
    loadAINarrative(data, city);
    renderForecastChart(data);
    document.getElementById('city-search').value = city;
  } catch (err) {
    showToast('error', 'Weather Error', err.message);
  }
}

function updateWeatherUI(data, city) {
  const c = data.current || {};
  const info = c.weather_info || {};
  const daily = data.daily || {};

  // Stats
  const tempEl = document.getElementById('stat-temp');
  if (tempEl) {
    tempEl.innerHTML = `${Math.round(c.temperature_2m || 0)}<span class="stat-unit">°C</span>`;
    document.getElementById('stat-feels').textContent = `Feels like ${Math.round(c.apparent_temperature || 0)}°C`;
  }

  const rainEl = document.getElementById('stat-rain');
  if (rainEl) {
    rainEl.innerHTML = `${(c.precipitation || 0).toFixed(1)}<span class="stat-unit">mm</span>`;
    const prob = daily.precipitation_probability_max?.[0];
    document.getElementById('stat-rain-prob').textContent = `Probability ${prob !== undefined ? prob + '%' : '—'}`;
  }

  const windEl = document.getElementById('stat-wind');
  if (windEl) {
    windEl.innerHTML = `${Math.round(c.wind_speed_10m || 0)}<span class="stat-unit">km/h</span>`;
    document.getElementById('stat-humidity').textContent = `Humidity ${c.relative_humidity_2m || '—'}%`;
  }

  const visEl = document.getElementById('stat-vis');
  if (visEl) {
    visEl.innerHTML = `${Math.round((c.visibility || 0) / 1000)}<span class="stat-unit">km</span>`;
    document.getElementById('stat-pressure').textContent = `Pressure ${Math.round(c.surface_pressure || 0)} hPa`;
  }

  // Risk gauge
  const risk = c.risk_level || 'moderate';
  updateRiskGauge(risk, info.label, city);
}

function updateRiskGauge(risk, conditionLabel, city) {
  const RISK_CONFIG = {
    low:      { color: 'var(--risk-low)',      dashOffset: 200, label: 'LOW',      pct: '20%', badgeClass: 'badge-low' },
    moderate: { color: 'var(--risk-moderate)', dashOffset: 145, label: 'MODERATE', pct: '45%', badgeClass: 'badge-moderate' },
    high:     { color: 'var(--risk-high)',      dashOffset: 80,  label: 'HIGH',     pct: '70%', badgeClass: 'badge-high' },
    extreme:  { color: 'var(--risk-extreme)',   dashOffset: 10,  label: 'EXTREME',  pct: '95%', badgeClass: 'badge-extreme' },
  };

  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.moderate;
  const fill = document.getElementById('gauge-fill');
  const badge = document.getElementById('risk-badge');

  if (fill) {
    fill.setAttribute('stroke', cfg.color);
    fill.setAttribute('stroke-dashoffset', cfg.dashOffset);
    document.getElementById('gauge-text').textContent = cfg.pct;
  }

  if (badge) {
    badge.textContent = cfg.label;
    badge.className = `badge ${cfg.badgeClass}`;
  }

  const label = document.getElementById('gauge-label');
  if (label) label.textContent = `${cfg.label} Risk in ${city}`;

  const cond = document.getElementById('gauge-condition');
  if (cond) cond.textContent = conditionLabel || 'Conditions unknown';

  // Update global risk indicator in topbar
  const dot = document.getElementById('risk-dot');
  const riskLabel = document.getElementById('risk-label');
  if (dot) dot.className = `risk-dot ${risk}`;
  if (riskLabel) riskLabel.textContent = cfg.label;
}

function updateTopbar(data, city) {
  const c = data.current || {};
  const info = c.weather_info || {};
  document.getElementById('topbar-weather-icon').textContent = info.icon || '🌡️';
  document.getElementById('topbar-weather-text').textContent =
    `${escapeText(city)} · ${Math.round(c.temperature_2m || 0)}°C · ${info.label || 'Unknown'}`;
}

async function loadAINarrative(weatherData, city) {
  const spinner = document.getElementById('narrative-spinner');
  const narrativeEl = document.getElementById('ai-narrative');
  if (!narrativeEl) return;

  try {
    if (spinner) spinner.style.display = 'block';
    const { narrative } = await api.ai.risk(weatherData, city, state.profile.language);

    if (narrativeEl) {
      narrativeEl.textContent = narrative; // Plain text — no HTML injection
      narrativeEl.style.color = 'var(--text-secondary)';
    }

    const timeEl = document.getElementById('narrative-time');
    if (timeEl) timeEl.textContent = `Generated at ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (narrativeEl) {
      narrativeEl.textContent = 'AI analysis unavailable. Check weather conditions manually.';
    }
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function renderForecastChart(data) {
  const canvas = document.getElementById('forecast-chart');
  if (!canvas || !window.Chart) return;
  if (!data.daily) return;

  if (_weatherChart) { _weatherChart.destroy(); _weatherChart = null; }

  const labels = (data.daily.time || []).map(d => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  });

  _weatherChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Rainfall (mm)',
          data:  data.daily.precipitation_sum || [],
          backgroundColor: 'rgba(0, 200, 240, 0.3)',
          borderColor:     'rgba(0, 200, 240, 0.8)',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Max Temp (°C)',
          data:  data.daily.temperature_2m_max || [],
          type:  'line',
          borderColor:  'rgba(245, 158, 11, 0.8)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(245, 158, 11, 1)',
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter, sans-serif', size: 11 } },
        },
        tooltip: {
          backgroundColor: 'rgba(13, 22, 38, 0.95)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          type: 'linear', position: 'left',
          ticks: { color: '#00c8f0', font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'mm', color: '#64748b', font: { size: 10 } },
        },
        y1: {
          type: 'linear', position: 'right',
          ticks: { color: '#f59e0b', font: { size: 10 } },
          grid:  { drawOnChartArea: false },
          title: { display: true, text: '°C', color: '#64748b', font: { size: 10 } },
        },
      },
    },
  });
}

async function loadRecentReports() {
  const el = document.getElementById('recent-reports');
  if (!el) return;

  try {
    const { reports } = await api.reports.getAll();
    const recent = reports.slice(0, 5);

    if (recent.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:1rem"><p>No reports in your area. Community is safe 🙂</p></div>';
      return;
    }

    const TYPE_ICONS = {
      flood: '🌊', road_blocked: '🚧', power_outage: '⚡',
      tree_fallen: '🌳', rescue_needed: '🆘', landslide: '⛰️',
      waterlogging: '💧', damage: '🏚️', other: '📍',
    };

    el.innerHTML = recent.map(r => `
      <div class="checklist-item" style="margin-bottom:0.5rem;cursor:default;opacity:1" role="listitem">
        <span style="font-size:1.25rem">${TYPE_ICONS[r.type] || '📍'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary)">${escapeText(r.address || r.type.replace(/_/g,' '))}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${escapeText(r.description.slice(0, 60))}${r.description.length > 60 ? '…' : ''}</div>
        </div>
        <span class="badge badge-${r.severity}">${escapeText(r.severity)}</span>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">Could not load reports.</p>';
  }
}

// Global helper referenced by onclick
window.showToast = window.showToast || function(type, title, msg) {
  console.log(type, title, msg);
};
