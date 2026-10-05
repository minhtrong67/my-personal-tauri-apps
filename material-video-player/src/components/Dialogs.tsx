import { useEffect, useState, type ReactNode } from 'react';
import { engine } from '../lib/engine';
import { useCurrent, useStore } from '../lib/store';
import { reveal, openWithDefault } from '../lib/tauri';
import { useLang, useT } from '../lib/useT';
import { fmtSize, fmtTime } from '../lib/utils';
import { Button, Chip, Icon, IconButton, Modal, Segmented, Slider, Switch } from './ui';

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-0.5"><span className="text-title-sm">{label}</span>{value && <span className="text-label-lg text-primary tabular-nums">{value}</span>}</div>
      {children}
    </div>
  );
}

function SubsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const tracks = useStore((s) => s.subTracks);
  const idx = useStore((s) => s.subIndex);
  const delay = useStore((s) => s.subDelay);
  const style = useStore((s) => s.settings.sub);
  const st = useStore.getState();
  const upd = (p: Partial<typeof style>) => st.updateSettings({ sub: { ...style, ...p } });
  const row = (active: boolean, label: string, onClick: () => void) => (
    <button key={label} onClick={onClick} className={`w-full h-12 px-3 rounded-xl flex items-center gap-3 text-left hover:bg-on-surface/[.08] ${active ? 'bg-secondary-container text-on-secondary-container' : ''}`}>
      <Icon name={active ? 'radio_button_checked' : 'radio_button_unchecked'} size={20} />
      <span className="truncate text-body-md">{label}</span>
    </button>
  );
  return (
    <Modal title={t('subtitles')} wide onClose={onClose} actions={<Button variant="text" onClick={onClose}>{t('done')}</Button>}>
      <div className="mb-4">
        {row(idx < 0, t('off'), () => void st.selectSub(-1))}
        {tracks.map((tr, i) => row(idx === i, tr.label, () => void st.selectSub(i)))}
        {!tracks.length && <div className="px-3 py-2 text-body-md text-on-surface-variant">{t('noSubs')}</div>}
        <div className="mt-2"><Button variant="tonal" icon="upload_file" onClick={() => void st.loadSubFile()}>{t('loadSubtitle')}</Button></div>
      </div>
      <Field label={t('subDelay')} value={`${delay > 0 ? '+' : ''}${(delay / 1000).toFixed(1)} s`}>
        <div className="flex items-center gap-2">
          <IconButton icon="remove" variant="tonal" onClick={() => st.setSubDelay(delay - 100)} title="-0.1s" />
          <div className="flex-1"><Slider min={-10000} max={10000} step={100} value={delay} onChange={st.setSubDelay} label={t('subDelay')} /></div>
          <IconButton icon="add" variant="tonal" onClick={() => st.setSubDelay(delay + 100)} title="+0.1s" />
          <Button variant="text" onClick={() => st.setSubDelay(0)}>{t('reset')}</Button>
        </div>
      </Field>
      <Field label={t('subSize')} value={`${style.size}%`}><Slider min={50} max={220} step={5} value={style.size} onChange={(v) => upd({ size: v })} label={t('subSize')} /></Field>
      <Field label={t('subPosition')} value={`${style.bottom}%`}><Slider min={0} max={40} step={1} value={style.bottom} onChange={(v) => upd({ bottom: v })} label={t('subPosition')} /></Field>
      <Field label={t('subColor')}>
        <div className="flex gap-2">
          {['#FFFFFF', '#FFE45C', '#7CFFB2', '#6FD8FF', '#FF9AA2'].map((c) => (
            <button key={c} aria-label={c} onClick={() => upd({ color: c })} style={{ background: c }} className={`w-9 h-9 rounded-full border border-outline-variant ${style.color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-high' : ''}`} />
          ))}
        </div>
      </Field>
      <Field label={t('subBackground')}>
        <Segmented value={style.bg} onChange={(v) => upd({ bg: v })} options={[{ value: 'none', label: t('bgNone') }, { value: 'shadow', label: t('bgShadow') }, { value: 'box', label: t('bgBox') }]} />
      </Field>
      {style.bg === 'box' && <Field label={t('subOpacity')} value={`${Math.round(style.opacity * 100)}%`}><Slider min={0.1} max={1} step={0.05} value={style.opacity} onChange={(v) => upd({ opacity: v })} label={t('subOpacity')} /></Field>}
      <div className="mt-2 rounded-2xl bg-black h-24 relative overflow-hidden flex items-end justify-center pb-2">
        <div className="text-center" style={{ color: style.color, fontSize: `${1.1 * (style.size / 100) * 16}px`, textShadow: style.bg === 'none' ? 'none' : '0 0 4px #000, 1px 1px 2px #000', background: style.bg === 'box' ? `rgba(0,0,0,${style.opacity})` : 'transparent', padding: style.bg === 'box' ? '2px 10px' : 0, borderRadius: 8 }}>{t('subPreview')}</div>
      </div>
    </Modal>
  );
}

function AdjustDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const a = useStore((s) => s.adjust);
  const st = useStore.getState();
  const set = st.setAdjust;
  return (
    <Modal title={t('videoAdjust')} wide onClose={onClose} actions={<><Button variant="text" onClick={st.resetAdjust}>{t('reset')}</Button><Button variant="text" onClick={onClose}>{t('done')}</Button></>}>
      <Field label={t('aspectFit')}>
        <Segmented value={a.fit} onChange={(v) => set({ fit: v })} options={[{ value: 'contain', label: t('fitContain') }, { value: 'cover', label: t('fitCover') }, { value: 'fill', label: t('fitFill') }]} />
      </Field>
      <Field label={t('brightness')} value={`${Math.round(a.brightness * 100)}%`}><Slider min={0.4} max={1.8} step={0.02} value={a.brightness} onChange={(v) => set({ brightness: v })} label={t('brightness')} /></Field>
      <Field label={t('contrast')} value={`${Math.round(a.contrast * 100)}%`}><Slider min={0.4} max={1.8} step={0.02} value={a.contrast} onChange={(v) => set({ contrast: v })} label={t('contrast')} /></Field>
      <Field label={t('saturation')} value={`${Math.round(a.saturation * 100)}%`}><Slider min={0} max={2} step={0.02} value={a.saturation} onChange={(v) => set({ saturation: v })} label={t('saturation')} /></Field>
      <Field label={t('hue')} value={`${a.hue}°`}><Slider min={-180} max={180} step={1} value={a.hue} onChange={(v) => set({ hue: v })} label={t('hue')} /></Field>
      <Field label={t('zoom')} value={`${Math.round(a.zoom * 100)}%`}><Slider min={0.5} max={4} step={0.05} value={a.zoom} onChange={(v) => set({ zoom: v, ...(v <= 1 ? { panX: 0, panY: 0 } : {}) })} label={t('zoom')} /></Field>
      <div className="flex flex-wrap gap-2">
        <Chip icon="rotate_left" onClick={() => set({ rotate: (a.rotate + 270) % 360 })}>{t('rotateLeft')}</Chip>
        <Chip icon="rotate_right" onClick={() => set({ rotate: (a.rotate + 90) % 360 })}>{t('rotateRight')}</Chip>
        <Chip icon="flip" selected={a.flipH} onClick={() => set({ flipH: !a.flipH })}>{t('flipH')}</Chip>
        <Chip icon="flip" selected={a.flipV} onClick={() => set({ flipV: !a.flipV })}>{t('flipV')}</Chip>
      </div>
    </Modal>
  );
}

function AudioDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const boost = useStore((s) => s.boost);
  const night = useStore((s) => s.night);
  const st = useStore.getState();
  const ok = engine.fxAvailable;
  return (
    <Modal title={t('audioFx')} onClose={onClose} actions={<Button variant="text" onClick={onClose}>{t('done')}</Button>}>
      {!ok && <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-body-md">{t('fxUnavailable')}</div>}
      <div className={ok ? '' : 'opacity-50 pointer-events-none'}>
        <Field label={t('volumeBoost')} value={`${Math.round(boost * 100)}%`}><Slider min={1} max={2} step={0.05} value={boost} onChange={(v) => st.setFx(v, night)} label={t('volumeBoost')} /></Field>
        <div className="flex items-center justify-between gap-4">
          <div><div className="text-title-sm">{t('nightMode')}</div><div className="text-body-sm text-on-surface-variant">{t('nightModeDesc')}</div></div>
          <Switch checked={night} onChange={(v) => st.setFx(boost, v)} />
        </div>
      </div>
    </Modal>
  );
}

function SleepDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const sleepAt = useStore((s) => s.sleepAt);
  const eov = useStore((s) => s.sleepEndOfVideo);
  const setSleep = useStore((s) => s.setSleep);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const remaining = sleepAt ? Math.max(0, Math.round((sleepAt - Date.now()) / 1000)) : 0;
  const pick = (m: number | 'video' | null) => { setSleep(m); onClose(); };
  return (
    <Modal title={t('sleepTimer')} onClose={onClose} actions={<Button variant="text" onClick={onClose}>{t('close')}</Button>}>
      {(sleepAt || eov) && (
        <div className="mb-4 p-4 rounded-2xl bg-primary-container text-on-primary-container flex items-center gap-3">
          <Icon name="bedtime" fill />
          <div className="flex-1 text-body-lg">{eov ? t('sleepEndOfVideo') : t('sleepRemaining', { time: fmtTime(remaining) })}</div>
          <Button variant="text" onClick={() => pick(null)}>{t('turnOff')}</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {[15, 30, 45, 60, 90, 120].map((m) => <Chip key={m} icon="schedule" onClick={() => pick(m)}>{t('nMinutes', { n: m })}</Chip>)}
        <Chip icon="movie" onClick={() => pick('video')}>{t('afterThisVideo')}</Chip>
      </div>
    </Modal>
  );
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const f = useCurrent();
  const size = useStore((s) => s.videoSize);
  const duration = useStore((s) => s.duration);
  if (!f) return null;
  const rows: [string, string][] = [
    [t('name'), f.name], [t('path'), f.path], [t('fileSize'), fmtSize(f.size)], [t('duration'), fmtTime(duration)],
    [t('resolution'), size ? `${size.w} × ${size.h}` : '—'], [t('frameRate'), `~${engine.fps} fps`],
    [t('modified'), f.modified ? new Date(f.modified * 1000).toLocaleString() : '—'],
  ];
  return (
    <Modal title={t('fileInfo')} wide onClose={onClose} actions={<><Button variant="text" onClick={() => void reveal(f.path)}>{t('showInFolder')}</Button><Button variant="text" onClick={onClose}>{t('close')}</Button></>}>
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-body-md">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="break-all select-text">{v}</dd></div>))}
      </dl>
      <div className="mt-4"><Button variant="tonal" icon="open_in_new" onClick={() => void openWithDefault(f.path)}>{t('openDefaultApp')}</Button></div>
    </Modal>
  );
}

const SHORTCUTS: [string, 'scPlay' | 'scSeek' | 'scSeekBig' | 'scVolume' | 'scMute' | 'scFullscreen' | 'scSpeed' | 'scFrame' | 'scNextPrev' | 'scSubs' | 'scSubDelay' | 'scLoop' | 'scShot' | 'scQueue' | 'scRotate' | 'scMini' | 'scPercent' | 'scOpen' | 'scInfo' | 'scExit'][] = [
  ['Space / K', 'scPlay'], ['← / →', 'scSeek'], ['J / L', 'scSeekBig'], ['↑ / ↓', 'scVolume'], ['M', 'scMute'], ['F / F11', 'scFullscreen'],
  ['[ / ]', 'scSpeed'], [', / .', 'scFrame'], ['Shift+N / Shift+P', 'scNextPrev'], ['C / V', 'scSubs'], ['G / H', 'scSubDelay'], ['A', 'scLoop'],
  ['S', 'scShot'], ['Q', 'scQueue'], ['R', 'scRotate'], ['T', 'scMini'], ['0 – 9', 'scPercent'], ['Ctrl+O', 'scOpen'], ['I', 'scInfo'], ['Esc', 'scExit'],
];

export function Dialogs() {
  const d = useStore((s) => s.dialog);
  const t = useT();
  useLang();
  const close = () => useStore.getState().openDialog(null);
  if (!d) return null;
  switch (d.type) {
    case 'confirm':
      return (
        <Modal title={d.title} onClose={close} actions={<><Button variant="text" onClick={close}>{t('cancel')}</Button><Button variant="text" danger={d.danger} onClick={() => { d.onConfirm(); close(); }}>{d.confirmLabel ?? t('ok')}</Button></>}>
          <p className="text-body-lg text-on-surface-variant">{d.text}</p>
        </Modal>
      );
    case 'subs': return <SubsDialog onClose={close} />;
    case 'adjust': return <AdjustDialog onClose={close} />;
    case 'audio': return <AudioDialog onClose={close} />;
    case 'sleep': return <SleepDialog onClose={close} />;
    case 'info': return <InfoDialog onClose={close} />;
    case 'shortcuts':
      return (
        <Modal title={t('shortcuts')} wide onClose={close} actions={<Button variant="text" onClick={close}>{t('close')}</Button>}>
          <dl className="grid grid-cols-[170px_1fr] gap-y-2 text-body-md">
            {SHORTCUTS.map(([k, v]) => (<div key={k} className="contents"><dt><kbd className="px-2 py-0.5 rounded-md bg-surface-container-highest text-label-md">{k}</kbd></dt><dd>{t(v)}</dd></div>))}
          </dl>
        </Modal>
      );
  }
}
