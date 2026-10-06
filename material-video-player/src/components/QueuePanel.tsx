import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { openWithDefault, reveal } from '../lib/tauri';
import { useT } from '../lib/useT';
import { fmtSize, norm, pathKey } from '../lib/utils';
import type { MenuItem, VideoFile } from '../lib/types';
import { Poster } from './Poster';
import { Button, Icon, IconButton, openMenuAt } from './ui';
import { ViewToggle } from './ViewToggle';

/** Playlist side sheet: search, list / grid view, drag to reorder, context menu */
export function QueuePanel() {
  const t = useT();
  const queue = useStore((s) => s.queue);
  const index = useStore((s) => s.index);
  const progress = useStore((s) => s.progress);
  const playing = useStore((s) => s.playing);
  const view = useStore((s) => s.settings.queueView);
  const st = useStore.getState();
  const [q, setQ] = useState('');
  const dragFrom = useRef(-1);
  const [dragOver, setDragOver] = useState(-1);
  const curRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const n = norm(q.trim());
    return queue.map((f, i) => ({ f, i })).filter(({ f }) => !n || norm(f.name).includes(n));
  }, [queue, q]);

  // keep the playing video in view
  useEffect(() => {
    curRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index, view]);

  const canDrag = view === 'list' && !q.trim();

  const menu = (f: VideoFile, i: number): MenuItem[] => [
    ...(i !== index ? [{ label: t('play'), icon: 'play_arrow', onClick: () => st.playIndex(i) }, { label: t('playNext'), icon: 'playlist_play', onClick: () => st.moveInQueue(i, i < index ? index : index + 1) }] : []),
    { label: t('showInFolder'), icon: 'folder_open', onClick: () => void reveal(f.path) },
    { label: t('copyPath'), icon: 'content_copy', onClick: () => void navigator.clipboard.writeText(f.path).then(() => st.showToast(t('pathCopied'))).catch(() => st.showToast(t('copyFailed'))) },
    { label: t('openDefaultApp'), icon: 'open_in_new', onClick: () => void openWithDefault(f.path) },
    ...(i !== index ? [{ divider: true }, { label: t('removeFromQueue'), icon: 'remove_circle_outline', danger: true, onClick: () => st.removeFromQueue(i) }] : []),
  ];

  const rowProps = (f: VideoFile, i: number) => ({
    ref: i === index ? curRef : undefined,
    draggable: canDrag,
    onDragStart: () => (dragFrom.current = i),
    onDragOver: (e: React.DragEvent) => { if (canDrag) { e.preventDefault(); setDragOver(i); } },
    onDragLeave: () => setDragOver(-1),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragOver(-1); if (dragFrom.current >= 0) st.moveInQueue(dragFrom.current, i); dragFrom.current = -1; },
    onClick: () => i !== index && st.playIndex(i),
    onContextMenu: (e: React.MouseEvent) => openMenuAt(e, menu(f, i)),
  });

  return (
    <aside className="w-[380px] shrink-0 h-full bg-surface-container text-on-surface flex flex-col animate-slide-left" onContextMenu={(e) => e.stopPropagation()}>
      <div className="h-14 shrink-0 flex items-center justify-between pl-5 pr-1">
        <div><div className="text-title-md">{t('queue')}</div><div className="text-body-sm text-on-surface-variant -mt-0.5">{t('nVideos', { n: queue.length })}</div></div>
        <div className="flex items-center">
          <Button variant="text" disabled={queue.length < 2} onClick={st.clearQueue}>{t('clearQueue')}</Button>
          <IconButton icon="close" title={t('close')} onClick={() => st.set({ showQueue: false })} />
        </div>
      </div>

      <div className="px-3 pb-3 flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchQueue')}
            className="w-full h-10 pl-10 pr-9 rounded-full bg-surface-container-high text-body-md outline-none transition-shadow duration-200 focus:ring-2 ring-primary/60 placeholder:text-on-surface-variant"
          />
          {q && <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-on-surface/[.08] active:scale-90 transition-all flex items-center justify-center animate-pop" aria-label={t('clear')} onClick={() => setQ('')}><Icon name="close" size={18} /></button>}
        </div>
        <ViewToggle value={view} onChange={(v) => st.updateSettings({ queueView: v })} />
      </div>

      <div key={view} className="flex-1 overflow-y-auto pb-3 scroll-smooth animate-fade-in">
        {!items.length && <div className="px-6 py-10 text-center text-on-surface-variant text-body-md">{t('noMatches')}</div>}

        {view === 'list' ? (
          items.map(({ f, i }, k) => {
            const cur = i === index;
            const prog = progress[pathKey(f.path)];
            const pct = prog && prog.dur ? Math.min(100, (prog.pos / prog.dur) * 100) : 0;
            return (
              <div
                key={f.path} {...rowProps(f, i)} style={{ animationDelay: `${Math.min(k, 12) * 20}ms` }}
                className={`group relative mx-2 px-2 py-1.5 rounded-xl flex items-center gap-3 cursor-pointer animate-rise transition-all duration-200 ease-emphasized hover:bg-on-surface/[.08] hover:translate-x-0.5 ${cur ? 'bg-secondary-container text-on-secondary-container' : ''} ${dragOver === i ? 'ring-2 ring-primary' : ''}`}
              >
                <Poster path={f.path} size={f.size} compact pct={pct} playing={cur && playing} className="w-[104px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className={`text-body-md line-clamp-2 break-all ${cur ? 'font-medium' : ''}`}>{f.name}</div>
                  <div className="text-body-sm text-on-surface-variant flex items-center gap-2">
                    <span>{i + 1}</span><span>·</span><span>{fmtSize(f.size)}</span>
                    {pct > 0 && <span className="text-primary">{Math.round(pct)}%</span>}
                  </div>
                </div>
                {!cur && <IconButton icon="close" size="sm" title={t('remove')} className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100" onClick={(e) => { e.stopPropagation(); st.removeFromQueue(i); }} />}
              </div>
            );
          })
        ) : (
          <div className="grid grid-cols-2 gap-1 px-2">
            {items.map(({ f, i }, k) => {
              const cur = i === index;
              const prog = progress[pathKey(f.path)];
              const pct = prog && prog.dur ? Math.min(100, (prog.pos / prog.dur) * 100) : 0;
              return (
                <div
                  key={f.path} {...rowProps(f, i)} style={{ animationDelay: `${Math.min(k, 12) * 25}ms` }}
                  className={`group relative p-1.5 rounded-xl cursor-pointer animate-card-in transition-all duration-300 ease-emphasized hover:bg-on-surface/[.08] hover:-translate-y-0.5 hover:shadow-md ${cur ? 'bg-secondary-container' : ''}`}
                >
                  <Poster path={f.path} size={f.size} compact pct={pct} playing={cur && playing} className={cur ? 'ring-2 ring-primary' : ''} />
                  <div className={`mt-1.5 px-0.5 text-body-sm line-clamp-2 break-all ${cur ? 'font-medium text-on-secondary-container' : ''}`}>{f.name}</div>
                  <div className="px-0.5 text-label-md text-on-surface-variant">{i + 1} · {fmtSize(f.size)}</div>
                  {!cur && <IconButton icon="close" size="sm" title={t('remove')} className="!absolute right-2.5 top-2.5 bg-black/55 !text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100" onClick={(e) => { e.stopPropagation(); st.removeFromQueue(i); }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
