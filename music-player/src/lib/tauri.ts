import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { Track } from './types';

export const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac'];

export const assetUrl = (path: string) => convertFileSrc(path);

export interface KnownFile { path: string; size: number; modified: number }
export interface ScanResult { tracks: Track[]; found: { id: string; path: string }[] }

/** Nếu truyền `known`, các tệp không đổi (cùng dung lượng + mốc sửa) sẽ được bỏ qua. Không truyền = đọc lại toàn bộ và ghi đè. */
export const scanPaths = (paths: string[], known?: KnownFile[]) =>
  invoke<ScanResult>('scan_paths', { paths, known: known ?? null });
export const getMusicDir = () => invoke<string | null>('get_music_dir');
export const findRemoved = (paths: string[]) => invoke<string[]>('find_removed', { paths });
export const getCover = (path: string, wantData = false) =>
  invoke<{ file: string; dataUrl: string | null } | null>('get_cover', { path, wantData });
export const readLyrics = (path: string) => invoke<string | null>('read_lyrics', { path });
export const loadState = () => invoke<string | null>('load_state');
export const saveState = (data: string) => invoke<void>('save_state', { data });
export const checkMissing = (paths: string[]) => invoke<string[]>('check_missing', { paths });
export const isDir = (path: string) => invoke<boolean>('is_dir', { path });
export const writeTextFile = (path: string, content: string) => invoke<void>('write_text_file', { path, content });
export const readTextFile = (path: string) => invoke<string>('read_text_file', { path });
export const reveal = (path: string) => invoke<void>('reveal_in_explorer', { path });
export const launchArgs = () => invoke<string[]>('get_launch_args');
export const setCloseToTray = (enabled: boolean) => invoke<void>('set_close_to_tray', { enabled });

export async function pickFolder(): Promise<string | null> {
  const r = await open({ directory: true, multiple: false });
  return typeof r === 'string' ? r : null;
}

export async function pickFiles(): Promise<string[]> {
  const r = await open({ multiple: true, filters: [{ name: 'Tệp âm thanh', extensions: AUDIO_EXTS }] });
  if (!r) return [];
  return Array.isArray(r) ? (r as string[]) : [r as string];
}

export async function pickOne(extensions: string[], name: string): Promise<string | null> {
  const r = await open({ multiple: false, filters: [{ name, extensions }] });
  return typeof r === 'string' ? r : null;
}

export async function pickSavePath(defaultPath: string, extensions: string[], name: string): Promise<string | null> {
  const r = await save({ defaultPath, filters: [{ name, extensions }] });
  return r ?? null;
}
