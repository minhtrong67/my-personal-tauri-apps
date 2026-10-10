/* Material Note - tiny i18n helper (English / Vietnamese) */
const I18n = (() => {
  const dict = {
    en: {
      'menu.file': 'File', 'menu.edit': 'Edit', 'menu.view': 'View',
      'file.new': 'New tab', 'file.open': 'Open…', 'file.save': 'Save', 'file.saveAs': 'Save as…',
      'file.print': 'Print…', 'file.closeTab': 'Close tab', 'file.exit': 'Exit',
      'edit.undo': 'Undo', 'edit.redo': 'Redo', 'edit.cut': 'Cut', 'edit.copy': 'Copy', 'edit.paste': 'Paste',
      'edit.delete': 'Delete', 'edit.find': 'Find…', 'edit.findNext': 'Find next', 'edit.findPrev': 'Find previous',
      'edit.replace': 'Replace…', 'edit.goto': 'Go to line…', 'edit.selectAll': 'Select all', 'edit.timeDate': 'Time/Date',
      'view.zoomIn': 'Zoom in', 'view.zoomOut': 'Zoom out', 'view.zoomReset': 'Restore default zoom',
      'view.wrap': 'Word wrap', 'view.statusBar': 'Status bar', 'view.fullscreen': 'Full screen', 'view.verticalTabs': 'Vertical tabs',
      'toolbar.theme': 'Theme', 'toolbar.settings': 'Settings', 'toolbar.about': 'About',
      'tab.new': 'New tab', 'tab.close': 'Close tab', 'untitled': 'Untitled',
      'settings.title': 'Settings',
      'settings.appearance': 'Appearance', 'settings.theme': 'Mode',
      'settings.light': 'Light', 'settings.dark': 'Dark', 'settings.system': 'System',
      'settings.color': 'Theme color', 'settings.custom': 'Custom color',
      'settings.language': 'Language',
      'settings.tabLayout': 'Tab layout', 'settings.tabsHorizontal': 'Horizontal', 'settings.tabsVertical': 'Vertical',
      'settings.editor': 'Editor', 'settings.font': 'Font', 'settings.fontSize': 'Font size',
      'font.system': 'System UI', 'font.mono': 'Monospace', 'font.serif': 'Serif',
      'settings.wrap': 'Word wrap', 'settings.statusBar': 'Show status bar',
      'settings.spellcheck': 'Spell check', 'settings.restore': 'Reopen files on startup',
      'settings.reset': 'Reset to defaults',
      'common.close': 'Close', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.dontSave': "Don't save",
      'about.title': 'About Material Note', 'about.desc': 'A fast, simple and beautiful notepad built with Tauri.',
      'about.version': 'Version', 'about.author': 'Author',
      'about.ai': 'AI assistant by Anthropic, who supported the development.',
      'find.placeholder': 'Find', 'replace.placeholder': 'Replace with',
      'find.case': 'Match case', 'find.word': 'Whole word', 'find.regex': 'Regular expression',
      'find.prev': 'Previous match', 'find.next': 'Next match', 'find.close': 'Close',
      'find.replace': 'Replace', 'find.replaceAll': 'Replace all',
      'find.count': '{n} matches', 'find.none': 'No results', 'find.invalid': 'Invalid pattern',
      'find.replaced': '{n} replaced',
      'goto.title': 'Go to line', 'goto.label': 'Line number', 'goto.hint': 'Lines in this file: {n}', 'goto.go': 'Go',
      'status.ln': 'Ln', 'status.col': 'Col', 'status.chars': '{n} characters', 'status.selected': '{n} selected',
      'status.crlf': 'Windows (CRLF)', 'status.lf': 'Unix (LF)', 'status.toggleEol': 'Click to change line ending',
      'unsaved.title': 'Unsaved changes', 'unsaved.msg': 'Do you want to save changes to “{name}”?',
      'err.open': 'Could not open file', 'err.save': 'Could not save file', 'err.paste': 'Clipboard access was denied. Use Ctrl+V instead.',
      'settings.windowOnStart': 'When opening the app', 'settings.d.windowStart': 'Choose how the window should appear every time you launch the app',
      'settings.winRemember': 'Remember window size', 'settings.d.winRemember': 'Reopen at the size you last resized the window to',
      'settings.winMax': 'Always open maximized', 'settings.d.winMax': 'Fill the whole screen every time the app starts',
      'settings.window': 'Window',
      'msg.saved': 'Saved',
      'filter.text': 'Text documents', 'filter.all': 'All files',
      'drop.hint': 'Drop files to open'
    },
    vi: {
      'menu.file': 'Tệp', 'menu.edit': 'Chỉnh sửa', 'menu.view': 'Xem',
      'file.new': 'Thẻ mới', 'file.open': 'Mở…', 'file.save': 'Lưu', 'file.saveAs': 'Lưu thành…',
      'file.print': 'In…', 'file.closeTab': 'Đóng thẻ', 'file.exit': 'Thoát',
      'edit.undo': 'Hoàn tác', 'edit.redo': 'Làm lại', 'edit.cut': 'Cắt', 'edit.copy': 'Sao chép', 'edit.paste': 'Dán',
      'edit.delete': 'Xoá', 'edit.find': 'Tìm kiếm…', 'edit.findNext': 'Tìm tiếp', 'edit.findPrev': 'Tìm trước đó',
      'edit.replace': 'Thay thế…', 'edit.goto': 'Đi tới dòng…', 'edit.selectAll': 'Chọn tất cả', 'edit.timeDate': 'Giờ/Ngày',
      'view.zoomIn': 'Phóng to', 'view.zoomOut': 'Thu nhỏ', 'view.zoomReset': 'Đặt lại thu phóng',
      'view.wrap': 'Tự động xuống dòng', 'view.statusBar': 'Thanh trạng thái', 'view.fullscreen': 'Toàn màn hình', 'view.verticalTabs': 'Thẻ dọc',
      'toolbar.theme': 'Giao diện', 'toolbar.settings': 'Cài đặt', 'toolbar.about': 'Giới thiệu',
      'tab.new': 'Thẻ mới', 'tab.close': 'Đóng thẻ', 'untitled': 'Không tên',
      'settings.title': 'Cài đặt',
      'settings.appearance': 'Giao diện', 'settings.theme': 'Chế độ',
      'settings.light': 'Sáng', 'settings.dark': 'Tối', 'settings.system': 'Hệ thống',
      'settings.color': 'Màu chủ đề', 'settings.custom': 'Màu tuỳ chỉnh',
      'settings.language': 'Ngôn ngữ',
      'settings.tabLayout': 'Bố cục thẻ', 'settings.tabsHorizontal': 'Ngang', 'settings.tabsVertical': 'Dọc',
      'settings.editor': 'Trình soạn thảo', 'settings.font': 'Phông chữ', 'settings.fontSize': 'Cỡ chữ',
      'font.system': 'Mặc định hệ thống', 'font.mono': 'Đơn cách', 'font.serif': 'Có chân',
      'settings.wrap': 'Tự động xuống dòng', 'settings.statusBar': 'Hiện thanh trạng thái',
      'settings.spellcheck': 'Kiểm tra chính tả', 'settings.restore': 'Mở lại tệp khi khởi động',
      'settings.reset': 'Khôi phục mặc định',
      'common.close': 'Đóng', 'common.cancel': 'Huỷ', 'common.save': 'Lưu', 'common.dontSave': 'Không lưu',
      'about.title': 'Giới thiệu Material Note', 'about.desc': 'Ứng dụng ghi chú nhanh, đơn giản và đẹp, xây dựng bằng Tauri.',
      'about.version': 'Phiên bản', 'about.author': 'Tác giả',
      'about.ai': 'Trợ lý AI của Anthropic, đồng hành hỗ trợ phát triển.',
      'find.placeholder': 'Tìm', 'replace.placeholder': 'Thay bằng',
      'find.case': 'Phân biệt hoa thường', 'find.word': 'Cả từ', 'find.regex': 'Biểu thức chính quy',
      'find.prev': 'Kết quả trước', 'find.next': 'Kết quả tiếp theo', 'find.close': 'Đóng',
      'find.replace': 'Thay thế', 'find.replaceAll': 'Thay tất cả',
      'find.count': '{n} kết quả', 'find.none': 'Không có kết quả', 'find.invalid': 'Mẫu không hợp lệ',
      'find.replaced': 'Đã thay {n} mục',
      'goto.title': 'Đi tới dòng', 'goto.label': 'Số dòng', 'goto.hint': 'Số dòng trong tệp: {n}', 'goto.go': 'Đi',
      'status.ln': 'Dòng', 'status.col': 'Cột', 'status.chars': '{n} ký tự', 'status.selected': 'đã chọn {n}',
      'status.crlf': 'Windows (CRLF)', 'status.lf': 'Unix (LF)', 'status.toggleEol': 'Nhấn để đổi kiểu xuống dòng',
      'unsaved.title': 'Thay đổi chưa được lưu', 'unsaved.msg': 'Bạn có muốn lưu các thay đổi vào “{name}” không?',
      'err.open': 'Không thể mở tệp', 'err.save': 'Không thể lưu tệp', 'err.paste': 'Không được phép truy cập clipboard. Hãy dùng Ctrl+V.',
      'settings.windowOnStart': 'Khi mở ứng dụng', 'settings.d.windowStart': 'Chọn cách cửa sổ xuất hiện mỗi lần bạn mở ứng dụng',
      'settings.winRemember': 'Ghi nhớ kích thước cửa sổ', 'settings.d.winRemember': 'Mở lại đúng kích thước bạn đã chỉnh lần trước',
      'settings.winMax': 'Luôn mở ở chế độ phóng to tối đa', 'settings.d.winMax': 'Phủ kín màn hình mỗi lần mở ứng dụng',
      'settings.window': 'Cửa sổ',
      'msg.saved': 'Đã lưu',
      'filter.text': 'Tài liệu văn bản', 'filter.all': 'Mọi tệp',
      'drop.hint': 'Thả tệp để mở'
    }
  };

  let lang = 'en';

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const v = t(el.dataset.i18nTitle);
      el.title = v;
      el.setAttribute('aria-label', v);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  return {
    t,
    apply,
    setLang(l) { lang = dict[l] ? l : 'en'; },
    getLang() { return lang; },
    detect() { return (navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en'; }
  };
})();
