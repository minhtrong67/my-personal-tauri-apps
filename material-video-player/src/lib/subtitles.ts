import type { Cue } from './types';

const TIME = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toSec(m: RegExpMatchArray) {
  return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4].padEnd(3, '0').slice(0, 3), 10) / 1000;
}

function parseSrtVtt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const ma = a.trim().match(TIME);
    const mb = b.trim().match(TIME);
    if (!ma || !mb) continue;
    const text = lines.slice(i + 1).join('\n').trim();
    if (text) cues.push({ start: toSec(ma), end: toSec(mb), text });
  }
  return cues;
}

function assTime(s: string) {
  const m = s.trim().match(/(\d+):(\d{2}):(\d{2})[.:](\d{1,3})/);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4].padEnd(2, '0').slice(0, 2), 10) / 100;
}

function parseAss(raw: string): Cue[] {
  const cues: Cue[] = [];
  let inEvents = false;
  let fmt: string[] = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (/^\[events\]/i.test(t)) { inEvents = true; continue; }
    if (/^\[/.test(t)) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (/^format:/i.test(t)) { fmt = t.slice(7).split(',').map((s) => s.trim().toLowerCase()); continue; }
    if (!/^dialogue:/i.test(t)) continue;
    const iStart = fmt.indexOf('start') >= 0 ? fmt.indexOf('start') : 1;
    const iEnd = fmt.indexOf('end') >= 0 ? fmt.indexOf('end') : 2;
    const iText = fmt.indexOf('text') >= 0 ? fmt.indexOf('text') : 9;
    const parts = t.slice(9).split(',');
    const text = parts.slice(iText).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
    const start = assTime(parts[iStart] ?? '');
    const end = assTime(parts[iEnd] ?? '');
    if (text && isFinite(start) && isFinite(end)) cues.push({ start, end, text });
  }
  return cues;
}

export function parseSubtitle(raw: string, ext: string): Cue[] {
  const text = raw.replace(/^\uFEFF/, '');
  const cues = ext === 'ass' || ext === 'ssa' ? parseAss(text) : parseSrtVtt(text);
  return cues.sort((a, b) => a.start - b.start);
}

/** Cues visible at time t (supports overlapping cues) */
export function activeCues(cues: Cue[], t: number): Cue[] {
  if (!cues.length) return [];
  let lo = 0;
  let hi = cues.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const out: Cue[] = [];
  for (let i = idx; i >= 0 && i > idx - 8; i--) if (t < cues[i].end) out.unshift(cues[i]);
  return out;
}

export interface RichSeg { text: string; i: boolean; b: boolean; u: boolean }

/** Convert subtitle text to line/segments, keeping only <i> <b> <u> */
export function toRich(text: string): RichSeg[][] {
  return text.split('\n').map((line) => {
    const segs: RichSeg[] = [];
    let i = false, b = false, u = false;
    const re = /<(\/?)([a-z]+)[^>]*>|\{[^}]*\}/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    const push = (s: string) => s && segs.push({ text: s, i, b, u });
    while ((m = re.exec(line))) {
      push(line.slice(last, m.index));
      last = m.index + m[0].length;
      const tag = m[2]?.toLowerCase();
      const close = m[1] === '/';
      if (tag === 'i') i = !close; else if (tag === 'b') b = !close; else if (tag === 'u') u = !close;
    }
    push(line.slice(last));
    return segs;
  });
}
