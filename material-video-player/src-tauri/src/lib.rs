use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, Window};
use walkdir::WalkDir;

const VIDEO_EXTS: [&str; 14] = [
    "mp4", "m4v", "mkv", "webm", "avi", "mov", "wmv", "flv", "ogv", "mpg", "mpeg", "3gp", "mts", "m2ts",
];
const SUB_EXTS: [&str; 4] = ["srt", "vtt", "ass", "ssa"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct VideoFile {
    path: String,
    name: String,
    size: u64,
    modified: u64,
    folder: String,
}

#[derive(Serialize)]
struct SubFile {
    path: String,
    name: String,
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

/// "Always start in fullscreen" option (read at startup, before the window is shown)
#[tauri::command]
fn set_start_fullscreen(app: AppHandle, enabled: bool) {
    if let (Some(p), Ok(json)) = (prefs_path(&app), serde_json::to_string(&Prefs { start_fullscreen: enabled })) {
        let _ = fs::write(p, json);
    }
}

#[tauri::command]
fn set_window_tracking(tracker: State<WinTracker>, enabled: bool) {
    tracker.track.store(enabled, Ordering::Relaxed);
}

// ---------- helpers ----------

fn ext_of(p: &Path) -> String {
    p.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn is_video(p: &Path) -> bool {
    VIDEO_EXTS.contains(&ext_of(p).as_str())
}

/// Remove the \\?\ prefix that Windows canonicalize() adds
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

fn fnv(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.to_lowercase().bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

fn norm_key(s: &str) -> String {
    s.replace('/', "\\").to_lowercase()
}

fn video_file(p: &Path) -> Option<VideoFile> {
    let meta = fs::metadata(p).ok()?;
    if !meta.is_file() {
        return None;
    }
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Some(VideoFile {
        path: p.to_string_lossy().to_string(),
        name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        size: meta.len(),
        modified,
        folder: p.parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_default(),
    })
}

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

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("state.json"))
}

// ---------- commands ----------

/// Collect video files from files and/or folders (optionally recursive).
#[tauri::command]
async fn scan_videos(paths: Vec<String>, recursive: bool) -> Result<Vec<VideoFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut out: Vec<VideoFile> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut add = |p: &Path, out: &mut Vec<VideoFile>| {
            if let Some(v) = video_file(p) {
                if seen.insert(norm_key(&v.path)) {
                    out.push(v);
                }
            }
        };
        for raw in &paths {
            let pb = PathBuf::from(raw);
            if pb.is_dir() {
                let root = fs::canonicalize(&pb).map(strip_verbatim).unwrap_or(pb);
                let depth = if recursive { usize::MAX } else { 1 };
                for e in WalkDir::new(&root)
                    .max_depth(depth)
                    .follow_links(true)
                    .sort_by_file_name()
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if e.file_type().is_file() && is_video(e.path()) {
                        add(e.path(), &mut out);
                    }
                }
            } else if pb.is_file() && is_video(&pb) {
                let f = fs::canonicalize(&pb).map(strip_verbatim).unwrap_or(pb);
                add(&f, &mut out);
            }
        }
        out
    })
    .await
    .map_err(|e| e.to_string())
}

/// Video files sitting next to the given file (same folder, not recursive).
#[tauri::command]
fn list_siblings(path: String) -> Vec<VideoFile> {
    let p = PathBuf::from(&path);
    let Some(dir) = p.parent() else { return vec![] };
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.filter_map(|e| e.ok()) {
            let fp = e.path();
            if fp.is_file() && is_video(&fp) {
                if let Some(v) = video_file(&fp) {
                    out.push(v);
                }
            }
        }
    }
    out
}

