import { useMemo, useState } from 'react';
import { tr } from '../lib/i18n';
import { Collection, EmptyLibrary, PageHeader } from '../components/Collection';
import { MediaCard } from '../components/MediaCard';
import { TrackRow } from '../components/TrackRow';
import { TrackListView } from '../components/TrackListView';
import { EntityBrowser, type Entity } from '../components/EntityBrowser';
import { ViewToggle } from '../components/ViewToggle';
import { Button, Icon, openMenuBelow } from '../components/ui';
import { Cover } from '../components/Cover';
import { searchLibrary, sortTracksNatural, useDerived, useStore, useTrackList, useViewMode } from '../lib/store';
import { greeting, natural } from '../lib/utils';
import type { Album, Track } from '../lib/types';

const albumSub = (a: Album) => `${a.artist}${a.year ? ` • ${a.year}` : ''}`;

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-title-lg px-8 mb-2">{title}</h2>
      <div className="flex gap-2 overflow-x-auto px-6 pb-2">{children}</div>
    </section>
  );
}

export function HomeView() {
  const { all, albums } = useDerived();
  const history = useStore((s) => s.history);
  const plays = useStore((s) => s.plays);
  const byId = useStore((s) => s.byId);
  const playlists = useStore((s) => s.playlists);
  const { playTracks, nav } = useStore.getState();
  if (!all.length) return <EmptyLibrary />;

  const recent = history.map((h) => byId[h.id]).filter(Boolean).slice(0, 14);
  const top = Object.entries(plays).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]).filter(Boolean).slice(0, 14);
  const newest = [...all].sort((a, b) => b.addedAt - a.addedAt).slice(0, 14);
  const play = (list: Track[], i: number) => playTracks(list.map((t) => t.id), i);

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-headline-lg">{greeting()}</h1>
        <p className="text-body-lg text-on-surface-variant">{tr('homeSummary', { songs: all.length, albums: albums.length })}</p>
      </div>
      {recent.length > 0 && <Row title={tr('recentlyPlayed')}>{recent.map((t, i) => <MediaCard key={t.id} track={t} title={t.title} subtitle={t.artist} onOpen={() => play(recent, i)} onPlay={() => play(recent, i)} />)}</Row>}
      {playlists.length > 0 && (
        <Row title={tr('yourPlaylists')}>
          {playlists.map((p) => {
            const first = byId[p.trackIds[0]];
            return <MediaCard key={p.id} track={first} title={p.name} subtitle={tr('nSongs', { n: p.trackIds.length })} onOpen={() => nav({ name: 'playlist', id: p.id })} onPlay={() => playTracks(p.trackIds, 0)} fallbackIcon={<Icon name={p.folder ? 'folder' : 'queue_music'} size={48} fill />} />;
          })}
        </Row>
      )}
      {top.length > 0 && <Row title={tr('mostPlayed')}>{top.map((t, i) => <MediaCard key={t.id} track={t} title={t.title} subtitle={`${t.artist} • ${tr('nPlays', { n: plays[t.id] })}`} onOpen={() => play(top, i)} onPlay={() => play(top, i)} />)}</Row>}
      <Row title={tr('recentlyAdded')}>{newest.map((t, i) => <MediaCard key={t.id} track={t} title={t.title} subtitle={t.artist} onOpen={() => play(newest, i)} onPlay={() => play(newest, i)} />)}</Row>
      <Row title="Album">{albums.slice(0, 14).map((a) => <MediaCard key={a.key} track={a.tracks[0]} title={a.title} subtitle={albumSub(a)} onOpen={() => nav({ name: 'album', key: a.key })} onPlay={() => play(a.tracks, 0)} />)}</Row>
    </div>
  );
}

type SortKey = 'title' | 'artist' | 'album' | 'added' | 'duration' | 'plays';
const getSorts = (): { key: SortKey; label: string }[] => [
  { key: 'title', label: tr('sortTitle') }, { key: 'artist', label: tr('sortArtist') }, { key: 'album', label: tr('sortAlbum') },
  { key: 'added', label: tr('sortAdded') }, { key: 'duration', label: tr('sortDuration') }, { key: 'plays', label: tr('sortPlays') },
];

