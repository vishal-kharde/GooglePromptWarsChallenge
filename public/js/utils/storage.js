/**
 * LocalStorage wrapper with JSON serialization, error handling, and TTL support.
 */

const PREFIX = 'mg_'; // monsoonguard prefix

export const storage = {
  /**
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlSeconds] - Optional expiry in seconds
   */
  set(key, value, ttlSeconds) {
    try {
      const item = {
        v: value,
        t: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      };
      localStorage.setItem(PREFIX + key, JSON.stringify(item));
    } catch (e) {
      console.warn('Storage write failed:', e.message);
    }
  },

  /**
   * @param {string} key
   * @param {any} [defaultValue]
   * @returns {any}
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return defaultValue;
      const item = JSON.parse(raw);
      if (item.t && Date.now() > item.t) {
        localStorage.removeItem(PREFIX + key);
        return defaultValue;
      }
      return item.v;
    } catch (e) {
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};
