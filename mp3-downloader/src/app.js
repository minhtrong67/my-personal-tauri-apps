"use strict";

const T = window.__TAURI__;
const invoke = T ? T.core.invoke : async () => { throw "Hãy chạy app bằng Tauri (cargo tauri dev)."; };
const listen = T ? T.event.listen : async () => () => {};
const $ = (s, r = document) => r.querySelector(s);
const IS_WINDOWS = /Windows/i.test(navigator.userAgent);

/* ───────────────────────── Cài đặt ───────────────────────── */
const DEFAULTS = { seed: "#6750A4", mode: "auto", quality: "best", outDir: "", crop: true };
const S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem("mp3dl.settings") || "{}")); } catch {}
// v3: thư mục lưu mặc định là Downloads của Windows → bỏ các đường dẫn mặc định cũ (Music\\MP3 Downloader…)
if ((S.ver || 0) < 3) {
  if (!S.outDir || /[\\/](Music|Downloads)[\\/]MP3 Downloader$/i.test(S.outDir)) S.outDir = "";
  S.ver = 3;
}
const save = () => { try { localStorage.setItem("mp3dl.settings", JSON.stringify(S)); } catch {} };

const QUALITIES = [["best", "Tốt nhất"], ["320", "320 kbps"], ["256", "256 kbps"], ["192", "192 kbps"], ["128", "128 kbps"]];
const MODES = [["auto", "Theo hệ thống"], ["light", "Sáng"], ["dark", "Tối"]];
const PRESETS = [
  ["#6750A4", "Tím"], ["#0B6BCB", "Xanh dương"], ["#006A60", "Xanh ngọc"], ["#3F6A1D", "Xanh lá"],
  ["#8A6A00", "Vàng nghệ"], ["#B5451B", "Cam đất"], ["#B8326B", "Hồng"], ["#BA1A1A", "Đỏ"],
];

/* ───────────────────────── Chủ đề Material 3 ───────────────────────── */
const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const darkQuery = matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const { themeFromSourceColor, argbFromHex, hexFromArgb } = window.MCU;
  const theme = themeFromSourceColor(argbFromHex(S.seed));
  const dark = S.mode === "dark" || (S.mode === "auto" && darkQuery.matches);
  const scheme = (dark ? theme.schemes.dark : theme.schemes.light).toJSON();
  const root = document.documentElement;
  for (const [k, v] of Object.entries(scheme)) root.style.setProperty("--md-" + kebab(k), hexFromArgb(v));
  const n = theme.palettes.neutral;
  const tones = dark
    ? { lowest: 6, low: 12, base: 17, high: 22, highest: 27 }
    : { lowest: 100, low: 97, base: 95, high: 93, highest: 91 };
  root.style.setProperty("--md-surface-container-lowest", hexFromArgb(n.tone(tones.lowest)));
  root.style.setProperty("--md-surface-container-low", hexFromArgb(n.tone(tones.low)));
  root.style.setProperty("--md-surface-container", hexFromArgb(n.tone(tones.base)));
  root.style.setProperty("--md-surface-container-high", hexFromArgb(n.tone(tones.high)));
  root.style.setProperty("--md-surface-container-highest", hexFromArgb(n.tone(tones.highest)));
  root.dataset.scheme = dark ? "dark" : "light";
}
darkQuery.addEventListener("change", () => S.mode === "auto" && applyTheme());

/* ───────────────────────── Tiện ích UI ───────────────────────── */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const icon = (id) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "icon");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "#i-" + id);
  s.appendChild(u);
  return s;
};
let toastTimer;
function toast(msg, action) {
  const sb = $("#snackbar");
  $("#snack-text").textContent = msg;
  const ab = $("#snack-action");
  if (action) {
    ab.hidden = false;
    ab.textContent = action.label;
    ab.onclick = () => { action.fn(); sb.classList.remove("show"); };
  } else { ab.hidden = true; ab.onclick = null; }
  sb.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => sb.classList.remove("show"), action ? 7000 : 4500);
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtTime = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");
const baseName = (p) => (p || "").split(/[\\/]/).pop();

