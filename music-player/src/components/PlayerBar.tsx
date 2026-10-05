import { Cover } from './Cover';
import { IconButton, Slider } from './ui';
import { SeekBar, TransportControls } from './PlayerControls';
import { useCurrent, useStore } from '../lib/store';

export function PlayerBar() {
  const t = useCurrent();
  const volume = useStore((s) => s.settings.volume);
  const muted = useStore((s) => s.settings.muted);
  const liked = useStore((s) => (t ? !!s.liked[t.id] : false));
  const showQueue = useStore((s) => s.showQueue);
  const sleeping = useStore((s) => s.sleepAt !== null || s.sleepEndOfTrack);
  const st = useStore.getState();
  const volIcon = muted || volume === 0 ? 'volume_off' : volume < 0.4 ? 'volume_down' : 'volume_up';

  return (
    <div className="h-[88px] shrink-0 mx-3 mb-3 rounded-3xl bg-surface-container flex items-center px-4 gap-4">
      <div className="w-[28%] min-w-0 flex items-center gap-3">
        <button className="shrink-0 group relative" onClick={() => t && st.set({ showNowPlaying: true })} aria-label="Mở màn hình đang phát" disabled={!t}>
          <Cover track={t} eager className="w-16 h-16 rounded-2xl" iconSize={28} />
        </button>
        <div className="min-w-0">
          <div className="truncate text-title-sm text-on-surface">{t?.title ?? 'Chưa phát bài nào'}</div>
          <div className="truncate text-body-sm text-on-surface-variant">{t ? `${t.artist} • ${t.album}` : 'Chọn một bài hát để bắt đầu'}</div>
        </div>
        {t && <IconButton icon="favorite" title="Yêu thích (L)" active={liked} fill={liked} onClick={() => st.toggleLike(t.id)} />}
      </div>

      <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
        <TransportControls />
        <SeekBar className="max-w-2xl -mt-1" />
      </div>

      <div className="w-[28%] flex items-center justify-end gap-1">
        <IconButton icon="bedtime" title="Hẹn giờ tắt" active={sleeping} onClick={() => st.openDialog({ type: 'sleep' })} />
        <IconButton icon="tune" title="Âm thanh & Equalizer" onClick={() => st.openDialog({ type: 'audio' })} />
        <IconButton icon="queue_music" title="Hàng chờ (Q)" active={showQueue} onClick={() => st.set({ showQueue: !showQueue })} />
        <IconButton icon={volIcon} title="Tắt / bật tiếng (M)" onClick={st.toggleMute} />
        <div className="w-24"><Slider min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={st.setVolume} label="Âm lượng" /></div>
        <IconButton icon="open_in_full" title="Màn hình đang phát (N)" disabled={!t} onClick={() => st.set({ showNowPlaying: true })} />
      </div>
    </div>
  );
}
