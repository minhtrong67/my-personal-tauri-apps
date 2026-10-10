#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};
use tauri::Manager;

const AVATAR_FILE: &str = "Google Profile Picture.png";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Profile {
    dir: String,
    name: String,
    email: String,
    has_avatar: bool,
}

// (thư mục, tên hiển thị) — cache để việc dò profile đang mở không phải đọc lại file
fn names() -> &'static Mutex<Vec<(String, String)>> {
    static N: OnceLock<Mutex<Vec<(String, String)>>> = OnceLock::new();
    N.get_or_init(Default::default)
}

// Cửa sổ Chrome do app này mở, theo từng profile
fn tracked() -> &'static Mutex<HashMap<String, Vec<isize>>> {
    static T: OnceLock<Mutex<HashMap<String, Vec<isize>>>> = OnceLock::new();
    T.get_or_init(Default::default)
}

static LAUNCH_LOCK: Mutex<()> = Mutex::new(());

#[cfg(target_os = "windows")]
fn user_data_dir() -> Option<PathBuf> {
    env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join(r"Google\Chrome\User Data"))
}
#[cfg(target_os = "macos")]
fn user_data_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(|p| PathBuf::from(p).join("Library/Application Support/Google/Chrome"))
}
#[cfg(target_os = "linux")]
fn user_data_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(|p| PathBuf::from(p).join(".config/google-chrome"))
}

#[cfg(target_os = "windows")]
fn chrome_path() -> Option<PathBuf> {
    ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"]
        .iter()
        .filter_map(|v| env::var_os(v))
        .map(|base| PathBuf::from(base).join(r"Google\Chrome\Application\chrome.exe"))
        .find(|p| p.exists())
}
#[cfg(target_os = "macos")]
fn chrome_path() -> Option<PathBuf> {
    let p = PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    p.exists().then_some(p)
}
#[cfg(target_os = "linux")]
fn chrome_path() -> Option<PathBuf> {
    Some(PathBuf::from("google-chrome"))
}

// Win32 thuần (user32/kernel32), không cần thêm crate
#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    type Hwnd = *mut c_void;
    type Handle = *mut c_void;
    type EnumProc = unsafe extern "system" fn(Hwnd, isize) -> i32;

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(cb: EnumProc, lparam: isize) -> i32;
        fn IsWindowVisible(h: Hwnd) -> i32;
        fn GetClassNameW(h: Hwnd, buf: *mut u16, max: i32) -> i32;
        fn GetWindowTextW(h: Hwnd, buf: *mut u16, max: i32) -> i32;
        fn GetWindowThreadProcessId(h: Hwnd, pid: *mut u32) -> u32;
        fn PostMessageW(h: Hwnd, msg: u32, w: usize, l: isize) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        fn QueryFullProcessImageNameW(p: Handle, flags: u32, buf: *mut u16, size: *mut u32) -> i32;
        fn CloseHandle(h: Handle) -> i32;
    }

    const WM_CLOSE: u32 = 0x0010;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    fn is_chrome(h: Hwnd) -> bool {
        unsafe {
            let mut pid = 0u32;
            GetWindowThreadProcessId(h, &mut pid);
            let p = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if p.is_null() {
                return false;
            }
            let mut buf = [0u16; 520];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(p, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(p);
            ok != 0
                && String::from_utf16_lossy(&buf[..len as usize])
                    .to_lowercase()
                    .ends_with("\\chrome.exe")
        }
    }

    unsafe extern "system" fn collect(h: Hwnd, lp: isize) -> i32 {
        let out = &mut *(lp as *mut Vec<(isize, String)>);
        if IsWindowVisible(h) != 0 {
            let mut cls = [0u16; 64];
            let n = GetClassNameW(h, cls.as_mut_ptr(), 64);
            if n > 0 && String::from_utf16_lossy(&cls[..n as usize]) == "Chrome_WidgetWin_1" {
                let mut t = [0u16; 512];
                let n = GetWindowTextW(h, t.as_mut_ptr(), 512);
                if n > 0 && is_chrome(h) {
                    out.push((h as isize, String::from_utf16_lossy(&t[..n as usize])));
                }
            }
        }
        1
    }

    // Các cửa sổ Chrome đang hiện: (handle, tiêu đề)
    pub fn chrome_windows() -> Vec<(isize, String)> {
        let mut out: Vec<(isize, String)> = Vec::new();
        unsafe {
            EnumWindows(collect, &mut out as *mut _ as isize);
        }
        out
    }

    // Gửi yêu cầu đóng bình thường, Chrome vẫn hỏi/lưu phiên như khi bấm X
    pub fn close(h: isize) {
        unsafe {
            PostMessageW(h as Hwnd, WM_CLOSE, 0, 0);
        }
    }
}

#[cfg(not(windows))]
mod win {
    pub fn chrome_windows() -> Vec<(isize, String)> {
        Vec::new()
    }
    pub fn close(_: isize) {}
}

