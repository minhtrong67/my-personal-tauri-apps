// Export dialog: fast WebCodecs pipeline (default) with a real-time MediaRecorder fallback.
// Defaults every time: MP4 (H.264 + AAC) · 1080p · 60 fps. Quality and method are remembered.
import { state, dims, totalDuration } from './store.js';
import { exportVideo, supportedMime, isExporting, releaseForExport, invalidate } from './engine.js';
import { cancelProxies, holdProxies } from './proxy.js';
import { exportFast, fastFormats, FAST_FORMATS } from './export-fast.js';
import { pickSavePath, pickDirectory, fileExists, createFileWriter, ffmpegAvailable, tempPath, removeTemp, ffmpegConvert, inTauri } from './io.js';
import { settings, saveSettings } from './settings.js';
import { $, h, stripExt, fmtTime, icon, chime } from './util.js';
import { t } from './i18n.js';

const dlg = $('#dlg-export');
const bodyEl = $('#export-body');
const actionsEl = $('#export-actions');
let toast = () => {};
export const setExportToast = (f) => { toast = f; };

const RES = [[480, '480p'], [720, '720p HD'], [1080, '1080p Full HD'], [1440, '1440p 2K'], [2160, '2160p 4K']];
const FPS = [24, 25, 30, 50, 60];
const QUALITY = [['standard', 0.14], ['high', 0.2], ['max', 0.3]]; // bits per pixel per frame (1080p60: ≈17 / 25 / 37 Mbps)

// Encoder probing can take seconds on some GPUs, so the answer is remembered between launches and refreshed in the background.
const FMT_KEY = 'mve.exfmt.v1';
let fmtCache = null, fmtReady = false;
const fromIds = (ids) => {
  const list = FAST_FORMATS.filter((f) => ids.includes(f.id)).map((f) => ({ ...f, fast: true }));
  const mp4 = supportedMime('mp4'), webm = supportedMime('webm');
  if (mp4 && !list.some((f) => f.id === 'mp4')) list.push({ id: 'mp4', label: 'MP4 (H.264)', mime: mp4, ext: 'mp4', fast: false });
  if (webm && !list.some((f) => f.id === 'webm')) list.push({ id: 'webm', label: 'WebM (VP9)', ext: 'webm', mime: webm, fast: false });
  return list;
};
const probe = () => formats().then((l) => {
  try { localStorage.setItem(FMT_KEY, JSON.stringify(l.filter((f) => f.fast).map((f) => f.id))); } catch { /* storage unavailable */ }
  return l;
});
try {
  const ids = JSON.parse(localStorage.getItem(FMT_KEY) || 'null');
  if (Array.isArray(ids) && ids.length) { fmtCache = Promise.resolve(fromIds(ids)); fmtReady = true; }
} catch { /* ignore */ }
const loadFormats = () => (fmtCache ||= probe().then((l) => { fmtReady = true; return l; }));
/** Probe encoders in the background so the export window opens instantly. */
export const warmExport = () => setTimeout(() => { probe().then((l) => { fmtCache = Promise.resolve(l); fmtReady = true; }).catch(() => {}); }, 2500);

async function formats() {
  const list = [];
  for (const f of await fastFormats()) list.push({ ...f, fast: true });
  const mp4 = supportedMime('mp4'), webm = supportedMime('webm');
  if (mp4 && !list.some((f) => f.id === 'mp4')) list.push({ id: 'mp4', label: 'MP4 (H.264)', mime: mp4, ext: 'mp4', fast: false });
  if (webm && !list.some((f) => f.id === 'webm')) list.push({ id: 'webm', label: 'WebM (VP9)', ext: 'webm', mime: webm, fast: false });
  if (webm && (await ffmpegAvailable())) list.push({ id: 'mp4-ff', label: null, labelKey: 'export.mp4ffmpeg', mime: webm, ext: 'mp4', convert: true, fast: false });
  return list;
}
// real-time recording can only produce the same container as the chosen format
const rtMime = (f) => f.mime || supportedMime(f.ext === 'mp4' ? 'mp4' : 'webm');

let opening = false, running = false;
dlg.addEventListener('close', () => { dlg.classList.remove('exporting'); if (!running) holdProxies(false); });

