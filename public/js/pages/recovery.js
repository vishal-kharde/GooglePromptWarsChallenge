/**
 * Recovery Guide page — AI-generated post-disaster recovery plan.
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { markdownToSafeHtml, escapeText } from '../utils/sanitize.js';
import { getLanguageOptions } from '../utils/i18n.js';

export function renderRecovery() {
  document.getElementById('page-title').textContent = 'Recovery Guide';

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>🔄 Post-Disaster Recovery Guide</h1>
      <p>AI helps you navigate recovery after monsoon damage — from safety checks to insurance claims.</p>
    </div>

    <!-- Important Banner -->
    <div class="card card-danger card-sm" style="margin-bottom:1.5rem">
      <div style="display:flex;gap:0.75rem;align-items:center">
        <span style="font-size:1.5rem">🚨</span>
        <div>
          <strong style="color:var(--color-danger);display:block;margin-bottom:2px">In Immediate Danger?</strong>
          <span style="font-size:0.825rem;color:var(--text-secondary)">
            Call <a href="tel:112" style="color:var(--color-danger);font-weight:700">112</a> immediately.
            For NDRF rescue: <a href="tel:011-24363260" style="color:var(--color-danger)">011-24363260</a>
          </span>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Form -->
      <div class="card card-animate">
        <div class="card-header">
          <div class="card-title"><span class="icon">📋</span> Your Situation</div>
        </div>
        <form id="recovery-form" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label required" for="rec-city">City / State</label>
              <input type="text" id="rec-city" class="form-input" required
                     value="${escapeText(state.profile.city)}" placeholder="e.g. Mumbai, Maharashtra" />
            </div>
            <div class="form-group">
              <label class="form-label" for="rec-language">Language</label>
              <select id="rec-language" class="form-select">
                ${getLanguageOptions(state.profile.language)}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label required" for="rec-damage">Type of Damage</label>
            <select id="rec-damage" class="form-select" required>
              ${[
                'Flood damage to home','Roof damage from storm','Waterlogging & structural damage',
                'Landslide damage','Power outage (prolonged)','Crop / agricultural loss',
                'Livelihood/business loss','Multiple types of damage','Other',
              ].map(v => `<option value="${v}">${v}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="rec-home-damage">Home Damage Level</label>
            <select id="rec-home-damage" class="form-select">
              <option value="none">No structural damage</option>
              <option value="minor">Minor (wall cracks, seepage)</option>
              <option value="moderate" selected>Moderate (major repairs needed)</option>
              <option value="severe">Severe (uninhabitable)</option>
              <option value="total">Total loss / collapsed</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="rec-crop">Crop / Livelihood Loss?</label>
              <select id="rec-crop" class="form-select">
                <option value="no">No</option>
                <option value="partial">Partial loss</option>
                <option value="complete">Complete loss</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="rec-insurance">Have Insurance?</label>
              <select id="rec-insurance" class="form-select">
                <option value="yes">Yes (home/crop)</option>
                <option value="no" selected>No</option>
                <option value="unknown">Not sure</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="rec-medical">Injuries / Medical Issues</label>
            <input type="text" id="rec-medical" class="form-input" placeholder="e.g. None, Minor cuts, Fever" />
          </div>

          <div class="form-group">
            <label class="form-label" for="rec-family">Family Composition</label>
            <input type="text" id="rec-family" class="form-input"
                   placeholder="e.g. 2 adults, 1 child"
                   value="${state.profile.adults} adults${state.profile.children ? ', ' + state.profile.children + ' children' : ''}${state.profile.elderly ? ', ' + state.profile.elderly + ' elderly' : ''}" />
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="recovery-submit">
            <span class="btn-text">🤖 Generate Recovery Plan</span>
          </button>
        </form>
      </div>

      <!-- Output -->
      <div class="card card-animate" id="recovery-output-card">
        <div class="card-header">
          <div class="card-title"><span class="icon">🔄</span> Recovery Guide</div>
          <button class="btn btn-ghost btn-sm" id="recovery-copy-btn" style="display:none">📋 Copy</button>
        </div>
        <div id="recovery-output" class="markdown-content">
          <div class="empty-state">
            <div class="icon">🔄</div>
            <h3>Recovery plan will appear here</h3>
            <p>Describe your situation and get AI guidance on recovery steps, government schemes, and insurance claims.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Government Schemes Quick Reference -->
    <div class="card card-animate" style="margin-top:1.5rem">
      <div class="card-header">
        <div class="card-title"><span class="icon">🏛️</span> Key Government Relief Schemes</div>
      </div>
      <div class="grid-3">
        ${[
          { name: 'NDRF (National Disaster Response Fund)', desc: 'Central government fund for disaster relief. Apply through state government.', link: 'https://ndma.gov.in' },
          { name: 'SDRF (State Disaster Response Fund)', desc: 'State-level relief for affected families. Contact District Collector office.', link: '#' },
          { name: 'PM National Relief Fund', desc: 'Immediate relief for natural calamities. Apply online or at CSC centers.', link: 'https://pmnrf.gov.in' },
          { name: 'PMFBY (Crop Insurance)', desc: 'Pradhan Mantri Fasal Bima Yojana for farmer crop loss claims.', link: 'https://pmfby.gov.in' },
          { name: 'PMAY (Housing Scheme)', desc: 'Assistance for damaged/destroyed homes under Pradhan Mantri Awas Yojana.', link: 'https://pmaymis.gov.in' },
          { name: 'National Helpline 1078', desc: '24/7 disaster management helpline for all states. Available in regional languages.', link: 'tel:1078' },
        ].map(s => `
          <div class="card card-sm" style="padding:1rem">
            <div style="font-weight:600;font-size:0.825rem;color:var(--text-primary);margin-bottom:0.25rem">${escapeText(s.name)}</div>
            <div style="font-size:0.775rem;color:var(--text-secondary);margin-bottom:0.5rem">${escapeText(s.desc)}</div>
            <a href="${s.link}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="font-size:0.75rem">
              Learn More →
            </a>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('recovery-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateRecovery();
  });

  document.getElementById('recovery-copy-btn').addEventListener('click', () => {
    const text = document.getElementById('recovery-output').innerText;
    navigator.clipboard.writeText(text).then(() => showToast('success', 'Copied!', 'Recovery plan copied.'));
  });
}

async function generateRecovery() {
  const btn    = document.getElementById('recovery-submit');
  const output = document.getElementById('recovery-output');
  const copyBtn = document.getElementById('recovery-copy-btn');

  btn.classList.add('loading');
  btn.disabled = true;
  copyBtn.style.display = 'none';

  output.innerHTML = `
    <div style="text-align:center;padding:2rem">
      <div class="spinner spinner-lg" style="margin:0 auto 1rem"></div>
      <p>🤖 AI is generating your recovery plan...</p>
    </div>
  `;

  const data = {
    city:       document.getElementById('rec-city').value.trim(),
    damageType: document.getElementById('rec-damage').value,
    homeDamage: document.getElementById('rec-home-damage').value,
    cropLoss:   document.getElementById('rec-crop').value,
    hasInsurance: document.getElementById('rec-insurance').value,
    medical:    document.getElementById('rec-medical').value.trim(),
    family:     document.getElementById('rec-family').value.trim(),
    language:   document.getElementById('rec-language').value,
  };

  try {
    const { guide } = await api.ai.recovery(data);
    output.innerHTML = markdownToSafeHtml(guide);
    output.innerHTML += `<div style="margin-top:1rem;font-size:0.75rem;color:var(--text-muted)">Generated at ${new Date().toLocaleString()}</div>`;
    copyBtn.style.display = 'flex';
    showToast('success', 'Recovery Plan Ready', 'Your personalized recovery guide is ready.');
  } catch (err) {
    output.innerHTML = `<div class="card card-danger" style="padding:1rem">❌ ${escapeText(err.message)}</div>`;
    showToast('error', 'Failed', err.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}
