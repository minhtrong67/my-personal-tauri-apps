import { useMemo, useState, type MouseEvent } from 'react';
import { useStore } from '../lib/store';
import { tr as tr_ } from '../lib/i18n';
import { openWithDefault, reveal } from '../lib/tauri';
import { useLang, useT } from '../lib/useT';
import { basename, fmtSize, fmtTime, natural, norm, pathKey } from '../lib/utils';
import { AuthorCredit, Button, Icon, IconButton, Logo, Segmented, openMenuAt, openMenuBelow } from '../components/ui';
import { Poster } from '../components/Poster';
import { ViewToggle } from '../components/ViewToggle';
import type { LibrarySort, MenuItem, Recent, VideoFile } from '../lib/types';

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

function useProgressPct(path: string) {
  const prog = useStore((s) => s.progress[pathKey(path)]);
  return { prog, pct: prog && prog.dur ? Math.min(100, (prog.pos / prog.dur) * 100) : 0 };
}

const cardCls = 'group relative w-full cursor-pointer rounded-2xl p-2 transition-all duration-300 ease-emphasized hover:bg-on-surface/[.06] hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.985] animate-card-in';
const delay = (i: number) => ({ animationDelay: `${Math.min(i, 14) * 28}ms` });

function fileMenu(f: { path: string }, play: () => void, extra: MenuItem[] = []): MenuItem[] {
  const st = useStore.getState();
  return [
    { label: tr_('play'), icon: 'play_arrow', onClick: play },
    { label: tr_('showInFolder'), icon: 'folder_open', onClick: () => void reveal(f.path) },
    { label: tr_('copyPath'), icon: 'content_copy', onClick: () => void navigator.clipboard.writeText(f.path).then(() => st.showToast(tr_('pathCopied'))).catch(() => st.showToast(tr_('copyFailed'))) },
    { label: tr_('openDefaultApp'), icon: 'open_in_new', onClick: () => void openWithDefault(f.path) },
    ...extra,
  ];
}
/* ---------- recent / continue-watching card ---------- */
function VideoCard({ r, i }: { r: Recent; i: number }) {
  const t = useT();
  const ago = useTimeAgo();
  const { prog, pct } = useProgressPct(r.path);
  const st = useStore.getState();
  const play = () => void st.openPaths([r.path]);
  const items = () => fileMenu(r, play, [{ divider: true }, { label: t('removeFromHistory'), icon: 'delete', danger: true, onClick: () => st.removeRecent(r.path) }]);
  return (
    <div className={cardCls} style={delay(i)} onClick={play} onContextMenu={(e: MouseEvent) => openMenuAt(e, items())}>
      <Poster path={r.path} size={r.size} fallbackDur={r.dur} pct={pct} />
      <div className="mt-2 px-1">
        <div className="truncate text-title-sm text-on-surface" title={r.name}>{r.name}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{pct > 0 ? `${fmtTime(prog!.pos)} · ` : ''}{ago(r.at)}</div>
      </div>
      <IconButton icon="more_vert" size="sm" title={t('more')} className="!absolute right-3 top-3 bg-black/50 !text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100" onClick={(e) => openMenuBelow(e, items(), true)} />
    </div>
  );
}

/* ---------- library: grid card + list row ---------- */
function LibraryCard({ f, i, onPlay }: { f: VideoFile; i: number; onPlay: () => void }) {
  const t = useT();
  const { pct } = useProgressPct(f.path);
  const items = () => fileMenu(f, onPlay);
  return (
    <div className={cardCls} style={delay(i)} onClick={onPlay} onContextMenu={(e: MouseEvent) => openMenuAt(e, items())}>
      <Poster path={f.path} size={f.size} pct={pct} />
      <div className="mt-2 px-1">
        <div className="truncate text-title-sm text-on-surface" title={f.name}>{f.name}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{basename(f.folder)} · {fmtSize(f.size)}</div>
      </div>
      <IconButton icon="more_vert" size="sm" title={t('more')} className="!absolute right-3 top-3 bg-black/50 !text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100" onClick={(e) => openMenuBelow(e, items(), true)} />
    </div>
  );
}