export async function openExport() {
  if (running || isExporting()) { toast(t('export.cleaning')); return; }
  if (opening) return;
  if (totalDuration() <= 0) { toast(t('export.empty')); return; }
  opening = true;
  holdProxies(true); // background preview optimisation pauses while the window is open
  try {
    bodyEl.onchange = null;
    actionsEl.replaceChildren(h('button', { class: 'btn text', text: t('btn.cancel'), onclick: () => dlg.close() }));
    if (!fmtReady) {
      // first time: show the window right away with a small loader while encoders are probed
      bodyEl.replaceChildren(h('div', { class: 'loading-row' }, h('i', { class: 'spinner' }), h('span', { text: t('export.preparing') })));
      if (!dlg.open) dlg.showModal();
    }
    const fmts = await loadFormats();
    render(fmts);
    if (!dlg.open) dlg.showModal();
  } finally { opening = false; }
}

function render(fmts) {
  bodyEl.replaceChildren();
  actionsEl.replaceChildren();
  if (!fmts.length) {
    bodyEl.append(h('p', { text: t('export.unsupported') }));
    actionsEl.append(h('button', { class: 'btn text', text: t('btn.close'), onclick: () => dlg.close() }));
    return;
  }
  const S = settings.export;
  // always opens preset to MP4 · 1080p · 60 fps (falls back to the best available container only if H.264 is missing)
  const defFmt = fmts.find((x) => x.id === 'mp4' && x.fast) || fmts.find((x) => x.fast) || fmts.find((x) => x.ext === 'mp4') || fmts[0];
  const sel = (id, label, options, value) => {
    const s = h('select', { class: 'select block', id }, options.map(([v, l]) => h('option', { value: v, text: l })));
    s.value = options.some(([v]) => v === value) ? value : options[0][0];
    return h('div', { class: 'f-row' }, h('label', { text: label }), s);
  };
  const hasFast = fmts.some((f) => f.fast);
  const modeOpts = [['fast', t('export.mode.fast')], ['realtime', t('export.mode.realtime')]];
  const defName = (stripExt(state.name) || t('project.untitled')).replace(/[\\/:*?"<>|]/g, '_');
  const nameInp = h('input', { class: 'field', id: 'ex-name', type: 'text', maxlength: '120', spellcheck: 'false', value: defName });
  const extTag = h('span', { class: 'ext-tag', id: 'ex-ext' });
  const dirInp = h('input', { class: 'field', id: 'ex-dir', type: 'text', readonly: '', placeholder: t('export.askLocation'), value: S.dir || '' });
  const browse = h('button', { class: 'btn tonal sm', type: 'button', onclick: async () => {
    const d = await pickDirectory(dirInp.value || S.lastDir);
    if (d) { dirInp.value = d; S.lastDir = d; saveSettings(); }
  } }, icon('open'), t('settings.choose'));
  const clearDir = h('button', { class: 'btn text sm', type: 'button', text: t('btn.clear'), onclick: () => { dirInp.value = ''; } });
  bodyEl.append(
    h('div', { class: 'f-row' }, h('label', { text: t('export.fileName') }), h('div', { class: 'input-suffix' }, nameInp, extTag)),
    sel('ex-f', t('export.format'), fmts.map((f) => [f.id, f.label || t(f.labelKey)]), defFmt.id),
    h('div', { class: 'f-grid' },
      sel('ex-r', t('export.resolution'), RES.map(([v, l]) => [String(v), l]), '1080'),
      sel('ex-fps', t('export.fps'), FPS.map((v) => [String(v), v + ' fps']), '60')),
    sel('ex-q', t('export.quality'), QUALITY.map(([k]) => [k, t('export.q.' + k)]), S.q),
    h('div', { class: 'insp-info', id: 'ex-info' }),
    h('p', { class: 'hint', id: 'ex-note' }),
    inTauri ? h('div', { class: 'f-row' }, h('label', { text: t('export.saveTo') }), h('div', { class: 'dir-field' }, dirInp, h('div', { class: 'dir-actions' }, browse, clearDir))) : h('span'),
  );
  const info = $('#ex-info', bodyEl);
  const params = () => {
    const f = fmts.find((x) => x.id === $('#ex-f').value) || defFmt;
    const [w, hh] = dims(Number($('#ex-r').value));
    const fps = Number($('#ex-fps').value);
    const q = $('#ex-q').value;
    const bpp = QUALITY.find(([k]) => k === q)[1];
    const mode = f.fast ? 'fast' : 'realtime'; // the real-time recorder is only used when WebCodecs is unavailable
    const base = (nameInp.value || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\.(mp4|webm|mov)$/i, '').trim() || defName;
    return { f, w, h: hh, fps, q, mode, bitrate: Math.round(w * hh * fps * bpp), name: base, dir: dirInp.value };
  };
  const refresh = () => {
    const p = params();
    const mb = ((p.bitrate + 192000) * totalDuration()) / 8 / 1e6;
    info.textContent = `${p.f.ext.toUpperCase()} · ${p.fps} fps · ` + t('export.summary', { w: p.w, h: p.h, d: fmtTime(totalDuration(), false), mb: mb.toFixed(1) });
    $('#ex-note').textContent = t(p.mode === 'fast' ? 'export.note.fast' : 'export.note.realtime');
    extTag.textContent = '.' + p.f.ext;
    const m = $('#ex-mode');
    if (m) m.disabled = !p.f.fast || !rtMime(p.f);
    if (m && m.disabled && p.f.fast) m.value = 'fast';
  };
  bodyEl.onchange = refresh;
  refresh();
  actionsEl.append(
    h('button', { class: 'btn text', text: t('btn.cancel'), onclick: () => dlg.close() }),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn filled', text: t('export.start'), onclick: () => run(params()) }),
  );
}

function remember(p) {
  // format / resolution / frame rate always start at MP4 · 1080p · 60 fps; only quality is remembered
  settings.export.q = p.q;
  if (p.f.fast && rtMime(p.f)) settings.export.mode = p.mode;
  saveSettings();
}

async function run(p) {
  running = true;
  try { await runExport(p); } finally { running = false; holdProxies(false); invalidate(); }
}

async function runExport(p) {
  remember(p);
  const file = `${p.name}.${p.f.ext}`;
  const sep = (d) => (d.includes('\\') && !d.includes('/') ? '\\' : '/');
  const join = (d, f) => d.replace(/[\\/]+$/, '') + sep(d) + f;
  let target;
  try {
    if (inTauri && p.dir) {
      // fixed folder: never overwrite silently — add " (1)", " (2)"… when the name is taken
      target = join(p.dir, file);
      for (let i = 1; (await fileExists(target)) && i < 500; i++) target = join(p.dir, `${p.name} (${i}).${p.f.ext}`);
    } else {
      target = await pickSavePath(settings.export.lastDir ? join(settings.export.lastDir, file) : file, [{ name: p.f.ext.toUpperCase(), extensions: [p.f.ext] }]);
    }
  } catch (e) { toast(t('toast.error', { msg: e.message || e })); return; }
  if (!target) return;
  if (inTauri && !new RegExp(`\\.${p.f.ext}$`, 'i').test(target)) target += '.' + p.f.ext;
  if (inTauri) { settings.export.lastDir = target.replace(/[\\/][^\\/]*$/, ''); saveSettings(); }

  const started = performance.now();
  const ctl = new AbortController();
  const bar = h('div', { class: 'progress' }, h('i'));
  // thumbnail = the frame currently shown in the preview (grabbed before the engine is released)
  let thumb = '';
  try { const src = $('#cv'); const k = Math.min(1, 640 / src.width); const tc = document.createElement('canvas'); tc.width = Math.max(2, Math.round(src.width * k)); tc.height = Math.max(2, Math.round(src.height * k)); tc.getContext('2d').drawImage(src, 0, 0, tc.width, tc.height); thumb = tc.toDataURL('image/jpeg', 0.8); } catch { /* no preview */ }
  const label = h('div', { class: 'progress-label' });
  const pct = h('div', { class: 'progress-pct', text: '0%' });
  const diagEl = h('p', { class: 'hint diag' });
  const stats = {};
  const mb = ((p.bitrate + 192000) * totalDuration()) / 8 / 1e6;
  const rows = [
    [t('export.fileName'), `${p.name}.${p.f.ext}`],
    [t('exp.duration'), fmtTime(totalDuration(), false)],
    [t('exp.size'), `~${mb.toFixed(0)} MB`],
    [t('export.resolution'), `${p.w}×${p.h}`],
    [t('exp.bitrate'), `${(p.bitrate / 1e6).toFixed(1)} Mbps`],
    [t('exp.codec'), p.f.vcodec === 'vp9' ? 'VP9' : 'H.264'],
    [t('export.format'), p.f.ext],
    [t('export.fps'), `${p.fps} fps`],
    [t('exp.color'), 'Rec. 709 SDR'],
  ];
  const mkStat = (k) => { const v = h('b', { text: '–' }); return [v, h('div', { class: 'xs' }, h('span', { text: t('exp.' + k) }), v)]; };
  const [elapsedV, elapsedEl] = mkStat('elapsed');
  const [leftV, leftEl] = mkStat('left');
  const [speedV, speedEl] = mkStat('speed');
  dlg.classList.add('exporting');
  bodyEl.replaceChildren(
    h('div', { class: 'ex-top2' },
      h('div', { class: 'ex-thumb' }, thumb ? h('img', { src: thumb, alt: '' }) : h('span')),
      h('div', { class: 'ex-card' }, h('h3', { text: t('exp.exporting') }), h('dl', { class: 'ex-info' }, ...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])))),
    h('div', { class: 'ex-prog' }, h('div', { class: 'ex-top' }, label, pct), bar, h('div', { class: 'ex-stats' }, elapsedEl, leftEl, speedEl)),
    h('p', { class: 'hint', text: t('export.keepOpen') }), diagEl);
  const tick = setInterval(() => { elapsedV.textContent = fmtTime((performance.now() - started) / 1000, false); }, 500);
  // Cancel closes the window immediately; the pipeline unwinds and removes the partial file in the background
  let cancelled = false;
  const cancel = () => { if (cancelled) return; cancelled = true; ctl.abort(); dlg.close(); toast(t('export.cancelled')); };
  actionsEl.replaceChildren(h('button', { class: 'btn text', text: t('btn.cancel'), onclick: cancel }));
  dlg.oncancel = (e) => { e.preventDefault(); cancel(); };
  cancelProxies(); releaseForExport();
  const setBar = (v) => { bar.firstChild.style.width = v * 100 + '%'; };

  try {
    let done = false;
    if (p.f.fast && p.mode === 'fast') {
      label.textContent = t('export.rendering');
      const attempt = async (safe) => {
        const blob = await exportFast({
          width: p.w, height: p.h, fps: p.fps, bitrate: p.bitrate, format: p.f, path: inTauri ? target : null, signal: ctl.signal, safe,
          onPhase: () => { label.textContent = t('export.finishing'); pct.textContent = '100%'; },
          onProgress(v, i) {
            setBar(v);
            pct.textContent = (v * 100).toFixed(1) + '%';
            leftV.textContent = fmtTime(i.eta, false); speedV.textContent = i.speed.toFixed(1) + '×';
            if (i.diag) diagEl.textContent = i.diag;
          },
          stats,
        });
        if (blob) await saveBlobBrowser(blob, target);
      };
      try {
        try { await attempt(false); } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          console.warn('fast export failed, retrying in safe mode', err);
          setBar(0); label.textContent = t('export.retry');
          await attempt(true); // same fast pipeline with conservative encoder settings
        }
        done = true;
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        console.warn('fast export failed', err);
        // the real-time recorder is slow, memory hungry and can produce broken files → only used when the fast path is unavailable
        throw err;
      }
    }
    if (!done) {
      const mime = rtMime(p.f);
      label.textContent = t('export.recording');
      const convert = !!p.f.convert;
      const file = convert ? await tempPath(`mve-${Date.now()}.webm`) : target;
      const writer = inTauri ? createFileWriter(file, mime.split(';')[0]) : null;
      let pos = 0;
      const blob = await exportVideo({
        width: p.w, height: p.h, fps: p.fps, bitrate: p.bitrate, mime, signal: ctl.signal,
        onData: writer ? async (bytes) => { writer.write(pos, bytes); pos += bytes.length; while (writer.pending > 32e6) await new Promise((r) => setTimeout(r, 20)); } : undefined,
        onProgress(v) { setBar(v); pct.textContent = (v * 100).toFixed(1) + '%'; },
      });
      actionsEl.replaceChildren();
      label.textContent = t('export.saving');
      if (writer) await writer.drain(); else await saveBlobBrowser(blob, target);
      if (convert) {
        label.textContent = t('export.converting');
        try { await ffmpegConvert(file, target); } finally { await removeTemp(file); }
      }
    }
    chime();
    finish(t('export.done'), t('export.savedTo', { path: target }), stats.report ? `${fmtTime((performance.now() - started) / 1000, false)} · ${stats.report}` : '');
  } catch (err) {
    if (err && err.name === 'AbortError') { if (!cancelled) { dlg.close(); toast(t('export.cancelled')); } }
    else finish(t('export.failed'), String((err && err.message) || err), stats.report || diagEl.textContent);
  } finally {
    dlg.oncancel = null; clearInterval(tick);
  }
}

// Browser build (no disk access): hand the file to the download manager.
function saveBlobBrowser(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = String(name).split(/[\\/]/).pop();
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function finish(title, msg, diag = '') {
  dlg.classList.remove('exporting');
  bodyEl.replaceChildren(h('h3', { text: title }), h('p', { class: 'path', text: msg }), diag ? h('p', { class: 'hint diag', text: diag }) : h('span'));
  actionsEl.replaceChildren(h('span', { class: 'spacer' }), h('button', { class: 'btn filled', text: t('btn.done'), onclick: () => dlg.close() }));
}
