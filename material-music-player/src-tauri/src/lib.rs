use base64::{engine::general_purpose::STANDARD, Engine as _};
use lofty::picture::PictureType;
use lofty::prelude::*;
use lofty::tag::ItemKey;
use lofty::config::{ParseOptions, ParsingMode};
use lofty::file::TaggedFile;
use lofty::probe::Probe;
use lofty::tag::Tag;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, Window};
use walkdir::WalkDir;

const AUDIO_EXTS: [&str; 8] = ["mp3", "flac", "wav", "ogg", "oga", "opus", "m4a", "aac"];

struct AppFlags {
    close_to_tray: AtomicBool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TrackInfo {
    id: String,
    path: String,
    title: String,
    artist: String,
    album: String,
    album_artist: String,
    genre: String,
    year: u32,
    track_no: u32,
    duration: f64,
    bitrate: u32,
    sample_rate: u32,
    format: String,
    size: u64,
    added_at: u64,
    folder: String,
    has_cover: bool,
    modified: u64,
    cover: String,
}

#[derive(Serialize)]
struct Found {
    id: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    tracks: Vec<TrackInfo>,
    found: Vec<Found>,
}

#[derive(Deserialize)]
struct Known {
    path: String,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverResult {
    file: String,
    data_url: Option<String>,
}

// ---------- tiện ích ----------

fn fnv(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.to_lowercase().bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

fn fnv_bytes(bytes: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

fn is_audio(p: &Path) -> bool {
    p.extension()
        .map(|e| AUDIO_EXTS.contains(&e.to_string_lossy().to_lowercase().as_str()))
        .unwrap_or(false)
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn non_empty(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

/// Chuẩn hoá đường dẫn để so sánh: đổi / thành \ và chữ thường
fn norm_key(s: &str) -> String {
    s.replace('/', "\\").to_lowercase()
}

fn track_id(path: &str) -> String {
    fnv(&norm_key(path))
}

/// Bỏ tiền tố \\?\ mà canonicalize() của Windows thêm vào
fn strip_verbatim(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy().to_string();
    if let Some(r) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{}", r))
    } else if let Some(r) = s.strip_prefix(r"\\?\") {
        PathBuf::from(r.to_string())
    } else {
        p
    }
}

fn mtime(m: &fs::Metadata) -> u64 {
    m.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Ổ đĩa / thư mục gốc của đường dẫn có đang truy cập được không (tránh xóa nhầm khi ổ đĩa bị rút)
fn root_exists(p: &Path) -> bool {
    let mut root = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Prefix(_) | Component::RootDir => root.push(c.as_os_str()),
            _ => break,
        }
    }
    root.as_os_str().is_empty() || root.exists()
}

fn open_tagged(path: &Path) -> Option<TaggedFile> {
    Probe::open(path)
        .ok()
        .and_then(|p| {
            p.options(ParseOptions::new().parsing_mode(ParsingMode::Relaxed))
                .guess_file_type()
                .ok()
        })
        .and_then(|p| p.read().ok())
        .or_else(|| lofty::read_from_path(path).ok())
}

fn cover_bytes(tags: &[Tag], path: &Path) -> Option<Vec<u8>> {
    for tag in tags {
        if let Some(p) = tag
            .pictures()
            .iter()
            .find(|x| x.pic_type() == PictureType::CoverFront && !x.data().is_empty())
        {
            return Some(p.data().to_vec());
        }
    }
    for tag in tags {
        if let Some(p) = tag.pictures().iter().find(|x| !x.data().is_empty()) {
            return Some(p.data().to_vec());
        }
    }
    // Ảnh cạnh bài hát chỉ dùng cho bài thuộc một album thật (có thẻ album),
    // tránh gán nhầm ảnh của album khác cho các bài lẻ trong cùng thư mục.
    let has_album = tags
        .iter()
        .any(|t| t.album().map(|a| !a.trim().is_empty()).unwrap_or(false));
    if !has_album {
        return None;
    }
    let dir = path.parent()?;
    for name in ["cover", "folder", "front", "albumart"] {
        for ext in ["jpg", "jpeg", "png", "webp"] {
            let c = dir.join(format!("{}.{}", name, ext));
            if c.is_file() {
                return fs::read(c).ok();
            }
        }
    }
    None
}

/// Ghi ảnh bìa vào bộ nhớ đệm (tên tệp = mã băm nội dung nên không bị trùng lặp)
fn save_cover(dir: &Path, bytes: &[u8]) -> Option<String> {
    let (ext, _) = sniff(bytes);
    fs::create_dir_all(dir).ok()?;
    let file = dir.join(format!("{}.{}", fnv_bytes(bytes), ext));
    if !file.exists() {
        fs::write(&file, bytes).ok()?;
    }
    Some(file.to_string_lossy().to_string())
}

fn read_track(path: &Path, path_str: String, id: String, size: u64, modified: u64, cover_dir: &Path) -> Option<TrackInfo> {
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let folder = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut info = TrackInfo {
        id,
        path: path_str,
        title: stem,
        artist: String::new(),
        album: String::new(),
        album_artist: String::new(),
        genre: String::new(),
        year: 0,
        track_no: 0,
        duration: 0.0,
        bitrate: 0,
        sample_rate: 0,
        format: ext,
        size,
        added_at: now_secs(),
        folder,
        has_cover: false,
        modified,
        cover: String::new(),
    };

    if let Some(tagged) = open_tagged(path) {
        let props = tagged.properties();
        info.duration = props.duration().as_secs_f64();
        info.bitrate = props.audio_bitrate().unwrap_or(0);
        info.sample_rate = props.sample_rate().unwrap_or(0);
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(t) = non_empty(tag.title().map(|c| c.to_string())) {
                info.title = t;
            }
            info.artist = non_empty(tag.artist().map(|c| c.to_string())).unwrap_or_default();
            info.album = non_empty(tag.album().map(|c| c.to_string())).unwrap_or_default();
            info.genre = non_empty(tag.genre().map(|c| c.to_string())).unwrap_or_default();
            info.album_artist = non_empty(tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string()))
                .unwrap_or_default();
            info.year = tag.year().unwrap_or(0);
            info.track_no = tag.track().unwrap_or(0);
        }
        if let Some(bytes) = cover_bytes(tagged.tags(), path) {
            if let Some(f) = save_cover(cover_dir, &bytes) {
                info.cover = f;
                info.has_cover = true;
            }
        }
    }
    Some(info)
}

fn sniff(bytes: &[u8]) -> (&'static str, &'static str) {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        ("png", "image/png")
    } else if bytes.len() > 12 && &bytes[8..12] == b"WEBP" {
        ("webp", "image/webp")
    } else {
        ("jpg", "image/jpeg")
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// ---------- lệnh ----------

#[tauri::command]
async fn scan_paths(app: AppHandle, paths: Vec<String>, known: Option<Vec<Known>>) -> Result<ScanResult, String> {
    let cover_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("covers");
    tauri::async_runtime::spawn_blocking(move || {
        let known_map: HashMap<String, (u64, u64)> = known
            .unwrap_or_default()
            .into_iter()
            .map(|k| (norm_key(&k.path), (k.size, k.modified)))
            .collect();

        let mut files: Vec<PathBuf> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut push = |p: PathBuf, files: &mut Vec<PathBuf>| {
            if seen.insert(norm_key(&p.to_string_lossy())) {
                files.push(p);
            }
        };
        for p in &paths {
            let pb = PathBuf::from(p);
            if pb.is_dir() {
                let root = fs::canonicalize(&pb).map(strip_verbatim).unwrap_or(pb);
                for e in WalkDir::new(&root)
                    .follow_links(true)
                    .sort_by_file_name()
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if e.file_type().is_file() && is_audio(e.path()) {
                        push(e.path().to_path_buf(), &mut files);
                    }
                }
            } else if pb.is_file() && is_audio(&pb) {
                let f = fs::canonicalize(&pb).map(strip_verbatim).unwrap_or(pb);
                push(f, &mut files);
            }
        }

        let total = files.len();
        let mut tracks = Vec::new();
        let mut found = Vec::with_capacity(total);
        for (i, f) in files.iter().enumerate() {
            let path_str = f.to_string_lossy().to_string();
            let id = track_id(&path_str);
            if let Ok(m) = fs::metadata(f) {
                found.push(Found { id: id.clone(), path: path_str.clone() });
                let modified = mtime(&m);
                let unchanged = modified > 0
                    && known_map
                        .get(&norm_key(&path_str))
                        .map(|(sz, md)| *sz == m.len() && *md == modified)
                        .unwrap_or(false);
                if !unchanged {
                    if let Some(t) = read_track(f, path_str, id, m.len(), modified, &cover_dir) {
                        tracks.push(t);
                    }
                }
            }
            if i % 10 == 0 || i + 1 == total {
                let _ = app.emit("scan-progress", serde_json::json!({ "done": i + 1, "total": total }));
            }
        }
        ScanResult { tracks, found }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_cover(app: AppHandle, path: String, want_data: bool) -> Result<Option<CoverResult>, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("covers");
    tauri::async_runtime::spawn_blocking(move || -> Option<CoverResult> {
        let p = Path::new(&path);
        let tagged = open_tagged(p)?;
        let bytes = cover_bytes(tagged.tags(), p)?;
        let (_, mime) = sniff(&bytes);
        let file = save_cover(&dir, &bytes)?;
        let data_url = if want_data {
            Some(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)))
        } else {
            None
        };
        Some(CoverResult { file, data_url })
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_music_dir(app: AppHandle) -> Option<String> {
    app.path()
        .audio_dir()
        .ok()
        .map(|p| strip_verbatim(p).to_string_lossy().to_string())
}

/// Các tệp đã bị xóa khỏi ổ đĩa (bỏ qua nếu ổ đĩa / thư mục gốc đang không truy cập được)
#[tauri::command]
fn find_removed(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|p| {
            let pb = Path::new(p);
            !pb.exists() && root_exists(pb)
        })
        .collect()
}

#[tauri::command]
async fn read_lyrics(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Option<String> {
        let p = Path::new(&path);
        let lrc = p.with_extension("lrc");
        if lrc.is_file() {
            if let Ok(b) = fs::read(&lrc) {
                let s = String::from_utf8_lossy(&b).to_string();
                return Some(s.trim_start_matches('\u{feff}').to_string());
            }
        }
        let tagged = open_tagged(p)?;
        for tag in tagged.tags() {
            if let Some(l) = tag.get_string(&ItemKey::Lyrics) {
                if !l.trim().is_empty() {
                    return Some(l.to_string());
                }
            }
        }
        None
    })
    .await
    .map_err(|e| e.to_string())
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("library.json"))
}

// ---------- remember window size / position ----------

/// Last "normal" (not maximized, not fullscreen, not mini) window geometry, in physical pixels.
#[derive(Serialize, Deserialize, Clone)]
struct WinState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    maximized: bool,
}

struct WinTracker {
    /// Disabled while the app is in fullscreen / mini-player mode so those sizes are never saved
    track: AtomicBool,
    dirty: AtomicBool,
    state: Mutex<Option<WinState>>,
}

fn window_state_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("window.json"))
}

