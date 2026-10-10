// Hide the extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};

/* ------------------------------------------------------------------ models */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: Option<i64>,
    created: Option<i64>,
    hidden: bool,
    readonly: bool,
}

#[derive(Serialize)]
struct Place {
    id: String,
    path: String,
}

#[derive(Serialize)]
struct Drive {
    name: String,
    path: String,
    total: u64,
    free: u64,
    fs: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Props {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    files: u64,
    folders: u64,
    created: Option<i64>,
    modified: Option<i64>,
    accessed: Option<i64>,
    readonly: bool,
    hidden: bool,
}

#[derive(Serialize)]
struct Tools {
    winrar: bool,
    sevenzip: bool,
    code: bool,
    terminal: bool,
}

/// Shared state: cancel flag for the running copy/move and start paths for new windows.
#[derive(Default)]
struct OpState {
    cancel: Arc<AtomicBool>,
    pending: Mutex<HashMap<String, String>>,
}

#[derive(Serialize, Clone)]
struct Progress {
    done: u64,
    total: u64,
    name: String,
}

/// Tracks bytes copied and emits `fileop` events (throttled) for the progress card.
struct Tracker {
    app: AppHandle,
    cancel: Arc<AtomicBool>,
    done: u64,
    total: u64,
    last: Instant,
    name: String,
}

impl Tracker {
    fn emit(&mut self, force: bool) {
        if force || self.last.elapsed() >= Duration::from_millis(80) {
            self.last = Instant::now();
            let _ = self.app.emit(
                "fileop",
                Progress { done: self.done, total: self.total, name: self.name.clone() },
            );
        }
    }
    fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::Relaxed)
    }
}

fn interrupted() -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Interrupted, "cancelled")
}

/* ----------------------------------------------------------------- helpers */

