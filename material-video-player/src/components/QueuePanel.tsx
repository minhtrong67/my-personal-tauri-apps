import { useRef } from 'react';
import { useStore } from '../lib/store';
import { useT } from '../lib/useT';
import { fmtSize } from '../lib/utils';
import { Button, Icon, IconButton } from './ui';

export function QueuePanel() {
  const t = useT();
  const queue = useStore((s) => s.queue);
  const index = useStore((s) => s.index);
  const progress = useStore((s) => s.progress);
  const st = useStore.getState();
  const dragFrom = useRef(-1);
  return (
    <aside className="w-[340px] shrink-0 h-full bg-surface-container text-on-surface flex flex-col animate-slide-left">
      <div className="h-14 shrink-0 flex items-center justify-between pl-5 pr-1">
        <div><div className="text-title-md">{t('queue')}</div><div className="text-body-sm text-on-surface-variant -mt-0.5">{t('nVideos', { n: queue.length })}</div></div>
        <div className="flex items-center">
          <Button variant="text" disabled={queue.length < 2} onClick={st.clearQueue}>{t('clearQueue')}</Button>
          <IconButton icon="close" title={t('close')} onClick={() => st.set({ showQueue: false })} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        {queue.map((f, i) => {
          const cur = i === index;
          const prog = progress[f.path.replace(/\//g, '\\').toLowerCase()];
          return (
            <div
              key={f.path} draggable onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragFrom.current >= 0) st.moveInQueue(dragFrom.current, i); dragFrom.current = -1; }}
              className={`group mx-2 px-3 py-2 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-on-surface/[.08] ${cur ? 'bg-secondary-container text-on-secondary-container' : ''}`}
              onClick={() => !cur && st.playIndex(i)}
            >
              <div className="w-6 text-center text-body-sm text-on-surface-variant shrink-0">{cur ? <Icon name="play_arrow" fill size={20} className="text-primary" /> : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-body-md ${cur ? 'font-medium' : ''}`}>{f.name}</div>
                <div className="text-body-sm text-on-surface-variant flex items-center gap-2">
                  {fmtSize(f.size)}
                  {prog && prog.dur > 0 && <span className="text-primary">{Math.round((prog.pos / prog.dur) * 100)}%</span>}
                </div>
              </div>
              {!cur && <IconButton icon="close" size="sm" title={t('remove')} className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); st.removeFromQueue(i); }} />}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
