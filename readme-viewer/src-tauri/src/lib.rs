use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::path::Path;
use tauri::{Emitter, Manager};

#[derive(Serialize, Clone)]
struct Doc {
    path: String,
    name: String,
    size: u64,
    mtime: u64,
    text: String,
}

fn is_md(a: &str) -> bool {
    let l = a.to_lowercase();
    [".md", ".markdown", ".mdown", ".mkd", ".txt"].iter().any(|e| l.ends_with(e)) && Path::new(a).is_file()
}

fn mtime(p: &str) -> u64 {
    std::fs::metadata(p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn pdec(s: &str) -> String {
    let b = s.as_bytes();
    let (mut o, mut i) = (Vec::new(), 0);
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Some(v) = std::str::from_utf8(&b[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                o.push(v);
                i += 3;
                continue;
            }
        }
        o.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&o).into_owned()
}

#[tauri::command]
fn read_doc(path: String) -> Result<Doc, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let name = Path::new(&path).file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Doc { mtime: mtime(&path), name, size: bytes.len() as u64, text: String::from_utf8_lossy(&bytes).into_owned(), path })
}

/// File passed on the command line when Windows opens a .md with this app.
#[tauri::command]
fn startup_doc() -> Option<Doc> {
    std::env::args().skip(1).find(|a| is_md(a)).and_then(|p| read_doc(p).ok())
}

#[tauri::command]
fn file_mtime(path: String) -> u64 {
    mtime(&path)
}

/// Loads a local image referenced by a relative path in the Markdown file. Images only.
#[tauri::command]
fn read_asset(base: String, rel: String) -> Result<(String, String), String> {
    let rel = pdec(rel.split(|c: char| c == '?' || c == '#').next().unwrap_or(""));
    let dir = Path::new(&base).parent().ok_or("no parent")?;
    let p = dir.join(rel.trim_start_matches("./"));
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => return Err("unsupported".into()),
    };
    let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
    if bytes.len() > 20_000_000 {
        return Err("too large".into());
    }
    Ok((mime.into(), STANDARD.encode(bytes)))
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
            if let Some(p) = args.iter().skip(1).find(|a| is_md(a)) {
                if let Ok(d) = read_doc(p.clone()) {
                    let _ = app.emit("open-doc", d);
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_doc, startup_doc, file_mtime, read_asset])
        .run(tauri::generate_context!())
        .expect("error while running Readme Viewer");
}