/// Run helper processes without flashing a console window on Windows.
fn quiet(mut c: Command) -> Command {
    #[cfg(windows)]
    {
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    c
}

fn program_files() -> Vec<PathBuf> {
    ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"]
        .iter()
        .filter_map(|k| std::env::var_os(k))
        .map(PathBuf::from)
        .collect()
}

fn on_path(name: &str) -> bool {
    let finder = if cfg!(windows) { "where" } else { "which" };
    quiet(Command::new(finder))
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn find_winrar() -> Option<PathBuf> {
    for base in program_files() {
        let p = base.join("WinRAR").join("WinRAR.exe");
        if p.exists() {
            return Some(p);
        }
    }
    if on_path("WinRAR") {
        return Some(PathBuf::from("WinRAR"));
    }
    None
}

fn find_7z() -> Option<PathBuf> {
    for base in program_files() {
        let p = base.join("7-Zip").join("7z.exe");
        if p.exists() {
            return Some(p);
        }
    }
    if on_path("7z") {
        return Some(PathBuf::from("7z"));
    }
    None
}

fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn run_ok(mut cmd: Command, ok_codes: &[i32]) -> bool {
    cmd.status()
        .map(|s| s.code().map(|c| ok_codes.contains(&c)).unwrap_or(false))
        .unwrap_or(false)
}

fn ms(t: std::io::Result<SystemTime>) -> Option<i64> {
    t.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
}

#[cfg(windows)]
fn is_hidden(_name: &str, md: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    md.file_attributes() & 0x2 != 0
}

#[cfg(not(windows))]
fn is_hidden(name: &str, _md: &fs::Metadata) -> bool {
    name.starts_with('.')
}

fn make_entry(path: &Path, md: &fs::Metadata) -> Entry {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    let hidden = is_hidden(&name, md);
    let is_dir = md.is_dir();
    Entry {
        hidden,
        readonly: md.permissions().readonly(),
        is_dir,
        size: if is_dir { 0 } else { md.len() },
        modified: ms(md.modified()),
        created: ms(md.created()),
        path: path.to_string_lossy().into_owned(),
        name,
    }
}

fn split_name(name: &str, is_dir: bool) -> (String, String) {
    if is_dir {
        return (name.to_string(), String::new());
    }
    match name.rfind('.') {
        Some(i) if i > 0 => (name[..i].to_string(), name[i..].to_string()),
        _ => (name.to_string(), String::new()),
    }
}

/// First free name in `dir`. `copy_style` gives "name - Copy", otherwise "name (2)".
fn free_name(dir: &Path, name: &str, is_dir: bool, copy_style: bool) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = split_name(name, is_dir);
    let mut i = 1u32;
    loop {
        let candidate = if copy_style {
            if i == 1 {
                format!("{stem} - Copy{ext}")
            } else {
                format!("{stem} - Copy ({i}){ext}")
            }
        } else {
            format!("{stem} ({}){ext}", i + 1)
        };
        let p = dir.join(candidate);
        if !p.exists() {
            return p;
        }
        i += 1;
    }
}

fn tree_size(p: &Path) -> u64 {
    match fs::metadata(p) {
        Ok(md) if md.is_dir() => fs::read_dir(p)
            .map(|rd| rd.flatten().map(|e| tree_size(&e.path())).sum())
            .unwrap_or(0),
        Ok(md) => md.len(),
        Err(_) => 0,
    }
}

/// Recursive copy that reports progress and honours the cancel flag.
fn copy_tracked(src: &Path, dst: &Path, tr: &mut Tracker) -> std::io::Result<()> {
    if tr.cancelled() {
        return Err(interrupted());
    }
    if src.is_dir() {
        fs::create_dir(dst)?;
        for item in fs::read_dir(src)? {
            let item = item?;
            copy_tracked(&item.path(), &dst.join(item.file_name()), tr)?;
        }
        return Ok(());
    }
    tr.name = src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let md = fs::metadata(src)?;
    if md.len() < 8 * 1024 * 1024 {
        // small files: the OS copy keeps timestamps and attributes
        fs::copy(src, dst)?;
        tr.done += md.len();
        tr.emit(false);
        return Ok(());
    }
    let mut r = fs::File::open(src)?;
    let mut w = fs::File::create(dst)?;
    let mut buf = vec![0u8; 1 << 20];
    loop {
        if tr.cancelled() {
            drop(w);
            let _ = fs::remove_file(dst);
            return Err(interrupted());
        }
        let n = r.read(&mut buf)?;
        if n == 0 {
            break;
        }
        w.write_all(&buf[..n])?;
        tr.done += n as u64;
        tr.emit(false);
    }
    if let Ok(modified) = md.modified() {
        let _ = w.set_times(fs::FileTimes::new().set_modified(modified));
    }
    let _ = fs::set_permissions(dst, md.permissions());
    Ok(())
}

/// Maps a copy result to a command error, removing a half-written target after a cancel.
fn finish_copy(res: std::io::Result<()>, target: &Path, tr: &Tracker) -> Result<(), String> {
    match res {
        Ok(()) => Ok(()),
        Err(e) => {
            if tr.cancelled() {
                let _ = if target.is_dir() { fs::remove_dir_all(target) } else { fs::remove_file(target) };
                Err("cancelled".into())
            } else {
                Err(e.to_string())
            }
        }
    }
}

fn dir_stats(p: &Path, files: &mut u64, folders: &mut u64, size: &mut u64) {
    if let Ok(rd) = fs::read_dir(p) {
        for item in rd.flatten() {
            // DirEntry::metadata does not follow symlinks, which avoids cycles
            if let Ok(md) = item.metadata() {
                if md.is_dir() {
                    *folders += 1;
                    dir_stats(&item.path(), files, folders, size);
                } else {
                    *files += 1;
                    *size += md.len();
                }
            }
        }
    }
}

/* ---------------------------------------------------------------- commands */

#[tauri::command]
async fn list_dir(path: String) -> Result<Vec<Entry>, String> {
    let rd = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for item in rd.flatten() {
        let p = item.path();
        // follow links/junctions so they show up as folders
        let md = match fs::metadata(&p).or_else(|_| item.metadata()) {
            Ok(m) => m,
            Err(_) => continue,
        };
        out.push(make_entry(&p, &md));
    }
    Ok(out)
}

/// Recursive file-name search (case-insensitive), capped for responsiveness.
#[tauri::command]
async fn search_dir(root: String, query: String, limit: usize) -> Result<Vec<Entry>, String> {
    let needle = query.to_lowercase();
    let mut out = Vec::new();
    let mut stack = vec![PathBuf::from(&root)];
    let mut visited = 0usize;
    while let Some(dir) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for item in rd.flatten() {
            visited += 1;
            if visited > 300_000 || out.len() >= limit {
                return Ok(out);
            }
            let Ok(md) = item.metadata() else { continue };
            let p = item.path();
            if item.file_name().to_string_lossy().to_lowercase().contains(&needle) {
                let md_follow = fs::metadata(&p).unwrap_or_else(|_| md.clone());
                out.push(make_entry(&p, &md_follow));
            }
            if md.is_dir() {
                stack.push(p);
            }
        }
    }
    Ok(out)
}

