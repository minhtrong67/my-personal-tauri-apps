import type { MouseEvent, ReactNode } from 'react';
import { Cover } from './Cover';
import { MediaCard } from './MediaCard';
import { VirtualGrid } from './VirtualGrid';
import { VirtualList } from './VirtualList';
import { Icon, IconButton } from './ui';
import type { Track, ViewMode } from '../lib/types';

export interface Entity {
  key: string;
  track?: Track;
  title: string;
  subtitle?: string;
  meta?: string;
  round?: boolean;
  icon?: string;
  onOpen: () => void;
  onPlay?: () => void;
  onContext?: (e: MouseEvent) => void;
}

function EntityRow({ e }: { e: Entity }) {
  return (
    <div onClick={e.onOpen} onContextMenu={e.onContext} className="group h-14 mx-2 px-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-on-surface/[.08] transition-colors">
      {e.track ? (
        <Cover track={e.track} round={e.round} className={`w-10 h-10 ${e.round ? '' : 'rounded-lg'}`} iconSize={20} />
      ) : (
        <div className={`w-10 h-10 shrink-0 bg-secondary-container text-on-secondary-container flex items-center justify-center ${e.round ? 'rounded-full' : 'rounded-lg'}`}><Icon name={e.icon ?? 'queue_music'} size={22} fill /></div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-lg text-on-surface">{e.title}</div>
        {e.subtitle && <div className="truncate text-body-sm text-on-surface-variant">{e.subtitle}</div>}
      </div>
      {e.meta && <div className="hidden lg:block w-40 truncate text-body-md text-on-surface-variant text-right">{e.meta}</div>}
      {e.onPlay && <IconButton icon="play_arrow" fill size="sm" title="Phát" className="opacity-0 group-hover:opacity-100" onClick={(ev) => { ev.stopPropagation(); e.onPlay?.(); }} />}
      <Icon name="chevron_right" size={20} className="text-on-surface-variant" />
    </div>
  );
}

/** Album / nghệ sĩ / playlist dạng lưới hoặc danh sách */
export function EntityBrowser({ items, mode, className = '', footer }: { items: Entity[]; mode: ViewMode; className?: string; footer?: ReactNode }) {
  if (mode === 'grid') {
    return (
      <VirtualGrid
        className={className} items={items} footer={footer}
        renderItem={(e) => (
          <MediaCard fluid round={e.round} track={e.track} title={e.title} subtitle={e.subtitle} onOpen={e.onOpen} onPlay={e.onPlay} onContextMenu={e.onContext} fallbackIcon={<Icon name={e.icon ?? 'queue_music'} size={48} fill />} />
        )}
      />
    );
  }
  return <VirtualList className={className} items={items} rowHeight={56} footer={footer} renderRow={(e) => <EntityRow e={e} />} />;
}
