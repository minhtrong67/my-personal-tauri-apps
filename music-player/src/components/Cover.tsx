import { useEffect, useRef, useState } from 'react';
import { restoreCover, useCover } from '../lib/cover';
import type { Track } from '../lib/types';
import { Icon } from './ui';

/** Ảnh bìa; tự phục hồi nếu tệp ảnh trong bộ nhớ đệm bị mất */
export function Cover({ track, className = '', iconSize = 24, round = false, eager = false }: { track?: Track; className?: string; iconSize?: number; round?: boolean; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [bust, setBust] = useState(0);
  const [failed, setFailed] = useState(false);
  const tried = useRef<string>('');

  useEffect(() => {
    if (eager || !ref.current) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setVisible(true), io.disconnect()), { rootMargin: '120px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [eager]);

  const url = useCover(track, visible);
  useEffect(() => {
    setFailed(false);
    setBust(0);
  }, [url, track?.id]);

  const onError = () => {
    if (!track || tried.current === track.id) return setFailed(true);
    tried.current = track.id;
    restoreCover(track).then((ok) => (ok ? setBust((b) => b + 1) : setFailed(true)));
  };
  const src = url ? (bust ? `${url}${url.includes('?') ? '&' : '?'}v=${bust}` : url) : null;

  return (
    <div ref={ref} className={`relative overflow-hidden bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 ${round ? 'rounded-full' : ''} ${className}`}>
      {src && !failed ? (
        <img key={`${track?.id}-${bust}`} src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={onError} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Icon name="music_note" size={iconSize} fill />
      )}
    </div>
  );
}