#[tauri::command]
fn get_places() -> Vec<Place> {
    let candidates: Vec<(&str, Option<PathBuf>)> = vec![
        ("home", dirs::home_dir()),
        ("desktop", dirs::desktop_dir()),
        ("documents", dirs::document_dir()),
        ("downloads", dirs::download_dir()),
        ("pictures", dirs::picture_dir()),
        ("music", dirs::audio_dir()),
        ("videos", dirs::video_dir()),
    ];
    candidates
        .into_iter()
        .filter_map(|(id, p)| {
            p.filter(|p| p.exists()).map(|p| Place {
                id: id.to_string(),
                path: p.to_string_lossy().into_owned(),
            })
        })
        .collect()
}

#[tauri::command]
async fn get_drives() -> Vec<Drive> {
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut out: Vec<Drive> = Vec::new();
    for d in disks.list() {
        let path = d.mount_point().to_string_lossy().into_owned();
        if d.total_space() == 0 || out.iter().any(|x| x.path == path) {
            continue;
        }
        out.push(Drive {
            name: d.name().to_string_lossy().into_owned(),
            path,
            total: d.total_space(),
            free: d.available_space(),
            fs: d.file_system().to_string_lossy().into_owned(),
        });
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}

#[tauri::command]
fn open_item(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_item(dir: String, name: String, is_dir: bool) -> Result<String, String> {
    let target = free_name(Path::new(&dir), &name, is_dir, false);
    if is_dir {
        fs::create_dir(&target).map_err(|e| e.to_string())?;
    } else {
        fs::File::create(&target).map_err(|e| e.to_string())?;
    }
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
async fn rename_item(path: String, new_name: String) -> Result<String, String> {
    let name = new_name.trim();
    if name.is_empty() || name.chars().any(|c| "\\/:*?\"<>|".contains(c)) || name == "." || name == ".." {
        return Err("invalid-name".into());
    }
    let src = PathBuf::from(&path);
    let parent = src.parent().ok_or("invalid-path")?;
    let target = parent.join(name);
    let same_ignoring_case = src
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase() == name.to_lowercase())
        .unwrap_or(false);
    if target.exists() && !same_ignoring_case {
        return Err("exists".into());
    }
    fs::rename(&src, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
async fn delete_items(paths: Vec<String>, permanent: bool) -> Result<(), String> {
    if permanent {
        for p in &paths {
            let path = Path::new(p);
            let res = if path.is_dir() { fs::remove_dir_all(path) } else { fs::remove_file(path) };
            res.map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        trash::delete_all(&paths).map_err(|e| e.to_string())
    }
}

/// Names that already exist in `dest` (excluding pastes into the same folder).
#[tauri::command]
async fn check_conflicts(sources: Vec<String>, dest: String) -> Vec<String> {
    let dest_dir = PathBuf::from(&dest);
    sources
        .iter()
        .filter_map(|s| {
            let src = PathBuf::from(s);
            let name = src.file_name()?.to_owned();
            if src.parent() == Some(dest_dir.as_path()) {
                return None;
            }
            if dest_dir.join(&name).exists() {
                Some(name.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect()
}

/// Copy (`mv = false`) or move (`mv = true`) items into `dest`. `policy` decides what happens
/// when a name already exists: "rename" (keep both), "replace" or "skip". Returns the new paths.
#[tauri::command]
async fn paste_items(
    app: AppHandle,
    state: State<'_, OpState>,
    sources: Vec<String>,
    dest: String,
    mv: bool,
    policy: String,
) -> Result<Vec<String>, String> {
    state.cancel.store(false, Ordering::SeqCst);
    let mut tr = Tracker { app, cancel: state.cancel.clone(), done: 0, total: 0, last: Instant::now(), name: String::new() };
    if !mv {
        tr.total = sources.iter().map(|s| tree_size(Path::new(s))).sum();
    }
    let dest_dir = PathBuf::from(&dest);
    let mut created = Vec::new();
    for s in &sources {
        let src = PathBuf::from(s);
        let Some(name) = src.file_name().map(|n| n.to_string_lossy().into_owned()) else { continue };
        let is_dir = src.is_dir();
        if is_dir && dest_dir.starts_with(&src) {
            return Err("into-itself".into());
        }
        let same_parent = src.parent() == Some(dest_dir.as_path());
        if mv && same_parent {
            created.push(s.clone());
            continue;
        }
        let direct = dest_dir.join(&name);
        let target = if !same_parent && direct.exists() {
            match policy.as_str() {
                "skip" => continue,
                "replace" => {
                    if src.starts_with(&direct) {
                        return Err("into-itself".into());
                    }
                    let res = if direct.is_dir() { fs::remove_dir_all(&direct) } else { fs::remove_file(&direct) };
                    res.map_err(|e| e.to_string())?;
                    direct
                }
                _ => free_name(&dest_dir, &name, is_dir, false),
            }
        } else {
            free_name(&dest_dir, &name, is_dir, same_parent)
        };
        if mv {
            if fs::rename(&src, &target).is_err() {
                // different volume: copy with progress, then remove the source
                tr.total += tree_size(&src);
                let res = copy_tracked(&src, &target, &mut tr);
                finish_copy(res, &target, &tr)?;
                let _ = if is_dir { fs::remove_dir_all(&src) } else { fs::remove_file(&src) };
            }
        } else {
            let res = copy_tracked(&src, &target, &mut tr);
            finish_copy(res, &target, &tr)?;
        }
        created.push(target.to_string_lossy().into_owned());
    }
    tr.emit(true);
    Ok(created)
}

#[tauri::command]
async fn item_properties(path: String) -> Result<Props, String> {
    let p = Path::new(&path);
    let md = fs::metadata(p).map_err(|e| e.to_string())?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    let (mut files, mut folders, mut size) = (0u64, 0u64, 0u64);
    if md.is_dir() {
        dir_stats(p, &mut files, &mut folders, &mut size);
    } else {
        size = md.len();
    }
    Ok(Props {
        hidden: is_hidden(&name, &md),
        readonly: md.permissions().readonly(),
        is_dir: md.is_dir(),
        created: ms(md.created()),
        modified: ms(md.modified()),
        accessed: ms(md.accessed()),
        name,
        path,
        size,
        files,
        folders,
    })
}

#[tauri::command]
async fn tools_available() -> Tools {
    Tools {
        winrar: find_winrar().is_some(),
        sevenzip: find_7z().is_some(),
        code: on_path("code"),
        terminal: on_path("wt"),
    }
}

/// Open an item with a well-known tool. `tool` is one of:
/// terminal, powershell, code, notepad, winrar.
#[tauri::command]
async fn open_with(tool: String, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let dir = if p.is_dir() {
        p.clone()
    } else {
        p.parent().map(|x| x.to_path_buf()).unwrap_or_else(|| p.clone())
    };
    let dir_s = dir.to_string_lossy().into_owned();
    match tool.as_str() {
        "terminal" => {
            if quiet(Command::new("wt")).args(["-d", &dir_s]).spawn().is_ok() {
                return Ok(());
            }
            quiet(Command::new("cmd"))
                .args(["/C", "start", "", "/D", &dir_s, "cmd.exe"])
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string())
        }
        "powershell" => quiet(Command::new("cmd"))
            .args(["/C", "start", "", "/D", &dir_s, "powershell.exe"])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string()),
        "code" => {
            let mut c = quiet(Command::new("cmd"));
            c.args(["/C", "code", &path]);
            if run_ok(c, &[0]) { Ok(()) } else { Err("not-found".into()) }
        }
        "notepad" => Command::new("notepad.exe")
            .arg(&path)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string()),
        "winrar" => match find_winrar() {
            Some(w) => Command::new(w).arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string()),
            None => Err("no-winrar".into()),
        },
        _ => Err("unknown-tool".into()),
    }
}

/// Show an item selected in the system file manager.
#[tauri::command]
fn reveal_item(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path))
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        let parent = Path::new(&path).parent().map(|p| p.to_path_buf()).unwrap_or_default();
        open::that(parent).map_err(|e| e.to_string())
    }
}

/// Extract an archive. Tries WinRAR, then 7-Zip, then PowerShell (zip) and tar.
/// With `to_folder` the files go into a new folder named after the archive.
#[tauri::command]
async fn extract_archive(path: String, dest: String, to_folder: bool) -> Result<String, String> {
    let src = PathBuf::from(&path);
    let mut stem = src
        .file_stem()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "extracted".into());
    if stem.to_lowercase().ends_with(".tar") {
        stem.truncate(stem.len() - 4);
    }
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mut out_dir = PathBuf::from(&dest);
    if to_folder {
        out_dir = free_name(&out_dir, &stem, true, false);
    }
    fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
    let out_s = out_dir.to_string_lossy().into_owned();
    let mut ok = false;

    if let Some(w) = find_winrar() {
        // WinRAR needs a trailing separator to treat the destination as a folder
        let dest_arg = format!("{}{}", out_s.trim_end_matches(['\\', '/']), std::path::MAIN_SEPARATOR);
        let mut c = Command::new(w);
        c.args(["x", "-ibck", "-y", "-o+"]).arg(&path).arg(&dest_arg);
        ok = run_ok(c, &[0, 1]);
    }
    if !ok {
        if let Some(z) = find_7z() {
            let mut c = quiet(Command::new(z));
            c.args(["x", "-y"]).arg(format!("-o{}", out_s)).arg(&path);
            ok = run_ok(c, &[0, 1]);
        }
    }
    if !ok && ext == "zip" {
        let script = format!(
            "Expand-Archive -LiteralPath {} -DestinationPath {} -Force",
            ps_quote(&path),
            ps_quote(&out_s)
        );
        let mut c = quiet(Command::new("powershell"));
        c.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        ok = run_ok(c, &[0]);
    }
    if !ok {
        let mut c = quiet(Command::new("tar"));
        c.arg("-xf").arg(&path).arg("-C").arg(&out_s);
        ok = run_ok(c, &[0]);
    }
    if ok {
        Ok(out_s)
    } else {
        if to_folder {
            let _ = fs::remove_dir(&out_dir); // remove the empty folder we created
        }
        Err("no-extractor".into())
    }
}

/// Create an archive from `paths` inside `dest_dir`. `kind` is "zip" or "rar".
#[tauri::command]
async fn compress_items(paths: Vec<String>, dest_dir: String, name: String, kind: String) -> Result<String, String> {
    if paths.is_empty() {
        return Err("empty".into());
    }
    let file_name = format!("{}.{}", name, kind);
    let out = free_name(Path::new(&dest_dir), &file_name, false, false);
    let out_s = out.to_string_lossy().into_owned();
    let mut ok = false;

    if let Some(w) = find_winrar() {
        let mut c = Command::new(w);
        c.args(["a", "-ibck", "-ep1", "-y"]);
        if kind == "zip" {
            c.arg("-afzip");
        }
        c.arg(&out_s);
        for p in &paths {
            c.arg(p);
        }
        ok = run_ok(c, &[0, 1]);
    } else if kind == "rar" {
        return Err("no-winrar".into());
    }
    if !ok && kind == "zip" {
        let list = paths.iter().map(|p| ps_quote(p)).collect::<Vec<_>>().join(",");
        let script = format!("Compress-Archive -LiteralPath {} -DestinationPath {} -Force", list, ps_quote(&out_s));
        let mut c = quiet(Command::new("powershell"));
        c.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
        ok = run_ok(c, &[0]);
    }
    if ok { Ok(out_s) } else { Err("compress-failed".into()) }
}

/// First few KB of a text file for the details pane (errors for binary files).
#[tauri::command]
async fn preview_text(path: String) -> Result<String, String> {
    use std::io::Read;
    let mut f = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 4096];
    let n = f.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(n);
    if buf.contains(&0) {
        return Err("binary".into());
    }
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

/// Start folder: a path queued for a new window, or the folder passed on the command line.
#[tauri::command]
fn startup_path(window: tauri::WebviewWindow, state: State<'_, OpState>) -> Option<String> {
    if let Some(p) = state.pending.lock().ok().and_then(|mut m| m.remove(window.label())) {
        return Some(p);
    }
    if window.label() == "main" {
        return std::env::args().nth(1).filter(|a| Path::new(a).is_dir());
    }
    None
}

#[tauri::command]
fn cancel_op(state: State<'_, OpState>) {
    state.cancel.store(true, Ordering::SeqCst);
}

static WINDOW_SEQ: AtomicU32 = AtomicU32::new(1);

/// Opens another Material File window (optionally at `path`).
#[tauri::command]
async fn new_window(app: AppHandle, state: State<'_, OpState>, path: Option<String>) -> Result<(), String> {
    let label = format!("w-{}", WINDOW_SEQ.fetch_add(1, Ordering::SeqCst));
    if let (Some(p), Ok(mut m)) = (path, state.pending.lock()) {
        m.insert(label.clone(), p);
    }
    let window = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App("index.html".into()))
        .title("Material File")
        .inner_size(1120.0, 720.0)
        .min_inner_size(720.0, 420.0)
        .center()
        .visible(false)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())?;
    if let Some(icon) = app.default_window_icon().cloned() {
        let _ = window.set_icon(icon);
    }
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));
        let _ = window.show(); // safety net; the page shows it after the first paint
    });
    Ok(())
}

