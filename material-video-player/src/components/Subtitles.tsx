import { useEffect, useRef, useState } from 'react';
import { engine } from '../lib/engine';
import { useStore } from '../lib/store';
import { activeCues, toRich, type RichSeg } from '../lib/subtitles';
import type { Cue } from '../lib/types';

function renderSegs(lines: RichSeg[][]) {
  return lines.map((segs, li) => (
    <div key={li}>
      {segs.map((s, i) => (
        <span key={i} style={{ fontStyle: s.i ? 'italic' : undefined, fontWeight: s.b ? 700 : undefined, textDecoration: s.u ? 'underline' : undefined }}>{s.text}</span>
      ))}
    </div>
  ));
}

/** Subtitle overlay: synced to the video with its own animation-frame loop (smooth even at 4Hz timeupdate) */
export function SubtitleOverlay({ compact }: { compact?: boolean }) {
  const cues = useStore((s) => s.subCues);
  const delay = useStore((s) => s.subDelay);
  const style = useStore((s) => s.settings.sub);
  const [active, setActive] = useState<Cue[]>([]);
  const lastKey = useRef('');

  useEffect(() => {
    lastKey.current = '';
    if (!cues.length) { setActive([]); return; }
    let raf = 0;
    const tick = () => {
      const t = (engine.el?.currentTime ?? 0) - delay / 1000;
      const list = activeCues(cues, t);
      const key = list.map((c) => c.start).join(',');
      if (key !== lastKey.current) {
        lastKey.current = key;
        setActive(list);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cues, delay]);

  if (!active.length) return null;
  const size = (compact ? 1.1 : 2.1) * (style.size / 100);
  const bg = style.bg === 'box' ? `rgba(0,0,0,${style.opacity})` : 'transparent';
  const shadow = style.bg === 'none' ? 'none' : '0 0 4px #000, 0 0 8px #000, 1px 1px 2px #000, -1px -1px 2px #000';
  return (
    <div className="absolute inset-x-0 flex justify-center pointer-events-none px-[8%]" style={{ bottom: `${style.bottom}%` }}>
      <div className="text-center leading-snug rounded-lg" style={{ fontSize: `${size}vw`, color: style.color, background: bg, textShadow: shadow, padding: style.bg === 'box' ? '0.15em 0.5em' : 0 }}>
        {active.map((c, i) => <div key={i}>{renderSegs(toRich(c.text))}</div>)}
      </div>
    </div>
  );
}