/// Find subtitle files next to a video: same folder or Subs/Subtitles sub-folders,
/// whose name starts with the video's file name (e.g. movie.srt, movie.vi.srt).
#[tauri::command]
fn find_subtitles(path: String) -> Vec<SubFile> {
    let p = PathBuf::from(&path);
    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let Some(dir) = p.parent() else { return vec![] };
    let mut dirs = vec![dir.to_path_buf()];
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.filter_map(|e| e.ok()) {
            let fp = e.path();
            let name = e.file_name().to_string_lossy().to_lowercase();
            if fp.is_dir() && ["subs", "sub", "subtitles", "subtitle"].contains(&name.as_str()) {
                dirs.push(fp);
            }
        }
    }
    let mut out: Vec<SubFile> = Vec::new();
    for d in dirs {
        if let Ok(rd) = fs::read_dir(&d) {
            for e in rd.filter_map(|e| e.ok()) {
                let fp = e.path();
                if !fp.is_file() || !SUB_EXTS.contains(&ext_of(&fp).as_str()) {
                    continue;
                }
                let fname = fp.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if fname.to_lowercase().starts_with(&stem) {
                    out.push(SubFile { path: fp.to_string_lossy().to_string(), name: fname });
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

/// Read a subtitle file and decode it (BOM, UTF-8, otherwise the given fallback code page).
#[tauri::command]
fn read_subtitle(path: String, fallback: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    if let Some((enc, _)) = encoding_rs::Encoding::for_bom(&bytes) {
        let (text, _, _) = enc.decode(&bytes);
        return Ok(text.to_string());
    }
    if let Ok(s) = std::str::from_utf8(&bytes) {
        return Ok(s.to_string());
    }
    let enc = encoding_rs::Encoding::for_label(fallback.as_bytes()).unwrap_or(encoding_rs::WINDOWS_1252);
    let (text, _, _) = enc.decode(&bytes);
    Ok(text.to_string())
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    let p = state_path(&app)?;
    if !p.exists() {
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

/// Files that no longer exist (ignored when their whole drive is unreachable).
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

/// Save a PNG screenshot (base64) into Pictures\Material Video Player and return its path.
#[tauri::command]
fn save_screenshot(app: AppHandle, base64_png: String, file_name: String) -> Result<String, String> {
    let dir = app
        .path()
        .picture_dir()
        .map_err(|e| e.to_string())?
        .join("Material Video Player");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = file_name
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) { '_' } else { c })
        .collect();
    let file = dir.join(safe);
    let bytes = STANDARD.decode(base64_png).map_err(|e| e.to_string())?;
    fs::write(&file, bytes).map_err(|e| e.to_string())?;
    Ok(file.to_string_lossy().to_string())
}

/// Store a JPEG thumbnail (base64) in the cache folder; the file name is derived from `key`.
#[tauri::command]
fn save_thumb(app: AppHandle, key: String, base64_jpeg: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("{}.jpg", fnv(&key)));
    let bytes = STANDARD.decode(base64_jpeg).map_err(|e| e.to_string())?;
    fs::write(&file, bytes).map_err(|e| e.to_string())?;
    Ok(file.to_string_lossy().to_string())
}

#[tauri::command]
fn get_video_dir(app: AppHandle) -> Option<String> {
    app.path()
        .video_dir()
        .ok()
        .map(|p| strip_verbatim(p).to_string_lossy().to_string())
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

/// Open a file with the system default application.
#[tauri::command]
fn open_with_default(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .raw_arg(format!("\"{}\"", path))
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
fn is_dir(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn get_launch_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|a| !a.starts_with("--") && Path::new(a).exists())
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
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
        .manage(WinTracker {
            track: AtomicBool::new(true),
            dirty: AtomicBool::new(false),
            state: Mutex::new(None),
        })
        .setup(|app| {
            restore_window_state(app.handle());
            // background saver: writes the window geometry at most twice a second while it changes
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(500));
                let tracker = handle.state::<WinTracker>();
                if tracker.dirty.swap(false, Ordering::Relaxed) {
                    write_window_state(&handle);
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
                tauri::WindowEvent::CloseRequested { .. } => remember_window(window, true),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_videos,
            list_siblings,
            find_subtitles,
            read_subtitle,
            load_state,
            save_state,
            find_removed,
            save_screenshot,
            save_thumb,
            get_video_dir,
            reveal_in_explorer,
            open_with_default,
            is_dir,
            set_window_tracking,
            set_start_fullscreen,
            get_launch_args
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Material Video Player");
}
