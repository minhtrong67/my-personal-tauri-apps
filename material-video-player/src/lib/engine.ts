import { clamp } from './utils';

/** Thin wrapper around the <video> element: playback helpers, frame stepping, audio boost / night mode, screenshots */
class Engine {
  el: HTMLVideoElement | null = null;
  fps = 30;
  /** Path of the file currently loaded in the element (null while switching) */
  loadedPath: string | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private fxFailed = false;
  private boost = 1;
  private night = false;
  private probing = false;

  attach(el: HTMLVideoElement | null) {
    this.el = el;
    this.ctx = null;
    this.gain = null;
    this.comp = null;
    this.fxFailed = false;
    this.probing = false;
  }

  get fxAvailable() {
    return !this.fxFailed;
  }

  play() {
    void this.ctx?.resume();
    return this.el?.play().catch(() => undefined);
  }
  pause() { this.el?.pause(); }
  toggle() {
    if (!this.el) return;
    if (this.el.paused) void this.play();
    else this.pause();
  }
  seek(t: number) {
    if (!this.el) return;
    const d = isFinite(this.el.duration) ? this.el.duration : t;
    this.el.currentTime = clamp(t, 0, d);
  }
  seekBy(d: number) { if (this.el) this.seek(this.el.currentTime + d); }
  setVolume(v: number, muted: boolean) {
    if (!this.el) return;
    this.el.volume = clamp(v, 0, 1);
    this.el.muted = muted;
  }
  setRate(r: number) {
    if (!this.el) return;
    this.el.defaultPlaybackRate = r;
    this.el.playbackRate = r;
  }

  frameStep(dir: 1 | -1) {
    if (!this.el) return;
    this.el.pause();
    this.seek(this.el.currentTime + dir / this.fps);
  }

  /** Estimate the frame rate from a few decoded frames */
  probeFps() {
    const el = this.el as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: (n: number, m: { mediaTime: number }) => void) => number }) | null;
    if (!el?.requestVideoFrameCallback || this.probing) return;
    this.probing = true;
    let last = -1;
    const diffs: number[] = [];
    const cb = (_n: number, meta: { mediaTime: number }) => {
      if (last >= 0) {
        const d = meta.mediaTime - last;
        if (d > 0.004 && d < 0.2) diffs.push(d);
      }
      last = meta.mediaTime;
      if (diffs.length < 12 && !el.paused) el.requestVideoFrameCallback!(cb);
      else if (diffs.length) {
        diffs.sort((a, b) => a - b);
        this.fps = clamp(Math.round(1 / diffs[diffs.length >> 1]), 10, 120);
      }
    };
    el.requestVideoFrameCallback(cb);
  }

  // ---- audio effects (Web Audio): volume boost up to 200% and night mode (compressor)
  private ensureFx(): boolean {
    if (this.fxFailed || !this.el) return false;
    if (this.ctx) return true;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(this.el);
      const gain = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -38;
      comp.knee.value = 30;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      src.connect(gain);
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.gain = gain;
      this.comp = comp;
      void ctx.resume();
      return true;
    } catch {
      this.fxFailed = true;
      return false;
    }
  }

  private applyFx() {
    if (!this.gain || !this.comp || !this.ctx) return;
    this.gain.disconnect();
    this.comp.disconnect();
    if (this.night) {
      this.gain.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    } else {
      this.gain.connect(this.ctx.destination);
    }
    this.gain.gain.value = this.boost * (this.night ? 1.6 : 1);
  }

  setFx(boost: number, night: boolean) {
    this.boost = boost;
    this.night = night;
    if (boost === 1 && !night && !this.ctx) return;
    if (this.ensureFx()) this.applyFx();
  }

  /** Capture the current frame as a PNG (base64, no prefix) */
  screenshot(): string | null {
    const v = this.el;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    try {
      c.getContext('2d')!.drawImage(v, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    } catch {
      return null;
    }
  }
}

export const engine = new Engine();
