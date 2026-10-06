// Export dialog: format / resolution / fps / quality → real-time recording → file.
import { state, dims, totalDuration } from './store.js';
import { exportVideo, supportedMime, isExporting } from './engine.js';
import { pickSavePath, writeBlob, ffmpegAvailable, tempPath, removeTemp, ffmpegConvert, inTauri } from './io.js';
import { $, h, stripExt, fmtTime } from './util.js';
import { t } from './i18n.js';

const dlg = $('#dlg-export');
const bodyEl = $('#export-body');
const actionsEl = $('#export-actions');
let toast = () => {};
export const setExportToast = (f) => { toast = f; };

const RES = [[480, '480p'], [720, '720p HD'], [1080, '1080p Full HD'], [1440, '1440p 2K']];
const QUALITY = [['standard', 0.07], ['high', 0.12], ['max', 0.2]];

async function formats() {
  const list = [];
  const mp4 = supportedMime('mp4');
  const webm = supportedMime('webm');
  if (mp4) list.push({ id: 'mp4', label: 'MP4 (H.264)', mime: mp4, ext: 'mp4', convert: false });
  if (webm && (await ffmpegAvailable())) list.push({ id: 'mp4-ff', label: t('export.mp4ffmpeg'), mime: webm, ext: 'mp4', convert: true });
  if (webm) list.push({ id: 'webm', label: 'WebM (VP9)', mime: webm, ext: 'webm', convert: false });
  return list;
}

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

  const sel = (id, label, options, value) => {
    const s = h('select', { class: 'select block', id }, options.map(([v, l]) => h('option', { value: v, text: l })));
    s.value = value;
    return h('div', { class: 'f-row' }, h('label', { text: label }), s);
  };
  const fpsOpts = [['24', '24 fps'], ['30', '30 fps'], ['60', '60 fps']];
  bodyEl.append(
    sel('ex-format', t('export.format'), fmts.map((f) => [f.id, f.label]), fmts[0].id),
    sel('ex-res', t('export.resolution'), RES.map(([v, l]) => [String(v), l]), '1080'),
    sel('ex-fps', t('export.fps'), fpsOpts, fpsOpts.some(([v]) => +v === state.fps) ? String(state.fps) : '30'),
    sel('ex-q', t('export.quality'), QUALITY.map(([k]) => [k, t('export.q.' + k)]), 'high'),
    h('div', { class: 'insp-info', id: 'ex-info' }),
    h('p', { class: 'hint', text: t('export.note') }),
  );
  const info = $('#ex-info', bodyEl);
  const params = () => {
    const f = fmts.find((x) => x.id === $('#ex-format').value);
    const short = +$('#ex-res').value;
    const [w, hh] = dims(short);
    const fps = +$('#ex-fps').value;
    const bpp = QUALITY.find(([k]) => k === $('#ex-q').value)[1];
    return { f, w, h: hh, fps, bitrate: Math.round(w * hh * fps * bpp) };
  };
  const refresh = () => {
    const p = params();
    const mb = ((p.bitrate + 192000) * totalDuration()) / 8 / 1e6;
    info.textContent = t('export.summary', { w: p.w, h: p.h, d: fmtTime(totalDuration(), false), mb: mb.toFixed(1) });
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

async function run(p) {
  const name = (stripExt(state.name) || t('project.untitled')).replace(/[\\/:*?"<>|]/g, '_');
  const filters = [{ name: p.f.ext.toUpperCase(), extensions: [p.f.ext] }];
  let target;
  try { target = await pickSavePath(`${name}.${p.f.ext}`, filters); } catch (e) { toast(t('toast.error', { msg: e.message || e })); return; }
  if (!target) return;
  if (inTauri && !new RegExp(`\\.${p.f.ext}$`, 'i').test(target)) target += '.' + p.f.ext;

  const ctl = new AbortController();
  const bar = h('div', { class: 'progress' }, h('i'));
  const label = h('div', { class: 'progress-label', text: t('export.recording') });
  const pct = h('div', { class: 'progress-pct', text: '0%' });
  bodyEl.replaceChildren(label, bar, pct, h('p', { class: 'hint', text: t('export.keepOpen') }));
  actionsEl.replaceChildren(h('button', { class: 'btn text', text: t('btn.cancel'), onclick: () => ctl.abort() }));
  dlg.oncancel = (e) => { e.preventDefault(); ctl.abort(); };
  const started = performance.now();

  try {
    const blob = await exportVideo({
      width: p.w, height: p.h, fps: p.fps, bitrate: p.bitrate, mime: p.f.mime, signal: ctl.signal,
      onProgress(v) {
        bar.firstChild.style.width = v * 100 + '%';
        const el = (performance.now() - started) / 1000;
        pct.textContent = `${Math.round(v * 100)}%  ·  ${fmtTime(el, false)}`;
      },
    });
    actionsEl.replaceChildren();
    label.textContent = t('export.saving');
    bar.firstChild.style.width = '100%';
    if (p.f.convert) {
      const tmp = await tempPath(`mve-${Date.now()}.webm`);
      await writeBlob(tmp, blob);
      label.textContent = t('export.converting');
      try { await ffmpegConvert(tmp, target); } finally { await removeTemp(tmp); }
    } else {
      await writeBlob(target, blob, (v) => { bar.firstChild.style.width = v * 100 + '%'; });
    }
    finish(t('export.done'), t('export.savedTo', { path: target }));
  } catch (err) {
    if (err && err.name === 'AbortError') { dlg.close(); toast(t('export.cancelled')); }
    else finish(t('export.failed'), String((err && err.message) || err));
  } finally {
    dlg.oncancel = null;
  }
}

function finish(title, msg) {
  bodyEl.replaceChildren(h('h3', { text: title }), h('p', { class: 'path', text: msg }));
  actionsEl.replaceChildren(h('span', { class: 'spacer' }), h('button', { class: 'btn filled', text: t('btn.done'), onclick: () => dlg.close() }));
}
