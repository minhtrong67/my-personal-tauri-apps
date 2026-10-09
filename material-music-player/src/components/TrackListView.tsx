import { memo, useRef, type ReactNode } from 'react';
import { MediaCard } from './MediaCard';
import { TrackRow } from './TrackRow';
import { VirtualGrid } from './VirtualGrid';
import { VirtualList } from './VirtualList';
import { openMenuAt, openMenuBelow } from './ui';
import { trackMenu } from '../lib/menus';
import { useStore } from '../lib/store';
import type { Track, ViewMode } from '../lib/types';

const TrackCard = memo(function TrackCard({ track, onPlay, onRemove, removeLabel }: { track: Track; onPlay: () => void; onRemove?: () => void; removeLabel?: string }) {
  const isCurrent = useStore((s) => s.queue[s.index] === track.id);
  const menu = () => trackMenu(track, { onPlay, onRemoveFromList: onRemove, removeLabel });
  return (
    <MediaCard
      fluid active={isCurrent} track={track} title={track.title} subtitle={track.artist}
      onOpen={onPlay} onPlay={onPlay} onContextMenu={(e) => openMenuAt(e, menu())} onMore={(e) => openMenuBelow(e, menu(), true)}
    />
  );
});

/** Danh sách bài hát dạng hàng (list) hoặc dạng ô (grid), đều được ảo hoá */
export function TrackListView({
  tracks, mode, header, footer, className = '', onPlayAt, onRemove, removeLabel, onReorder, hideAlbum,
}: {
  tracks: Track[]; mode: ViewMode; header?: ReactNode; footer?: ReactNode; className?: string;
  onPlayAt: (index: number) => void; onRemove?: (index: number) => void; removeLabel?: string;
  onReorder?: (from: number, to: number) => void; hideAlbum?: boolean;
}) {
  const dragFrom = useRef(-1);
  if (mode === 'grid') {
    return (
      <VirtualGrid
        className={className} items={tracks} header={header} footer={footer}
        renderItem={(t, i) => <TrackCard track={t} onPlay={() => onPlayAt(i)} onRemove={onRemove ? () => onRemove(i) : undefined} removeLabel={removeLabel} />}
      />
    );
  }
  return (
    <VirtualList
      className={className} items={tracks} rowHeight={56} header={header} footer={footer}
      renderRow={(t, i) => (
        <TrackRow
          track={t} index={i} showAlbum={!hideAlbum} onPlay={() => onPlayAt(i)}
          onRemove={onRemove ? () => onRemove(i) : undefined} removeLabel={removeLabel}
          draggable={!!onReorder} onDragStartRow={(k) => (dragFrom.current = k)}
          onDropRow={(k) => { if (dragFrom.current >= 0 && onReorder) onReorder(dragFrom.current, k); dragFrom.current = -1; }}
        />
      )}
    />
  );
}
