import { assetUrl } from './tauri';

/** Bump when the generator changes so old thumbnails are rebuilt */
export const THUMB_VER = 2;
export const thumbSig = (size: number) => `${size}:${THUMB_VER}`;

type RVFC = (cb: () => void) => number;

/**
 * Generate a small JPEG thumbnail of a video (hidden <video> + canvas).
 * Waits for the frame to really be painted and skips black frames (tries several positions).
 */
export function makeThumb(path: string): Promise<{ thumb: string; dur: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.playsInline = true;

    let best: { thumb: string; luma: number } | null = null;
    let done = false;
    const finish = (r: { thumb: string; dur: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve(r);
    };
    const timer = window.setTimeout(() => finish(best ? { thumb: best.thumb, dur: v.duration || 0 } : null), 15000);

    const fractions = [0.1, 0.3, 0.5, 0.02];
    let i = 0;

    const frameReady = () =>
      new Promise<void>((res) => {
        const t = window.setTimeout(res, 700);
        const rvfc = (v as unknown as { requestVideoFrameCallback?: RVFC }).requestVideoFrameCallback;
        if (rvfc) rvfc.call(v, () => { clearTimeout(t); res(); });
        else window.setTimeout(() => { clearTimeout(t); res(); }, 150);
      });

    const capture = (): { thumb: string; luma: number } | null => {
      try {
        const w = 320;
        const h = Math.round((w * (v.videoHeight || 9)) / (v.videoWidth || 16));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(v, 0, 0, w, h);
        // average brightness on a tiny copy
        const s = document.createElement('canvas');
        s.width = 24;
        s.height = 14;
        const sctx = s.getContext('2d')!;
        sctx.drawImage(c, 0, 0, 24, 14);
        const px = sctx.getImageData(0, 0, 24, 14).data;
        let sum = 0;
        for (let k = 0; k < px.length; k += 4) sum += px[k] * 0.299 + px[k + 1] * 0.587 + px[k + 2] * 0.114;
        return { thumb: c.toDataURL('image/jpeg', 0.74), luma: sum / (px.length / 4) };
      } catch {
        return null;
      }
    };

    const step = () => {
      if (i >= fractions.length) return finish(best ? { thumb: best.thumb, dur: v.duration } : null);
      const d = v.duration || 0;
      v.currentTime = Math.min(Math.max(d * fractions[i++], 1), Math.max(0.5, d - 1));
    };

    v.addEventListener('error', () => finish(best ? { thumb: best.thumb, dur: v.duration || 0 } : null));
    v.addEventListener('loadedmetadata', step);
    v.addEventListener('seeked', async () => {
      await frameReady();
      const c = capture();
      if (c) {
        if (!best || c.luma > best.luma) best = c;
        if (c.luma > 8) return finish({ thumb: c.thumb, dur: v.duration });
      }
      step();
    });
    v.src = assetUrl(path);
  });
}
