const K = {
  settings: 'wx.settings.v1',
  places: 'wx.places.v1',
  active: 'wx.active.v1',
  size: 'wx.winsize.v1',
  cache: 'wx.cache.v1',
};

const read = (k, fb) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full / blocked: ignore */
  }
};

const defaults = () => ({
  lang: (navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en',
  theme: 'system', // light | dark | system
  seed: '#0B57D0',
  tempUnit: 'c', // c | f
  windUnit: 'kmh', // kmh | ms | mph
  windowMode: 'remember', // remember | maximized
  effects: true,
  autoRefresh: true,
  alwaysOnTop: false,
});

export const state = {
  settings: { ...defaults(), ...read(K.settings, {}) },
  places: read(K.places, []),
  activeId: read(K.active, null),
  size: read(K.size, null),
};

export const placeId = (lat, lon) => `${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;

export function saveSettings(patch) {
  Object.assign(state.settings, patch);
  write(K.settings, state.settings);
}
export function savePlaces() {
  write(K.places, state.places);
}
export function setActive(id) {
  state.activeId = id;
  write(K.active, id);
}
export const getActive = () => state.places.find((p) => p.id === state.activeId) || null;

export function upsertPlace(p) {
  const i = state.places.findIndex((x) => x.id === p.id);
  if (i >= 0) state.places[i] = { ...state.places[i], ...p };
  else state.places.unshift(p);
  if (state.places.length > 15) state.places.length = 15;
  savePlaces();
}
export function removePlace(id) {
  state.places = state.places.filter((p) => p.id !== id);
  savePlaces();
}
export function saveWinSize(size) {
  state.size = size;
  write(K.size, size);
}

// Weather cache (stale-while-revalidate + offline fallback). Keep the last 12 entries.
export function cacheGet(key) {
  return read(K.cache, {})[key] || null;
}
export function cacheSet(key, model) {
  const all = read(K.cache, {});
  all[key] = model;
  const keys = Object.keys(all).sort((a, b) => (all[b].fetchedAt || 0) - (all[a].fetchedAt || 0));
  keys.slice(12).forEach((k) => delete all[k]);
  write(K.cache, all);
}
