import { create } from 'zustand';
import { useMemo } from 'react';
import { engine } from './audio';
import { tr, setActiveLang, resolveLang, getActiveLang, type ActiveLang } from './i18n';
import * as api from './tauri';
import { setFullscreen, win } from './window';
import { buildM3U, parseM3U } from './m3u';
import { basename, natural, shuffled, stripExt, uid, norm } from './utils';
import {
  defaultSettings,
  type Album,
  type Artist,
  type Dialog,
  type MenuItem,
  type MenuState,
  type Playlist,
  type RepeatMode,
  type Settings,
  type Toast,
  type ViewMode,
  type Track,
  type View,
} from './types';

export interface State {
  ready: boolean;
  byId: Record<string, Track>;
  playlists: Playlist[];
  liked: Record<string, number>;
  history: { id: string; at: number }[];
  plays: Record<string, number>;
  settings: Settings;

  queue: string[];
  baseQueue: string[];
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  sleepAt: number | null;
  sleepEndOfTrack: boolean;

  view: View;
  backStack: View[];
  query: string;
  showQueue: boolean;
  showNowPlaying: boolean;
  navCollapsed: boolean;
  miniMode: boolean;
  fullscreen: boolean;
  scanning: { done: number; total: number } | null;
  syncing: boolean;
  viewModes: Record<string, ViewMode>;
  dragOver: boolean;
  toast: Toast | null;
  dialog: Dialog | null;
  menu: MenuState | null;

  init: () => Promise<void>;
  nav: (v: View) => void;
  back: () => void;
  setQuery: (q: string) => void;
  showToast: (text: string, actionLabel?: string, action?: () => void) => void;
  openDialog: (d: Dialog | null) => void;
  openMenu: (x: number, y: number, items: MenuItem[]) => void;
  closeMenu: () => void;
  set: (p: Partial<State>) => void;

  importFolder: () => Promise<void>;
  importFiles: () => Promise<void>;
  openPaths: (paths: string[], play: boolean) => Promise<void>;
  rescanPlaylist: (id: string) => Promise<void>;
  rescanAll: () => Promise<void>;
  removeMissing: () => Promise<void>;
  syncLibrary: (silent?: boolean, force?: boolean) => Promise<void>;
  setViewMode: (key: string, mode: ViewMode) => void;
  removeTracks: (ids: string[]) => void;
  clearLibrary: () => void;
  backup: () => Promise<void>;
  restore: () => Promise<void>;

  playTracks: (ids: string[], start?: number, forceShuffle?: boolean) => void;
  playIndex: (i: number) => void;
  togglePlay: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (ids: string[]) => void;
  addToQueue: (ids: string[]) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  setSleep: (minutes: number | 'track' | null) => void;

  toggleLike: (id: string) => void;
  createPlaylist: (name: string, ids?: string[]) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (pid: string, ids: string[]) => void;
  removeFromPlaylist: (pid: string, index: number) => void;
  reorderPlaylist: (pid: string, from: number, to: number) => void;
  exportPlaylist: (pid: string) => Promise<void>;
  importPlaylistFile: () => Promise<void>;
  updateSettings: (p: Partial<Settings>) => void;
  toggleFullscreen: (on?: boolean) => Promise<void>;
}

const normalize = (t: Track): Track => ({
  ...t,
  artist: t.artist || tr('unknownArtist'),
  album: t.album || basename(t.folder) || tr('unknownAlbum'),
});

const pathKey = (p: string) => p.replace(/\//g, '\\').toLowerCase();

export const albumKey = (t: Track) => `${t.albumArtist || ''}\u0001${t.album}`;

export function sortTracksNatural(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    if (a.folder !== b.folder) return natural(a.folder, b.folder);
    if (a.trackNo > 0 && b.trackNo > 0 && a.trackNo !== b.trackNo) return a.trackNo - b.trackNo;
    return natural(a.path, b.path);
  });
}

/** Re-enable window-size memory shortly after leaving fullscreen / mini player (once the window has settled) */
let retrackTimer: number | undefined;
let saveTimer: number | undefined;