function renderRadio(container, options, value, onPick, cls, withIcon = true) {
  container.replaceChildren();
  for (const [val, label] of options) {
    const b = el("button", cls);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(val === value));
    if (withIcon) b.appendChild(icon("check"));
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", () => { onPick(val); renderRadio(container, options, val, onPick, cls, withIcon); });
    container.appendChild(b);
  }
}

/* ───────────────────────── Điều hướng ───────────────────────── */
document.querySelectorAll(".rail-item").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".rail-item").forEach((b) => { b.classList.toggle("active", b === btn); b.toggleAttribute("aria-current", b === btn); });
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + btn.dataset.page));
  })
);

/* ───────────────────────── Trang tải về ───────────────────────── */
let quality = S.quality;
let currentInfo = null;
let previewToken = 0;

const input = $("#url-input");
const dlBtn = $("#download-btn");
const preview = $("#preview");

renderRadio($("#quality-chips"), QUALITIES, quality, (v) => (quality = v), "chip");

const urlsIn = (t) => t.match(/https?:\/\/[^\s]+/g) || [];
const SOURCE_NAMES = { youtube: "YouTube", tiktok: "TikTok", spotify: "Spotify", other: "Khác" };

function artBox(url, cls = "art") {
  const a = el("div", cls);
  if (url) a.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
  else a.appendChild(icon("music"));
  return a;
}

function showPreview(info) {
  currentInfo = info;
  preview.className = "preview";
  preview.hidden = false;
  preview.replaceChildren();
  const body = el("div", "preview-body");
  body.appendChild(el("div", "preview-title", info.title || "(không có tiêu đề)"));
  if (info.artist) body.appendChild(el("div", "body-medium muted", info.artist));
  const tags = el("div", "tags");
  tags.appendChild(el("span", "tag source", SOURCE_NAMES[info.source] || "Khác"));
  if (info.album) tags.appendChild(el("span", "tag", "Album: " + info.album));
  if (info.year) tags.appendChild(el("span", "tag", info.year));
  if (info.duration) tags.appendChild(el("span", "tag", fmtTime(info.duration)));
  body.appendChild(tags);
  if (info.source === "spotify")
    body.appendChild(el("p", "body-small preview-note", "Spotify không cho tải trực tiếp: app sẽ tìm bản âm thanh tương ứng trên YouTube và gắn thông tin, ảnh bìa từ Spotify."));
  preview.append(artBox(info.thumbnail), body);
}

function showPreviewMessage(kind, text) {
  currentInfo = null;
  preview.className = "preview " + kind;
  preview.hidden = false;
  preview.replaceChildren(el("span", "body-medium", text));
}

async function onUrlChange() {
  const urls = urlsIn(input.value);
  dlBtn.disabled = urls.length === 0;
  const token = ++previewToken;
  if (urls.length === 0) { preview.hidden = true; currentInfo = null; return; }
  if (urls.length > 1) { showPreviewMessage("loading", `Sẽ thêm ${urls.length} link vào hàng đợi.`); return; }
  showPreviewMessage("loading", "Đang đọc thông tin bài hát…");
  try {
    const info = await invoke("fetch_info", { url: urls[0] });
    if (token === previewToken) showPreview(info);
  } catch (e) {
    if (token === previewToken) showPreviewMessage("error", String(e));
  }
}
input.addEventListener("input", () => { dlBtn.disabled = urlsIn(input.value).length === 0; debouncedUrl(); });
const debouncedUrl = debounce(onUrlChange, 450);
input.addEventListener("keydown", (e) => e.key === "Enter" && !dlBtn.disabled && dlBtn.click());

$("#paste-btn").addEventListener("click", async () => {
  let text = "";
  try { text = await invoke("read_clipboard"); }                      // đọc clipboard hệ thống qua Rust
  catch { try { text = await navigator.clipboard.readText(); } catch {} }
  text = (text || "").trim();
  if (!text) { toast("Bộ nhớ tạm đang trống hoặc không chứa văn bản."); return; }
  input.value = text;
  input.dispatchEvent(new Event("input"));
  input.focus();
});

