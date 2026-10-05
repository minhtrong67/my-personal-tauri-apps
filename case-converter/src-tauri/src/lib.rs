use tauri_plugin_dialog::DialogExt;

/// Reads a text file chosen by the user (UTF-8, invalid bytes replaced).
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read(&path)
        .map(|b| String::from_utf8_lossy(&b).into_owned())
        .map_err(|e| e.to_string())
}

/// Shows a native save dialog and writes the text as UTF-8. Returns false if cancelled.
#[tauri::command]
async fn save_text(app: tauri::AppHandle, name: String, text: String) -> Result<bool, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("Text", &["txt"])
        .blocking_save_file();
    let Some(fp) = picked else { return Ok(false) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text, save_text])
        .run(tauri::generate_context!())
        .expect("error while running Case Converter");
}
