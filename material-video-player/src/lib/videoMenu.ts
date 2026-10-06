import { engine } from './engine';
import { tr } from './i18n';
import { openWithDefault, reveal } from './tauri';
import { useStore } from './store';
import type { Fit, MenuItem } from './types';

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

const secs = (n: number) => (n >= 60 ? tr('nMinutes', { n: n / 60 }) : tr('nSeconds', { n }));

/** Right-click menu of the video surface */
export function buildVideoMenu(): MenuItem[] {
  const s = useStore.getState();
  const cur = s.queue[s.index];
  const t = tr;

  const skip: MenuItem[] = [
    { label: t('skipBack', { n: secs(10) }), icon: 'replay_10', onClick: () => s.seekBy(-10) },
    { label: t('skipForward', { n: secs(10) }), icon: 'forward_10', onClick: () => s.seekBy(10) },
    { label: t('skipBack', { n: secs(30) }), icon: 'replay_30', onClick: () => s.seekBy(-30) },
    { label: t('skipForward', { n: secs(30) }), icon: 'forward_30', onClick: () => s.seekBy(30) },
    { label: t('skipBack', { n: secs(60) }), icon: 'fast_rewind', onClick: () => s.seekBy(-60) },
    { label: t('skipForward', { n: secs(60) }), icon: 'fast_forward', onClick: () => s.seekBy(60) },
    { divider: true },
    { label: t('goStart'), icon: 'first_page', onClick: () => s.seek(0) },
  ];

  const speed: MenuItem[] = RATES.map((r) => ({ label: `${r}×`, checked: r === s.rate, onClick: () => s.setRate(r) }));

  const repeatLabel = s.repeat === 'off' ? t('repOff') : s.repeat === 'all' ? t('repAll') : t('repOne');
  const playlist: MenuItem[] = [
    { label: t('previous'), icon: 'skip_previous', shortcut: 'Shift+P', onClick: s.prev },
    { label: t('next'), icon: 'skip_next', shortcut: 'Shift+N', onClick: () => s.next(false) },
    { divider: true },
    { label: t('shuffle'), icon: 'shuffle', checked: s.shuffle, onClick: s.toggleShuffle },
    { label: `${t('repeat')}: ${repeatLabel}`, icon: s.repeat === 'one' ? 'repeat_one' : 'repeat', onClick: s.cycleRepeat },
    { divider: true },
    { label: s.showQueue ? t('hidePlaylist') : t('showPlaylist'), icon: 'queue_music', shortcut: 'Q', onClick: () => s.set({ showQueue: !s.showQueue }) },
  ];

  const subs: MenuItem[] = [
    { label: t('off'), checked: s.subIndex < 0, onClick: () => void s.selectSub(-1) },
    ...s.subTracks.map((tk, i) => ({ label: tk.label, checked: s.subIndex === i, onClick: () => void s.selectSub(i) })),
    { divider: true },
    { label: t('loadSubtitle'), icon: 'upload_file', onClick: () => void s.loadSubFile() },
    { label: t('subDelayDec'), icon: 'remove', shortcut: 'G', onClick: () => s.setSubDelay(s.subDelay - 100) },
    { label: t('subDelayInc'), icon: 'add', shortcut: 'H', onClick: () => s.setSubDelay(s.subDelay + 100) },
    { label: t('subSettings'), icon: 'text_fields', onClick: () => s.openDialog({ type: 'subs' }) },
  ];

  const audio: MenuItem[] = [
    { label: t('mute'), icon: 'volume_off', checked: s.settings.muted, shortcut: 'M', onClick: s.toggleMute },
    { label: t('nightMode'), icon: 'bedtime', checked: s.night, onClick: () => s.setFx(s.boost, !s.night) },
    { divider: true },
    ...[1, 1.5, 2].map((b) => ({ label: t('boostN', { n: b * 100 }), checked: Math.abs(s.boost - b) < 0.01, onClick: () => s.setFx(b, s.night) })),
    { divider: true },
    { label: t('audioFx'), icon: 'graphic_eq', onClick: () => s.openDialog({ type: 'audio' }) },
  ];

  const fit = (f: Fit, label: string): MenuItem => ({ label, checked: s.adjust.fit === f, onClick: () => s.setAdjust({ fit: f }) });
  const video: MenuItem[] = [
    fit('contain', t('fitContain')), fit('cover', t('fitCover')), fit('fill', t('fitFill')),
    { divider: true },
    { label: t('rotateRight'), icon: 'rotate_right', shortcut: 'R', onClick: () => s.setAdjust({ rotate: (s.adjust.rotate + 90) % 360 }) },
    { label: t('flipH'), icon: 'flip', checked: s.adjust.flipH, onClick: () => s.setAdjust({ flipH: !s.adjust.flipH }) },
    { label: t('resetAdjust'), icon: 'restart_alt', onClick: s.resetAdjust },
    { label: t('videoAdjust'), icon: 'tune', onClick: () => s.openDialog({ type: 'adjust' }) },
  ];

  const file: MenuItem[] = cur
    ? [
        { label: t('showInFolder'), icon: 'folder_open', onClick: () => void reveal(cur.path) },
        { label: t('copyPath'), icon: 'content_copy', onClick: () => void navigator.clipboard.writeText(cur.path).then(() => s.showToast(t('pathCopied'))).catch(() => s.showToast(t('copyFailed'))) },
        { label: t('fileInfo'), icon: 'info', shortcut: 'I', onClick: () => s.openDialog({ type: 'info' }) },
        { label: t('openDefaultApp'), icon: 'open_in_new', onClick: () => void openWithDefault(cur.path) },
      ]
    : [];

  const loopLabel = s.loopA === null ? t('loopSetA') : s.loopB === null ? t('loopSetB') : t('loopClear');

  return [
    { label: s.playing ? t('pause') : t('play'), icon: s.playing ? 'pause' : 'play_arrow', shortcut: 'Space', onClick: s.togglePlay },
    { label: t('skip'), icon: 'fast_forward', children: skip },
    { label: t('speed'), icon: 'speed', children: speed },
    { label: t('queue'), icon: 'queue_music', children: playlist },
    { divider: true },
    { label: t('subtitles'), icon: 'closed_caption', children: subs },
    { label: t('audio'), icon: 'volume_up', children: audio },
    { label: t('video'), icon: 'tune', children: video },
    { label: loopLabel, icon: 'repeat_on', checked: s.loopA !== null && s.loopB !== null, shortcut: 'A', onClick: s.cycleLoop },
    { divider: true },
    { label: t('screenshot'), icon: 'photo_camera', shortcut: 'S', onClick: () => void s.screenshot() },
    { label: t('copyFrame'), icon: 'content_copy', onClick: () => void s.copyFrame() },
    { divider: true },
    { label: s.fullscreen ? t('exitFullscreen') : t('fullscreen'), icon: s.fullscreen ? 'fullscreen_exit' : 'fullscreen', shortcut: 'F', onClick: () => void s.toggleFullscreen() },
    { label: t('miniPlayer'), icon: 'picture_in_picture_alt', shortcut: 'T', onClick: () => void s.toggleMini() },
    { label: t('alwaysOnTop'), icon: 'push_pin', checked: s.settings.alwaysOnTop, onClick: () => s.updateSettings({ alwaysOnTop: !s.settings.alwaysOnTop }) },
    { divider: true },
    { label: t('file'), icon: 'description', children: file, disabled: !cur },
    { label: t('closeVideo'), icon: 'close', onClick: s.closeVideo },
  ];
}

void engine;
