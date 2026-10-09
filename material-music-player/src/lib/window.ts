import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export const win = () => getCurrentWindow();

export async function setFullscreen(on: boolean) {
  await win().setFullscreen(on);
}

let saved: { w: number; h: number } | null = null;

export async function enterMini() {
  const win = getCurrentWindow();
  if (await win.isMaximized()) await win.unmaximize();
  const f = await win.scaleFactor();
  const s = (await win.innerSize()).toLogical(f);
  saved = { w: s.width, h: s.height };
  await win.setMinSize(new LogicalSize(340, 160));
  await win.setSize(new LogicalSize(380, 196));
  await win.setResizable(false);
  await win.setAlwaysOnTop(true);
}

export async function exitMini(alwaysOnTop: boolean) {
  const win = getCurrentWindow();
  await win.setResizable(true);
  await win.setSize(new LogicalSize(saved?.w ?? 1240, saved?.h ?? 800));
  await win.setMinSize(new LogicalSize(900, 600));
  await win.setAlwaysOnTop(alwaysOnTop);
}
