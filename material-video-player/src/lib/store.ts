import { create } from 'zustand';
import { engine } from './engine';
import * as api from './tauri';
import { parseSubtitle } from './subtitles';
import { makeThumb, thumbSig } from './thumbs';
import { tr, resolveLang, setActiveLang } from './i18n';
import { basename, extOf, fmtTime, isSubPath, natural, pathKey, shuffled, stripExt } from './utils';
import {
  defaultAdjust,
  defaultSettings,
  type Adjust,
  type Cue,
  type Dialog,
  type MenuItem,
  type MenuState,
  type Progress,
  type Recent,
  type RepeatMode,
  type Screen,
  type Settings,
  type SubTrack,
  type ThumbInfo,
  type Toast,
  type VideoFile,
} from './types';
import { enterMini, exitMini, setFullscreen, win } from './window';

export interface State {
  ready: boolean;
  settings: Settings;
  recents: Recent[];
  progress: Record<string, Progress>;
  library: VideoFile[];
  thumbs: Record<string, ThumbInfo>;
  syncing: boolean;
  homeTab: 'home' | 'library' | null;

  screen: Screen;
  prevScreen: Screen;
  queue: VideoFile[];
  index: number;
  shuffle: boolean;
  repeat: RepeatMode;

  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  loading: boolean;
  error: string | null;
  buffering: boolean;
  videoSize: { w: number; h: number } | null;

  subTracks: SubTrack[];
  subIndex: number; // -1 = off
  subCues: Cue[];
  subDelay: number; // ms
  loopA: number | null;
  loopB: number | null;
  boost: number;
  night: boolean;
  adjust: Adjust;

  showQueue: boolean;
  fullscreen: boolean;
  mini: boolean;
  sleepAt: number | null;
  sleepEndOfVideo: boolean;
  dragOver: boolean;
  toast: Toast | null;
  dialog: Dialog | null;
  menu: MenuState | null;

  init: () => Promise<void>;
  set: (p: Partial<State>) => void;
  showToast: (text: string, actionLabel?: string, action?: () => void) => void;
  openDialog: (d: Dialog | null) => void;
  openMenu: (x: number, y: number, items: MenuItem[]) => void;
  closeMenu: () => void;
  go: (s: Screen) => void;

  openFiles: () => Promise<void>;
  openFolder: () => Promise<void>;
  openVideosDir: () => Promise<void>;
  openPaths: (paths: string[]) => Promise<void>;
  playFiles: (files: VideoFile[], index: number) => void;
  syncLibrary: (silent?: boolean, force?: boolean) => Promise<void>;
  addLibraryFolder: () => Promise<void>;
  removeLibraryFolder: (path: string) => void;
  requestThumb: (f: { path: string; size: number }) => void;
  dropThumb: (path: string) => void;
  playIndex: (i: number) => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  closeVideo: () => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  togglePlay: () => void;
  seek: (t: number) => void;
  seekBy: (d: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  saveProgress: () => void;

  selectSub: (i: number) => Promise<void>;
  cycleSub: () => void;
  toggleSub: () => void;
  loadSubFile: (path?: string) => Promise<void>;
  setSubDelay: (ms: number) => void;
  cycleLoop: () => void;
  setFx: (boost: number, night: boolean) => void;
  setAdjust: (p: Partial<Adjust>) => void;
  resetAdjust: () => void;
  toggleFullscreen: (on?: boolean) => Promise<void>;
  toggleMini: () => Promise<void>;
  screenshot: () => Promise<void>;
  copyFrame: () => Promise<void>;
  setSleep: (minutes: number | 'video' | null) => void;

  updateSettings: (p: Partial<Settings>) => void;
  removeRecent: (path: string) => void;
  clearHistory: () => void;
}

let saveTimer: number | undefined;
let syncing = false;
let thumbActive = 0;
const thumbQueue: { path: string; size: number }[] = [];
const thumbInflight = new Set<string>();

export const useStore = create<State>((set, get) => {
  const snapshot = () => {
    const s = get();
    return JSON.stringify({ v: 2, settings: s.settings, recents: s.recents, progress: s.progress, library: s.library, thumbs: s.thumbs });
  };
  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => api.saveState(snapshot()).catch((e) => console.error(e)), 600);
  };

