import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { assetUrl } from '../lib/tauri';
import { thumbSig } from '../lib/thumbs';
import { fmtTime, pathKey } from '../lib/utils';
import { Icon } from './ui';

/** 16:9 thumbnail, generated lazily when it scrolls into view. Shimmer while loading, fade-in when ready. */
export function Poster({
  path, size, fallbackDur = 0, pct = 0, compact = false, className = '', playing = false,
}: { path: string; size: number; fallbackDur?: number; pct?: number; compact?: boolean; className?: string; playing?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const info = useStore((s) => s.thumbs[pathKey(path)]);
  const request = useStore((s) => s.requestThumb);
  const drop = useStore((s) => s.dropThumb);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (visible && (!info || info.sig !== thumbSig(size))) request({ path, size });
  }, [visible, info, path, size, request]);
  useEffect(() => setLoaded(false), [info?.thumb]);

  const pending = !info || info.sig !== thumbSig(size);
  const dur = info?.dur || fallbackDur;
  return (
    <div ref={ref} className={`relative aspect-video overflow-hidden bg-surface-container-highest flex items-center justify-center ${compact ? 'rounded-lg' : 'rounded-xl'} ${className}`}>
      {pending && <div className="absolute inset-0 skeleton" />}
      {info?.thumb ? (
        <img
          src={assetUrl(info.thumb)} alt="" draggable={false} onLoad={() => setLoaded(true)} onError={() => drop(path)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-emphasized group-hover:scale-[1.06] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        !pending && <Icon name="movie" size={compact ? 22 : 40} className="text-on-surface-variant" fill />
      )}
      {!compact && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 ease-emphasized">
            <Icon name="play_arrow" fill size={28} />
          </div>
        </div>
      )}
      {playing && (
        <div className="absolute left-1.5 top-1.5 h-5 px-1.5 rounded-md bg-primary text-on-primary flex items-end gap-[2px] py-1">
          {[0, 0.2, 0.4].map((d) => <span key={d} className="eq-bar w-[3px] h-full bg-on-primary rounded-full" style={{ animationDelay: `${d}s` }} />)}
        </div>
      )}
      {dur > 0 && <div className={`absolute right-1 bottom-1.5 rounded bg-black/75 text-white tabular-nums ${compact ? 'px-1 text-[10px] leading-4' : 'px-1.5 py-0.5 text-label-md'}`}>{fmtTime(dur)}</div>}
      {pct > 0 && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}
