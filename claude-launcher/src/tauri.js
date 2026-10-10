// Mọi lời gọi Tauri đi qua đây
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

export { invoke };
export const appWindow = () => {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
};
export const logicalSize = (w, h) => new LogicalSize(w, h);
