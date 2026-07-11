/**
 * Smart Checklist page — AI-generated, category-filtered, progress-tracked.
 */

import { api } from '../api.js';
import { state, saveChecklist, ensureSessionId } from '../state.js';
import { escapeText } from '../utils/sanitize.js';

const CATEGORY_ICONS = {
  'Water & Food':         '🥤',
  'Medical & First Aid':  '🏥',
  'Documents & Finance':  '📄',
  'Communication':        '📱',
  'Home Safety':          '🏠',
  'Evacuation':           '🚗',
  'Clothing & Shelter':   '👕',
  'Special Needs':        '♿',
  'Tools & Equipment':    '🔧',
  'general':              '📦',
};

const PRIORITY_COLORS = {
  critical: 'var(--color-danger)',
  high:     'var(--color-warning)',
  medium:   'var(--color-accent)',
  low:      'var(--text-muted)',
};

export function renderChecklist() {
  document.getElementById('page-title').textContent = 'Emergency Checklist';

  const items    = state.checklist;
  const done     = items.filter(i => i.completed).length;
  const pct      = items.length ? Math.round((done / items.length) * 100) : 0;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header page-transition-enter">
      <h1>✅ Emergency Checklist</h1>
      <p>AI-generated preparedness checklist tailored to your household profile.</p>
    </div>

    <!-- Progress + Actions -->
    <div class="card card-animate" style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div class="progress-label">
            <span>Preparedness Progress</span>
            <strong style="color:var(--color-accent)" id="progress-pct">${pct}%</strong>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width:${pct}%"></div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem" id="progress-label">
            ${done} of ${items.length} items completed
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="generate-checklist-btn">
            🤖 Generate / Refresh
          </button>
          <button class="btn btn-ghost btn-sm" id="reset-checklist-btn">
            🔄 Reset Progress
          </button>
          <button class="btn btn-ghost btn-sm" id="print-checklist-btn">
            🖨️ Print
          </button>
        </div>
      </div>
    </div>

    <!-- Category Filter -->
    <div class="tabs card-animate" id="category-tabs" role="tablist" aria-label="Filter by category">
      <button class="tab active" data-cat="all" role="tab" aria-selected="true">All</button>
    </div>

    <!-- Checklist Items -->
    <div id="checklist-container" aria-label="Checklist items" role="list">
      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="icon">✅</div>
          <h3>No checklist yet</h3>
          <p>Click "Generate / Refresh" to create your personalized emergency checklist.</p>
          <button class="btn btn-primary" style="margin-top:1rem" id="empty-generate-btn">
            🤖 Generate My Checklist
          </button>
        </div>
      ` : renderItems(items, 'all')}
    </div>
  `;

  // Bind buttons
  document.getElementById('generate-checklist-btn').addEventListener('click', generateChecklist);
  document.getElementById('reset-checklist-btn').addEventListener('click', resetProgress);
  document.getElementById('print-checklist-btn').addEventListener('click', () => window.print());

  const emptyBtn = document.getElementById('empty-generate-btn');
  if (emptyBtn) emptyBtn.addEventListener('click', generateChecklist);

  // Build category tabs if items exist
  if (items.length > 0) buildCategoryTabs(items);

  // Bind checklist item clicks (event delegation)
  document.getElementById('checklist-container').addEventListener('click', onItemClick);
}

function buildCategoryTabs(items) {
  const cats = [...new Set(items.map(i => i.category))].filter(Boolean);
  const tabs = document.getElementById('category-tabs');
  if (!tabs) return;

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.cat = cat;
    btn.role = 'tab';
    btn.setAttribute('aria-selected', 'false');
    btn.innerHTML = `${CATEGORY_ICONS[cat] || '📦'} ${escapeText(cat)}`;
    tabs.appendChild(btn);
  });

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tabs.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const cat = tab.dataset.cat;
    const container = document.getElementById('checklist-container');
    if (container) {
      container.innerHTML = renderItems(state.checklist, cat);
    }
  });
}

function renderItems(items, filterCat) {
  const filtered = filterCat === 'all' ? items : items.filter(i => i.category === filterCat);

  if (filtered.length === 0) {
    return '<div class="empty-state" style="padding:2rem"><p>No items in this category.</p></div>';
  }

  // Group by category if showing all
  if (filterCat === 'all') {
    const groups = {};
    for (const item of filtered) {
      const cat = item.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }

    return Object.entries(groups).map(([cat, catItems]) => `
      <div class="section" style="margin-bottom:1.5rem">
        <div class="section-header">
          <div class="section-title">
            ${CATEGORY_ICONS[cat] || '📦'} ${escapeText(cat)}
            <span class="badge badge-accent" style="font-size:0.65rem">
              ${catItems.filter(i => i.completed).length}/${catItems.length}
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem" role="list">
          ${catItems.map((item, idx) => renderItem(item, idx)).join('')}
        </div>
      </div>
    `).join('');
  }

  return `<div style="display:flex;flex-direction:column;gap:0.5rem" role="list">
    ${filtered.map((item, idx) => renderItem(item, idx)).join('')}
  </div>`;
}

