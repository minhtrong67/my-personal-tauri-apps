// Minimal MP4/MOV video-track demuxer + sequential WebCodecs decoder.
// Reads the file with HTTP Range requests (local media server), so even huge files never sit in RAM.

const u32 = (d, o) => d.getUint32(o);
const u64 = (d, o) => d.getUint32(o) * 4294967296 + d.getUint32(o + 4);
const fourcc = (d, o) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
const hex = (n, w = 2) => n.toString(16).padStart(w, '0');
const dec = (n) => String(n).padStart(2, '0');

/** Range reader with a small read-ahead window. */
export class RangeReader {
  constructor(url) { this.url = url; this.size = 0; this.win = null; this.whole = null; }
  async init() {
    const r = await fetch(this.url, { headers: { Range: 'bytes=0-0' } });
    if (r.status === 206) {
      const m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
      this.size = m ? +m[1] : 0;
      await r.arrayBuffer();
    }
    if (!this.size) { // server ignores ranges (blob URL): keep the whole file
      const buf = r.status === 200 ? await r.arrayBuffer() : await (await fetch(this.url)).arrayBuffer();
      this.whole = new Uint8Array(buf);
      this.size = this.whole.length;
    }
    return this;
  }
  async read(start, len, ahead = 0) {
    len = Math.min(len, this.size - start);
    if (len <= 0) return new Uint8Array(0);
    if (this.whole) return this.whole.subarray(start, start + len);
    const w = this.win;
    if (w && start >= w.start && start + len <= w.start + w.data.length) return w.data.subarray(start - w.start, start - w.start + len);
    const want = Math.min(this.size - start, Math.max(len, ahead));
    const r = await fetch(this.url, { headers: { Range: `bytes=${start}-${start + want - 1}` } });
    if (r.status !== 206 && r.status !== 200) throw new Error('read failed ' + r.status);
    const data = new Uint8Array(await r.arrayBuffer());
    this.win = { start, data };
    return data.subarray(0, len);
  }
}

function* boxes(d, from, to) {
  let o = from;
  while (o + 8 <= to) {
    let size = u32(d, o);
    const type = fourcc(d, o + 4);
    let hdr = 8;
    if (size === 1) { size = u64(d, o + 8); hdr = 16; } else if (size === 0) size = to - o;
    if (size < hdr || o + size > to) return;
    yield { type, start: o, hdr, end: o + size, body: o + hdr };
    o += size;
  }
}
const find = (d, b, type) => { for (const x of boxes(d, b.body, b.end)) if (x.type === type) return x; return null; };

function codecString(fmt, d, cfg, bytes) {
  if (fmt === 'avc1' || fmt === 'avc3') return `avc1.${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}`;
  if (fmt === 'hvc1' || fmt === 'hev1') {
    const b = bytes;
    const space = ['', 'A', 'B', 'C'][b[1] >> 6];
    const tier = (b[1] >> 5) & 1 ? 'H' : 'L';
    const profile = b[1] & 31;
    let compat = (b[2] << 24 | b[3] << 16 | b[4] << 8 | b[5]) >>> 0, rev = 0;
    for (let i = 0; i < 32; i++) { rev = (rev << 1 | (compat & 1)) >>> 0; compat >>>= 1; }
    const cons = [...b.subarray(6, 12)].map((x) => hex(x)).join('.').replace(/(\.00)+$/, '');
    return `${fmt}.${space}${profile}.${rev.toString(16)}.${tier}${b[12]}${cons ? '.' + cons : ''}`;
  }
  if (fmt === 'vp09') { // vpcC: 4 bytes version/flags, profile, level, bitDepth<<4|...
    return `vp09.${dec(bytes[4])}.${dec(bytes[5])}.${dec(bytes[6] >> 4)}`;
  }
  if (fmt === 'av01') {
    const prof = bytes[1] >> 5, lvl = bytes[1] & 31, tier = bytes[2] >> 7 ? 'H' : 'M';
    const bd = (bytes[2] >> 6) & 1 ? ((bytes[2] >> 5) & 1 ? 12 : 10) : 8;
    return `av01.${prof}.${dec(lvl)}${tier}.${dec(bd)}`;
  }
  return null;
}


