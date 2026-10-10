use std::{thread, time::Duration};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // The main window starts hidden so the frontend can apply the saved
            // window size / maximized mode first (no visible resize flicker).
            // Safety net: if the frontend never shows it, show it after 5 seconds.
            let handle = app.handle().clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(5));
                if let Some(win) = handle.get_webview_window("main") {
                    if !win.is_visible().unwrap_or(true) {
                        let _ = win.show();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Material Weather");
}