  const touchRecent = (f: VideoFile) => {
    set((s) => {
      const old = s.recents.find((r) => pathKey(r.path) === pathKey(f.path));
      const rec: Recent = { path: f.path, name: f.name, size: f.size, at: Date.now(), dur: old?.dur ?? 0, thumb: old?.thumb };
      return { recents: [rec, ...s.recents.filter((r) => pathKey(r.path) !== pathKey(f.path))].slice(0, 40) };
    });
  };

  const subLabel = (videoName: string, subName: string) => {
    const stem = stripExt(videoName).toLowerCase();
    const low = subName.toLowerCase();
    const rest = low.startsWith(stem) ? subName.slice(stem.length).replace(/^[._\- ]+/, '') : subName;
    return rest || subName;
  };

  const loadSidecarSubs = async (f: VideoFile) => {
    try {
      const found = await api.findSubtitles(f.path);
      if (get().queue[get().index]?.path !== f.path) return;
      const tracks: SubTrack[] = found.map((x, i) => ({ id: `${i}`, label: subLabel(f.name, x.name), path: x.path }));
      set({ subTracks: tracks });
      if (get().settings.autoSubs && tracks.length) {
        const lang = resolveLang(get().settings.language);
        const hints = lang === 'vi' ? ['vi', 'vie', 'viet'] : ['en', 'eng', 'english'];
        const pick = tracks.findIndex((t) => hints.some((h) => new RegExp(`(^|[._\\- \\[(])${h}([._\\- \\])]|$)`, 'i').test(t.label)));
        await get().selectSub(pick >= 0 ? pick : 0);
      }
    } catch {
      /* ignore */
    }
  };

  const resetPerVideo = () => ({
    position: 0, duration: 0, error: null, loading: true, buffering: false, videoSize: null,
    subTracks: [] as SubTrack[], subIndex: -1, subCues: [] as Cue[], subDelay: 0, loopA: null, loopB: null,
  });

  return {
    ready: false,
    settings: defaultSettings,
    recents: [],
    progress: {},
    library: [],
    thumbs: {},
    syncing: false,
    homeTab: null,
    screen: 'home',
    prevScreen: 'home',
    queue: [],
    index: -1,
    shuffle: false,
    repeat: 'off',
    playing: false,
    position: 0,
    duration: 0,
    rate: 1,
    loading: false,
    error: null,
    buffering: false,
    videoSize: null,
    subTracks: [],
    subIndex: -1,
    subCues: [],
    subDelay: 0,
    loopA: null,
    loopB: null,
    boost: 1,
    night: false,
    adjust: defaultAdjust,
    showQueue: false,
    fullscreen: false,
    mini: false,
    sleepAt: null,
    sleepEndOfVideo: false,
    dragOver: false,
    toast: null,
    dialog: null,
    menu: null,

    set: (p) => set(p),

    init: async () => {
      if (get().ready) return;
      try {
        const raw = await api.loadState();
        if (raw) {
          const d = JSON.parse(raw);
          set({
            settings: { ...defaultSettings, ...(d.settings ?? {}), sub: { ...defaultSettings.sub, ...(d.settings?.sub ?? {}) } },
            recents: d.recents ?? [],
            progress: d.progress ?? {},
            library: d.library ?? [],
            thumbs: d.thumbs ?? {},
          });
        }
      } catch (e) {
        console.error(e);
      }
      setActiveLang(get().settings.language);
      // drop history entries whose file was deleted (ignored if the whole drive is offline)
      try {
        const gone = new Set((await api.findRemoved(get().recents.map((r) => r.path))).map(pathKey));
        if (gone.size) {
          set((s) => {
            const progress = { ...s.progress };
            gone.forEach((k) => delete progress[k]);
            return { recents: s.recents.filter((r) => !gone.has(pathKey(r.path))), progress };
          });
        }
      } catch {
        /* ignore */
      }
      set({ ready: true });
      useStore.subscribe((st, prev) => {
        if (st.settings !== prev.settings || st.recents !== prev.recents || st.progress !== prev.progress || st.library !== prev.library || st.thumbs !== prev.thumbs) scheduleSave();
      });
    },

    showToast: (text, actionLabel, action) => {
      const id = Date.now();
      set({ toast: { id, text, actionLabel, action } });
      window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, actionLabel ? 6000 : 3200);
    },
    openDialog: (d) => set({ dialog: d }),
    openMenu: (x, y, items) => set({ menu: { x, y, items } }),
    closeMenu: () => set({ menu: null }),
    go: (s) => set((st) => ({ screen: s, prevScreen: st.screen === 'settings' ? st.prevScreen : st.screen })),

