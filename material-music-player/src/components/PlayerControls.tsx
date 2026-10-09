import { useState } from 'react';
import { tr } from '../lib/i18n';
import { IconButton, Slider } from './ui';
import { useStore } from '../lib/store';
import { fmtTime } from '../lib/utils';

export function SeekBar({ className = '' }: { className?: string }) {
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration);
  const seek = useStore((s) => s.seek);
  const [scrub, setScrub] = useState<number | null>(null);
  const val = scrub ?? position;
  return (
    <div className={`flex items-center gap-3 w-full ${className}`}>
      <span className="w-10 text-right text-body-sm text-on-surface-variant tabular-nums">{fmtTime(val)}</span>
      <Slider min={0} max={Math.max(duration, 1)} step={0.1} value={Math.min(val, duration || 1)} label="Thanh tua" onChange={setScrub} onCommit={(v) => { seek(v); setScrub(null); }} />
      <span className="w-10 text-body-sm text-on-surface-variant tabular-nums">{fmtTime(duration)}</span>
    </div>
  );
}

export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isPlaying = useStore((s) => s.isPlaying);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const st = useStore.getState();
  return (
    <div className="flex items-center gap-1">
      <IconButton icon="shuffle" title={`${tr('shuffle')} (S)`} active={shuffle} onClick={st.toggleShuffle} />
      <IconButton icon="skip_previous" title={`${tr('previous')} (Ctrl+←)`} fill size={size === 'lg' ? 'lg' : 'md'} onClick={st.prev} />
      <IconButton icon={isPlaying ? 'pause' : 'play_arrow'} title={`${isPlaying ? tr('pause') : tr('play')} (Space)`} variant="filled" fill size="lg" className={size === 'lg' ? '!w-16 !h-16 !rounded-[22px]' : '!rounded-2xl'} onClick={st.togglePlay} />
      <IconButton icon="skip_next" title={`${tr('next')} (Ctrl+→)`} fill size={size === 'lg' ? 'lg' : 'md'} onClick={() => st.next(false)} />
      <IconButton icon={repeat === 'one' ? 'repeat_one' : 'repeat'} title={`${tr('repeat')} (R)`} active={repeat !== 'off'} onClick={st.cycleRepeat} />
    </div>
  );
}
