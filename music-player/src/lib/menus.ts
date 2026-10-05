import { useStore } from './store';
import { reveal } from './tauri';
import type { MenuItem, Track } from './types';

export function trackMenu(t: Track, opts: { onPlay?: () => void; onRemoveFromList?: () => void; removeLabel?: string } = {}): MenuItem[] {
  const s = useStore.getState();
  const liked = !!s.liked[t.id];
  const items: MenuItem[] = [
    { label: 'Phát', icon: 'play_arrow', onClick: opts.onPlay ?? (() => s.playTracks([t.id], 0)) },
    { label: 'Phát tiếp theo', icon: 'playlist_play', onClick: () => s.playNext([t.id]) },
    { label: 'Thêm vào hàng chờ', icon: 'queue_music', onClick: () => s.addToQueue([t.id]) },
    { label: 'Thêm vào playlist…', icon: 'playlist_add', onClick: () => s.openDialog({ type: 'addToPlaylist', ids: [t.id] }) },
    { label: liked ? 'Bỏ yêu thích' : 'Yêu thích', icon: liked ? 'heart_minus' : 'favorite', onClick: () => s.toggleLike(t.id) },
    { divider: true },
    { label: 'Hiện trong thư mục', icon: 'folder_open', onClick: () => reveal(t.path).catch(() => s.showToast('Không mở được thư mục')) },
    { label: 'Thông tin bài hát', icon: 'info', onClick: () => s.openDialog({ type: 'info', id: t.id }) },
  ];
  if (opts.onRemoveFromList) items.push({ label: opts.removeLabel ?? 'Xóa khỏi danh sách', icon: 'remove', onClick: opts.onRemoveFromList });
  items.push({ divider: true });
  items.push({
    label: 'Xóa khỏi thư viện', icon: 'delete', danger: true,
    onClick: () => s.openDialog({ type: 'confirm', title: 'Xóa khỏi thư viện?', text: `“${t.title}” sẽ bị xóa khỏi thư viện Melodia. Tệp nhạc trên máy không bị xóa.`, confirmLabel: 'Xóa', danger: true, onConfirm: () => s.removeTracks([t.id]) }),
  });
  return items;
}
