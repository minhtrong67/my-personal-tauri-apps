// English / Vietnamese strings. Function names inside formulas always stay in English (like Excel's en-US).
const D = {
  en: {
    "cmd.new": "New workbook", "cmd.open": "Open…", "cmd.save": "Save", "cmd.saveAs": "Save as…", "cmd.exportCsv": "Export sheet as CSV…", "cmd.importCsv": "Import CSV as new sheet…", "cmd.print": "Print…",
    "cmd.undo": "Undo", "cmd.redo": "Redo", "cmd.cut": "Cut", "cmd.copy": "Copy", "cmd.paste": "Paste", "cmd.pasteValues": "Paste values only", "cmd.pasteFormats": "Paste formatting only",
    "cmd.clearContents": "Clear contents", "cmd.clearFormats": "Clear formatting", "cmd.clearAll": "Clear all", "cmd.selectAll": "Select all", "cmd.find": "Find…", "cmd.replace": "Find and replace…",
    "cmd.rowAbove": "Insert row above", "cmd.rowBelow": "Insert row below", "cmd.colLeft": "Insert column left", "cmd.colRight": "Insert column right", "cmd.delRow": "Delete row(s)", "cmd.delCol": "Delete column(s)",
    "cmd.newSheet": "New sheet", "cmd.autosum": "AutoSum", "cmd.sortAsc": "Sort A → Z", "cmd.sortDesc": "Sort Z → A", "cmd.filter": "Filter",
    "cmd.freezeRow": "Freeze top row", "cmd.freezeCol": "Freeze first column", "cmd.freezeSel": "Freeze at selection", "cmd.unfreeze": "Unfreeze panes",
    "cmd.zoomIn": "Zoom in", "cmd.zoomOut": "Zoom out", "cmd.zoomReset": "Reset zoom", "cmd.gridlines": "Show gridlines", "cmd.fullscreen": "Full screen",
    "cmd.shortcuts": "Keyboard shortcuts", "cmd.about": "About Material Xlsx", "cmd.settings": "Settings",
    "cmd.bold": "Bold", "cmd.italic": "Italic", "cmd.underline": "Underline", "cmd.strike": "Strikethrough", "cmd.wrap": "Wrap text", "cmd.merge": "Merge cells",
    "cmd.alignL": "Align left", "cmd.alignC": "Center", "cmd.alignR": "Align right", "cmd.vTop": "Align top", "cmd.vMid": "Align middle", "cmd.vBot": "Align bottom",
    "cmd.decInc": "Increase decimals", "cmd.decDec": "Decrease decimals",
    "menu.file": "File", "menu.edit": "Edit", "menu.insert": "Insert", "menu.data": "Data", "menu.view": "View", "menu.help": "Help", "menu.recent": "Recent files",
    "tb.font": "Font", "tb.fontdefault": "System UI", "tb.size": "Font size", "tb.numfmt": "Number format", "tb.textcolor": "Text color", "tb.fill": "Fill color", "tb.borders": "Borders",
    "tb.valign": "Vertical alignment", "tb.cells": "Insert / delete cells", "tb.clear": "Clear", "tb.freeze": "Freeze panes", "tb.auto": "Automatic", "tb.nofill": "No fill", "tb.custom": "Custom",
    "bd.all": "All borders", "bd.outer": "Outer borders", "bd.top": "Top border", "bd.bottom": "Bottom border", "bd.left": "Left border", "bd.right": "Right border", "bd.none": "No borders",
    "nf.general": "General", "nf.int": "Number (0)", "nf.dec2": "Number (0.00)", "nf.thou": "Thousands (#,##0)", "nf.thou2": "Thousands (#,##0.00)", "nf.usd": "Currency ($)", "nf.vnd": "Currency (₫)", "nf.eur": "Currency (€)",
    "nf.pct": "Percent (0%)", "nf.pct2": "Percent (0.00%)", "nf.sci": "Scientific", "nf.dateiso": "Date (yyyy-mm-dd)", "nf.datedmy": "Date (dd/mm/yyyy)", "nf.datemdy": "Date (mm/dd/yyyy)", "nf.datetime": "Date & time", "nf.time": "Time (hh:mm:ss)", "nf.text": "Text", "nf.custom": "Custom…",
    "tab.add": "Add sheet", "tab.prev": "Scroll left", "tab.next": "Scroll right", "tab.rename": "Rename", "tab.duplicate": "Duplicate", "tab.color": "Tab color", "tab.left": "Move left", "tab.right": "Move right", "tab.delete": "Delete sheet",
    "stat.ready": "Ready", "stat.sum": "Sum", "stat.avg": "Average", "stat.count": "Count", "stat.min": "Min", "stat.max": "Max",
    "bar.namebox": "Name box", "bar.formula": "Enter a value or formula",
    "btn.apply": "Apply", "btn.cancel": "Cancel", "btn.close": "Close", "btn.discard": "Don't save", "btn.save": "Save",
    "dlg.customfmt": "Custom number format", "dlg.fmthint": 'Examples: 0.00 · #,##0 · 0.0% · yyyy-mm-dd · "$"#,##0.00', "dlg.deltitle": "Delete sheet?", "dlg.deltext": 'Sheet "{name}" and all of its data will be deleted.',
    "dlg.unsaved": "Save changes?", "dlg.unsavedtext": '"{name}" has unsaved changes.',
    "doc.untitled": "Untitled", "drop.hint": "Drop an .xlsx or .csv file to open it",
    "find.find": "Find", "find.replacewith": "Replace with", "find.replace": "Replace", "find.replaceall": "Replace all", "find.case": "Match case", "find.whole": "Entire cell", "find.allsheets": "All sheets",
    "find.prev": "Previous (Shift+Enter)", "find.next": "Next (Enter)", "find.count": "{i} of {n}", "find.none": "No results", "find.replaced": "Replaced {n} cell(s)",
    "flt.search": "Search", "flt.all": "(Select all)", "flt.blank": "(Blank)",
    "set.appearance": "Appearance", "set.color": "Theme color", "set.language": "Language", "set.general": "General", "set.gridlines": "Show gridlines", "set.anim": "Animations", "set.animdesc": "Smooth transitions, ripples and motion", "set.about": "About", "set.fullscreen": "Always start in full screen", "set.fullscreendesc": "Open Material Xlsx in full screen every time (F11 toggles it any time)",
    "about.by": "Created by <b class='hl'>minhtrong67</b> with the support of AI <b class='hl ai'>Claude</b> (Anthropic)", "about.version": "Version {v}",
    "theme.system": "System", "theme.light": "Light", "theme.dark": "Dark", "app.language": "Language", "app.theme": "Appearance",
    "color.green": "Green", "color.blue": "Blue", "color.purple": "Purple", "color.teal": "Teal", "color.orange": "Orange", "color.pink": "Pink", "color.red": "Red", "color.gold": "Gold", "color.slate": "Slate",
    "sc.fill": "Fill down / right", "sc.jump": "Jump to data edge", "sc.selcolrow": "Select column / row", "sc.edit": "Edit cell", "sc.newline": "New line in cell", "sc.move": "Move down / right", "sc.zoom": "Zoom in / out / reset",
    "toast.badname": "Invalid or duplicate sheet name", "toast.copied": "Copied", "toast.cut": "Cut", "toast.empty": "Nothing to print", "toast.exported": "Exported {name}", "toast.imported": "Imported {name} as a new sheet",
    "toast.missing": "Can't find {name}; removed from recent files", "toast.nofilter": "Select a range with a header row first", "toast.nosort": "Select a column of data to sort",
    "toast.opened": "Opened {name}", "toast.openfail": "Couldn't open the file: {err}", "toast.saved": "Saved {name}", "toast.savefail": "Couldn't save: {err}",
    "zoom.out": "Zoom out", "zoom.in": "Zoom in", "zoom.label": "Zoom",
  },
  vi: {
    "cmd.new": "Tạo bảng tính mới", "cmd.open": "Mở…", "cmd.save": "Lưu", "cmd.saveAs": "Lưu thành…", "cmd.exportCsv": "Xuất sheet ra CSV…", "cmd.importCsv": "Nhập CSV thành sheet mới…", "cmd.print": "In…",
    "cmd.undo": "Hoàn tác", "cmd.redo": "Làm lại", "cmd.cut": "Cắt", "cmd.copy": "Sao chép", "cmd.paste": "Dán", "cmd.pasteValues": "Dán chỉ giá trị", "cmd.pasteFormats": "Dán chỉ định dạng",
    "cmd.clearContents": "Xoá nội dung", "cmd.clearFormats": "Xoá định dạng", "cmd.clearAll": "Xoá tất cả", "cmd.selectAll": "Chọn tất cả", "cmd.find": "Tìm kiếm…", "cmd.replace": "Tìm và thay thế…",
    "cmd.rowAbove": "Chèn hàng phía trên", "cmd.rowBelow": "Chèn hàng phía dưới", "cmd.colLeft": "Chèn cột bên trái", "cmd.colRight": "Chèn cột bên phải", "cmd.delRow": "Xoá hàng", "cmd.delCol": "Xoá cột",
    "cmd.newSheet": "Sheet mới", "cmd.autosum": "Tính tổng tự động", "cmd.sortAsc": "Sắp xếp A → Z", "cmd.sortDesc": "Sắp xếp Z → A", "cmd.filter": "Bộ lọc",
    "cmd.freezeRow": "Cố định hàng đầu", "cmd.freezeCol": "Cố định cột đầu", "cmd.freezeSel": "Cố định tại ô đang chọn", "cmd.unfreeze": "Bỏ cố định",
    "cmd.zoomIn": "Phóng to", "cmd.zoomOut": "Thu nhỏ", "cmd.zoomReset": "Đặt lại thu phóng", "cmd.gridlines": "Hiện đường lưới", "cmd.fullscreen": "Toàn màn hình",
    "cmd.shortcuts": "Phím tắt", "cmd.about": "Giới thiệu Material Xlsx", "cmd.settings": "Cài đặt",
    "cmd.bold": "In đậm", "cmd.italic": "In nghiêng", "cmd.underline": "Gạch chân", "cmd.strike": "Gạch ngang", "cmd.wrap": "Xuống dòng tự động", "cmd.merge": "Gộp ô",
    "cmd.alignL": "Căn trái", "cmd.alignC": "Căn giữa", "cmd.alignR": "Căn phải", "cmd.vTop": "Căn trên", "cmd.vMid": "Căn giữa theo chiều dọc", "cmd.vBot": "Căn dưới",
    "cmd.decInc": "Tăng số thập phân", "cmd.decDec": "Giảm số thập phân",
    "menu.file": "Tệp", "menu.edit": "Chỉnh sửa", "menu.insert": "Chèn", "menu.data": "Dữ liệu", "menu.view": "Xem", "menu.help": "Trợ giúp", "menu.recent": "Tệp gần đây",
    "tb.font": "Phông chữ", "tb.fontdefault": "Mặc định (hệ thống)", "tb.size": "Cỡ chữ", "tb.numfmt": "Định dạng số", "tb.textcolor": "Màu chữ", "tb.fill": "Màu nền ô", "tb.borders": "Đường viền",
    "tb.valign": "Căn dọc", "tb.cells": "Chèn / xoá ô", "tb.clear": "Xoá", "tb.freeze": "Cố định ngăn", "tb.auto": "Tự động", "tb.nofill": "Không tô màu", "tb.custom": "Tuỳ chọn",
    "bd.all": "Tất cả đường viền", "bd.outer": "Viền ngoài", "bd.top": "Viền trên", "bd.bottom": "Viền dưới", "bd.left": "Viền trái", "bd.right": "Viền phải", "bd.none": "Không viền",
    "nf.general": "Chung", "nf.int": "Số nguyên (0)", "nf.dec2": "Số (0.00)", "nf.thou": "Hàng nghìn (#,##0)", "nf.thou2": "Hàng nghìn (#,##0.00)", "nf.usd": "Tiền tệ ($)", "nf.vnd": "Tiền tệ (₫)", "nf.eur": "Tiền tệ (€)",
    "nf.pct": "Phần trăm (0%)", "nf.pct2": "Phần trăm (0.00%)", "nf.sci": "Khoa học", "nf.dateiso": "Ngày (yyyy-mm-dd)", "nf.datedmy": "Ngày (dd/mm/yyyy)", "nf.datemdy": "Ngày (mm/dd/yyyy)", "nf.datetime": "Ngày và giờ", "nf.time": "Giờ (hh:mm:ss)", "nf.text": "Văn bản", "nf.custom": "Tuỳ chỉnh…",
    "tab.add": "Thêm sheet", "tab.prev": "Cuộn trái", "tab.next": "Cuộn phải", "tab.rename": "Đổi tên", "tab.duplicate": "Nhân bản", "tab.color": "Màu thẻ", "tab.left": "Chuyển sang trái", "tab.right": "Chuyển sang phải", "tab.delete": "Xoá sheet",
    "stat.ready": "Sẵn sàng", "stat.sum": "Tổng", "stat.avg": "Trung bình", "stat.count": "Đếm", "stat.min": "Nhỏ nhất", "stat.max": "Lớn nhất",
    "bar.namebox": "Hộp tên ô", "bar.formula": "Nhập giá trị hoặc công thức",
    "btn.apply": "Áp dụng", "btn.cancel": "Huỷ", "btn.close": "Đóng", "btn.discard": "Không lưu", "btn.save": "Lưu",
    "dlg.customfmt": "Định dạng số tuỳ chỉnh", "dlg.fmthint": 'Ví dụ: 0.00 · #,##0 · 0.0% · yyyy-mm-dd · "$"#,##0.00', "dlg.deltitle": "Xoá sheet?", "dlg.deltext": 'Sheet "{name}" và toàn bộ dữ liệu bên trong sẽ bị xoá.',
    "dlg.unsaved": "Lưu thay đổi?", "dlg.unsavedtext": '"{name}" có thay đổi chưa được lưu.',
    "doc.untitled": "Chưa đặt tên", "drop.hint": "Thả tệp .xlsx hoặc .csv để mở",
    "find.find": "Tìm", "find.replacewith": "Thay bằng", "find.replace": "Thay", "find.replaceall": "Thay tất cả", "find.case": "Phân biệt hoa thường", "find.whole": "Khớp toàn bộ ô", "find.allsheets": "Mọi sheet",
    "find.prev": "Trước (Shift+Enter)", "find.next": "Sau (Enter)", "find.count": "{i} / {n}", "find.none": "Không có kết quả", "find.replaced": "Đã thay thế {n} ô",
    "flt.search": "Tìm", "flt.all": "(Chọn tất cả)", "flt.blank": "(Trống)",
    "set.appearance": "Giao diện", "set.color": "Màu chủ đề", "set.language": "Ngôn ngữ", "set.general": "Chung", "set.gridlines": "Hiện đường lưới", "set.anim": "Hiệu ứng chuyển động", "set.animdesc": "Chuyển cảnh mượt, hiệu ứng gợn sóng và chuyển động", "set.about": "Giới thiệu", "set.fullscreen": "Luôn mở ở chế độ toàn màn hình", "set.fullscreendesc": "Mỗi lần mở Material Xlsx sẽ ở toàn màn hình (nhấn F11 để bật/tắt bất cứ lúc nào)",
    "about.by": "Tác giả: <b class='hl'>minhtrong67</b> · Có sự hỗ trợ của AI <b class='hl ai'>Claude</b> (Anthropic)", "about.version": "Phiên bản {v}",
    "theme.system": "Theo hệ thống", "theme.light": "Sáng", "theme.dark": "Tối", "app.language": "Ngôn ngữ", "app.theme": "Giao diện",
    "color.green": "Xanh lá", "color.blue": "Xanh dương", "color.purple": "Tím", "color.teal": "Xanh ngọc", "color.orange": "Cam", "color.pink": "Hồng", "color.red": "Đỏ", "color.gold": "Vàng", "color.slate": "Xám xanh",
    "sc.fill": "Điền xuống / sang phải", "sc.jump": "Nhảy tới mép dữ liệu", "sc.selcolrow": "Chọn cột / hàng", "sc.edit": "Sửa ô", "sc.newline": "Xuống dòng trong ô", "sc.move": "Xuống / sang phải", "sc.zoom": "Phóng to / thu nhỏ / đặt lại",
    "toast.badname": "Tên sheet không hợp lệ hoặc bị trùng", "toast.copied": "Đã sao chép", "toast.cut": "Đã cắt", "toast.empty": "Không có gì để in", "toast.exported": "Đã xuất {name}", "toast.imported": "Đã nhập {name} thành sheet mới",
    "toast.missing": "Không tìm thấy {name}, đã gỡ khỏi danh sách gần đây", "toast.nofilter": "Hãy chọn vùng dữ liệu có hàng tiêu đề trước", "toast.nosort": "Hãy chọn một cột dữ liệu để sắp xếp",
    "toast.opened": "Đã mở {name}", "toast.openfail": "Không mở được tệp: {err}", "toast.saved": "Đã lưu {name}", "toast.savefail": "Không lưu được: {err}",
    "zoom.out": "Thu nhỏ", "zoom.in": "Phóng to", "zoom.label": "Thu phóng",
  },
};
let lang = "en";
export const getLang = () => lang;
export function setLang(l) { lang = D[l] ? l : "en"; }
export function t(k, p) {
  let s = (D[lang] && D[lang][k]) ?? D.en[k] ?? k;
  if (p) for (const [a, b] of Object.entries(p)) s = s.replace(new RegExp(`\\{${a}\\}`, "g"), b);
  return s;
}
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n)));
  root.querySelectorAll("[data-i18n-title]").forEach((e) => { const v = t(e.dataset.i18nTitle); e.title = v; e.setAttribute("aria-label", v); });
}
export const DICT_KEYS = { en: Object.keys(D.en), vi: Object.keys(D.vi) };
