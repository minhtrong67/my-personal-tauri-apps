import { state, saveWinSize } from './store.js';

export const inTauri = () => !!window.__TAURI_INTERNALS__;
let win = null;
let LogicalSize = null;
let timer = 0;
const MIN = { w: 820, h: 600 };

export async function initWindow() {
  if (!inTauri()) return;
  try {
    const api = await import('@tauri-apps/api/window');
    win = api.getCurrentWindow();
    LogicalSize = api.LogicalSize;
    await applyWindowMode();
    if (state.settings.alwaysOnTop) await win.setAlwaysOnTop(true);
    await win.onResized(() => {
      clearTimeout(timer);
      timer = setTimeout(saveSize, 400);
    });
  } catch (e) {
    console.warn('window init failed', e);
  } finally {
    try {
      await win?.show();
      await win?.setFocus();
    } catch {
      /* Rust-side safety net will show the window */
    }
  }
}

async function saveSize() {
  if (!win || state.settings.windowMode !== 'remember') return;
  try {
    if ((await win.isMaximized()) || (await win.isMinimized()) || (await win.isFullscreen())) return;
    const sz = (await win.innerSize()).toLogical(await win.scaleFactor());
    saveWinSize({ w: Math.round(sz.width), h: Math.round(sz.height) });
  } catch {
    /* ignore */
  }
}

/** Applies the "remember size" / "always maximized" option (also called when the user switches it). */
export async function applyWindowMode() {
  if (!win) return;
  try {
    if (state.settings.windowMode === 'maximized') {
      await win.maximize();
      return;
    }
    if (await win.isMaximized()) await win.unmaximize();
    const s = state.size;
    if (s) {
      const w = Math.min(Math.max(s.w, MIN.w), screen.availWidth);
      const h = Math.min(Math.max(s.h, MIN.h), screen.availHeight);
      await win.setSize(new LogicalSize(w, h));
      await win.center();
    }
  } catch (e) {
    console.warn('applyWindowMode failed', e);
  }
}

export async function setTitle(title) {
  try {
    await win?.setTitle(title);
  } catch {
    /* ignore */
  }
}

export async function openExternal(url) {
  if (inTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      return await openUrl(url);
    } catch (e) {
      console.warn(e);
    }
  }
  window.open(url, '_blank', 'noopener');
}

export async function setOnTop(v) {
  try {
    await win?.setAlwaysOnTop(!!v);
  } catch {
    /* ignore */
  }
}
