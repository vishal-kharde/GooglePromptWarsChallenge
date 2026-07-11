/**
 * Travel Advisory page — AI analyzes route safety with live weather.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { markdownToSafeHtml, escapeText } from '../utils/sanitize.js';

export function renderTravel() {
  document.getElementById('page-title').textContent = 'Travel Advisory';

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>🚗 Travel Safety Advisory</h1>
      <p>AI analyzes weather conditions along your route and gives a safety recommendation.</p>
    </div>

    <div class="grid-2">
      <!-- Form -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">🗺️</span> Journey Details</div>
        </div>
        <form id="travel-form" novalidate>
          <div class="form-group">
            <label class="form-label required" for="travel-origin">Origin City</label>
            <input type="text" id="travel-origin" class="form-input" required
                   placeholder="e.g. Mumbai" value="${escapeText(state.profile.city)}" />
          </div>
          <div class="form-group">
            <label class="form-label required" for="travel-dest">Destination City</label>
            <input type="text" id="travel-dest" class="form-input" required placeholder="e.g. Pune" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="travel-date">Travel Date & Time</label>
              <input type="datetime-local" id="travel-date" class="form-input"
                     value="${new Date().toISOString().slice(0,16)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="travel-mode">Mode of Transport</label>
              <select id="travel-mode" class="form-select">
                <option value="Car">🚗 Car</option>
                <option value="Motorcycle">🏍️ Motorcycle</option>
                <option value="Bus">🚌 Bus</option>
                <option value="Train">🚆 Train</option>
                <option value="Walking">🚶 Walking</option>
                <option value="Flight">✈️ Flight</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="travel-travelers">Number of Travelers</label>
            <input type="number" id="travel-travelers" class="form-input" min="1" max="50" value="1" />
          </div>
          <div class="form-group">
            <label class="form-label" for="travel-notes">Additional Notes</label>
            <input type="text" id="travel-notes" class="form-input"
                   placeholder="e.g. Traveling with infant, pregnant women, elderly" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="travel-submit">
            <span class="btn-text">🤖 Get Safety Advisory</span>
          </button>
        </form>
      </div>

      <!-- Advisory Output -->
      <div class="card card-animate" style="position:relative" id="advisory-card">
        <div class="card-header">
          <div class="card-title"><span class="icon">📊</span> Safety Advisory</div>
        </div>
        <div id="advisory-output" class="markdown-content">
          <div class="empty-state">
            <div class="icon">🚗</div>
            <h3>Advisory will appear here</h3>
            <p>Enter your journey details and click "Get Safety Advisory".</p>
          </div>
        </div>

        <!-- Weather Comparison -->
        <div id="weather-comparison" style="display:none;margin-top:1rem">
          <div class="divider"></div>
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem;color:var(--text-secondary)">
            📊 Live Weather Comparison
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
            <div class="stat-card" id="origin-weather-card">
              <div class="stat-label">Origin</div>
              <div id="origin-weather-content"></div>
            </div>
            <div class="stat-card" id="dest-weather-card">
              <div class="stat-label">Destination</div>
              <div id="dest-weather-content"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Advisories (demo static) -->
    <div class="card card-animate" style="margin-top:1.5rem">
      <div class="card-header">
        <div class="card-title"><span class="icon">📋</span> Common Route Tips</div>
      </div>
      <div class="grid-3">
        ${[
          { route: 'Mumbai → Pune (Expressway)', risk: 'high', tip: 'Frequent fog and waterlogging near Khopoli. Drive slow, use fog lights.' },
          { route: 'Chennai → Bangalore (NH44)', risk: 'moderate', tip: 'Flash floods possible near Krishnagiri. Check real-time conditions.' },
          { route: 'Kolkata → Darjeeling (NH10)', risk: 'extreme', tip: 'Landslides frequent in monsoon. Avoid travel unless critical.' },
        ].map(r => `
          <div class="card card-sm card-${r.risk === 'extreme' ? 'danger' : r.risk === 'high' ? 'warning' : 'accent'}">
            <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);margin-bottom:0.25rem">${escapeText(r.route)}</div>
            <span class="badge badge-${r.risk}" style="margin-bottom:0.5rem">${r.risk.toUpperCase()}</span>
            <p style="font-size:0.775rem;margin:0">${escapeText(r.tip)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('travel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetchAdvisory();
  });
}

async function fetchAdvisory() {
  const submitBtn = document.getElementById('travel-submit');
  const output    = document.getElementById('advisory-output');

  const data = {
    origin:      document.getElementById('travel-origin').value.trim(),
    destination: document.getElementById('travel-dest').value.trim(),
    travelDate:  document.getElementById('travel-date').value,
    mode:        document.getElementById('travel-mode').value,
    travelers:   parseInt(document.getElementById('travel-travelers').value) || 1,
    notes:       document.getElementById('travel-notes').value.trim(),
  };

  if (!data.origin || !data.destination) {
    showToast('warning', 'Missing Fields', 'Please enter both origin and destination.');
    return;
  }

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  output.innerHTML = `
    <div style="text-align:center;padding:2rem">
      <div class="spinner spinner-lg" style="margin:0 auto 1rem"></div>
      <p>🤖 AI is analyzing route safety...</p>
      <p style="font-size:0.75rem;margin-top:0.5rem">Checking weather along your route</p>
    </div>
  `;

  try {
    const result = await api.ai.travel(data);

    output.innerHTML = markdownToSafeHtml(result.advisory);
    output.innerHTML += `<div style="margin-top:1rem;font-size:0.75rem;color:var(--text-muted)">Generated at ${new Date().toLocaleString()}</div>`;

    // Show weather comparison
    renderWeatherComparison(result, data);

    // Determine verdict for toast
    const isAvoid = result.advisory.includes('AVOID');
    showToast(isAvoid ? 'warning' : 'success',
      isAvoid ? '⚠️ Travel Advisory Issued' : '✅ Advisory Ready',
      `Route ${data.origin} → ${data.destination} analyzed.`
    );
  } catch (err) {
    output.innerHTML = `<div class="card card-danger" style="padding:1rem">❌ ${escapeText(err.message)}</div>`;
    showToast('error', 'Advisory Failed', err.message);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

function renderWeatherComparison(result, data) {
  const comparison = document.getElementById('weather-comparison');
  const originEl   = document.getElementById('origin-weather-content');
  const destEl     = document.getElementById('dest-weather-content');

  if (!comparison || (!result.origin_weather && !result.destination_weather)) return;

  comparison.style.display = 'block';

  const fmt = (w) => {
    if (!w) return '<p style="font-size:0.775rem;color:var(--text-muted)">Data unavailable</p>';
    const info = w.weather_info || {};
    return `
      <div style="font-size:1.25rem">${info.icon || '🌡️'}</div>
      <div style="font-weight:700;font-size:1rem">${Math.round(w.temperature_2m || 0)}°C</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">${escapeText(info.label || 'Unknown')}</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">🌧️ ${(w.precipitation || 0).toFixed(1)}mm · 💨 ${Math.round(w.wind_speed_10m || 0)}km/h</div>
      <span class="badge badge-${w.risk_level || 'moderate'}" style="margin-top:4px">${w.risk_level?.toUpperCase() || 'MODERATE'}</span>
    `;
  };

  const originCard = document.getElementById('origin-weather-card');
  const destCard   = document.getElementById('dest-weather-card');
  if (originCard) originCard.querySelector('.stat-label').textContent = `📍 ${data.origin}`;
  if (destCard)   destCard.querySelector('.stat-label').textContent   = `📍 ${data.destination}`;

  if (originEl) originEl.innerHTML = fmt(result.origin_weather);
  if (destEl)   destEl.innerHTML   = fmt(result.destination_weather);
}
