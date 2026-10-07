// Fast, memory-bounded export: frame-exact decode (WebCodecs) → canvas composition → hardware/software
// encode (WebCodecs) → streaming muxer → file on disk. Much faster than real time; RAM use stays flat.
import { state, totalDuration, getMedia, allMediaClips } from './store.js';
import { drawFrame, setFrameResolver, fadeFactor } from './engine.js';
import { Muxer as Mp4Muxer, StreamTarget as Mp4Target } from './vendor/mp4-muxer.mjs';
import { Muxer as WebmMuxer, StreamTarget as WebmTarget } from './vendor/webm-muxer.mjs';
import { RangeReader, parseMp4, SeqDecoder } from './mp4demux.js';
import { createFileWriter } from './io.js';
import { clamp } from './util.js';

const SR = 48000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const abortErr = () => new DOMException('Export cancelled', 'AbortError');

/** Container / codec combinations the fast path can produce. */
export const FAST_FORMATS = [
  { id: 'mp4', container: 'mp4', vcodec: 'avc', acodec: 'aac', ext: 'mp4', label: 'MP4 (H.264 + AAC)' },
  { id: 'mp4-vp9', container: 'mp4', vcodec: 'vp9', acodec: 'opus', ext: 'mp4', label: 'MP4 (VP9 + Opus)' },
  { id: 'webm', container: 'webm', vcodec: 'vp9', acodec: 'opus', ext: 'webm', label: 'WebM (VP9 + Opus)' },
];

function avcCandidates(w, h, fps) {
  const mbps = Math.ceil(w / 16) * Math.ceil(h / 16) * fps;
  const lv = [[108000, '1F'], [245760, '28'], [522240, '2A'], [983040, '33'], [2073600, '34']];
  const out = lv.filter(([m]) => m >= mbps).map(([, c]) => `avc1.6400${c}`);
  return out.length ? out : ['avc1.640034'];
}
function vp9Candidates(w, h, fps) {
  const pr = w * h * fps;
  const lv = [[27.6e6, '31'], [83.9e6, '40'], [160e6, '41'], [311e6, '50'], [676e6, '51'], [1.4e9, '52']];
  const out = lv.filter(([m]) => m >= pr).map(([, c]) => `vp09.00.${c}.08`);
  return out.length ? out : ['vp09.00.52.08'];
}

async function pickVideoConfig(fmt, w, h, fps, bitrate) {
  const list = fmt.vcodec === 'avc' ? avcCandidates(w, h, fps) : vp9Candidates(w, h, fps);
  for (const codec of list) {
    for (const hw of ['no-preference', 'prefer-software']) {
      const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: fmt.vcodec === 'vp9' ? 'realtime' : 'quality', hardwareAcceleration: hw };
      if (fmt.vcodec === 'avc') cfg.avc = { format: 'avc' };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return r.config; } catch { /* next */ }
    }
  }
  return null;
}
const audioConfig = (fmt) => ({ codec: fmt.acodec === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate: SR, numberOfChannels: 2, bitrate: 192000 });

