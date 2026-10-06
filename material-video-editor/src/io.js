// Bridge to Tauri (native dialogs, chunked file writing, optional FFmpeg) with browser fallbacks.
const T = window.__TAURI__ || null;
export const inTauri = !!T;
const invoke = T ? T.core.invoke : null;

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export async function pickSavePath(defaultName, filters) {
  if (!T) return defaultName; // browser: the file is downloaded under this name
  const p = await T.dialog.save({ defaultPath: defaultName, filters });
  return p ? String(p) : null;
}

export async function pickOpenPath(filters) {
  if (!T) return null;
  const p = await T.dialog.open({ multiple: false, directory: false, filters });
  return p ? String(p) : null;
}

export async function readText(path) {
  return invoke('read_text_file', { path });
}

/** Writes a Blob to disk in 8 MB chunks (or triggers a download in the browser). */
export async function writeBlob(path, blob, onProgress) {
  if (!T) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(path).split(/[\\/]/).pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return;
  }
  const CH = 8 * 1024 * 1024;
  const pathHeader = b64(path);
  if (blob.size === 0) {
    await invoke('save_chunk', new Uint8Array(0), { headers: { 'x-path': pathHeader, 'x-mode': 'create' } });
    return;
  }
  for (let off = 0; off < blob.size; off += CH) {
    const buf = new Uint8Array(await blob.slice(off, off + CH).arrayBuffer());
    await invoke('save_chunk', buf, { headers: { 'x-path': pathHeader, 'x-mode': off === 0 ? 'create' : 'append' } });
    if (onProgress) onProgress(Math.min(1, (off + CH) / blob.size));
  }
}

export async function writeText(path, text) {
  return writeBlob(path, new Blob([text], { type: 'application/json' }));
}

export async function ffmpegAvailable() {
  if (!T) return false;
  try { return !!(await invoke('ffmpeg_available')); } catch { return false; }
}
export const tempPath = (name) => invoke('temp_path', { name });
export const removeTemp = (path) => invoke('remove_temp', { path }).catch(() => {});
export const ffmpegConvert = (input, output) => invoke('ffmpeg_convert', { input, output });

export function currentWindow() {
  return T ? T.window.getCurrentWindow() : null;
}
