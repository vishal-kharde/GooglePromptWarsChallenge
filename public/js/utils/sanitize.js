/**
 * Client-side sanitization using DOMPurify.
 * All AI-generated content must be sanitized before DOM insertion.
 */

/**
 * Sanitizes HTML string using DOMPurify.
 * Only allows safe tags — no script, no event handlers.
 * @param {string} dirty
 * @returns {string} Safe HTML
 */
export function sanitizeHtml(dirty) {
  if (typeof DOMPurify === 'undefined') {
    // Fallback: strip all HTML
    return dirty.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','h2','h3','h4','h5','blockquote','code','pre','a','span','div'],
    ALLOWED_ATTR: ['href','target','rel','class'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORCE_BODY: false,
  });
}

/**
 * Converts markdown to sanitized HTML using marked + DOMPurify.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToSafeHtml(markdown) {
  if (!markdown) return '';
  try {
    if (typeof marked !== 'undefined') {
      // Configure marked for safe rendering
      marked.use({ breaks: true, gfm: true });
      const html = marked.parse(markdown);
      return sanitizeHtml(html);
    }
    // Fallback: basic line breaks
    return sanitizeHtml(markdown.replace(/\n/g, '<br>'));
  } catch (e) {
    return sanitizeHtml(markdown);
  }
}

/**
 * Escapes a string for safe insertion as text content (not HTML).
 * @param {string} str
 * @returns {string}
 */
export function escapeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates and clamps a number within bounds.
 */
export function clampNumber(val, min, max, fallback = 0) {
  const n = parseFloat(val);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
