import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Apply the startup window mode, show the window, then track resizes. */
export async function initWindow(getSettings, onSize) {
  if (!isTauri()) return;
  const w = getCurrentWindow();
  const s = getSettings();
  try {
    if (s.windowMode === 'maximized') await w.maximize();
    else if (s.winSize) await w.setSize(new LogicalSize(s.winSize.w, s.winSize.h));
  } catch (e) { console.warn('window init', e); }
  await w.show();

  let timer;
  await w.onResized(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (getSettings().windowMode === 'remember') captureSize(onSize); }, 350);
  });
}

/** Read the current logical size and hand it to the callback (ignored while maximized/minimized). */
export async function captureSize(onSize) {
  if (!isTauri()) return;
  try {
    const w = getCurrentWindow();
    if ((await w.isMaximized()) || (await w.isMinimized())) return;
    const [sz, f] = [await w.innerSize(), await w.scaleFactor()];
    onSize({ w: Math.round(sz.width / f), h: Math.round(sz.height / f) });
  } catch (e) { console.warn('captureSize', e); }
}
