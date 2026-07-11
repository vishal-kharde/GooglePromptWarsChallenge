/**
 * MonsoonGuard AI — SPA Router & Application Shell
 * Handles navigation, global UI, rain animation, toast system, keyboard shortcuts.
 */

import { renderDashboard }  from './pages/dashboard.js';
import { renderPlan }       from './pages/plan.js';
import { renderChecklist }  from './pages/checklist.js';
import { renderChat }       from './pages/chat.js';

import { renderShelters }   from './pages/shelters.js';
import { renderTravel }     from './pages/travel.js';
import { renderRecovery }   from './pages/recovery.js';
import { renderProfile }    from './pages/profile.js';
import { state, setState }  from './state.js';

// ============================================================
// Page Registry
// ============================================================
const PAGES = {
  dashboard: { title: 'Dashboard',      render: renderDashboard },
  plan:      { title: 'My Plan',         render: renderPlan },
  checklist: { title: 'Checklist',       render: renderChecklist },
  chat:      { title: 'AI Assistant',    render: renderChat },

  shelters:  { title: 'Shelters',        render: renderShelters },
  travel:    { title: 'Travel Advisory', render: renderTravel },
  recovery:  { title: 'Recovery Guide',  render: renderRecovery },
  profile:   { title: 'My Profile',      render: renderProfile },
};

// ============================================================
// Navigation
// ============================================================
function navigate(pageId) {
  const page = PAGES[pageId];
  if (!page) {
    navigate('dashboard');
    return;
  }

  // Update state
  setState('currentPage', pageId);

  // Update sidebar nav
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.page === pageId;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });

  // Update breadcrumb
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = page.title;

  // Update document title
  document.title = `${page.title} — MonsoonGuard AI`;

  // Render page with transition
  const content = document.getElementById('page-content');
  if (content) {
    content.classList.remove('page-transition-enter');
    void content.offsetWidth; // Force reflow for animation restart
    page.render();
    // Ensure scroll to top
    content.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }

  // Close sidebar on mobile
  closeMobileSidebar();

  // Update URL hash (without triggering hashchange)
  if (location.hash !== '#' + pageId) {
    history.replaceState(null, '', '#' + pageId);
  }
}

// Make navigate available globally (for page onclick handlers)
window._navigate = navigate;

// ============================================================
// Toast System
// ============================================================
function showToast(type, title, message, durationMs = 4000) {
  const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-dismiss" aria-label="Dismiss notification">✕</button>
  `;

  const dismiss = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  container.appendChild(toast);

  // Auto dismiss
  setTimeout(dismiss, durationMs);
}

// Make toast globally accessible
window.showToast = showToast;

// ============================================================
// Rain Canvas Animation
// ============================================================
function initRainAnimation() {
  const canvas = document.getElementById('rain-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let drops = [];
  let animId = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createDrops(n = 80) {
    drops = Array.from({ length: n }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height - canvas.height,
      length: 8 + Math.random() * 16,
      speed:  4 + Math.random() * 8,
      opacity: 0.3 + Math.random() * 0.5,
      width:  0.5 + Math.random() * 1,
    }));
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drops.forEach(drop => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 200, 240, ${drop.opacity})`;
      ctx.lineWidth   = drop.width;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.length * 0.3, drop.y + drop.length);
      ctx.stroke();

      drop.y += drop.speed;
      drop.x += drop.speed * 0.15; // Slight diagonal

      if (drop.y > canvas.height) {
        drop.y = -drop.length;
        drop.x = Math.random() * canvas.width;
      }
    });

    animId = requestAnimationFrame(drawFrame);
  }

  resize();
  createDrops();
  drawFrame();

  window.addEventListener('resize', () => {
    resize();
    createDrops();
  });

  // Pause animation when page is hidden (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      drawFrame();
    }
  });
}

// ============================================================
// Sidebar & Mobile Menu
// ============================================================
function initSidebar() {
  const toggle   = document.getElementById('menu-toggle');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');

  toggle?.addEventListener('click', () => {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    overlay.classList.toggle('visible', !isOpen);
    toggle.setAttribute('aria-expanded', !isOpen);
  });

  overlay?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
}

// ============================================================
// Alert Bar
// ============================================================
function showAlertBar(message) {
  const bar    = document.getElementById('alert-bar');
  const textEl = document.getElementById('alert-bar-text');
  if (bar && textEl) {
    textEl.textContent = message;
    bar.classList.add('visible');
  }
}

document.getElementById('alert-bar-dismiss')?.addEventListener('click', () => {
  document.getElementById('alert-bar')?.classList.remove('visible');
});

// ============================================================
// Keyboard Shortcuts
// ============================================================
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt+D = Dashboard, Alt+C = Chat, Alt+M = Map, Alt+K = Checklist
    if (e.altKey) {
      const MAP = { d: 'dashboard', c: 'chat', m: 'map', k: 'checklist', t: 'travel', p: 'profile' };
      if (MAP[e.key.toLowerCase()]) {
        e.preventDefault();
        navigate(MAP[e.key.toLowerCase()]);
      }
    }
  });
}

// ============================================================
// Hash-based Routing
// ============================================================
function getPageFromHash() {
  const hash = location.hash.replace('#', '').trim().toLowerCase();
  return PAGES[hash] ? hash : 'dashboard';
}

window.addEventListener('hashchange', () => {
  const page = getPageFromHash();
  if (page !== state.currentPage) navigate(page);
});

// ============================================================
// Reveal Animation (IntersectionObserver)
// ============================================================
function initRevealObserver() {
  if (!window.IntersectionObserver) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============================================================
// App Initialization
// ============================================================
function init() {
  // Bind all nav items
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  // Init subsystems
  initSidebar();
  initKeyboardShortcuts();
  initRainAnimation();

  // Start on the correct page
  const initialPage = getPageFromHash();
  navigate(initialPage);

  // Re-init reveal observer after page renders
  setTimeout(initRevealObserver, 500);

  // Check weather risk level for potential high-risk alert
  setTimeout(() => {
    if (state.riskLevel === 'extreme') {
      showAlertBar('🚨 EXTREME monsoon risk detected in your area. Stay indoors and follow safety guidelines.');
    } else if (state.riskLevel === 'high') {
      showAlertBar('⚠️ HIGH monsoon risk in your area. Review your preparedness plan now.');
    }
  }, 3000);

  console.log('%c🌧️ MonsoonGuard AI — Loaded', 'color:#00c8f0;font-weight:bold;font-size:16px');
  console.log('%cKeyboard shortcuts: Alt+D (Dashboard) · Alt+C (Chat) · Alt+M (Map) · Alt+K (Checklist)', 'color:#94a3b8;font-size:12px');
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