/* ───────────────────────── Hàng đợi ───────────────────────── */
const MAX_PARALLEL = 2;
const items = new Map();   // id -> item
const jobMap = new Map();  // jobId (mỗi lần chạy) -> item.id, để bỏ qua sự kiện của lần chạy đã huỷ
const ACTIVE = new Set(["downloading", "converting", "tagging"]);

function addItem(url, info) {
  const id = crypto.randomUUID();
  const item = { id, jobId: null, url, info, quality, stage: "queued", percent: 0, speed: "", eta: "", message: "", file: null };
  items.set(id, item);
  const row = el("div", "item");
  row.dataset.id = id;
  $("#queue").prepend(row);
  buildRow(item, row);
  refreshQueueChrome();
  return item;
}

function buildRow(item, row) {
  row.replaceChildren(
    artBox(item.info && item.info.thumbnail, "art sm"),
    (() => {
      const b = el("div", "item-body");
      b.append(el("div", "item-title"), el("div", "item-sub body-medium"));
      const p = el("div", "progress");
      p.appendChild(el("span"));
      b.appendChild(p);
      return b;
    })(),
    el("div", "item-actions")
  );
  row.dataset.stage = "";
  updateRow(item);
}

function actionBtn(act, ic, label) {
  const b = el("button", "icon-btn");
  b.dataset.act = act;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.appendChild(icon(ic));
  return b;
}

function updateRow(item) {
  const row = $(`.item[data-id="${item.id}"]`);
  if (!row) return;
  row.className = "item " + item.stage;
  $(".item-title", row).textContent = (item.info && item.info.title) || (item.file ? baseName(item.file) : item.url);

  let sub = "";
  switch (item.stage) {
    case "queued": sub = "Đang chờ…"; break;
    case "downloading": {
      const parts = [];
      if (item.percent > 0) parts.push(item.percent.toFixed(0) + "%");
      if (item.speed && !/unknown/i.test(item.speed)) parts.push(item.speed);
      if (item.eta && !/unknown/i.test(item.eta)) parts.push("còn " + item.eta);
      sub = parts.length ? parts.join(" · ") : item.message || "Đang bắt đầu…";
      break;
    }
    case "converting": sub = "Đang chuyển sang MP3 và gắn ảnh bìa…"; break;
    case "tagging": sub = item.message; break;
    case "done": sub = (item.info && item.info.artist ? item.info.artist + " · " : "") + "Đã lưu " + baseName(item.file) + (item.message ? " · " + item.message : ""); break;
    case "error": sub = item.message; break;
    case "cancelled": sub = "Đã huỷ"; break;
  }
  $(".item-sub", row).textContent = sub;

  const prog = $(".progress", row);
  prog.classList.toggle("indeterminate", item.stage === "converting" || item.stage === "tagging" || (item.stage === "downloading" && item.percent === 0));
  $("span", prog).style.width = item.stage === "downloading" && item.percent > 0 ? item.percent + "%" : "";

  if (row.dataset.stage !== item.stage) {
    row.dataset.stage = item.stage;
    const acts = $(".item-actions", row);
    acts.replaceChildren();
    if (item.stage === "done") acts.append(actionBtn("reveal", "folder", "Hiện trong thư mục"), actionBtn("remove", "close", "Xoá khỏi danh sách"));
    else if (item.stage === "error" || item.stage === "cancelled") acts.append(actionBtn("retry", "refresh", "Thử lại"), actionBtn("remove", "close", "Xoá khỏi danh sách"));
    else acts.append(actionBtn("cancel", "close", "Huỷ"));
  }
}

function refreshQueueChrome() {
  $("#queue-empty").hidden = items.size > 0;
  $("#clear-done").hidden = ![...items.values()].some((i) => ["done", "error", "cancelled"].includes(i.stage));
}

