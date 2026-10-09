export interface LyricLine {
  time: number;
  text: string;
}
export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
}

/** Phân tích lời bài hát dạng .lrc ([mm:ss.xx]) hoặc văn bản thường */
export function parseLyrics(raw: string): Lyrics {
  const lines: LyricLine[] = [];
  const plain: string[] = [];
  const timeRe = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const row of raw.split(/\r?\n/)) {
    const tags = [...row.matchAll(timeRe)];
    if (tags.length === 0) {
      if (/^\[[a-zA-Z]+:.*\]$/.test(row.trim())) continue; // [ar:..] [ti:..]
      plain.push(row.trim());
      continue;
    }
    const text = row.replace(timeRe, '').trim();
    for (const m of tags) {
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
      lines.push({ time: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac, text });
    }
  }
  if (lines.length > 0) {
    lines.sort((a, b) => a.time - b.time);
    return { synced: true, lines };
  }
  return { synced: false, lines: plain.map((text) => ({ time: 0, text })) };
}

export function activeLine(lines: LyricLine[], t: number) {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t + 0.15) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
