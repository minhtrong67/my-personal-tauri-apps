import { memo, type DragEvent } from 'react';
import { Cover } from './Cover';
import { Icon, IconButton, openMenuAt, openMenuBelow } from './ui';
import { trackMenu } from '../lib/menus';
import { useStore } from '../lib/store';
import { fmtTime } from '../lib/utils';
import type { Track } from '../lib/types';

function EqBars() {
  return (
    <span className="flex items-end gap-[2px] h-4">
      {[0, 0.25, 0.5].map((d) => (
        <span key={d} className="eq-bar w-[3px] h-full bg-primary rounded-full" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

interface Props {
  track: Track;
  index: number;
  onPlay: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  draggable?: boolean;
  onDragStartRow?: (i: number) => void;
  onDropRow?: (i: number) => void;
  showAlbum?: boolean;
}

export const TrackRow = memo(function TrackRow({ track: t, index, onPlay, onRemove, removeLabel, draggable, onDragStartRow, onDropRow, showAlbum = true }: Props) {
  const isCurrent = useStore((s) => s.queue[s.index] === t.id);
  const playing = useStore((s) => s.isPlaying);
  const liked = useStore((s) => !!s.liked[t.id]);
  const toggleLike = useStore((s) => s.toggleLike);
  const menu = () => trackMenu(t, { onPlay, onRemoveFromList: onRemove, removeLabel });

  return (
    <div
      draggable={draggable}
      onDragStart={(e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; onDragStartRow?.(index); }}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => { if (draggable) { e.preventDefault(); onDropRow?.(index); } }}
      onDoubleClick={onPlay}
      onContextMenu={(e) => openMenuAt(e, menu())}
      className={`group h-14 mx-2 px-2 rounded-xl flex items-center gap-3 transition-colors hover:bg-on-surface/[.08] ${isCurrent ? 'bg-secondary-container/50' : ''}`}
    >
      <div className="w-8 text-center text-body-md text-on-surface-variant shrink-0">
        {isCurrent && playing ? <div className="flex justify-center"><EqBars /></div> : isCurrent ? <Icon name="volume_down" size={20} className="text-primary" /> : <span className="group-hover:hidden">{index + 1}</span>}
        {!isCurrent && (
          <button className="hidden group-hover:inline-flex text-on-surface" onClick={onPlay} aria-label="Phát"><Icon name="play_arrow" fill size={22} /></button>
        )}
      </div>
      <Cover track={t} className="w-10 h-10 rounded-lg" iconSize={20} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-body-lg ${isCurrent ? 'text-primary font-medium' : 'text-on-surface'}`}>{t.title}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{t.artist}</div>
      </div>
      {showAlbum && <div className="hidden lg:block w-[26%] truncate text-body-md text-on-surface-variant">{t.album}</div>}
      <div className="w-8 shrink-0">
        <IconButton icon="favorite" size="sm" active={liked} fill={liked} title={liked ? 'Bỏ yêu thích' : 'Yêu thích'} className={liked ? '' : 'opacity-0 group-hover:opacity-100'} onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }} />
      </div>
      <div className="w-12 text-right text-body-md text-on-surface-variant tabular-nums shrink-0">{fmtTime(t.duration)}</div>
      <IconButton icon="more_vert" size="sm" title="Tùy chọn" className="opacity-0 group-hover:opacity-100" onClick={(e) => openMenuBelow(e, menu(), true)} />
    </div>
  );
});