export const useStore = create<State>((set, get) => {
  const snapshot = () => {
    const s = get();
    return JSON.stringify({
      v: 1,
      tracks: Object.values(s.byId),
      playlists: s.playlists,
      liked: s.liked,
      history: s.history,
      plays: s.plays,
      settings: s.settings,
      session: {
        queue: s.queue,
        baseQueue: s.baseQueue,
        index: s.index,
        position: engine.audio.currentTime || 0,
        shuffle: s.shuffle,
        repeat: s.repeat,
      },
      navCollapsed: s.navCollapsed,
      viewModes: s.viewModes,
    });
  };

  const LEGACY_PRESETS: Record<string, string> = { 'Phẳng': 'flat', 'Bass mạnh': 'bass', 'Treble sáng': 'treble', 'Giọng hát': 'vocal', 'Cổ_điển': 'classical', 'Tùy chỉnh': 'custom' };
  const fixSettings = (s: Settings): Settings => ({ ...s, eqPreset: LEGACY_PRESETS[s.eqPreset] ?? s.eqPreset.toLowerCase() });

  const retrack = () => {
    const s = get();
    if (!s.miniMode && !s.fullscreen) void api.setWindowTracking(true);
  };

  /** Tray menu labels follow the UI language */
  const pushTrayLabels = () => void api.setTrayLabels([tr('trayShow'), tr('trayToggle'), tr('trayPrev'), tr('trayNext'), tr('trayQuit')]);

  /** Library entries that carry the localized "unknown artist/album" placeholder follow the language switch */
  const relabelUnknown = (from: ActiveLang, to: ActiveLang) => {
    if (from === to) return;
    const pairs: [string, string][] = [[tr('unknownArtist', undefined, from), tr('unknownArtist', undefined, to)], [tr('unknownAlbum', undefined, from), tr('unknownAlbum', undefined, to)]];
    set((s) => {
      const byId: Record<string, Track> = {};
      for (const t of Object.values(s.byId)) {
        byId[t.id] = { ...t, artist: t.artist === pairs[0][0] ? pairs[0][1] : t.artist, album: t.album === pairs[1][0] ? pairs[1][1] : t.album };
      }
      return { byId };
    });
  };

  const applySnapshot = (raw: string) => {
    const d = JSON.parse(raw);
    const byId: Record<string, Track> = {};
    for (const t of (d.tracks ?? []) as Track[]) byId[t.id] = t;
    set({
      byId,
      playlists: d.playlists ?? [],
      liked: d.liked ?? {},
      history: d.history ?? [],
      plays: d.plays ?? {},
      settings: fixSettings({ ...defaultSettings, ...(d.settings ?? {}) }),
      navCollapsed: !!d.navCollapsed,
      viewModes: d.viewModes ?? {},
    });
    return d;
  };

  /** Khi mã bài hát đổi (ví dụ dữ liệu cũ), chuyển mọi tham chiếu sang mã mới */
  const remapState = (s: State, remap: Record<string, string>) => {
    const r = (id: string) => remap[id] ?? id;
    const remapKeys = <T,>(o: Record<string, T>) => {
      const out: Record<string, T> = {};
      for (const [k, v] of Object.entries(o)) out[r(k)] = v;
      return out;
    };
    const seen = new Set<string>();
    return {
      queue: s.queue.map(r),
      baseQueue: s.baseQueue.map(r),
      playlists: s.playlists.map((p) => ({ ...p, trackIds: [...new Set(p.trackIds.map(r))] })),
      liked: remapKeys(s.liked),
      plays: remapKeys(s.plays),
      history: s.history.map((h) => ({ ...h, id: r(h.id) })).filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true))),
    };
  };

  /** Thêm / ghi đè bài hát theo đường dẫn: cùng tệp thì cập nhật, không tạo bản sao */
  const mergeTracks = (tracks: Track[]) => {
    let added = 0;
    let updated = 0;
    set((s) => {
      const byId = { ...s.byId };
      const byPath = new Map<string, string>();
      for (const t of Object.values(byId)) byPath.set(pathKey(t.path), t.id);
      const remap: Record<string, string> = {};
      for (const raw of tracks) {
        const t = normalize(raw);
        const pk = pathKey(t.path);
        const sameFileId = byPath.get(pk);
        if (sameFileId && sameFileId !== t.id) {
          const old = byId[sameFileId];
          delete byId[sameFileId];
          remap[sameFileId] = t.id;
          byId[t.id] = { ...t, addedAt: old?.addedAt ?? t.addedAt };
          updated++;
        } else {
          const old = byId[t.id];
          if (old) updated++;
          else added++;
          byId[t.id] = old ? { ...t, addedAt: old.addedAt } : t;
        }
        byPath.set(pk, t.id);
      }
      return Object.keys(remap).length ? { byId, ...remapState(s, remap) } : { byId };
    });
    return { added, updated };
  };

  /** Gộp các bản ghi trùng đường dẫn (nếu có) */
  const dedupeLibrary = () => {
    const s = get();
    const groups = new Map<string, Track[]>();
    for (const t of Object.values(s.byId)) {
      const k = pathKey(t.path);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
    }
    const remap: Record<string, string> = {};
    const byId = { ...s.byId };
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort((a, b) => a.addedAt - b.addedAt);
      for (const dup of g.slice(1)) {
        remap[dup.id] = g[0].id;
        delete byId[dup.id];
      }
    }
    if (Object.keys(remap).length) set({ byId, ...remapState(s, remap) });
  };

  const knownFiles = (): api.KnownFile[] =>
    Object.values(get().byId).map((t) => ({ path: t.path, size: t.size, modified: t.modified ?? 0 }));

  /** Quét đường dẫn. `known` có giá trị = quét tăng dần (bỏ qua tệp không đổi); không có = đọc lại và ghi đè. */
  const ingest = async (paths: string[], opts: { known?: api.KnownFile[]; quiet?: boolean } = {}): Promise<api.ScanResult | null> => {
    const timer = opts.quiet ? window.setTimeout(() => set({ scanning: { done: 0, total: 0 } }), 1200) : undefined;
    if (!opts.quiet) set({ scanning: { done: 0, total: 0 } });
    try {
      return await api.scanPaths(paths, opts.known);
    } catch (e) {
      if (!opts.quiet) get().showToast(tr('scanFailed', { e: String(e) }));
      return null;
    } finally {
      window.clearTimeout(timer);
      set({ scanning: null });
    }
  };

  const sortedIds = (ids: string[]) => {
    const byId = get().byId;
    return sortTracksNatural(ids.map((i) => byId[i]).filter(Boolean)).map((t) => t.id);
  };

  const upsertFolderPlaylist = (dir: string, ids: string[]) => {
    const existing = get().playlists.find((p) => p.folder && pathKey(p.folder) === pathKey(dir));
    if (existing) {
      set((s) => ({ playlists: s.playlists.map((p) => (p.id === existing.id ? { ...p, trackIds: ids } : p)) }));
      return existing.id;
    }
    const id = uid();
    set((s) => ({
      playlists: [...s.playlists, { id, name: basename(dir) || dir, trackIds: ids, createdAt: Date.now(), folder: dir }],
    }));
    return id;
  };

  /** Xóa các bài mà tệp đã bị xóa khỏi ổ đĩa (bỏ qua khi cả ổ đĩa đang không truy cập được) */
  const pruneMissing = async (): Promise<number> => {
    const all = Object.values(get().byId);
    if (!all.length) return 0;
    try {
      const gone = new Set((await api.findRemoved(all.map((t) => t.path))).map(pathKey));
      const ids = all.filter((t) => gone.has(pathKey(t.path))).map((t) => t.id);
      if (ids.length) get().removeTracks(ids);
      return ids.length;
    } catch {
      return 0;
    }
  };

  const addFolder = async (dir: string, play: boolean) => {
    const res = await ingest([dir]);
    if (!res) return;
    if (!res.found.length) {
      get().showToast(tr('noSongsInFolder'));
      return;
    }
    const { added, updated } = mergeTracks(res.tracks);
    const ids = sortedIds(res.found.map((f) => f.id));
    const pid = upsertFolderPlaylist(dir, ids);
    if (play) get().playTracks(ids, 0);
    else
      get().showToast(
        updated ? tr('folderMerged', { name: basename(dir), added, updated }) : tr('folderAdded', { n: added, name: basename(dir) }),
        tr('openPlaylist'),
        () => get().nav({ name: 'playlist', id: pid }),
      );
  };

  let syncing = false;

  const playCurrentIndex = (i: number, autoplay: boolean, startAt = 0) => {
    const s = get();
    const t = s.byId[s.queue[i]];
    if (!t) return;
    engine.load(t.path, autoplay, startAt);
    set({ index: i, position: startAt, duration: t.duration });
  };

  let errorStreak = 0;

  return {
    ready: false,
    byId: {},
    playlists: [],
    liked: {},
    history: [],
    plays: {},
    settings: defaultSettings,
    queue: [],
    baseQueue: [],
    index: -1,
    isPlaying: false,
    position: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off',
    sleepAt: null,
    sleepEndOfTrack: false,
    view: { name: 'home' },
    backStack: [],
    query: '',
    showQueue: false,
    showNowPlaying: false,
    navCollapsed: false,
    miniMode: false,
    fullscreen: false,
    scanning: null,
    syncing: false,
    viewModes: {},
    dragOver: false,
    toast: null,
    dialog: null,
    menu: null,

    set: (p) => set(p),

    init: async () => {
      if (get().ready) return;
      let session: { queue?: string[]; baseQueue?: string[]; index?: number; position?: number; shuffle?: boolean; repeat?: RepeatMode } | null = null;
      try {
        const raw = await api.loadState();
        if (raw) session = applySnapshot(raw).session ?? null;
      } catch (e) {
        console.error('Could not read the saved data', e);
      }
      setActiveLang(get().settings.language);
      pushTrayLabels();
      void api.setStartFullscreen(get().settings.startFullscreen);
      win().isFullscreen().then((fs) => fs && set({ fullscreen: true })).catch(() => undefined);
      dedupeLibrary();
      const removed = await pruneMissing();
      if (removed) get().showToast(tr('removedMissingStart', { n: removed }));
      const s = get().settings;
      engine.setVolume(s.volume, s.muted);
      engine.setRate(s.playbackRate);
      engine.setEq(s.eqEnabled, s.eqGains, s.preamp);

      engine.onTime = (t) => set({ position: t });
      engine.onPlayState = (p) => set({ isPlaying: p });
      engine.onPlaying = () => {
        errorStreak = 0;
      };
      engine.onDuration = (d) => {
        const st = get();
        const t = st.byId[st.queue[st.index]];
        set({ duration: d });
        if (t && Math.abs(t.duration - d) > 2) set({ byId: { ...st.byId, [t.id]: { ...t, duration: d } } });
      };
      engine.onEnded = () => {
        const st = get();
        if (st.sleepEndOfTrack) {
          set({ sleepEndOfTrack: false, isPlaying: false });
          engine.pause();
          return;
        }
        if (st.repeat === 'one') {
          engine.seek(0);
          void engine.play();
          return;
        }
        get().next(true);
      };
      engine.onError = () => {
        const st = get();
        const t = st.byId[st.queue[st.index]];
        get().showToast(tr('cannotPlay', { title: t?.title ?? tr('aSong') }));
        errorStreak++;
        if (errorStreak < 5 && st.index < st.queue.length - 1) get().next(true);
        else set({ isPlaying: false });
      };

      if (session && s.restoreSession && session.queue?.length) {
        const queue = session.queue.filter((id) => get().byId[id]);
        const idx = Math.min(Math.max(session.index ?? 0, 0), queue.length - 1);
        set({
          queue,
          baseQueue: (session.baseQueue ?? queue).filter((id) => get().byId[id]),
          shuffle: !!session.shuffle,
          repeat: session.repeat ?? 'off',
        });
        if (queue.length) playCurrentIndex(idx, false, session.position ?? 0);
      }

      set({ ready: true });
      useStore.subscribe((st, prev) => {
        if (
          st.byId !== prev.byId ||
          st.playlists !== prev.playlists ||
          st.liked !== prev.liked ||
          st.history !== prev.history ||
          st.plays !== prev.plays ||
          st.settings !== prev.settings ||
          st.queue !== prev.queue ||
          st.index !== prev.index ||
          st.shuffle !== prev.shuffle ||
          st.repeat !== prev.repeat ||
          st.navCollapsed !== prev.navCollapsed ||
          st.viewModes !== prev.viewModes
        )
          scheduleSave();
      });
    },

    nav: (v) =>
      set((s) => ({
        view: v,
        backStack: [...s.backStack.slice(-19), s.view],
        query: '',
        showNowPlaying: false,
      })),
    back: () =>
      set((s) => {
        const prev = s.backStack[s.backStack.length - 1];
        if (!prev) return {};
        return { view: prev, backStack: s.backStack.slice(0, -1), query: '' };
      }),
    setQuery: (q) => set({ query: q }),
    showToast: (text, actionLabel, action) => {
      const id = Date.now();
      set({ toast: { id, text, actionLabel, action } });
      window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, actionLabel ? 6000 : 3500);
    },
    openDialog: (d) => set({ dialog: d }),
    openMenu: (x, y, items) => set({ menu: { x, y, items } }),
    closeMenu: () => set({ menu: null }),

    // ---------- Thư viện ----------
    importFolder: async () => {
      const dir = await api.pickFolder();
      if (dir) await addFolder(dir, false);
    },
    importFiles: async () => {
      const files = await api.pickFiles();
      if (!files.length) return;
      const res = await ingest(files); // đọc lại và ghi đè nếu bài đã có
      if (!res) return;
      const { added, updated } = mergeTracks(res.tracks);
      const ids = res.found.map((f) => f.id);
      get().showToast(
        updated ? tr('filesMerged', { added, updated }) : tr('filesAdded', { n: added }),
        tr('playNow'),
        () => get().playTracks(ids, 0),
      );
    },
    openPaths: async (paths, play) => {
      const dirs: string[] = [];
      const files: string[] = [];
      for (const p of paths) ((await api.isDir(p)) ? dirs : files).push(p);
      for (const d of dirs) await addFolder(d, play && dirs.length === 1 && files.length === 0);
      if (files.length) {
        const res = await ingest(files);
        if (!res) return;
        if (!res.found.length) {
          get().showToast(tr('noAudioSupported'));
          return;
        }
        mergeTracks(res.tracks);
        if (play) get().playTracks(res.found.map((f) => f.id), 0);
      }
    },
    rescanPlaylist: async (id) => {
      const pl = get().playlists.find((p) => p.id === id);
      if (!pl?.folder) return;
      if (!(await api.isDir(pl.folder))) {
        get().showToast(tr('folderUnreachable'));
        return;
      }
      const res = await ingest([pl.folder], { known: knownFiles() });
      if (!res) return;
      mergeTracks(res.tracks);
      const ids = sortedIds(res.found.map((f) => f.id));
      set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds: ids } : p)) }));
      const removed = await pruneMissing();
      get().showToast(tr('rescanned', { name: pl.name, n: ids.length, extra: removed ? tr('rescannedRemoved', { n: removed }) : '' }));
    },
    setViewMode: (key, mode) => set((s) => ({ viewModes: { ...s.viewModes, [key]: mode } })),
    syncLibrary: async (silent = false, force = false) => {
      if (syncing) return;
      syncing = true;
      set({ syncing: true });
      try {
        const s0 = get();
        let musicDir: string | null = null;
        if (s0.settings.autoScanMusic || force) {
          try {
            musicDir = await api.getMusicDir();
          } catch {
            /* ignore */
          }
        }
        const roots: string[] = [];
        const addRoot = (d?: string | null) => {
          if (d && !roots.some((r) => pathKey(r) === pathKey(d))) roots.push(d);
        };
        addRoot(musicDir);
        s0.playlists.forEach((p) => addRoot(p.folder));

        let added = 0;
        let updated = 0;
        for (const root of roots) {
          if (!(await api.isDir(root))) continue; // thư mục/ổ đĩa không truy cập được: giữ nguyên dữ liệu
          const res = await ingest([root], { known: knownFiles(), quiet: silent });
          if (!res) continue;
          const m = mergeTracks(res.tracks);
          added += m.added;
          updated += m.updated;
          const ids = sortedIds(res.found.map((f) => f.id));
          const isMusic = !!musicDir && pathKey(root) === pathKey(musicDir);
          const hasPlaylist = get().playlists.some((p) => p.folder && pathKey(p.folder) === pathKey(root));
          if (hasPlaylist || (isMusic && !get().settings.musicSeeded && ids.length)) {
            upsertFolderPlaylist(root, ids);
            if (isMusic && !hasPlaylist) set((st) => ({ settings: { ...st.settings, musicSeeded: true } }));
          }
        }
        const removed = await pruneMissing();
        const parts = [added && tr('libAdded', { n: added }), !silent && updated && tr('libUpdated', { n: updated }), removed && tr('libRemoved', { n: removed })].filter(Boolean);
        if (parts.length) get().showToast(`${tr('libraryWord')}: ${parts.join(', ')}`);
        else if (!silent) get().showToast(tr('libUpToDate'));
      } finally {
        syncing = false;
        set({ syncing: false });
      }
    },
    rescanAll: async () => get().syncLibrary(false, true),
    removeMissing: async () => {
      const n = await pruneMissing();
      get().showToast(n ? tr('removedMissing', { n }) : tr('noMissing'));
    },
    removeTracks: (ids) => {
      const rm = new Set(ids);
      set((s) => {
        const byId = { ...s.byId };
        ids.forEach((i) => delete byId[i]);
        const cur = s.queue[s.index];
        const queue = s.queue.filter((x) => !rm.has(x));
        const index = cur && !rm.has(cur) ? queue.indexOf(cur) : Math.min(s.index, queue.length - 1);
        const liked = { ...s.liked };
        ids.forEach((i) => delete liked[i]);
        return {
          byId,
          liked,
          queue,
          baseQueue: s.baseQueue.filter((x) => !rm.has(x)),
          index,
          history: s.history.filter((h) => !rm.has(h.id)),
          playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => !rm.has(x)) })),
        };
      });
      if (get().index < 0) engine.pause();
    },
    clearLibrary: () => {
      engine.pause();
      set({ byId: {}, playlists: [], liked: {}, history: [], plays: {}, queue: [], baseQueue: [], index: -1, isPlaying: false, position: 0, duration: 0 });
      get().showToast(tr('libraryCleared'));
    },
    backup: async () => {
      const path = await api.pickSavePath('material-music-player-backup.json', ['json'], tr('backupName'));
      if (!path) return;
      await api.writeTextFile(path, snapshot());
      get().showToast(tr('backedUp'));
    },
    restore: async () => {
      const path = await api.pickOne(['json'], tr('backupName'));
      if (!path) return;
      try {
        applySnapshot(await api.readTextFile(path));
        engine.pause();
        set({ queue: [], baseQueue: [], index: -1, isPlaying: false });
        get().showToast(tr('restored'));
      } catch {
        get().showToast(tr('badBackup'));
      }
    },

    // ---------- Phát nhạc ----------
    playTracks: (ids, start = 0, forceShuffle) => {
      if (!ids.length) return;
      const s = get();
      const shuffleOn = forceShuffle ?? s.shuffle;
      let queue = ids;
      let index = start;
      if (shuffleOn) {
        const first = ids[start];
        queue = [first, ...shuffled(ids.filter((_, i) => i !== start))];
        index = 0;
      }
      set({ queue, baseQueue: ids, shuffle: shuffleOn });
      get().playIndex(index);
    },
    playIndex: (i) => {
      const s = get();
      const id = s.queue[i];
      const t = s.byId[id];
      if (!t) return;
      playCurrentIndex(i, true);
      set((st) => ({
        isPlaying: true,
        plays: { ...st.plays, [id]: (st.plays[id] ?? 0) + 1 },
        history: [{ id, at: Date.now() }, ...st.history.filter((h) => h.id !== id)].slice(0, 200),
      }));
    },
    togglePlay: () => {
      const s = get();
      if (s.index < 0 || !s.queue.length) {
        const all = sortTracksNatural(Object.values(s.byId));
        if (all.length) get().playTracks(all.map((t) => t.id), 0);
        return;
      }
      if (!engine.path) playCurrentIndex(s.index, true);
      else engine.toggle();
    },
    next: (auto = false) => {
      const { queue, index, repeat } = get();
      if (!queue.length) return;
      let i = index + 1;
      if (i >= queue.length) {
        if (repeat === 'all') i = 0;
        else {
          if (auto) {
            engine.pause();
            engine.seek(0);
            set({ isPlaying: false });
          }
          return;
        }
      }
      get().playIndex(i);
    },
    prev: () => {
      const { queue, index, repeat } = get();
      if (!queue.length) return;
      if (engine.audio.currentTime > 3 || (index <= 0 && repeat !== 'all')) {
        engine.seek(0);
        return;
      }
      get().playIndex(index <= 0 ? queue.length - 1 : index - 1);
    },
    seek: (t) => {
      engine.seek(t);
      set({ position: t });
    },
    setVolume: (v) => {
      set((s) => ({ settings: { ...s.settings, volume: v, muted: false } }));
      engine.setVolume(v, false);
    },
    toggleMute: () => {
      const s = get().settings;
      set({ settings: { ...s, muted: !s.muted } });
      engine.setVolume(s.volume, !s.muted);
    },
    toggleShuffle: () => {
      const s = get();
      const cur = s.queue[s.index];
      if (!s.shuffle) {
        const rest = s.queue.filter((_, i) => i !== s.index);
        set({ shuffle: true, queue: cur ? [cur, ...shuffled(rest)] : shuffled(rest), index: cur ? 0 : -1 });
      } else {
        const base = s.baseQueue.length ? s.baseQueue : s.queue;
        set({ shuffle: false, queue: base, index: cur ? base.indexOf(cur) : -1 });
      }
    },
    cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
    playNext: (ids) => {
      const s = get();
      if (s.index < 0) return get().playTracks(ids, 0);
      const q = [...s.queue];
      q.splice(s.index + 1, 0, ...ids);
      set({ queue: q, baseQueue: [...s.baseQueue, ...ids] });
      get().showToast(ids.length > 1 ? tr('willPlayNextN', { n: ids.length }) : tr('willPlayNext'));
    },
    addToQueue: (ids) => {
      const s = get();
      if (s.index < 0) return get().playTracks(ids, 0);
      set({ queue: [...s.queue, ...ids], baseQueue: [...s.baseQueue, ...ids] });
      get().showToast(ids.length > 1 ? tr('addedToQueueN', { n: ids.length }) : tr('addedToQueue'));
    },
    removeFromQueue: (i) =>
      set((s) => {
        if (i === s.index) return {};
        const id = s.queue[i];
        const queue = s.queue.filter((_, k) => k !== i);
        return { queue, baseQueue: s.baseQueue.filter((x) => x !== id), index: i < s.index ? s.index - 1 : s.index };
      }),
    moveInQueue: (from, to) =>
      set((s) => {
        if (from === to) return {};
        const q = [...s.queue];
        const [m] = q.splice(from, 1);
        q.splice(to, 0, m);
        const cur = s.queue[s.index];
        return { queue: q, index: q.indexOf(cur) };
      }),
    clearQueue: () =>
      set((s) => {
        const cur = s.queue[s.index];
        return cur ? { queue: [cur], baseQueue: [cur], index: 0 } : { queue: [], baseQueue: [], index: -1 };
      }),
    setSleep: (m) => {
      if (m === null) set({ sleepAt: null, sleepEndOfTrack: false });
      else if (m === 'track') set({ sleepAt: null, sleepEndOfTrack: true });
      else set({ sleepAt: Date.now() + m * 60000, sleepEndOfTrack: false });
    },

    // ---------- Yêu thích & playlist ----------
    toggleLike: (id) =>
      set((s) => {
        const liked = { ...s.liked };
        if (liked[id]) delete liked[id];
        else liked[id] = Date.now();
        return { liked };
      }),
    createPlaylist: (name, ids = []) => {
      const id = uid();
      set((s) => ({ playlists: [...s.playlists, { id, name: name.trim() || tr('newPlaylist'), trackIds: ids, createdAt: Date.now() }] }));
      return id;
    },
    renamePlaylist: (id, name) =>
      set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) })),
    deletePlaylist: (id) => {
      set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
      const v = get().view;
      if (v.name === 'playlist' && v.id === id) get().nav({ name: 'playlists' });
    },
    addToPlaylist: (pid, ids) => {
      let added = 0;
      set((s) => ({
        playlists: s.playlists.map((p) => {
          if (p.id !== pid) return p;
          const have = new Set(p.trackIds);
          const add = ids.filter((i) => !have.has(i));
          added = add.length;
          return { ...p, trackIds: [...p.trackIds, ...add] };
        }),
      }));
      get().showToast(added ? tr('addedToPlaylistN', { n: added }) : tr('alreadyInPlaylist'));
    },
    removeFromPlaylist: (pid, index) =>
      set((s) => ({ playlists: s.playlists.map((p) => (p.id === pid ? { ...p, trackIds: p.trackIds.filter((_, i) => i !== index) } : p)) })),
    reorderPlaylist: (pid, from, to) =>
      set((s) => ({
        playlists: s.playlists.map((p) => {
          if (p.id !== pid) return p;
          const ids = [...p.trackIds];
          const [m] = ids.splice(from, 1);
          ids.splice(to, 0, m);
          return { ...p, trackIds: ids };
        }),
      })),
    exportPlaylist: async (pid) => {
      const pl = get().playlists.find((p) => p.id === pid);
      if (!pl) return;
      const path = await api.pickSavePath(`${pl.name}.m3u8`, ['m3u8', 'm3u'], 'Playlist M3U');
      if (!path) return;
      const tracks = pl.trackIds.map((i) => get().byId[i]).filter(Boolean);
      await api.writeTextFile(path, buildM3U(tracks));
      get().showToast(tr('exported', { name: pl.name }));
    },
    importPlaylistFile: async () => {
      const path = await api.pickOne(['m3u', 'm3u8'], 'Playlist M3U');
      if (!path) return;
      const paths = parseM3U(await api.readTextFile(path), path);
      const res = await ingest(paths);
      if (!res) return;
      if (!res.found.length) {
        get().showToast(tr('noValidSongsInM3U'));
        return;
      }
      mergeTracks(res.tracks);
      const ids = res.found.map((f) => f.id);
      const pid = get().createPlaylist(stripExt(basename(path)), ids);
      get().nav({ name: 'playlist', id: pid });
      get().showToast(tr('imported', { n: ids.length }));
    },

    toggleFullscreen: async (on) => {
      if (get().miniMode) return;
      const v = on ?? !get().fullscreen;
      window.clearTimeout(retrackTimer);
      if (v) await api.setWindowTracking(false);
      await setFullscreen(v).catch(() => undefined);
      set({ fullscreen: v });
      if (!v) retrackTimer = window.setTimeout(retrack, 700);
    },
    updateSettings: (p) => {
      const prevLang = resolveLang(get().settings.language);
      const settings = { ...get().settings, ...p };
      set({ settings });
      if (p.language) {
        setActiveLang(p.language);
        relabelUnknown(prevLang, resolveLang(p.language));
        pushTrayLabels();
      }
      if (p.startFullscreen !== undefined) void api.setStartFullscreen(p.startFullscreen);
      if (p.autoScanMusic === true) void get().syncLibrary(false);
      if ('playbackRate' in p) engine.setRate(settings.playbackRate);
      if ('eqEnabled' in p || 'eqGains' in p || 'preamp' in p) engine.setEq(settings.eqEnabled, settings.eqGains, settings.preamp);
    },
  };

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      api.saveState(snapshot()).catch((e) => console.error('Save failed', e));
    }, 800);
  }
});

