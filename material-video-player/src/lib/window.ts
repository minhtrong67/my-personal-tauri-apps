import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

let saved: { w: number; h: number } | null = null;

export const win = () => getCurrentWindow();

export async function setFullscreen(on: boolean) {
  await win().setFullscreen(on);
}

export async function enterMini() {
  const w = win();
  if (await w.isFullscreen()) await w.setFullscreen(false);
  if (await w.isMaximized()) await w.unmaximize();
  const f = await w.scaleFactor();
  const s = (await w.innerSize()).toLogical(f);
  saved = { w: s.width, h: s.height };
  await w.setMinSize(new LogicalSize(320, 180));
  await w.setSize(new LogicalSize(480, 270));
  await w.setAlwaysOnTop(true);
}

export async function exitMini(alwaysOnTop: boolean) {
  const w = win();
  await w.setSize(new LogicalSize(saved?.w ?? 1280, saved?.h ?? 780));
  await w.setMinSize(new LogicalSize(800, 500));
  await w.setAlwaysOnTop(alwaysOnTop);
}
