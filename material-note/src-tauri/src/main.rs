// Hide the extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::Manager;
use std::{fs, path::Path};

#[derive(Serialize)]
struct FileData {
    /// File content, always normalised to `\n` line endings.
    content: String,
    /// Original line ending style: `"crlf"` or `"lf"`.
    eol: String,
}

/// Reads a text file. Invalid UTF-8 bytes are replaced, a UTF-8 BOM is dropped.
#[tauri::command]
fn read_text_file(path: String) -> Result<FileData, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    let text = text.trim_start_matches('\u{feff}');
    let eol = if text.contains("\r\n") { "crlf" } else { "lf" };
    Ok(FileData {
        content: text.replace("\r\n", "\n"),
        eol: eol.to_string(),
    })
}

/// Writes a text file using the requested line ending style.
#[tauri::command]
fn write_text_file(path: String, content: String, eol: String) -> Result<(), String> {
    let normalised = content.replace("\r\n", "\n");
    let data = if eol == "crlf" {
        normalised.replace('\n', "\r\n")
    } else {
        normalised
    };
    fs::write(&path, data).map_err(|e| e.to_string())
}

/// Files passed on the command line (e.g. "Open with" or double-click).
#[tauri::command]
fn startup_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| Path::new(arg).is_file())
        .collect()
}

/// Windows only: make sure the mouse pointer is visible again.
/// The pointer can stay hidden after a keyboard shortcut (Windows "hide pointer
/// while typing") or if a hide-count went negative; both are reset here.
#[cfg(windows)]
mod cursor {
    #[repr(C)]
    pub struct Point {
        pub x: i32,
        pub y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn GetCursorPos(point: *mut Point) -> i32;
        pub fn SetCursorPos(x: i32, y: i32) -> i32;
        pub fn ShowCursor(show: i32) -> i32;
    }

    pub fn reveal() {
        unsafe {
            // read the display counter (+1 then -1), then raise it to >= 0
            ShowCursor(1);
            let mut count = ShowCursor(0);
            let mut guard = 0;
            while count < 0 && guard < 32 {
                count = ShowCursor(1);
                guard += 1;
            }
            // a 1px nudge and back counts as mouse movement and un-hides the pointer
            let mut p = Point { x: 0, y: 0 };
            if GetCursorPos(&mut p) != 0 {
                SetCursorPos(p.x + 1, p.y);
                SetCursorPos(p.x, p.y);
            }
        }
    }
}

/// Called around native file dialogs. Synchronous, so it runs on the main thread.
#[tauri::command]
fn reveal_cursor() {
    #[cfg(windows)]
    cursor::reveal();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // The window starts hidden and the page shows it after the first paint (no
            // white flash). This is a safety net in case the page never signals readiness.
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            startup_files,
            reveal_cursor
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material Note");
}
