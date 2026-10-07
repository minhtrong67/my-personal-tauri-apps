// Export dialog: fast WebCodecs pipeline (default) with a real-time MediaRecorder fallback.
// The last-used options are remembered in settings.export.
import { state, dims, totalDuration } from './store.js';
import { exportVideo, supportedMime, isExporting } from './engine.js';
import { exportFast, fastFormats } from './export-fast.js';
import { pickSavePath, pickDirectory, fileExists, createFileWriter, ffmpegAvailable, tempPath, removeTemp, ffmpegConvert, inTauri } from './io.js';
import { settings, saveSettings } from './settings.js';
import { $, h, stripExt, fmtTime, icon } from './util.js';
import { t } from './i18n.js';

const dlg = $('#dlg-export');
const bodyEl = $('#export-body');
const actionsEl = $('#export-actions');
let toast = () => {};
export const setExportToast = (f) => { toast = f; };

const RES = [[480, '480p'], [720, '720p HD'], [1080, '1080p Full HD'], [1440, '1440p 2K'], [2160, '2160p 4K']];
const QUALITY = [['standard', 0.07], ['high', 0.12], ['max', 0.2]];

async function formats() {
  const list = [];
  for (const f of await fastFormats()) list.push({ ...f, fast: true });
  const mp4 = supportedMime('mp4'), webm = supportedMime('webm');
  if (mp4 && !list.some((f) => f.id === 'mp4')) list.push({ id: 'mp4', label: 'MP4 (H.264)', mime: mp4, ext: 'mp4', fast: false });
  if (webm && !list.some((f) => f.id === 'webm')) list.push({ id: 'webm', label: 'WebM (VP9)', ext: 'webm', mime: webm, fast: false });
  if (webm && (await ffmpegAvailable())) list.push({ id: 'mp4-ff', label: t('export.mp4ffmpeg'), mime: webm, ext: 'mp4', convert: true, fast: false });
  return list;
}
// real-time recording can only produce the same container as the chosen format
const rtMime = (f) => f.mime || supportedMime(f.ext === 'mp4' ? 'mp4' : 'webm');

