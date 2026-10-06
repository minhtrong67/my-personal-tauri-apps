export interface VideoFile {
  path: string;
  name: string;
  size: number;
  modified: number;
  folder: string;
}

export interface Progress {
  pos: number;
  dur: number;
  at: number;
}

export interface Recent {
  path: string;
  name: string;
  size: number;
  at: number;
  dur: number;
  thumb?: string;
}

export interface ThumbInfo {
  /** Path of the cached JPEG ('' = generation failed) */
  thumb: string;
  dur: number;
  /** File size the thumbnail was generated for */
  sig: string;
}

export type LibrarySort = 'date' | 'name' | 'size';

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export interface SubTrack {
  id: string;
  label: string;
  path: string;
}

export type ViewMode = 'list' | 'grid';
export type Lang = 'auto' | 'en' | 'vi';
export type ThemeMode = 'system' | 'light' | 'dark';
export type RepeatMode = 'off' | 'all' | 'one';
export type Fit = 'contain' | 'cover' | 'fill';
export type Screen = 'home' | 'player' | 'settings';

export interface SubStyle {
  size: number; // % of base size
  color: string;
  bg: 'none' | 'shadow' | 'box';
  opacity: number; // box opacity 0..1
  bottom: number; // % from the bottom
}

export interface Settings {
  language: Lang;
  themeMode: ThemeMode;
  seedColor: string;
  resume: boolean;
  autoQueue: boolean;
  autoSubs: boolean;
  volume: number;
  muted: boolean;
  alwaysOnTop: boolean;
  hideDelay: number; // ms
  seekStep: number; // seconds
  sub: SubStyle;
  autoScanVideos: boolean;
  libraryFolders: string[];
  librarySort: LibrarySort;
  libraryView: ViewMode;
  queueView: ViewMode;
}

export const defaultSettings: Settings = {
  language: 'auto',
  themeMode: 'system',
  seedColor: '#1A73E8',
  resume: true,
  autoQueue: true,
  autoSubs: true,
  volume: 0.8,
  muted: false,
  alwaysOnTop: false,
  hideDelay: 2500,
  seekStep: 5,
  sub: { size: 100, color: '#FFFFFF', bg: 'shadow', opacity: 0.6, bottom: 8 },
  autoScanVideos: true,
  libraryFolders: [],
  librarySort: 'date',
  libraryView: 'grid',
  queueView: 'list',
};

export interface Adjust {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  zoom: number;
  panX: number;
  panY: number;
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  fit: Fit;
}

export const defaultAdjust: Adjust = {
  brightness: 1, contrast: 1, saturation: 1, hue: 0, zoom: 1, panX: 0, panY: 0, rotate: 0, flipH: false, flipV: false, fit: 'contain',
};

export interface MenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
  shortcut?: string;
  /** Fly-out sub menu */
  children?: MenuItem[];
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export interface Toast {
  id: number;
  text: string;
  actionLabel?: string;
  action?: () => void;
}

export type Dialog =
  | { type: 'confirm'; title: string; text: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }
  | { type: 'info' }
  | { type: 'adjust' }
  | { type: 'audio' }
  | { type: 'subs' }
  | { type: 'sleep' }
  | { type: 'shortcuts' };