function renderItem(item, idx) {
  const priorityColor = PRIORITY_COLORS[item.priority] || 'var(--text-muted)';
  return `
    <div class="checklist-item ${item.completed ? 'completed' : ''}"
         data-id="${item.id !== undefined ? item.id : idx}"
         data-idx="${idx}"
         role="listitem"
         tabindex="0"
         aria-checked="${item.completed}"
         style="animation-delay:${idx * 20}ms">
      <div class="checklist-checkbox" aria-hidden="true">
        ${item.completed ? '✓' : ''}
      </div>
      <div class="checklist-text" style="flex:1">
        <div style="font-size:0.875rem;color:${item.completed ? 'var(--text-muted)' : 'var(--text-secondary)'};
             ${item.completed ? 'text-decoration:line-through' : ''}">
          ${escapeText(item.text)}
        </div>
        ${item.tip ? `<div class="checklist-tip">💡 ${escapeText(item.tip)}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0">
        <span style="width:6px;height:6px;border-radius:50%;background:${priorityColor};flex-shrink:0" title="${escapeText(item.priority)} priority"></span>
      </div>
    </div>
  `;
}

function onItemClick(e) {
  const item = e.target.closest('.checklist-item');
  if (!item) return;

  const idx       = parseInt(item.dataset.idx);
  const checklist = [...state.checklist];
  if (!checklist[idx]) return;

  checklist[idx] = { ...checklist[idx], completed: !checklist[idx].completed };
  saveChecklist(checklist);

  // Update UI optimistically
  item.classList.toggle('completed');
  const checkbox = item.querySelector('.checklist-checkbox');
  const textEl   = item.querySelector('.checklist-text > div');
  if (checkbox) checkbox.innerHTML = checklist[idx].completed ? '✓' : '';
  if (textEl) {
    textEl.style.textDecoration = checklist[idx].completed ? 'line-through' : 'none';
    textEl.style.color = checklist[idx].completed ? 'var(--text-muted)' : 'var(--text-secondary)';
  }
  item.setAttribute('aria-checked', checklist[idx].completed);

  // Update progress
  updateProgress(checklist);

  // Server sync (fire and forget)
  const sessionId = ensureSessionId();
  api.checklist.save(sessionId, checklist).catch(() => {});
}

function updateProgress(items) {
  const done = items.filter(i => i.completed).length;
  const pct  = items.length ? Math.round((done / items.length) * 100) : 0;

  const fillEl   = document.getElementById('progress-fill');
  const pctEl    = document.getElementById('progress-pct');
  const labelEl  = document.getElementById('progress-label');

  if (fillEl)  fillEl.style.width = pct + '%';
  if (pctEl)   pctEl.textContent  = pct + '%';
  if (labelEl) labelEl.textContent = `${done} of ${items.length} items completed`;
}

function resetProgress() {
  const checklist = state.checklist.map(i => ({ ...i, completed: false }));
  saveChecklist(checklist);
  renderChecklist();
  showToast('info', 'Reset', 'Checklist progress has been reset.');
}

async function generateChecklist() {
  const container = document.getElementById('checklist-container');
  
  if (!state.profile || !state.profile.city || state.profile.city.trim() === '') {
    showToast('warning', 'Profile Incomplete', 'Please enter your city/district in your profile first.');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">👤</div>
          <h3>Profile Incomplete</h3>
          <p>Please enter your city or district in your profile to enable personalized checklist generation.</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="location.hash = '#profile'">
            Go to Profile
          </button>
        </div>
      `;
    }
    return;
  }

  const btn = document.getElementById('generate-checklist-btn');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  if (container) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem">
        <div class="spinner spinner-lg" style="margin:0 auto 1rem"></div>
        <p>🤖 AI is generating your personalized checklist...</p>
      </div>
    `;
  }

  try {
    const { items } = await api.ai.checklist(state.profile);

    // Add idx-based id and default completed=false
    const mapped = items.map((item, idx) => ({
      id:        idx,
      text:      item.text,
      category:  item.category || 'general',
      priority:  item.priority || 'medium',
      tip:       item.tip || '',
      completed: false,
    }));

    saveChecklist(mapped);

    // Server sync
    const sessionId = ensureSessionId();
    api.checklist.save(sessionId, mapped).catch(() => {});

    renderChecklist();
    showToast('success', 'Checklist Ready!', `${mapped.length} items generated for your household.`);
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="card card-danger" style="padding:1rem">
          <p>❌ Failed: ${escapeText(err.message)}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:0.5rem" id="retry-checklist-btn">Retry</button>
        </div>
      `;
      document.getElementById('retry-checklist-btn')?.addEventListener('click', generateChecklist);
    }
    showToast('error', 'Generation Failed', err.message);
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}