export function SongsView() {
  const { all } = useDerived();
  const plays = useStore((s) => s.plays);
  const [sort, setSort] = useState<SortKey>('title');
  const [desc, setDesc] = useState(false);
  const [mode, setMode] = useViewMode('songs');
  const playTracks = useStore((s) => s.playTracks);
  const importFolder = useStore((s) => s.importFolder);
  const importFiles = useStore((s) => s.importFiles);

  const sorted = useMemo(() => {
    const cmp: Record<SortKey, (a: Track, b: Track) => number> = {
      title: (a, b) => natural(a.title, b.title), artist: (a, b) => natural(a.artist, b.artist) || natural(a.title, b.title),
      album: (a, b) => natural(a.album, b.album) || a.trackNo - b.trackNo, added: (a, b) => a.addedAt - b.addedAt,
      duration: (a, b) => a.duration - b.duration, plays: (a, b) => (plays[a.id] ?? 0) - (plays[b.id] ?? 0),
    };
    const out = [...all].sort(cmp[sort]);
    return desc ? out.reverse() : out;
  }, [all, sort, desc, plays]);

  if (!all.length) return <EmptyLibrary />;
  const ids = sorted.map((t) => t.id);
  const label = getSorts().find((s) => s.key === sort)!.label;
  return (
    <div className="h-full flex flex-col">
      <PageHeader title={tr('songsTitle')} subtitle={tr('songsSub', { n: all.length })}>
        <Button variant="tonal" icon="swap_vert" onClick={(e) => openMenuBelow(e, getSorts().map((s) => ({ label: s.label, icon: s.key === sort ? 'check' : undefined, onClick: () => setSort(s.key) })), true)}>{label}</Button>
        <Button variant="text" icon={desc ? 'arrow_downward' : 'arrow_upward'} onClick={() => setDesc(!desc)}>{desc ? tr('descending') : tr('ascending')}</Button>
        <Button variant="tonal" icon="create_new_folder" onClick={importFolder}>{tr('folder')}</Button>
        <Button variant="tonal" icon="audio_file" onClick={importFiles}>{tr('file')}</Button>
        <Button icon="shuffle" onClick={() => playTracks(ids, Math.floor(Math.random() * ids.length), true)}>{tr('shuffle')}</Button>
        <ViewToggle value={mode} onChange={setMode} />
      </PageHeader>
      <TrackListView className="flex-1" tracks={sorted} mode={mode} footer={<div className="h-4" />} onPlayAt={(i) => playTracks(ids, i)} />
    </div>
  );
}

export function AlbumsView() {
  const { albums } = useDerived();
  const [mode, setMode] = useViewMode('albums');
  const { nav, playTracks } = useStore.getState();
  if (!albums.length) return <EmptyLibrary />;
  const items: Entity[] = albums.map((a) => ({
    key: a.key, track: a.tracks[0], title: a.title, subtitle: albumSub(a), meta: tr('nSongs', { n: a.tracks.length }),
    onOpen: () => nav({ name: 'album', key: a.key }), onPlay: () => playTracks(a.tracks.map((t) => t.id), 0),
  }));
  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Album" subtitle={`${albums.length} album`}><ViewToggle value={mode} onChange={setMode} /></PageHeader>
      <EntityBrowser className="flex-1" items={items} mode={mode} footer={<div className="h-4" />} />
    </div>
  );
}

export function AlbumView({ k }: { k: string }) {
  const { albums } = useDerived();
  const a = albums.find((x) => x.key === k);
  if (!a) return <div className="p-8 text-on-surface-variant">{tr('albumNotFound')}</div>;
  return <Collection title={a.title} kind="Album" subtitle={albumSub(a)} tracks={a.tracks} hideAlbum icon="album" />;
}

export function ArtistsView() {
  const { artists } = useDerived();
  const [mode, setMode] = useViewMode('artists');
  const { nav, playTracks } = useStore.getState();
  if (!artists.length) return <EmptyLibrary />;
  const items: Entity[] = artists.map((a) => ({
    key: a.name, round: true, track: a.tracks[0], title: a.name, subtitle: `${tr('nSongs', { n: a.tracks.length })} • ${tr('nAlbums', { n: a.albumCount })}`, meta: tr('nAlbums', { n: a.albumCount }),
    onOpen: () => nav({ name: 'artist', artist: a.name }), onPlay: () => playTracks(a.tracks.map((t) => t.id), 0),
  }));
  return (
    <div className="h-full flex flex-col">
      <PageHeader title={tr('navArtists')} subtitle={tr('nArtists', { n: artists.length })}><ViewToggle value={mode} onChange={setMode} /></PageHeader>
      <EntityBrowser className="flex-1" items={items} mode={mode} footer={<div className="h-4" />} />
    </div>
  );
}

