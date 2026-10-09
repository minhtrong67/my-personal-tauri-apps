import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { VideoFile } from './types';

export const VIDEO_EXTS = ['mp4', 'm4v', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ogv', 'mpg', 'mpeg', '3gp', 'mts', 'm2ts'];

export const assetUrl = (path: string) => convertFileSrc(path);

export const scanVideos = (paths: string[], recursive: boolean) => invoke<VideoFile[]>('scan_videos', { paths, recursive });
export const listSiblings = (path: string) => invoke<VideoFile[]>('list_siblings', { path });
export const findSubtitles = (path: string) => invoke<{ path: string; name: string }[]>('find_subtitles', { path });
export const readSubtitle = (path: string, fallback: string) => invoke<string>('read_subtitle', { path, fallback });
export const loadState = () => invoke<string | null>('load_state');
export const saveState = (data: string) => invoke<void>('save_state', { data });
export const findRemoved = (paths: string[]) => invoke<string[]>('find_removed', { paths });
export const saveScreenshot = (base64Png: string, fileName: string) => invoke<string>('save_screenshot', { base64Png, fileName });
export const saveThumb = (key: string, base64Jpeg: string) => invoke<string>('save_thumb', { key, base64Jpeg });
export const getVideoDir = () => invoke<string | null>('get_video_dir');
export const reveal = (path: string) => invoke<void>('reveal_in_explorer', { path });
export const openWithDefault = (path: string) => invoke<void>('open_with_default', { path });
export const isDir = (path: string) => invoke<boolean>('is_dir', { path });
/** Stop/resume remembering the window size (off while in fullscreen or the mini player) */
export const setWindowTracking = (enabled: boolean) => invoke<void>('set_window_tracking', { enabled }).catch(() => undefined);
export const setStartFullscreen = (enabled: boolean) => invoke<void>('set_start_fullscreen', { enabled }).catch(() => undefined);
export const launchArgs = () => invoke<string[]>('get_launch_args');

export async function pickVideos(title: string): Promise<string[]> {
  const r = await open({ multiple: true, title, filters: [{ name: 'Video', extensions: VIDEO_EXTS }] });
  if (!r) return [];
  return Array.isArray(r) ? (r as string[]) : [r as string];
}

export async function pickFolder(title: string): Promise<string | null> {
  const r = await open({ directory: true, multiple: false, title });
  return typeof r === 'string' ? r : null;
}

export async function pickSubtitle(title: string): Promise<string | null> {
  const r = await open({ multiple: false, title, filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt', 'ass', 'ssa'] }] });
  return typeof r === 'string' ? r : null;
}
