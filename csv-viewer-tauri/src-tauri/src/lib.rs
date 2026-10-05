use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Clone)]
struct Opened {
    name: String,
    size: u64,
    text: String,
}

fn is_csv(a: &str) -> bool {
    let l = a.to_lowercase();
    (l.ends_with(".csv") || l.ends_with(".tsv") || l.ends_with(".txt")) && Path::new(a).exists()
}

fn read(path: &str) -> Result<Opened, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let name = Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(Opened { name, size: bytes.len() as u64, text: String::from_utf8_lossy(&bytes).into_owned() })
}

/// File passed on the command line when Windows opens a .csv with this app.
#[tauri::command]
fn startup_file() -> Option<Opened> {
    std::env::args().skip(1).find(|a| is_csv(a)).and_then(|p| read(&p).ok())
}

/// Shows a native save dialog and writes the base64 encoded data to the chosen path.
#[tauri::command]
async fn save_file(app: AppHandle, name: String, data: String) -> Result<bool, String> {
    let ext = name.rsplit('.').next().unwrap_or("").to_string();
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter(ext.to_uppercase(), &[ext.as_str()])
        .blocking_save_file();
    let Some(fp) = picked else { return Ok(false) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let bytes = STANDARD.decode(data).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch forwards its file to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if let Some(p) = args.iter().skip(1).find(|a| is_csv(a)) {
                if let Ok(o) = read(p) {
                    let _ = app.emit("open-file", o);
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![startup_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running CSV Viewer");
}
