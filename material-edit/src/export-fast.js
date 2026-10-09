// Fast, memory-bounded export: frame-exact decode (WebCodecs) → canvas composition → hardware/software
// encode (WebCodecs) → streaming muxer → file on disk. Much faster than real time; RAM use stays flat.
import { state, totalDuration, getMedia, allMediaClips } from './store.js';
import { drawFrame, setFrameResolver, fadeFactor } from './engine.js';
import { Muxer as Mp4Muxer, StreamTarget as Mp4Target } from './vendor/mp4-muxer.mjs';
import { Muxer as WebmMuxer, StreamTarget as WebmTarget } from './vendor/webm-muxer.mjs';
import { RangeReader, parseMp4, parseMp4Audio, parseMp3Audio, SeqDecoder, AudioStream } from './mp4demux.js';
import { createFileWriter, deleteExport } from './io.js';
import { clamp, yieldNow } from './util.js';

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

export async function pickVideoConfig(fmt, w, h, fps, bitrate, safe = false) {
  const list = fmt.vcodec === 'avc' ? avcCandidates(w, h, fps) : vp9Candidates(w, h, fps);
  for (const codec of list) {
    for (const hw of ['no-preference', 'prefer-software']) {
      const cfg = { codec, width: w, height: h, bitrate, bitrateMode: 'variable', framerate: fps, latencyMode: safe ? 'realtime' : 'quality', hardwareAcceleration: hw };
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
export class FrameSource {
  constructor(clip, media) { this.clip = clip; this.m = media; this.mode = 'seek'; this.why = ''; this.cur = null; this.dec = null; this.el = null; this.rot = null; }

  async init() {
    try {
      const reader = await new RangeReader(this.m.url).init();
      const tooBig = reader.whole && reader.size > 300e6;
      const info = tooBig ? null : await parseMp4(reader);
      if (info && (await SeqDecoder.supported(info))) {
        this.info = info; this.reader = reader; this.mode = 'hardware';
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
    // must be in the document (but invisible) so the browser keeps presenting frames
    Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
    el.src = this.m.url;
    await new Promise((res, rej) => {
      el.onloadeddata = res; el.onerror = () => rej(new Error('video load failed'));
      setTimeout(() => rej(new Error('video load timeout')), 20000);
    });
    document.body.append(el);
    this.el = el;
  }

  /**
   * Fallback when WebCodecs cannot decode the file: let the <video> element play forward (hardware decoded, no seeking)
   * and grab each frame with requestVideoFrameCallback. Seeking per frame would re-decode a whole GOP every time.
   */
  async _prepPlay(sec) {
    const el = this.el;
    let pl = this.pl;
    if (!pl) {
      const sfps = this.info && this.info.dur ? this.info.n / this.info.dur : 0;
      pl = this.pl = { t: -1, gap: sfps > 1 ? 1 / sfps : 1 / 30, cv: document.createElement('canvas'), want: -1, resolve: null, rate: 2, clean: 0 };
      pl.g = pl.cv.getContext('2d', { alpha: false });
      pl.cb = (now, meta) => {
        if (!this.el) return;
        if (pl.want >= 0 && meta.mediaTime >= pl.want - pl.gap / 2) {
          if (pl.cv.width !== el.videoWidth || pl.cv.height !== el.videoHeight) { pl.cv.width = el.videoWidth; pl.cv.height = el.videoHeight; }
          pl.g.drawImage(el, 0, 0);
          pl.t = meta.mediaTime; pl.want = -1; this.id = pl.t;
          el.pause(); // never run ahead of the exporter
          if (pl.resolve) { const r = pl.resolve; pl.resolve = null; r(); }
        }
        el.requestVideoFrameCallback(pl.cb);
      };
      el.requestVideoFrameCallback(pl.cb);
    }
    const dur = this.m.duration || el.duration || 0;
    const target = clamp(sec, 0, Math.max(0, dur - pl.gap));
    const tol = pl.gap / 2;
    const done = () => { this.cur = { src: pl.cv, w: pl.cv.width, h: pl.cv.height, m: this.m }; };
    if (pl.t >= 0 && pl.t <= target + tol && target < pl.t + pl.gap - tol) return done(); // still the same source frame
    for (let attempt = 0; attempt < 5; attempt++) {
      if (pl.t < 0 || target < pl.t - tol || target - pl.t > 2.5 || attempt > 0) {
        el.pause();
        el.currentTime = Math.max(0, target - (attempt ? 0.5 : 0)); // seek (rare): jumps, rewinds and recovery
        await new Promise((res) => { const f = () => { el.removeEventListener('seeked', f); res(); }; el.addEventListener('seeked', f); setTimeout(f, 4000); });
      }
      el.playbackRate = pl.rate;
      const got = new Promise((res) => { pl.resolve = res; });
      pl.want = target;
      try { await el.play(); } catch { /* autoplay policy – muted so normally fine */ }
      const ok = await Promise.race([got.then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))]);
      pl.want = -1; pl.resolve = null;
      if (!ok) { el.pause(); continue; }
      if (pl.t <= target + pl.gap * 1.5) { if (++pl.clean > 40 && pl.rate < 2) { pl.rate = Math.min(2, pl.rate * 1.5); pl.clean = 0; } return done(); } // exact
      pl.rate = Math.max(0.1, pl.rate / 2); // frames were skipped (decoder slower than the clock): slow the clock down
      pl.clean = 0;
    }
    done(); // best effort
  }

  async prepare(sec) {
    // hardware decoder first; if it errors, stalls or returns nothing → software decoder → <video> playback
    for (let tries = 0; this.dec && tries < 2; tries++) {
      try {
        const f = await this.dec.frameAt(sec);
        if (f) {
          if (this.rot) {
            if (this.rotId !== f.timestamp) {
            this.rotId = f.timestamp;
            const g = this.rot.getContext('2d');
            const { rotation: r, width: w, height: h } = this.info;
            g.save();
            g.translate(this.rot.width / 2, this.rot.height / 2);
            g.rotate((r * Math.PI) / 180);
            g.drawImage(f, -w / 2, -h / 2, w, h);
            g.restore();
            }
            this.cur = { src: this.rot, w: this.rot.width, h: this.rot.height, m: this.m };
          } else this.cur = { src: f, w: f.displayWidth, h: f.displayHeight, m: this.m };
          this.id = f.timestamp;
          return;
        }
        this.why = 'no frame returned';
      } catch (e) { this.why = String((e && e.message) || e); console.warn('decoder failed', this.why); }
      this.why += ` [${this.dec.diag()}]`;
      this.dec.close(); this.dec = null;
      if (tries === 0) { this.dec = new SeqDecoder(this.reader, this.info, { sw: true }); this.mode = 'software'; }
    }
    if (!this.el) await this._initElement();
    if (typeof this.el.requestVideoFrameCallback === 'function') { this.mode = 'playback'; return this._prepPlay(sec); }
    this.mode = 'seek';
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
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el.remove(); }
    this.cur = null; this.dec = null; this.el = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */
const audioClips = () => allMediaClips().filter((c) => c.kind !== 'image' && !c.muted && c.volume > 0 && getMedia(c.mediaId)?.url);

/**
 * Prepares one audio source per distinct media file.
 *  - MP4/MOV (AAC / Opus): streamed — only the second being mixed is ever decoded, so RAM stays flat for any length.
 *  - anything else: decoded once with decodeAudioData, only if the file is small enough.
 */
async function openAudio(signal) {
  const srcs = new Map();
  const ids = [...new Set(audioClips().map((c) => c.mediaId))];
  let used = 0;
  for (const id of ids) {
    if (signal.aborted) throw abortErr();
    const m = getMedia(id);
    try {
      const reader = await new RangeReader(m.url).init();
      if (!reader.whole) {
        let info = await parseMp4Audio(reader);
        if (info === null) continue; // no audio track
        if (info === undefined) info = await parseMp3Audio(reader);
        if (info && (await AudioStream.supported(info))) {
          const stream = new AudioStream(reader, info);
          try { if (await stream.window(0, 0.3)) { srcs.set(id, { stream }); continue; } } catch { /* decoder rejects this stream → full decode below */ }
          stream.close();
        }
      }
    } catch { /* fall through to full decode */ }
    const est = (m.duration || 0) * SR * 2 * 4;
    if (used + est > 600e6) throw new Error('memory');
    const res = await fetch(m.url);
    if ((+res.headers.get('content-length') || 0) > 200e6) throw new Error('memory');
    try {
      const ctx = new OfflineAudioContext(2, 1, SR);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      srcs.set(id, { buf });
      used += buf.length * buf.numberOfChannels * 4;
    } catch { /* no audio track → silent */ }
  }
  return srcs;
}

async function renderAudio(srcs, from, frames) {
  const ctx = new OfflineAudioContext(2, frames, SR);
  const to = from + frames / SR;
  for (const c of audioClips()) {
    const a = srcs.get(c.mediaId);
    const end = c.start + c.dur;
    if (!a || end <= from || c.start >= to) continue;
    const lt0 = Math.max(from, c.start) - c.start, lt1 = Math.min(to, end) - c.start;
    const when = c.start + lt0 - from;
    const speed = clamp(c.speed || 1, 0.0625, 16);
    const offset = c.in + lt0 * speed;
    let buf = a.buf, bufStart = 0;
    if (a.stream) {
      const w = await a.stream.window(offset, offset + (lt1 - lt0) * speed + 0.05);
      if (!w) continue;
      buf = ctx.createBuffer(w.data.length, w.data[0].length, w.rate);
      w.data.forEach((ch, k) => buf.copyToChannel(ch, k));
      bufStart = w.start;
    }
    if (!buf || offset >= bufStart + buf.duration) continue;
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
    const off = offset - bufStart;
    src.start(when + Math.max(0, -off) / speed, Math.max(0, off), (lt1 - lt0) * speed);
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
/** One line telling where the time goes — shown in the export window and useful for bug reports. */
function diagText(st, sources, started) {
  const all = Math.max(1, performance.now() - started);
  const pc = (k) => Math.round((st[k] / all) * 100);
  const modes = [...new Set([...sources.values()].map((s) => s.mode + (s.why && s.mode !== 'hardware' ? ` (${s.why.slice(0, 200)})` : '')))].join(', ') || '–';
  return `${st.reused ? `reused ${st.reused}/${st.frames} frames · ` : ''}decode ${pc('prep')}% · draw ${pc('draw')}% · encode ${pc('enc') + pc('wait')}% · audio ${pc('audio')}% · decoder: ${modes}`;
}

export async function exportFast(o) {
  const { width: W, height: H, fps, format: fmt, signal } = o;
  const duration = totalDuration();
  if (duration <= 0) throw new Error('empty');
  if (W * H > 8192 * 4608) throw new Error('memory');

  const vcfg = await pickVideoConfig(fmt, W, H, fps, o.bitrate, !!o.safe);
  if (!vcfg) throw new Error('unsupported');
  const acfg = audioConfig(fmt);
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('unsupported');

  const bufs = await openAudio(signal);
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

  const aborted = new Promise((_, rej) => { if (signal.aborted) rej(abortErr()); else signal.addEventListener('abort', () => rej(abortErr()), { once: true }); });
  aborted.catch(() => {});
  // lets Cancel take effect immediately, even while a decoder / encoder call is still pending
  const race = (p) => { Promise.resolve(p).catch(() => {}); return Promise.race([p, aborted]); };
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

  const st = o.stats || (o.stats = {});
  Object.assign(st, { prep: 0, draw: 0, enc: 0, audio: 0, wait: 0, frames: 0 });
  const lap = (k, t0) => { st[k] += performance.now() - t0; };
  const total = Math.max(1, Math.ceil(duration * fps));
  const started = performance.now();
  const keyEvery = Math.round(fps * 2);
  let base = null, lastKey = null; // last composited picture (re-used while nothing changes)
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
      let q0 = performance.now();
      await race(Promise.all(active.map(async (c) => {
        let s = sources.get(c.id);
        if (!s) { s = new FrameSource(c, getMedia(c.mediaId)); sources.set(c.id, s); await s.init(); }
        await s.prepare(c.in + (t - c.start) * c.speed);
      })));
      lap('prep', q0); q0 = performance.now();
      // redraw only when something visible changed (a new source frame, a fade, a transition, an animated title)
      let dirty = !base || !!o.noReuse, key = null;
      if (!dirty) {
        const act = [...state.main, ...state.overlay].filter((c) => t >= c.start && t < c.start + c.dur);
        const txt = state.text.filter((c) => t >= c.start && t < c.start + c.dur);
        if (state.main.filter((c) => t >= c.start && t < c.start + c.dur).length >= 2) dirty = true; // transition
        for (const c of act) { const lt = t - c.start; if ((c.fadeIn > 0 && lt < c.fadeIn) || (c.fadeOut > 0 && c.dur - lt < c.fadeOut)) dirty = true; }
        for (const c of txt) if (c.anim && c.anim !== 'none') dirty = true;
        if (!dirty) {
          for (const c of act) { const s = sources.get(c.id); if (c.kind === 'video' && (!s || s.id === undefined)) dirty = true; }
          key = act.map((c) => c.id + ':' + (sources.get(c.id)?.id ?? 'x')).join('|') + '#' + txt.map((c) => c.id).join(',');
          if (key !== lastKey) dirty = true;
        }
      }
      if (dirty) {
        drawFrame(g, W, H, t, null);
        if (base) base.close();
        base = new VideoFrame(cv, { timestamp: 0 });
        lastKey = key;
      } else st.reused = (st.reused || 0) + 1;
      lap('draw', q0); q0 = performance.now();
      const frame = new VideoFrame(base, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();
      lap('enc', q0); st.frames++;
      for (const [id, s] of sources) if (!active.some((c) => c.id === id) && t > s.clip.start + s.clip.dur) { s.close(); sources.delete(id); }
      if ((i + 1) % fps === 0 || i === total - 1) { const a0 = performance.now(); await race(pushAudio(i === total - 1 ? duration : (i + 1) / fps)); lap('audio', a0); }
      // back-pressure keeps encoder queues and pending disk writes bounded
      const w0 = performance.now();
      while (venc.encodeQueueSize > 8 || aenc.encodeQueueSize > 16 || writer.pending > 64e6) { if (fail) throw fail; if (signal.aborted) throw abortErr(); await sleep(4); }
      lap('wait', w0);
      if (i % 4 === 0) {
        const el = (performance.now() - started) / 1000;
        const speed = t / Math.max(el, 0.001);
        o.onProgress((i + 1) / total, { speed, eta: speed > 0 ? Math.max(0, (duration - t) / speed) : 0, diag: diagText(st, sources, started) });
      }
      await yieldNow(); // keep the window responsive (Cancel, dragging, repaint)
    }
    if (o.onPhase) o.onPhase('finishing');
    await race(venc.flush());
    await race(aenc.flush());
    if (fail) throw fail;
    muxer.finalize();
    await race(writer.drain());
  } catch (e) {
    // unfinished file is useless: stop queued writes, then remove it
    writer.abort();
    await writer.drain().catch(() => {});
    await deleteExport(o.path);
    throw e;
  } finally {
    setFrameResolver(null);
    try { base && base.close(); } catch { /* ignore */ }
    // release decoders/encoders after the UI had a chance to update (closing 4K hardware sessions can block briefly)
    setTimeout(() => {
      for (const a of bufs.values()) if (a.stream) a.stream.close();
      for (const s of sources.values()) s.close();
      for (const e of [venc, aenc]) { try { if (e.state !== 'closed') e.close(); } catch { /* ignore */ } }
    }, 0);
  }
  st.report = diagText(st, sources, started);
  o.onProgress(1, { speed: duration / Math.max((performance.now() - started) / 1000, 0.001), eta: 0 });
  return o.path ? null : writer.blob();
}