fn write_window_state(app: &AppHandle) {
    let tracker = app.state::<WinTracker>();
    let st = tracker.state.lock().ok().and_then(|g| g.clone());
    if let (Some(st), Some(path)) = (st, window_state_path(app)) {
        if let Ok(json) = serde_json::to_string(&st) {
            let _ = fs::write(path, json);
        }
    }
}

fn capture_window_state(window: &Window) -> Option<WinState> {
    let tracker = window.state::<WinTracker>();
    if !tracker.track.load(Ordering::Relaxed) {
        return None;
    }
    if window.is_fullscreen().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
        return None;
    }
    let mut cur = tracker.state.lock().ok().and_then(|g| g.clone()).unwrap_or(WinState {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        maximized: false,
    });
    if window.is_maximized().unwrap_or(false) {
        cur.maximized = true; // keep the previous normal size so "restore down" returns to it
        if cur.width == 0 {
            return None;
        }
    } else {
        let size = window.inner_size().ok()?;
        let pos = window.outer_position().ok()?;
        if pos.x <= -30000 || pos.y <= -30000 {
            return None; // Windows reports huge negative coordinates for minimized windows
        }
        cur = WinState { width: size.width, height: size.height, x: pos.x, y: pos.y, maximized: false };
    }
    Some(cur)
}

