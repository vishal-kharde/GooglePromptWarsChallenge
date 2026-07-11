/**
 * Profile page — user preferences, emergency contacts, notification settings.
 */

import { state, saveProfile, DEFAULT_PROFILE } from '../state.js';
import { escapeText } from '../utils/sanitize.js';
import { getLanguageOptions } from '../utils/i18n.js';

export function renderProfile() {
  document.getElementById('page-title').textContent = 'My Profile';
  const p = state.profile;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>👤 My Profile</h1>
      <p>Your preferences power the AI — keep them up to date for the best guidance.</p>
    </div>

    <div class="grid-2">
      <!-- Personal Info -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">👤</span> Personal Information</div>
        </div>
        <form id="profile-form" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="prof-name">Name (optional)</label>
              <input type="text" id="prof-name" class="form-input" value="${escapeText(p.name || '')}" placeholder="Your name" />
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-phone">Phone (optional)</label>
              <input type="tel" id="prof-phone" class="form-input" value="${escapeText(p.phone || '')}" placeholder="+91 9XXXXXXXXX" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label required" for="prof-city">City / District</label>
            <input type="text" id="prof-city" class="form-input" required value="${escapeText(p.city)}" placeholder="e.g. Mumbai" />
          </div>

          <div class="form-group">
            <label class="form-label" for="prof-language">Preferred Language</label>
            <select id="prof-language" class="form-select">
              ${getLanguageOptions(p.language)}
            </select>
          </div>

          <div class="divider"></div>

          <div class="section-title" style="margin-bottom:1rem;font-size:0.875rem">Household Composition</div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="prof-adults">Adults (18+)</label>
              <input type="number" id="prof-adults" class="form-input" value="${p.adults}" min="1" max="20" />
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-children">Children</label>
              <input type="number" id="prof-children" class="form-input" value="${p.children}" min="0" max="20" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="prof-elderly">Elderly (60+)</label>
              <input type="number" id="prof-elderly" class="form-input" value="${p.elderly}" min="0" max="20" />
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-disabled">Differently-abled</label>
              <input type="number" id="prof-disabled" class="form-input" value="${p.disabled}" min="0" max="20" />
            </div>
          </div>

          <div class="divider"></div>
          <div class="section-title" style="margin-bottom:1rem;font-size:0.875rem">Housing & Resources</div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="prof-housing">Housing Type</label>
              <select id="prof-housing" class="form-select">
                ${['apartment','house (ground floor)','house (upper floor)','basement apartment','coastal area','flood plain','hillside/slope','rural/village'].map(v =>
                  `<option value="${v}" ${p.housingType === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-vehicle">Have a Vehicle?</label>
              <select id="prof-vehicle" class="form-select">
                <option value="true"  ${p.hasVehicle  ? 'selected' : ''}>Yes</option>
                <option value="false" ${!p.hasVehicle ? 'selected' : ''}>No</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="prof-medical">Special Medical Needs</label>
            <input type="text" id="prof-medical" class="form-input" value="${escapeText(p.medicalNeeds)}"
                   placeholder="e.g. Diabetes, Heart patient, None" />
          </div>

          <div class="form-group">
            <label class="form-label" for="prof-pets">Pets</label>
            <input type="text" id="prof-pets" class="form-input" value="${escapeText(p.pets)}"
                   placeholder="e.g. 1 dog, None" />
          </div>

          <div class="form-group">
            <label class="form-label" for="prof-financial">Financial Level</label>
            <select id="prof-financial" class="form-select">
              ${['low-income','middle-income','higher-income'].map(v =>
                `<option value="${v}" ${p.financialLevel === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`
              ).join('')}
            </select>
          </div>

          <div style="display:flex;gap:0.75rem">
            <button type="submit" class="btn btn-primary" style="flex:1" id="save-profile-btn">
              <span class="btn-text">💾 Save Profile</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="reset-profile-btn">
              🔄 Reset
            </button>
          </div>
        </form>
      </div>

      <!-- Emergency Contacts + Stats -->
      <div style="display:flex;flex-direction:column;gap:1.5rem">

        <!-- Profile Summary Card -->
        <div class="card card-accent card-animate">
          <div class="card-title" style="margin-bottom:1rem;font-size:0.875rem">📊 Your Profile Summary</div>
          <div style="display:flex;flex-direction:column;gap:0.5rem" id="profile-summary">
            ${renderProfileSummary(p)}
          </div>
        </div>

        <!-- Emergency Contacts -->
        <div class="card card-animate">
          <div class="card-title" style="margin-bottom:1rem;font-size:0.875rem">🆘 Emergency Helplines</div>
          <div style="display:flex;flex-direction:column;gap:0.75rem">
            ${[
              { label: 'National Emergency',    number: '112',           color: 'var(--color-danger)' },
              { label: 'Police',                number: '100',           color: 'var(--color-danger)' },
              { label: 'Fire',                  number: '101',           color: 'var(--color-warning)' },
              { label: 'Ambulance',             number: '102',           color: 'var(--color-success)' },
              { label: 'Disaster Helpline',     number: '1078',          color: 'var(--color-accent)' },
              { label: 'IMD Weather Helpline',  number: '1800-180-1717', color: 'var(--color-accent)' },
              { label: 'NDRF Control Room',     number: '011-24363260',  color: 'var(--color-blue)' },
              { label: 'Flood Helpline',        number: '1800-120-9771', color: 'var(--color-blue)' },
            ].map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:0.8rem;color:var(--text-secondary)">${escapeText(c.label)}</span>
                <a href="tel:${c.number}" class="btn btn-ghost btn-sm"
                   style="font-size:0.775rem;color:${c.color};border-color:rgba(255,255,255,0.1)">
                  📞 ${escapeText(c.number)}
                </a>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Data Privacy -->
        <div class="card card-sm card-animate">
          <div style="font-size:0.775rem;color:var(--text-muted)">
            <strong style="color:var(--text-secondary)">🔒 Privacy:</strong>
            All your data is stored locally in your browser. No personal information is sent to any server.
            AI queries are processed securely server-side.
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveProfileForm();
  });

  document.getElementById('reset-profile-btn').addEventListener('click', () => {
    if (confirm('Reset all profile data to defaults?')) {
      saveProfile(DEFAULT_PROFILE);
      renderProfile();
      showToast('info', 'Reset', 'Profile reset to defaults.');
    }
  });
}

function renderProfileSummary(p) {
  const lines = [
    ['📍 Location', p.city || 'Not set'],
    ['👥 Household', `${p.adults} adults${p.children ? `, ${p.children} children` : ''}${p.elderly ? `, ${p.elderly} elderly` : ''}`],
    ['🏠 Housing', p.housingType || 'Not set'],
    ['🌐 Language', p.language || 'English'],
    ['🚗 Vehicle', p.hasVehicle ? 'Yes' : 'No'],
    ['💊 Medical', p.medicalNeeds || 'None'],
  ];
  return lines.map(([label, val]) => `
    <div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem">
      <span style="color:var(--text-muted)">${label}</span>
      <span style="color:var(--text-primary);font-weight:500;text-align:right">${escapeText(String(val))}</span>
    </div>
  `).join('');
}

function saveProfileForm() {
  const profile = {
    name:         document.getElementById('prof-name').value.trim(),
    phone:        document.getElementById('prof-phone').value.trim(),
    city:         document.getElementById('prof-city').value.trim(),
    language:     document.getElementById('prof-language').value,
    adults:       parseInt(document.getElementById('prof-adults').value) || 2,
    children:     parseInt(document.getElementById('prof-children').value) || 0,
    elderly:      parseInt(document.getElementById('prof-elderly').value) || 0,
    disabled:     parseInt(document.getElementById('prof-disabled').value) || 0,
    housingType:  document.getElementById('prof-housing').value,
    hasVehicle:   document.getElementById('prof-vehicle').value === 'true',
    medicalNeeds: document.getElementById('prof-medical').value.trim(),
    pets:         document.getElementById('prof-pets').value.trim(),
    financialLevel: document.getElementById('prof-financial').value,
  };

  if (!profile.city) {
    showToast('warning', 'City Required', 'Please enter your city.');
    return;
  }

  saveProfile(profile);

  // Refresh summary
  const summary = document.getElementById('profile-summary');
  if (summary) summary.innerHTML = renderProfileSummary(profile);

  showToast('success', 'Profile Saved!', 'Your preferences have been updated.');
}