    // ---------- opening ----------
    openFiles: async () => {
      const files = await api.pickVideos(tr('openFiles'));
      if (files.length) await get().openPaths(files);
    },
    openFolder: async () => {
      const dir = await api.pickFolder(tr('openFolder'));
      if (dir) await get().openPaths([dir]);
    },
    openVideosDir: async () => {
      const dir = await api.getVideoDir();
      if (dir) await get().openPaths([dir]);
    },
    openPaths: async (paths) => {
      const subs = paths.filter(isSubPath);
      const rest = paths.filter((p) => !isSubPath(p));
      if (subs.length && get().index >= 0) {
        for (const s of subs) await get().loadSubFile(s);
        if (!rest.length) return;
      }
      if (!rest.length) return;
      const single = rest.length === 1 && !(await api.isDir(rest[0]));
      let files = await api.scanVideos(rest, true);
      if (!files.length) {
        get().showToast(tr('noVideosFound'));
        return;
      }
      let start = 0;
      if (single && get().settings.autoQueue) {
        const sib = (await api.listSiblings(files[0].path)).sort((a, b) => natural(a.name, b.name));
        const i = sib.findIndex((x) => pathKey(x.path) === pathKey(files[0].path));
        if (sib.length > 1 && i >= 0) {
          files = sib;
          start = i;
        }
      } else if (files.length > 1) {
        files = [...files].sort((a, b) => (a.folder === b.folder ? natural(a.name, b.name) : natural(a.folder, b.folder)));
      }
      set({ queue: files, index: -1 });
      get().playIndex(start);
    },

    playFiles: (files, index) => {
      if (!files[index]) return;
      set({ queue: files, index: -1 });
      get().playIndex(index);
    },

