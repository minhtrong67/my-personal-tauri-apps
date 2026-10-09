import { Cover } from './Cover';
import { tr } from '../lib/i18n';
import { IconButton } from './ui';
import { SeekBar } from './PlayerControls';
import { WindowControls } from './TitleBar';
import { useCurrent, useStore } from '../lib/store';

export function MiniPlayer() {
  const t = useCurrent();
  const isPlaying = useStore((s) => s.isPlaying);
  const st = useStore.getState();
  return (
    <div className="h-full flex flex-col bg-surface-container">
      <div data-tauri-drag-region className="h-9 shrink-0 flex items-center justify-between pl-3 pr-1">
        <span className="text-label-md text-on-surface-variant pointer-events-none">Material Music Player</span>
        <div className="flex items-center">
          <IconButton icon="open_in_full" size="sm" title={tr('backToFull')} onClick={() => st.set({ miniMode: false })} />
          <WindowControls showMaximize={false} />
        </div>
      </div>
      <div className="flex-1 flex items-center gap-3 px-3 min-h-0">
        <Cover track={t} eager className="w-20 h-20 rounded-2xl" iconSize={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-title-sm">{t?.title ?? tr('nothingPlaying')}</div>
          <div className="truncate text-body-sm text-on-surface-variant">{t?.artist ?? ''}</div>
          <div className="flex items-center -ml-2 mt-1">
            <IconButton icon="skip_previous" fill size="sm" onClick={st.prev} title={tr('previous')} />
            <IconButton icon={isPlaying ? 'pause' : 'play_arrow'} fill variant="filled" onClick={st.togglePlay} title={tr('playPause')} />
            <IconButton icon="skip_next" fill size="sm" onClick={() => st.next(false)} title={tr('next')} />
          </div>
        </div>
      </div>
      <div className="px-3 pb-2"><SeekBar /></div>
    </div>
  );
}
