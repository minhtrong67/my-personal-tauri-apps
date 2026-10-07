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

    // sample tables
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
    // presentation order → for "latest frame ≤ time" lookups
    const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => cts[x] - cts[y]);
    const swap = rotation === 90 || rotation === 270;
    // colour: use the file's tags; untagged video follows the same rule browsers use (HD → BT.709, SD → BT.601)
    const P = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m', 9: 'bt2020' }, T = { 1: 'bt709', 6: 'smpte170m', 13: 'iec61966-2-1', 16: 'pq', 18: 'hlg' }, Mx = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m', 9: 'bt2020-ncl' };
    const hd = height >= 720 || width >= 1280;
    const colorSpace = colr && P[colr.p] && Mx[colr.m]
      ? { primaries: P[colr.p], transfer: T[colr.t] || 'bt709', matrix: Mx[colr.m], fullRange: colr.full }
      : { primaries: hd ? 'bt709' : 'smpte170m', transfer: hd ? 'bt709' : 'smpte170m', matrix: hd ? 'bt709' : 'smpte170m', fullRange: false };
    return { colorSpace, codec, desc, width, height, timescale, rotation, n, sizes, dts, cts, keys, offsets, order, dispW: swap ? height : width, dispH: swap ? width : height };
  }
  return null;
}

/** Sequential decoder with random access: frameAt(sourceSeconds) → VideoFrame (owned by the decoder). */
export class SeqDecoder {
  constructor(reader, info) {
    this.r = reader; this.i = info;
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
        this.frames.push(f);
        if (this.frames.length > 1 && f.timestamp < this.frames[this.frames.length - 2].timestamp) this.frames.sort((a, b) => a.timestamp - b.timestamp);
        this.maxTs = Math.max(this.maxTs, f.timestamp);
        this._prune();
        this._wake();
      },
      error: (e) => { this.error = e; this._wake(); },
    });
    this.decoder.configure({ codec: this.i.codec, codedWidth: this.i.width, codedHeight: this.i.height, description: this.i.desc || undefined, colorSpace: this.i.colorSpace, optimizeForLatency: false });
  }
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
    const ts = Math.max(0, Math.round(sec * 1e6));
    this.want = ts;
    if (!this.decoder) this._reset(this._keyFor(ts));
    const first = this.frames[0];
    const behind = first && first.timestamp > ts && this.frames.every((f) => f.timestamp > ts);
    const jump = this.maxTs >= 0 && ts - this.maxTs > 2e6 && this.next < this.i.n; // far ahead: skip to its key frame
    if (behind || (this.maxTs < 0 && this.next > 0 && this.flushed && ts < this.maxTs)) this._reset(this._keyFor(ts));
    else if (jump) { const k = this._keyFor(ts); if (k > this.next + 8) this._reset(k); }
    this._prune();
    let guard = 0;
    while (!(this.maxTs > ts) && !(this.flushed)) {
      if (this.error) throw this.error;
      if (this.next < this.i.n) {
        if (this.decoder.decodeQueueSize < 6 && this.frames.length < 24) await this._feed();
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