/** Sample tables (sizes, decode/composition times, key flags, absolute file offsets) of one track. */
function sampleTables(d, stbl) {
    const stts = find(d, stbl, 'stts'), ctts = find(d, stbl, 'ctts'), stsc = find(d, stbl, 'stsc');
    const stsz = find(d, stbl, 'stsz'), stss = find(d, stbl, 'stss');
    const stco = find(d, stbl, 'stco'), co64 = find(d, stbl, 'co64');
    const n = u32(d, stsz.body + 8);
    const sizes = new Uint32Array(n);
    const fixed = u32(d, stsz.body + 4);
    for (let i = 0; i < n; i++) sizes[i] = fixed || u32(d, stsz.body + 12 + i * 4);
    const dts = new Float64Array(n), cts = new Float64Array(n);
    let k = 0, t = 0;
    const sc = u32(d, stts.body + 4);
    for (let i = 0; i < sc && k < n; i++) {
      const cnt = u32(d, stts.body + 8 + i * 8), dl = u32(d, stts.body + 12 + i * 8);
      for (let j = 0; j < cnt && k < n; j++) { dts[k] = t; t += dl; k++; }
    }
    for (let i = 0; i < n; i++) cts[i] = dts[i];
    if (ctts) {
      const v = d.getUint8(ctts.body);
      const cc = u32(d, ctts.body + 4);
      k = 0;
      for (let i = 0; i < cc && k < n; i++) {
        const cnt = u32(d, ctts.body + 8 + i * 8);
        const off = v ? d.getInt32(ctts.body + 12 + i * 8) : u32(d, ctts.body + 12 + i * 8);
        for (let j = 0; j < cnt && k < n; j++) { cts[k] += off; k++; }
      }
    }
    const keys = new Uint8Array(n);
    if (stss) { const kc = u32(d, stss.body + 4); for (let i = 0; i < kc; i++) keys[u32(d, stss.body + 8 + i * 4) - 1] = 1; } else keys.fill(1);
    // chunk offsets → sample offsets
    const co = [];
    if (stco) { const c = u32(d, stco.body + 4); for (let i = 0; i < c; i++) co.push(u32(d, stco.body + 8 + i * 4)); }
    else if (co64) { const c = u32(d, co64.body + 4); for (let i = 0; i < c; i++) co.push(u64(d, co64.body + 8 + i * 8)); }
    else return null;
    const offsets = new Float64Array(n);
    const sn = u32(d, stsc.body + 4);
    let s = 0;
    for (let i = 0; i < sn; i++) {
      const first = u32(d, stsc.body + 8 + i * 12) - 1;
      const per = u32(d, stsc.body + 12 + i * 12);
      const next = i + 1 < sn ? u32(d, stsc.body + 8 + (i + 1) * 12) - 1 : co.length;
      for (let ch = first; ch < next && ch < co.length; ch++) {
        let o = co[ch];
        for (let j = 0; j < per && s < n; j++) { offsets[s] = o; o += sizes[s]; s++; }
      }
    }
    if (s !== n) return null;
  return { n, sizes, dts, cts, keys, offsets };
}