export function ArtistView({ name }: { name: string }) {
  const { artists, albums } = useDerived();
  const a = artists.find((x) => x.name === name);
  const nav = useStore((s) => s.nav);
  const playTracks = useStore((s) => s.playTracks);
  if (!a) return <div className="p-8 text-on-surface-variant">{tr('artistNotFound')}</div>;
  const tracks = sortTracksNatural(a.tracks);
  const arts = albums.filter((al) => al.tracks.some((t) => t.artist === name));
  const extra = arts.length > 0 && (
    <section className="mb-4">
      <h2 className="text-title-lg px-8 mb-1">Album</h2>
      <div className="flex gap-2 overflow-x-auto px-6 pb-2">
        {arts.map((al) => <MediaCard key={al.key} track={al.tracks[0]} title={al.title} subtitle={albumSub(al)} onOpen={() => nav({ name: 'album', key: al.key })} onPlay={() => playTracks(al.tracks.map((t) => t.id), 0)} />)}
      </div>
      <h2 className="text-title-lg px-8 mt-4">{tr('songsTitle')}</h2>
    </section>
  );
  return <Collection title={a.name} kind={tr('kindArtist')} tracks={tracks} icon="person" extra={extra} />;
}

export function LikedView() {
  const liked = useStore((s) => s.liked);
  const byId = useStore((s) => s.byId);
  const tracks = useMemo(() => Object.entries(liked).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]).filter(Boolean), [liked, byId]);
  return <Collection viewKey="liked" title={tr('likedTitle')} kind={tr('kindList')} tracks={tracks} icon="favorite" emptyText={tr('likedEmpty')} />;
}

export function RecentView() {
  const history = useStore((s) => s.history);
  const byId = useStore((s) => s.byId);
  const tracks = useMemo(() => history.map((h) => byId[h.id]).filter(Boolean), [history, byId]);
  return <Collection viewKey="recent" title={tr('recentTitle')} kind={tr('kindList')} tracks={tracks} icon="history" emptyText={tr('recentEmpty')} />;
}

export function PlaylistsView() {
  const playlists = useStore((s) => s.playlists);
  const byId = useStore((s) => s.byId);
  const [mode, setMode] = useViewMode('playlists');
  const { nav, playTracks, createPlaylist, openDialog, importPlaylistFile, importFolder } = useStore.getState();
  const items: Entity[] = playlists.map((p) => ({
    key: p.id, track: byId[p.trackIds[0]], title: p.name, subtitle: `${tr('nSongs', { n: p.trackIds.length })}${p.folder ? ` • ${tr('folderTag')}` : ''}`,
    meta: p.folder ? tr('fromFolder') : tr('playlist'), icon: p.folder ? 'folder' : 'queue_music',
    onOpen: () => nav({ name: 'playlist', id: p.id }), onPlay: () => playTracks(p.trackIds, 0),
  }));
  return (
    <div className="h-full flex flex-col">
      <PageHeader title={tr('playlists')} subtitle={`${playlists.length} ${tr('playlists').toLowerCase()}`}>
        <Button variant="tonal" icon="upload_file" onClick={importPlaylistFile}>{tr('importM3U')}</Button>
        <Button variant="tonal" icon="create_new_folder" onClick={importFolder}>{tr('importFolder')}</Button>
        <Button icon="add" onClick={() => openDialog({ type: 'prompt', title: tr('newPlaylist'), label: tr('playlistName'), confirmLabel: tr('create'), onSubmit: (v) => nav({ name: 'playlist', id: createPlaylist(v) }) })}>{tr('createPlaylist')}</Button>
        <ViewToggle value={mode} onChange={setMode} />
      </PageHeader>
      <EntityBrowser
        className="flex-1" items={items} mode={mode}
        footer={!playlists.length ? <div className="text-center py-20 text-on-surface-variant">{tr('playlistsEmpty')}</div> : <div className="h-4" />}
      />
    </div>
  );
}

