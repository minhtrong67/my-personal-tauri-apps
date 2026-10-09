import { useEffect, useState } from 'react';
import { tr, type Key } from '../lib/i18n';
import { Button, Chip, Icon, Modal, Slider, Switch } from './ui';
import { Cover } from './Cover';
import { useStore } from '../lib/store';
import { EQ_LABELS, EQ_PRESETS, engine } from '../lib/audio';
import { fmtSize, fmtTime } from '../lib/utils';

function PromptDialog({ d, onClose }: { d: Extract<NonNullable<ReturnType<typeof useStore.getState>['dialog']>, { type: 'prompt' }>; onClose: () => void }) {
  const [v, setV] = useState(d.initial ?? '');
  const submit = () => { if (v.trim()) { d.onSubmit(v.trim()); onClose(); } };
  return (
    <Modal title={d.title} onClose={onClose} actions={<><Button variant="text" onClick={onClose}>{tr('cancel')}</Button><Button variant="text" onClick={submit} disabled={!v.trim()}>{d.confirmLabel ?? tr('ok')}</Button></>}>
      <label className="block relative mt-1">
        <span className="absolute -top-2.5 left-3 px-1 bg-surface-container-high text-body-sm text-primary">{d.label}</span>
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} maxLength={80}
          className="w-full h-14 px-4 rounded bg-transparent border-2 border-primary outline-none text-body-lg text-on-surface" />
      </label>
    </Modal>
  );
}

function AddToPlaylist({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const playlists = useStore((s) => s.playlists);
  const byId = useStore((s) => s.byId);
  const { addToPlaylist, createPlaylist, showToast } = useStore.getState();
  const [name, setName] = useState('');
  const create = () => { if (!name.trim()) return; createPlaylist(name, ids); showToast(tr('playlistCreated', { name: name.trim() })); onClose(); };
  return (
    <Modal title={tr('addToPlaylist')} onClose={onClose} actions={<Button variant="text" onClick={onClose}>{tr('close')}</Button>}>
      <div className="flex gap-2 mb-3">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder={tr('newPlaylistPlaceholder')} maxLength={80}
          className="flex-1 h-12 px-4 rounded-full bg-surface-container-highest outline-none text-body-md focus:ring-2 ring-primary" />
        <Button variant="tonal" icon="add" onClick={create} disabled={!name.trim()}>{tr('create')}</Button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {playlists.filter((p) => !p.folder || true).map((p) => (
          <button key={p.id} className="w-full h-14 px-3 rounded-xl flex items-center gap-3 hover:bg-on-surface/[.08] text-left" onClick={() => { addToPlaylist(p.id, ids); onClose(); }}>
            <Cover track={byId[p.trackIds[0]]} className="w-10 h-10 rounded-lg" iconSize={20} />
            <div className="min-w-0"><div className="truncate text-body-lg">{p.name}</div><div className="text-body-sm text-on-surface-variant">{tr('nSongs', { n: p.trackIds.length })}</div></div>
          </button>
        ))}
        {!playlists.length && <div className="text-on-surface-variant text-body-md py-6 text-center">{tr('noPlaylists')}</div>}
      </div>
    </Modal>
  );
}

function InfoDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useStore((s) => s.byId[id]);
  if (!t) return null;
  const rows: [string, string][] = [
    [tr('infoTitle'), t.title], [tr('infoArtist'), t.artist], [tr('infoAlbum'), t.album], [tr('infoGenre'), t.genre || '—'], [tr('infoYear'), t.year ? String(t.year) : '—'],
    [tr('infoDuration'), fmtTime(t.duration)], [tr('infoFormat'), t.format.toUpperCase()], [tr('infoBitrate'), t.bitrate ? `${t.bitrate} kbps` : '—'],
    [tr('infoSampleRate'), t.sampleRate ? `${(t.sampleRate / 1000).toFixed(1)} kHz` : '—'], [tr('infoSize'), fmtSize(t.size)], [tr('infoPath'), t.path],
  ];
  return (
    <Modal title={tr('songInfo')} wide onClose={onClose} actions={<Button variant="text" onClick={onClose}>{tr('close')}</Button>}>
      <div className="flex gap-4 mb-4"><Cover track={t} eager className="w-28 h-28 rounded-2xl" iconSize={48} /></div>
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-body-md">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="break-all select-text">{v}</dd></div>))}
      </dl>
    </Modal>
  );
}

