// Lightweight preview proxies: 2K/4K videos are re-encoded once to a small, keyframe-dense file so scrubbing and
// playback in the editor stay smooth. Export always uses the original file. Needs WebCodecs + an MP4 source.
import { Muxer, StreamTarget } from './vendor/mp4-muxer.mjs';
import { FrameSource, pickVideoConfig } from './export-fast.js';
import { inTauri, createFileWriter, tempPath, removeTemp, fileSize, serveFile } from './io.js';
import { emit, getMedia } from './store.js';
import { invalidate } from './engine.js';
import { settings } from './settings.js';
import { yieldNow } from './util.js';

const LONG_SIDE = 1280;
const jobs = new Map(); // mediaId -> AbortController
let chain = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const needsProxy = (m) => !!m && m.type === 'video' && !m.offline && !!m.url && Math.max(m.w, m.h) > 1920 && typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

/** Queues proxy creation for `m` (no-op for small/unsupported files or when disabled in settings). */
export function queueProxy(m) {
  if (!settings.proxy || !needsProxy(m) || m.proxyUrl || jobs.has(m.id)) return;
  const ctl = new AbortController();
  jobs.set(m.id, ctl);
  m.proxyP = 0;
  emit('proxy', m);
  chain = chain.then(() => run(m, ctl)).catch(() => {}).finally(() => {
    jobs.delete(m.id);
    m.proxyP = null;
    emit('proxy', m);
  });
}

/** While held (export window open), background proxy jobs pause so the UI stays responsive. */
let held = false;
export const holdProxies = (v) => { held = v; };

export function cancelProxies() { for (const c of jobs.values()) c.abort(); }

async function run(m, ctl) {
  const signal = ctl.signal;
  const key = inTauri && m.path ? `mve-proxy-${hash(m.path)}-${m.size}.mp4` : null;
  let path = null;
  if (key) {
    path = await tempPath(key);
    try { if ((await fileSize(path)) > 1024) { m.proxyUrl = (await serveFile(path)).url; invalidate(); return; } } catch { /* not cached yet */ }
  }
  const fs = new FrameSource({}, m);
  try {
    await fs.init();
    if (!fs.dec) return; // not an MP4 we can decode → keep using the original
    const k = LONG_SIDE / Math.max(fs.info.dispW, fs.info.dispH);
    const W = Math.max(2, Math.round((fs.info.dispW * k) / 2) * 2), H = Math.max(2, Math.round((fs.info.dispH * k) / 2) * 2);
    const srcFps = fs.info.n / Math.max(0.1, fs.info.dur || m.duration || 1);
    const fps = Math.round(Math.min(30, Math.max(12, srcFps || 30)));
    let cfg = null, codec = 'avc';
    for (const c of ['avc', 'vp9']) {
      cfg = await pickVideoConfig({ vcodec: c }, W, H, fps, 4e6);
      if (cfg) { codec = c; break; }
    }
    if (!cfg) return;
    cfg.latencyMode = 'realtime';
    const writer = createFileWriter(path, 'video/mp4');
    const muxer = new Muxer({
      target: new StreamTarget({ onData: (d, p) => writer.write(p, d), chunked: true, chunkSize: 4 << 20 }),
      video: { codec, width: W, height: H, frameRate: fps },
      fastStart: false, firstTimestampBehavior: 'offset',
    });
    let fail = null;
    const enc = new VideoEncoder({ output: (c, meta) => muxer.addVideoChunk(c, meta), error: (e) => { fail = e; } });
    enc.configure(cfg);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { alpha: false });
    g.imageSmoothingQuality = 'high';
    const total = Math.floor((m.duration || 0) * fps);
    try {
      for (let i = 0; i < total; i++) {
        if (signal.aborted || !getMedia(m.id)) throw new DOMException('cancelled', 'AbortError');
        if (fail) throw fail;
        while (held && !signal.aborted) await sleep(150);
        await yieldNow();
        await fs.prepare(i / fps);
        g.drawImage(fs.cur.src, 0, 0, W, H);
        const f = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
        enc.encode(f, { keyFrame: i % 8 === 0 });
        f.close();
        while (enc.encodeQueueSize > 6 || writer.pending > 16e6) { if (fail) throw fail; await sleep(3); }
        if (i % 6 === 0) { m.proxyP = i / total; emit('proxy', m); await sleep(1); }
      }
      await enc.flush();
      if (fail) throw fail;
      muxer.finalize();
      await writer.drain();
    } finally {
      try { if (enc.state !== 'closed') enc.close(); } catch { /* ignore */ }
    }
    m.proxyUrl = path ? (await serveFile(path)).url : URL.createObjectURL(writer.blob());
    invalidate();
  } catch (e) {
    if (path) removeTemp(path);
    throw e;
  } finally {
    fs.close();
  }
}
