import { useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '../lib/i18n';
import { Cover } from './Cover';
import { Icon, IconButton, Segmented } from './ui';
import { SeekBar, TransportControls } from './PlayerControls';
import { QueuePanel } from './QueuePanel';
import { WindowControls } from './TitleBar';
import { useCurrent, useStore } from '../lib/store';
import { useCover } from '../lib/cover';
import { engine } from '../lib/audio';
import { readLyrics } from '../lib/tauri';
import { activeLine, parseLyrics, type Lyrics } from '../lib/lrc';

export function Visualizer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    let phase = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--md-primary').trim().split(' ').join(',');
      const n = 48;
      const gap = 6;
      const bw = (w - gap * (n - 1)) / n;
      const spec = engine.getSpectrum();
      phase += 0.06;
      const playing = !engine.audio.paused;
      for (let i = 0; i < n; i++) {
        let v: number;
        if (spec) v = spec[Math.min(spec.length - 1, Math.floor(Math.pow(i / n, 1.4) * spec.length * 0.85))] / 255;
        else v = playing ? 0.25 + 0.2 * Math.sin(phase + i * 0.5) + 0.15 * Math.sin(phase * 1.7 + i * 0.2) : 0.04;
        const bh = Math.max(6, v * h);
        ctx.fillStyle = `rgba(${rgb}, ${0.35 + v * 0.65})`;
        ctx.beginPath();
        ctx.roundRect(i * (bw + gap), h - bh, bw, bh, Math.min(bw / 2, 6));
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

function LyricsPane() {
  const t = useCurrent();
  const position = useStore((s) => s.position);
  const seek = useStore((s) => s.seek);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!t) return;
    let alive = true;
    setLoading(true);
    setLyrics(null);
    readLyrics(t.path)
      .then((raw) => alive && setLyrics(raw ? parseLyrics(raw) : null))
      .catch(() => alive && setLyrics(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [t?.id]);

  const active = useMemo(() => (lyrics?.synced ? activeLine(lyrics.lines, position) : -1), [lyrics, position]);
  useEffect(() => {
    if (active >= 0) refs.current[active]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active]);

  if (loading) return <div className="h-full flex items-center justify-center text-on-surface-variant">{tr('lyricsLoading')}</div>;
  if (!lyrics || !lyrics.lines.length)
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant gap-2 px-10">
        <Icon name="lyrics" size={48} />
        <div className="text-title-md text-on-surface">{tr('noLyrics')}</div>
        <div className="text-body-md">{tr('noLyricsHelp')}</div>
      </div>
    );
  return (
    <div className="h-full overflow-y-auto px-6 py-[30vh] text-center">
      {lyrics.lines.map((l, i) => (
        <div
          key={i} ref={(el) => (refs.current[i] = el)}
          onClick={() => lyrics.synced && seek(l.time)}
          className={`py-2 transition-all duration-300 ${lyrics.synced ? 'cursor-pointer' : ''} ${i === active ? 'text-headline-sm text-primary font-medium' : lyrics.synced ? 'text-title-lg text-on-surface-variant/70 hover:text-on-surface' : 'text-body-lg text-on-surface'}`}
        >
          {l.text || '♪'}
        </div>
      ))}
    </div>
  );
}

export function NowPlaying() {
  const t = useCurrent();
  const cover = useCover(t);
  const liked = useStore((s) => (t ? !!s.liked[t.id] : false));
  const [tab, setTab] = useState<'lyrics' | 'viz' | 'queue'>('lyrics');
  const st = useStore.getState();
  if (!t) return null;
  return (
    <div className="fixed inset-0 z-40 bg-surface animate-slide-up overflow-hidden flex flex-col">
      {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-125 pointer-events-none" />}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-container/30 to-surface/80 pointer-events-none" />
      <div data-tauri-drag-region className="relative h-14 shrink-0 flex items-center justify-between px-3">
        <IconButton icon="expand_more" title={`${tr('collapse')} (Esc)`} onClick={() => st.set({ showNowPlaying: false })} />
        <div className="text-title-sm text-on-surface-variant pointer-events-none">{tr('nowPlaying')}</div>
        <WindowControls />
      </div>
      <div className="relative flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(340px,5fr)_6fr] gap-8 px-10 pb-8">
        <div className="flex flex-col items-center justify-center min-h-0 gap-5">
          <Cover track={t} eager className="w-[min(46vh,100%)] aspect-square max-w-[440px] rounded-[40px] shadow-2xl" iconSize={96} />
          <div className="w-full max-w-[440px]">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-headline-sm">{t.title}</div>
                <div className="truncate text-body-lg text-on-surface-variant">{t.artist} • {t.album}</div>
              </div>
              <IconButton icon="favorite" active={liked} fill={liked} title={`${tr('favorite')} (L)`} onClick={() => st.toggleLike(t.id)} />
            </div>
            <SeekBar className="mt-2" />
            <div className="flex justify-center mt-2"><TransportControls size="lg" /></div>
          </div>
        </div>
        <div className="min-h-0 flex flex-col rounded-[32px] bg-surface-container/70 backdrop-blur overflow-hidden">
          <div className="p-4 flex justify-center shrink-0">
            <Segmented value={tab} onChange={setTab} options={[{ value: 'lyrics', label: tr('tabLyrics'), icon: 'lyrics' }, { value: 'viz', label: tr('tabEffects'), icon: 'equalizer' }, { value: 'queue', label: tr('tabQueue'), icon: 'queue_music' }]} />
          </div>
          <div className="flex-1 min-h-0">
            {tab === 'lyrics' && <LyricsPane />}
            {tab === 'viz' && <div className="h-full p-10 flex items-end"><div className="w-full h-[70%]"><Visualizer /></div></div>}
            {tab === 'queue' && <QueuePanel embedded />}
          </div>
        </div>
      </div>
    </div>
  );
}
