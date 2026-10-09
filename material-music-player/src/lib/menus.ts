import { useStore } from './store';
import { reveal } from './tauri';
import { tr } from './i18n';
import type { MenuItem, Track } from './types';

export function trackMenu(t: Track, opts: { onPlay?: () => void; onRemoveFromList?: () => void; removeLabel?: string } = {}): MenuItem[] {
  const s = useStore.getState();
  const liked = !!s.liked[t.id];
  const items: MenuItem[] = [
    { label: tr('play'), icon: 'play_arrow', onClick: opts.onPlay ?? (() => s.playTracks([t.id], 0)) },
    { label: tr('playNext'), icon: 'playlist_play', onClick: () => s.playNext([t.id]) },
    { label: tr('addToQueue'), icon: 'queue_music', onClick: () => s.addToQueue([t.id]) },
    { label: tr('addToPlaylistE'), icon: 'playlist_add', onClick: () => s.openDialog({ type: 'addToPlaylist', ids: [t.id] }) },
    { label: liked ? tr('unfavorite') : tr('favorite'), icon: liked ? 'heart_minus' : 'favorite', onClick: () => s.toggleLike(t.id) },
    { divider: true },
    { label: tr('showInFolder'), icon: 'folder_open', onClick: () => reveal(t.path).catch(() => s.showToast(tr('openFolderFail'))) },
    { label: tr('songInfo'), icon: 'info', onClick: () => s.openDialog({ type: 'info', id: t.id }) },
  ];
  if (opts.onRemoveFromList) items.push({ label: opts.removeLabel ?? tr('removeFromList'), icon: 'remove', onClick: opts.onRemoveFromList });
  items.push({ divider: true });
  items.push({
    label: tr('removeFromLibrary'), icon: 'delete', danger: true,
    onClick: () => s.openDialog({ type: 'confirm', title: tr('removeFromLibraryQ'), text: tr('removeFromLibraryText', { title: t.title, app: 'Material Music Player' }), confirmLabel: tr('delete'), danger: true, onConfirm: () => s.removeTracks([t.id]) }),
  });
  return items;
}
