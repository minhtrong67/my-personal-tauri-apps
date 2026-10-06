import type { ReactNode } from 'react';
import { Button, Icon, IconButton, Logo, Segmented, Switch } from '../components/ui';
import { SEED_PRESETS } from '../lib/theme';
import { useStore } from '../lib/store';
import { useT } from '../lib/useT';

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="mx-8 mb-4 rounded-3xl bg-surface-container p-6 transition-shadow duration-300 hover:shadow-md">
      <h2 className="flex items-center gap-2 text-title-lg mb-4"><Icon name={icon} className="text-primary" fill />{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0"><div className="text-body-lg">{title}</div>{desc && <div className="text-body-md text-on-surface-variant">{desc}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const t = useT();
  const s = useStore((x) => x.settings);
  const update = useStore((x) => x.updateSettings);
  const st = useStore.getState();
  return (
    <div className="h-full overflow-y-auto pb-8 scroll-smooth stagger">
      <Section title={t('appearance')} icon="palette">
        <Row title={t('language')}>
          <Segmented value={s.language} onChange={(v) => update({ language: v })} options={[{ value: 'auto', label: t('langAuto') }, { value: 'en', label: 'English' }, { value: 'vi', label: 'Tiếng Việt' }]} />
        </Row>
        <Row title={t('theme')}>
          <Segmented value={s.themeMode} onChange={(v) => update({ themeMode: v })} options={[{ value: 'system', label: t('themeSystem'), icon: 'brightness_auto' }, { value: 'light', label: t('themeLight'), icon: 'light_mode' }, { value: 'dark', label: t('themeDark'), icon: 'dark_mode' }]} />
        </Row>
        <Row title={t('themeColor')} desc={t('themeColorDesc')}>
          <div className="flex items-center gap-2 flex-wrap justify-end max-w-[420px]">
            {SEED_PRESETS.map((c) => (
              <button key={c} aria-label={c} onClick={() => update({ seedColor: c })} style={{ background: c }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${s.seedColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-on-surface' : ''}`}>
                {s.seedColor.toLowerCase() === c.toLowerCase() && <Icon name="check" size={18} className="text-white" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-on-surface/[.08]" title={t('customColor')}>
              <Icon name="colorize" size={18} /><input type="color" className="sr-only" value={s.seedColor} onChange={(e) => update({ seedColor: e.target.value })} />
            </label>
          </div>
        </Row>
      </Section>

      <Section title={t('playback')} icon="play_circle">
        <Row title={t('resumePlayback')} desc={t('resumePlaybackDesc')}><Switch checked={s.resume} onChange={(v) => update({ resume: v })} /></Row>
        <Row title={t('autoQueue')} desc={t('autoQueueDesc')}><Switch checked={s.autoQueue} onChange={(v) => update({ autoQueue: v })} /></Row>
        <Row title={t('seekStep')}>
          <Segmented value={String(s.seekStep)} onChange={(v) => update({ seekStep: Number(v) })} options={[{ value: '5', label: '5 s' }, { value: '10', label: '10 s' }, { value: '15', label: '15 s' }]} />
        </Row>
        <Row title={t('hideControls')}>
          <Segmented value={String(s.hideDelay)} onChange={(v) => update({ hideDelay: Number(v) })} options={[{ value: '1500', label: '1.5 s' }, { value: '2500', label: '2.5 s' }, { value: '5000', label: '5 s' }]} />
        </Row>
      </Section>

      <Section title={t('library')} icon="video_library">
        <Row title={t('autoScanVideos')} desc={t('autoScanVideosDesc')}><Switch checked={s.autoScanVideos} onChange={(v) => update({ autoScanVideos: v })} /></Row>
        <div>
          <div className="flex items-center justify-between gap-4 mb-2">
            <div><div className="text-body-lg">{t('libraryFolders')}</div><div className="text-body-md text-on-surface-variant">{t('libraryFoldersDesc')}</div></div>
            <Button variant="tonal" icon="create_new_folder" onClick={st.addLibraryFolder}>{t('addFolder')}</Button>
          </div>
          {s.libraryFolders.length === 0 && <div className="text-body-md text-on-surface-variant py-1">{t('noFolders')}</div>}
          {s.libraryFolders.map((f) => (
            <div key={f} className="flex items-center gap-3 h-12 px-3 rounded-xl bg-surface-container-high mb-1.5">
              <Icon name="folder" size={20} className="text-on-surface-variant" />
              <div className="flex-1 min-w-0 truncate text-body-md" title={f}>{f}</div>
              <IconButton icon="close" size="sm" title={t('removeFolder')} onClick={() => st.removeLibraryFolder(f)} />
            </div>
          ))}
        </div>
        <Row title={t('scanNow')}><Button variant="tonal" icon="refresh" onClick={() => void st.syncLibrary(false, true)}>{t('refresh')}</Button></Row>
      </Section>

      <Section title={t('subtitles')} icon="closed_caption">
        <Row title={t('autoSubs')} desc={t('autoSubsDesc')}><Switch checked={s.autoSubs} onChange={(v) => update({ autoSubs: v })} /></Row>
        <Row title={t('subStyleTitle')} desc={t('subStyleDesc')}><Button variant="tonal" icon="text_fields" onClick={() => st.openDialog({ type: 'subs' })}>{t('customize')}</Button></Row>
      </Section>

      <Section title={t('window')} icon="desktop_windows">
        <Row title={t('alwaysOnTop')}><Switch checked={s.alwaysOnTop} onChange={(v) => update({ alwaysOnTop: v })} /></Row>
      </Section>

      <Section title={t('data')} icon="database">
        <Row title={t('clearHistory')} desc={t('clearHistoryText')}>
          <Button variant="text" danger icon="delete_sweep" onClick={() => st.openDialog({ type: 'confirm', title: t('clearHistory'), text: t('clearHistoryText'), confirmLabel: t('clear'), danger: true, onConfirm: st.clearHistory })}>{t('clear')}</Button>
        </Row>
      </Section>

      <Section title={t('about')} icon="info">
        <div className="flex items-center gap-4">
          <Logo size={56} />
          <div>
            <div className="text-title-md">Material Video Player 1.0.0</div>
            <div className="text-body-md text-on-surface-variant">{t('aboutTagline')}</div>
            <div className="text-body-md text-on-surface-variant">{t('author')}: <b className="text-on-surface">minhtrong67</b> · {t('withAi')}</div>
          </div>
        </div>
        <Button variant="tonal" icon="keyboard" onClick={() => st.openDialog({ type: 'shortcuts' })}>{t('shortcuts')}</Button>
      </Section>
    </div>
  );
}