fn remember_window(window: &Window, flush: bool) {
    if let Some(st) = capture_window_state(window) {
        let tracker = window.state::<WinTracker>();
        if let Ok(mut g) = tracker.state.lock() {
            *g = Some(st);
        }
        if flush {
            write_window_state(window.app_handle());
            tracker.dirty.store(false, Ordering::Relaxed);
        } else {
            tracker.dirty.store(true, Ordering::Relaxed);
        }
    }
}

/// Is enough of the saved window visible on a connected monitor? (monitors may have been unplugged)
fn on_screen(w: &tauri::WebviewWindow, st: &WinState) -> bool {
    let Ok(monitors) = w.available_monitors() else { return true };
    if monitors.is_empty() {
        return true;
    }
    monitors.iter().any(|m| {
        let p = m.position();
        let s = m.size();
        let overlap_x = (st.x + st.width as i32).min(p.x + s.width as i32) - st.x.max(p.x);
        overlap_x >= 120 && st.y >= p.y - 20 && st.y <= p.y + s.height as i32 - 80
    })
}

#[derive(Serialize, Deserialize, Default)]
struct Prefs {
    #[serde(default)]
    start_fullscreen: bool,
}

fn prefs_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    Some(dir.join("prefs.json"))
}

fn read_prefs(app: &AppHandle) -> Prefs {
    prefs_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn restore_window_state(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else { return };
    if let Some(path) = window_state_path(app) {
        if let Ok(txt) = fs::read_to_string(path) {
            if let Ok(st) = serde_json::from_str::<WinState>(&txt) {
                if st.width >= 300 && st.height >= 200 {
                    let _ = w.set_size(tauri::PhysicalSize::new(st.width, st.height));
                    if on_screen(&w, &st) {
                        let _ = w.set_position(tauri::PhysicalPosition::new(st.x, st.y));
                    } else {
                        let _ = w.center();
                    }
                    if st.maximized {
                        let _ = w.maximize();
                    }
                    if let Ok(mut g) = app.state::<WinTracker>().state.lock() {
                        *g = Some(st);
                    }
                }
            }
        }
    }
    if read_prefs(app).start_fullscreen {
        app.state::<WinTracker>().track.store(false, Ordering::Relaxed); // never save the fullscreen size
        let _ = w.set_fullscreen(true);
    }
    // the window is created hidden (see tauri.conf.json) so there is no visible jump
    let _ = w.show();
    let _ = w.set_focus();
}

#[tauri::command]
fn set_window_tracking(tracker: State<WinTracker>, enabled: bool) {
    tracker.track.store(enabled, Ordering::Relaxed);
}

/// "Always start in fullscreen" option (read at startup, before the window is shown)
#[tauri::command]
fn set_start_fullscreen(app: AppHandle, enabled: bool) {
    if let (Some(p), Ok(json)) = (prefs_path(&app), serde_json::to_string(&Prefs { start_fullscreen: enabled })) {
        let _ = fs::write(p, json);
    }
}

struct TrayItems {
    show: MenuItem<tauri::Wry>,
    toggle: MenuItem<tauri::Wry>,
    prev: MenuItem<tauri::Wry>,
    next: MenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}

/// Translate the tray menu (labels: show, play/pause, previous, next, quit)
#[tauri::command]
fn set_tray_labels(items: State<TrayItems>, labels: Vec<String>) {
    if labels.len() >= 5 {
        let _ = items.show.set_text(&labels[0]);
        let _ = items.toggle.set_text(&labels[1]);
        let _ = items.prev.set_text(&labels[2]);
        let _ = items.next.set_text(&labels[3]);
        let _ = items.quit.set_text(&labels[4]);
    }
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    let p = state_path(&app)?;
    if !p.exists() {
        // First launch after the rename: reuse the library saved by the old "Melodia" build
        let legacy = p
            .parent()
            .and_then(|d| d.parent())
            .map(|d| d.join("com.minhtrong67.melodia").join("library.json"));
        if let Some(old) = legacy.filter(|f| f.exists()) {
            return fs::read_to_string(old).map(Some).map_err(|e| e.to_string());
        }
        return Ok(None);
    }
    fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_state(app: AppHandle, data: String) -> Result<(), String> {
    let p = state_path(&app)?;
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_missing(paths: Vec<String>) -> Vec<String> {
    paths.into_iter().filter(|p| !Path::new(p).exists()).collect()
}

#[tauri::command]
fn is_dir(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let b = fs::read(path).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&b).trim_start_matches('\u{feff}').to_string())
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("Windows only".to_string())
    }
}

