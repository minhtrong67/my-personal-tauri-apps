import { useRef } from 'react';
import { Cover } from './Cover';
import { Icon, IconButton, Button } from './ui';
import { VirtualList } from './VirtualList';
import { useStore } from '../lib/store';
import { fmtTime } from '../lib/utils';

export function QueuePanel({ embedded = false }: { embedded?: boolean }) {
  const queue = useStore((s) => s.queue);
  const index = useStore((s) => s.index);
  const byId = useStore((s) => s.byId);
  const st = useStore.getState();
  const dragFrom = useRef(-1);
  const items = queue.map((id, i) => ({ id, i }));

  return (
    <aside className={`${embedded ? 'h-full' : 'w-[360px] shrink-0 rounded-3xl bg-surface-container-low mr-3 animate-slide-left'} flex flex-col overflow-hidden`}>
      <div className="h-16 shrink-0 flex items-center justify-between pl-6 pr-2">
        <div><div className="text-title-lg">Hàng chờ</div><div className="text-body-sm text-on-surface-variant -mt-1">{queue.length} bài</div></div>
        <div className="flex items-center">
          <Button variant="text" onClick={st.clearQueue} disabled={queue.length < 2}>Xóa hàng chờ</Button>
          {!embedded && <IconButton icon="close" title="Đóng" onClick={() => st.set({ showQueue: false })} />}
        </div>
      </div>
      {!queue.length ? (
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-2 px-8 text-center"><Icon name="queue_music" size={48} /><div>Hàng chờ trống</div></div>
      ) : (
        <VirtualList
          className="flex-1" items={items} rowHeight={60} initialIndex={Math.max(0, index)}
          renderRow={({ id, i }) => {
            const t = byId[id];
            if (!t) return null;
            const cur = i === index;
            return (
              <div
                draggable onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragFrom.current >= 0) st.moveInQueue(dragFrom.current, i); dragFrom.current = -1; }}
                onDoubleClick={() => st.playIndex(i)}
                className={`group h-[56px] mx-2 px-2 rounded-xl flex items-center gap-3 hover:bg-on-surface/[.08] ${cur ? 'bg-secondary-container' : ''}`}
              >
                <Icon name="drag_indicator" size={18} className="text-on-surface-variant opacity-0 group-hover:opacity-100 cursor-grab" />
                <Cover track={t} className="w-10 h-10 rounded-lg" iconSize={20} />
                <button className="min-w-0 flex-1 text-left" onClick={() => st.playIndex(i)}>
                  <div className={`truncate text-body-md ${cur ? 'text-on-secondary-container font-medium' : ''}`}>{t.title}</div>
                  <div className="truncate text-body-sm text-on-surface-variant">{t.artist}</div>
                </button>
                <span className="text-body-sm text-on-surface-variant tabular-nums group-hover:hidden">{fmtTime(t.duration)}</span>
                {!cur && <IconButton icon="close" size="sm" title="Bỏ khỏi hàng chờ" className="hidden group-hover:inline-flex" onClick={() => st.removeFromQueue(i)} />}
              </div>
            );
          }}
        />
      )}
    </aside>
  );
}