    // ---------- library ----------
    syncLibrary: async (silent = false, force = false) => {
      if (syncing) return;
      syncing = true;
      set({ syncing: true });
      try {
        const s = get().settings;
        const roots: string[] = [];
        const addRoot = (d?: string | null) => {
          if (d && !roots.some((r) => pathKey(r) === pathKey(d))) roots.push(d);
        };
        if (s.autoScanVideos || force) addRoot(await api.getVideoDir().catch(() => null));
        s.libraryFolders.forEach(addRoot);

        const found = new Map<string, VideoFile>();
        for (const root of roots) {
          if (!(await api.isDir(root))) continue; // folder or drive unreachable: keep what we have
          try {
            for (const f of await api.scanVideos([root], true)) found.set(pathKey(f.path), f);
          } catch {
            /* ignore this root */
          }
        }

        // add new files / overwrite changed ones (keyed by path: never duplicated)
        let added = 0;
        let updated = 0;
        set((st) => {
          const map = new Map(st.library.map((f) => [pathKey(f.path), f] as const));
          const thumbs = { ...st.thumbs };
          for (const f of found.values()) {
            const k = pathKey(f.path);
            const old = map.get(k);
            if (!old) added++;
            else if (old.size !== f.size || old.modified !== f.modified) {
              updated++;
              delete thumbs[k];
            }
            map.set(k, f);
          }
          return { library: [...map.values()], thumbs };
        });

        // drop entries whose file was deleted (ignored when the whole drive is offline)
        let removed = 0;
        try {
          const gone = new Set((await api.findRemoved(get().library.map((f) => f.path))).map(pathKey));
          if (gone.size) {
            removed = gone.size;
            set((st) => {
              const thumbs = { ...st.thumbs };
              gone.forEach((k) => delete thumbs[k]);
              return { library: st.library.filter((f) => !gone.has(pathKey(f.path))), thumbs };
            });
          }
        } catch {
          /* ignore */
        }

        const parts = [added && tr('libAdded', { n: added }), updated && !silent && tr('libUpdated', { n: updated }), removed && tr('libRemoved', { n: removed })].filter(Boolean);
        if (parts.length) get().showToast(`${tr('library')}: ${parts.join(' · ')}`);
        else if (!silent) get().showToast(tr('libUpToDate'));
      } finally {
        syncing = false;
        set({ syncing: false });
      }
    },
    addLibraryFolder: async () => {
      const dir = await api.pickFolder(tr('addFolder'));
      if (!dir) return;
      if (get().settings.libraryFolders.some((f) => pathKey(f) === pathKey(dir))) {
        get().showToast(tr('folderAlreadyAdded'));
        return;
      }
      get().updateSettings({ libraryFolders: [...get().settings.libraryFolders, dir] });
      set({ homeTab: 'library' });
      await get().syncLibrary(false);
    },
    removeLibraryFolder: (path) => {
      get().updateSettings({ libraryFolders: get().settings.libraryFolders.filter((f) => pathKey(f) !== pathKey(path)) });
      get().showToast(tr('folderRemoved'));
    },

    // ---------- thumbnails (generated lazily for the cards that are on screen) ----------
    requestThumb: (f) => {
      const k = pathKey(f.path);
      const cur = get().thumbs[k];
      if ((cur && cur.sig === thumbSig(f.size)) || thumbInflight.has(k)) return;
      thumbInflight.add(k);
      thumbQueue.unshift({ path: f.path, size: f.size }); // newest request first = what the user is looking at
      const pump = () => {
        while (thumbActive < 2 && thumbQueue.length) {
          const job = thumbQueue.shift()!;
          thumbActive++;
          void (async () => {
            const key = pathKey(job.path);
            let thumb = '';
            let dur = 0;
            try {
              const res = await makeThumb(job.path);
              if (res) {
                dur = res.dur;
                thumb = await api.saveThumb(`${key}|${job.size}`, res.thumb.split(',')[1]);
              }
            } catch {
              /* keep failure marker */
            }
            set((st) => ({ thumbs: { ...st.thumbs, [key]: { thumb, dur, sig: thumbSig(job.size) } } }));
            thumbInflight.delete(key);
            thumbActive--;
            pump();
          })();
        }
      };
      pump();
    },
    dropThumb: (path) =>
      set((st) => {
        const thumbs = { ...st.thumbs };
        delete thumbs[pathKey(path)];
        return { thumbs };
      }),

    playIndex: (i) => {
      const s = get();
      const f = s.queue[i];
      if (!f) return;
      get().saveProgress();
      set({ index: i, screen: 'player', ...resetPerVideo(), playing: false });
      touchRecent(f);
      void loadSidecarSubs(f);
    },