#[tauri::command]
fn get_launch_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with("--") && Path::new(a).exists())
        .collect()
}

#[tauri::command]
fn set_close_to_tray(flags: State<AppFlags>, enabled: bool) {
    flags.close_to_tray.store(enabled, Ordering::Relaxed);
}

// ---------- khởi chạy ----------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            show_main(app);
            let paths: Vec<String> = args
                .into_iter()
                .skip(1)
                .filter(|a| !a.starts_with("--") && Path::new(a).exists())
                .collect();
            if !paths.is_empty() {
                let _ = app.emit("open-paths", paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppFlags {
            close_to_tray: AtomicBool::new(false),
        })
        .manage(WinTracker {
            track: AtomicBool::new(true),
            dirty: AtomicBool::new(false),
            state: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle();
            let show = MenuItem::with_id(handle, "show", "Show window", true, None::<&str>)?;
            let toggle = MenuItem::with_id(handle, "toggle", "Play / Pause", true, None::<&str>)?;
            let prev = MenuItem::with_id(handle, "prev", "Previous", true, None::<&str>)?;
            let next = MenuItem::with_id(handle, "next", "Next", true, None::<&str>)?;
            let quit = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                handle,
                &[&show, &toggle, &prev, &next, &PredefinedMenuItem::separator(handle)?, &quit],
            )?;

            let mut builder = TrayIconBuilder::new()
                .tooltip("Material Music Player")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    other => {
                        let _ = app.emit("tray-action", other.to_string());
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }
            builder.build(app)?;
            app.manage(TrayItems { show, toggle, prev, next, quit });

            restore_window_state(app.handle());
            // background saver: writes the window geometry at most twice a second while it changes
            let bg = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(500));
                let tracker = bg.state::<WinTracker>();
                if tracker.dirty.swap(false, Ordering::Relaxed) {
                    write_window_state(&bg);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => remember_window(window, false),
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    remember_window(window, true);
                    let flags = window.state::<AppFlags>();
                    if flags.close_to_tray.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            get_cover,
            read_lyrics,
            load_state,
            save_state,
            check_missing,
            find_removed,
            get_music_dir,
            is_dir,
            write_text_file,
            read_text_file,
            reveal_in_explorer,
            get_launch_args,
            set_close_to_tray,
            set_window_tracking,
            set_start_fullscreen,
            set_tray_labels
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Material Music Player");
}