async function pump() {
  let running = [...items.values()].filter((i) => ACTIVE.has(i.stage)).length;
  const queued = [...items.values()].filter((i) => i.stage === "queued").reverse(); // cũ nhất trước
  for (const item of queued) {
    if (running >= MAX_PARALLEL) break;
    running++;
    item.stage = "downloading";
    item.percent = 0;
    item.message = "Đang bắt đầu…";
    item.jobId = crypto.randomUUID();
    jobMap.set(item.jobId, item.id);
    updateRow(item);
    invoke("start_download", {
      req: { id: item.jobId, url: item.url, out_dir: S.outDir, quality: item.quality, crop_thumb: S.crop, info: item.info || null },
    }).catch((e) => { item.stage = "error"; item.message = String(e); updateRow(item); refreshQueueChrome(); pump(); });
  }
}

listen("download-progress", ({ payload: p }) => {
  const terminal = ["done", "error", "cancelled"].includes(p.stage);
  const item = items.get(jobMap.get(p.id));
  if (terminal) jobMap.delete(p.id);
  if (!item || item.jobId !== p.id || item.stage === "cancelled") return;
  item.stage = p.stage;
  item.percent = p.percent;
  item.speed = p.speed;
  item.eta = p.eta;
  item.message = p.message;
  if (p.file) item.file = p.file;
  updateRow(item);
  if (p.stage === "done" && p.file) {
    toast("Đã tải xong: " + baseName(p.file).replace(/\.mp3$/i, ""), {
      label: "Hiện",
      fn: () => invoke("reveal_file", { path: p.file }).catch((err) => toast(String(err))),
    });
  }
  if (["done", "error", "cancelled"].includes(p.stage)) { refreshQueueChrome(); pump(); }
});

$("#queue").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const row = btn.closest(".item");
  const item = items.get(row.dataset.id);
  switch (btn.dataset.act) {
    case "cancel":
      if (item.stage === "queued") { item.stage = "cancelled"; updateRow(item); refreshQueueChrome(); }
      else {
        // Huỷ ngay trên giao diện, backend dừng tiến trình ở phía sau
        const jobId = item.jobId;
        item.stage = "cancelled";
        item.message = "";
        updateRow(item);
        refreshQueueChrome();
        invoke("cancel_download", { id: jobId }).catch(() => {});
        pump();
      }
      break;
    case "reveal": invoke("reveal_file", { path: item.file }).catch((err) => toast(String(err))); break;
    case "retry": item.stage = "queued"; item.percent = 0; updateRow(item); refreshQueueChrome(); pump(); break;
    case "remove": items.delete(item.id); row.remove(); refreshQueueChrome(); break;
  }
});

$("#clear-done").addEventListener("click", () => {
  for (const [id, i] of items) if (["done", "error", "cancelled"].includes(i.stage)) { items.delete(id); $(`.item[data-id="${id}"]`)?.remove(); }
  refreshQueueChrome();
});

dlBtn.addEventListener("click", () => {
  const urls = urlsIn(input.value);
  if (!urls.length) return;
  if (tools && !tools.ytdlp) { toast("Cần cài yt-dlp trước khi tải. Mở Cài đặt → Công cụ."); return; }
  if (tools && !tools.ffmpeg) { toast("Cần cài ffmpeg để chuyển sang MP3. Mở Cài đặt → Công cụ."); return; }
  for (const u of urls) addItem(u, urls.length === 1 && currentInfo && currentInfo.url === u ? currentInfo : null);
  input.value = "";
  previewToken++;
  preview.hidden = true;
  currentInfo = null;
  dlBtn.disabled = true;
  pump();
});

/* ───────────────────────── Trang cài đặt ───────────────────────── */
function setSeed(hex) {
  S.seed = hex.toUpperCase();
  save();
  applyTheme();
  renderSwatches();
  if (document.activeElement !== $("#hex-input")) $("#hex-input").value = S.seed;
}

