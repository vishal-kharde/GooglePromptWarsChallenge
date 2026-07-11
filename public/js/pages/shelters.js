/**
 * Shelter Finder page — nearest shelters with capacity and amenities.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { escapeText } from '../utils/sanitize.js';
import { getCurrentPosition, haversineDistance } from '../utils/location.js';

export function renderShelters() {
  document.getElementById('page-title').textContent = 'Find Shelters';

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>🏥 Emergency Shelters</h1>
      <p>Nearest relief camps and emergency shelters with live capacity information.</p>
    </div>

    <div class="card card-sm" style="margin-bottom:1.5rem">
      <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="locate-shelter-btn">
          📡 Find Nearest to My Location
        </button>
        <span style="color:var(--text-muted);font-size:0.875rem">or browse all shelters below</span>
      </div>
    </div>

    <div id="shelter-grid" class="grid-auto">
      ${[1,2,3,4,5,6].map(() => `
        <div class="card card-animate" style="height:200px">
          <div class="skeleton" style="height:1rem;width:70%;margin-bottom:0.5rem"></div>
          <div class="skeleton" style="height:0.75rem;width:90%;margin-bottom:1rem"></div>
          <div class="skeleton" style="height:0.5rem;border-radius:99px;margin-bottom:0.75rem"></div>
          <div style="display:flex;gap:0.5rem">
            <div class="skeleton" style="height:1.5rem;width:60px;border-radius:99px"></div>
            <div class="skeleton" style="height:1.5rem;width:60px;border-radius:99px"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('locate-shelter-btn').addEventListener('click', async () => {
    const btn = document.getElementById('locate-shelter-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const pos = await getCurrentPosition();
      await loadShelters(pos.lat, pos.lon);
    } catch (e) {
      showToast('error', 'Location Error', e.message);
      await loadShelters();
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // Load all shelters by default
  loadShelters();
}

async function loadShelters(lat, lon) {
  const grid = document.getElementById('shelter-grid');
  if (!grid) return;

  try {
    let shelters;
    if (lat && lon) {
      const { shelters: s } = await api.shelters.getNearest(lat, lon);
      shelters = s;
    } else {
      const { shelters: s } = await api.shelters.getAll();
      shelters = s;
    }

    if (shelters.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🏥</div><h3>No shelters found</h3></div>';
      return;
    }

    grid.innerHTML = shelters.map((s, i) => renderShelterCard(s, lat, lon, i)).join('');
  } catch (err) {
    grid.innerHTML = `<div class="card card-danger" style="padding:1rem">❌ ${escapeText(err.message)}</div>`;
  }
}

function renderShelterCard(s, userLat, userLon, idx) {
  const pct   = s.capacity > 0 ? Math.round((s.current_occupancy / s.capacity) * 100) : 0;
  const avail = s.capacity - s.current_occupancy;
  const fillClass = pct >= 85 ? 'full' : pct >= 60 ? 'medium' : '';
  const statusColor = pct >= 85 ? 'var(--color-danger)' : pct >= 60 ? 'var(--color-warning)' : 'var(--color-success)';
  const distKm = (userLat && userLon && s.lat && s.lng)
    ? haversineDistance(userLat, userLon, s.lat, s.lng).toFixed(1)
    : null;

  const amenities = [
    s.has_food      ? '🍱 Food'       : null,
    s.has_medical   ? '💊 Medical'    : null,
    s.has_water     ? '💧 Water'      : null,
    s.has_electricity ? '⚡ Power'    : null,
  ].filter(Boolean);

  return `
    <div class="card card-animate" style="animation-delay:${idx * 50}ms">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.5rem">
        <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary)">${escapeText(s.name)}</div>
        ${distKm ? `<span class="badge badge-info">${distKm} km</span>` : ''}
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem">
        📍 ${escapeText(s.address)}
      </div>

      <!-- Capacity -->
      <div style="margin-bottom:0.75rem">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">
          <span>Capacity</span>
          <span style="color:${statusColor};font-weight:600">${avail > 0 ? avail + ' spots available' : 'FULL'}</span>
        </div>
        <div class="capacity-bar">
          <div class="capacity-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">
          ${s.current_occupancy} / ${s.capacity} occupied
        </div>
      </div>

      <!-- Amenities -->
      <div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.75rem">
        ${amenities.map(a => `<span class="badge badge-accent">${a}</span>`).join('')}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:0.5rem">
        ${s.contact ? `
          <a href="tel:${s.contact}" class="btn btn-ghost btn-sm" style="font-size:0.75rem">
            📞 Call
          </a>
        ` : ''}
        <a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}&zoom=16"
           target="_blank" rel="noopener noreferrer"
           class="btn btn-secondary btn-sm" style="font-size:0.75rem">
          🗺️ Directions
        </a>
      </div>
    </div>
  `;
}