/** Parses the first video track. Returns null when the file is not an MP4/MOV with a supported codec. */
export async function parseMp4(reader) {
  // locate moov
  let pos = 0, moov = null;
  while (pos + 8 <= reader.size) {
    const head = await reader.read(pos, 16);
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = u32(dv, 0);
    const type = fourcc(dv, 4);
    if (size === 1) size = u64(dv, 8); else if (size === 0) size = reader.size - pos;
    if (size < 8) return null;
    if (type === 'moov') { moov = { pos, size }; break; }
    pos += size;
  }
  if (!moov || moov.size > 256e6) return null;
  const buf = await reader.read(moov.pos, moov.size, moov.size);
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const top = { body: 8, end: buf.length };
  for (const trak of boxes(d, top.body, top.end)) {
    if (trak.type !== 'trak') continue;
    const mdia = find(d, trak, 'mdia');
    if (!mdia) continue;
    const hdlr = find(d, mdia, 'hdlr');
    if (!hdlr || fourcc(d, hdlr.body + 8) !== 'vide') continue;
    const mdhd = find(d, mdia, 'mdhd');
    const ver = d.getUint8(mdhd.body);
    const timescale = u32(d, mdhd.body + (ver ? 20 : 12));
    const stbl = find(d, find(d, mdia, 'minf'), 'stbl');
    const stsd = find(d, stbl, 'stsd');
    const ent = stsd.body + 8;
    const fmt = fourcc(d, ent + 4);
    const width = d.getUint16(ent + 32), height = d.getUint16(ent + 34);
    let cfgBox = null, desc = null;
    let colr = null;
    for (const b of boxes(d, ent + 8 + 78, ent + u32(d, ent))) {
      if (['avcC', 'hvcC', 'vpcC', 'av1C'].includes(b.type)) cfgBox = b;
      else if (b.type === 'colr' && fourcc(d, b.body) === 'nclx') colr = { p: d.getUint16(b.body + 4), t: d.getUint16(b.body + 6), m: d.getUint16(b.body + 8), full: !!(d.getUint8(b.body + 10) & 0x80) };
    }
    if (!cfgBox) return null;
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset + cfgBox.body, cfgBox.end - cfgBox.body);
    const codec = codecString(fmt, d, cfgBox, bytes);
    if (!codec) return null;
    if (cfgBox.type === 'avcC' || cfgBox.type === 'hvcC') desc = bytes.slice();
    else if (cfgBox.type === 'av1C') desc = bytes.length > 4 ? bytes.slice(4) : null;

    // rotation from tkhd matrix
    let rotation = 0;
    const tkhd = find(d, trak, 'tkhd');
    if (tkhd) {
      const o = tkhd.body + (d.getUint8(tkhd.body) ? 52 : 40);
      const a = d.getInt32(o) / 65536, b2 = d.getInt32(o + 4) / 65536;
      rotation = ((Math.round((Math.atan2(b2, a) * 180) / Math.PI) % 360) + 360) % 360;
    }

    const tb = sampleTables(d, stbl);
    if (!tb) return null;
    const { n, sizes, dts, cts, keys, offsets } = tb;
    // presentation order → for "latest frame ≤ time" lookups
    const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => cts[x] - cts[y]);
    const swap = rotation === 90 || rotation === 270;
    // colour: use the file's tags; untagged video follows the same rule browsers use (HD → BT.709, SD → BT.601)
    const P = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m', 9: 'bt2020' }, T = { 1: 'bt709', 6: 'smpte170m', 13: 'iec61966-2-1', 16: 'pq', 18: 'hlg' }, Mx = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m', 9: 'bt2020-ncl' };
    const hd = height >= 720 || width >= 1280;
    const colorSpace = colr && P[colr.p] && Mx[colr.m]
      ? { primaries: P[colr.p], transfer: T[colr.t] || 'bt709', matrix: Mx[colr.m], fullRange: colr.full }
      : { primaries: hd ? 'bt709' : 'smpte170m', transfer: hd ? 'bt709' : 'smpte170m', matrix: hd ? 'bt709' : 'smpte170m', fullRange: false };
    let minC = Infinity; for (let i = 0; i < n; i++) if (cts[i] < minC) minC = cts[i];
    return { dur: (dts[n - 1] + (n > 1 ? dts[n - 1] - dts[n - 2] : 0)) / timescale, minCts: (minC / timescale) * 1e6, colorSpace, codec, desc, width, height, timescale, rotation, n, sizes, dts, cts, keys, offsets, order, dispW: swap ? height : width, dispH: swap ? width : height };
  }
  return null;
}

