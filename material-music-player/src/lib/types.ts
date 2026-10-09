export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: number;
  trackNo: number;
  duration: number;
  bitrate: number;
  sampleRate: number;
  format: string;
  size: number;
  addedAt: number;
  folder: string;
  hasCover: boolean;
  /** Mốc sửa đổi (giây) của tệp, dùng để quét tăng dần */
  modified?: number;
  /** Đường dẫn ảnh bìa đã trích xuất; chuỗi rỗng = không có ảnh bìa */
  cover?: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  /** Có giá trị nếu playlist được tạo từ việc nhập một thư mục */
  folder?: string;
}

export interface Album {
  key: string;
  title: string;
  artist: string;
  year: number;
  tracks: Track[];
}

export interface Artist {
  name: string;
  tracks: Track[];
  albumCount: number;
}

export type ViewMode = 'list' | 'grid';
export type Lang = 'auto' | 'en' | 'vi';
export type RepeatMode = 'off' | 'all' | 'one';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  themeMode: ThemeMode;
  seedColor: string;
  dynamicColor: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  preamp: number;
  closeToTray: boolean;
  alwaysOnTop: boolean;
  startFullscreen: boolean;
  language: Lang;
  restoreSession: boolean;
  autoScanMusic: boolean;
  musicSeeded: boolean;
}

export const defaultSettings: Settings = {
  themeMode: 'system',
  seedColor: '#6750A4',
  dynamicColor: true,
  volume: 0.8,
  muted: false,
  playbackRate: 1,
  eqEnabled: false,
  eqGains: Array(10).fill(0),
  eqPreset: 'flat',
  preamp: 0,
  closeToTray: false,
  alwaysOnTop: false,
  startFullscreen: false,
  language: 'auto',
  restoreSession: true,
  autoScanMusic: true,
  musicSeeded: false,
};

export type View =
  | { name: 'home' }
  | { name: 'songs' }
  | { name: 'albums' }
  | { name: 'album'; key: string }
  | { name: 'artists' }
  | { name: 'artist'; artist: string }
  | { name: 'playlists' }
  | { name: 'playlist'; id: string }
  | { name: 'liked' }
  | { name: 'recent' }
  | { name: 'settings' };

export interface MenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
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
  | { type: 'prompt'; title: string; label: string; initial?: string; confirmLabel?: string; onSubmit: (v: string) => void }
  | { type: 'confirm'; title: string; text: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }
  | { type: 'info'; id: string }
  | { type: 'addToPlaylist'; ids: string[] }
  | { type: 'sleep' }
  | { type: 'audio' }
  | { type: 'shortcuts' };
