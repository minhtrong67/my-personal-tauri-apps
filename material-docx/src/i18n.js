// Tiny i18n layer: English + Vietnamese.

const en = {
  'menu.file': 'File',
  'doc.untitled': 'Untitled document',
  'file.new': 'New',
  'file.open': 'Open…',
  'file.save': 'Save',
  'file.saveAs': 'Save as…',
  'file.print': 'Print / Export PDF',
  'file.exit': 'Exit',

  'tip.find': 'Find & replace (Ctrl+F)',
  'tip.theme': 'Switch theme',
  'tip.settings': 'Settings',
  'tip.undo': 'Undo (Ctrl+Z)',
  'tip.redo': 'Redo (Ctrl+Y)',
  'tip.style': 'Paragraph style',
  'tip.fontFamily': 'Font',
  'tip.fontSize': 'Font size',
  'tip.bold': 'Bold (Ctrl+B)',
  'tip.italic': 'Italic (Ctrl+I)',
  'tip.underline': 'Underline (Ctrl+U)',
  'tip.strike': 'Strikethrough',
  'tip.sup': 'Superscript',
  'tip.sub': 'Subscript',
  'tip.color': 'Text color',
  'tip.highlight': 'Highlight color',
  'tip.alignLeft': 'Align left',
  'tip.alignCenter': 'Center',
  'tip.alignRight': 'Align right',
  'tip.alignJustify': 'Justify',
  'tip.ul': 'Bulleted list',
  'tip.ol': 'Numbered list',
  'tip.outdent': 'Decrease indent',
  'tip.indent': 'Increase indent',
  'tip.lineSpacing': 'Line spacing',
  'tip.link': 'Insert link (Ctrl+K)',
  'tip.image': 'Insert image',
  'tip.table': 'Insert table',
  'tip.hr': 'Horizontal line',
  'tip.clear': 'Clear formatting',
  'tip.zoomIn': 'Zoom in',
  'tip.zoomOut': 'Zoom out',
  'tip.zoomReset': 'Reset zoom',

  'style.p': 'Normal text',
  'style.h1': 'Heading 1',
  'style.h2': 'Heading 2',
  'style.h3': 'Heading 3',
  'style.quote': 'Quote',
  'lh.default': 'Spacing',

  'ctx.table': 'Table',
  'ctx.row': 'row',
  'ctx.col': 'column',
  'ctx.tableDel': 'Delete table',
  'ctx.image': 'Image',
  'ctx.smaller': 'Smaller',
  'ctx.larger': 'Larger',
  'ctx.fit': 'Fit width',
  'ctx.imgDel': 'Delete',

  'find.find': 'Find',
  'find.replaceWith': 'Replace with',
  'find.matchCase': 'Match case',
  'find.prev': 'Previous',
  'find.next': 'Next',
  'find.replace': 'Replace',
  'find.replaceAll': 'Replace all',
  'find.count': '{n} found',
  'find.none': 'No results',

  'status.words': '{n} words',
  'status.chars': '{n} characters',
  'status.pages': 'about {n} page(s)',

  'settings.title': 'Settings',
  'settings.theme': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'settings.accent': 'Accent color',
  'settings.customColor': 'Custom color',
  'settings.language': 'Language',
  'lang.auto': 'Automatic (system)',
  'settings.page': 'Page & editing',
  'page.size': 'Paper size',
  'page.orient': 'Orientation',
  'page.margins': 'Margins',
  'orient.portrait': 'Portrait',
  'orient.landscape': 'Landscape',
  'margin.narrow': 'Narrow (0.5")',
  'margin.moderate': 'Moderate (0.75")',
  'margin.normal': 'Normal (1")',
  'margin.wide': 'Wide (1.5")',
  'settings.spellcheck': 'Check spelling while typing',
  'settings.about': 'About',
  'about.credit': 'Created by minhtrong67 with the help of Claude (AI by Anthropic).',

  'btn.close': 'Close',
  'btn.done': 'Done',
  'btn.cancel': 'Cancel',
  'btn.insert': 'Insert',
  'btn.apply': 'Apply',
  'table.title': 'Insert table',
  'table.rows': 'Rows',
  'table.cols': 'Columns',
  'link.title': 'Link',
  'link.text': 'Text to display',
  'link.url': 'Address',
  'link.remove': 'Remove link',

  'confirm.title': 'Save changes?',
  'confirm.msg': '“{name}” has unsaved changes. Do you want to save them?',
  'confirm.save': 'Save',
  'confirm.discard': "Don't save",
  'draft.title': 'Restore unsaved work?',
  'draft.msg': 'Material Docx found an unsaved draft from your last session.',
  'draft.restore': 'Restore',
  'draft.discard': 'Discard',

  'dlg.open': 'Open document',
  'dlg.save': 'Save document',
  'filter.docs': 'Documents',
  'filter.docx': 'Word document (.docx)',
  'filter.html': 'Web page (.html)',
  'filter.txt': 'Plain text (.txt)',

  'toast.saved': 'Saved “{name}”',
  'toast.opened': 'Opened “{name}”',
  'toast.error': 'Something went wrong: {msg}',
  'toast.unsupported': 'This file type is not supported.',
  'toast.replaced': 'Replaced {n} occurrence(s)',
  'toast.printHint': 'Choose “Save as PDF” in the print dialog to export a PDF.',
  'toast.emptyUrl': 'Please enter an address.',
};