/** Sequential decoder with random access: frameAt(sourceSeconds) → VideoFrame (owned by the decoder). */
export class SeqDecoder {
  constructor(reader, info, opts = {}) {
    this.r = reader; this.i = info; this.sw = !!opts.sw; this.lastOut = 0; this.nFed = 0; this.nOut = 0;
    this.frames = [];       // sorted by timestamp (µs)
    this.next = 0;          // next sample (decode order) to feed
    this.maxTs = -1;
    this.waiter = null;
    this.error = null;
    this.flushed = false;
    this.want = 0;
    this.decoder = null;
    this.gen = 0;
  }
  static async supported(info) {
    if (typeof VideoDecoder === 'undefined') return false;
    try {
      const r = await VideoDecoder.isConfigSupported({ codec: info.codec, codedWidth: info.width, codedHeight: info.height, description: info.desc || undefined });
      return !!r.supported;
    } catch { return false; }
  }
  _open() {
    const gen = ++this.gen;
    this.decoder = new VideoDecoder({
      output: (f) => {
        if (gen !== this.gen) { f.close(); return; }
        this.lastOut = performance.now(); this.nOut++;
        this.frames.push(f);
        if (this.frames.length > 1 && f.timestamp < this.frames[this.frames.length - 2].timestamp) this.frames.sort((a, b) => a.timestamp - b.timestamp);
        this.maxTs = Math.max(this.maxTs, f.timestamp);
        this._prune();
        this._wake();
      },
      error: (e) => { this.error = e; this._wake(); },
    });
    this.decoder.configure({ codec: this.i.codec, codedWidth: this.i.width, codedHeight: this.i.height, description: this.i.desc || undefined, colorSpace: this.i.colorSpace, optimizeForLatency: false, hardwareAcceleration: this.sw ? 'prefer-software' : 'no-preference' });
  }
  diag() { return `fed ${this.nFed}, out ${this.nOut}, state ${this.decoder ? this.decoder.state : 'none'}, queue ${this.decoder ? this.decoder.decodeQueueSize : 0}${this.error ? ', error ' + this.error.message : ''}`; }
  _wake() { if (this.waiter) { const w = this.waiter; this.waiter = null; w(); } }
  _wait() { return new Promise((res) => { this.waiter = res; setTimeout(res, 2000); }); }
  _prune() {
    // keep the newest frame ≤ want and everything after it
    let keep = -1;
    for (let k = 0; k < this.frames.length; k++) if (this.frames[k].timestamp <= this.want) keep = k; else break;
    for (let k = 0; k < keep; k++) this.frames[k].close();
    if (keep > 0) this.frames.splice(0, keep);
  }
  _reset(sample) {
    try { this.decoder && this.decoder.state !== 'closed' && this.decoder.close(); } catch { /* ignore */ }
    this.gen++;
    for (const f of this.frames) f.close();
    this.frames = []; this.maxTs = -1; this.flushed = false; this.error = null;
    this.next = sample;
    this._open();
  }
  async _feed() {
    const i = this.i, s = this.next++;
    this.nFed++;
    const data = await this.r.read(i.offsets[s], i.sizes[s], 8 << 20);
    this.decoder.decode(new EncodedVideoChunk({
      type: i.keys[s] ? 'key' : 'delta',
      timestamp: Math.round((i.cts[s] / i.timescale) * 1e6),
      data,
    }));
  }
  /** Index (decode order) of the key sample to start from so that `ts` (µs) can be reached. */
  _keyFor(ts) {
    const i = this.i;
    let target = i.order[0];
    for (const s of i.order) { if ((i.cts[s] / i.timescale) * 1e6 <= ts) target = s; else break; }
    let k = target;
    while (k > 0 && !i.keys[k]) k--;
    return k;
  }
  async frameAt(sec) {
    const ts = Math.max(this.i.minCts || 0, Math.round(sec * 1e6));
    this.want = ts;
    if (!this.decoder) this._reset(this._keyFor(ts));
    const first = this.frames[0];
    const behind = first && first.timestamp > ts && this.frames.every((f) => f.timestamp > ts);
    const jump = this.maxTs >= 0 && ts - this.maxTs > 2e6 && this.next < this.i.n; // far ahead: skip to its key frame
    if (behind || (this.maxTs < 0 && this.next > 0 && this.flushed && ts < this.maxTs)) this._reset(this._keyFor(ts));
    else if (jump) { const k = this._keyFor(ts); if (k > this.next + 8) this._reset(k); }
    this._prune();
    let guard = 0;
    const t0 = performance.now();
    while (!(this.maxTs > ts) && !(this.flushed)) {
      if (this.error) throw this.error;
      if (performance.now() - Math.max(t0, this.lastOut) > 5000) throw new Error('decoder stalled');
      if (this.next < this.i.n) {
        if (this.decoder.decodeQueueSize < 6 && this.frames.length < 10) await this._feed();
        else await this._wait();
      } else {
        await this.decoder.flush();
        this.flushed = true;
        this._wake();
      }
      if (++guard > 100000) throw new Error('decoder stalled');
    }
    if (this.error) throw this.error;
    let pick = this.frames[0];
    for (const f of this.frames) if (f.timestamp <= ts) pick = f; else break;
    return pick || null;
  }
  close() {
    this.gen++;
    for (const f of this.frames) f.close();
    this.frames = [];
    try { this.decoder && this.decoder.state !== 'closed' && this.decoder.close(); } catch { /* ignore */ }
    this.decoder = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Audio track: streamed AAC / Opus decoding (never loads the file)   */
/* ------------------------------------------------------------------ */
function esdsConfig(d, b) {
  // esds: version/flags(4) then descriptors (tag, variable length, payload)
  let o = b.body + 4;
  const rd = () => { let len = 0; for (let i = 0; i < 4; i++) { const x = d.getUint8(o++); len = (len << 7) | (x & 0x7f); if (!(x & 0x80)) break; } return len; };
  let asc = null;
  while (o < b.end) {
    const tag = d.getUint8(o++), len = rd();
    if (tag === 0x03) o += 3;            // ES_ID + flags
    else if (tag === 0x04) o += 13;      // objectType … avgBitrate
    else if (tag === 0x05) { asc = new Uint8Array(d.buffer, d.byteOffset + o, len).slice(); break; }
    else o += len;
  }
  return asc;
}

/**
 * Parses the first audio track. `undefined` = not a parseable MP4/MOV, `null` = no audio track.
 */
export async function parseMp4Audio(reader) {
  let pos = 0, moov = null;
  while (pos + 8 <= reader.size) {
    const head = await reader.read(pos, 16);
    if (head.length < 8) return undefined;
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = u32(dv, 0);
    const type = fourcc(dv, 4);
    if (size === 1) size = u64(dv, 8); else if (size === 0) size = reader.size - pos;
    if (size < 8) return undefined;
    if (type === 'moov') { moov = { pos, size }; break; }
    pos += size;
  }
  if (!moov || moov.size > 256e6) return undefined;
  const buf = await reader.read(moov.pos, moov.size, moov.size);
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (const trak of boxes(d, 8, buf.length)) {
    if (trak.type !== 'trak') continue;
    const mdia = find(d, trak, 'mdia');
    const hdlr = mdia && find(d, mdia, 'hdlr');
    if (!hdlr || fourcc(d, hdlr.body + 8) !== 'soun') continue;
    const mdhd = find(d, mdia, 'mdhd');
    const timescale = u32(d, mdhd.body + (d.getUint8(mdhd.body) ? 20 : 12));
    const stbl = find(d, find(d, mdia, 'minf'), 'stbl');
    const stsd = find(d, stbl, 'stsd');
    const ent = stsd.body + 8;
    const fmt = fourcc(d, ent + 4);
    const ver = d.getUint16(ent + 16);
    const channels = d.getUint16(ent + 24);
    const rate = d.getUint16(ent + 32);
    const kids = ent + 8 + 28 + (ver === 1 ? 16 : ver === 2 ? 36 : 0);
    let codec = null, desc = null;
    for (const b of boxes(d, kids, ent + u32(d, ent))) {
      if (b.type === 'esds') {
        desc = esdsConfig(d, b);
        if (!desc) return undefined;
        codec = `mp4a.40.${desc[0] >> 3}`;
      } else if (b.type === 'dOps') {
        const ch = d.getUint8(b.body + 1), pre = d.getUint16(b.body + 2), sr = d.getUint32(b.body + 4), gain = d.getInt16(b.body + 8);
        if (d.getUint8(b.body + 10) !== 0) return undefined; // channel mapping tables not supported here
        desc = new Uint8Array(19);
        desc.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, ch]);
        const v = new DataView(desc.buffer);
        v.setUint16(10, pre, true); v.setUint32(12, sr, true); v.setInt16(16, gain, true);
        codec = 'opus';
      }
    }
    if (!codec) return undefined;
    if (fmt !== 'mp4a' && fmt !== 'Opus') return undefined;
    const tb = sampleTables(d, stbl);
    if (!tb) return undefined;
    // edit list: first non-empty edit tells where audio really starts (AAC priming)
    let shift = 0;
    const edts = find(d, trak, 'edts'), elst = edts && find(d, edts, 'elst');
    if (elst) {
      const v = d.getUint8(elst.body), cnt = u32(d, elst.body + 4);
      let o = elst.body + 8;
      for (let i = 0; i < cnt; i++) {
        const mt = v ? Number(d.getBigInt64(o + 8)) : d.getInt32(o + 4);
        if (mt >= 0) { shift = mt / timescale; break; }
        o += v ? 20 : 12;
      }
    }
    return { codec, desc, channels: channels || 2, rate: rate || 48000, timescale, shift, n: tb.n, sizes: tb.sizes, dts: tb.dts, offsets: tb.offsets };
  }
  return null;
}

