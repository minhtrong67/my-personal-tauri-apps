import { useCallback, useEffect, useRef, useState } from 'react';
import { useCurrent, useStore } from '../lib/store';
import { useT } from '../lib/useT';
import { win } from '../lib/window';
import { Controls } from './Controls';
import { QueuePanel } from './QueuePanel';
import { VideoSurface } from './VideoSurface';
import { WindowControls } from './TitleBar';
import { IconButton } from './ui';

export function Player() {
  const t = useT();
  const cur = useCurrent();
  const playing = useStore((s) => s.playing);
  const hideDelay = useStore((s) => s.settings.hideDelay);
  const showQueue = useStore((s) => s.showQueue);
  const fullscreen = useStore((s) => s.fullscreen);
  const mini = useStore((s) => s.mini);
  const blocked = useStore((s) => !!s.dialog || !!s.menu);
  const [visible, setVisible] = useState(true);
  const timer = useRef<number>();
  const overUi = useRef(false);

  const wake = useCallback(() => {
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!overUi.current) setVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  useEffect(() => {
    wake();
    return () => window.clearTimeout(timer.current);
  }, [wake, playing, blocked]);

  const show = visible || !playing || blocked;
  const st = useStore.getState();

  return (
    <div className="h-full flex bg-black" onMouseMove={wake} style={{ cursor: show ? undefined : 'none' }}>
      <div className="relative flex-1 min-w-0 h-full overflow-hidden">
        <VideoSurface onActivity={wake} />

        {/* top overlay */}
        <div
          data-tauri-drag-region
          className={`absolute top-0 inset-x-0 h-16 pl-3 pr-1 flex items-start pt-2 gap-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onMouseEnter={() => (overUi.current = true)} onMouseLeave={() => (overUi.current = false)}
        >
          {!mini && <IconButton icon="arrow_back" className="text-white hover:bg-white/15" title={t('back')} onClick={st.closeVideo} />}
          <div className="flex-1 min-w-0 pt-2 pointer-events-none">
            <div className={`truncate text-white ${mini ? 'text-label-lg' : 'text-title-md'}`}>{cur?.name}</div>
          </div>
          {mini ? (
            <>
              <IconButton icon="open_in_full" size="sm" className="text-white hover:bg-white/15" title={t('exitMini')} onClick={() => void st.toggleMini()} />
              <IconButton icon="close" size="sm" className="text-white hover:bg-white/15" title={t('close')} onClick={() => void win().close()} />
            </>
          ) : fullscreen ? (
            <IconButton icon="fullscreen_exit" className="text-white hover:bg-white/15" title={t('exitFullscreen')} onClick={() => void st.toggleFullscreen(false)} />
          ) : (
            <WindowControls light />
          )}
        </div>

        {/* bottom overlay */}
        <div
          className={`absolute bottom-0 inset-x-0 pt-16 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onMouseEnter={() => (overUi.current = true)} onMouseLeave={() => (overUi.current = false)}
          onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
        >
          <Controls compact={mini} />
        </div>
      </div>
      {showQueue && !mini && <QueuePanel />}
    </div>
  );
}
