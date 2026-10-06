// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// `ffmpeg` command without a flashing console window on Windows.
fn ffmpeg_command() -> Command {
    let mut cmd = Command::new("ffmpeg");
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd
}

/// Writes a chunk of raw bytes to a file.
/// Headers: `x-path` = base64(UTF-8 path), `x-mode` = "create" (truncate) | "append".
#[tauri::command]
fn save_chunk(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("save_chunk requires a raw request body".into());
    };
    let headers = request.headers();
    let path_b64 = headers
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "missing x-path header".to_string())?;
    let mode = headers
        .get("x-mode")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("append");
    let path_bytes = STANDARD.decode(path_b64).map_err(|e| e.to_string())?;
    let path = String::from_utf8(path_bytes).map_err(|e| e.to_string())?;

    let mut opts = OpenOptions::new();
    if mode == "create" {
        opts.write(true).create(true).truncate(true);
    } else {
        opts.append(true).create(true);
    }
    let mut file = opts.open(&path).map_err(|e| format!("{path}: {e}"))?;
    file.write_all(data).map_err(|e| e.to_string())
}

/// Reads a UTF-8 text file (used for project files).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

/// A path inside the system temp folder for an intermediate file.
#[tauri::command]
fn temp_path(name: String) -> String {
    let file = Path::new(&name)
        .file_name()
        .map(|s| s.to_owned())
        .unwrap_or_else(|| "material-video-editor.tmp".into());
    std::env::temp_dir().join(file).to_string_lossy().into_owned()
}

/// Deletes a file, but only inside the system temp folder.
#[tauri::command]
fn remove_temp(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.starts_with(std::env::temp_dir()) {
        return Err("refusing to delete a file outside the temp folder".into());
    }
    std::fs::remove_file(p).map_err(|e| e.to_string())
}

/// True when an `ffmpeg` executable is on the PATH.
#[tauri::command]
fn ffmpeg_available() -> bool {
    ffmpeg_command()
        .arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Transcodes a recorded WebM into a widely compatible H.264/AAC MP4.
#[tauri::command]
async fn ffmpeg_convert(input: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = ffmpeg_command()
            .args([
                "-y",
                "-i",
                input.as_str(),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                output.as_str(),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(())
        } else {
            let err = String::from_utf8_lossy(&out.stderr);
            let mut tail: Vec<&str> = err.lines().rev().take(4).collect();
            tail.reverse();
            Err(tail.join("\n"))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_chunk,
            read_text_file,
            temp_path,
            remove_temp,
            ffmpeg_available,
            ffmpeg_convert
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material Video Editor");
}