const vi = {
  'menu.file': 'Tệp',
  'doc.untitled': 'Tài liệu chưa đặt tên',
  'file.new': 'Mới',
  'file.open': 'Mở…',
  'file.save': 'Lưu',
  'file.saveAs': 'Lưu thành…',
  'file.print': 'In / Xuất PDF',
  'file.exit': 'Thoát',

  'tip.find': 'Tìm & thay thế (Ctrl+F)',
  'tip.theme': 'Đổi giao diện',
  'tip.settings': 'Cài đặt',
  'tip.undo': 'Hoàn tác (Ctrl+Z)',
  'tip.redo': 'Làm lại (Ctrl+Y)',
  'tip.style': 'Kiểu đoạn văn',
  'tip.fontFamily': 'Phông chữ',
  'tip.fontSize': 'Cỡ chữ',
  'tip.bold': 'In đậm (Ctrl+B)',
  'tip.italic': 'In nghiêng (Ctrl+I)',
  'tip.underline': 'Gạch chân (Ctrl+U)',
  'tip.strike': 'Gạch ngang chữ',
  'tip.sup': 'Chỉ số trên',
  'tip.sub': 'Chỉ số dưới',
  'tip.color': 'Màu chữ',
  'tip.highlight': 'Màu tô sáng',
  'tip.alignLeft': 'Căn trái',
  'tip.alignCenter': 'Căn giữa',
  'tip.alignRight': 'Căn phải',
  'tip.alignJustify': 'Căn đều hai bên',
  'tip.ul': 'Danh sách dấu đầu dòng',
  'tip.ol': 'Danh sách đánh số',
  'tip.outdent': 'Giảm thụt lề',
  'tip.indent': 'Tăng thụt lề',
  'tip.lineSpacing': 'Giãn dòng',
  'tip.link': 'Chèn liên kết (Ctrl+K)',
  'tip.image': 'Chèn hình ảnh',
  'tip.table': 'Chèn bảng',
  'tip.hr': 'Đường kẻ ngang',
  'tip.clear': 'Xóa định dạng',
  'tip.zoomIn': 'Phóng to',
  'tip.zoomOut': 'Thu nhỏ',
  'tip.zoomReset': 'Đặt lại thu phóng',

  'style.p': 'Văn bản thường',
  'style.h1': 'Tiêu đề 1',
  'style.h2': 'Tiêu đề 2',
  'style.h3': 'Tiêu đề 3',
  'style.quote': 'Trích dẫn',
  'lh.default': 'Giãn dòng',

  'ctx.table': 'Bảng',
  'ctx.row': 'hàng',
  'ctx.col': 'cột',
  'ctx.tableDel': 'Xóa bảng',
  'ctx.image': 'Hình ảnh',
  'ctx.smaller': 'Nhỏ hơn',
  'ctx.larger': 'Lớn hơn',
  'ctx.fit': 'Vừa chiều rộng',
  'ctx.imgDel': 'Xóa',

  'find.find': 'Tìm',
  'find.replaceWith': 'Thay bằng',
  'find.matchCase': 'Phân biệt hoa/thường',
  'find.prev': 'Trước',
  'find.next': 'Sau',
  'find.replace': 'Thay thế',
  'find.replaceAll': 'Thay tất cả',
  'find.count': 'Tìm thấy {n}',
  'find.none': 'Không có kết quả',

  'status.words': '{n} từ',
  'status.chars': '{n} ký tự',
  'status.pages': 'khoảng {n} trang',

  'settings.title': 'Cài đặt',
  'settings.theme': 'Giao diện',
  'theme.light': 'Sáng',
  'theme.dark': 'Tối',
  'theme.system': 'Hệ thống',
  'settings.accent': 'Màu chủ đề',
  'settings.customColor': 'Màu tùy chỉnh',
  'settings.language': 'Ngôn ngữ',
  'lang.auto': 'Tự động (theo hệ thống)',
  'settings.page': 'Trang & soạn thảo',
  'page.size': 'Khổ giấy',
  'page.orient': 'Hướng giấy',
  'page.margins': 'Lề trang',
  'orient.portrait': 'Dọc',
  'orient.landscape': 'Ngang',
  'margin.narrow': 'Hẹp (1,27 cm)',
  'margin.moderate': 'Vừa (1,9 cm)',
  'margin.normal': 'Thường (2,54 cm)',
  'margin.wide': 'Rộng (3,81 cm)',
  'settings.spellcheck': 'Kiểm tra chính tả khi gõ',
  'settings.about': 'Giới thiệu',
  'about.credit': 'Tác giả: minhtrong67, với sự hỗ trợ của Claude (AI của Anthropic).',

  'btn.close': 'Đóng',
  'btn.done': 'Xong',
  'btn.cancel': 'Hủy',
  'btn.insert': 'Chèn',
  'btn.apply': 'Áp dụng',
  'table.title': 'Chèn bảng',
  'table.rows': 'Số hàng',
  'table.cols': 'Số cột',
  'link.title': 'Liên kết',
  'link.text': 'Văn bản hiển thị',
  'link.url': 'Địa chỉ',
  'link.remove': 'Gỡ liên kết',

  'confirm.title': 'Lưu thay đổi?',
  'confirm.msg': '“{name}” có thay đổi chưa lưu. Bạn có muốn lưu không?',
  'confirm.save': 'Lưu',
  'confirm.discard': 'Không lưu',
  'draft.title': 'Khôi phục bản nháp?',
  'draft.msg': 'Material Docx tìm thấy bản nháp chưa lưu từ lần làm việc trước.',
  'draft.restore': 'Khôi phục',
  'draft.discard': 'Bỏ qua',

  'dlg.open': 'Mở tài liệu',
  'dlg.save': 'Lưu tài liệu',
  'filter.docs': 'Tài liệu',
  'filter.docx': 'Tài liệu Word (.docx)',
  'filter.html': 'Trang web (.html)',
  'filter.txt': 'Văn bản thuần (.txt)',

  'toast.saved': 'Đã lưu “{name}”',
  'toast.opened': 'Đã mở “{name}”',
  'toast.error': 'Đã xảy ra lỗi: {msg}',
  'toast.unsupported': 'Loại tệp này chưa được hỗ trợ.',
  'toast.replaced': 'Đã thay {n} vị trí',
  'toast.printHint': 'Chọn “Lưu dưới dạng PDF” trong hộp thoại in để xuất PDF.',
  'toast.emptyUrl': 'Vui lòng nhập địa chỉ.',
};

const dicts = { en, vi };
let current = 'en';

export function detectLang() {
  const l = (navigator.language || 'en').toLowerCase();
  return l.startsWith('vi') ? 'vi' : 'en';
}

/** pref: 'auto' | 'en' | 'vi' */
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

/** Translates every [data-i18n], [data-i18n-title] and [data-i18n-ph] under root. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const v = t(el.dataset.i18nTitle);
    el.title = v;
    el.setAttribute('aria-label', v);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}
