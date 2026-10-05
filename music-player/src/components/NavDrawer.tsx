import { Icon, IconButton, openMenuAt } from './ui';
import { useStore } from '../lib/store';
import type { View } from '../lib/types';

const ITEMS: { icon: string; label: string; view: View }[] = [
  { icon: 'home', label: 'Trang chủ', view: { name: 'home' } },
  { icon: 'music_note', label: 'Bài hát', view: { name: 'songs' } },
  { icon: 'album', label: 'Album', view: { name: 'albums' } },
  { icon: 'person', label: 'Nghệ sĩ', view: { name: 'artists' } },
  { icon: 'favorite', label: 'Yêu thích', view: { name: 'liked' } },
  { icon: 'history', label: 'Gần đây', view: { name: 'recent' } },
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
      <div className="space-y-1">{ITEMS.map((i) => item(i.icon, i.label, activeFor(view, i.view), () => nav(i.view)))}</div>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between pl-4 pr-1'} mt-4 mb-1`}>
        {!collapsed && <button className="text-title-sm text-on-surface-variant hover:text-on-surface" onClick={() => nav({ name: 'playlists' })}>Playlist</button>}
        <IconButton icon="add" size="sm" title="Tạo playlist" onClick={() => st.openDialog({ type: 'prompt', title: 'Playlist mới', label: 'Tên playlist', confirmLabel: 'Tạo', onSubmit: (v) => nav({ name: 'playlist', id: st.createPlaylist(v) }) })} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {playlists.map((p) =>
          item(p.folder ? 'folder' : 'queue_music', p.name, view.name === 'playlist' && view.id === p.id, () => nav({ name: 'playlist', id: p.id }),
            <span className="text-body-sm opacity-70">{p.trackIds.length}</span>,
            (e) => openMenuAt(e, [
              { label: 'Phát', icon: 'play_arrow', onClick: () => st.playTracks(p.trackIds, 0) },
              { label: 'Đổi tên', icon: 'edit', onClick: () => st.openDialog({ type: 'prompt', title: 'Đổi tên playlist', label: 'Tên playlist', initial: p.name, confirmLabel: 'Lưu', onSubmit: (v) => st.renamePlaylist(p.id, v) }) },
              { label: 'Xóa playlist', icon: 'delete', danger: true, onClick: () => st.openDialog({ type: 'confirm', title: 'Xóa playlist?', text: `Playlist “${p.name}” sẽ bị xóa.`, confirmLabel: 'Xóa', danger: true, onConfirm: () => st.deletePlaylist(p.id) }) },
            ])),
        )}
      </div>
      <div className="pt-2">{item('settings', 'Cài đặt', view.name === 'settings', () => nav({ name: 'settings' }))}</div>
    </nav>
  );
}
