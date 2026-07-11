/**
 * i18n utility — detects browser language and maps to supported languages.
 */

export const LANGUAGES = [
  { code: 'English',   label: 'English',    native: 'English' },
  { code: 'Hindi',     label: 'Hindi',      native: 'हिन्दी' },
  { code: 'Bengali',   label: 'Bengali',    native: 'বাংলা' },
  { code: 'Tamil',     label: 'Tamil',      native: 'தமிழ்' },
  { code: 'Telugu',    label: 'Telugu',     native: 'తెలుగు' },
  { code: 'Marathi',   label: 'Marathi',    native: 'मराठी' },
  { code: 'Gujarati',  label: 'Gujarati',   native: 'ગુજરાતી' },
  { code: 'Kannada',   label: 'Kannada',    native: 'ಕನ್ನಡ' },
  { code: 'Malayalam', label: 'Malayalam',  native: 'മലയാളം' },
  { code: 'Odia',      label: 'Odia',       native: 'ଓଡ଼ିଆ' },
  { code: 'Punjabi',   label: 'Punjabi',    native: 'ਪੰਜਾਬੀ' },
  { code: 'Urdu',      label: 'Urdu',       native: 'اردو' },
  { code: 'Assamese',  label: 'Assamese',   native: 'অসমীয়া' },
  { code: 'Nepali',    label: 'Nepali',     native: 'नेपाली' },
];

const BROWSER_LANG_MAP = {
  'en': 'English', 'hi': 'Hindi', 'bn': 'Bengali',
  'ta': 'Tamil',   'te': 'Telugu', 'mr': 'Marathi',
  'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam',
  'or': 'Odia',    'pa': 'Punjabi', 'ur': 'Urdu',
  'as': 'Assamese', 'ne': 'Nepali',
};

/**
 * Detects browser language and returns the closest supported language code.
 * @returns {string} Language code like 'English', 'Hindi', etc.
 */
export function detectBrowserLanguage() {
  const langs = navigator.languages || [navigator.language || 'en'];
  for (const lang of langs) {
    const base = lang.split('-')[0].toLowerCase();
    if (BROWSER_LANG_MAP[base]) return BROWSER_LANG_MAP[base];
  }
  return 'English';
}

/**
 * Returns a language dropdown HTML options string.
 * @param {string} selected
 */
export function getLanguageOptions(selected = 'English') {
  return LANGUAGES.map(l =>
    `<option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${l.native} — ${l.label}</option>`
  ).join('');
}