export function PlaylistView({ id }: { id: string }) {
  const pl = useStore((s) => s.playlists.find((p) => p.id === id));
  const tracks = useTrackList(pl?.trackIds ?? []);
  const { openDialog, renamePlaylist, deletePlaylist, exportPlaylist, rescanPlaylist, removeFromPlaylist, reorderPlaylist } = useStore.getState();
  if (!pl) return <div className="p-8 text-on-surface-variant">{tr('playlistNotFound')}</div>;
  const actions = (
    <>
      {pl.folder && <Button variant="text" icon="sync" onClick={() => rescanPlaylist(id)}>{tr('rescan')}</Button>}
      <Button variant="text" icon="edit" onClick={() => openDialog({ type: 'prompt', title: tr('renamePlaylist'), label: tr('playlistName'), initial: pl.name, confirmLabel: tr('save'), onSubmit: (v) => renamePlaylist(id, v) })}>{tr('rename')}</Button>
      <Button variant="text" icon="ios_share" onClick={() => exportPlaylist(id)}>{tr('exportM3U')}</Button>
      <Button variant="text" danger icon="delete" onClick={() => openDialog({ type: 'confirm', title: tr('deletePlaylistQ'), text: tr('deletePlaylistText2', { name: pl.name }), confirmLabel: tr('delete'), danger: true, onConfirm: () => deletePlaylist(id) })}>{tr('delete')}</Button>
    </>
  );
  return (
    <Collection
      title={pl.name} kind={pl.folder ? tr('playlistFromFolder') : tr('playlist')} subtitle={pl.folder} tracks={tracks} icon={pl.folder ? 'folder' : 'queue_music'}
      actions={actions} onRemove={(i) => removeFromPlaylist(id, i)} removeLabel={tr('removeFromPlaylist')} onReorder={(a, b) => reorderPlaylist(id, a, b)}
      emptyText={tr('playlistEmptyText')}
    />
  );
}

export function SearchView() {
  const q = useStore((s) => s.query);
  const byId = useStore((s) => s.byId);
  const { playTracks, nav } = useStore.getState();
  const res = useMemo(() => searchLibrary(byId, q), [byId, q]);
  const ids = res.tracks.map((t) => t.id);
  const empty = !res.tracks.length && !res.albums.length && !res.artists.length;
  return (
    <div className="h-full overflow-y-auto pb-6">
      <PageHeader title={tr('resultsFor', { q: q.trim() })} subtitle={empty ? undefined : tr('searchSummary', { songs: res.tracks.length, albums: res.albums.length, artists: res.artists.length })} />
      {empty && <div className="text-center py-20 text-on-surface-variant"><Icon name="search_off" size={48} /><div className="mt-2">{tr('noResults')}</div></div>}
      {res.artists.length > 0 && (
        <section className="mb-6"><h2 className="text-title-lg px-8 mb-2">{tr('navArtists')}</h2>
          <div className="flex gap-2 overflow-x-auto px-6">{res.artists.slice(0, 12).map((a) => <MediaCard key={a.name} round track={a.tracks[0]} title={a.name} subtitle={tr('nSongs', { n: a.tracks.length })} onOpen={() => nav({ name: 'artist', artist: a.name })} />)}</div>
        </section>
      )}
      {res.albums.length > 0 && (
        <section className="mb-6"><h2 className="text-title-lg px-8 mb-2">Album</h2>
          <div className="flex gap-2 overflow-x-auto px-6">{res.albums.slice(0, 12).map((a) => <MediaCard key={a.key} track={a.tracks[0]} title={a.title} subtitle={a.artist} onOpen={() => nav({ name: 'album', key: a.key })} />)}</div>
        </section>
      )}
      {res.tracks.length > 0 && (
        <section><h2 className="text-title-lg px-8 mb-2">{tr('songsTitle')}</h2>
          {res.tracks.slice(0, 100).map((t, i) => <div key={t.id} className="h-14"><TrackRow track={t} index={i} onPlay={() => playTracks(ids, i)} /></div>)}
          {res.tracks.length > 100 && <div className="px-8 py-3 text-body-md text-on-surface-variant">{tr('showingFirst', { n: res.tracks.length })}</div>}
        </section>
      )}
    </div>
  );
}

export { Cover };