    next: (auto = false) => {
      const { queue, index, repeat, shuffle } = get();
      if (!queue.length) return;
      let i = index + 1;
      if (shuffle && queue.length > 1) {
        const others = shuffled(queue.map((_, k) => k).filter((k) => k !== index));
        i = others[0];
      } else if (i >= queue.length) {
        if (repeat === 'all') i = 0;
        else {
          if (auto) {
            engine.pause();
            set({ playing: false });
          }
          return;
        }
      }
      get().playIndex(i);
    },
    prev: () => {
      const { queue, index, repeat } = get();
      if (!queue.length) return;
      if ((engine.el?.currentTime ?? 0) > 3 || (index <= 0 && repeat !== 'all')) {
        engine.seek(0);
        return;
      }
      get().playIndex(index <= 0 ? queue.length - 1 : index - 1);
    },
    closeVideo: () => {
      get().saveProgress();
      engine.pause();
      if (get().fullscreen) void get().toggleFullscreen(false);
      if (get().mini) void get().toggleMini();
      set({ screen: 'home', index: -1, queue: [], playing: false, ...resetPerVideo(), loading: false });
      void win_title('Material Video Player');
    },
    removeFromQueue: (i) =>
      set((s) => {
        if (i === s.index) return {};
        return { queue: s.queue.filter((_, k) => k !== i), index: i < s.index ? s.index - 1 : s.index };
      }),
    moveInQueue: (from, to) =>
      set((s) => {
        if (from === to) return {};
        const q = [...s.queue];
        const [m] = q.splice(from, 1);
        q.splice(to, 0, m);
        return { queue: q, index: q.findIndex((x) => x.path === s.queue[s.index]?.path) };
      }),
    clearQueue: () =>
      set((s) => {
        const cur = s.queue[s.index];
        return cur ? { queue: [cur], index: 0 } : {};
      }),
    toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
    cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

    // ---------- playback ----------
    togglePlay: () => engine.toggle(),
    seek: (t) => {
      engine.seek(t);
      set({ position: t });
    },
    seekBy: (d) => {
      engine.seekBy(d);
    },
    setVolume: (v) => {
      set((s) => ({ settings: { ...s.settings, volume: v, muted: v === 0 ? s.settings.muted : false } }));
      const st = get().settings;
      engine.setVolume(st.volume, st.muted);
    },
    toggleMute: () => {
      const s = get().settings;
      set({ settings: { ...s, muted: !s.muted } });
      engine.setVolume(s.volume, !s.muted);
    },
    setRate: (r) => {
      set({ rate: r });
      engine.setRate(r);
    },
    saveProgress: () => {
      const s = get();
      const f = s.queue[s.index];
      const el = engine.el;
      if (!f || !el || engine.loadedPath !== f.path || !isFinite(el.duration) || el.duration <= 0) return;
      const key = pathKey(f.path);
      const finished = el.currentTime > el.duration - 8;
      set((st) => {
        const progress = { ...st.progress };
        if (finished || el.currentTime < 3) delete progress[key];
        else progress[key] = { pos: el.currentTime, dur: el.duration, at: Date.now() };
        const keys = Object.keys(progress);
        if (keys.length > 400) {
          keys.sort((a, b) => progress[a].at - progress[b].at).slice(0, keys.length - 400).forEach((k) => delete progress[k]);
        }
        const recents = st.recents.map((r) => (pathKey(r.path) === key ? { ...r, dur: el.duration } : r));
        return { progress, recents };
      });
    },

