import { useEffect, useRef, useState } from 'react';
import { engine } from '../lib/engine';
import { assetUrl } from '../lib/tauri';
import { useCurrent, useStore } from '../lib/store';
import { fmtTime } from '../lib/utils';

/** Seek bar: buffered range, A-B markers, hover time + frame preview, drag to scrub */
export function SeekBar() {
  const cur = useCurrent();
  const duration = useStore((s) => s.duration);
  const loopA = useStore((s) => s.loopA);
  const loopB = useStore((s) => s.loopB);
  const bar = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const seekTimer = useRef<number>();

  // smooth progress from the video clock
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = engine.el;
      if (el) {
        setPos(el.currentTime);
        const b = el.buffered;
        setBuffered(b.length ? b.end(b.length - 1) : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // hidden second <video> used only to render hover previews
  useEffect(() => {
    const v = prev.current;
    if (!v || !cur) return;
    v.src = assetUrl(cur.path);
    v.load();
  }, [cur?.path]);

  const timeAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    return { x, t: (x / r.width) * duration };
  };

  const drawPreview = () => {
    const v = prev.current, c = canvas.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = 192;
    c.height = Math.round((192 * v.videoHeight) / v.videoWidth);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!duration) return;
    const h = timeAt(e.clientX);
    setHover(h);
    if (scrub !== null) setScrub(h.t);
    window.clearTimeout(seekTimer.current);
    seekTimer.current = window.setTimeout(() => {
      const v = prev.current;
      if (v && isFinite(h.t)) v.currentTime = h.t;
    }, 60);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!duration) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setScrub(timeAt(e.clientX).t);
  };
  const onUp = (e: React.PointerEvent) => {
    if (scrub === null) return;
    useStore.getState().seek(timeAt(e.clientX).t);
    setScrub(null);
  };

  const shown = scrub ?? pos;
  const pct = duration ? (shown / duration) * 100 : 0;
  const bpct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={bar} className="group relative h-6 flex items-center cursor-pointer touch-none"
      onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => scrub === null && setHover(null)}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <video ref={prev} muted preload="auto" crossOrigin="anonymous" className="hidden" onSeeked={drawPreview} onLoadedData={drawPreview} />
      <div className="relative w-full h-1 group-hover:h-1.5 rounded-full bg-white/25 transition-all">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${bpct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        {loopA !== null && duration > 0 && <div className="absolute -top-1 -bottom-1 w-0.5 bg-tertiary" style={{ left: `${(loopA / duration) * 100}%` }} />}
        {loopB !== null && duration > 0 && <div className="absolute -top-1 -bottom-1 w-0.5 bg-tertiary" style={{ left: `${(loopB / duration) * 100}%` }} />}
        {loopA !== null && loopB !== null && duration > 0 && (
          <div className="absolute inset-y-0 bg-tertiary/60" style={{ left: `${(loopA / duration) * 100}%`, width: `${((loopB - loopA) / duration) * 100}%` }} />
        )}
        <div className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow scale-0 group-hover:scale-100 transition-transform" style={{ left: `${pct}%` }} />
      </div>
      {hover && duration > 0 && (
        <div className="absolute bottom-7 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none animate-fade-in" style={{ left: Math.min(Math.max(hover.x, 100), (bar.current?.clientWidth ?? 0) - 100) }}>
          <canvas ref={canvas} className="rounded-lg shadow-lg border border-white/30 bg-black max-w-[192px]" />
          <div className="px-2 py-0.5 rounded-md bg-black/80 text-white text-label-md tabular-nums">{fmtTime(hover.t)}</div>
        </div>
      )}
    </div>
  );
}