// ---------- Hooks dẫn xuất ----------
let derivedFor: Record<string, Track> | null = null;
let derivedLang: ActiveLang | null = null;
let derivedCache: { all: Track[]; albums: Album[]; artists: Artist[] } | null = null;

export function derive(byId: Record<string, Track>) {
  if (derivedFor === byId && derivedCache && derivedLang === getActiveLang()) return derivedCache;
  const all = Object.values(byId);
  const albumMap = new Map<string, Track[]>();
  const artistMap = new Map<string, Track[]>();
  for (const t of all) {
    const ak = albumKey(t);
    (albumMap.get(ak) ?? albumMap.set(ak, []).get(ak)!).push(t);
    (artistMap.get(t.artist) ?? artistMap.set(t.artist, []).get(t.artist)!).push(t);
  }
  const albums: Album[] = [...albumMap.entries()].map(([key, tracks]) => {
    const sorted = [...tracks].sort((a, b) => a.folder.localeCompare(b.folder) || a.trackNo - b.trackNo || natural(a.path, b.path));
    const artists = new Set(sorted.map((t) => t.artist));
    return {
      key,
      title: sorted[0].album,
      artist: sorted[0].albumArtist || (artists.size === 1 ? sorted[0].artist : tr('variousArtists')),
      year: Math.max(...sorted.map((t) => t.year)),
      tracks: sorted,
    };
  });
  albums.sort((a, b) => natural(a.title, b.title));
  const artists: Artist[] = [...artistMap.entries()]
    .map(([name, tracks]) => ({ name, tracks, albumCount: new Set(tracks.map(albumKey)).size }))
    .sort((a, b) => natural(a.name, b.name));
  derivedFor = byId;
  derivedLang = getActiveLang();
  derivedCache = { all, albums, artists };
  return derivedCache;
}

