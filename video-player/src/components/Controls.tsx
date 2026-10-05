import { engine } from '../lib/engine';
import { useStore } from '../lib/store';
import { useT } from '../lib/useT';
import { fmtTime } from '../lib/utils';
import { IconButton, Slider, openMenuBelow } from './ui';
import { SeekBar } from './SeekBar';
import { useEffect, useState } from 'react';

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

function TimeLabel() {
  const duration = useStore((s) => s.duration);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => { setPos(engine.el?.currentTime ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span className="text-label-lg tabular-nums text-white/90 whitespace-nowrap">{fmtTime(pos)} / {fmtTime(duration)}</span>;
}

export function Controls({ compact }: { compact?: boolean }) {
  const t = useT();
  const st = useStore.getState();
  const playing = useStore((s) => s.playing);
  const settings = useStore((s) => s.settings);
  const rate = useStore((s) => s.rate);
  const fullscreen = useStore((s) => s.fullscreen);
  const showQueue = useStore((s) => s.showQueue);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const subIndex = useStore((s) => s.subIndex);
  const subTracks = useStore((s) => s.subTracks);
  const queueLen = useStore((s) => s.queue.length);
  const loopA = useStore((s) => s.loopA);
  const loopB = useStore((s) => s.loopB);
  const sleeping = useStore((s) => s.sleepAt !== null || s.sleepEndOfVideo);
  const volIcon = settings.muted || settings.volume === 0 ? 'volume_off' : settings.volume < 0.4 ? 'volume_down' : 'volume_up';
  const btn = 'text-white hover:bg-white/15';

  const rateMenu = (e: React.MouseEvent<HTMLElement>) =>
    openMenuBelow(e, RATES.map((r) => ({ label: `${r}×`, checked: r === rate, onClick: () => st.setRate(r) })), false, true);

  const moreMenu = (e: React.MouseEvent<HTMLElement>) =>
    openMenuBelow(e, [
      { label: t('screenshot'), icon: 'photo_camera', onClick: () => void st.screenshot() },
      { label: t('videoAdjust'), icon: 'tune', onClick: () => st.openDialog({ type: 'adjust' }) },
      { label: t('audioFx'), icon: 'graphic_eq', onClick: () => st.openDialog({ type: 'audio' }) },
      { label: loopA === null ? t('loopSetA') : loopB === null ? t('loopSetB') : t('loopClear'), icon: 'repeat_on', onClick: () => st.cycleLoop() },
      { label: t('sleepTimer'), icon: 'bedtime', checked: sleeping, onClick: () => st.openDialog({ type: 'sleep' }) },
      { label: t('alwaysOnTop'), icon: 'push_pin', checked: settings.alwaysOnTop, onClick: () => st.updateSettings({ alwaysOnTop: !settings.alwaysOnTop }) },
      { divider: true },
      { label: t('fileInfo'), icon: 'info', onClick: () => st.openDialog({ type: 'info' }) },
      { label: t('shortcuts'), icon: 'keyboard', onClick: () => st.openDialog({ type: 'shortcuts' }) },
    ], true, true);

  if (compact) {
    return (
      <div className="px-3 pb-2">
        <SeekBar />
        <div className="flex items-center gap-1 -mt-1">
          <IconButton icon="skip_previous" fill size="sm" className={btn} onClick={st.prev} title={t('previous')} />
          <IconButton icon={playing ? 'pause' : 'play_arrow'} fill size="sm" className={btn} onClick={st.togglePlay} title={t('playPause')} />
          <IconButton icon="skip_next" fill size="sm" className={btn} onClick={() => st.next(false)} title={t('next')} />
          <div className="flex-1" />
          <TimeLabel />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4">
      <SeekBar />
      <div className="flex items-center gap-1 mt-0.5">
        <IconButton icon={playing ? 'pause' : 'play_arrow'} fill variant="filled" size="md" onClick={st.togglePlay} title={`${t('playPause')} (Space)`} />
        <IconButton icon="skip_previous" fill className={btn} onClick={st.prev} title={`${t('previous')} (Shift+P)`} disabled={queueLen < 1} />
        <IconButton icon="skip_next" fill className={btn} onClick={() => st.next(false)} title={`${t('next')} (Shift+N)`} disabled={queueLen < 2} />
        <div className="flex items-center group/vol ml-1">
          <IconButton icon={volIcon} className={btn} onClick={st.toggleMute} title={`${t('mute')} (M)`} />
          <div className="w-0 group-hover/vol:w-24 focus-within:w-24 overflow-hidden transition-all duration-200">
            <div className="w-24 pr-2"><Slider min={0} max={1} step={0.01} value={settings.muted ? 0 : settings.volume} onChange={st.setVolume} label={t('volume')} /></div>
          </div>
        </div>
        <div className="ml-2"><TimeLabel /></div>
        <div className="flex-1" />
        <IconButton icon="shuffle" className={btn} active={shuffle} onClick={st.toggleShuffle} title={t('shuffle')} />
        <IconButton icon={repeat === 'one' ? 'repeat_one' : 'repeat'} className={btn} active={repeat !== 'off'} onClick={st.cycleRepeat} title={t('repeat')} />
        <button onClick={rateMenu} title={t('speed')} className="h-9 px-3 rounded-full text-label-lg text-white hover:bg-white/15 tabular-nums">{rate}×</button>
        <IconButton icon={subIndex >= 0 ? 'closed_caption' : 'closed_caption_disabled'} fill={subIndex >= 0} className={btn} onClick={() => st.openDialog({ type: 'subs' })} title={`${t('subtitles')} (C)${subTracks.length ? ` · ${subTracks.length}` : ''}`} />
        <IconButton icon="queue_music" className={btn} active={showQueue} onClick={() => st.set({ showQueue: !showQueue })} title={`${t('queue')} (Q)`} />
        <IconButton icon="more_vert" className={btn} onClick={moreMenu} title={t('more')} />
        <IconButton icon="picture_in_picture_alt" className={btn} onClick={() => void st.toggleMini()} title={t('miniPlayer')} />
        <IconButton icon={fullscreen ? 'fullscreen_exit' : 'fullscreen'} className={btn} onClick={() => void st.toggleFullscreen()} title={`${t('fullscreen')} (F)`} />
      </div>
    </div>
  );
}
