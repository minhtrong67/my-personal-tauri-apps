import type { Track } from './types';
import { dirname } from './utils';

export function buildM3U(tracks: Track[]) {
  const out = ['#EXTM3U'];
  for (const t of tracks) {
    out.push(`#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}`);
    out.push(t.path);
  }
  return out.join('\r\n') + '\r\n';
}

const isAbsolute = (p: string) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\') || p.startsWith('/');

export function parseM3U(text: string, m3uPath: string): string[] {
  const base = dirname(m3uPath);
  const paths: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.replace(/^file:\/\/\//i, '');
    paths.push(isAbsolute(p) ? p.replace(/\//g, '\\') : `${base}\\${p.replace(/\//g, '\\')}`);
  }
  return paths;
}