function LibraryRow({ f, i, onPlay }: { f: VideoFile; i: number; onPlay: () => void }) {
  const t = useT();
  const lang = useLang();
  const { pct } = useProgressPct(f.path);
  const items = () => fileMenu(f, onPlay);
  return (
    <div
      className="group relative mx-6 px-2 py-2 rounded-2xl flex items-center gap-4 cursor-pointer animate-rise transition-all duration-300 ease-emphasized hover:bg-on-surface/[.06] hover:translate-x-1 active:scale-[0.995]"
      style={delay(i)} onClick={onPlay} onContextMenu={(e: MouseEvent) => openMenuAt(e, items())}
    >
      <Poster path={f.path} size={f.size} pct={pct} compact className="w-36 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-title-sm text-on-surface" title={f.name}>{f.name}</div>
        <div className="truncate text-body-sm text-on-surface-variant">{basename(f.folder)}</div>
      </div>
      <div className="hidden md:block w-24 text-right text-body-md text-on-surface-variant tabular-nums">{fmtSize(f.size)}</div>
      <div className="hidden lg:block w-32 text-right text-body-md text-on-surface-variant">{new Date(f.modified * 1000).toLocaleDateString(lang)}</div>
      <IconButton icon="play_arrow" fill variant="tonal" size="sm" title={t('play')} className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100" onClick={(e) => { e.stopPropagation(); onPlay(); }} />
      <IconButton icon="more_vert" size="sm" title={t('more')} onClick={(e) => openMenuBelow(e, items(), true)} />
    </div>
  );
}

const GRID = 'grid gap-1 px-6 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]';
/** Every toolbar button shares the same height and width so rows line up */
const BTN = 'w-[150px] justify-center';

