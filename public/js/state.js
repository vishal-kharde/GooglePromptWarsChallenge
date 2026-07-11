/**
 * Global application state — reactive store.
 * Components read from state; mutations go through actions.
 */

import { storage } from './utils/storage.js';
import { detectBrowserLanguage } from './utils/i18n.js';

/** @type {Map<string, Function[]>} */
const _listeners = new Map();

/** Default profile */
const DEFAULT_PROFILE = {
  city:         'Mumbai',
  adults:       2,
  children:     0,
  elderly:      0,
  disabled:     0,
  housingType:  'apartment',
  floor:        'ground floor',
  hasVehicle:   false,
  medicalNeeds: '',
  pets:         '',
  language:     detectBrowserLanguage(),
  financialLevel: 'middle-income',
  name:         '',
  phone:        '',
};

/** Application state */
export const state = {
  // User
  profile:        storage.get('profile', DEFAULT_PROFILE),
  sessionId:      storage.get('sessionId', null),

  // Weather
  weather:        null,
  weatherCity:    null,
  weatherLoading: false,

  // Risk
  riskLevel: 'moderate',

  // Current page
  currentPage: 'dashboard',

  // Checklist
  checklist: storage.get('checklist', []),

  // Chat
  chatHistory: storage.get('chatHistory', []),

  // Community reports (cached)
  reports: [],

  // Shelters
  shelters: [],

  // Alerts
  activeAlerts: [],

  // UI
  sidebarOpen: false,
};

/**
 * Subscribes to state changes.
 * @param {string} key - State key to watch
 * @param {Function} fn - Callback(newValue, oldValue)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, fn) {
  if (!_listeners.has(key)) _listeners.set(key, []);
  _listeners.get(key).push(fn);
  return () => {
    const fns = _listeners.get(key) || [];
    _listeners.set(key, fns.filter(f => f !== fn));
  };
}

/**
 * Updates state and notifies subscribers.
 * @param {string} key
 * @param {any} value
 */
export function setState(key, value) {
  const old = state[key];
  state[key] = value;
  (_listeners.get(key) || []).forEach(fn => fn(value, old));
}

/**
 * Saves profile to state and localStorage.
 * @param {object} profileData
 */
export function saveProfile(profileData) {
  const merged = { ...state.profile, ...profileData };
  setState('profile', merged);
  storage.set('profile', merged);
}

/**
 * Saves checklist to state and localStorage.
 * @param {Array} items
 */
export function saveChecklist(items) {
  setState('checklist', items);
  storage.set('checklist', items);
}

/**
 * Appends a chat message.
 * @param {{ role: 'user'|'assistant', content: string }} msg
 */
export function appendChatMessage(msg) {
  const history = [...state.chatHistory, { ...msg, timestamp: Date.now() }];
  // Keep last 50 messages
  const trimmed = history.slice(-50);
  setState('chatHistory', trimmed);
  storage.set('chatHistory', trimmed);
}

export function clearChatHistory() {
  setState('chatHistory', []);
  storage.remove('chatHistory');
}

export function setWeather(data, city) {
  setState('weather', data);
  setState('weatherCity', city);
  if (data?.current?.risk_level) {
    setState('riskLevel', data.current.risk_level);
  }
}

/**
 * Initializes a session ID if not already set.
 */
export function ensureSessionId() {
  if (!state.sessionId) {
    const id = 'mg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    setState('sessionId', id);
    storage.set('sessionId', id);
  }
  return state.sessionId;
}

export { DEFAULT_PROFILE };
