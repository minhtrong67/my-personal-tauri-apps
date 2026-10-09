import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { TitleBar } from './components/TitleBar';
import { Player } from './components/Player';
import { Dialogs } from './components/Dialogs';
import { ContextMenu, Icon, Logo, Snackbar } from './components/ui';
import { HomeView } from './views/Home';
import { SettingsView } from './views/Settings';
import { useCurrent, useStore } from './lib/store';
import { engine } from './lib/engine';
import { applyTheme } from './lib/theme';
import { launchArgs } from './lib/tauri';
import { resolveLang, tr } from './lib/i18n';
import { useT } from './lib/useT';
import { win } from './lib/window';

export default function App() {
  const t = useT();
  const ready = useStore((s) => s.ready);
  const screen = useStore((s) => s.screen);
  const settings = useStore((s) => s.settings);
  const dragOver = useStore((s) => s.dragOver);
  const cur = useCurrent();

  // init + files passed on the command line ("Open with")
  useEffect(() => {
    const st = useStore.getState();
    st.init().then(async () => {
      try {
        const args = await launchArgs();
        if (args.length) await st.openPaths(args);
      } catch { /* ignore */ }
      void st.syncLibrary(true); // auto-scan the Windows Videos folder + added folders
    });
  }, []);

  // theme + language attribute
  useEffect(() => {
    applyTheme(settings.seedColor, settings.themeMode);
    document.documentElement.lang = resolveLang(settings.language);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => settings.themeMode === 'system' && applyTheme(settings.seedColor, 'system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.themeMode, settings.seedColor, settings.language]);

  useEffect(() => {
    if (!useStore.getState().mini) win().setAlwaysOnTop(settings.alwaysOnTop).catch(() => undefined);
  }, [settings.alwaysOnTop]);

  // OS events: drag & drop, second instance, sleep timer
  useEffect(() => {
    const st = useStore.getState();
    const unsubs: Array<Promise<() => void>> = [];
    unsubs.push(getCurrentWebview().onDragDropEvent((e) => {
      const p = e.payload;
      if (p.type === 'enter' || p.type === 'over') st.set({ dragOver: true });
      else if (p.type === 'leave') st.set({ dragOver: false });
      else if (p.type === 'drop') { st.set({ dragOver: false }); void st.openPaths(p.paths); }
    }));
    unsubs.push(listen<string[]>('open-paths', (e) => void st.openPaths(e.payload)));
    const timer = window.setInterval(() => {
      const s = useStore.getState();
      if (s.sleepAt && Date.now() >= s.sleepAt) {
        engine.pause();
        s.set({ sleepAt: null });
        s.showToast(tr('sleepDone'));
      }
    }, 1000);
    const onUnload = () => useStore.getState().saveProgress();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      unsubs.forEach((p) => p.then((u) => u()).catch(() => undefined));
      clearInterval(timer);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  // Windows media keys / overlay
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const st = useStore.getState();
    ms.setActionHandler('play', () => void engine.play());
    ms.setActionHandler('pause', () => engine.pause());
    ms.setActionHandler('previoustrack', () => st.prev());
    ms.setActionHandler('nexttrack', () => st.next(false));
    ms.setActionHandler('seekbackward', () => st.seekBy(-10));
    ms.setActionHandler('seekforward', () => st.seekBy(10));
  }, []);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = cur ? new MediaMetadata({ title: cur.name, artist: 'Material Video Player' }) : null;
  }, [cur?.path]);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if ((el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range') || el.tagName === 'TEXTAREA') return;
      const s = useStore.getState();
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'F5' && s.screen === 'home') { e.preventDefault(); void s.syncLibrary(false, true); return; }
      if (e.key === 'F11' || (e.key === 'Escape' && s.fullscreen && !s.dialog && !s.menu)) { e.preventDefault(); void s.toggleFullscreen(e.key === 'F11' ? undefined : false); return; }
      if (ctrl && k === 'o') { e.preventDefault(); void (e.shiftKey ? s.openFolder() : s.openFiles()); return; }
      if (ctrl || e.altKey || s.dialog || s.screen !== 'player') return;
      const onRange = el.tagName === 'INPUT';
      const rate = (d: number) => { const r = Math.min(4, Math.max(0.25, Math.round((s.rate + d) * 100) / 100)); s.setRate(r); s.showToast(`${r}×`); };
      if (e.key === ' ' || k === 'k') { e.preventDefault(); if (el.tagName === 'BUTTON') el.blur(); s.togglePlay(); }
      else if (e.key === 'ArrowRight' && !onRange) { e.preventDefault(); s.seekBy(s.settings.seekStep); }
      else if (e.key === 'ArrowLeft' && !onRange) { e.preventDefault(); s.seekBy(-s.settings.seekStep); }
      else if (k === 'l') s.seekBy(10);
      else if (k === 'j') s.seekBy(-10);
      else if (e.key === 'ArrowUp' && !onRange) { e.preventDefault(); s.setVolume(Math.min(1, s.settings.volume + 0.05)); }
      else if (e.key === 'ArrowDown' && !onRange) { e.preventDefault(); s.setVolume(Math.max(0, s.settings.volume - 0.05)); }
      else if (k === 'm') s.toggleMute();
      else if (k === 'f') { e.preventDefault(); void s.toggleFullscreen(); }
      else if (e.key === 'Escape') { if (s.fullscreen) void s.toggleFullscreen(false); else if (s.mini) void s.toggleMini(); else if (s.showQueue) s.set({ showQueue: false }); }
      else if (e.key === '[') rate(-0.25);
      else if (e.key === ']') rate(0.25);
      else if (e.key === ',') engine.frameStep(-1);
      else if (e.key === '.') engine.frameStep(1);
      else if (e.shiftKey && k === 'n') s.next(false);
      else if (e.shiftKey && k === 'p') s.prev();
      else if (e.key === 'PageDown') s.next(false);
      else if (e.key === 'PageUp') s.prev();
      else if (k === 'c') s.cycleSub();
      else if (k === 'v') s.toggleSub();
      else if (k === 'g') { s.setSubDelay(s.subDelay - 100); s.showToast(`${tr('subDelay')}: ${((useStore.getState().subDelay) / 1000).toFixed(1)} s`); }
      else if (k === 'h') { s.setSubDelay(s.subDelay + 100); s.showToast(`${tr('subDelay')}: ${((useStore.getState().subDelay) / 1000).toFixed(1)} s`); }
      else if (k === 'a') s.cycleLoop();
      else if (k === 's') void s.screenshot();
      else if (k === 'q') s.set({ showQueue: !s.showQueue });
      else if (k === 'r') s.setAdjust({ rotate: (s.adjust.rotate + 90) % 360 });
      else if (k === 't') void s.toggleMini();
      else if (k === 'i') s.openDialog({ type: 'info' });
      else if (e.key === 'Home') s.seek(0);
      else if (e.key === 'End') s.seek(Math.max(0, (engine.el?.duration ?? 0) - 1));
      else if (/^[0-9]$/.test(e.key) && !onRange) s.seek(((engine.el?.duration ?? 0) * Number(e.key)) / 10);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // disable the native context menu
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest('input, textarea')) e.preventDefault(); };
    window.addEventListener('contextmenu', h);
    return () => window.removeEventListener('contextmenu', h);
  }, []);

  if (!ready) {
    return <div className="h-full flex flex-col items-center justify-center gap-4 bg-surface"><Logo size={72} /><div className="text-body-md text-on-surface-variant">{t('loading')}</div></div>;
  }

  return (
    <div className="h-full flex flex-col bg-surface text-on-surface">
      {screen === 'player' ? (
        <div key="player" className="flex-1 min-h-0 animate-fade-in"><Player /></div>
      ) : (
        <>
          <TitleBar />
          <main key={screen} className="flex-1 min-h-0 mx-3 mb-3 rounded-3xl bg-surface-container-low overflow-hidden animate-rise">
            {screen === 'settings' ? <SettingsView /> : <HomeView />}
          </main>
        </>
      )}
      <Dialogs />
      <ContextMenu />
      <Snackbar />
      {dragOver && (
        <div className="fixed inset-0 z-[90] bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="rounded-m3-xl bg-primary-container text-on-primary-container px-12 py-10 text-center shadow-2xl border-2 border-dashed border-primary">
            <Icon name="movie" size={56} fill />
            <div className="text-title-lg mt-2">{t('dropTitle')}</div>
            <div className="text-body-md">{t('dropSub')}</div>
          </div>
        </div>
      )}
    </div>
  );
}