export async function openExport() {
  if (isExporting()) return;
  if (totalDuration() <= 0) { toast(t('export.empty')); return; }
  const fmts = await formats();
  bodyEl.replaceChildren();
  actionsEl.replaceChildren();
  if (!fmts.length) {
    bodyEl.append(h('p', { text: t('export.unsupported') }));
    actionsEl.append(h('button', { class: 'btn text', text: t('btn.close'), onclick: () => dlg.close() }));
    dlg.showModal();
    return;
  }
  const S = settings.export;
  const sel = (id, label, options, value) => {
    const s = h('select', { class: 'select block', id }, options.map(([v, l]) => h('option', { value: v, text: l })));
    s.value = options.some(([v]) => v === value) ? value : options[0][0];
    return h('div', { class: 'f-row' }, h('label', { text: label }), s);
  };
  const fpsOpts = [['24', '24 fps'], ['30', '30 fps'], ['60', '60 fps']];
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
  const clearDir = h('button', { class: 'icon-btn sm', type: 'button', title: t('btn.clear'), onclick: () => { dirInp.value = ''; } }, icon('close'));
  bodyEl.append(
    h('div', { class: 'f-row' }, h('label', { text: t('export.fileName') }), h('div', { class: 'name-row' }, nameInp, extTag)),
    inTauri ? h('div', { class: 'f-row' }, h('label', { text: t('export.saveTo') }), h('div', { class: 'dir-row' }, dirInp, browse, clearDir)) : h('span'),
    sel('ex-format', t('export.format'), fmts.map((f) => [f.id, f.label]), S.format),
    sel('ex-res', t('export.resolution'), RES.map(([v, l]) => [String(v), l]), S.res),
    sel('ex-fps', t('export.fps'), fpsOpts, S.fps),
    sel('ex-q', t('export.quality'), QUALITY.map(([k]) => [k, t('export.q.' + k)]), S.q),
    hasFast ? sel('ex-mode', t('export.mode'), modeOpts, S.mode) : h('span'),
    h('div', { class: 'insp-info', id: 'ex-info' }),
    h('p', { class: 'hint', id: 'ex-note' }),
  );
  const info = $('#ex-info', bodyEl);
  const params = () => {
    const f = fmts.find((x) => x.id === $('#ex-format').value);
    const [w, hh] = dims(+$('#ex-res').value);
    const fps = +$('#ex-fps').value;
    const q = $('#ex-q').value;
    const bpp = QUALITY.find(([k]) => k === q)[1];
    const mode = f.fast && $('#ex-mode') && $('#ex-mode').value === 'fast' ? 'fast' : (rtMime(f) ? 'realtime' : 'fast');
    const base = (nameInp.value || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\.(mp4|webm|mov)$/i, '').trim() || defName;
    return { f, w, h: hh, fps, q, mode, bitrate: Math.round(w * hh * fps * bpp), name: base, dir: dirInp.value };
  };
  const refresh = () => {
    const p = params();
    const mb = ((p.bitrate + 192000) * totalDuration()) / 8 / 1e6;
    info.textContent = t('export.summary', { w: p.w, h: p.h, d: fmtTime(totalDuration(), false), mb: mb.toFixed(1) });
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
  dlg.showModal();
}

function remember(p) {
  Object.assign(settings.export, { format: p.f.id, res: String(Math.min(p.w, p.h)), fps: String(p.fps), q: p.q });
  if (p.f.fast && rtMime(p.f)) settings.export.mode = p.mode;
  saveSettings();
}

async function run(p) {
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

  const ctl = new AbortController();
  const bar = h('div', { class: 'progress' }, h('i'));
  const label = h('div', { class: 'progress-label' });
  const pct = h('div', { class: 'progress-pct', text: '0%' });
  bodyEl.replaceChildren(label, bar, pct, h('p', { class: 'hint', text: t('export.keepOpen') }));
  actionsEl.replaceChildren(h('button', { class: 'btn text', text: t('btn.cancel'), onclick: () => ctl.abort() }));
  dlg.oncancel = (e) => { e.preventDefault(); ctl.abort(); };
  const started = performance.now();
  const setBar = (v) => { bar.firstChild.style.width = v * 100 + '%'; };

  try {
    let done = false;
    if (p.f.fast && p.mode === 'fast') {
      label.textContent = t('export.rendering');
      try {
        const blob = await exportFast({
          width: p.w, height: p.h, fps: p.fps, bitrate: p.bitrate, format: p.f, path: inTauri ? target : null, signal: ctl.signal,
          onProgress(v, i) {
            setBar(v);
            pct.textContent = `${Math.round(v * 100)}%  ·  ${t('export.speed', { x: i.speed.toFixed(1), eta: fmtTime(i.eta, false) })}`;
          },
        });
        if (blob) await saveBlobBrowser(blob, target);
        done = true;
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        console.warn('fast export failed', err);
        if (!rtMime(p.f)) throw err;
        toast(t('export.fallback'));
        setBar(0);
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
        onProgress(v) { setBar(v); pct.textContent = `${Math.round(v * 100)}%  ·  ${fmtTime((performance.now() - started) / 1000, false)}`; },
      });
      actionsEl.replaceChildren();
      label.textContent = t('export.saving');
      if (writer) await writer.drain(); else await saveBlobBrowser(blob, target);
      if (convert) {
        label.textContent = t('export.converting');
        try { await ffmpegConvert(file, target); } finally { await removeTemp(file); }
      }
    }
    finish(t('export.done'), t('export.savedTo', { path: target }));
  } catch (err) {
    if (err && err.name === 'AbortError') { dlg.close(); toast(t('export.cancelled')); }
    else finish(t('export.failed'), String((err && err.message) || err));
  } finally {
    dlg.oncancel = null;
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

function finish(title, msg) {
  bodyEl.replaceChildren(h('h3', { text: title }), h('p', { class: 'path', text: msg }));
  actionsEl.replaceChildren(h('span', { class: 'spacer' }), h('button', { class: 'btn filled', text: t('btn.done'), onclick: () => dlg.close() }));
}