// Đọc danh sách profile từ file Local State của Chrome
fn read_profiles() -> Result<Vec<Profile>, String> {
    let root = user_data_dir().ok_or("no_data_dir")?;
    let raw = fs::read_to_string(root.join("Local State"))
        .map_err(|e| format!("read_failed:{e}"))?;
    let json: serde_json::Value = serde_json::from_str(&raw).map_err(|_| "bad_state")?;
    let cache = json["profile"]["info_cache"].as_object().ok_or("bad_state")?;

    let mut list: Vec<Profile> = cache
        .iter()
        .map(|(dir, v)| {
            let text = |k: &str| v[k].as_str().unwrap_or("").to_string();
            Profile {
                dir: dir.clone(),
                name: text("name"),
                email: text("user_name"),
                has_avatar: root.join(dir).join(AVATAR_FILE).is_file(),
            }
        })
        .collect();
    list.sort_by_key(|p| p.name.to_lowercase());

    *names().lock().unwrap() = list.iter().map(|p| (p.dir.clone(), p.name.clone())).collect();
    Ok(list)
}

// Gom cửa sổ Chrome theo profile: ưu tiên cửa sổ app đã mở, bổ sung bằng tiêu đề cửa sổ
fn profile_windows() -> HashMap<String, Vec<isize>> {
    let wins = win::chrome_windows();
    let live: HashSet<isize> = wins.iter().map(|w| w.0).collect();
    let mut map: HashMap<String, Vec<isize>> = HashMap::new();

    {
        let mut t = tracked().lock().unwrap();
        for (dir, hs) in t.iter_mut() {
            hs.retain(|h| live.contains(h));
            if !hs.is_empty() {
                map.insert(dir.clone(), hs.clone());
            }
        }
    }

    let empty = names().lock().unwrap().is_empty();
    if empty {
        let _ = read_profiles();
    }
    let known = names().lock().unwrap().clone();

    for (h, title) in &wins {
        let best = known
            .iter()
            .filter(|(_, n)| !n.is_empty() && title.ends_with(&format!(" - {n}")))
            .max_by_key(|(_, n)| n.len());
        if let Some((dir, _)) = best {
            let e = map.entry(dir.clone()).or_default();
            if !e.contains(h) {
                e.push(*h);
            }
        }
    }
    map
}

// Mở một profile rồi đợi cửa sổ mới xuất hiện để ghi nhận
fn launch_one(chrome: &Path, dir: &str, url: &str) {
    let before: HashSet<isize> = win::chrome_windows().into_iter().map(|w| w.0).collect();
    let spawned = Command::new(chrome)
        .arg(format!("--profile-directory={dir}"))
        .arg("--new-window")
        .arg(url)
        .spawn();
    if spawned.is_err() {
        return;
    }
    if !cfg!(windows) {
        thread::sleep(Duration::from_millis(700));
        return;
    }
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(6) {
        thread::sleep(Duration::from_millis(150));
        if win::chrome_windows().iter().any(|w| !before.contains(&w.0)) {
            thread::sleep(Duration::from_millis(250));
            let fresh: Vec<isize> = win::chrome_windows()
                .into_iter()
                .map(|w| w.0)
                .filter(|h| !before.contains(h))
                .collect();
            tracked()
                .lock()
                .unwrap()
                .entry(dir.to_string())
                .or_default()
                .extend(fresh);
            return;
        }
    }
}

#[tauri::command]
async fn list_profiles() -> Result<Vec<Profile>, String> {
    read_profiles()
}

// Trả ảnh dạng byte thô, nhẹ hơn base64 và chỉ tải khi hàng được hiển thị
#[tauri::command]
async fn profile_avatar(dir: String) -> Result<tauri::ipc::Response, String> {
    if dir.is_empty() || dir.contains(['/', '\\']) || dir.contains("..") {
        return Err("bad_dir".into());
    }
    let root = user_data_dir().ok_or("no_data_dir")?;
    let bytes = fs::read(root.join(&dir).join(AVATAR_FILE)).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
async fn launch_profiles(dirs: Vec<String>, url: String) -> Result<usize, String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("invalid_url".into());
    }
    let chrome = chrome_path().ok_or("chrome_not_found")?;
    let count = dirs.len();
    thread::spawn(move || {
        let _guard = LAUNCH_LOCK.lock().unwrap();
        for dir in dirs {
            launch_one(&chrome, &dir, &url);
        }
    });
    Ok(count)
}

#[tauri::command]
async fn running_profiles() -> Vec<String> {
    profile_windows().into_keys().collect()
}

// Trả về số cửa sổ đã gửi yêu cầu đóng
#[tauri::command]
async fn close_profiles(dirs: Vec<String>) -> Result<usize, String> {
    if !cfg!(windows) {
        return Err("unsupported".into());
    }
    let map = profile_windows();
    let mut n = 0;
    for d in &dirs {
        if let Some(hs) = map.get(d) {
            for h in hs {
                win::close(*h);
                n += 1;
            }
        }
    }
    Ok(n)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Cửa sổ ẩn lúc đầu để áp dụng kích thước; phòng khi giao diện lỗi thì vẫn hiện sau 4 giây
            if let Some(w) = app.get_webview_window("main") {
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(4));
                    if !w.is_visible().unwrap_or(false) {
                        let _ = w.show();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_profiles,
            profile_avatar,
            launch_profiles,
            running_profiles,
            close_profiles
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the app");
}
