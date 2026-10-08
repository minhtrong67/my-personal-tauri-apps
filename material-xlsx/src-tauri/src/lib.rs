//! Material Xlsx - Tauri backend.
//! The spreadsheet engine lives in the web front-end; Rust only provides file access,
//! the system clipboard and window-state persistence.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::Path;
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

fn err<E: ToString>(e: E) -> String {
    e.to_string()
}

/// Reads a file and returns its bytes as base64 (keeps the IPC payload a plain string).
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
    Ok(STANDARD.encode(bytes))
}

/// Writes base64 data to a file, replacing it atomically where possible.
#[tauri::command]
fn write_file(path: String, data: String) -> Result<(), String> {
    let bytes = STANDARD.decode(data).map_err(err)?;
    let target = Path::new(&path);
    let tmp = target.with_extension("xlsx.tmp");
    // write next to the target first so a failed save never corrupts the existing file
    match std::fs::write(&tmp, &bytes).and_then(|_| std::fs::rename(&tmp, target)) {
        Ok(()) => Ok(()),
        Err(_) => {
            let _ = std::fs::remove_file(&tmp);
            std::fs::write(target, &bytes).map_err(|e| format!("{path}: {e}"))
        }
    }
}

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    arboard::Clipboard::new().map_err(err)?.get_text().map_err(err)
}

#[tauri::command]
fn write_clipboard(text: String) -> Result<(), String> {
    arboard::Clipboard::new().map_err(err)?.set_text(text).map_err(err)
}

/// A spreadsheet path passed on the command line ("Open with" / double click), if any.
#[tauri::command]
fn get_launch_file() -> Option<String> {
    std::env::args().skip(1).find(|a| {
        let l = a.to_lowercase();
        (l.ends_with(".xlsx") || l.ends_with(".csv") || l.ends_with(".tsv") || l.ends_with(".txt")) && Path::new(a).exists()
    })
}

#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Remembers the window size / position / maximised state between launches.
        // Full screen is handled by the app's own "always start in full screen" setting.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The window starts hidden (no size flash). The UI shows it once ready;
            // this is only a safety net in case the front-end fails to start.
            if let Some(win) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(6));
                    let _ = win.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_clipboard,
            write_clipboard,
            get_launch_file,
            reveal_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material Xlsx");
}
