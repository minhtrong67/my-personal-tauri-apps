import { useEffect, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Icon, IconButton, Logo } from './ui';
import { useStore } from '../lib/store';

export function WindowControls({ showMaximize = true }: { showMaximize?: boolean }) {
  const [maxed, setMaxed] = useState(false);
  useEffect(() => {
    const win = getCurrentWindow();
    const sync = () => win.isMaximized().then(setMaxed).catch(() => undefined);
    sync();
    let un: (() => void) | undefined;
    win.onResized(sync).then((u) => (un = u)).catch(() => undefined);
    return () => un?.();
  }, []);
  const win = getCurrentWindow();
  const cls = 'w-12 h-10 inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[.08] transition-colors';
  return (
    <div className="flex h-10 -mr-2">
      <button className={cls} aria-label={tr('minimize')} onClick={() => win.minimize()}><Icon name="remove" size={20} /></button>
      {showMaximize && <button className={cls} aria-label={tr('maximize')} onClick={() => win.toggleMaximize()}><Icon name={maxed ? 'filter_none' : 'crop_square'} size={18} /></button>}
      <button className={`${cls} hover:!bg-error hover:!text-on-error`} aria-label={tr('close')} onClick={() => win.close()}><Icon name="close" size={20} /></button>
    </div>
  );
}

export function TitleBar() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const canBack = useStore((s) => s.backStack.length > 0);
  const back = useStore((s) => s.back);
  const toggleNav = useStore((s) => s.set);
  const collapsed = useStore((s) => s.navCollapsed);
  const input = useRef<HTMLInputElement>(null);
  const syncing = useStore((s) => s.syncing);
  const fullscreen = useStore((s) => s.fullscreen);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div data-tauri-drag-region className="h-14 shrink-0 flex items-center gap-2 pl-3 pr-2 select-none">
      <IconButton icon="menu" title={tr('toggleNav')} onClick={() => toggleNav({ navCollapsed: !collapsed })} />
      <div className="flex items-center gap-2 pointer-events-none"><Logo size={26} /><span className="text-title-md hidden sm:block">Material Music Player</span></div>
      <IconButton icon="arrow_back" title={tr('back')} disabled={!canBack} onClick={back} />
      <div data-tauri-drag-region className="flex-1 flex justify-center">
        <div className="relative w-full max-w-xl">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            ref={input} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), input.current?.blur())}
            placeholder={tr('searchPlaceholder')}
            className="w-full h-11 pl-12 pr-11 rounded-full bg-surface-container-high text-body-lg text-on-surface placeholder:text-on-surface-variant outline-none focus:bg-surface-container-highest focus:ring-2 ring-primary/60 transition"
          />
          {query && <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-on-surface/[.08] flex items-center justify-center" aria-label={tr('clear')} onClick={() => setQuery('')}><Icon name="close" size={20} /></button>}
        </div>
      </div>
      <button
        type="button" title={tr('refreshLibraryTip')} aria-label={tr('refreshLibrary')} disabled={syncing}
        onClick={() => useStore.getState().syncLibrary(false, true)}
        className="w-10 h-10 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[.08] active:bg-on-surface/[.12] transition-colors focus-ring disabled:opacity-60 shrink-0"
      >
        <Icon name="refresh" className={syncing ? 'animate-spin' : ''} />
      </button>
      <IconButton icon={fullscreen ? 'fullscreen_exit' : 'fullscreen'} title={`${fullscreen ? tr('exitFullscreen') : tr('fullscreen')} (F11)`} onClick={() => void useStore.getState().toggleFullscreen()} />
      <IconButton icon="picture_in_picture_alt" title={tr('miniPlayer')} onClick={() => useStore.getState().set({ miniMode: true })} />
      <WindowControls />
    </div>
  );
}
