// Weather Adapter «Adapter»: the only code that calls the weather service (Open-Meteo, no key needed).
// Cached for 30 minutes per city. If the service is down or the city is unknown, it falls back
// to the monthly average high FOR THAT CITY (approximate climate normals, Jan–Dec) and says so
// (NFR-06: the app keeps working). A trip to Paris is never planned with Cairo's weather; a city
// not in the table gets Cairo's average and the note says so.
const CAIRO_MONTHLY_HIGH = [19, 21, 24, 28, 32, 34, 35, 35, 33, 30, 25, 21];
const CLIMATE = [
  [['cairo', 'giza', 'new cairo', '6th of october'], CAIRO_MONTHLY_HIGH],
  [['alexandria'], [18, 19, 21, 24, 27, 29, 30, 31, 30, 28, 24, 20]],
  [['sahel', 'north coast', 'alamein', 'marsa matrouh', 'matruh'], [18, 19, 20, 23, 26, 28, 29, 30, 29, 27, 23, 20]],
  [['hurghada', 'gouna', 'safaga', 'marsa alam'], [21, 22, 24, 28, 31, 33, 34, 34, 32, 29, 26, 22]],
  [['sharm', 'dahab', 'nuweiba', 'taba'], [22, 23, 26, 30, 34, 36, 37, 37, 35, 31, 27, 23]],
  [['luxor'], [23, 25, 30, 35, 39, 41, 41, 41, 39, 35, 29, 24]],
  [['aswan'], [23, 26, 30, 35, 39, 42, 42, 41, 40, 36, 29, 25]],
  [['dubai', 'abu dhabi'], [24, 25, 29, 33, 38, 40, 41, 41, 39, 35, 30, 26]],
  [['riyadh'], [20, 23, 28, 33, 39, 42, 43, 43, 40, 34, 27, 22]],
  [['jeddah', 'mecca', 'makkah'], [29, 30, 32, 34, 36, 37, 38, 38, 36, 35, 32, 30]],
  [['beirut'], [17, 17, 19, 22, 25, 28, 30, 31, 29, 27, 23, 19]],
  [['istanbul'], [9, 9, 12, 16, 21, 26, 28, 29, 25, 20, 15, 11]],
  [['athens'], [13, 14, 16, 20, 25, 30, 33, 33, 29, 23, 19, 15]],
  [['rome'], [12, 14, 16, 19, 24, 28, 31, 31, 27, 22, 16, 13]],
  [['barcelona'], [14, 15, 17, 19, 22, 26, 28, 29, 26, 22, 17, 14]],
  [['madrid'], [10, 12, 16, 18, 22, 28, 32, 31, 26, 19, 13, 10]],
  [['paris'], [7, 9, 13, 16, 20, 23, 25, 25, 21, 16, 10, 7]],
  [['london'], [8, 9, 11, 14, 17, 20, 23, 22, 19, 15, 11, 8]],
  [['amsterdam'], [6, 7, 10, 14, 18, 20, 22, 22, 19, 15, 10, 7]],
  [['berlin', 'munich'], [3, 5, 9, 15, 19, 22, 25, 24, 19, 14, 8, 4]],
  [['new york'], [4, 6, 10, 17, 22, 27, 29, 28, 24, 18, 12, 6]],
  [['tokyo'], [10, 11, 14, 19, 23, 26, 30, 31, 27, 22, 17, 12]],
];
const climateFor = (city) => { const c = String(city || '').toLowerCase(); const hit = CLIMATE.find(([names]) => names.some((n) => c.includes(n))); return hit ? hit[1] : null; };
const CODES = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm' };

function fallback(date, reason, city) {
  const m = new Date(`${date}T12:00:00Z`).getUTCMonth();
  const table = climateFor(city);
  const high = (table || CAIRO_MONTHLY_HIGH)[m];
  const note = city && !table ? `${reason} · no climate data for ${city}, Cairo average used` : reason;
  return { date, ...(city ? { place: city } : {}), tempC: high, high, low: high - 9, condition: 'Typical for the season', source: 'estimate', note };
}

// mode 'estimate' (WEATHER_MODE=estimate): never call the service — the live demo then gives the same
// looks on every run, and the screen still says “estimate”.
function weatherAdapter({ fetchImpl = (...a) => fetch(...a), ttlMs = 30 * 60 * 1000, now = () => Date.now(), mode = process.env.WEATHER_MODE } = {}) {
  const cache = new Map();
  async function forecastFor(city) {
    const key = city.toLowerCase();
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.data;
    const geo = await (await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(4000) })).json();
    const place = geo.results && geo.results[0];
    if (!place) throw new Error('city not found');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}`
      + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=16';
    const data = await (await fetchImpl(url, { signal: AbortSignal.timeout(4000) })).json();
    if (!data.daily) throw new Error('no forecast');
    const result = { place: place.name, data };
    cache.set(key, { at: now(), data: result });
    return result;
  }
  return {
    // IWeather: temperature and forecast for a city on a date (YYYY-MM-DD).
    async forDate(city, date) {
      if (!city) return fallback(date, 'No city in your profile');
      if (mode === 'estimate') return fallback(date, 'Seasonal estimate (demo mode)', city);
      try {
        const { place, data } = await forecastFor(city);
        const i = data.daily.time.indexOf(date);
        if (i < 0) return fallback(date, 'More than 16 days ahead', city);
        const isToday = i === 0 && data.current;
        const high = Math.round(data.daily.temperature_2m_max[i]);
        return {
          date, place,
          tempC: isToday ? Math.round(data.current.temperature_2m) : high,
          high, low: Math.round(data.daily.temperature_2m_min[i]),
          condition: CODES[data.daily.weather_code[i]] || 'Mixed', source: 'Open-Meteo',
        };
      } catch (e) {
        return fallback(date, 'Weather service unavailable', city);
      }
    },
  };
}

module.exports = { weatherAdapter, fallback, climateFor, CAIRO_MONTHLY_HIGH };