/** Which formats can the fast path write here? */
export async function fastFormats(w = 1920, h = 1080, fps = 30) {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined' || typeof VideoFrame === 'undefined') return [];
  const out = [];
  for (const f of FAST_FORMATS) {
    try {
      const v = await pickVideoConfig(f, w, h, fps, 8e6);
      const a = await AudioEncoder.isConfigSupported(audioConfig(f));
      if (v && a.supported) out.push(f);
    } catch { /* unsupported */ }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Video frame sources                                                */
/* ------------------------------------------------------------------ */
class FrameSource {
  constructor(clip, media) { this.clip = clip; this.m = media; this.cur = null; this.dec = null; this.el = null; this.rot = null; }

  async init() {
    try {
      const reader = await new RangeReader(this.m.url).init();
      const tooBig = reader.whole && reader.size > 300e6;
      const info = tooBig ? null : await parseMp4(reader);
      if (info && (await SeqDecoder.supported(info))) {
        this.info = info;
        this.dec = new SeqDecoder(reader, info);
        if (info.rotation) {
          this.rot = document.createElement('canvas');
          this.rot.width = info.dispW; this.rot.height = info.dispH;
        }
        return;
      }
    } catch { /* fall back to seeking */ }
    await this._initElement();
  }

  async _initElement() {
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous'; el.muted = true; el.preload = 'auto'; el.playsInline = true;
    el.src = this.m.url;
    await new Promise((res, rej) => {
      el.onloadeddata = res; el.onerror = () => rej(new Error('video load failed'));
      setTimeout(() => rej(new Error('video load timeout')), 20000);
    });
    this.el = el;
  }

  async prepare(sec) {
    if (this.dec) {
      try {
        const f = await this.dec.frameAt(sec);
        if (f) {
          if (this.rot) {
            const g = this.rot.getContext('2d');
            const { rotation: r, width: w, height: h } = this.info;
            g.save();
            g.translate(this.rot.width / 2, this.rot.height / 2);
            g.rotate((r * Math.PI) / 180);
            g.drawImage(f, -w / 2, -h / 2, w, h);
            g.restore();
            this.cur = { src: this.rot, w: this.rot.width, h: this.rot.height, m: this.m };
          } else this.cur = { src: f, w: f.displayWidth, h: f.displayHeight, m: this.m };
          return;
        }
      } catch {
        // decoder failed mid-way: switch this clip to the seek-based path
        this.dec.close(); this.dec = null;
        await this._initElement();
      }
    }
    const el = this.el;
    const target = Math.min(sec, Math.max(0, (this.m.duration || el.duration || 0) - 0.02));
    if (Math.abs(el.currentTime - target) > 0.0005) {
      el.currentTime = target;
      await new Promise((res) => {
        const done = () => { el.removeEventListener('seeked', done); res(); };
        el.addEventListener('seeked', done);
        setTimeout(done, 3000);
      });
    }
    this.cur = { src: el, w: el.videoWidth, h: el.videoHeight, m: this.m };
  }

  close() {
    if (this.dec) this.dec.close();
    if (this.el) { this.el.removeAttribute('src'); this.el.load(); }
    this.cur = null; this.dec = null; this.el = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */
const audioClips = () => allMediaClips().filter((c) => c.kind !== 'image' && !c.muted && c.volume > 0 && getMedia(c.mediaId)?.url);

function memoryBudget() {
  const gb = navigator.deviceMemory || 4; // capped at 8 by browsers
  return clamp(gb * 128e6, 256e6, 1e9);
}

/** Decodes each distinct media file once (48 kHz stereo). Throws 'memory' if the budget would be exceeded. */
async function decodeAudio(signal) {
  const bufs = new Map();
  const ids = [...new Set(audioClips().map((c) => c.mediaId))];
  let used = 0;
  const budget = memoryBudget();
  for (const id of ids) {
    if (signal.aborted) throw abortErr();
    const m = getMedia(id);
    const est = (m.duration || 0) * SR * 2 * 4;
    if (used + est > budget) throw new Error('memory');
    const res = await fetch(m.url);
    const len = +res.headers.get('content-length') || 0;
    if (len > 256e6) throw new Error('memory');
    let ab = await res.arrayBuffer();
    try {
      const ctx = new OfflineAudioContext(2, 1, SR);
      const buf = await ctx.decodeAudioData(ab);
      bufs.set(id, buf);
      used += buf.length * 2 * 4;
    } catch { /* no audio track → silent */ }
    ab = null;
  }
  return bufs;
}

async function renderAudio(bufs, from, frames) {
  const ctx = new OfflineAudioContext(2, frames, SR);
  const to = from + frames / SR;
  for (const c of audioClips()) {
    const buf = bufs.get(c.mediaId);
    const end = c.start + c.dur;
    if (!buf || end <= from || c.start >= to) continue;
    const lt0 = Math.max(from, c.start) - c.start, lt1 = Math.min(to, end) - c.start;
    const when = c.start + lt0 - from;
    const speed = clamp(c.speed || 1, 0.0625, 16);
    const offset = c.in + lt0 * speed;
    if (offset >= buf.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = speed;
    const gain = ctx.createGain();
    const vol = clamp(c.volume, 0, 4);
    const gv = (lt) => vol * fadeFactor(c, lt);
    gain.gain.setValueAtTime(gv(lt0), when);
    for (const bp of [c.fadeIn, c.dur - c.fadeOut]) if (bp > lt0 && bp < lt1) gain.gain.linearRampToValueAtTime(gv(bp), when + (bp - lt0));
    gain.gain.linearRampToValueAtTime(gv(lt1), when + (lt1 - lt0));
    src.connect(gain).connect(ctx.destination);
    src.start(when, offset, (lt1 - lt0) * speed);
  }
  return ctx.startRendering();
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */
/**
 * @param {{width:number,height:number,fps:number,bitrate:number,format:typeof FAST_FORMATS[number],
 *          path:string|null,signal:AbortSignal,onProgress:(p:number,info:{speed:number,eta:number})=>void}} o
 * @returns {Promise<Blob|null>} a Blob in the browser, null when written to disk
 */
export async function exportFast(o) {
  const { width: W, height: H, fps, format: fmt, signal } = o;
  const duration = totalDuration();
  if (duration <= 0) throw new Error('empty');
  if (W * H > 8192 * 4608) throw new Error('memory');

  const vcfg = await pickVideoConfig(fmt, W, H, fps, o.bitrate);
  if (!vcfg) throw new Error('unsupported');
  const acfg = audioConfig(fmt);
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('unsupported');

  const bufs = await decodeAudio(signal);
  const writer = createFileWriter(o.path, fmt.container === 'mp4' ? 'video/mp4' : 'video/webm');
  const onData = (data, pos) => writer.write(pos, data);
  const hasAudio = true;
  const muxer = fmt.container === 'mp4'
    ? new Mp4Muxer({
      target: new Mp4Target({ onData, chunked: true, chunkSize: 8 << 20 }),
      video: { codec: fmt.vcodec, width: W, height: H, frameRate: fps },
      audio: hasAudio ? { codec: fmt.acodec, numberOfChannels: 2, sampleRate: SR } : undefined,
      fastStart: false, firstTimestampBehavior: 'offset',
    })
    : new WebmMuxer({
      target: new WebmTarget({ onData, chunked: true, chunkSize: 8 << 20 }),
      video: { codec: 'V_VP9', width: W, height: H, frameRate: fps },
      audio: hasAudio ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: SR } : undefined,
      firstTimestampBehavior: 'offset',
    });

  let fail = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { fail = e; } });
  venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { fail = e; } });
  aenc.configure(acfg);

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { alpha: false });
  const sources = new Map();
  const videoClips = () => [...state.main, ...state.overlay].filter((c) => c.kind === 'video' && getMedia(c.mediaId)?.url);
  setFrameResolver((c, m) => { const s = sources.get(c.id); return s && s.cur ? s.cur : (c.kind === 'image' ? null : { src: null, w: 0, h: 0, m }); });

  const total = Math.max(1, Math.ceil(duration * fps));
  const started = performance.now();
  const keyEvery = Math.round(fps * 2);
  let audioDone = 0; // seconds already encoded
  const ABLK = 1; // seconds per audio block

  const pushAudio = async (upTo) => {
    while (audioDone < upTo - 1e-6 && audioDone < duration) {
      const frames = Math.min(Math.round(ABLK * SR), Math.round((duration - audioDone) * SR));
      if (frames <= 0) break;
      const ab = await renderAudio(bufs, audioDone, frames);
      const planar = new Float32Array(frames * 2);
      planar.set(ab.getChannelData(0), 0);
      planar.set(ab.getChannelData(1), frames);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: frames, numberOfChannels: 2, timestamp: Math.round(audioDone * 1e6), data: planar });
      aenc.encode(ad);
      ad.close();
      audioDone += frames / SR;
    }
  };

  try {
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw abortErr();
      if (fail) throw fail;
      const t = i / fps;
      const active = videoClips().filter((c) => t >= c.start && t < c.start + c.dur);
      await Promise.all(active.map(async (c) => {
        let s = sources.get(c.id);
        if (!s) { s = new FrameSource(c, getMedia(c.mediaId)); sources.set(c.id, s); await s.init(); }
        await s.prepare(c.in + (t - c.start) * c.speed);
      }));
      drawFrame(g, W, H, t, null);
      const frame = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();
      for (const [id, s] of sources) if (!active.some((c) => c.id === id) && t > s.clip.start + s.clip.dur) { s.close(); sources.delete(id); }
      if ((i + 1) % fps === 0 || i === total - 1) await pushAudio(i === total - 1 ? duration : (i + 1) / fps);
      // back-pressure keeps encoder queues and pending disk writes bounded
      while (venc.encodeQueueSize > 8 || aenc.encodeQueueSize > 16 || writer.pending > 64e6) { if (fail) throw fail; if (signal.aborted) throw abortErr(); await sleep(4); }
      if (i % 4 === 0) {
        const el = (performance.now() - started) / 1000;
        const speed = t / Math.max(el, 0.001);
        o.onProgress((i + 1) / total, { speed, eta: speed > 0 ? Math.max(0, (duration - t) / speed) : 0 });
        if (i % 8 === 0) await sleep(0); // let the UI paint
      }
    }
    await venc.flush();
    await aenc.flush();
    if (fail) throw fail;
    muxer.finalize();
    await writer.drain();
  } finally {
    setFrameResolver(null);
    for (const s of sources.values()) s.close();
    for (const e of [venc, aenc]) { try { if (e.state !== 'closed') e.close(); } catch { /* ignore */ } }
  }
  o.onProgress(1, { speed: duration / Math.max((performance.now() - started) / 1000, 0.001), eta: 0 });
  return o.path ? null : writer.blob();
}