/** Decodes arbitrary time windows of one audio track; memory use is limited to the window itself. */
export class AudioStream {
  constructor(reader, info) { this.r = reader; this.i = info; this.dec = null; this.out = []; this.err = null; }
  static async supported(info) {
    if (typeof AudioDecoder === 'undefined') return false;
    try { return !!(await AudioDecoder.isConfigSupported({ codec: info.codec, sampleRate: info.rate, numberOfChannels: info.channels, description: info.desc || undefined })).supported; } catch { return false; }
  }
  _t(s) { return this.i.dts[s] / this.i.timescale - this.i.shift; }
  _index(sec) { // last packet starting at or before sec
    const i = this.i; let lo = 0, hi = i.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this._t(mid) <= sec) lo = mid; else hi = mid - 1; }
    return lo;
  }
  _open() {
    if (this.dec && this.dec.state !== 'closed') { try { this.dec.close(); } catch { /* ignore */ } }
    this.out = []; this.err = null;
    this.dec = new AudioDecoder({ output: (a) => this.out.push(a), error: (e) => { this.err = e; } });
    this.dec.configure({ codec: this.i.codec, sampleRate: this.i.rate, numberOfChannels: this.i.channels, description: this.i.desc || undefined });
  }
  /** → { rate, start (s), data: Float32Array[] (planar) } covering at least [a, b] */
  async window(a, b) {
    const i = this.i;
    if (!i.n) return null;
    const first = Math.max(0, Math.min(this._index(Math.max(0, a)) - 4, i.n - 1));
    let last = Math.min(i.n - 1, this._index(Math.max(0, b)) + 1);
    this._open();
    for (let s = first; s <= last; s++) {
      const data = await this.r.read(i.offsets[s], i.sizes[s], 1 << 20);
      this.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round((this.i.dts[s] / this.i.timescale) * 1e6), data }));
      if (this.err) throw this.err;
    }
    await this.dec.flush();
    if (this.err) throw this.err;
    const outs = this.out; this.out = [];
    if (!outs.length) return null;
    outs.sort((x, y) => x.timestamp - y.timestamp);
    const ch = outs[0].numberOfChannels, rate = outs[0].sampleRate;
    let frames = 0; for (const o of outs) frames += o.numberOfFrames;
    const data = Array.from({ length: ch }, () => new Float32Array(frames));
    let at = 0;
    for (const o of outs) {
      for (let c = 0; c < ch; c++) o.copyTo(data[c].subarray(at, at + o.numberOfFrames), { planeIndex: c, format: 'f32-planar' });
      at += o.numberOfFrames; o.close();
    }
    return { rate, start: outs[0].timestamp / 1e6 - this.i.shift, data };
  }
  close() { try { this.dec && this.dec.state !== 'closed' && this.dec.close(); } catch { /* ignore */ } this.dec = null; }
}