function renderSwatches() {
  const box = $("#swatches");
  box.replaceChildren();
  let matched = false;
  for (const [hex, name] of PRESETS) {
    const sel = hex.toLowerCase() === S.seed.toLowerCase();
    matched ||= sel;
    const b = el("button", "swatch");
    b.type = "button";
    b.style.background = hex;
    b.title = name;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", name);
    b.setAttribute("aria-checked", String(sel));
    b.appendChild(icon("check"));
    b.addEventListener("click", () => setSeed(hex));
    box.appendChild(b);
  }
  const custom = el("label", "swatch custom");
  custom.title = "Chọn màu tuỳ chỉnh";
  custom.setAttribute("role", "radio");
  custom.setAttribute("aria-checked", String(!matched));
  if (!matched) custom.style.background = S.seed;
  custom.appendChild(icon("palette"));
  const picker = el("input");
  picker.type = "color";
  picker.value = S.seed.toLowerCase();
  picker.addEventListener("input", () => setSeed(picker.value));
  custom.appendChild(picker);
  box.appendChild(custom);
}

$("#hex-input").addEventListener("input", (e) => {
  let v = e.target.value.trim();
  if (v && !v.startsWith("#")) v = "#" + v;
  const ok = /^#[0-9a-f]{6}$/i.test(v);
  e.target.parentElement.classList.toggle("invalid", !!e.target.value && !ok);
  if (ok) setSeed(v);
});
$("#hex-input").addEventListener("blur", (e) => { e.target.value = S.seed; e.target.parentElement.classList.remove("invalid"); });

renderRadio($("#mode-seg"), MODES, S.mode, (v) => { S.mode = v; save(); applyTheme(); }, "", true);
renderRadio($("#default-quality-chips"), QUALITIES, S.quality, (v) => {
  S.quality = v; save(); quality = v;
  renderRadio($("#quality-chips"), QUALITIES, v, (q) => (quality = q), "chip");
}, "chip");

$("#crop-switch").checked = S.crop;
$("#crop-switch").addEventListener("change", (e) => { S.crop = e.target.checked; save(); });

function showOutDir() { $("#out-dir").textContent = "\u200E" + S.outDir; }
$("#pick-dir").addEventListener("click", async () => {
  try {
    const dir = await T.dialog.open({ directory: true, multiple: false, defaultPath: S.outDir || undefined });
    if (dir) { S.outDir = dir; save(); showOutDir(); }
  } catch (e) { toast(String(e)); }
});
$("#open-dir").addEventListener("click", () => invoke("open_folder", { path: S.outDir }).catch((e) => toast(String(e))));

/* ───────────────────────── Công cụ (yt-dlp, ffmpeg, Deno) ───────────────────────── */
let tools = null;
let installing = false;
let bannerMode = "required";
const TOOL_LABEL = { ytdlp: "yt-dlp", ffmpeg: "ffmpeg", deno: "Deno" };
const INSTALL_CMD = { ytdlp: "install_ytdlp", ffmpeg: "install_ffmpeg", deno: "install_deno" };
const denoDismissed = () => { try { return sessionStorage.getItem("mp3dl.denoDismissed") === "1"; } catch { return false; } };

