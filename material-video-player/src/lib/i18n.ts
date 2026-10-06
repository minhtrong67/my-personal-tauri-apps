import type { Lang } from './types';

const en = {
  // general
  loading: 'Loading…', ok: 'OK', cancel: 'Cancel', close: 'Close', done: 'Done', back: 'Back', reset: 'Reset', clear: 'Clear',
  customize: 'Customize', off: 'Off', remove: 'Remove', more: 'More', play: 'Play', minimize: 'Minimize', maximize: 'Maximize',
  // home
  homeTagline: 'A fast, beautiful video player. Drop a video here or open one to get started.',
  welcomeBack: 'Welcome back', dropHint: 'Drag & drop videos, folders or subtitle files anywhere',
  dropTitle: 'Drop to play', dropSub: 'Videos, folders and subtitles are supported',
  openFiles: 'Open video…', openFolder: 'Open folder…', videosFolder: 'Videos folder',
  continueWatching: 'Continue watching', recent: 'Recently opened', removeFromHistory: 'Remove from history',
  clearHistory: 'Clear history', clearHistoryText: 'Recently opened videos and saved playback positions will be removed. Your video files are not deleted.',
  historyCleared: 'History cleared', justNow: 'just now', noVideosFound: 'No supported video files found',
  // list/grid, playlist panel, context menu
  viewList: 'List view', viewGrid: 'Grid view', pause: 'Pause', nSeconds: '{n} s', skip: 'Skip', skipBack: 'Rewind {n}', skipForward: 'Fast-forward {n}', goStart: 'Go to start',
  showPlaylist: 'Show playlist', hidePlaylist: 'Hide playlist', repOff: 'Off', repAll: 'All', repOne: 'One video', subSettings: 'Subtitle settings…',
  subDelayDec: 'Subtitle delay −0.1 s', subDelayInc: 'Subtitle delay +0.1 s', audio: 'Audio', video: 'Video', boostN: 'Volume boost {n}%', resetAdjust: 'Reset adjustments',
  copyFrame: 'Copy frame to clipboard', frameCopied: 'Frame copied to clipboard', copyFailed: 'Could not copy', file: 'File', copyPath: 'Copy file path', pathCopied: 'File path copied',
  closeVideo: 'Close video', playNext: 'Play next', removeFromQueue: 'Remove from playlist', searchQueue: 'Search in playlist…', noMatches: 'No matching videos',
  // library
  home: 'Home', library: 'Library', refresh: 'Refresh', refreshLibrary: 'Refresh library (rescan Videos folder)', scanning: 'Scanning…',
  searchLibrary: 'Search videos…', sortDate: 'Date modified', sortName: 'Name', sortSize: 'Size', noResults: 'No videos match your search',
  libraryEmpty: 'No videos in your library yet', libraryEmptyDesc: 'Material Video Player scans your Windows Videos folder automatically. Add more folders to build your library.',
  addFolder: 'Add folder', libAdded: '{n} added', libUpdated: '{n} updated', libRemoved: '{n} removed', libUpToDate: 'Library is up to date',
  folderAlreadyAdded: 'This folder is already in your library', folderRemoved: 'Folder removed from the library',
  autoScanVideos: 'Scan the Windows Videos folder automatically', autoScanVideosDesc: 'On startup, add new videos, update changed ones and remove videos you deleted from the disk',
  libraryFolders: 'Extra library folders', libraryFoldersDesc: 'Folders scanned in addition to the Videos folder (including sub-folders)', noFolders: 'No extra folders added', removeFolder: 'Remove folder', scanNow: 'Scan now',
  // player
  playPause: 'Play / Pause', previous: 'Previous', next: 'Next', mute: 'Mute', volume: 'Volume', speed: 'Playback speed',
  shuffle: 'Shuffle', repeat: 'Repeat', subtitles: 'Subtitles', queue: 'Playlist', miniPlayer: 'Mini player', exitMini: 'Exit mini player',
  fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen', screenshot: 'Take screenshot', videoAdjust: 'Video adjustments',
  audioFx: 'Audio effects', alwaysOnTop: 'Always on top', fileInfo: 'Video info', shortcuts: 'Keyboard shortcuts',
  loopSetA: 'A-B loop: set start (A)', loopSetB: 'A-B loop: set end (B)', loopClear: 'A-B loop: clear', loopCleared: 'A-B loop cleared',
  resumedAt: 'Resumed at {time}', startOver: 'Start over',
  screenshotSaved: 'Screenshot saved to Pictures\\Material Video Player', screenshotFailed: 'Could not capture a screenshot', showInFolder: 'Show in folder',
  nVideos: '{n} videos', clearQueue: 'Clear', 
  cannotPlay: 'This video can’t be played', errDecode: 'The video could not be decoded. The file may be damaged or use an unsupported codec.',
  errFormat: 'The format or codec is not supported by the built-in player (WebView2). Try opening it with your default app.',
  errNetwork: 'The file could not be read. Check that it still exists and is accessible.', errUnknown: 'An unknown playback error occurred.',
  openDefaultApp: 'Open with default app', skipNext: 'Skip to next',
  // subtitles
  noSubs: 'No subtitles found for this video', subsOff: 'Subtitles off', loadSubtitle: 'Load subtitle file…',
  subEmpty: 'The subtitle file has no readable cues', subFailed: 'Could not read the subtitle file',
  subDelay: 'Subtitle delay', subSize: 'Size', subPosition: 'Vertical position', subColor: 'Text color', subBackground: 'Background',
  bgNone: 'None', bgShadow: 'Shadow', bgBox: 'Box', subOpacity: 'Box opacity', subPreview: 'Subtitle preview — Xin chào!',
  // adjustments
  aspectFit: 'Picture fit', fitContain: 'Fit', fitCover: 'Fill (crop)', fitFill: 'Stretch', brightness: 'Brightness', contrast: 'Contrast',
  saturation: 'Saturation', hue: 'Hue', zoom: 'Zoom', rotateLeft: 'Rotate left', rotateRight: 'Rotate right', flipH: 'Flip horizontal', flipV: 'Flip vertical',
  // audio
  volumeBoost: 'Volume boost', nightMode: 'Night mode', nightModeDesc: 'Compresses loud sounds so dialogue stays clear at low volume',
  fxUnavailable: 'Audio effects are unavailable in this environment.',
  // sleep
  sleepTimer: 'Sleep timer', nMinutes: '{n} min', afterThisVideo: 'After this video', turnOff: 'Turn off',
  sleepEndOfVideo: 'Playback will stop after this video', sleepRemaining: 'Playback stops in {time}', sleepDone: 'Playback stopped by the sleep timer',
  // info
  name: 'Name', path: 'Path', fileSize: 'Size', duration: 'Duration', resolution: 'Resolution', frameRate: 'Frame rate', modified: 'Modified',
  // settings
  settings: 'Settings', appearance: 'Appearance', language: 'Language', langAuto: 'Automatic', theme: 'Theme', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark',
  themeColor: 'Theme color', themeColorDesc: 'Material 3 builds the whole palette from this color', customColor: 'Custom color',
  playback: 'Playback', resumePlayback: 'Resume playback', resumePlaybackDesc: 'Continue from where you left off',
  autoQueue: 'Queue other videos in the folder', autoQueueDesc: 'Opening one file also adds the other videos next to it to the playlist',
  seekStep: 'Arrow-key seek step', hideControls: 'Hide controls after',
  autoSubs: 'Load subtitles automatically', autoSubsDesc: 'Uses .srt, .vtt, .ass files next to the video (prefers your language)',
  subStyleTitle: 'Subtitle style', subStyleDesc: 'Size, color, background and position', window: 'Window', data: 'Data',
  about: 'About', aboutTagline: 'Material Design 3 video player for Windows', author: 'Author', withAi: 'built with the support of the AI assistant Claude',
  // shortcuts
  scPlay: 'Play / Pause', scSeek: 'Seek backward / forward', scSeekBig: 'Seek 10 seconds', scVolume: 'Volume up / down', scMute: 'Mute',
  scFullscreen: 'Fullscreen', scSpeed: 'Slower / faster', scFrame: 'Previous / next frame', scNextPrev: 'Next / previous video',
  scSubs: 'Cycle / toggle subtitles', scSubDelay: 'Subtitle delay − / +', scLoop: 'A-B loop (set A, set B, clear)', scShot: 'Screenshot',
  scQueue: 'Playlist', scRotate: 'Rotate 90°', scMini: 'Mini player', scPercent: 'Jump to 0–90 %', scOpen: 'Open file (Shift: folder)', scInfo: 'Video info', scExit: 'Exit fullscreen / mini player',
};

