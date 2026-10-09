import { PageHeader } from '../components/Collection';
import { tr } from '../lib/i18n';
import { AuthorCredit, Button, Icon, Segmented, Switch } from '../components/ui';
import { SEED_PRESETS } from '../lib/theme';
import { useDerived, useStore } from '../lib/store';
import { fmtSize } from '../lib/utils';
import type { ReactNode } from 'react';

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="mx-8 mb-4 rounded-3xl bg-surface-container p-6">
      <h2 className="flex items-center gap-2 text-title-lg mb-4"><Icon name={icon} className="text-primary" fill />{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0"><div className="text-body-lg">{title}</div>{desc && <div className="text-body-md text-on-surface-variant">{desc}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const st = useStore.getState();
  const { all, albums, artists } = useDerived();
  const playlists = useStore((x) => x.playlists);
  const size = all.reduce((a, t) => a + t.size, 0);

  return (
    <div className="h-full overflow-y-auto pb-8 scroll-smooth stagger">
      <PageHeader title={tr('navSettings')} />
      <Section title={tr('appearance')} icon="palette">
        <Row title={tr('language')}><Segmented value={s.language} onChange={(v) => update({ language: v })} options={[{ value: 'auto', label: tr('langAuto') }, { value: 'en', label: 'English' }, { value: 'vi', label: 'Tiếng Việt' }]} /></Row>
        <Row title={tr('colorMode')}><Segmented value={s.themeMode} onChange={(v) => update({ themeMode: v })} options={[{ value: 'system', label: tr('themeSystem'), icon: 'brightness_auto' }, { value: 'light', label: tr('themeLight'), icon: 'light_mode' }, { value: 'dark', label: tr('themeDark'), icon: 'dark_mode' }]} /></Row>
        <Row title={tr('themeColor')} desc={tr('themeColorDesc')}>
          <div className="flex items-center gap-2">
            {SEED_PRESETS.map((c) => (
              <button key={c} aria-label={c} onClick={() => update({ seedColor: c })} style={{ background: c }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${s.seedColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-on-surface' : ''}`}>
                {s.seedColor.toLowerCase() === c.toLowerCase() && <Icon name="check" size={18} className="text-white" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-on-surface/[.08]" title={tr('customColor')}>
              <Icon name="colorize" size={18} /><input type="color" className="sr-only" value={s.seedColor} onChange={(e) => update({ seedColor: e.target.value })} />
            </label>
          </div>
        </Row>
        <Row title={tr('dynamicColor')} desc={tr('dynamicColorDesc')}><Switch checked={s.dynamicColor} onChange={(v) => update({ dynamicColor: v })} /></Row>
      </Section>

      <Section title={tr('playbackSection')} icon="graphic_eq">
        <Row title={tr('restoreSession')} desc={tr('restoreSessionDesc')}><Switch checked={s.restoreSession} onChange={(v) => update({ restoreSession: v })} /></Row>
        <Row title={tr('audioEq')} desc={tr('audioEqDesc')}><Button variant="tonal" icon="tune" onClick={() => st.openDialog({ type: 'audio' })}>{tr('open')}</Button></Row>
        <Row title={tr('sleepTitle')}><Button variant="tonal" icon="bedtime" onClick={() => st.openDialog({ type: 'sleep' })}>{tr('setTimer')}</Button></Row>
      </Section>

      <Section title={tr('systemSection')} icon="desktop_windows">
        <Row title={tr('closeToTray')} desc={tr('closeToTrayDesc')}><Switch checked={s.closeToTray} onChange={(v) => update({ closeToTray: v })} /></Row>
        <Row title={tr('alwaysOnTop')}><Switch checked={s.alwaysOnTop} onChange={(v) => update({ alwaysOnTop: v })} /></Row>
        <Row title={tr('startFullscreen')} desc={tr('startFullscreenDesc')}><Switch checked={s.startFullscreen} onChange={(v) => update({ startFullscreen: v })} /></Row>
      </Section>

      <Section title={tr('librarySection')} icon="library_music">
        <Row title={tr('autoScanMusic')} desc={tr('autoScanMusicDesc')}><Switch checked={s.autoScanMusic} onChange={(v) => update({ autoScanMusic: v })} /></Row>
        <div className="text-body-md text-on-surface-variant">{tr('libraryStats', { songs: all.length, albums: albums.length, artists: artists.length, playlists: playlists.length, size: fmtSize(size) })}</div>
        <div className="flex flex-wrap gap-2">
          <Button icon="create_new_folder" onClick={st.importFolder}>{tr('addFolder')}</Button>
          <Button icon="audio_file" variant="tonal" onClick={st.importFiles}>{tr('addFiles')}</Button>
          <Button icon="sync" variant="tonal" onClick={() => st.syncLibrary(false, true)}>{tr('rescanLibrary')}</Button>
          <Button icon="link_off" variant="tonal" onClick={st.removeMissing}>{tr('removeMissing')}</Button>
          <Button icon="download" variant="outlined" onClick={st.backup}>{tr('backup')}</Button>
          <Button icon="upload" variant="outlined" onClick={st.restore}>{tr('restore')}</Button>
          <Button icon="delete_forever" variant="text" danger onClick={() => st.openDialog({ type: 'confirm', title: tr('clearLibraryQ'), text: tr('clearLibraryText', { app: 'Material Music Player' }), confirmLabel: tr('clearAll'), danger: true, onConfirm: st.clearLibrary })}>{tr('clearLibrary')}</Button>
        </div>
      </Section>

      <Section title={tr('aboutSection')} icon="info">
        <div className="flex items-center gap-4">
          <img src="/icon.png" alt="" className="w-14 h-14 rounded-2xl" />
          <div>
            <div className="text-title-md">Material Music Player 1.0.0</div>
            <div className="text-body-md text-on-surface-variant">{tr('aboutTagline')}</div>
            <div className="mt-1.5"><AuthorCredit /></div>
          </div>
        </div>
        <Button variant="tonal" icon="keyboard" onClick={() => st.openDialog({ type: 'shortcuts' })}>{tr('shortcutsBtn')}</Button>
      </Section>
    </div>
  );
}
