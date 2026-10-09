import type { ReactNode } from 'react';
import { tr } from '../lib/i18n';
import { Cover } from './Cover';
import { Button, Icon, IconButton } from './ui';
import { TrackListView } from './TrackListView';
import { ViewToggle } from './ViewToggle';
import { useStore, useViewMode } from '../lib/store';
import { fmtLong } from '../lib/utils';
import type { Track } from '../lib/types';

/** Trang danh sách bài hát dùng chung: album, nghệ sĩ, playlist, yêu thích, gần đây */
export function Collection({
  title, kind, subtitle, tracks, icon = 'queue_music', actions, extra, onRemove, removeLabel, onReorder, emptyText = tr('noSongsYet'), hideAlbum, viewKey = 'detail',
}: {
  title: string; kind: string; subtitle?: string; tracks: Track[]; icon?: string; actions?: ReactNode; extra?: ReactNode;
  onRemove?: (index: number) => void; removeLabel?: string; onReorder?: (from: number, to: number) => void; emptyText?: string; hideAlbum?: boolean; viewKey?: string;
}) {
  const playTracks = useStore((s) => s.playTracks);
  const addToQueue = useStore((s) => s.addToQueue);
  const ids = tracks.map((t) => t.id);
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const [mode, setMode] = useViewMode(viewKey);

  const header = (
    <div>
      <div className="flex items-end gap-6 px-8 pt-8 pb-6">
        {tracks[0] ? (
          <Cover track={tracks[0]} className="w-44 h-44 rounded-3xl shadow-lg" iconSize={64} eager />
        ) : (
          <div className="w-44 h-44 rounded-3xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0"><Icon name={icon} size={64} fill /></div>
        )}
        <div className="min-w-0">
          <div className="text-label-lg text-on-surface-variant">{kind}</div>
          <h1 className="text-headline-lg text-on-surface truncate">{title}</h1>
          <div className="text-body-md text-on-surface-variant mt-1 truncate">
            {[subtitle, tr('nSongs', { n: tracks.length }), tracks.length ? fmtLong(total) : null].filter(Boolean).join(' • ')}
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Button icon="play_arrow" disabled={!tracks.length} onClick={() => playTracks(ids, 0)}>{tr('play')}</Button>
            <Button icon="shuffle" variant="tonal" disabled={!tracks.length} onClick={() => playTracks(ids, Math.floor(Math.random() * ids.length), true)}>{tr('shuffle')}</Button>
            <IconButton icon="queue_music" title={tr('addToQueue')} variant="outlined" disabled={!tracks.length} onClick={() => addToQueue(ids)} />
            {actions}
            <div className="ml-auto"><ViewToggle value={mode} onChange={setMode} /></div>
          </div>
        </div>
      </div>
      {extra}
    </div>
  );

  return (
    <TrackListView
      className="h-full" tracks={tracks} mode={mode} header={header} hideAlbum={hideAlbum}
      footer={!tracks.length ? <div className="text-center py-16 text-on-surface-variant">{emptyText}</div> : <div className="h-6" />}
      onPlayAt={(i) => playTracks(ids, i)} onRemove={onRemove} removeLabel={removeLabel} onReorder={mode === 'list' ? onReorder : undefined}
    />
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-8 pt-8 pb-4">
      <div className="min-w-0 shrink-0 max-w-[40%]">
        <h1 className="text-headline-lg truncate">{title}</h1>
        {subtitle && <div className="text-body-md text-on-surface-variant">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">{children}</div>
    </div>
  );
}

export function EmptyLibrary() {
  const importFolder = useStore((s) => s.importFolder);
  const importFiles = useStore((s) => s.importFiles);
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 animate-fade-in">
      <div className="w-28 h-28 rounded-[36px] bg-primary-container text-on-primary-container flex items-center justify-center mb-6"><Icon name="library_music" size={56} fill /></div>
      <h2 className="text-headline-sm mb-2">{tr('libraryEmptyTitle')}</h2>
      <p className="text-body-lg text-on-surface-variant max-w-md mb-6">{tr('libraryEmptyText')}</p>
      <div className="flex gap-3">
        <Button icon="create_new_folder" onClick={importFolder}>{tr('addFolder')}</Button>
        <Button icon="audio_file" variant="tonal" onClick={importFiles}>{tr('addMusicFiles')}</Button>
      </div>
    </div>
  );
}
