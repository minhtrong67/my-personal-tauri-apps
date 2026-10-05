import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useStore } from '../lib/store';
import { assetUrl, reveal } from '../lib/tauri';
import { useLang, useT } from '../lib/useT';
import { basename, fmtSize, fmtTime, natural, norm, pathKey } from '../lib/utils';
import { Button, Icon, IconButton, Logo, Segmented, openMenuAt, openMenuBelow } from '../components/ui';
import type { LibrarySort, Recent, VideoFile } from '../lib/types';

function useTimeAgo() {
  const lang = useLang();
  const t = useT();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  return (at: number) => {
    const s = Math.round((at - Date.now()) / 1000);
    const abs = Math.abs(s);
    if (abs < 60) return t('justNow');
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
    return rtf.format(Math.round(s / (86400 * 30)), 'month');
  };
}

/** 16:9 thumbnail; generated lazily when the card scrolls into view */
function Poster({ path, size, fallbackDur = 0, pct = 0 }: { path: string; size: number; fallbackDur?: number; pct?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const info = useStore((s) => s.thumbs[pathKey(path)]);
  const request = useStore((s) => s.requestThumb);
  const drop = useStore((s) => s.dropThumb);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (visible && (!info || info.sig !== String(size))) request({ path, size });
  }, [visible, info, path, size, request]);

  const dur = info?.dur || fallbackDur;
  return (
    <div ref={ref} className="relative aspect-video rounded-xl overflow-hidden bg-surface-container-highest flex items-center justify-center">
      {info?.thumb ? (
        <img src={assetUrl(info.thumb)} alt="" loading="lazy" draggable={false} onError={() => drop(path)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Icon name="movie" size={40} className="text-on-surface-variant" fill />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ease-emphasized"><Icon name="play_arrow" fill size={28} /></div>
      </div>
      {dur > 0 && <div className="absolute right-1.5 bottom-2 px-1.5 py-0.5 rounded bg-black/75 text-white text-label-md tabular-nums">{fmtTime(dur)}</div>}
      {pct > 0 && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

function useProgressPct(path: string) {
  const prog = useStore((s) => s.progress[pathKey(path)]);
  return { prog, pct: prog && prog.dur ? Math.min(100, (prog.pos / prog.dur) * 100) : 0 };
}

function VideoCard({ r }: { r: Recent }) {
  const t = useT();
  const ago = useTimeAgo();
  const { prog, pct } = useProgressPct(r.path);
  const st = useStore.getState();
  const play = () => void st.openPaths([r.path]);
  const items = () => [
    { label: t('play'), icon: 'play_arrow', onClick: play },
    { label: t('showInFolder'), icon: 'folder_open', onClick: () => void reveal(r.path) },
    { divider: true },
    { label: t('removeFromHistory'), icon: 'delete', danger: true, onClick: () => st.removeRecent(r.path) },
  ];
  return (
    <div className="group relative w-full cursor-pointer rounded-2xl p-2 hover:bg-on-surface/[.06] transition-colors" onClick={play} onContextMenu={(e: MouseEvent) => openMenuAt(e, items())}>
      <Poster path={r.path} size={r.size} fallbackDur={r.dur} pct={pct} />
      <div className="mt-2 px-1">
        <div className="truncate text-title-sm text-on-surface" title={r.name}>{r.name}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{pct > 0 ? `${fmtTime(prog!.pos)} · ` : ''}{ago(r.at)}</div>
      </div>
      <IconButton icon="more_vert" size="sm" title={t('more')} className="!absolute right-3 top-3 bg-black/50 !text-white opacity-0 group-hover:opacity-100" onClick={(e) => openMenuBelow(e, items(), true)} />
    </div>
  );
}

function LibraryCard({ f, onPlay }: { f: VideoFile; onPlay: () => void }) {
  const t = useT();
  const { pct } = useProgressPct(f.path);
  const items = () => [
    { label: t('play'), icon: 'play_arrow', onClick: onPlay },
    { label: t('showInFolder'), icon: 'folder_open', onClick: () => void reveal(f.path) },
  ];
  return (
    <div className="group relative w-full cursor-pointer rounded-2xl p-2 hover:bg-on-surface/[.06] transition-colors" onClick={onPlay} onContextMenu={(e: MouseEvent) => openMenuAt(e, items())}>
      <Poster path={f.path} size={f.size} pct={pct} />
      <div className="mt-2 px-1">
        <div className="truncate text-title-sm text-on-surface" title={f.name}>{f.name}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{basename(f.folder)} · {fmtSize(f.size)}</div>
      </div>
      <IconButton icon="more_vert" size="sm" title={t('more')} className="!absolute right-3 top-3 bg-black/50 !text-white opacity-0 group-hover:opacity-100" onClick={(e) => openMenuBelow(e, items(), true)} />
    </div>
  );
}

const GRID = 'grid gap-1 px-6 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]';

function LibraryTab() {
  const t = useT();
  const library = useStore((s) => s.library);
  const sort = useStore((s) => s.settings.librarySort);
  const syncing = useStore((s) => s.syncing);
  const st = useStore.getState();
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const n = norm(q.trim());
    let list = n ? library.filter((f) => norm(`${f.name} ${basename(f.folder)}`).includes(n)) : [...library];
    if (sort === 'name') list.sort((a, b) => natural(a.name, b.name));
    else if (sort === 'size') list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => b.modified - a.modified);
    return list;
  }, [library, q, sort]);

  const total = library.reduce((a, f) => a + f.size, 0);
  const sorts: { key: LibrarySort; label: string }[] = [{ key: 'date', label: t('sortDate') }, { key: 'name', label: t('sortName') }, { key: 'size', label: t('sortSize') }];

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="text-title-lg">{t('library')}</div>
          <div className="text-body-sm text-on-surface-variant">{t('nVideos', { n: library.length })} · {fmtSize(total)}</div>
        </div>
        <div className="relative">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchLibrary')}
            className="h-10 w-56 pl-10 pr-9 rounded-full bg-surface-container-high text-body-md outline-none focus:ring-2 ring-primary/60" />
          {q && <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-on-surface/[.08] flex items-center justify-center" aria-label={t('clear')} onClick={() => setQ('')}><Icon name="close" size={18} /></button>}
        </div>
        <Button variant="tonal" icon="swap_vert" onClick={(e) => openMenuBelow(e, sorts.map((s) => ({ label: s.label, checked: s.key === sort, onClick: () => st.updateSettings({ librarySort: s.key }) })), true)}>{sorts.find((s) => s.key === sort)!.label}</Button>
        <Button variant="tonal" icon="create_new_folder" onClick={st.addLibraryFolder}>{t('addFolder')}</Button>
        <Button icon="refresh" disabled={syncing} onClick={() => void st.syncLibrary(false, true)}>{syncing ? t('scanning') : t('refresh')}</Button>
      </div>
      {!library.length ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
          <div className="w-24 h-24 rounded-[32px] bg-primary-container text-on-primary-container flex items-center justify-center"><Icon name={syncing ? 'sync' : 'video_library'} size={48} fill className={syncing ? 'animate-spin' : ''} /></div>
          <div className="text-title-lg">{syncing ? t('scanning') : t('libraryEmpty')}</div>
          <p className="text-body-md text-on-surface-variant max-w-md">{t('libraryEmptyDesc')}</p>
        </div>
      ) : !items.length ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant">{t('noResults')}</div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-8">
          <div className={GRID}>
            {items.map((f, i) => <LibraryCard key={f.path} f={f} onPlay={() => st.playFiles(items, i)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function RecentTab() {
  const t = useT();
  const recents = useStore((s) => s.recents);
  const progress = useStore((s) => s.progress);
  const st = useStore.getState();

  if (!recents.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 animate-fade-in">
        <Logo size={96} />
        <h1 className="text-headline-lg mt-6">Lumina</h1>
        <p className="text-body-lg text-on-surface-variant max-w-md mt-1 mb-8">{t('homeTagline')}</p>
        <div className="flex items-center gap-2 text-body-md text-on-surface-variant border border-dashed border-outline-variant rounded-2xl px-6 py-4"><Icon name="drag_pan" />{t('dropHint')}</div>
      </div>
    );
  }

  const resume = recents.filter((r) => {
    const p = progress[pathKey(r.path)];
    return p && p.dur > 0 && p.pos / p.dur > 0.02 && p.pos / p.dur < 0.95;
  }).slice(0, 8);

  return (
    <div className="h-full overflow-y-auto pb-8 animate-fade-in">
      {resume.length > 0 && (
        <section className="mb-6">
          <h2 className="text-title-lg px-8 mb-2">{t('continueWatching')}</h2>
          <div className={GRID}>{resume.map((r) => <VideoCard key={r.path} r={r} />)}</div>
        </section>
      )}
      <section>
        <div className="flex items-center justify-between px-8 mb-2">
          <h2 className="text-title-lg">{t('recent')}</h2>
          <Button variant="text" icon="delete_sweep" onClick={() => st.openDialog({ type: 'confirm', title: t('clearHistory'), text: t('clearHistoryText'), confirmLabel: t('clear'), danger: true, onConfirm: st.clearHistory })}>{t('clearHistory')}</Button>
        </div>
        <div className={GRID}>{recents.map((r) => <VideoCard key={r.path} r={r} />)}</div>
      </section>
    </div>
  );
}

export function HomeView() {
  const t = useT();
  const recentsCount = useStore((s) => s.recents.length);
  const libCount = useStore((s) => s.library.length);
  const homeTab = useStore((s) => s.homeTab);
  const syncing = useStore((s) => s.syncing);
  const st = useStore.getState();
  const tab = homeTab ?? (recentsCount || !libCount ? 'home' : 'library');

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3">
        <Segmented
          value={tab} onChange={(v) => st.set({ homeTab: v })}
          options={[{ value: 'home', label: t('home'), icon: 'home' }, { value: 'library', label: `${t('library')}${libCount ? ` (${libCount})` : ''}`, icon: 'video_library' }]}
        />
        {syncing && <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant"><Icon name="sync" size={16} className="animate-spin" />{t('scanning')}</span>}
        <div className="flex-1" />
        <Button icon="video_file" onClick={st.openFiles}>{t('openFiles')}</Button>
        <Button icon="folder_open" variant="tonal" onClick={st.openFolder}>{t('openFolder')}</Button>
      </div>
      <div className="flex-1 min-h-0">{tab === 'library' ? <LibraryTab /> : <RecentTab />}</div>
    </div>
  );
}
