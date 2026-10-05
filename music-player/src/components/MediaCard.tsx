import { Cover } from './Cover';
import { Icon } from './ui';
import type { Track } from '../lib/types';
import type { MouseEvent, ReactNode } from 'react';

export function MediaCard({ track, title, subtitle, onOpen, onPlay, round, onContextMenu, onMore, fallbackIcon, fluid, active }: {
  track?: Track; title: string; subtitle?: string; onOpen: () => void; onPlay?: () => void; round?: boolean;
  onContextMenu?: (e: MouseEvent) => void; onMore?: (e: MouseEvent<HTMLElement>) => void; fallbackIcon?: ReactNode;
  /** true = chiếm hết chiều rộng ô lưới; false = cố định 168px (hàng cuộn ngang) */
  fluid?: boolean; active?: boolean;
}) {
  return (
    <div
      className={`group cursor-pointer rounded-2xl p-2 hover:bg-on-surface/[.06] transition-colors ${fluid ? 'w-full' : 'w-[168px] shrink-0'} ${active ? 'bg-secondary-container/50' : ''}`}
      onClick={onOpen} onContextMenu={onContextMenu}
    >
      <div className="relative">
        {track ? (
          <Cover track={track} className={`w-full aspect-square ${round ? '' : 'rounded-xl'}`} round={round} iconSize={48} />
        ) : (
          <div className={`w-full aspect-square bg-secondary-container text-on-secondary-container flex items-center justify-center ${round ? 'rounded-full' : 'rounded-xl'}`}>{fallbackIcon ?? <Icon name="queue_music" size={48} fill />}</div>
        )}
        {onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }} aria-label="Phát"
            className="absolute right-2 bottom-2 w-12 h-12 rounded-2xl bg-primary text-on-primary shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-emphasized hover:brightness-110"
          >
            <Icon name="play_arrow" fill size={28} />
          </button>
        )}
        {onMore && (
          <button
            onClick={(e) => { e.stopPropagation(); onMore(e); }} aria-label="Tùy chọn"
            className="absolute right-2 top-2 w-8 h-8 rounded-full bg-surface/80 text-on-surface backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface"
          >
            <Icon name="more_vert" size={20} />
          </button>
        )}
      </div>
      <div className="mt-2 px-1">
        <div className={`truncate text-title-sm ${active ? 'text-primary' : 'text-on-surface'}`}>{title}</div>
        <div className="truncate text-body-sm text-on-surface-variant h-4">{subtitle}</div>
      </div>
    </div>
  );
}
