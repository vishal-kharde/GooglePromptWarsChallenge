/**
 * Preparedness Plan page — user profile form → AI generates personalized plan.
 */

import { api } from '../api.js';
import { state, saveProfile } from '../state.js';
import { markdownToSafeHtml, escapeText } from '../utils/sanitize.js';
import { LANGUAGES, getLanguageOptions } from '../utils/i18n.js';

export function renderPlan() {
  document.getElementById('page-title').textContent = 'My Preparedness Plan';
  const p = state.profile;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>📋 Personalized Preparedness Plan</h1>
      <p>Fill in your household details and let AI generate a custom monsoon plan for your family.</p>
    </div>

    <div class="grid-2">
      <!-- Profile Form -->
      <div class="card card-animate" id="plan-form-card">
        <div class="card-header">
          <div class="card-title"><span class="icon">👥</span> Household Profile</div>
        </div>
        <form id="plan-form" novalidate>
          <div class="form-group">
            <label class="form-label required" for="plan-city">City / District</label>
            <input type="text" id="plan-city" class="form-input" value="${escapeText(p.city)}"
                   placeholder="e.g. Mumbai, Chennai, Dhaka" required aria-required="true"/>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label required" for="plan-adults">Adults (18+)</label>
              <input type="number" id="plan-adults" class="form-input" value="${p.adults}" min="1" max="20" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-children">Children (&lt;18)</label>
              <input type="number" id="plan-children" class="form-input" value="${p.children}" min="0" max="20" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="plan-elderly">Elderly (60+)</label>
              <input type="number" id="plan-elderly" class="form-input" value="${p.elderly}" min="0" max="20" />
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-disabled">Differently-abled</label>
              <input type="number" id="plan-disabled" class="form-input" value="${p.disabled}" min="0" max="20" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="plan-housing">Housing Type</label>
              <select id="plan-housing" class="form-select">
                ${['Apartment','House (ground floor)','House (upper floor)','Basement apartment','Coastal area','Flood plain','Hillside/slope','Rural/village'].map(v =>
                  `<option value="${v.toLowerCase()}" ${p.housingType === v.toLowerCase() ? 'selected' : ''}>${v}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-language">Response Language</label>
              <select id="plan-language" class="form-select">
                ${getLanguageOptions(p.language)}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="plan-vehicle">Have a Vehicle?</label>
              <select id="plan-vehicle" class="form-select">
                <option value="true"  ${p.hasVehicle ? 'selected' : ''}>Yes</option>
                <option value="false" ${!p.hasVehicle ? 'selected' : ''}>No</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="plan-financial">Economic Level</label>
              <select id="plan-financial" class="form-select">
                ${['Low-income','Middle-income','Higher-income'].map(v =>
                  `<option value="${v.toLowerCase()}" ${p.financialLevel === v.toLowerCase() ? 'selected' : ''}>${v}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="plan-medical">Special Medical Needs</label>
            <input type="text" id="plan-medical" class="form-input"
                   value="${escapeText(p.medicalNeeds)}"
                   placeholder="e.g. Diabetes, Heart condition, None" />
          </div>

          <div class="form-group">
            <label class="form-label" for="plan-pets">Pets</label>
            <input type="text" id="plan-pets" class="form-input"
                   value="${escapeText(p.pets)}"
                   placeholder="e.g. 1 dog, 2 cats, None" />
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="plan-submit" aria-label="Generate preparedness plan">
            <span class="btn-text">🤖 Generate My Plan</span>
          </button>
        </form>
      </div>

      <!-- Plan Output -->
      <div class="card card-animate" id="plan-output-card" style="position:relative">
        <div class="card-header">
          <div class="card-title"><span class="icon">📄</span> Your Preparedness Plan</div>
          <button class="btn btn-ghost btn-sm" id="plan-copy-btn" aria-label="Copy plan" style="display:none">
            📋 Copy
          </button>
        </div>
        <div id="plan-output" class="markdown-content">
          <div class="empty-state">
            <div class="icon">📋</div>
            <h3>Your plan will appear here</h3>
            <p>Fill in your household details and click "Generate My Plan" to receive a personalized monsoon preparedness plan.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Form submit
  document.getElementById('plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await generatePlan();
  });

  // Copy button
  document.getElementById('plan-copy-btn').addEventListener('click', () => {
    const text = document.getElementById('plan-output').innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('success', 'Copied!', 'Plan copied to clipboard');
    });
  });
}

async function generatePlan() {
  const submitBtn = document.getElementById('plan-submit');
  const output    = document.getElementById('plan-output');
  const copyBtn   = document.getElementById('plan-copy-btn');

  // Collect form values
  const profile = {
    city:           document.getElementById('plan-city').value.trim(),
    adults:         parseInt(document.getElementById('plan-adults').value) || 2,
    children:       parseInt(document.getElementById('plan-children').value) || 0,
    elderly:        parseInt(document.getElementById('plan-elderly').value) || 0,
    disabled:       parseInt(document.getElementById('plan-disabled').value) || 0,
    housingType:    document.getElementById('plan-housing').value,
    language:       document.getElementById('plan-language').value,
    hasVehicle:     document.getElementById('plan-vehicle').value === 'true',
    financialLevel: document.getElementById('plan-financial').value,
    medicalNeeds:   document.getElementById('plan-medical').value.trim(),
    pets:           document.getElementById('plan-pets').value.trim(),
  };

  if (!profile.city) {
    showToast('warning', 'City Required', 'Please enter your city or district.');
    return;
  }

  // Save profile
  saveProfile(profile);

  // Loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  copyBtn.style.display = 'none';

  output.innerHTML = `
    <div class="loading-overlay" style="position:relative;background:transparent;padding:3rem;text-align:center">
      <div class="spinner spinner-lg"></div>
      <p style="margin-top:1rem">🤖 AI is generating your personalized plan...</p>
      <p style="font-size:0.75rem;margin-top:0.5rem">This takes 15-30 seconds</p>
    </div>
  `;

  try {
    const { plan, weather } = await api.ai.plan(profile);

    // Render plan with safe markdown
    const safeHtml = markdownToSafeHtml(plan);
    output.innerHTML = `
      ${weather ? `
        <div style="background:var(--color-accent-dim);border:1px solid rgba(0,200,240,0.2);border-radius:var(--radius-md);padding:0.75rem 1rem;margin-bottom:1.5rem;font-size:0.825rem;color:var(--text-secondary)">
          📍 Based on live weather in <strong style="color:var(--color-accent)">${escapeText(profile.city)}</strong>:
          ${escapeText(weather.current?.weather_info?.label || '')} · Risk: <strong>${escapeText(weather.risk_level || 'moderate').toUpperCase()}</strong>
        </div>
      ` : ''}
      ${safeHtml}
      <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--color-border);font-size:0.75rem;color:var(--text-muted)">
        Generated by Google Gemini AI · ${new Date().toLocaleString()}
      </div>
    `;

    copyBtn.style.display = 'flex';
    showToast('success', 'Plan Ready!', 'Your personalized monsoon preparedness plan is ready.');
  } catch (err) {
    output.innerHTML = `
      <div class="card card-danger" style="padding:1rem">
        <p>❌ Failed to generate plan: ${escapeText(err.message)}</p>
        <p style="margin-top:0.5rem;font-size:0.8rem">Please check your Gemini API key and try again.</p>
      </div>
    `;
    showToast('error', 'Generation Failed', err.message);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}
