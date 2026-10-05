// Hide the extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

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

/* ----------------------------------------------------------------- helpers */

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

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir(dst)?;
        for item in fs::read_dir(src)? {
            let item = item?;
            copy_recursive(&item.path(), &dst.join(item.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map(|_| ())
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

/// Copy (`mv = false`) or move (`mv = true`) items into `dest`. Returns the new paths.
#[tauri::command]
async fn paste_items(sources: Vec<String>, dest: String, mv: bool) -> Result<Vec<String>, String> {
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
        let target = free_name(&dest_dir, &name, is_dir, same_parent);
        if mv {
            if fs::rename(&src, &target).is_err() {
                copy_recursive(&src, &target).map_err(|e| e.to_string())?;
                let _ = if is_dir { fs::remove_dir_all(&src) } else { fs::remove_file(&src) };
            }
        } else {
            copy_recursive(&src, &target).map_err(|e| e.to_string())?;
        }
        created.push(target.to_string_lossy().into_owned());
    }
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

/// Folder passed on the command line, if any.
#[tauri::command]
fn startup_path() -> Option<String> {
    std::env::args()
        .nth(1)
        .filter(|a| Path::new(a).is_dir())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The window starts hidden and the page shows it after the first paint (no white
            // flash). This is a safety net in case the page never signals readiness.
            if let Some(window) = app.get_webview_window("main") {
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
            item_properties,
            startup_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material File");
}