function LibraryTab() {
  const t = useT();
  const library = useStore((s) => s.library);
  const sort = useStore((s) => s.settings.librarySort);
  const view = useStore((s) => s.settings.libraryView);
  const syncing = useStore((s) => s.syncing);
  const st = useStore.getState();
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? library.filter((f) => norm(`${f.name} ${basename(f.folder)}`).includes(n)) : [...library];
    if (sort === 'name') list.sort((a, b) => natural(a.name, b.name));
    else if (sort === 'size') list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => b.modified - a.modified);
    return list;
  }, [library, q, sort]);

  const total = library.reduce((a, f) => a + f.size, 0);
  const sorts: { key: LibrarySort; label: string }[] = [{ key: 'date', label: t('sortDate') }, { key: 'name', label: t('sortName') }, { key: 'size', label: t('sortSize') }];

  return (
    <div className="h-full flex flex-col">
      {/* toolbar: title on the left, controls evenly spaced on the right */}
      <div className="px-8 pb-3 flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="mr-auto min-w-[140px]">
          <div className="text-title-lg">{t('library')}</div>
          <div className="text-body-sm text-on-surface-variant">{t('nVideos', { n: library.length })} · {fmtSize(total)}</div>
        </div>
        <div className="relative w-64">
          <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchLibrary')}
            className="h-10 w-full pl-10 pr-9 rounded-full bg-surface-container-high text-body-md outline-none transition-shadow duration-200 focus:ring-2 ring-primary/60 placeholder:text-on-surface-variant"
          />
          {q && <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-on-surface/[.08] active:scale-90 transition-all flex items-center justify-center animate-pop" aria-label={t('clear')} onClick={() => setQ('')}><Icon name="close" size={18} /></button>}
        </div>
        <Button variant="tonal" icon="swap_vert" className={BTN} onClick={(e) => openMenuBelow(e, sorts.map((s) => ({ label: s.label, checked: s.key === sort, onClick: () => st.updateSettings({ librarySort: s.key }) })), true)}>{sorts.find((s) => s.key === sort)!.label}</Button>
        <ViewToggle value={view} onChange={(v) => st.updateSettings({ libraryView: v })} />
        <Button variant="tonal" icon="create_new_folder" className={BTN} onClick={st.addLibraryFolder}>{t('addFolder')}</Button>
        <Button icon="refresh" className={BTN} disabled={syncing} onClick={() => void st.syncLibrary(false, true)}>{syncing ? t('scanning') : t('refresh')}</Button>
      </div>

      {!library.length ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3 animate-fade-in">
          <div className="w-24 h-24 rounded-[32px] bg-primary-container text-on-primary-container flex items-center justify-center"><Icon name={syncing ? 'sync' : 'video_library'} size={48} fill className={syncing ? 'animate-spin' : ''} /></div>
          <div className="text-title-lg">{syncing ? t('scanning') : t('libraryEmpty')}</div>
          <p className="text-body-md text-on-surface-variant max-w-md">{t('libraryEmptyDesc')}</p>
        </div>
      ) : !items.length ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant animate-fade-in">{t('noResults')}</div>
      ) : (
        <div key={view} className="flex-1 overflow-y-auto pb-8 scroll-smooth animate-fade-in">
          {view === 'grid' ? (
            <div className={GRID}>{items.map((f, i) => <LibraryCard key={f.path} f={f} i={i} onPlay={() => st.playFiles(items, i)} />)}</div>
          ) : (
            <div className="flex flex-col gap-0.5">{items.map((f, i) => <LibraryRow key={f.path} f={f} i={i} onPlay={() => st.playFiles(items, i)} />)}</div>
          )}
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
        <div className="animate-pop"><Logo size={96} /></div>
        <h1 className="text-headline-lg mt-6 animate-rise" style={{ animationDelay: '80ms' }}>Material Video Player</h1>
        <p className="text-body-lg text-on-surface-variant max-w-md mt-1 mb-8 animate-rise" style={{ animationDelay: '140ms' }}>{t('homeTagline')}</p>
        <div className="flex items-center gap-2 text-body-md text-on-surface-variant border border-dashed border-outline-variant rounded-2xl px-6 py-4 animate-rise" style={{ animationDelay: '200ms' }}><Icon name="drag_pan" />{t('dropHint')}</div>
        <div className="mt-8 animate-rise" style={{ animationDelay: '280ms' }}><AuthorCredit center /></div>
      </div>
    );
  }

  const resume = recents.filter((r) => {
    const p = progress[pathKey(r.path)];
    return p && p.dur > 0 && p.pos / p.dur > 0.02 && p.pos / p.dur < 0.95;
  }).slice(0, 8);

  return (
    <div className="h-full overflow-y-auto pb-8 scroll-smooth animate-fade-in">
      {resume.length > 0 && (
        <section className="mb-6">
          <h2 className="text-title-lg px-8 mb-2">{t('continueWatching')}</h2>
          <div className={GRID}>{resume.map((r, i) => <VideoCard key={r.path} r={r} i={i} />)}</div>
        </section>
      )}
      <section>
        <div className="flex items-center justify-between px-8 mb-2">
          <h2 className="text-title-lg">{t('recent')}</h2>
          <Button variant="text" icon="delete_sweep" onClick={() => st.openDialog({ type: 'confirm', title: t('clearHistory'), text: t('clearHistoryText'), confirmLabel: t('clear'), danger: true, onConfirm: st.clearHistory })}>{t('clearHistory')}</Button>
        </div>
        <div className={GRID}>{recents.map((r, i) => <VideoCard key={r.path} r={r} i={i} />)}</div>
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
      <div className="px-8 pt-4 pb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab} onChange={(v) => st.set({ homeTab: v })}
          options={[{ value: 'home', label: t('home'), icon: 'home' }, { value: 'library', label: `${t('library')}${libCount ? ` (${libCount})` : ''}`, icon: 'video_library' }]}
        />
        {syncing && <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant animate-fade-in"><Icon name="sync" size={16} className="animate-spin" />{t('scanning')}</span>}
        <div className="flex-1" />
        <Button icon="video_file" className={BTN} onClick={st.openFiles}>{t('openFiles')}</Button>
        <Button icon="folder_open" variant="tonal" className={BTN} onClick={st.openFolder}>{t('openFolder')}</Button>
      </div>
      <div key={tab} className="flex-1 min-h-0 animate-rise">{tab === 'library' ? <LibraryTab /> : <RecentTab />}</div>
    </div>
  );
}
