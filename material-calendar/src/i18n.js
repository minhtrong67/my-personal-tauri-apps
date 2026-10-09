const dict = {
  en: {
    'app.name': 'Calendar', today: 'Today', month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda',
    create: 'Create', search: 'Search events', settings: 'Settings', upcoming: 'Upcoming',
    noUpcoming: 'Nothing coming up', more: 'more', allDay: 'All day', newEvent: 'New event',
    editEvent: 'Edit event', title: 'Title', date: 'Date', start: 'Start', end: 'End', repeat: 'Repeat',
    'r.none': 'Does not repeat', 'r.daily': 'Daily', 'r.weekly': 'Weekly', 'r.monthly': 'Monthly', 'r.yearly': 'Yearly',
    remind: 'Reminder', 'rm.-1': 'None', 'rm.0': 'At start time', 'rm.5': '5 minutes before', 'rm.15': '15 minutes before',
    'rm.30': '30 minutes before', 'rm.60': '1 hour before', desc: 'Description', save: 'Save', cancel: 'Cancel',
    delete: 'Delete', deleted: 'Event deleted', undo: 'Undo', saved: 'Event saved',
    needTitle: 'Enter a title for the event', badTime: 'End time must be after start time',
    reminder: 'Reminder', noResults: 'No events found', menu: 'Menu', prev: 'Previous', next: 'Next', close: 'Close',
    's.appearance': 'Appearance', 's.theme': 'Theme', 't.system': 'System', 't.light': 'Light', 't.dark': 'Dark',
    's.color': 'Theme color', 's.custom': 'Custom color', 's.language': 'Language', 'l.auto': 'Auto',
    's.window': 'Window on startup', 'w.remember': 'Remember size', 'w.rememberD': 'Reopen at the size you last resized to',
    'w.max': 'Always maximized', 'w.maxD': 'Always start in maximized mode',
    's.calendar': 'Calendar', 's.weekStart': 'Week starts on', 'd.mon': 'Monday', 'd.sun': 'Sunday',
    's.holidays': 'Show public holidays (Vietnam)', 's.anim': 'Animations', 's.about': 'About',
    's.author': 'Author', 's.assist': 'Built with help from', 's.version': 'Version',
    'h.newYear': "New Year's Day", 'h.liberation': 'Reunification Day', 'h.labour': 'International Labour Day', 'h.national': 'National Day',
    shortcuts: 'Shortcuts: N new · T today · M/W/D/A views · ←/→ navigate · Ctrl+K search',
  },
  vi: {
    'app.name': 'Lịch', today: 'Hôm nay', month: 'Tháng', week: 'Tuần', day: 'Ngày', agenda: 'Lịch trình',
    create: 'Tạo sự kiện', search: 'Tìm sự kiện', settings: 'Cài đặt', upcoming: 'Sắp tới',
    noUpcoming: 'Không có sự kiện sắp tới', more: 'nữa', allDay: 'Cả ngày', newEvent: 'Sự kiện mới',
    editEvent: 'Sửa sự kiện', title: 'Tiêu đề', date: 'Ngày', start: 'Bắt đầu', end: 'Kết thúc', repeat: 'Lặp lại',
    'r.none': 'Không lặp lại', 'r.daily': 'Hằng ngày', 'r.weekly': 'Hằng tuần', 'r.monthly': 'Hằng tháng', 'r.yearly': 'Hằng năm',
    remind: 'Nhắc nhở', 'rm.-1': 'Không', 'rm.0': 'Đúng giờ bắt đầu', 'rm.5': 'Trước 5 phút', 'rm.15': 'Trước 15 phút',
    'rm.30': 'Trước 30 phút', 'rm.60': 'Trước 1 giờ', desc: 'Mô tả', save: 'Lưu', cancel: 'Hủy',
    delete: 'Xóa', deleted: 'Đã xóa sự kiện', undo: 'Hoàn tác', saved: 'Đã lưu sự kiện',
    needTitle: 'Hãy nhập tiêu đề cho sự kiện', badTime: 'Giờ kết thúc phải sau giờ bắt đầu',
    reminder: 'Nhắc nhở', noResults: 'Không tìm thấy sự kiện', menu: 'Menu', prev: 'Trước', next: 'Sau', close: 'Đóng',
    's.appearance': 'Giao diện', 's.theme': 'Chế độ', 't.system': 'Hệ thống', 't.light': 'Sáng', 't.dark': 'Tối',
    's.color': 'Màu chủ đề', 's.custom': 'Màu tùy chỉnh', 's.language': 'Ngôn ngữ', 'l.auto': 'Tự động',
    's.window': 'Cửa sổ khi mở app', 'w.remember': 'Ghi nhớ kích thước', 'w.rememberD': 'Lần sau mở lại đúng kích thước bạn đã chỉnh',
    'w.max': 'Luôn phóng to tối đa', 'w.maxD': 'Luôn mở app ở chế độ phóng to tối đa',
    's.calendar': 'Lịch', 's.weekStart': 'Tuần bắt đầu từ', 'd.mon': 'Thứ Hai', 'd.sun': 'Chủ nhật',
    's.holidays': 'Hiển thị ngày lễ (Việt Nam)', 's.anim': 'Hiệu ứng chuyển động', 's.about': 'Giới thiệu',
    's.author': 'Tác giả', 's.assist': 'Với sự hỗ trợ của', 's.version': 'Phiên bản',
    'h.newYear': 'Tết Dương lịch', 'h.liberation': 'Ngày Giải phóng miền Nam', 'h.labour': 'Quốc tế Lao động', 'h.national': 'Quốc khánh',
    shortcuts: 'Phím tắt: N tạo mới · T hôm nay · M/W/D/A đổi chế độ xem · ←/→ chuyển kỳ · Ctrl+K tìm kiếm',
  },
};

let cur = 'en';
export const resolveLang = (l) => (l === 'auto' ? ((navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en') : l);
export const setLang = (l) => { cur = resolveLang(l); document.documentElement.lang = cur; };
export const getLang = () => cur;
export const locale = () => (cur === 'vi' ? 'vi-VN' : 'en-US');
export const t = (k) => dict[cur][k] ?? dict.en[k] ?? k;
