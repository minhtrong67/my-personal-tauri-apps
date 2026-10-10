// Open-Meteo (https://open-meteo.com) - free, no API key. ipwho.is is used for IP geolocation.
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';

async function getJSON(url, { signal, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function searchPlaces(query, lang, signal) {
  const q = new URLSearchParams({ name: query, count: '8', language: lang, format: 'json' });
  const data = await getJSON(`${GEO}?${q}`, { signal });
  return (data.results || []).map((r) => ({
    name: r.name,
    admin: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

// ---- Location -------------------------------------------------------------
/** State of the geolocation permission: 'granted' | 'prompt' | 'denied'. */
export async function geoPermission() {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt'; // Permissions API unavailable in this webview
  }
}

/** Device position. Rejects with {code: 'denied' | 'timeout' | 'unavailable' | 'unsupported'}. */
export function getPosition(timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 'unsupported' });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject({ code: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: false, timeout, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function reverseGeocode(lat, lon, lang) {
  try {
    const q = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: lang });
    const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?${q}`, { timeout: 7000 });
    const name = d.city || d.locality || d.principalSubdivision || '';
    return { name, admin: d.city || d.locality ? d.principalSubdivision || '' : '', country: d.countryName || '' };
  } catch {
    return null;
  }
}

/** Precise location from the OS (asks the user for permission). `name` may be '' if reverse geocoding fails. */
export async function locateByGPS(lang) {
  const c = await getPosition();
  const r = (await reverseGeocode(c.latitude, c.longitude, lang)) || { name: '', admin: '', country: '' };
  return { ...r, lat: c.latitude, lon: c.longitude };
}

const IP_PROVIDERS = [
  async () => {
    const d = await getJSON('https://ipwho.is/', { timeout: 7000 });
    if (d.success === false || d.latitude == null) throw new Error('ipwho');
    return { name: d.city || d.region || d.country, admin: d.city ? d.region || '' : '', country: d.country || '', lat: d.latitude, lon: d.longitude };
  },
  async () => {
    const d = await getJSON('https://get.geojs.io/v1/ip/geo.json', { timeout: 7000 });
    if (!d.latitude) throw new Error('geojs');
    return { name: d.city || d.region || d.country, admin: d.city ? d.region || '' : '', country: d.country || '', lat: +d.latitude, lon: +d.longitude };
  },
  async () => {
    const d = await getJSON('https://ipapi.co/json/', { timeout: 7000 });
    if (!d.latitude) throw new Error('ipapi');
    return { name: d.city || d.region || d.country_name, admin: d.city ? d.region || '' : '', country: d.country_name || '', lat: d.latitude, lon: d.longitude };
  },
];

/** Approximate (city-level) location from the IP address; tries several providers. */
export async function locateByIP() {
  for (const p of IP_PROVIDERS) {
    try {
      return await p();
    } catch {
      /* try next provider */
    }
  }
  throw new Error('ip location failed');
}

export const unitsKey = (s) => `${s.tempUnit}-${s.windUnit}`;

export async function fetchWeather(place, settings) {
  const common = { latitude: place.lat, longitude: place.lon, timezone: 'auto' };
  const wp = new URLSearchParams({
    ...common,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day,visibility,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum',
    forecast_days: '7',
    temperature_unit: settings.tempUnit === 'f' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: settings.windUnit,
    precipitation_unit: settings.tempUnit === 'f' ? 'inch' : 'mm',
  });
  const ap = new URLSearchParams({ ...common, current: 'us_aqi,pm2_5,pm10' });

  const [fc, aq] = await Promise.allSettled([getJSON(`${FORECAST}?${wp}`), getJSON(`${AIR}?${ap}`)]);
  if (fc.status !== 'fulfilled') throw fc.reason;
  return normalize(place, fc.value, aq.status === 'fulfilled' ? aq.value : null, settings);
}

function normalize(place, f, aq, settings) {
  const c = f.current;
  const h = f.hourly;
  const d = f.daily;
  const hourKey = c.time.slice(0, 13) + ':00';
  let idx = h.time.indexOf(hourKey);
  if (idx < 0) idx = 0;

  const hourly = [];
  for (let i = idx; i < Math.min(idx + 24, h.time.length); i++) {
    hourly.push({
      time: h.time[i],
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      isDay: h.is_day[i] === 1,
      pop: h.precipitation_probability?.[i] ?? 0,
    });
  }
  const daily = d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    max: d.temperature_2m_max[i],
    min: d.temperature_2m_min[i],
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
    uvMax: d.uv_index_max?.[i],
    pop: d.precipitation_probability_max?.[i] ?? 0,
    precipSum: d.precipitation_sum?.[i] ?? 0,
  }));

  return {
    place,
    units: settings.tempUnit + settings.windUnit,
    tempUnit: settings.tempUnit,
    windUnit: settings.windUnit,
    fetchedAt: Date.now(),
    utcOffset: f.utc_offset_seconds || 0,
    now: {
      time: c.time,
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      cloud: c.cloud_cover,
      pressure: c.pressure_msl,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      gust: c.wind_gusts_10m,
      precip: c.precipitation,
      visibility: h.visibility?.[idx] ?? null, // metres
      uv: h.uv_index?.[idx] ?? null,
    },
    hourly,
    daily,
    aqi: aq?.current ? { us: aq.current.us_aqi, pm25: aq.current.pm2_5, pm10: aq.current.pm10 } : null,
  };
}