export function useDerived() {
  const byId = useStore((s) => s.byId);
  return useMemo(() => derive(byId), [byId]);
}

export function useCurrent(): Track | undefined {
  return useStore((s) => s.byId[s.queue[s.index]]);
}

export function useTrackList(ids: string[]): Track[] {
  const byId = useStore((s) => s.byId);
  return useMemo(() => ids.map((i) => byId[i]).filter(Boolean), [ids, byId]);
}

export function searchLibrary(byId: Record<string, Track>, q: string) {
  const { all, albums, artists } = derive(byId);
  const n = norm(q.trim());
  const words = n.split(/\s+/).filter(Boolean);
  const hit = (s: string) => {
    const x = norm(s);
    return words.every((w) => x.includes(w));
  };
  return {
    tracks: all.filter((t) => hit(`${t.title} ${t.artist} ${t.album}`)),
    albums: albums.filter((a) => hit(`${a.title} ${a.artist}`)),
    artists: artists.filter((a) => hit(a.name)),
  };
}

const DEFAULT_MODES: Record<string, ViewMode> = { albums: 'grid', artists: 'grid', playlists: 'grid' };

/** Chế độ hiển thị danh sách / lưới của từng tab (được lưu lại) */
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const mode = useStore((s) => s.viewModes[key] ?? DEFAULT_MODES[key] ?? 'list');
  return [mode, (m) => useStore.getState().setViewMode(key, m)];
}
