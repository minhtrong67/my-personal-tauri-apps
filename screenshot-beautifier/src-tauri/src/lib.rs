use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

/// Reads an image chosen by the user and returns (mime type, base64 data).
#[tauri::command]
fn read_image(path: String) -> Result<(String, String), String> {
    let ext = Path::new(&path).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => return Err("unsupported".into()),
    };
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.len() > 80_000_000 {
        return Err("too large".into());
    }
    Ok((mime.into(), STANDARD.encode(bytes)))
}

/// Shows a native save dialog and writes the base64 encoded image. Returns false if cancelled.
#[tauri::command]
async fn save_image(app: tauri::AppHandle, name: String, data: String) -> Result<bool, String> {
    let ext = name.rsplit('.').next().unwrap_or("png").to_string();
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_image, save_image])
        .run(tauri::generate_context!())
        .expect("error while running Screenshot Beautifier");
}