export type Key = keyof typeof en;

const vi: Record<Key, string> = {
  loading: 'Đang tải…', ok: 'OK', cancel: 'Hủy', close: 'Đóng', done: 'Xong', back: 'Quay lại', reset: 'Đặt lại', clear: 'Xóa',
  customize: 'Tùy chỉnh', off: 'Tắt', remove: 'Bỏ', more: 'Thêm', play: 'Phát', minimize: 'Thu nhỏ', maximize: 'Phóng to',
  homeTagline: 'Trình phát video nhanh và đẹp. Kéo thả video vào đây hoặc mở một video để bắt đầu.',
  welcomeBack: 'Chào mừng trở lại', dropHint: 'Kéo thả video, thư mục hoặc tệp phụ đề vào bất kỳ đâu',
  dropTitle: 'Thả để phát', dropSub: 'Hỗ trợ video, thư mục và phụ đề',
  openFiles: 'Mở video…', openFolder: 'Mở thư mục…', videosFolder: 'Thư mục Video',
  continueWatching: 'Xem tiếp', recent: 'Mở gần đây', removeFromHistory: 'Xóa khỏi lịch sử',
  clearHistory: 'Xóa lịch sử', clearHistoryText: 'Danh sách video mở gần đây và vị trí xem dở sẽ bị xóa. Tệp video của bạn không bị xóa.',
  historyCleared: 'Đã xóa lịch sử', justNow: 'vừa xong', noVideosFound: 'Không tìm thấy tệp video được hỗ trợ',
  viewList: 'Dạng danh sách', viewGrid: 'Dạng ô', pause: 'Tạm dừng', nSeconds: '{n} giây', skip: 'Tua nhanh', skipBack: 'Tua lùi {n}', skipForward: 'Tua tới {n}', goStart: 'Về đầu video',
  showPlaylist: 'Hiện danh sách phát', hidePlaylist: 'Ẩn danh sách phát', repOff: 'Tắt', repAll: 'Tất cả', repOne: 'Một video', subSettings: 'Cài đặt phụ đề…',
  subDelayDec: 'Giảm độ trễ phụ đề 0,1 giây', subDelayInc: 'Tăng độ trễ phụ đề 0,1 giây', audio: 'Âm thanh', video: 'Hình ảnh', boostN: 'Khuếch đại âm lượng {n}%', resetAdjust: 'Đặt lại chỉnh sửa',
  copyFrame: 'Sao chép khung hình', frameCopied: 'Đã sao chép khung hình', copyFailed: 'Không sao chép được', file: 'Tệp', copyPath: 'Sao chép đường dẫn', pathCopied: 'Đã sao chép đường dẫn',
  closeVideo: 'Đóng video', playNext: 'Phát tiếp theo', removeFromQueue: 'Xóa khỏi danh sách phát', searchQueue: 'Tìm trong danh sách phát…', noMatches: 'Không có video nào khớp',
  home: 'Trang chủ', library: 'Thư viện', refresh: 'Làm mới', refreshLibrary: 'Làm mới thư viện (quét lại thư mục Videos)', scanning: 'Đang quét…',
  searchLibrary: 'Tìm video…', sortDate: 'Ngày sửa đổi', sortName: 'Tên', sortSize: 'Dung lượng', noResults: 'Không có video nào khớp với tìm kiếm',
  libraryEmpty: 'Thư viện chưa có video nào', libraryEmptyDesc: 'Material Video Player tự quét thư mục Videos của Windows. Hãy thêm thư mục khác để xây dựng thư viện.',
  addFolder: 'Thêm thư mục', libAdded: 'thêm {n}', libUpdated: 'cập nhật {n}', libRemoved: 'xóa {n}', libUpToDate: 'Thư viện đã được cập nhật',
  folderAlreadyAdded: 'Thư mục này đã có trong thư viện', folderRemoved: 'Đã gỡ thư mục khỏi thư viện',
  autoScanVideos: 'Tự động quét thư mục Videos của Windows', autoScanVideosDesc: 'Khi mở app: thêm video mới, cập nhật video đã đổi và xóa video bạn đã xóa khỏi máy',
  libraryFolders: 'Thư mục thư viện bổ sung', libraryFoldersDesc: 'Các thư mục được quét thêm ngoài thư mục Videos (gồm cả thư mục con)', noFolders: 'Chưa thêm thư mục nào', removeFolder: 'Gỡ thư mục', scanNow: 'Quét ngay',
  playPause: 'Phát / Tạm dừng', previous: 'Trước', next: 'Tiếp', mute: 'Tắt tiếng', volume: 'Âm lượng', speed: 'Tốc độ phát',
  shuffle: 'Ngẫu nhiên', repeat: 'Lặp lại', subtitles: 'Phụ đề', queue: 'Danh sách phát', miniPlayer: 'Trình phát mini', exitMini: 'Thoát trình phát mini',
  fullscreen: 'Toàn màn hình', exitFullscreen: 'Thoát toàn màn hình', screenshot: 'Chụp ảnh màn hình', videoAdjust: 'Chỉnh hình ảnh',
  audioFx: 'Hiệu ứng âm thanh', alwaysOnTop: 'Luôn ở trên cùng', fileInfo: 'Thông tin video', shortcuts: 'Phím tắt',
  loopSetA: 'Lặp A-B: đặt điểm đầu (A)', loopSetB: 'Lặp A-B: đặt điểm cuối (B)', loopClear: 'Lặp A-B: xóa', loopCleared: 'Đã xóa lặp A-B',
  resumedAt: 'Tiếp tục từ {time}', startOver: 'Xem từ đầu',
  screenshotSaved: 'Đã lưu ảnh vào Pictures\\Material Video Player', screenshotFailed: 'Không chụp được ảnh màn hình', showInFolder: 'Hiện trong thư mục',
  nVideos: '{n} video', clearQueue: 'Xóa',
  cannotPlay: 'Không thể phát video này', errDecode: 'Không giải mã được video. Tệp có thể bị hỏng hoặc dùng codec không được hỗ trợ.',
  errFormat: 'Định dạng hoặc codec không được trình phát tích hợp (WebView2) hỗ trợ. Hãy thử mở bằng ứng dụng mặc định.',
  errNetwork: 'Không đọc được tệp. Hãy kiểm tra tệp còn tồn tại và truy cập được.', errUnknown: 'Đã xảy ra lỗi phát không xác định.',
  openDefaultApp: 'Mở bằng ứng dụng mặc định', skipNext: 'Qua video tiếp theo',
  noSubs: 'Không tìm thấy phụ đề cho video này', subsOff: 'Đã tắt phụ đề', loadSubtitle: 'Tải tệp phụ đề…',
  subEmpty: 'Tệp phụ đề không có nội dung đọc được', subFailed: 'Không đọc được tệp phụ đề',
  subDelay: 'Độ trễ phụ đề', subSize: 'Cỡ chữ', subPosition: 'Vị trí theo chiều dọc', subColor: 'Màu chữ', subBackground: 'Nền',
  bgNone: 'Không', bgShadow: 'Đổ bóng', bgBox: 'Hộp', subOpacity: 'Độ đậm của hộp', subPreview: 'Xem trước phụ đề — Hello!',
  aspectFit: 'Cách hiển thị hình', fitContain: 'Vừa khung', fitCover: 'Lấp đầy (cắt)', fitFill: 'Kéo giãn', brightness: 'Độ sáng', contrast: 'Độ tương phản',
  saturation: 'Độ bão hòa', hue: 'Sắc độ', zoom: 'Thu phóng', rotateLeft: 'Xoay trái', rotateRight: 'Xoay phải', flipH: 'Lật ngang', flipV: 'Lật dọc',
  volumeBoost: 'Khuếch đại âm lượng', nightMode: 'Chế độ ban đêm', nightModeDesc: 'Nén âm thanh lớn để lời thoại vẫn rõ khi nghe nhỏ',
  fxUnavailable: 'Hiệu ứng âm thanh không khả dụng trong môi trường này.',
  sleepTimer: 'Hẹn giờ tắt', nMinutes: '{n} phút', afterThisVideo: 'Sau video này', turnOff: 'Tắt',
  sleepEndOfVideo: 'Sẽ dừng phát sau video này', sleepRemaining: 'Còn {time} nữa sẽ dừng phát', sleepDone: 'Đã dừng phát theo hẹn giờ',
  name: 'Tên', path: 'Đường dẫn', fileSize: 'Dung lượng', duration: 'Thời lượng', resolution: 'Độ phân giải', frameRate: 'Tốc độ khung hình', modified: 'Sửa đổi',
  settings: 'Cài đặt', appearance: 'Giao diện', language: 'Ngôn ngữ', langAuto: 'Tự động', theme: 'Chủ đề', themeSystem: 'Hệ thống', themeLight: 'Sáng', themeDark: 'Tối',
  themeColor: 'Màu chủ đề', themeColorDesc: 'Material 3 tạo toàn bộ bảng màu từ màu này', customColor: 'Màu tùy chọn',
  playback: 'Phát video', resumePlayback: 'Xem tiếp từ vị trí cũ', resumePlaybackDesc: 'Tiếp tục từ chỗ bạn đã xem dở',
  autoQueue: 'Thêm các video khác trong thư mục', autoQueueDesc: 'Mở một tệp sẽ tự thêm các video nằm cạnh nó vào danh sách phát',
  seekStep: 'Bước tua bằng phím mũi tên', hideControls: 'Ẩn thanh điều khiển sau',
  autoSubs: 'Tự động tải phụ đề', autoSubsDesc: 'Dùng tệp .srt, .vtt, .ass nằm cạnh video (ưu tiên ngôn ngữ của bạn)',
  subStyleTitle: 'Kiểu phụ đề', subStyleDesc: 'Cỡ chữ, màu sắc, nền và vị trí', window: 'Cửa sổ', data: 'Dữ liệu',
  about: 'Giới thiệu', aboutTagline: 'Trình phát video Material Design 3 cho Windows', author: 'Tác giả', withAi: 'với sự hỗ trợ của trợ lý AI Claude',
  scPlay: 'Phát / Tạm dừng', scSeek: 'Tua lùi / tới', scSeekBig: 'Tua 10 giây', scVolume: 'Tăng / giảm âm lượng', scMute: 'Tắt tiếng',
  scFullscreen: 'Toàn màn hình', scSpeed: 'Chậm hơn / nhanh hơn', scFrame: 'Khung hình trước / sau', scNextPrev: 'Video tiếp / trước',
  scSubs: 'Đổi / bật tắt phụ đề', scSubDelay: 'Độ trễ phụ đề − / +', scLoop: 'Lặp A-B (đặt A, đặt B, xóa)', scShot: 'Chụp ảnh màn hình',
  scQueue: 'Danh sách phát', scRotate: 'Xoay 90°', scMini: 'Trình phát mini', scPercent: 'Nhảy tới 0–90 %', scOpen: 'Mở tệp (Shift: thư mục)', scInfo: 'Thông tin video', scExit: 'Thoát toàn màn hình / mini',
};

const dicts = { en, vi };

export type ActiveLang = 'en' | 'vi';

export function resolveLang(l: Lang): ActiveLang {
  if (l === 'auto') return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  return l;
}

let active: ActiveLang = resolveLang('auto');
export const setActiveLang = (l: Lang) => {
  active = resolveLang(l);
};

/** Translate (outside React). `lang` overrides the active language. */
export function tr(key: Key, vars?: Record<string, string | number>, lang: ActiveLang = active): string {
  let s: string = dicts[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}
