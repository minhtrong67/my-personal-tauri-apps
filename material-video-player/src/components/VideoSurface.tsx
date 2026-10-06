import { useEffect, useRef, useState } from 'react';
import { engine } from '../lib/engine';
import { assetUrl, openWithDefault, reveal } from '../lib/tauri';
import { setWindowTitle, useCurrent, useStore } from '../lib/store';
import { tr } from '../lib/i18n';
import { fmtTime, pathKey } from '../lib/utils';
import { Button, Icon } from './ui';
import { useT } from '../lib/useT';
import { SubtitleOverlay } from './Subtitles';

/** The <video> element, its events, gestures (click / double-click / wheel / pan) and on-screen indicators */
export function VideoSurface({ onActivity }: { onActivity: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const cur = useCurrent();
  const t = useT();
  const adjust = useStore((s) => s.adjust);
  const error = useStore((s) => s.error);
  const loading = useStore((s) => s.loading);
  const buffering = useStore((s) => s.buffering);
  const mini = useStore((s) => s.mini);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState<{ icon: string; key: number } | null>(null);
  const [skip, setSkip] = useState<{ text: string; side: 'l' | 'r'; key: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const clickTimer = useRef<number>();

  // attach the element to the engine
  useEffect(() => {
    engine.attach(ref.current);
    const s = useStore.getState().settings;
    engine.setVolume(s.volume, s.muted);
    return () => engine.attach(null);
  }, []);

  // load the source when the current file changes
  useEffect(() => {
    const el = ref.current;
    if (!el || !cur) return;
    engine.loadedPath = null;
    setReady(false);
    el.src = assetUrl(cur.path);
    el.load();
    engine.setRate(useStore.getState().rate);
    void setWindowTitle(cur.name);
  }, [cur?.path]);

  // loop A-B + sleep-at-end + watched progress, per animation frame while playing
  useEffect(() => {
    let raf = 0;
    let lastSave = 0;
    const tick = (now: number) => {
      const el = ref.current;
      const s = useStore.getState();
      if (el && !el.paused) {
        if (s.loopA !== null && s.loopB !== null && el.currentTime >= s.loopB) el.currentTime = s.loopA;
        if (now - lastSave > 5000) { lastSave = now; s.saveProgress(); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const flashIcon = (icon: string) => setFlash({ icon, key: Date.now() });
  const doSkip = (d: number) => {
    useStore.getState().seekBy(d);
    setSkip({ text: `${d > 0 ? '+' : ''}${d}s`, side: d > 0 ? 'r' : 'l', key: Date.now() });
  };

  const onLoadedMetadata = () => {
    const el = ref.current!;
    const s = useStore.getState();
    const f = s.queue[s.index];
    engine.loadedPath = f?.path ?? null;
    setReady(true);
    useStore.setState({ duration: el.duration, videoSize: { w: el.videoWidth, h: el.videoHeight }, loading: false });
    el.playbackRate = s.rate;
    const prog = f ? s.progress[pathKey(f.path)] : undefined;
    if (s.settings.resume && prog && prog.pos > 5 && prog.pos < el.duration - 10) {
      el.currentTime = prog.pos;
      s.showToast(tr('resumedAt', { time: fmtTime(prog.pos) }), tr('startOver'), () => s.seek(0));
    }
    void engine.play();
  };

  const onError = () => {
    const el = ref.current;
    if (!el || !el.getAttribute('src')) return;
    const code = el.error?.code;
    const msg = code === 3 ? tr('errDecode') : code === 4 ? tr('errFormat') : code === 2 ? tr('errNetwork') : tr('errUnknown');
    useStore.setState({ error: msg, loading: false, playing: false });
  };

  const onEnded = () => {
    const s = useStore.getState();
    s.saveProgress();
    if (s.sleepEndOfVideo) { useStore.setState({ sleepEndOfVideo: false, playing: false }); return; }
    if (s.repeat === 'one') { engine.seek(0); void engine.play(); return; }
    s.next(true);
  };

  // gestures
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const a = useStore.getState().adjust;
    drag.current = { x: e.clientX, y: e.clientY, px: a.panX, py: a.panY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    onActivity();
    const d = drag.current;
    if (!d) return;
    const a = useStore.getState().adjust;
    if (a.zoom > 1 && (e.buttons & 1)) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) useStore.getState().setAdjust({ panX: d.px + dx, panY: d.py + dy });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) return;
    window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => { engine.toggle(); flashIcon(engine.el?.paused ? 'pause' : 'play_arrow'); }, 220);
  };
  const onDouble = (e: React.MouseEvent) => {
    window.clearTimeout(clickTimer.current);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const step = useStore.getState().settings.seekStep * 2;
    if (x < 0.3) doSkip(-step);
    else if (x > 0.7) doSkip(step);
    else void useStore.getState().toggleFullscreen();
  };
  const onWheel = (e: React.WheelEvent) => {
    const s = useStore.getState();
    const v = Math.min(1, Math.max(0, s.settings.volume + (e.deltaY < 0 ? 0.05 : -0.05)));
    s.setVolume(v);
    setFlash({ icon: v === 0 ? 'volume_off' : v < 0.5 ? 'volume_down' : 'volume_up', key: Date.now() });
  };

  const transform = `translate(${adjust.panX}px, ${adjust.panY}px) rotate(${adjust.rotate}deg) scale(${adjust.zoom * (adjust.flipH ? -1 : 1)}, ${adjust.zoom * (adjust.flipV ? -1 : 1)})`;
  const filter = `brightness(${adjust.brightness}) contrast(${adjust.contrast}) saturate(${adjust.saturation}) hue-rotate(${adjust.hue}deg)`;

  return (
    <div
      className="absolute inset-0 bg-black overflow-hidden select-none"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDouble} onWheel={onWheel}
    >
      <video
        ref={ref} crossOrigin="anonymous" playsInline preload="auto" draggable={false}
        className={`w-full h-full transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectFit: adjust.fit, transform, filter, cursor: adjust.zoom > 1 ? 'grab' : undefined }}
        onLoadedMetadata={onLoadedMetadata} onError={onError} onEnded={onEnded}
        onPlay={() => { useStore.setState({ playing: true }); engine.probeFps(); }}
        onPause={() => { useStore.setState({ playing: false }); useStore.getState().saveProgress(); }}
        onTimeUpdate={(e) => useStore.setState({ position: (e.target as HTMLVideoElement).currentTime })}
        onDurationChange={(e) => isFinite((e.target as HTMLVideoElement).duration) && useStore.setState({ duration: (e.target as HTMLVideoElement).duration })}
        onWaiting={() => useStore.setState({ buffering: true })}
        onPlaying={() => useStore.setState({ buffering: false, loading: false })}
        onCanPlay={() => useStore.setState({ buffering: false })}
      />
      <SubtitleOverlay compact={mini} />

      {(loading || buffering) && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-4 border-white/25 border-t-white animate-spin animate-fade-in" />
        </div>
      )}
      {flash && (
        <div key={flash.key} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center animate-[ping-out_.6s_ease-out_forwards]">
            <Icon name={flash.icon} fill size={44} />
          </div>
        </div>
      )}
      {skip && (
        <div key={skip.key} className={`absolute top-0 bottom-0 w-1/4 flex items-center justify-center pointer-events-none animate-[ping-out_.7s_ease-out_forwards] ${skip.side === 'l' ? 'left-[8%]' : 'right-[8%]'}`}>
          <div className="px-5 py-3 rounded-full bg-black/55 text-white text-title-lg flex items-center gap-1">
            <Icon name={skip.side === 'l' ? 'fast_rewind' : 'fast_forward'} fill /> {skip.text}
          </div>
        </div>
      )}

      {error && cur && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/70" onPointerUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="max-w-md w-full rounded-m3-xl bg-surface-container-high text-on-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2 text-error"><Icon name="error" fill /><div className="text-title-lg text-on-surface">{t('cannotPlay')}</div></div>
            <p className="text-body-md text-on-surface-variant mb-1 break-all">{cur.name}</p>
            <p className="text-body-md mb-4">{error}</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="text" onClick={() => void reveal(cur.path)}>{t('showInFolder')}</Button>
              <Button variant="tonal" icon="open_in_new" onClick={() => void openWithDefault(cur.path)}>{t('openDefaultApp')}</Button>
              <Button onClick={() => useStore.getState().next(false)}>{t('skipNext')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
