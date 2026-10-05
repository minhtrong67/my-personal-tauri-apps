use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

const EXTS: [&str; 10] = ["png", "jpg", "jpeg", "jfif", "gif", "webp", "bmp", "ico", "avif", "svg"];

fn is_img(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).map(|e| EXTS.contains(&e.to_lowercase().as_str())).unwrap_or(false)
}

fn ms(m: &std::fs::Metadata) -> u64 {
    m.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Serialize, Clone)]
struct Entry {
    path: String,
    name: String,
    size: u64,
    mtime: u64,
}

#[derive(Serialize, Clone)]
struct Opened {
    dir: String,
    entries: Vec<Entry>,
    current: Option<String>,
}

fn scan(dir: &Path) -> Vec<Entry> {
    let mut v = Vec::new();
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_file() && is_img(&p) {
                if let Ok(m) = e.metadata() {
                    v.push(Entry {
                        path: p.to_string_lossy().into_owned(),
                        name: e.file_name().to_string_lossy().into_owned(),
                        size: m.len(),
                        mtime: ms(&m),
                    });
                }
            }
        }
    }
    v
}

/// Opens a folder, or the folder that contains the given picture, and lists its pictures.
#[tauri::command]
fn open_target(path: String) -> Result<Opened, String> {
    let p = PathBuf::from(&path);
    if p.is_dir() {
        Ok(Opened { dir: path, entries: scan(&p), current: None })
    } else if p.is_file() {
        let dir = p.parent().ok_or("no parent")?.to_path_buf();
        Ok(Opened { dir: dir.to_string_lossy().into_owned(), entries: scan(&dir), current: Some(path) })
    } else {
        Err("not found".into())
    }
}

fn arg_target(args: &[String]) -> Option<String> {
    args.iter().skip(1).find(|a| {
        let p = Path::new(a);
        p.is_dir() || (p.is_file() && is_img(p))
    }).cloned()
}

/// Picture or folder passed on the command line when Windows opens a file with this app.
#[tauri::command]
fn startup_path() -> Option<String> {
    arg_target(&std::env::args().collect::<Vec<_>>())
}

/// Reads a picture and returns (mime type, base64 data) so it can be edited on a canvas.
#[tauri::command]
fn read_image(path: String) -> Result<(String, String), String> {
    let ext = Path::new(&path).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" | "jfif" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        _ => return Err("unsupported".into()),
    };
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.len() > 120_000_000 {
        return Err("too large".into());
    }
    Ok((mime.into(), STANDARD.encode(bytes)))
}

/// Overwrites an existing picture with base64 encoded data.
#[tauri::command]
fn write_image(path: String, data: String) -> Result<(), String> {
    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

/// Shows a native save dialog, writes the picture and returns the chosen path (None if cancelled).
#[tauri::command]
async fn save_image(app: tauri::AppHandle, name: String, data: String, dir: Option<String>) -> Result<Option<String>, String> {
    let ext = name.rsplit('.').next().unwrap_or("png").to_string();
    let mut b = app.dialog().file().set_file_name(&name).add_filter(ext.to_uppercase(), &[ext.as_str()]);
    if let Some(d) = dir {
        b = b.set_directory(d);
    }
    let Some(fp) = b.blocking_save_file() else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Moves a picture to the Recycle Bin.
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch forwards its file to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if let Some(p) = arg_target(&args) {
                let _ = app.emit("open-path", p);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_target, startup_path, read_image, write_image, save_image, delete_file])
        .run(tauri::generate_context!())
        .expect("error while running Photo Viewer");
}
