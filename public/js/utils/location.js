/**
 * Geolocation utilities — wraps the browser Geolocation API
 * with permission checking and fallback.
 */

/**
 * Gets the user's current position.
 * @returns {Promise<{lat: number, lon: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
  });
}

/**
 * Reverse-geocodes lat/lon to a human-readable place name using Nominatim.
 * Falls back to "lat, lon" string if the request fails.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'MonsoonGuardAI/1.0' },
    });
    if (!res.ok) throw new Error('Nominatim request failed');
    const data = await res.json();
    const a = data.address || {};
    // Pick the most meaningful locality name available
    const place =
      a.neighbourhood || a.suburb || a.village || a.town ||
      a.city || a.county || a.state_district || a.state;
    return place ? `${place}` : (data.display_name?.split(',')[0] || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  } catch (_) {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

/**
 * Calculates Haversine distance between two lat/lon points in km.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * (Math.PI / 180); }
