import { PageHeader } from '../components/Collection';
import { Button, Icon, Segmented, Switch } from '../components/ui';
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
    <div className="flex items-center justify-between gap-6">
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
    <div className="h-full overflow-y-auto pb-8">
      <PageHeader title="Cài đặt" />
      <Section title="Giao diện" icon="palette">
        <Row title="Chế độ màu"><Segmented value={s.themeMode} onChange={(v) => update({ themeMode: v })} options={[{ value: 'system', label: 'Hệ thống', icon: 'brightness_auto' }, { value: 'light', label: 'Sáng', icon: 'light_mode' }, { value: 'dark', label: 'Tối', icon: 'dark_mode' }]} /></Row>
        <Row title="Màu chủ đạo" desc="Material 3 sinh toàn bộ bảng màu từ màu này">
          <div className="flex items-center gap-2">
            {SEED_PRESETS.map((c) => (
              <button key={c} aria-label={c} onClick={() => update({ seedColor: c })} style={{ background: c }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${s.seedColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-on-surface' : ''}`}>
                {s.seedColor.toLowerCase() === c.toLowerCase() && <Icon name="check" size={18} className="text-white" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-outline flex items-center justify-center cursor-pointer hover:bg-on-surface/[.08]" title="Màu tùy chọn">
              <Icon name="colorize" size={18} /><input type="color" className="sr-only" value={s.seedColor} onChange={(e) => update({ seedColor: e.target.value })} />
            </label>
          </div>
        </Row>
        <Row title="Màu động theo ảnh bìa" desc="Giao diện đổi màu theo ảnh bìa bài hát đang phát"><Switch checked={s.dynamicColor} onChange={(v) => update({ dynamicColor: v })} /></Row>
      </Section>

      <Section title="Phát nhạc" icon="graphic_eq">
        <Row title="Khôi phục phiên trước" desc="Mở lại hàng chờ và vị trí đang nghe khi khởi động"><Switch checked={s.restoreSession} onChange={(v) => update({ restoreSession: v })} /></Row>
        <Row title="Âm thanh & Equalizer" desc="Tốc độ phát, EQ 10 băng tần"><Button variant="tonal" icon="tune" onClick={() => st.openDialog({ type: 'audio' })}>Mở</Button></Row>
        <Row title="Hẹn giờ tắt nhạc"><Button variant="tonal" icon="bedtime" onClick={() => st.openDialog({ type: 'sleep' })}>Đặt giờ</Button></Row>
      </Section>

      <Section title="Hệ thống" icon="desktop_windows">
        <Row title="Thu nhỏ xuống khay hệ thống" desc="Nút đóng cửa sổ sẽ ẩn app xuống khay, nhạc vẫn phát"><Switch checked={s.closeToTray} onChange={(v) => update({ closeToTray: v })} /></Row>
        <Row title="Luôn hiển thị trên cùng"><Switch checked={s.alwaysOnTop} onChange={(v) => update({ alwaysOnTop: v })} /></Row>
      </Section>

      <Section title="Thư viện" icon="library_music">
        <Row title="Tự động quét thư mục Music của Windows" desc="Khi mở app: thêm bài mới, cập nhật bài đã đổi và xóa bài đã bị xóa khỏi máy"><Switch checked={s.autoScanMusic} onChange={(v) => update({ autoScanMusic: v })} /></Row>
        <div className="text-body-md text-on-surface-variant">{all.length} bài hát • {albums.length} album • {artists.length} nghệ sĩ • {playlists.length} playlist • {fmtSize(size)}</div>
        <div className="flex flex-wrap gap-2">
          <Button icon="create_new_folder" onClick={st.importFolder}>Thêm thư mục</Button>
          <Button icon="audio_file" variant="tonal" onClick={st.importFiles}>Thêm tệp</Button>
          <Button icon="sync" variant="tonal" onClick={() => st.syncLibrary(false, true)}>Quét lại thư viện</Button>
          <Button icon="link_off" variant="tonal" onClick={st.removeMissing}>Xóa tệp bị thiếu</Button>
          <Button icon="download" variant="outlined" onClick={st.backup}>Sao lưu</Button>
          <Button icon="upload" variant="outlined" onClick={st.restore}>Khôi phục</Button>
          <Button icon="delete_forever" variant="text" danger onClick={() => st.openDialog({ type: 'confirm', title: 'Xóa toàn bộ thư viện?', text: 'Toàn bộ bài hát, playlist, lượt nghe và yêu thích sẽ bị xóa khỏi Melodia. Tệp nhạc trên máy không bị ảnh hưởng.', confirmLabel: 'Xóa tất cả', danger: true, onConfirm: st.clearLibrary })}>Xóa thư viện</Button>
        </div>
      </Section>

      <Section title="Giới thiệu" icon="info">
        <div className="flex items-center gap-4">
          <img src="/icon.png" alt="" className="w-14 h-14 rounded-2xl" />
          <div>
            <div className="text-title-md">Melodia 1.0.0</div>
            <div className="text-body-md text-on-surface-variant">Trình phát nhạc cho Windows • Tauri 2 + React • Material Design 3</div>
            <div className="text-body-md text-on-surface-variant">Tác giả: minhtrong67, với sự hỗ trợ của Claude</div>
          </div>
        </div>
        <Button variant="tonal" icon="keyboard" onClick={() => st.openDialog({ type: 'shortcuts' })}>Phím tắt</Button>
      </Section>
    </div>
  );
}
