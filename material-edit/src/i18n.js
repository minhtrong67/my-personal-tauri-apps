// Tiny i18n layer: English + Vietnamese.
const en = {
  'menu.file': 'Menu', 'project.untitled': 'Untitled project',
  'file.new': 'New project', 'file.open': 'Open project…', 'file.save': 'Save project', 'file.saveAs': 'Save project as…',
  'file.import': 'Import media…', 'file.export': 'Export video…', 'file.exit': 'Exit',
  'export.button': 'Export',
  'tab.media': 'Media', 'tab.text': 'Text', 'tab.effects': 'Effects', 'tab.transitions': 'Transitions',
  'empty.hint': 'Import videos, photos or music to get started',
  'timeline.hint': 'Drop media here or press + on a media card',

  'tip.undo': 'Undo (Ctrl+Z)', 'tip.redo': 'Redo (Ctrl+Y)', 'tip.theme': 'Switch theme', 'tip.settings': 'Settings',
  'tip.first': 'Go to start (Home)', 'tip.last': 'Go to end (End)', 'tip.stepBack': 'Previous frame (←)', 'tip.stepFwd': 'Next frame (→)',
  'tip.play': 'Play / Pause (Space)', 'tip.volume': 'Preview volume',
  'tip.split': 'Split at playhead (S)', 'tip.duplicate': 'Duplicate (Ctrl+D)', 'tip.delete': 'Delete (Del)', 'tip.snap': 'Snapping',
  'tip.zoomIn': 'Zoom in', 'tip.zoomOut': 'Zoom out', 'tip.fit': 'Fit timeline',

  'media.import': 'Import media', 'media.empty': 'No media yet. Import files or drop them here.',
  'media.offline': '{n} file(s) are offline. Import the original files again to relink them.',
  'media.add': 'Add to timeline', 'media.addOverlay': 'Add as overlay', 'media.tip': 'Tip: drag a card onto the timeline, or double-click to append it.',
  'btn.remove': 'Remove', 'btn.cancel': 'Cancel', 'btn.done': 'Done', 'btn.close': 'Close',

  'text.add': 'Add text',
  'textpreset.basic': 'Basic', 'textpreset.title': 'Title', 'textpreset.subtitle': 'Subtitle', 'textpreset.caption': 'Caption',
  'textpreset.outline': 'Outline', 'textpreset.neon': 'Neon', 'textpreset.typewriter': 'Typewriter', 'textpreset.yellow': 'Highlight',
  'textpreset.basic.sample': 'Text', 'textpreset.title.sample': 'Title', 'textpreset.subtitle.sample': 'Subtitle', 'textpreset.caption.sample': 'Caption',
  'textpreset.outline.sample': 'Outline', 'textpreset.neon.sample': 'NEON', 'textpreset.typewriter.sample': 'Typing…', 'textpreset.yellow.sample': 'Highlight',

  'effects.select': 'Select a video or image clip, then pick a look.', 'effects.apply': 'Click a look to apply it to the selected clip.',
  'filter.none': 'None', 'filter.vivid': 'Vivid', 'filter.bw': 'Black & white', 'filter.warm': 'Warm', 'filter.cool': 'Cool',
  'filter.vintage': 'Vintage', 'filter.fade': 'Fade', 'filter.dramatic': 'Dramatic', 'filter.custom': 'Custom',
  'trans.select': 'Select a clip on the main track (not the first one) to add a transition before it.', 'trans.apply': 'Click a transition to apply it before the selected clip.',
  'trans.applyAll': 'Apply to all clips',
  'trans.none': 'None', 'trans.fade': 'Fade', 'trans.slide': 'Slide', 'trans.slideup': 'Slide up', 'trans.wipe': 'Wipe', 'trans.zoom': 'Zoom', 'trans.dip': 'Dip to black',
  'anim.none': 'None', 'anim.fade': 'Fade', 'anim.pop': 'Pop', 'anim.slideup': 'Slide up', 'anim.typewriter': 'Typewriter',

  'insp.project': 'Project', 'insp.aspect': 'Aspect ratio', 'insp.fps': 'Frame rate', 'insp.background': 'Background',
  'insp.summary': 'Length {d}s · {n} clip(s)', 'insp.hintSelect': 'Select a clip on the timeline or the preview to edit it.',
  'insp.clip': 'Clip', 'insp.overlay': 'Overlay', 'insp.textClip': 'Text', 'insp.audioClip': 'Audio',
  'insp.basic': 'Basic', 'insp.filters': 'Filters', 'insp.presets': 'Looks', 'insp.reset': 'Reset',
  'insp.start': 'Start (s)', 'insp.duration': 'Duration (s)', 'insp.speed': 'Speed', 'insp.transform': 'Transform',
  'insp.opacity': 'Opacity', 'insp.fit': 'Fit', 'fit.contain': 'Fit', 'fit.cover': 'Fill', 'fit.blur': 'Blur',
  'insp.scale': 'Scale', 'insp.rotation': 'Rotation', 'insp.posX': 'Position X', 'insp.posY': 'Position Y',
  'insp.flipH': 'Flip horizontal', 'insp.flipV': 'Flip vertical', 'insp.fadeIn': 'Fade in', 'insp.fadeOut': 'Fade out',
  'insp.audio': 'Audio', 'insp.volume': 'Volume', 'insp.mute': 'Mute',
  'insp.transition': 'Transition', 'insp.transFirst': 'The first clip has no transition.', 'insp.type': 'Type', 'insp.transDur': 'Duration',
  'insp.brightness': 'Brightness', 'insp.contrast': 'Contrast', 'insp.saturation': 'Saturation', 'insp.hue': 'Hue',
  'insp.blur': 'Blur', 'insp.gray': 'Grayscale', 'insp.sepia': 'Sepia', 'insp.vignette': 'Vignette',
  'insp.font': 'Font', 'insp.size': 'Size', 'insp.color': 'Color', 'insp.style': 'Style', 'insp.align': 'Align', 'insp.anim': 'Animation',
  'insp.appearance': 'Appearance', 'insp.bgBox': 'Background box', 'insp.bgColor': 'Box color', 'insp.bgOpacity': 'Box opacity',
  'insp.outline': 'Outline', 'insp.outlineColor': 'Outline color', 'insp.shadow': 'Shadow',

  'export.title': 'Export video', 'export.format': 'Format', 'export.resolution': 'Resolution', 'export.fps': 'Frame rate', 'export.quality': 'Quality',
  'export.q.standard': 'Standard', 'export.q.high': 'High', 'export.q.max': 'Maximum',
  'export.mp4ffmpeg': 'MP4 (H.264, via FFmpeg)', 'export.start': 'Start export',
  'export.summary': '{w}×{h} · {d} · about {mb} MB',
  'export.note': 'Exporting records the timeline in real time, so it takes as long as the video. Keep the window visible while it runs.',
  'export.recording': 'Recording…', 'export.saving': 'Saving file…', 'export.converting': 'Converting to MP4…', 'export.keepOpen': 'Please keep this window open.',
  'export.done': 'Export complete', 'export.savedTo': 'Saved to {path}', 'export.failed': 'Export failed', 'export.cancelled': 'Export cancelled',
  'export.empty': 'Add something to the timeline first.', 'export.unsupported': 'This system cannot record video (MediaRecorder is unavailable).',

  'settings.title': 'Settings', 'settings.theme': 'Theme', 'theme.light': 'Light', 'theme.dark': 'Dark', 'theme.system': 'System',
  'settings.accent': 'Accent color', 'settings.customColor': 'Custom color', 'settings.language': 'Language', 'lang.auto': 'Automatic (system)',
  'settings.about': 'About', 'about.credit': 'Created by minhtrong67 with the help of Claude (AI by Anthropic).',

  'confirm.title': 'Save changes?', 'confirm.msg': '“{name}” has unsaved changes. Do you want to save them?', 'confirm.save': 'Save', 'confirm.discard': "Don't save",
  'draft.title': 'Restore unsaved project?', 'draft.msg': 'Material Edit found an unsaved project from your last session. Media files must be imported again to relink.',
  'draft.restore': 'Restore', 'draft.discard': 'Discard',

  'toast.saved': 'Saved “{name}”', 'toast.opened': 'Opened “{name}”', 'toast.openedOffline': 'Project opened. Import the original media again to relink {n} file(s).',
  'toast.error': 'Something went wrong: {msg}', 'toast.splitNone': 'Move the playhead over a clip to split it.',
  'toast.importing': 'Importing {n} file(s)…', 'toast.imported': 'Imported {n} file(s)', 'toast.importFailed': 'Could not import: {names}',
};

