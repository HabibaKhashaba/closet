// Weather Adapter «Adapter»: the only code that calls the weather service (Open-Meteo, no key needed).
// Cached for 30 minutes per city. If the service is down or the city is unknown, it falls back
// to the monthly average for Cairo and says so (NFR-06: the app keeps working).
const CAIRO_MONTHLY_HIGH = [19, 21, 24, 28, 32, 34, 35, 35, 33, 30, 25, 21];
const CODES = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm' };

function fallback(date, reason) {
  const m = new Date(`${date}T12:00:00Z`).getUTCMonth();
  const high = CAIRO_MONTHLY_HIGH[m];
  return { date, tempC: high, high, low: high - 9, condition: 'Typical for the season', source: 'estimate', note: reason };
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
      if (mode === 'estimate') return fallback(date, 'Seasonal estimate (demo mode)');
      try {
        const { place, data } = await forecastFor(city);
        const i = data.daily.time.indexOf(date);
        if (i < 0) return fallback(date, 'More than 16 days ahead');
        const isToday = i === 0 && data.current;
        const high = Math.round(data.daily.temperature_2m_max[i]);
        return {
          date, place,
          tempC: isToday ? Math.round(data.current.temperature_2m) : high,
          high, low: Math.round(data.daily.temperature_2m_min[i]),
          condition: CODES[data.daily.weather_code[i]] || 'Mixed', source: 'Open-Meteo',
        };
      } catch (e) {
        return fallback(date, 'Weather service unavailable');
      }
    },
  };
}

module.exports = { weatherAdapter, fallback, CAIRO_MONTHLY_HIGH };
