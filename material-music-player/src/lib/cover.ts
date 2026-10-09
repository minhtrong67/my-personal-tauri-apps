import { useEffect, useState } from 'react';
import { getCover, assetUrl } from './tauri';
import type { Track } from './types';

/** Ảnh bìa dự phòng cho bài cũ chưa có trường `cover` (khóa theo id bài hát, không theo thư mục/album) */
const legacy = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let active = 0;
const waiters: Array<() => void> = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= 4) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

/** string = có ảnh, null = chắc chắn không có, undefined = chưa biết (bài cũ) */
export function coverUrlOf(t: Track): string | null | undefined {
  if (t.cover) return assetUrl(t.cover);
  if (t.cover === '') return null;
  return undefined;
}

export function loadCover(t: Track): Promise<string | null> {
  if (legacy.has(t.id)) return Promise.resolve(legacy.get(t.id)!);
  let p = pending.get(t.id);
  if (!p) {
    p = limited(() => getCover(t.path, false))
      .then((r) => {
        const u = r ? assetUrl(r.file) : null;
        legacy.set(t.id, u); // chỉ nhớ kết quả thật; lỗi tạm thời sẽ không bị nhớ
        return u;
      })
      .catch(() => null)
      .finally(() => pending.delete(t.id));
    pending.set(t.id, p);
  }
  return p;
}

/** Ghi lại tệp ảnh bìa nếu bộ nhớ đệm đã bị xóa */
export const restoreCover = (t: Track) => getCover(t.path, false).then((r) => !!r).catch(() => false);

export function useCover(t: Track | undefined, enabled = true): string | null {
  const direct = t ? coverUrlOf(t) : null;
  const [lazy, setLazy] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!t || !enabled || direct !== undefined) return;
    let alive = true;
    loadCover(t).then((u) => alive && setLazy({ id: t.id, url: u }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id, enabled, direct]);
  if (!t) return null;
  if (direct !== undefined) return direct;
  if (lazy && lazy.id === t.id) return lazy.url;
  return legacy.get(t.id) ?? null;
}

/** Lấy màu chủ đạo từ ảnh bìa (dùng cho Dynamic Color) */
const seedCache = new Map<string, string | null>();
export async function seedFromCover(t: Track): Promise<string | null> {
  if (seedCache.has(t.id)) return seedCache.get(t.id)!;
  try {
    const res = await getCover(t.path, true);
    if (!res?.dataUrl) {
      seedCache.set(t.id, null);
      return null;
    }
    const img = new Image();
    img.src = res.dataUrl;
    await img.decode();
    const { sourceColorFromImage, hexFromArgb } = await import('@material/material-color-utilities');
    const hex = hexFromArgb(await sourceColorFromImage(img));
    seedCache.set(t.id, hex);
    return hex;
  } catch {
    return null; // lỗi tạm thời: không nhớ để lần sau thử lại
  }
}