function SleepDialog({ onClose }: { onClose: () => void }) {
  const sleepAt = useStore((s) => s.sleepAt);
  const eot = useStore((s) => s.sleepEndOfTrack);
  const setSleep = useStore((s) => s.setSleep);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const remaining = sleepAt ? Math.max(0, Math.round((sleepAt - Date.now()) / 1000)) : 0;
  const pick = (m: number | 'track' | null) => { setSleep(m); onClose(); };
  return (
    <Modal title={tr('sleepTitle')} onClose={onClose} actions={<Button variant="text" onClick={onClose}>{tr('close')}</Button>}>
      {(sleepAt || eot) && (
        <div className="mb-4 p-4 rounded-2xl bg-primary-container text-on-primary-container flex items-center gap-3">
          <Icon name="bedtime" fill />
          <div className="flex-1 text-body-lg">{eot ? tr('sleepEndOfTrack') : tr('sleepRemaining', { time: fmtTime(remaining) })}</div>
          <Button variant="text" onClick={() => pick(null)}>{tr('turnOff')}</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {[15, 30, 45, 60, 90, 120].map((m) => <Chip key={m} icon="schedule" onClick={() => pick(m)}>{tr('nMinutes', { n: m })}</Chip>)}
        <Chip icon="music_note" onClick={() => pick('track')}>{tr('afterThisSong')}</Chip>
      </div>
    </Modal>
  );
}

function AudioDialog({ onClose }: { onClose: () => void }) {
  const s = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const setGain = (i: number, v: number) => { const g = [...s.eqGains]; g[i] = v; update({ eqGains: g, eqPreset: 'custom' }); };
  const fx = engine.fxAvailable;
  return (
    <Modal title={tr('audioTitle')} wide onClose={onClose} actions={<Button variant="text" onClick={onClose}>{tr('done')}</Button>}>
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1"><span className="text-title-md">{tr('playbackSpeed')}</span><span className="text-label-lg text-primary">{s.playbackRate.toFixed(2)}×</span></div>
        <Slider min={0.5} max={2} step={0.05} value={s.playbackRate} onChange={(v) => update({ playbackRate: v })} label={tr('playbackSpeed')} />
        <div className="flex gap-2 mt-2">{[0.75, 1, 1.25, 1.5, 2].map((r) => <Chip key={r} selected={s.playbackRate === r} onClick={() => update({ playbackRate: r })}>{r}×</Chip>)}</div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-title-md">{tr('eqTitle')}</span>
        <Switch checked={s.eqEnabled} onChange={(v) => update({ eqEnabled: v })} />
      </div>
      {!fx && <div className="mb-3 p-3 rounded-xl bg-error-container text-on-error-container text-body-md">{tr('eqUnavailable')}</div>}
      <div className={`${s.eqEnabled && fx ? '' : 'opacity-50 pointer-events-none'} transition-opacity`}>
        <div className="flex gap-2 flex-wrap mb-4">
          {Object.keys(EQ_PRESETS).map((p) => <Chip key={p} selected={s.eqPreset === p} onClick={() => update({ eqGains: EQ_PRESETS[p], eqPreset: p })}>{p === 'custom' ? tr('eqCustom') : tr(`eq_${p}` as Key)}</Chip>)}
        </div>
        <div className="flex justify-between gap-1 px-2">
          {EQ_LABELS.map((l, i) => (
            <div key={l} className="flex flex-col items-center gap-2">
              <span className="text-label-md text-on-surface-variant tabular-nums w-8 text-center">{s.eqGains[i] > 0 ? '+' : ''}{s.eqGains[i]}</span>
              <div className="relative w-6 h-36">
                <div className="absolute left-1/2 top-1/2 w-36 h-6 -translate-x-1/2 -translate-y-1/2 -rotate-90">
                  <Slider min={-12} max={12} step={1} value={s.eqGains[i]} onChange={(v) => setGain(i, v)} label={tr('band', { l })} />
                </div>
              </div>
              <span className="text-label-md text-on-surface-variant">{l}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex justify-between"><span className="text-title-sm">Preamp</span><span className="text-label-lg text-primary">{s.preamp > 0 ? '+' : ''}{s.preamp} dB</span></div>
          <Slider min={-12} max={12} step={1} value={s.preamp} onChange={(v) => update({ preamp: v })} label="Preamp" />
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, Key][] = [
  ['Space', 'scPlay'], ['Ctrl + ← / →', 'scNextPrev'], ['← / →', 'scSeek'], ['↑ / ↓', 'scVolume'], ['M', 'scMute'], ['S', 'scShuffle'], ['R', 'scRepeat'],
  ['L', 'scLike'], ['Q', 'scQueue'], ['N', 'scNow'], ['Ctrl + F', 'scSearch'], ['F5', 'scRefresh'], ['F11', 'scFullscreen'], ['Esc', 'scExit'],
];

export function Dialogs() {
  const d = useStore((s) => s.dialog);
  const close = () => useStore.getState().openDialog(null);
  if (!d) return null;
  switch (d.type) {
    case 'prompt': return <PromptDialog d={d} onClose={close} />;
    case 'confirm':
      return (
        <Modal title={d.title} onClose={close} actions={<><Button variant="text" onClick={close}>{tr('cancel')}</Button><Button variant="text" danger={d.danger} onClick={() => { d.onConfirm(); close(); }}>{d.confirmLabel ?? tr('confirm')}</Button></>}>
          <p className="text-body-lg text-on-surface-variant">{d.text}</p>
        </Modal>
      );
    case 'info': return <InfoDialog id={d.id} onClose={close} />;
    case 'addToPlaylist': return <AddToPlaylist ids={d.ids} onClose={close} />;
    case 'sleep': return <SleepDialog onClose={close} />;
    case 'audio': return <AudioDialog onClose={close} />;
    case 'shortcuts':
      return (
        <Modal title={tr('shortcutsTitle')} onClose={close} actions={<Button variant="text" onClick={close}>{tr('close')}</Button>}>
          <dl className="grid grid-cols-[150px_1fr] gap-y-2 text-body-md">
            {SHORTCUTS.map(([k, v]) => (<div key={k} className="contents"><dt><kbd className="px-2 py-0.5 rounded-md bg-surface-container-highest text-label-md">{k}</kbd></dt><dd>{tr(v)}</dd></div>))}
          </dl>
        </Modal>
      );
  }
}