const vi = {
  'menu.file': 'Menu', 'project.untitled': 'Dự án chưa đặt tên',
  'file.new': 'Dự án mới', 'file.open': 'Mở dự án…', 'file.save': 'Lưu dự án', 'file.saveAs': 'Lưu dự án thành…',
  'file.import': 'Nhập media…', 'file.export': 'Xuất video…', 'file.exit': 'Thoát',
  'export.button': 'Xuất video',
  'tab.media': 'Media', 'tab.text': 'Văn bản', 'tab.effects': 'Hiệu ứng', 'tab.transitions': 'Chuyển cảnh',
  'empty.hint': 'Nhập video, ảnh hoặc nhạc để bắt đầu',
  'timeline.hint': 'Thả media vào đây hoặc bấm + trên thẻ media',

  'tip.undo': 'Hoàn tác (Ctrl+Z)', 'tip.redo': 'Làm lại (Ctrl+Y)', 'tip.theme': 'Đổi giao diện', 'tip.settings': 'Cài đặt',
  'tip.first': 'Về đầu (Home)', 'tip.last': 'Đến cuối (End)', 'tip.stepBack': 'Khung hình trước (←)', 'tip.stepFwd': 'Khung hình sau (→)',
  'tip.play': 'Phát / Tạm dừng (Space)', 'tip.volume': 'Âm lượng xem trước',
  'tip.split': 'Cắt tại đầu phát (S)', 'tip.duplicate': 'Nhân đôi (Ctrl+D)', 'tip.delete': 'Xóa (Del)', 'tip.snap': 'Hút dính',
  'tip.zoomIn': 'Phóng to', 'tip.zoomOut': 'Thu nhỏ', 'tip.fit': 'Vừa khung timeline',

  'media.import': 'Nhập media', 'media.empty': 'Chưa có media. Hãy nhập tệp hoặc thả vào đây.',
  'media.offline': '{n} tệp đang ngoại tuyến. Hãy nhập lại tệp gốc để liên kết lại.',
  'media.add': 'Thêm vào timeline', 'media.addOverlay': 'Thêm làm lớp phủ', 'media.tip': 'Mẹo: kéo thẻ vào timeline, hoặc nhấp đúp để thêm vào cuối.',
  'btn.remove': 'Xóa', 'btn.cancel': 'Hủy', 'btn.done': 'Xong', 'btn.close': 'Đóng',

  'text.add': 'Thêm văn bản',
  'textpreset.basic': 'Cơ bản', 'textpreset.title': 'Tiêu đề', 'textpreset.subtitle': 'Phụ đề', 'textpreset.caption': 'Chú thích',
  'textpreset.outline': 'Viền chữ', 'textpreset.neon': 'Neon', 'textpreset.typewriter': 'Gõ chữ', 'textpreset.yellow': 'Nhấn mạnh',
  'textpreset.basic.sample': 'Văn bản', 'textpreset.title.sample': 'Tiêu đề', 'textpreset.subtitle.sample': 'Phụ đề', 'textpreset.caption.sample': 'Chú thích',
  'textpreset.outline.sample': 'Viền chữ', 'textpreset.neon.sample': 'NEON', 'textpreset.typewriter.sample': 'Đang gõ…', 'textpreset.yellow.sample': 'Nhấn mạnh',

  'effects.select': 'Chọn một clip video hoặc ảnh rồi chọn kiểu màu.', 'effects.apply': 'Nhấn một kiểu màu để áp dụng cho clip đang chọn.',
  'filter.none': 'Không', 'filter.vivid': 'Rực rỡ', 'filter.bw': 'Đen trắng', 'filter.warm': 'Ấm', 'filter.cool': 'Lạnh',
  'filter.vintage': 'Cổ điển', 'filter.fade': 'Nhạt', 'filter.dramatic': 'Kịch tính', 'filter.custom': 'Tùy chỉnh',
  'trans.select': 'Chọn một clip trên track chính (không phải clip đầu) để thêm chuyển cảnh phía trước.', 'trans.apply': 'Nhấn một chuyển cảnh để áp dụng trước clip đang chọn.',
  'trans.applyAll': 'Áp dụng cho mọi clip',
  'trans.none': 'Không', 'trans.fade': 'Mờ dần', 'trans.slide': 'Trượt', 'trans.slideup': 'Trượt lên', 'trans.wipe': 'Quét', 'trans.zoom': 'Phóng', 'trans.dip': 'Qua màn đen',
  'anim.none': 'Không', 'anim.fade': 'Mờ dần', 'anim.pop': 'Bật lên', 'anim.slideup': 'Trượt lên', 'anim.typewriter': 'Gõ chữ',

  'insp.project': 'Dự án', 'insp.aspect': 'Tỉ lệ khung hình', 'insp.fps': 'Tốc độ khung hình', 'insp.background': 'Màu nền',
  'insp.summary': 'Dài {d}s · {n} clip', 'insp.hintSelect': 'Chọn một clip trên timeline hoặc khung xem trước để chỉnh sửa.',
  'insp.clip': 'Clip', 'insp.overlay': 'Lớp phủ', 'insp.textClip': 'Văn bản', 'insp.audioClip': 'Âm thanh',
  'insp.basic': 'Cơ bản', 'insp.filters': 'Bộ lọc', 'insp.presets': 'Kiểu màu', 'insp.reset': 'Đặt lại',
  'insp.start': 'Bắt đầu (s)', 'insp.duration': 'Thời lượng (s)', 'insp.speed': 'Tốc độ', 'insp.transform': 'Biến đổi',
  'insp.opacity': 'Độ mờ', 'insp.fit': 'Khớp khung', 'fit.contain': 'Vừa', 'fit.cover': 'Lấp đầy', 'fit.blur': 'Nền mờ',
  'insp.scale': 'Tỉ lệ', 'insp.rotation': 'Xoay', 'insp.posX': 'Vị trí X', 'insp.posY': 'Vị trí Y',
  'insp.flipH': 'Lật ngang', 'insp.flipV': 'Lật dọc', 'insp.fadeIn': 'Hiện dần', 'insp.fadeOut': 'Tắt dần',
  'insp.audio': 'Âm thanh', 'insp.volume': 'Âm lượng', 'insp.mute': 'Tắt tiếng',
  'insp.transition': 'Chuyển cảnh', 'insp.transFirst': 'Clip đầu tiên không có chuyển cảnh.', 'insp.type': 'Kiểu', 'insp.transDur': 'Thời lượng',
  'insp.brightness': 'Độ sáng', 'insp.contrast': 'Tương phản', 'insp.saturation': 'Độ bão hòa', 'insp.hue': 'Sắc độ',
  'insp.blur': 'Làm mờ', 'insp.gray': 'Thang xám', 'insp.sepia': 'Nâu đỏ', 'insp.vignette': 'Tối viền',
  'insp.font': 'Phông chữ', 'insp.size': 'Cỡ chữ', 'insp.color': 'Màu chữ', 'insp.style': 'Kiểu', 'insp.align': 'Căn lề', 'insp.anim': 'Hoạt ảnh',
  'insp.appearance': 'Giao diện chữ', 'insp.bgBox': 'Khung nền', 'insp.bgColor': 'Màu khung', 'insp.bgOpacity': 'Độ mờ khung',
  'insp.outline': 'Viền chữ', 'insp.outlineColor': 'Màu viền', 'insp.shadow': 'Đổ bóng',

  'export.title': 'Xuất video', 'export.format': 'Định dạng', 'export.resolution': 'Độ phân giải', 'export.fps': 'Tốc độ khung hình', 'export.quality': 'Chất lượng',
  'export.q.standard': 'Tiêu chuẩn', 'export.q.high': 'Cao', 'export.q.max': 'Tối đa',
  'export.mp4ffmpeg': 'MP4 (H.264, qua FFmpeg)', 'export.start': 'Bắt đầu xuất',
  'export.summary': '{w}×{h} · {d} · khoảng {mb} MB',
  'export.note': 'Việc xuất ghi lại timeline theo thời gian thực nên mất bằng thời lượng video. Hãy giữ cửa sổ hiển thị trong lúc xuất.',
  'export.recording': 'Đang ghi…', 'export.saving': 'Đang lưu tệp…', 'export.converting': 'Đang chuyển sang MP4…', 'export.keepOpen': 'Vui lòng giữ cửa sổ này mở.',
  'export.done': 'Xuất xong', 'export.savedTo': 'Đã lưu tại {path}', 'export.failed': 'Xuất thất bại', 'export.cancelled': 'Đã hủy xuất',
  'export.empty': 'Hãy thêm nội dung vào timeline trước.', 'export.unsupported': 'Hệ thống này không thể ghi video (không có MediaRecorder).',

  'settings.title': 'Cài đặt', 'settings.theme': 'Giao diện', 'theme.light': 'Sáng', 'theme.dark': 'Tối', 'theme.system': 'Hệ thống',
  'settings.accent': 'Màu chủ đề', 'settings.customColor': 'Màu tùy chỉnh', 'settings.language': 'Ngôn ngữ', 'lang.auto': 'Tự động (theo hệ thống)',
  'settings.about': 'Giới thiệu', 'about.credit': 'Tác giả: minhtrong67, với sự hỗ trợ của Claude (AI của Anthropic).',

  'confirm.title': 'Lưu thay đổi?', 'confirm.msg': '“{name}” có thay đổi chưa lưu. Bạn có muốn lưu không?', 'confirm.save': 'Lưu', 'confirm.discard': 'Không lưu',
  'draft.title': 'Khôi phục dự án chưa lưu?', 'draft.msg': 'Material Edit tìm thấy một dự án chưa lưu từ lần làm việc trước. Cần nhập lại tệp media để liên kết lại.',
  'draft.restore': 'Khôi phục', 'draft.discard': 'Bỏ qua',

  'toast.saved': 'Đã lưu “{name}”', 'toast.opened': 'Đã mở “{name}”', 'toast.openedOffline': 'Đã mở dự án. Hãy nhập lại media gốc để liên kết lại {n} tệp.',
  'toast.error': 'Đã xảy ra lỗi: {msg}', 'toast.splitNone': 'Hãy đặt đầu phát lên một clip để cắt.',
  'toast.importing': 'Đang nhập {n} tệp…', 'toast.imported': 'Đã nhập {n} tệp', 'toast.importFailed': 'Không thể nhập: {names}',
};

import { extraEn, extraVi } from './i18n-extra.js';
Object.assign(en, extraEn);
Object.assign(vi, extraVi);

const dicts = { en, vi };
let current = 'en';

export function detectLang() {
  return (navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
export function setLanguage(pref) {
  current = pref === 'auto' || !dicts[pref] ? detectLang() : pref;
  document.documentElement.lang = current;
  return current;
}
export const lang = () => current;

export function t(key, vars) {
  let s = (dicts[current] && dicts[current][key]) || en[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { const v = t(el.dataset.i18nTitle); el.title = v; el.setAttribute('aria-label', v); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}