    // ---------- subtitles ----------
    selectSub: async (i) => {
      if (i < 0) {
        set({ subIndex: -1, subCues: [] });
        return;
      }
      const t = get().subTracks[i];
      if (!t) return;
      try {
        const fallback = resolveLang(get().settings.language) === 'vi' ? 'windows-1258' : 'windows-1252';
        const raw = await api.readSubtitle(t.path, fallback);
        const cues = parseSubtitle(raw, extOf(t.path));
        if (!cues.length) {
          get().showToast(tr('subEmpty'));
          return;
        }
        set({ subIndex: i, subCues: cues });
      } catch {
        get().showToast(tr('subFailed'));
      }
    },
    cycleSub: () => {
      const { subTracks, subIndex } = get();
      if (!subTracks.length) {
        get().showToast(tr('noSubs'));
        return;
      }
      const n = subIndex + 1 >= subTracks.length ? -1 : subIndex + 1;
      void get().selectSub(n);
      get().showToast(n < 0 ? tr('subsOff') : `${tr('subtitles')}: ${subTracks[n].label}`);
    },
    toggleSub: () => {
      const { subIndex, subTracks } = get();
      if (subIndex >= 0) {
        set({ subIndex: -1, subCues: [] });
        get().showToast(tr('subsOff'));
      } else if (subTracks.length) void get().selectSub(0);
      else get().showToast(tr('noSubs'));
    },
    loadSubFile: async (path) => {
      const p = path ?? (await api.pickSubtitle(tr('loadSubtitle')));
      if (!p) return;
      const id = `file-${Date.now()}`;
      set((s) => ({ subTracks: [...s.subTracks, { id, label: basename(p), path: p }] }));
      await get().selectSub(get().subTracks.length - 1);
    },
    setSubDelay: (ms) => set({ subDelay: Math.max(-30000, Math.min(30000, ms)) }),
    cycleLoop: () => {
      const { loopA, loopB } = get();
      const t = engine.el?.currentTime ?? 0;
      if (loopA === null) {
        set({ loopA: t, loopB: null });
        get().showToast(`A → ${fmtTime(t)}`);
      } else if (loopB === null) {
        if (t <= loopA + 0.5) return;
        set({ loopB: t });
        get().showToast(`A–B ${fmtTime(loopA)} → ${fmtTime(t)}`);
      } else {
        set({ loopA: null, loopB: null });
        get().showToast(tr('loopCleared'));
      }
    },
    setFx: (boost, night) => {
      set({ boost, night });
      engine.setFx(boost, night);
    },
    setAdjust: (p) => set((s) => ({ adjust: { ...s.adjust, ...p } })),
    resetAdjust: () => set({ adjust: defaultAdjust }),

    // ---------- window ----------
    toggleFullscreen: async (on) => {
      const v = on ?? !get().fullscreen;
      if (v && get().mini) await get().toggleMini();
      await setFullscreen(v).catch(() => undefined);
      set({ fullscreen: v });
    },
    toggleMini: async () => {
      if (get().mini) {
        set({ mini: false });
        await exitMini(get().settings.alwaysOnTop).catch(() => undefined);
      } else {
        if (get().screen !== 'player') return;
        if (get().fullscreen) await get().toggleFullscreen(false);
        set({ mini: true });
        await enterMini().catch(() => undefined);
      }
    },
    screenshot: async () => {
      const b64 = engine.screenshot();
      const f = get().queue[get().index];
      if (!b64 || !f) {
        get().showToast(tr('screenshotFailed'));
        return;
      }
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      try {
        const saved = await api.saveScreenshot(b64, `${stripExt(f.name)}_${fmtTime(engine.el?.currentTime ?? 0).replace(/:/g, '-')}_${stamp}.png`);
        get().showToast(tr('screenshotSaved'), tr('showInFolder'), () => void api.reveal(saved));
      } catch {
        get().showToast(tr('screenshotFailed'));
      }
    },
    copyFrame: async () => {
      const b64 = engine.screenshot();
      if (!b64) {
        get().showToast(tr('copyFailed'));
        return;
      }
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
        get().showToast(tr('frameCopied'));
      } catch {
        get().showToast(tr('copyFailed'));
      }
    },
    setSleep: (m) => {
      if (m === null) set({ sleepAt: null, sleepEndOfVideo: false });
      else if (m === 'video') set({ sleepAt: null, sleepEndOfVideo: true });
      else set({ sleepAt: Date.now() + m * 60000, sleepEndOfVideo: false });
    },

    // ---------- settings / data ----------
    updateSettings: (p) => {
      const settings = { ...get().settings, ...p };
      set({ settings });
      if (p.language) setActiveLang(p.language);
    },
    removeRecent: (path) =>
      set((s) => {
        const progress = { ...s.progress };
        delete progress[pathKey(path)];
        return { recents: s.recents.filter((r) => pathKey(r.path) !== pathKey(path)), progress };
      }),
    clearHistory: () => {
      set({ recents: [], progress: {} });
      get().showToast(tr('historyCleared'));
    },
  };
});

async function win_title(t: string) {
  try {
    await win().setTitle(t);
  } catch {
    /* ignore */
  }
}
export const setWindowTitle = win_title;

export const useCurrent = () => useStore((s) => s.queue[s.index]);
