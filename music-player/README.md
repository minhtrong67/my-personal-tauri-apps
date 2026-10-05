# Melodia – Trình phát nhạc (Tauri 2 + React + Material Design 3)

Ứng dụng nghe nhạc local cho Windows. Giao diện Material Design 3 (màu động, state layer, bo góc, slider, dialog, snackbar…).
Tác giả: **minhtrong67**, với sự hỗ trợ của Claude.

## Tính năng

**Thư viện & nhập nhạc**
- Nhập **thư mục** (quét đệ quy) → tự tạo playlist theo tên thư mục, có nút *Quét lại* để đồng bộ
- Nhập nhiều tệp, **kéo thả** tệp/thư mục vào cửa sổ, **Mở bằng Melodia** từ Explorer (mp3, flac, wav, ogg, opus, m4a, aac)
- Đọc thẻ ID3/Vorbis/MP4 (tên, nghệ sĩ, album, năm, thể loại, track, bitrate…) bằng `lofty`, ảnh bìa nhúng hoặc `cover.jpg` cạnh bài
- Duyệt theo Bài hát / Album / Nghệ sĩ / Playlist / Yêu thích / Gần đây, tìm kiếm không dấu (Ctrl+F)
- **Tự động quét thư mục Music của Windows** mỗi khi mở app (bật/tắt trong Cài đặt): thêm bài mới, cập nhật bài đã đổi, và **xóa khỏi thư viện những bài đã bị xóa trên máy** (bỏ qua nếu cả ổ đĩa đang không kết nối, tránh mất dữ liệu nhầm)
- Nhập lại bài đã có sẽ **ghi đè** (nhận diện theo đường dẫn tệp), không bao giờ tạo bản sao
- Nút **Làm mới** (⟳ trên thanh tiêu đề, hoặc phím `F5`) quét lại thư mục Music và các thư mục đã nhập ngay lập tức
- Mỗi tab (Bài hát, Album, Nghệ sĩ, Playlist, Yêu thích, Gần đây, trang chi tiết album/nghệ sĩ/playlist) có nút chuyển **dạng danh sách / dạng ô**, app nhớ lựa chọn cho từng tab
- Danh sách ảo hoá, chạy mượt với hàng chục nghìn bài
- Sao lưu / khôi phục thư viện (JSON), xóa tệp bị thiếu, xóa thư viện

**Phát nhạc**
- Phát/tạm dừng, trước/sau, tua, âm lượng, ngẫu nhiên, lặp (tắt/tất cả/một bài)
- Hàng chờ: phát tiếp theo, thêm vào hàng chờ, kéo thả sắp xếp, xóa
- Playlist: tạo/đổi tên/xóa, kéo thả sắp xếp, xuất/nhập **M3U/M3U8**
- Equalizer 10 băng tần + preamp + preset, tốc độ phát 0.5×–2×
- Hẹn giờ tắt nhạc (15–120 phút hoặc hết bài)
- Lời bài hát đồng bộ (.lrc cùng tên hoặc lời nhúng), bấm vào dòng để tua
- Visualizer phổ âm thanh, màn hình *Đang phát* toàn khung, **Mini player** luôn trên cùng
- Phím media của Windows + điều khiển trong overlay hệ thống (Media Session)
- Khôi phục hàng chờ và vị trí đang nghe khi mở lại

**Hệ thống**
- Thanh tiêu đề tuỳ biến, khay hệ thống (phát/dừng/trước/sau), tuỳ chọn đóng cửa sổ → thu xuống khay
- Chỉ chạy một cửa sổ (mở tệp mới sẽ gửi vào cửa sổ đang chạy)
- Chủ đề sáng/tối/hệ thống, chọn màu chủ đạo, **màu động theo ảnh bìa**

## Phím tắt
`Space` phát/dừng · `Ctrl+←/→` bài trước/sau · `←/→` tua 5s · `↑/↓` âm lượng · `M` tắt tiếng · `S` ngẫu nhiên · `R` lặp · `L` yêu thích · `Q` hàng chờ · `N` màn hình đang phát · `Ctrl+F` tìm kiếm · `F5` làm mới thư viện

## Cài đặt vào workspace `tauri-apps`

1. Giải nén để có thư mục `tauri-apps/music-player/`
2. Mở `tauri-apps/Cargo.toml`, thêm vào `members`:
   ```toml
   members = ["case-converter/src-tauri", "csv-viewer-tauri/src-tauri", "readme-viewer/src-tauri", "music-player/src-tauri"]
   ```
   (giữ nguyên các mục sẵn có của bạn, chỉ thêm `"music-player/src-tauri"`)
3. Chạy:
   ```bash
   cd tauri-apps/music-player
   npm install
   npm run tauri dev      # chạy thử
   npm run tauri build    # đóng gói bộ cài NSIS (.exe)
   ```
Yêu cầu: Node 18+, Rust stable, WebView2 (có sẵn trên Windows 10/11).

## Cấu trúc
```
music-player/
├─ src/                 # React + TypeScript + Tailwind
│  ├─ lib/              # store (zustand), audio engine, theme MD3, tauri bridge, lrc, m3u
│  ├─ components/       # TitleBar, NavDrawer, PlayerBar, NowPlaying, QueuePanel, Dialogs…
│  └─ views/            # Library (home/songs/albums/…), Settings
└─ src-tauri/           # Rust: quét thư viện, đọc tag/ảnh bìa/lời, khay hệ thống, lưu dữ liệu
```
Dữ liệu người dùng lưu tại `%APPDATA%\com.minhtrong67.melodia\library.json`.

## Ghi chú
- Giao thức `asset:` được cấp quyền đọc mọi đường dẫn để phát nhạc từ bất kỳ thư mục nào (xem `tauri.conf.json`).
- Nếu WebView không cho phép CORS với tệp cục bộ, app tự chuyển sang phát trực tiếp: nhạc vẫn nghe bình thường nhưng EQ/visualizer thật bị tắt (visualizer chuyển sang hiệu ứng mô phỏng).
- Đổi icon app: thay `src-tauri/icons/icon.png` (1024×1024) rồi chạy `npm run tauri icon src-tauri/icons/icon.png`.
- Icon của bộ cài và trình gỡ cài đặt (uninstall.exe) là `src-tauri/icons/installer.ico` (khai báo trong `bundle.windows.nsis`). Muốn đổi, thay file này bằng ICO mới.
