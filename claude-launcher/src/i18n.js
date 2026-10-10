const vi = {
  tagline: "Mở và đóng profile Chrome, vào thẳng trang chat mới.",
  by: "Tác giả",
  withAi: "với sự hỗ trợ của AI",
  destination: "Trang đích",
  reset: "Đặt lại",
  invalidUrl: "Địa chỉ phải bắt đầu bằng http:// hoặc https://",
  search: "Tìm theo tên hoặc email",
  selectAll: "Chọn tất cả",
  clearSel: "Bỏ chọn",
  reload: "Tải lại",
  open: "Mở",
  close: "Đóng",
  running: "Đang mở",
  opening: "Đang khởi động",
  selectProfile: ({ name }) => `Chọn ${name}`,
  profiles: ({ n }) => `${n} profile`,
  selectedCount: ({ n, total }) => `Đã chọn ${n} / ${total}`,
  openSelected: ({ n }) => `Mở ${n} đã chọn`,
  openAll: ({ n }) => `Mở tất cả (${n})`,
  closeSelected: ({ n }) => `Đóng ${n} đã chọn`,
  closeAll: ({ n }) => `Đóng tất cả (${n})`,
  openedN: ({ n }) => `Đang mở ${n} profile`,
  closedN: ({ n }) => `Đã đóng ${n} cửa sổ`,
  nothingToClose: "Không có cửa sổ nào để đóng",
  loadError: "Không đọc được danh sách profile.",
  retry: "Thử lại",
  noMatch: "Không có profile nào khớp.",
  noProfiles: "Chưa có profile nào.",
  noProfilesHint: "Mở Chrome ít nhất một lần để tạo profile.",
  settings: "Cài đặt",
  language: "Ngôn ngữ",
  theme: "Giao diện",
  light: "Sáng",
  dark: "Tối",
  system: "Hệ thống",
  windowStart: "Cửa sổ khi mở app",
  remember: "Ghi nhớ kích thước",
  rememberHint: "Lần sau mở lại đúng kích thước bạn đã kéo.",
  maximized: "Luôn phóng to tối đa",
  maximizedHint: "Luôn mở app ở chế độ toàn màn hình làm việc.",
  appliesNext: "Áp dụng từ lần mở app sau.",
  err_chrome_not_found: "Không tìm thấy Chrome. Hãy cài Chrome trước.",
  err_invalid_url: "Địa chỉ phải bắt đầu bằng http:// hoặc https://",
  err_no_data_dir: "Không tìm thấy thư mục dữ liệu của Chrome.",
  err_bad_state: "File Local State của Chrome không đúng định dạng.",
  err_read_failed: "Không đọc được Local State:",
  err_unsupported: "Tính năng này hiện chỉ hỗ trợ Windows.",
};

const en = {
  tagline: "Open and close Chrome profiles, straight into a new chat.",
  by: "Created by",
  withAi: "with help from AI",
  destination: "Destination",
  reset: "Reset",
  invalidUrl: "The address must start with http:// or https://",
  search: "Search by name or email",
  selectAll: "Select all",
  clearSel: "Clear",
  reload: "Reload",
  open: "Open",
  close: "Close",
  running: "Running",
  opening: "Starting",
  selectProfile: ({ name }) => `Select ${name}`,
  profiles: ({ n }) => `${n} ${n === 1 ? "profile" : "profiles"}`,
  selectedCount: ({ n, total }) => `${n} of ${total} selected`,
  openSelected: ({ n }) => `Open ${n} selected`,
  openAll: ({ n }) => `Open all (${n})`,
  closeSelected: ({ n }) => `Close ${n} selected`,
  closeAll: ({ n }) => `Close all (${n})`,
  openedN: ({ n }) => `Opening ${n} ${n === 1 ? "profile" : "profiles"}`,
  closedN: ({ n }) => `Closed ${n} ${n === 1 ? "window" : "windows"}`,
  nothingToClose: "No open windows to close",
  loadError: "Couldn't read the profile list.",
  retry: "Try again",
  noMatch: "No profiles match your search.",
  noProfiles: "No profiles yet.",
  noProfilesHint: "Open Chrome at least once to create a profile.",
  settings: "Settings",
  language: "Language",
  theme: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "System",
  windowStart: "Window on startup",
  remember: "Remember size",
  rememberHint: "Reopens at the size you last dragged it to.",
  maximized: "Always maximized",
  maximizedHint: "Always opens filling the work area.",
  appliesNext: "Applies the next time you open the app.",
  err_chrome_not_found: "Chrome wasn't found. Please install Chrome first.",
  err_invalid_url: "The address must start with http:// or https://",
  err_no_data_dir: "Couldn't find Chrome's data folder.",
  err_bad_state: "Chrome's Local State file has an unexpected format.",
  err_read_failed: "Couldn't read Local State:",
  err_unsupported: "This feature is only supported on Windows.",
};

const dict = { vi, en };

// t("key", { n: 2 }) — chuỗi hoặc hàm; thiếu khóa thì trả lại chính khóa
export const makeT = (lang) => {
  const d = dict[lang] || en;
  return (k, v) => {
    const s = d[k] ?? en[k];
    if (s === undefined) return k;
    return typeof s === "function" ? s(v || {}) : s;
  };
};

// Lỗi từ Rust có dạng "code" hoặc "code:chi tiết"
export const errText = (t, e) => {
  const raw = String(e);
  const i = raw.indexOf(":");
  const code = i < 0 ? raw : raw.slice(0, i);
  const msg = t(`err_${code}`);
  if (msg === `err_${code}`) return raw;
  return i < 0 ? msg : `${msg} ${raw.slice(i + 1)}`;
};
