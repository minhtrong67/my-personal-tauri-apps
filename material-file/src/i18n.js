/* Material File - tiny i18n helper (English / Vietnamese) */
const I18n = (() => {
  const dict = {
    en: {
      'nav.back': 'Back', 'nav.forward': 'Forward', 'nav.up': 'Up', 'nav.refresh': 'Refresh',
      'address.placeholder': 'Type a path and press Enter', 'search.placeholder': 'Search', 'search.in': 'Search in {folder}',
      'cmd.new': 'New', 'cmd.cut': 'Cut', 'cmd.copy': 'Copy', 'cmd.paste': 'Paste', 'cmd.rename': 'Rename',
      'cmd.delete': 'Delete', 'cmd.sort': 'Sort', 'cmd.view': 'View', 'cmd.properties': 'Properties',
      'cmd.open': 'Open', 'cmd.openLocation': 'Open folder location', 'cmd.selectAll': 'Select all',
      'new.folder': 'Folder', 'new.text': 'Text document',
      'name.newFolder': 'New folder', 'name.newText': 'New text document.txt',
      'sort.name': 'Name', 'sort.modified': 'Date modified', 'sort.type': 'Type', 'sort.size': 'Size',
      'sort.asc': 'Ascending', 'sort.desc': 'Descending',
      'view.details': 'Details', 'view.grid': 'Icons', 'view.hidden': 'Show hidden items',
      'col.name': 'Name', 'col.modified': 'Date modified', 'col.type': 'Type', 'col.size': 'Size',
      'sidebar.quick': 'Quick access', 'sidebar.drives': 'Drives',
      'place.home': 'Home', 'place.desktop': 'Desktop', 'place.documents': 'Documents', 'place.downloads': 'Downloads',
      'place.pictures': 'Pictures', 'place.music': 'Music', 'place.videos': 'Videos', 'place.thispc': 'This PC',
      'drive.local': 'Local Disk', 'drive.free': '{free} free of {total}',
      'status.item': '1 item', 'status.items': '{n} items', 'status.selected': '{n} selected', 'status.results': '{n} results',
      'empty.folder': 'This folder is empty', 'empty.search': 'No items match your search', 'empty.loading': 'Loading…',
      'type.folder': 'File folder', 'type.file': '{ext} file', 'type.plain': 'File', 'type.cat': '{ext} {cat}',
      'cat.image': 'Image', 'cat.video': 'Video', 'cat.audio': 'Audio', 'cat.archive': 'Archive', 'cat.doc': 'Document',
      'cat.sheet': 'Spreadsheet', 'cat.slide': 'Presentation', 'cat.code': 'Source file', 'cat.exe': 'Application', 'cat.text': 'Text document',
      'confirm.title': 'Delete', 'confirm.one': 'Move “{name}” to the Recycle Bin?', 'confirm.many': 'Move these {n} items to the Recycle Bin?',
      'confirm.permOne': 'Permanently delete “{name}”? This cannot be undone.', 'confirm.permMany': 'Permanently delete these {n} items? This cannot be undone.',
      'common.close': 'Close', 'common.cancel': 'Cancel', 'common.ok': 'OK',
      'props.title': 'Properties', 'props.name': 'Name', 'props.type': 'Type', 'props.location': 'Location', 'props.size': 'Size',
      'props.contains': 'Contains', 'props.containsVal': '{files} files, {folders} folders', 'props.created': 'Created',
      'props.modified': 'Modified', 'props.accessed': 'Accessed', 'props.attributes': 'Attributes',
      'props.readonly': 'Read-only', 'props.hidden': 'Hidden', 'props.items': '{n} items selected',
      'toolbar.theme': 'Theme', 'toolbar.settings': 'Settings', 'toolbar.about': 'About',
      'settings.title': 'Settings', 'settings.appearance': 'Appearance', 'settings.theme': 'Mode',
      'settings.light': 'Light', 'settings.dark': 'Dark', 'settings.system': 'System',
      'settings.color': 'Theme color', 'settings.custom': 'Custom color', 'settings.language': 'Language',
      'settings.general': 'General', 'settings.defaultView': 'View', 'settings.showHidden': 'Show hidden items',
      'settings.confirmDelete': 'Confirm before deleting', 'settings.reset': 'Reset to defaults',
      'about.title': 'About Material File', 'about.desc': 'A simple, fast and beautiful file manager built with Tauri.',
      'about.version': 'Version', 'about.author': 'Author',
      'about.ai': 'Built with the support of Claude, an AI assistant by Anthropic.',
      'err.generic': 'Something went wrong', 'err.exists': 'An item with that name already exists.',
      'err.invalidName': 'Invalid name. A name cannot contain \\ / : * ? " < > |',
      'err.intoItself': 'A folder cannot be copied or moved into itself.', 'err.path': 'Cannot open this location',
      'msg.pasted': '{n} item(s) done', 'msg.deleted': 'Deleted'
    },
    vi: {
      'nav.back': 'Quay lại', 'nav.forward': 'Tiến tới', 'nav.up': 'Lên một cấp', 'nav.refresh': 'Làm mới',
      'address.placeholder': 'Nhập đường dẫn rồi nhấn Enter', 'search.placeholder': 'Tìm kiếm', 'search.in': 'Tìm trong {folder}',
      'cmd.new': 'Mới', 'cmd.cut': 'Cắt', 'cmd.copy': 'Sao chép', 'cmd.paste': 'Dán', 'cmd.rename': 'Đổi tên',
      'cmd.delete': 'Xoá', 'cmd.sort': 'Sắp xếp', 'cmd.view': 'Xem', 'cmd.properties': 'Thuộc tính',
      'cmd.open': 'Mở', 'cmd.openLocation': 'Mở thư mục chứa tệp', 'cmd.selectAll': 'Chọn tất cả',
      'new.folder': 'Thư mục', 'new.text': 'Tài liệu văn bản',
      'name.newFolder': 'Thư mục mới', 'name.newText': 'Tài liệu văn bản mới.txt',
      'sort.name': 'Tên', 'sort.modified': 'Ngày sửa đổi', 'sort.type': 'Loại', 'sort.size': 'Kích thước',
      'sort.asc': 'Tăng dần', 'sort.desc': 'Giảm dần',
      'view.details': 'Chi tiết', 'view.grid': 'Biểu tượng', 'view.hidden': 'Hiện mục ẩn',
      'col.name': 'Tên', 'col.modified': 'Ngày sửa đổi', 'col.type': 'Loại', 'col.size': 'Kích thước',
      'sidebar.quick': 'Truy cập nhanh', 'sidebar.drives': 'Ổ đĩa',
      'place.home': 'Trang chủ', 'place.desktop': 'Màn hình nền', 'place.documents': 'Tài liệu', 'place.downloads': 'Tải xuống',
      'place.pictures': 'Hình ảnh', 'place.music': 'Nhạc', 'place.videos': 'Video', 'place.thispc': 'Máy tính này',
      'drive.local': 'Ổ đĩa cục bộ', 'drive.free': 'Còn trống {free} / {total}',
      'status.item': '1 mục', 'status.items': '{n} mục', 'status.selected': 'đã chọn {n}', 'status.results': '{n} kết quả',
      'empty.folder': 'Thư mục này trống', 'empty.search': 'Không có mục nào khớp với tìm kiếm', 'empty.loading': 'Đang tải…',
      'type.folder': 'Thư mục', 'type.file': 'Tệp {ext}', 'type.plain': 'Tệp', 'type.cat': '{cat} {ext}',
      'cat.image': 'Hình ảnh', 'cat.video': 'Video', 'cat.audio': 'Âm thanh', 'cat.archive': 'Tệp nén', 'cat.doc': 'Tài liệu',
      'cat.sheet': 'Bảng tính', 'cat.slide': 'Bản trình bày', 'cat.code': 'Mã nguồn', 'cat.exe': 'Ứng dụng', 'cat.text': 'Văn bản',
      'confirm.title': 'Xoá', 'confirm.one': 'Chuyển “{name}” vào Thùng rác?', 'confirm.many': 'Chuyển {n} mục này vào Thùng rác?',
      'confirm.permOne': 'Xoá vĩnh viễn “{name}”? Không thể hoàn tác.', 'confirm.permMany': 'Xoá vĩnh viễn {n} mục này? Không thể hoàn tác.',
      'common.close': 'Đóng', 'common.cancel': 'Huỷ', 'common.ok': 'OK',
      'props.title': 'Thuộc tính', 'props.name': 'Tên', 'props.type': 'Loại', 'props.location': 'Vị trí', 'props.size': 'Kích thước',
      'props.contains': 'Chứa', 'props.containsVal': '{files} tệp, {folders} thư mục', 'props.created': 'Ngày tạo',
      'props.modified': 'Ngày sửa đổi', 'props.accessed': 'Ngày truy cập', 'props.attributes': 'Thuộc tính tệp',
      'props.readonly': 'Chỉ đọc', 'props.hidden': 'Ẩn', 'props.items': 'Đã chọn {n} mục',
      'toolbar.theme': 'Giao diện', 'toolbar.settings': 'Cài đặt', 'toolbar.about': 'Giới thiệu',
      'settings.title': 'Cài đặt', 'settings.appearance': 'Giao diện', 'settings.theme': 'Chế độ',
      'settings.light': 'Sáng', 'settings.dark': 'Tối', 'settings.system': 'Hệ thống',
      'settings.color': 'Màu chủ đề', 'settings.custom': 'Màu tuỳ chỉnh', 'settings.language': 'Ngôn ngữ',
      'settings.general': 'Chung', 'settings.defaultView': 'Kiểu xem', 'settings.showHidden': 'Hiện mục ẩn',
      'settings.confirmDelete': 'Xác nhận trước khi xoá', 'settings.reset': 'Khôi phục mặc định',
      'about.title': 'Giới thiệu Material File', 'about.desc': 'Trình quản lý tệp đơn giản, nhanh và đẹp, xây dựng bằng Tauri.',
      'about.version': 'Phiên bản', 'about.author': 'Tác giả',
      'about.ai': 'Được tạo với sự hỗ trợ của Claude, trợ lý AI của Anthropic.',
      'err.generic': 'Đã xảy ra lỗi', 'err.exists': 'Đã có mục khác trùng tên này.',
      'err.invalidName': 'Tên không hợp lệ. Tên không được chứa \\ / : * ? " < > |',
      'err.intoItself': 'Không thể sao chép hoặc di chuyển thư mục vào chính nó.', 'err.path': 'Không thể mở vị trí này',
      'msg.pasted': 'Đã xử lý {n} mục', 'msg.deleted': 'Đã xoá'
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
