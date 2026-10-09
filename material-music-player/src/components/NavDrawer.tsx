import { Icon, IconButton, openMenuAt } from './ui';
import { tr } from '../lib/i18n';
import { useStore } from '../lib/store';
import type { View } from '../lib/types';

const getItems = (): { icon: string; label: string; view: View }[] => [
  { icon: 'home', label: tr('navHome'), view: { name: 'home' } },
  { icon: 'music_note', label: tr('navSongs'), view: { name: 'songs' } },
  { icon: 'album', label: tr('navAlbums'), view: { name: 'albums' } },
  { icon: 'person', label: tr('navArtists'), view: { name: 'artists' } },
  { icon: 'favorite', label: tr('navLiked'), view: { name: 'liked' } },
  { icon: 'history', label: tr('navRecent'), view: { name: 'recent' } },
];

const activeFor = (v: View, t: View) =>
  v.name === t.name ||
  (t.name === 'albums' && v.name === 'album') ||
  (t.name === 'artists' && v.name === 'artist');

export function NavDrawer() {
  const view = useStore((s) => s.view);
  const collapsed = useStore((s) => s.navCollapsed);
  const playlists = useStore((s) => s.playlists);
  const nav = useStore((s) => s.nav);
  const st = useStore.getState();

  const item = (icon: string, label: string, active: boolean, onClick: () => void, extra?: React.ReactNode, onContext?: (e: React.MouseEvent) => void) => (
    <button
      key={label + icon} onClick={onClick} onContextMenu={onContext} title={collapsed ? label : undefined}
      className={`h-12 rounded-full flex items-center gap-3 transition-colors ${collapsed ? 'w-14 justify-center mx-auto' : 'px-4 w-full'} ${active ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface-variant hover:bg-on-surface/[.08]'}`}
    >
      <Icon name={icon} fill={active} />
      {!collapsed && <span className="truncate text-label-lg flex-1 text-left">{label}</span>}
      {!collapsed && extra}
    </button>
  );

  return (
    <nav className={`${collapsed ? 'w-20' : 'w-64'} shrink-0 flex flex-col pl-3 pr-2 pb-2 transition-[width] duration-300 ease-emphasized`}>
      <div className="space-y-1">{getItems().map((i) => item(i.icon, i.label, activeFor(view, i.view), () => nav(i.view)))}</div>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between pl-4 pr-1'} mt-4 mb-1`}>
        {!collapsed && <button className="text-title-sm text-on-surface-variant hover:text-on-surface" onClick={() => nav({ name: 'playlists' })}>{tr('playlists')}</button>}
        <IconButton icon="add" size="sm" title={tr('createPlaylist')} onClick={() => st.openDialog({ type: 'prompt', title: tr('newPlaylist'), label: tr('playlistName'), confirmLabel: tr('create'), onSubmit: (v) => nav({ name: 'playlist', id: st.createPlaylist(v) }) })} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {playlists.map((p) =>
          item(p.folder ? 'folder' : 'queue_music', p.name, view.name === 'playlist' && view.id === p.id, () => nav({ name: 'playlist', id: p.id }),
            <span className="text-body-sm opacity-70">{p.trackIds.length}</span>,
            (e) => openMenuAt(e, [
              { label: tr('play'), icon: 'play_arrow', onClick: () => st.playTracks(p.trackIds, 0) },
              { label: tr('rename'), icon: 'edit', onClick: () => st.openDialog({ type: 'prompt', title: tr('renamePlaylist'), label: tr('playlistName'), initial: p.name, confirmLabel: tr('save'), onSubmit: (v) => st.renamePlaylist(p.id, v) }) },
              { label: tr('deletePlaylist'), icon: 'delete', danger: true, onClick: () => st.openDialog({ type: 'confirm', title: tr('deletePlaylistQ'), text: tr('deletePlaylistText', { name: p.name }), confirmLabel: tr('delete'), danger: true, onConfirm: () => st.deletePlaylist(p.id) }) },
            ])),
        )}
      </div>
      <div className="pt-2">{item('settings', tr('navSettings'), view.name === 'settings', () => nav({ name: 'settings' }))}</div>
    </nav>
  );
}