/** MP3 (MPEG audio layer III): indexes the frames so AudioStream can decode any window. `undefined` = not an MP3. */
export async function parseMp3Audio(reader) {
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  let pos = 0;
  const head = await reader.read(0, 10);
  if (head.length >= 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) pos = 10 + ((head[6] & 127) << 21 | (head[7] & 127) << 14 | (head[8] & 127) << 7 | (head[9] & 127));
  const offs = [], sizes = [];
  let rate = 0, channels = 2, spf = 1152;
  const CH = 4 << 20;
  let win = new Uint8Array(0), wstart = 0;
  const at = async (p, n) => {
    if (p < wstart || p + n > wstart + win.length) { win = await reader.read(p, Math.min(CH, reader.size - p), CH); wstart = p; }
    return win.subarray(p - wstart, p - wstart + n);
  };
  while (pos + 4 <= reader.size) {
    const h = await at(pos, 4);
    if (h.length < 4) break;
    if (h[0] !== 0xff || (h[1] & 0xe0) !== 0xe0) {
      if (!offs.length) { pos++; if (pos > 65536) return undefined; continue; } // junk before the first frame
      // resync
      pos++; continue;
    }
    const ver = (h[1] >> 3) & 3, layer = (h[1] >> 1) & 3, bi = h[2] >> 4, si = (h[2] >> 2) & 3, pad = (h[2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) { pos++; continue; }
    const br = (ver === 3 ? BR1 : BR2)[bi] * 1000, sr = SR[ver][si];
    const len = Math.floor(((ver === 3 ? 144 : 72) * br) / sr) + pad;
    if (!rate) { rate = sr; channels = (h[3] >> 6) === 3 ? 1 : 2; spf = ver === 3 ? 1152 : 576; }
    if (sr !== rate) { pos++; continue; }
    offs.push(pos); sizes.push(len);
    pos += len;
  }
  if (offs.length < 4 || !rate) return undefined;
  const n = offs.length;
  const dts = new Float64Array(n);
  for (let i = 0; i < n; i++) dts[i] = i * spf;
  return { codec: 'mp3', desc: null, channels, rate, timescale: rate, shift: 0, n, sizes: Uint32Array.from(sizes), dts, offsets: Float64Array.from(offs) };
}
