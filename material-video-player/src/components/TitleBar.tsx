import { useEffect, useState } from 'react';
import { win } from '../lib/window';
import { useStore } from '../lib/store';
import { useT } from '../lib/useT';
import { Icon, IconButton, Logo } from './ui';

export function WindowControls({ showMaximize = true, light }: { showMaximize?: boolean; light?: boolean }) {
  const t = useT();
  const [maxed, setMaxed] = useState(false);
  useEffect(() => {
    const w = win();
    const sync = () => w.isMaximized().then(setMaxed).catch(() => undefined);
    sync();
    let un: (() => void) | undefined;
    w.onResized(sync).then((u) => (un = u)).catch(() => undefined);
    return () => un?.();
  }, []);
  const w = win();
  const cls = `w-11 h-9 inline-flex items-center justify-center transition-colors ${light ? 'text-white hover:bg-white/15' : 'text-on-surface-variant hover:bg-on-surface/[.08]'}`;
  return (
    <div className="flex h-9">
      <button className={cls} aria-label={t('minimize')} onClick={() => w.minimize()}><Icon name="remove" size={20} /></button>
      {showMaximize && <button className={cls} aria-label={t('maximize')} onClick={() => w.toggleMaximize()}><Icon name={maxed ? 'filter_none' : 'crop_square'} size={18} /></button>}
      <button className={`${cls} hover:!bg-error hover:!text-on-error`} aria-label={t('close')} onClick={() => w.close()}><Icon name="close" size={20} /></button>
    </div>
  );
}

/** Title bar for the Home / Settings screens (the player draws its own overlay bar) */
export function TitleBar() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const prev = useStore((s) => s.prevScreen);
  const go = useStore((s) => s.go);
  const hasVideo = useStore((s) => s.index >= 0);
  const syncing = useStore((s) => s.syncing);
  const fullscreen = useStore((s) => s.fullscreen);
  return (
    <div data-tauri-drag-region className="h-14 shrink-0 flex items-center gap-2 pl-4 pr-1 select-none">
      {screen === 'settings' && <IconButton icon="arrow_back" title={t('back')} onClick={() => go(prev === 'player' && !hasVideo ? 'home' : prev)} />}
      <div className="flex items-center gap-2 pointer-events-none"><Logo size={26} /><span className="text-title-md">Material Video Player</span></div>
      {screen === 'settings' && <span className="text-title-md text-on-surface-variant pointer-events-none">/ {t('settings')}</span>}
      <div data-tauri-drag-region className="flex-1 h-full" />
      {screen === 'home' && (
        <button
          type="button" title={`${t('refreshLibrary')} (F5)`} aria-label={t('refreshLibrary')} disabled={syncing}
          onClick={() => void useStore.getState().syncLibrary(false, true)}
          className="group w-10 h-10 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[.08] active:bg-on-surface/[.12] active:scale-90 transition-all duration-200 focus-ring disabled:opacity-60 shrink-0"
        >
          <Icon name="refresh" className={syncing ? 'animate-spin' : 'transition-transform duration-500 ease-emphasized group-hover:rotate-180'} />
        </button>
      )}
      {screen !== 'settings' && (
        <button type="button" title={t('settings')} aria-label={t('settings')} onClick={() => go('settings')} className="group w-10 h-10 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[.08] active:bg-on-surface/[.12] active:scale-90 transition-all duration-200 focus-ring shrink-0">
          <Icon name="settings" className="transition-transform duration-500 ease-emphasized group-hover:rotate-90" />
        </button>
      )}
      <IconButton icon={fullscreen ? 'fullscreen_exit' : 'fullscreen'} title={`${fullscreen ? t('exitFullscreen') : t('fullscreen')} (F11)`} onClick={() => void useStore.getState().toggleFullscreen()} />
      <WindowControls />
    </div>
  );
}
