// Screenshot: saves the frame under the playhead as a full-resolution PNG (1080p short side, project aspect).
import { state, dims, totalDuration } from './store.js';
import { drawFrame } from './engine.js';
import { pickSavePath, writeBlob, fileExists, inTauri } from './io.js';
import { settings, saveSettings } from './settings.js';
import { stripExt } from './util.js';
import { t } from './i18n.js';

export async function takeScreenshot(toast = () => {}) {
  if (totalDuration() <= 0) { toast(t('shot.empty')); return false; }
  const [W, H] = dims(1080);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { alpha: false });
  drawFrame(g, W, H, Math.min(state.t, Math.max(0, totalDuration() - 0.001)), null);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  if (!blob) { toast(t('shot.fail')); return false; }
  const tt = state.t, ms = Math.floor((tt % 1) * 1000);
  const stamp = [Math.floor(tt / 3600), Math.floor(tt / 60) % 60, Math.floor(tt) % 60].map((n) => String(n).padStart(2, '0')).join('-') + '-' + String(ms).padStart(3, '0');
  const base = ((stripExt(state.name) || t('project.untitled')).replace(/[\\/:*?"<>|]/g, '_')) + ' ' + stamp;
  try {
    let target = `${base}.png`;
    if (inTauri) {
      const dir = settings.export.dir || settings.export.lastDir || '';
      const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
      const join = (n) => dir.replace(/[\\/]+$/, '') + sep + n;
      if (dir) {
        target = join(`${base}.png`);
        for (let i = 1; (await fileExists(target)) && i < 500; i++) target = join(`${base} (${i}).png`);
      } else {
        target = await pickSavePath(`${base}.png`, [{ name: 'PNG', extensions: ['png'] }]);
        if (!target) return false;
        settings.export.lastDir = target.replace(/[\\/][^\\/]*$/, ''); saveSettings();
      }
    }
    await writeBlob(target, blob);
    toast(t('shot.done', { name: String(target).split(/[\\/]/).pop() }));
    return true;
  } catch (e) { toast(t('toast.error', { msg: e.message || e })); return false; }
}