/// Windows only: use an image as the desktop background.
#[tauri::command]
fn set_wallpaper(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "user32")]
        extern "system" {
            fn SystemParametersInfoW(action: u32, param: u32, pv: *mut std::ffi::c_void, flags: u32) -> i32;
        }
        let mut wide: Vec<u16> = std::ffi::OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
        // SPI_SETDESKWALLPAPER, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
        let ok = unsafe { SystemParametersInfoW(0x0014, 0, wide.as_mut_ptr() as *mut std::ffi::c_void, 0x03) };
        if ok != 0 { Ok(()) } else { Err("wallpaper-failed".into()) }
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("unsupported".into())
    }
}

/// Windows only: watches the two mouse side buttons (XBUTTON1 = Back, XBUTTON2 = Forward) and
/// emits `mouse-nav` events ("back:down", "back:up", "forward:down", "forward:up") while one of
/// our windows is in the foreground. WebView2 does not reliably deliver these buttons to the page,
/// so the page listens to both the DOM events and this native signal.
#[cfg(windows)]
mod mouse_nav {
    use std::{thread, time::Duration};
    use tauri::{AppHandle, Emitter};

    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(vkey: i32) -> i16;
        fn GetForegroundWindow() -> isize;
        fn GetWindowThreadProcessId(hwnd: isize, pid: *mut u32) -> u32;
    }

    pub fn start(app: AppHandle) {
        thread::spawn(move || {
            let me = std::process::id();
            let (mut back, mut fwd) = (false, false);
            loop {
                thread::sleep(Duration::from_millis(12));
                let (b, f) = unsafe {
                    (
                        (GetAsyncKeyState(0x05) as u16 & 0x8000) != 0,
                        (GetAsyncKeyState(0x06) as u16 & 0x8000) != 0,
                    )
                };
                if b != back || f != fwd {
                    let ours = unsafe {
                        let hwnd = GetForegroundWindow();
                        let mut pid = 0u32;
                        if hwnd != 0 {
                            GetWindowThreadProcessId(hwnd, &mut pid);
                        }
                        pid == me
                    };
                    if ours {
                        if b != back {
                            let _ = app.emit("mouse-nav", if b { "back:down" } else { "back:up" });
                        }
                        if f != fwd {
                            let _ = app.emit("mouse-nav", if f { "forward:down" } else { "forward:up" });
                        }
                    }
                    back = b;
                    fwd = f;
                }
            }
        });
    }
}

fn main() {
    tauri::Builder::default()
        .manage(OpState::default())
        .setup(|app| {
            #[cfg(windows)]
            mouse_nav::start(app.handle().clone());
            // The window starts hidden and the page shows it after the first paint (no white
            // flash). This is a safety net in case the page never signals readiness.
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon().cloned() {
                    let _ = window.set_icon(icon);
                }
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_dir,
            search_dir,
            get_places,
            get_drives,
            open_item,
            create_item,
            rename_item,
            delete_items,
            paste_items,
            check_conflicts,
            item_properties,
            tools_available,
            open_with,
            reveal_item,
            extract_archive,
            compress_items,
            preview_text,
            startup_path,
            cancel_op,
            new_window,
            set_wallpaper
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material File");
}
