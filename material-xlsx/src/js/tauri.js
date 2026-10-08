// Thin wrapper around the Tauri global API, with browser fallbacks so the UI also runs in a plain browser.
import { bytesToBase64, base64ToBytes } from "./io.js";

const T = window.__TAURI__;
export const isTauri = !!T;
export const basename = (p) => String(p).split(/[\\/]/).pop();

export async function readFile(path) { return base64ToBytes(await T.core.invoke("read_file", { path })); }
export async function writeFile(path, bytes) { await T.core.invoke("write_file", { path, data: bytesToBase64(bytes) }); }

export const XLSX_FILTER = [{ name: "Excel Workbook", extensions: ["xlsx"] }];
export const OPEN_FILTER = [{ name: "Excel / CSV", extensions: ["xlsx", "csv", "tsv", "txt"] }];
export const CSV_FILTER = [{ name: "CSV", extensions: ["csv"] }];

let fileInput = null;
function browserPick(accept) {
  return new Promise((resolve) => {
    if (!fileInput) { fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.style.display = "none"; document.body.appendChild(fileInput); }
    fileInput.accept = accept; fileInput.value = "";
    fileInput.onchange = async () => { const f = fileInput.files[0]; resolve(f ? { path: null, name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null); };
    fileInput.click();
  });
}

// Returns {path, name, bytes} or null
export async function openFileDialog() {
  if (!T) return browserPick(".xlsx,.csv,.tsv,.txt");
  const path = await T.dialog.open({ multiple: false, filters: OPEN_FILTER });
  if (!path) return null;
  return { path, name: basename(path), bytes: await readFile(path) };
}
export async function openPath(path) { return { path, name: basename(path), bytes: await readFile(path) }; }

// Returns {path, name} or null (cancelled)
export async function saveFileDialog(defaultName, bytes, filters, existingPath = null) {
  if (!T) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes])); a.download = defaultName; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { path: null, name: defaultName };
  }
  let p = existingPath;
  if (!p) { p = await T.dialog.save({ defaultPath: defaultName, filters }); if (!p) return null; }
  await writeFile(p, bytes);
  return { path: p, name: basename(p) };
}

export async function clipboardRead() {
  if (T) { try { return await T.core.invoke("read_clipboard"); } catch { /* fall through */ } }
  try { return await navigator.clipboard.readText(); } catch { return ""; }
}
export async function clipboardWrite(text) {
  if (T) { try { await T.core.invoke("write_clipboard", { text }); return; } catch { /* fall through */ } }
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

export function currentWindow() { return T && T.window ? T.window.getCurrentWindow() : null; }
export async function setWindowTitle(title) { const w = currentWindow(); if (w) { try { await w.setTitle(title); } catch { /* permission */ } } }
export async function appVersion() { try { return await T.app.getVersion(); } catch { return "1.0.0"; } }
export async function launchFile() { if (!T) return null; try { return await T.core.invoke("get_launch_file"); } catch { return null; } }
export function listen(ev, cb) { return T && T.event ? T.event.listen(ev, cb) : Promise.resolve(() => {}); }
export async function revealPath(path) { if (T) { try { await T.core.invoke("reveal_file", { path }); } catch { /* ignore */ } } }
export async function setFullscreen(on) { const w = currentWindow(); if (w) { try { await w.setFullscreen(on); } catch { /* permission */ } } else if (on) { try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ } } else if (document.fullscreenElement) document.exitFullscreen(); }
export async function isFullscreen() { const w = currentWindow(); if (w) { try { return await w.isFullscreen(); } catch { return false; } } return !!document.fullscreenElement; }
export async function showWindow() { const w = currentWindow(); if (w) { try { await w.show(); } catch { /* already visible */ } } }
