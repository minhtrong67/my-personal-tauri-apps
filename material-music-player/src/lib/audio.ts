import { convertFileSrc } from '@tauri-apps/api/core';
import { tr } from './i18n';

export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  rock: [5, 3, -1, -3, -1, 2, 4, 5, 5, 5],
  pop: [-1, 2, 4, 5, 3, 0, -1, -1, -1, -2],
  jazz: [3, 2, 0, 2, -2, -2, 0, 2, 3, 4],
  classical: [4, 3, 3, 2, -1, -1, 0, 2, 3, 4],
  edm: [6, 5, 3, 0, 0, -2, -1, 0, 3, 4],
};

/**
 * Bộ máy phát nhạc: HTMLAudioElement + (tuỳ chọn) chuỗi Web Audio cho EQ & visualizer.
 * Nếu giao thức asset không cho phép CORS thì tự động phát trực tiếp, không qua Web Audio.
 */
class Engine {
  audio: HTMLAudioElement;
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  path: string | null = null;
  eqEnabled = false;
  eqGains: number[] = Array(10).fill(0);
  preampDb = 0;
  corsFailed = false;

  private preamp: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private corsOk = false;
  private fallbackTried = false;
  private pendingStart = 0;
  private wantPlay = false;
  private freq = new Uint8Array(0);

  onEnded: () => void = () => {};
  onError: (msg: string) => void = () => {};
  onTime: (t: number) => void = () => {};
  onDuration: (d: number) => void = () => {};
  onPlayState: (p: boolean) => void = () => {};
  onPlaying: () => void = () => {};

  constructor() {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    this.audio = a;
    a.addEventListener('timeupdate', () => this.onTime(a.currentTime));
    a.addEventListener('durationchange', () => {
      if (isFinite(a.duration)) this.onDuration(a.duration);
    });
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('play', () => this.onPlayState(true));
    a.addEventListener('pause', () => this.onPlayState(false));
    a.addEventListener('playing', () => this.onPlaying());
    a.addEventListener('loadedmetadata', () => this.handleLoaded());
    a.addEventListener('error', () => this.handleError());
  }

  get fxAvailable() {
    return !this.corsFailed;
  }

  load(path: string, play: boolean, startAt = 0) {
    this.path = path;
    this.fallbackTried = false;
    this.pendingStart = startAt;
    this.wantPlay = play;
    if (this.corsFailed) this.audio.removeAttribute('crossorigin');
    else this.audio.crossOrigin = 'anonymous';
    this.audio.src = convertFileSrc(path);
    this.audio.load();
    if (play) void this.play();
  }

  private handleLoaded() {
    const a = this.audio;
    if (this.pendingStart > 0) {
      try {
        a.currentTime = this.pendingStart;
      } catch {
        /* ignore */
      }
      this.pendingStart = 0;
    }
    if (a.crossOrigin !== null) {
      this.corsOk = true;
      if (!a.paused) this.ensureGraph();
    } else if (this.fallbackTried) {
      this.corsFailed = true;
    }
  }

  private handleError() {
    const a = this.audio;
    if (!this.fallbackTried && !this.corsOk && a.crossOrigin !== null && this.path && !this.ctx) {
      this.fallbackTried = true;
      a.removeAttribute('crossorigin');
      a.src = convertFileSrc(this.path);
      a.load();
      if (this.wantPlay) void this.play();
      return;
    }
    this.onError(a.error?.message || tr('cannotPlayFile'));
  }

  private ensureGraph() {
    if (this.ctx || !this.corsOk || this.corsFailed) return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(this.audio);
      const preamp = ctx.createGain();
      const filters = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking';
        f.frequency.value = EQ_FREQS[i];
        f.Q.value = 1;
        f.gain.value = 0;
        return f;
      });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      let node: AudioNode = src;
      node.connect(preamp);
      node = preamp;
      for (const f of filters) {
        node.connect(f);
        node = f;
      }
      node.connect(analyser);
      analyser.connect(ctx.destination);
      this.ctx = ctx;
      this.preamp = preamp;
      this.filters = filters;
      this.analyser = analyser;
      this.freq = new Uint8Array(analyser.frequencyBinCount);
      this.applyEq();
    } catch {
      this.corsFailed = true;
    }
  }

  play() {
    this.wantPlay = true;
    if (this.corsOk) this.ensureGraph();
    void this.ctx?.resume();
    return this.audio.play().catch(() => undefined);
  }

  pause() {
    this.wantPlay = false;
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) void this.play();
    else this.pause();
  }

  seek(t: number) {
    if (this.audio.readyState < 1) this.pendingStart = t;
    else this.audio.currentTime = t;
  }

  setVolume(v: number, muted: boolean) {
    this.audio.volume = Math.min(1, Math.max(0, v));
    this.audio.muted = muted;
  }

  setRate(r: number) {
    this.audio.defaultPlaybackRate = r;
    this.audio.playbackRate = r;
  }

  setEq(enabled: boolean, gains: number[], preampDb: number) {
    this.eqEnabled = enabled;
    this.eqGains = gains;
    this.preampDb = preampDb;
    this.applyEq();
  }

  private applyEq() {
    if (!this.ctx || !this.preamp) return;
    this.preamp.gain.value = this.eqEnabled ? Math.pow(10, this.preampDb / 20) : 1;
    this.filters.forEach((f, i) => (f.gain.value = this.eqEnabled ? this.eqGains[i] ?? 0 : 0));
  }

  getSpectrum(): Uint8Array | null {
    if (!this.analyser || this.audio.paused) return null;
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }
}

export const engine = new Engine();
