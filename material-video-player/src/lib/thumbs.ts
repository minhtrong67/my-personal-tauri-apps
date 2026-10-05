import { assetUrl } from './tauri';

/** Generate a small JPEG thumbnail of a video (uses a hidden <video> + canvas). Resolves null on failure. */
export function makeThumb(path: string): Promise<{ thumb: string; dur: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    let done = false;
    const finish = (r: { thumb: string; dur: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve(r);
    };
    const timer = window.setTimeout(() => finish(null), 9000);
    v.addEventListener('error', () => finish(null));
    v.addEventListener('loadedmetadata', () => {
      v.currentTime = Math.min(Math.max(v.duration * 0.1, 1), 90);
    });
    v.addEventListener('seeked', () => {
      try {
        const w = 320;
        const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(v, 0, 0, w, h);
        finish({ thumb: c.toDataURL('image/jpeg', 0.72), dur: v.duration });
      } catch {
        finish(null);
      }
    });
    v.src = assetUrl(path);
  });
}