async function refreshTools() {
  try { tools = await invoke("check_tools"); } catch { return; }
  $("#ytdlp-status").textContent = tools.ytdlp ? `Đã cài · phiên bản ${tools.ytdlp}` : "Chưa cài";
  $("#install-ytdlp").textContent = tools.ytdlp ? "Cập nhật" : "Cài đặt";
  $("#ffmpeg-status").textContent = tools.ffmpeg ? `Đã cài · phiên bản ${tools.ffmpeg}` : "Chưa cài";
  $("#install-ffmpeg").hidden = !!tools.ffmpeg;
  $("#deno-status").textContent = tools.deno
    ? `Đã cài · phiên bản ${tools.deno}`
    : IS_WINDOWS ? "Chưa cài · giúp yt-dlp tránh lỗi HTTP 403 khi tải từ YouTube" : "Chưa cài (tuỳ chọn) · macOS: brew install deno";
  $("#install-deno").hidden = !!tools.deno;

  const missing = [!tools.ytdlp && "yt-dlp", !tools.ffmpeg && "ffmpeg"].filter(Boolean);
  const banner = $("#tools-banner");
  if (missing.length) {
    bannerMode = "required";
    banner.hidden = false;
    $("#banner-title").textContent = `Chưa có ${missing.join(" và ")}`;
    const manual = !IS_WINDOWS && !tools.ffmpeg;
    $("#banner-desc").textContent = manual
      ? "App tải được yt-dlp giúp bạn. ffmpeg cần cài bằng `brew install ffmpeg` (macOS) hoặc `sudo apt install ffmpeg` (Linux)."
      : "App có thể tải và cài giúp bạn, cần kết nối internet.";
    $("#banner-install").textContent = "Cài đặt tự động";
    $("#banner-install").hidden = manual && !!tools.ytdlp;
    $("#banner-dismiss").hidden = true;
  } else if (!tools.deno && IS_WINDOWS && !denoDismissed()) {
    bannerMode = "deno";
    banner.hidden = false;
    $("#banner-title").textContent = "Nên cài thêm Deno";
    $("#banner-desc").textContent = "Giúp yt-dlp giải mã link YouTube, tránh lỗi “HTTP Error 403: Forbidden” khi tải.";
    $("#banner-install").textContent = "Cài Deno";
    $("#banner-install").hidden = false;
    $("#banner-dismiss").hidden = false;
  } else {
    banner.hidden = true;
  }
}

listen("tool-progress", ({ payload: { tool, percent } }) => {
  const bars = [$(`#${tool}-progress`), $("#banner-progress")].filter(Boolean);
  for (const bar of bars) {
    bar.hidden = false;
    bar.classList.toggle("indeterminate", percent >= 100);
    $("span", bar).style.width = percent + "%";
  }
});

async function installTool(tool) {
  try {
    await invoke(INSTALL_CMD[tool]);
    toast(`Đã cài ${TOOL_LABEL[tool]}.`);
  } catch (e) {
    toast(String(e));
    return false;
  } finally {
    const bar = $(`#${tool}-progress`);
    if (bar) bar.hidden = true;
    $("#banner-progress").hidden = true;
  }
  return true;
}

const INSTALL_BTNS = "#install-ytdlp, #install-ffmpeg, #install-deno, #banner-install";
async function runInstall(list) {
  if (installing) return;
  installing = true;
  document.querySelectorAll(INSTALL_BTNS).forEach((b) => (b.disabled = true));
  for (const t of list) if (!(await installTool(t))) break;
  installing = false;
  document.querySelectorAll(INSTALL_BTNS).forEach((b) => (b.disabled = false));
  refreshTools();
}
$("#install-ytdlp").addEventListener("click", () => runInstall(["ytdlp"]));
$("#install-ffmpeg").addEventListener("click", () => runInstall(["ffmpeg"]));
$("#install-deno").addEventListener("click", () => runInstall(["deno"]));
$("#banner-install").addEventListener("click", () => {
  if (bannerMode === "deno") return runInstall(["deno"]);
  const list = [];
  if (!tools || !tools.ytdlp) list.push("ytdlp");
  if ((!tools || !tools.ffmpeg) && IS_WINDOWS) list.push("ffmpeg");
  if ((!tools || !tools.deno) && IS_WINDOWS) list.push("deno");
  runInstall(list);
});
$("#banner-dismiss").addEventListener("click", () => {
  try { sessionStorage.setItem("mp3dl.denoDismissed", "1"); } catch {}
  $("#tools-banner").hidden = true;
});

/* ───────────────────────── Khởi động ───────────────────────── */
(async function init() {
  applyTheme();
  renderSwatches();
  $("#hex-input").value = S.seed;
  refreshQueueChrome();
  try {
    if (!S.outDir) { S.outDir = await invoke("default_output_dir"); save(); }
  } catch {}
  showOutDir();
  refreshTools();
  try { $("#app-version").textContent = "Phiên bản " + (await T.app.getVersion()); } catch { $("#app-version").textContent = "Phiên bản 0.3.2"; }
})();
