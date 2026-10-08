// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media_server;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use media_server::MediaServer;
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use tauri::{AppHandle, Manager, State};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// `ffmpeg` command without a flashing console window on Windows.
#[allow(unused_mut)]
fn ffmpeg_command() -> Command {
    let mut cmd = Command::new("ffmpeg");
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd
}

/// Writes a chunk of raw bytes to a file.
/// Headers: `x-path` = base64(UTF-8 path), `x-mode` = "create" (truncate) | "append" | "at"
/// (write at byte offset `x-pos`, used by the MP4 muxer which back-patches its header).
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
    match mode {
        "create" => { opts.write(true).create(true).truncate(true); }
        "at" => { opts.write(true).create(true).truncate(false); }
        _ => { opts.append(true).create(true); }
    }
    let mut file = opts.open(&path).map_err(|e| format!("{path}: {e}"))?;
    if mode == "at" {
        let pos: u64 = headers
            .get("x-pos")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .ok_or_else(|| "missing x-pos header".to_string())?;
        file.seek(SeekFrom::Start(pos)).map_err(|e| e.to_string())?;
    }
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
        .unwrap_or_else(|| "material-edit.tmp".into());
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


/* ---------------------------------------------------------------- */
/*  Media files (served to the webview over loopback HTTP)           */
/* ---------------------------------------------------------------- */

#[derive(Serialize)]
struct Served {
    url: String,
    size: u64,
}

/// Registers a media file and returns a URL the webview can play, seek and decode from.
#[tauri::command]
fn serve_file(server: State<'_, MediaServer>, path: String) -> Result<Served, String> {
    let p = PathBuf::from(&path);
    let meta = std::fs::metadata(&p).map_err(|e| format!("{path}: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{path}: not a file"));
    }
    Ok(Served { url: server.register(p), size: meta.len() })
}

/* ---------------------------------------------------------------- */
/*  Project library (app data folder)                                */
/* ---------------------------------------------------------------- */

fn projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn project_file(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("invalid project id".into());
    }
    Ok(projects_dir(app)?.join(format!("{id}.medit")))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMeta {
    id: String,
    name: String,
    updated: u64,
    duration: f64,
    aspect: String,
    media_count: usize,
    cover: Option<String>,
}

/// Lightweight listing of every saved project (name, cover, duration…) without the full timeline.
#[tauri::command]
fn project_list(app: AppHandle) -> Result<Vec<ProjectMeta>, String> {
    let dir = projects_dir(&app)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("medit") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|s| s.to_str()).map(String::from) else { continue };
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
        let mtime = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(ProjectMeta {
            id,
            name: v["name"].as_str().unwrap_or("").to_string(),
            updated: v["updated"].as_u64().unwrap_or(mtime),
            duration: v["duration"].as_f64().unwrap_or(0.0),
            aspect: v["aspect"].as_str().unwrap_or("16:9").to_string(),
            media_count: v["media"].as_array().map(|a| a.len()).unwrap_or(0),
            cover: v["cover"].as_str().map(String::from),
        });
    }
    out.sort_by(|a, b| b.updated.cmp(&a.updated));
    Ok(out)
}

#[tauri::command]
fn project_read(app: AppHandle, id: String) -> Result<String, String> {
    let p = project_file(&app, &id)?;
    std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))
}

/// Atomic write (temp file + rename) so a crash can never leave a half-written project.
#[tauri::command]
fn project_write(app: AppHandle, id: String, data: String) -> Result<(), String> {
    let p = project_file(&app, &id)?;
    let tmp = p.with_extension("medit.tmp");
    std::fs::write(&tmp, data).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

#[tauri::command]
fn project_delete(app: AppHandle, id: String) -> Result<(), String> {
    let p = project_file(&app, &id)?;
    if p.exists() {
        std::fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Size of a file in bytes (used to estimate memory needs before exporting).
#[tauri::command]
fn file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path).map(|m| m.len()).map_err(|e| format!("{path}: {e}"))
}

/// Shows a file in the system file manager (selected where the platform supports it).
#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt as _;
        Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path.replace('/', "\\")))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").args(["-R", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = Path::new(&path).parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."));
        Command::new("xdg-open").arg(dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Deletes an unfinished/cancelled export (only video files).
#[tauri::command]
fn delete_export(path: String) -> Result<(), String> {
    let ext = Path::new(&path).extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !["mp4", "webm", "mov"].contains(&ext.as_str()) {
        return Err("not a video file".into());
    }
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let server = MediaServer::start().map_err(|e| format!("media server: {e}"))?;
            app.manage(server);
            // safety net: the window starts hidden and is shown by the UI; show it anyway if that never happens
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(6));
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_chunk,
            read_text_file,
            temp_path,
            remove_temp,
            ffmpeg_available,
            ffmpeg_convert,
            serve_file,
            project_list,
            project_read,
            project_write,
            project_delete,
            file_size,
            reveal_file,
            delete_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material Edit");
}
