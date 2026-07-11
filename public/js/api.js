/**
 * API client — all fetch calls to the backend.
 * Centralizes error handling, loading states, and retry logic.
 */

const BASE = ''; // Same origin

/** @type {Map<string, AbortController>} */
const _controllers = new Map();

/**
 * Core fetch wrapper with timeout and error normalization.
 * @param {string} path
 * @param {object} [opts]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
async function request(path, opts = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  _controllers.set(path, controller);

  try {
    const res = await fetch(BASE + path, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      const err = new Error(errData.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data   = errData;
      throw err;
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    _controllers.delete(path);
  }
}

/**
 * Cancels an in-flight request by path.
 */
export function cancelRequest(path) {
  _controllers.get(path)?.abort();
}

// ============================================================
// API Methods
// ============================================================

export const api = {
  /** GET /api/health */
  health: () => request('/api/health'),

  /** GET /api/weather */
  weather: {
    byCity: (city) => request(`/api/weather?city=${encodeURIComponent(city)}`),
    byCoords: (lat, lon) => request(`/api/weather?lat=${lat}&lon=${lon}`),
  },

  /** AI endpoints */
  ai: {
    /** POST /api/ai/plan — generate preparedness plan */
    plan: (profile) => request('/api/ai/plan', {
      method: 'POST',
      body: JSON.stringify({ profile }),
    }, 60000),

    /**
     * POST /api/ai/chat — streaming chat
     * Returns a ReadableStream via fetch body
     */
    async chat(message, history, language, city) {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message, history, language, city }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Chat failed: ${res.status}`);
      }
      return res; // Return raw response for SSE streaming
    },

    /** POST /api/ai/checklist */
    checklist: (profile) => request('/api/ai/checklist', {
      method: 'POST',
      body: JSON.stringify({ profile }),
    }, 45000),

    /** POST /api/ai/travel */
    travel: (data) => request('/api/ai/travel', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 60000),

    /** POST /api/ai/recovery */
    recovery: (data) => request('/api/ai/recovery', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 60000),

    /** POST /api/ai/risk */
    risk: (weatherData, city, language) => request('/api/ai/risk', {
      method: 'POST',
      body: JSON.stringify({ weatherData, city, language }),
    }, 30000),

    /** GET /api/ai/quick-actions */
    quickActions: (language = 'English') =>
      request(`/api/ai/quick-actions?language=${encodeURIComponent(language)}`),
  },

  /** Shelters */
  shelters: {
    getAll: () => request('/api/shelters'),
    getNearest: (lat, lon, limit = 20) =>
      request(`/api/shelters?lat=${lat}&lon=${lon}&limit=${limit}`),
  },

  /** Checklist sync */
  checklist: {
    get: (sessionId) => request(`/api/checklist/${sessionId}`),
    save: (sessionId, items) => request('/api/checklist', {
      method: 'POST',
      body: JSON.stringify({ sessionId, items }),
    }),
    toggleItem: (sessionId, itemId, completed) =>
      request(`/api/checklist/${sessionId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
  },
};

/**
 * Reads an SSE stream from a fetch Response.
 * Calls onChunk(text) for each data chunk, onDone() when complete.
 *
 * @param {Response} res
 * @param {Function} onChunk
 * @param {Function} [onDone]
 * @param {Function} [onError]
 */
export async function readSSEStream(res, onChunk, onDone, onError) {
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.error) {
            onError?.(new Error(data.error));
            return;
          }
          if (data.done) {
            onDone?.(data.fullText);
            return;
          }
          if (data.chunk) {
            onChunk(data.chunk);
          }
        } catch (_) { /* ignore parse errors */ }
      }
    }
    onDone?.('');
  } catch (err) {
    onError?.(err);
  } finally {
    reader.releaseLock();
  }
}
