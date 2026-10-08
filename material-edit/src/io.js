// Bridge to Tauri (native dialogs, files, project library, media server, FFmpeg) with browser fallbacks.
const T = window.__TAURI__ || null;
export const inTauri = !!T;
const invoke = T ? T.core.invoke : null;

const b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export const MEDIA_EXTS = {
  video: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'ogv', '3gp'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'],
};

/* ---------------- dialogs ---------------- */
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

/** Native folder picker (desktop only). */
export async function pickDirectory(defaultPath) {
  if (!T) return null;
  const p = await T.dialog.open({ directory: true, multiple: false, defaultPath: defaultPath || undefined });
  return p ? String(p) : null;
}

/** true when a file already exists at `path` (desktop). */
export async function fileExists(path) {
  if (!T) return false;
  try { return (await invoke('file_size', { path })) >= 0; } catch { return false; }
}

/** Native multi-file picker for media. Returns an array of paths (Tauri only). */
export async function pickMediaPaths(single = false) {
  if (!T) return [];
  const all = [...MEDIA_EXTS.video, ...MEDIA_EXTS.audio, ...MEDIA_EXTS.image];
  const filters = single
    ? [{ name: 'Media', extensions: all }]
    : [
      { name: 'Media', extensions: all },
      { name: 'Video', extensions: MEDIA_EXTS.video },
      { name: 'Audio', extensions: MEDIA_EXTS.audio },
      { name: 'Images', extensions: MEDIA_EXTS.image },
    ];
  const p = await T.dialog.open({ multiple: !single, directory: false, filters });
  if (!p) return [];
  return (Array.isArray(p) ? p : [p]).map(String);
}

export async function readText(path) {
  return invoke('read_text_file', { path });
}

/* ---------------- file writing ---------------- */
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

/**
 * Sequential/positional file writer used while exporting, so the finished video never has to sit in RAM.
 * `write(position, bytes)` queues the write; `drain()` waits until everything reached the disk.
 * In the browser it collects the chunks and `finish()` returns them as a Blob.
 */
export function createFileWriter(path, type = 'video/mp4') {
  const ph = T ? b64(path) : '';
  let chain = Promise.resolve();
  let pending = 0;
  let failed = null;
  const parts = []; // browser fallback: [position, bytes]
  const ready = T ? invoke('save_chunk', new Uint8Array(0), { headers: { 'x-path': ph, 'x-mode': 'create' } }) : Promise.resolve();
  return {
    get pending() { return pending; },
    write(position, bytes) {
      const copy = bytes.slice(); // the muxer may reuse its buffer
      pending += copy.byteLength;
      if (!T) { parts.push([position, copy]); pending -= copy.byteLength; return; }
      chain = chain.then(async () => {
        if (failed) return;
        try {
          await ready;
          await invoke('save_chunk', copy, { headers: { 'x-path': ph, 'x-mode': 'at', 'x-pos': String(position) } });
        } catch (e) { failed = e; } finally { pending -= copy.byteLength; }
      });
    },
    /** Drops everything still queued (cancelled/failed export). */
    abort() { failed = failed || new Error('aborted'); },
    async drain() {
      await chain;
      if (failed) throw failed;
    },
    /** Browser only: assemble the written parts. */
    blob() {
      const end = parts.reduce((m, [p, b]) => Math.max(m, p + b.byteLength), 0);
      const out = new Uint8Array(end);
      for (const [p, b] of parts) out.set(b, p);
      return new Blob([out], { type });
    },
  };
}

/* ---------------- media files ---------------- */
/** Registers a file with the local media server → { url, size }. */
export const serveFile = (path) => invoke('serve_file', { path });
export const fileSize = (path) => invoke('file_size', { path });
/** Shows a file in the OS file manager. */
export const revealFile = (path) => (T ? invoke('reveal_file', { path }) : Promise.resolve());
/** Removes a half-written export. */
export const deleteExport = (path) => (T && path ? invoke('delete_export', { path }).catch(() => {}) : Promise.resolve());

/** Native OS file drops (Tauri). */
export async function onFileDrop({ over, leave, drop }) {
  if (!T || !T.webview) return;
  try {
    await T.webview.getCurrentWebview().onDragDropEvent((e) => {
      const p = e.payload;
      if (p.type === 'enter' || p.type === 'over') over && over();
      else if (p.type === 'drop') { leave && leave(); drop && drop(p.paths || []); } else leave && leave();
    });
  } catch { /* drag & drop events unavailable */ }
}

/* ---------------- project library ---------------- */
const LS_PREFIX = 'mve.proj.';
const lsIds = () => { const ids = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LS_PREFIX)) ids.push(k.slice(LS_PREFIX.length)); } return ids; };

export async function libList() {
  if (T) return invoke('project_list');
  const out = [];
  for (const id of lsIds()) {
    try {
      const v = JSON.parse(localStorage.getItem(LS_PREFIX + id));
      out.push({ id, name: v.name || '', updated: v.updated || 0, duration: v.duration || 0, aspect: v.aspect || '16:9', mediaCount: (v.media || []).length, cover: v.cover || null });
    } catch { /* skip broken entry */ }
  }
  return out.sort((a, b) => b.updated - a.updated);
}
export async function libRead(id) {
  if (T) return invoke('project_read', { id });
  const s = localStorage.getItem(LS_PREFIX + id);
  if (s == null) throw new Error('Project not found');
  return s;
}
export async function libWrite(id, text) {
  if (T) return invoke('project_write', { id, data: text });
  localStorage.setItem(LS_PREFIX + id, text);
}
export async function libDelete(id) {
  if (T) return invoke('project_delete', { id });
  localStorage.removeItem(LS_PREFIX + id);
}

/* ---------------- FFmpeg (optional) ---------------- */
export async function ffmpegAvailable() {
  if (!T) return false;
  try { return !!(await invoke('ffmpeg_available')); } catch { return false; }
}
export const tempPath = (name) => invoke('temp_path', { name });
export const removeTemp = (path) => invoke('remove_temp', { path }).catch(() => {});
export const ffmpegConvert = (input, output) => invoke('ffmpeg_convert', { input, output });

/* ---------------- window ---------------- */
export function currentWindow() {
  return T ? T.window.getCurrentWindow() : null;
}

export async function setWindowFullscreen(on) {
  const w = currentWindow();
  if (w) { try { await w.setFullscreen(on); } catch { /* ignore */ } return; }
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* ignore */ }
}

export async function isWindowFullscreen() {
  const w = currentWindow();
  if (w) { try { return await w.isFullscreen(); } catch { return false; } }
  return !!document.fullscreenElement;
}
