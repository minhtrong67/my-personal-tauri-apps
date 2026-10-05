use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
};

use futures_util::StreamExt;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
    sync::{oneshot, Mutex},
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

#[derive(Default)]
struct AppState {
    jobs: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

fn es<E: ToString>(e: E) -> String {
    e.to_string()
}

// ───────────────────────── Công cụ ngoài (yt-dlp, ffmpeg) ─────────────────────────

fn bin_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("bin")
}

fn exe_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Tạo lệnh chạy tool: ưu tiên bản đã tải trong thư mục của app, nếu không có thì dùng PATH.
fn make_cmd(app: &AppHandle, name: &str) -> Command {
    let dir = bin_dir(app);
    let exe = dir.join(exe_name(name));
    let program = if exe.exists() { exe } else { PathBuf::from(name) };
    let mut c = Command::new(program);
    let old = std::env::var_os("PATH").unwrap_or_default();
    let mut paths = vec![dir];
    paths.extend(std::env::split_paths(&old));
    if let Ok(joined) = std::env::join_paths(paths) {
        c.env("PATH", joined);
    }
    // Ép Python (yt-dlp) xuất UTF-8 thay vì cp1252 trên Windows
    c.env("PYTHONUTF8", "1").env("PYTHONIOENCODING", "utf-8");
    c.stdin(Stdio::null());
    c.kill_on_drop(true);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[derive(Serialize)]
struct ToolStatus {
    ytdlp: Option<String>,
    ffmpeg: Option<String>,
    deno: Option<String>,
}

#[tauri::command]
async fn check_tools(app: AppHandle) -> ToolStatus {
    let ytdlp = match make_cmd(&app, "yt-dlp").arg("--version").output().await {
        Ok(o) if o.status.success() => Some(String::from_utf8_lossy(&o.stdout).trim().to_string()),
        _ => None,
    };
    let ffmpeg = match make_cmd(&app, "ffmpeg").arg("-version").output().await {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            let first = text.lines().next().unwrap_or("");
            Some(first.split_whitespace().nth(2).unwrap_or("đã cài").to_string())
        }
        _ => None,
    };
    let deno = match make_cmd(&app, "deno").arg("--version").output().await {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            let first = text.lines().next().unwrap_or("");
            Some(first.split_whitespace().nth(1).unwrap_or("đã cài").to_string())
        }
        _ => None,
    };
    ToolStatus { ytdlp, ffmpeg, deno }
}

#[derive(Serialize, Clone)]
struct ToolProgress {
    tool: String,
    percent: u32,
}

async fn download_file(app: &AppHandle, tool: &str, url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("mp3-downloader")
        .build()
        .map_err(es)?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(es)?
        .error_for_status()
        .map_err(es)?;
    let total = resp.content_length().unwrap_or(0);
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(es)?;
    }
    let mut file = tokio::fs::File::create(dest).await.map_err(es)?;
    let mut stream = resp.bytes_stream();
    let (mut got, mut last) = (0u64, 101u32);
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(es)?;
        file.write_all(&chunk).await.map_err(es)?;
        got += chunk.len() as u64;
        if total > 0 {
            let p = (got * 100 / total) as u32;
            if p != last {
                last = p;
                let _ = app.emit("tool-progress", ToolProgress { tool: tool.into(), percent: p });
            }
        }
    }
    file.flush().await.map_err(es)?;
    Ok(())
}

#[tauri::command]
async fn install_ytdlp(app: AppHandle) -> Result<(), String> {
    let asset = if cfg!(windows) {
        "yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp_linux"
    };
    let url = format!("https://github.com/yt-dlp/yt-dlp/releases/latest/download/{asset}");
    let dest = bin_dir(&app).join(exe_name("yt-dlp"));
    let tmp = dest.with_extension("download");
    download_file(&app, "ytdlp", &url, &tmp).await?;
    let _ = tokio::fs::remove_file(&dest).await;
    tokio::fs::rename(&tmp, &dest).await.map_err(es)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perm = std::fs::metadata(&dest).map_err(es)?.permissions();
        perm.set_mode(0o755);
        std::fs::set_permissions(&dest, perm).map_err(es)?;
    }
    Ok(())
}

#[tauri::command]
async fn install_ffmpeg(app: AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Hãy cài ffmpeg bằng trình quản lý gói: macOS `brew install ffmpeg`, Linux `sudo apt install ffmpeg`.".into());
    }
    let dir = bin_dir(&app);
    let zip_path = dir.join("ffmpeg.zip");
    let urls = [
        "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        "https://github.com/yt-dlp/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip",
    ];
    let mut last_err = String::new();
    let mut ok = false;
    for u in urls {
        match download_file(&app, "ffmpeg", u, &zip_path).await {
            Ok(_) => {
                ok = true;
                break;
            }
            Err(e) => last_err = e,
        }
    }
    if !ok {
        return Err(format!("Không tải được ffmpeg: {last_err}"));
    }
    let (zp, d2) = (zip_path.clone(), dir.clone());
    tokio::task::spawn_blocking(move || unzip_flat(&zp, &d2, &["ffmpeg.exe", "ffprobe.exe"]))
        .await
        .map_err(es)??;
    let _ = tokio::fs::remove_file(&zip_path).await;
    Ok(())
}

/// Giải nén các tệp có tên chỉ định (bỏ qua cấu trúc thư mục trong zip).
fn unzip_flat(zip_path: &Path, dest: &Path, names: &[&str]) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(es)?;
    let mut archive = zip::ZipArchive::new(file).map_err(es)?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(es)?;
        let entry_name = entry.name().replace('\\', "/");
        let base = entry_name.rsplit('/').next().unwrap_or("").to_string();
        if names.iter().any(|n| n.eq_ignore_ascii_case(&base)) {
            let mut out = std::fs::File::create(dest.join(&base)).map_err(es)?;
            std::io::copy(&mut entry, &mut out).map_err(es)?;
        }
    }
    Ok(())
}

/// Deno là runtime JavaScript mà yt-dlp dùng để giải mã link YouTube (giúp tránh lỗi HTTP 403).
#[tauri::command]
async fn install_deno(app: AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("Hãy cài Deno: macOS `brew install deno`, Linux `curl -fsSL https://deno.land/install.sh | sh`.".into());
    }
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x86_64" };
    let url = format!("https://github.com/denoland/deno/releases/latest/download/deno-{arch}-pc-windows-msvc.zip");
    let dir = bin_dir(&app);
    let zip_path = dir.join("deno.zip");
    download_file(&app, "deno", &url, &zip_path).await.map_err(|e| format!("Không tải được Deno: {e}"))?;
    let (zp, d2) = (zip_path.clone(), dir.clone());
    tokio::task::spawn_blocking(move || unzip_flat(&zp, &d2, &["deno.exe"]))
        .await
        .map_err(es)??;
    let _ = tokio::fs::remove_file(&zip_path).await;
    Ok(())
}

// ───────────────────────── Thông tin bài hát ─────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
struct TrackInfo {
    source: String,
    url: String,
    title: String,
    artist: String,
    album: String,
    year: String,
    thumbnail: String,
    duration: u64,
}

fn detect_source(url: &str) -> &'static str {
    let u = url.to_lowercase();
    if u.contains("spotify.com") || u.contains("spotify.link") {
        "spotify"
    } else if u.contains("tiktok.com") {
        "tiktok"
    } else if u.contains("youtube.com") || u.contains("youtu.be") {
        "youtube"
    } else {
        "other"
    }
}

fn html_unescape(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn parse_meta(html: &str) -> HashMap<String, String> {
    let tag = Regex::new(r#"(?is)<meta\s+([^>]*?)/?>"#).unwrap();
    let attr = Regex::new(r#"([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')"#).unwrap();
    let mut map = HashMap::new();
    for t in tag.captures_iter(html) {
        let (mut key, mut content) = (None, None);
        for a in attr.captures_iter(&t[1]) {
            let val = a.get(2).or(a.get(3)).map(|m| m.as_str()).unwrap_or("");
            match a[1].to_lowercase().as_str() {
                "property" | "name" => key = Some(val.to_string()),
                "content" => content = Some(html_unescape(val)),
                _ => {}
            }
        }
        if let (Some(k), Some(c)) = (key, content) {
            map.entry(k).or_insert(c);
        }
    }
    map
}

const CRAWLER_UA: &str = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

async fn get_text(client: &reqwest::Client, url: &str, ua: &str) -> Result<String, String> {
    let r = client
        .get(url)
        .header(reqwest::header::USER_AGENT, ua)
        .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
        .send()
        .await
        .map_err(es)?;
    let status = r.status();
    let text = r.text().await.map_err(es)?;
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }
    Ok(text)
}

async fn spotify_info(url: &str) -> Result<TrackInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(es)?;

    // Link rút gọn (spotify.link) → lấy URL đích sau khi chuyển hướng
    let mut final_url = url.to_string();
    if url.contains("spotify.link") {
        let r = client
            .get(url)
            .header(reqwest::header::USER_AGENT, BROWSER_UA)
            .send()
            .await
            .map_err(es)?;
        final_url = r.url().to_string();
    }
    // Chấp nhận cả dạng có tiền tố ngôn ngữ: open.spotify.com/intl-vi/track/<id>?si=…
    let re = Regex::new(r"/(track|album|playlist|artist|episode|show)/([A-Za-z0-9]+)").map_err(es)?;
    let caps = re
        .captures(&final_url)
        .ok_or("Link Spotify không hợp lệ. Hãy dán link bài hát dạng open.spotify.com/track/…")?;
    if &caps[1] != "track" {
        return Err("Hiện chỉ hỗ trợ link bài hát Spotify (open.spotify.com/track/…), chưa hỗ trợ album hoặc playlist.".into());
    }
    let id = caps[2].to_string();
    let page_url = format!("https://open.spotify.com/track/{id}");

    // Thử lấy trang với UA của bot mạng xã hội (luôn có đủ thẻ og), rồi mới tới UA trình duyệt
    let mut meta: HashMap<String, String> = HashMap::new();
    let mut last_err = String::new();
    for ua in [CRAWLER_UA, BROWSER_UA] {
        match get_text(&client, &page_url, ua).await {
            Ok(html) => {
                let m = parse_meta(&html);
                if m.contains_key("og:title") {
                    meta = m;
                    break;
                }
                last_err = "trang không có thông tin bài hát".into();
            }
            Err(e) => last_err = e,
        }
    }

    // Dự phòng: oEmbed (chỉ có tên bài + ảnh bìa)
    if meta.is_empty() {
        let api = format!("https://open.spotify.com/oembed?url={page_url}");
        if let Ok(text) = get_text(&client, &api, BROWSER_UA).await {
            if let Ok(v) = serde_json::from_str::<Value>(&text) {
                if let Some(t) = v.get("title").and_then(|x| x.as_str()) {
                    meta.insert("og:title".into(), t.to_string());
                }
                if let Some(t) = v.get("thumbnail_url").and_then(|x| x.as_str()) {
                    meta.insert("og:image".into(), t.to_string());
                }
            }
        }
    }
    let title = meta.get("og:title").cloned().unwrap_or_default();
    if title.is_empty() {
        return Err(format!("Không đọc được thông tin bài hát từ Spotify ({last_err}). Kiểm tra mạng rồi thử lại."));
    }

    // og:description dạng "Nghệ sĩ · Album · Bài hát · 2019" (hoặc 3 phần nếu không có album)
    let desc = meta.get("og:description").cloned().unwrap_or_default();
    let desc = match desc.find("on Spotify. ") {
        Some(i) => desc[i + "on Spotify. ".len()..].to_string(),
        None => desc,
    };
    let parts: Vec<String> = desc.split('·').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect();

    let mut artist = parts.first().cloned().unwrap_or_default();
    if artist.is_empty() {
        artist = meta.get("music:musician_description").cloned().unwrap_or_default();
    }
    let mut album = if parts.len() >= 4 { parts[1].clone() } else { String::new() };
    if album.is_empty() {
        // Lấy tên album từ trang album (thẻ music:album)
        if let Some(album_url) = meta.get("music:album") {
            if let Some(c) = Regex::new(r"/album/([A-Za-z0-9]+)").map_err(es)?.captures(album_url) {
                let u = format!("https://open.spotify.com/album/{}", &c[1]);
                if let Ok(html) = get_text(&client, &u, CRAWLER_UA).await {
                    if let Some(t) = parse_meta(&html).get("og:title") {
                        album = t.clone();
                    }
                }
            }
        }
    }
    let year = meta
        .get("music:release_date")
        .map(|d| d.chars().take(4).collect::<String>())
        .filter(|y| y.len() == 4 && y.chars().all(|c| c.is_ascii_digit()))
        .or_else(|| {
            parts.last().filter(|l| l.len() == 4 && l.chars().all(|c| c.is_ascii_digit())).cloned()
        })
        .unwrap_or_default();
    let duration = meta.get("music:duration").and_then(|d| d.parse::<u64>().ok()).unwrap_or(0);

    Ok(TrackInfo {
        source: "spotify".into(),
        url: url.to_string(),
        title,
        artist,
        album,
        year,
        thumbnail: meta.get("og:image").cloned().unwrap_or_default(),
        duration,
    })
}

#[tauri::command]
async fn fetch_info(app: AppHandle, url: String) -> Result<TrackInfo, String> {
    load_info(&app, url.trim()).await
}

async fn load_info(app: &AppHandle, url: &str) -> Result<TrackInfo, String> {
    let url = url.to_string();
    if !url.starts_with("http") {
        return Err("Hãy nhập một đường dẫn bắt đầu bằng http hoặc https.".into());
    }
    let source = detect_source(&url);
    if source == "spotify" {
        return spotify_info(&url).await;
    }

    let out = make_cmd(&app, "yt-dlp")
        .args(["-J", "--no-playlist", "--no-warnings", url.as_str()])
        .output()
        .await
        .map_err(|e| format!("Không chạy được yt-dlp ({e}). Hãy cài yt-dlp trong phần Cài đặt."))?;
    if !out.status.success() {
        return Err(clean_error(&String::from_utf8_lossy(&out.stderr)));
    }
    let v: Value = serde_json::from_str(&String::from_utf8_lossy(&out.stdout)).map_err(es)?;
    let s = |keys: &[&str]| -> String {
        for k in keys {
            if let Some(t) = v.get(*k).and_then(|x| x.as_str()) {
                if !t.is_empty() {
                    return t.to_string();
                }
            }
        }
        String::new()
    };
    let year = v
        .get("release_year")
        .and_then(|y| y.as_u64())
        .map(|y| y.to_string())
        .or_else(|| v.get("upload_date").and_then(|d| d.as_str()).map(|d| d.chars().take(4).collect()))
        .unwrap_or_default();

    Ok(TrackInfo {
        source: source.into(),
        url,
        title: if source == "tiktok" { s(&["title", "track"]) } else { s(&["track", "title"]) },
        artist: if source == "tiktok" {
            s(&["uploader", "creator", "artist"])
        } else {
            s(&["artist", "creator", "uploader", "channel"]).trim_end_matches(" - Topic").to_string()
        },
        album: s(&["album"]),
        year,
        thumbnail: s(&["thumbnail"]),
        duration: v.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0) as u64,
    })
}

// ───────────────────────── Tải xuống ─────────────────────────

#[derive(Deserialize)]
struct DownloadReq {
    id: String,
    url: String,
    out_dir: String,
    quality: String, // "best" | "320" | "256" | "192" | "128"
    crop_thumb: bool,
    info: Option<TrackInfo>,
}

#[derive(Serialize, Clone)]
struct Progress {
    id: String,
    stage: String, // downloading | converting | tagging | done | error | cancelled
    percent: f32,
    speed: String,
    eta: String,
    message: String,
    file: Option<String>,
}

fn emit(app: &AppHandle, id: &str, stage: &str, percent: f32, speed: &str, eta: &str, message: &str, file: Option<String>) {
    let _ = app.emit(
        "download-progress",
        Progress {
            id: id.into(),
            stage: stage.into(),
            percent,
            speed: speed.into(),
            eta: eta.into(),
            message: message.into(),
            file,
        },
    );
}

fn strip_ansi(s: &str) -> String {
    Regex::new(r"\x1b\[[0-9;]*m").map(|r| r.replace_all(s, "").to_string()).unwrap_or_else(|_| s.to_string())
}

fn clean_error(stderr: &str) -> String {
    let lines: Vec<&str> = stderr.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    let line = lines
        .iter()
        .rev()
        .find(|l| l.starts_with("ERROR"))
        .or(lines.last())
        .copied()
        .unwrap_or("Lỗi không xác định.");
    let lower = line.to_lowercase();
    if lower.contains("ffmpeg") || lower.contains("ffprobe") {
        return "Thiếu ffmpeg. Hãy cài ffmpeg trong phần Cài đặt.".into();
    }
    if lower.contains("sign in") || lower.contains("confirm you") {
        return "YouTube yêu cầu đăng nhập/xác minh. Hãy cập nhật yt-dlp trong phần Cài đặt rồi thử lại.".into();
    }
    if lower.contains("403") || lower.contains("forbidden") {
        return "Máy chủ từ chối tải (HTTP 403). App đã thử nhiều cách khác nhau. Hãy cập nhật yt-dlp và cài Deno trong Cài đặt → Công cụ rồi thử lại.".into();
    }
    if lower.contains("requested format is not available") {
        return "YouTube không trả về định dạng âm thanh. Hãy cập nhật yt-dlp trong phần Cài đặt rồi thử lại.".into();
    }
    line.trim_start_matches("ERROR: ").to_string()
}

fn safe_name(s: &str) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| if "<>:\"/\\|?*%".contains(c) || c.is_control() { ' ' } else { c })
        .collect();
    let joined = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let short: String = joined.chars().take(120).collect();
    // Windows không cho tên tệp kết thúc bằng dấu chấm hoặc khoảng trắng
    short.trim_end_matches(|c: char| c == '.' || c == ' ').to_string()
}

/// Tên tệp: "Nghệ sĩ - Tên bài hát". Với Spotify, "(feat. X)" được đổi thành "ft. X"
/// và nghệ sĩ khách mời được bỏ khỏi phần nghệ sĩ, vd: "Gryffin, ILLENIUM - Feel Good ft. Daya".
fn file_stem_for(info: &TrackInfo, spotify: bool) -> String {
    let t = info.title.trim();
    let a = info.artist.trim();
    let (mut title, mut artist) = (t.to_string(), a.to_string());
    if spotify {
        if let Ok(re) = Regex::new(r"(?i)\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]") {
            if let Some(c) = re.captures(t) {
                let feat = c[1].trim().to_string();
                title = re.replace(t, regex::NoExpand(&format!(" ft. {feat}"))).trim().to_string();
                let feats: Vec<String> = feat
                    .split(|ch: char| ch == ',' || ch == '&')
                    .map(|x| x.trim().to_lowercase())
                    .filter(|x| !x.is_empty())
                    .collect();
                let kept: Vec<&str> = a
                    .split(',')
                    .map(|x| x.trim())
                    .filter(|x| !x.is_empty() && !feats.contains(&x.to_lowercase()))
                    .collect();
                if !kept.is_empty() {
                    artist = kept.join(", ");
                }
            }
        }
    }
    let full = if artist.is_empty() {
        title
    } else if !spotify && (title.contains(" - ") || title.to_lowercase().starts_with(&artist.to_lowercase())) {
        title // tiêu đề video đã có dạng "Nghệ sĩ - Bài hát"
    } else {
        format!("{artist} - {title}")
    };
    let name = safe_name(&full);
    if name.is_empty() { "audio".to_string() } else { name }
}

async fn fetch_cover(url: &str, dir: &Path) -> Option<PathBuf> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build().ok()?;
    let r = client.get(url).header(reqwest::header::USER_AGENT, BROWSER_UA).send().await.ok()?;
    if !r.status().is_success() {
        return None;
    }
    let bytes = r.bytes().await.ok()?;
    if bytes.len() < 500 {
        return None;
    }
    let ext = if bytes.starts_with(&[0x89, b'P', b'N', b'G']) { "png" } else { "jpg" };
    let path = dir.join(format!("cover.{ext}"));
    tokio::fs::write(&path, &bytes).await.ok()?;
    Some(path)
}

/// Ghi thẻ ID3v2.3 (Windows Explorer đọc ảnh bìa ổn định nhất) bằng ffmpeg, không mã hoá lại âm thanh.
async fn tag_with_ffmpeg(app: &AppHandle, path: &Path, info: &TrackInfo, cover: Option<&Path>) -> Result<(), String> {
    let out = path.with_file_name("tagged.tmp.mp3");
    let mut c = make_cmd(app, "ffmpeg");
    c.args(["-y", "-v", "error", "-i"]).arg(path);
    if let Some(cv) = cover {
        c.arg("-i").arg(cv);
    }
    c.args(["-map", "0:a"]);
    if cover.is_some() {
        c.args(["-map", "1:v"]);
    }
    c.args(["-c", "copy", "-id3v2_version", "3", "-write_id3v1", "1"]);
    c.arg("-metadata").arg(format!("title={}", info.title));
    if !info.artist.is_empty() {
        c.arg("-metadata").arg(format!("artist={}", info.artist));
    }
    if !info.album.is_empty() {
        c.arg("-metadata").arg(format!("album={}", info.album));
    }
    if !info.year.is_empty() {
        c.arg("-metadata").arg(format!("date={}", info.year));
    }
    if cover.is_some() {
        c.args(["-metadata:s:v", "title=Album cover", "-metadata:s:v", "comment=Cover (front)"]);
    }
    c.arg(&out);
    let o = c.output().await.map_err(es)?;
    if !o.status.success() {
        let _ = tokio::fs::remove_file(&out).await;
        return Err(String::from_utf8_lossy(&o.stderr).trim().to_string());
    }
    tokio::fs::rename(&out, path).await.map_err(es)
}

#[tauri::command]
async fn start_download(app: AppHandle, state: State<'_, AppState>, req: DownloadReq) -> Result<(), String> {
    let (tx, rx) = oneshot::channel::<()>();
    state.jobs.lock().await.insert(req.id.clone(), tx);
    let app2 = app.clone();
    tokio::spawn(async move {
        let id = req.id.clone();
        let result = run_download(&app2, req, rx).await;
        let state = app2.state::<AppState>();
        state.jobs.lock().await.remove(&id);
        match result {
            Ok(Some((file, warn))) => emit(&app2, &id, "done", 100.0, "", "", &warn, Some(file)),
            Ok(None) => emit(&app2, &id, "cancelled", 0.0, "", "", "Đã huỷ", None),
            Err(e) => emit(&app2, &id, "error", 0.0, "", "", &e, None),
        }
    });
    Ok(())
}

#[tauri::command]
async fn cancel_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if let Some(tx) = state.jobs.lock().await.remove(&id) {
        let _ = tx.send(());
    }
    Ok(())
}

/// Kết thúc cả cây tiến trình (yt-dlp.exe sinh ra tiến trình con python/ffmpeg, kill thường không đủ).
async fn kill_tree(pid: Option<u32>) {
    let Some(pid) = pid else { return };
    let p = pid.to_string();
    #[cfg(windows)]
    {
        let mut c = Command::new("taskkill");
        c.args(["/PID", p.as_str(), "/T", "/F"]);
        c.stdin(Stdio::null());
        c.creation_flags(CREATE_NO_WINDOW);
        let _ = c.output().await;
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill").args(["-KILL", "-P", p.as_str()]).output().await;
    }
}

/// Chạy một tác vụ nhưng dừng ngay (trả về None) nếu người dùng bấm huỷ.
async fn cancellable<T, F: std::future::Future<Output = T>>(rx: &mut oneshot::Receiver<()>, fut: F) -> Option<T> {
    tokio::pin!(fut);
    tokio::select! {
        r = &mut fut => Some(r),
        _ = &mut *rx => None,
    }
}

enum Exit {
    Cancelled,
    Finished { ok: bool, stderr: String },
}

/// Đọc từng dòng, chấp nhận byte không phải UTF-8 (tránh dừng giữa chừng trên Windows).
async fn for_each_line<R: tokio::io::AsyncRead + Unpin>(r: R, mut f: impl FnMut(String)) {
    let mut br = BufReader::new(r);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match br.read_until(b'\n', &mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => f(String::from_utf8_lossy(&buf).trim().to_string()),
        }
    }
}

async fn exec_ytdlp(app: &AppHandle, id: &str, args: &[String], rx: &mut oneshot::Receiver<()>) -> Result<Exit, String> {
    let mut child = make_cmd(app, "yt-dlp")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Không chạy được yt-dlp ({e}). Hãy cài yt-dlp trong phần Cài đặt."))?;
    let pid = child.id();
    let stdout = child.stdout.take().ok_or("Không đọc được đầu ra của yt-dlp")?;
    let stderr = child.stderr.take().ok_or("Không đọc được lỗi của yt-dlp")?;

    let err_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        for_each_line(stderr, |l| lines.push(l)).await;
        lines.join("\n")
    });
    let (app_c, id_c) = (app.clone(), id.to_string());
    let out_task = tokio::spawn(async move {
        for_each_line(stdout, |raw| {
            let line = strip_ansi(&raw);
            if let Some(rest) = line.trim().strip_prefix("[PROG]") {
                let mut it = rest.split('|');
                let pct = it.next().unwrap_or("").trim().trim_end_matches('%').trim().parse::<f32>().unwrap_or(0.0);
                let speed = it.next().unwrap_or("").trim();
                let eta = it.next().unwrap_or("").trim();
                if pct >= 100.0 {
                    emit(&app_c, &id_c, "converting", 100.0, "", "", "Đang chuyển sang MP3…", None);
                } else {
                    emit(&app_c, &id_c, "downloading", pct, speed, eta, "Đang tải…", None);
                }
            }
        })
        .await;
    });

    let status = tokio::select! {
        s = child.wait() => Some(s),
        _ = &mut *rx => {
            kill_tree(pid).await;
            let _ = child.kill().await;
            None
        }
    };
    if status.is_none() {
        // Huỷ: không chờ các luồng đọc, trả về ngay
        out_task.abort();
        err_task.abort();
        return Ok(Exit::Cancelled);
    }
    let _ = out_task.await;
    let stderr = err_task.await.unwrap_or_default();
    match status {
        None => Ok(Exit::Cancelled),
        Some(s) => {
            let s = s.map_err(es)?;
            // 101 = đã đạt --max-downloads (bình thường khi tìm trên YouTube cho Spotify)
            Ok(Exit::Finished { ok: s.success() || s.code() == Some(101), stderr })
        }
    }
}

fn find_mp3(dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|e| e.path().extension().map(|x| x.eq_ignore_ascii_case("mp3")).unwrap_or(false))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .map(|e| e.path())
}

/// Tải vào thư mục tạm riêng của từng bài rồi chuyển ra thư mục đích:
/// không phụ thuộc vào việc phân tích đường dẫn từ đầu ra của yt-dlp.
/// Trả về Ok(Some(path)) nếu thành công, Ok(None) nếu bị huỷ.
async fn run_download(app: &AppHandle, req: DownloadReq, mut rx: oneshot::Receiver<()>) -> Result<Option<(String, String)>, String> {
    let out_dir = PathBuf::from(&req.out_dir);
    std::fs::create_dir_all(&out_dir).map_err(|e| format!("Không tạo được thư mục lưu: {e}"))?;
    let tmp_dir = out_dir.join(format!(".mp3dl-{}", req.id.chars().take(8).collect::<String>()));
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("Không tạo được thư mục tạm: {e}"))?;

    let result = download_into(app, &req, &tmp_dir, &mut rx).await;
    let moved = match result {
        Ok(Some((src, warn))) => {
            let stem = src.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "audio".into());
            let mut dest = out_dir.join(format!("{stem}.mp3"));
            let mut n = 1;
            while dest.exists() {
                dest = out_dir.join(format!("{stem} ({n}).mp3"));
                n += 1;
            }
            if std::fs::rename(&src, &dest).is_err() {
                std::fs::copy(&src, &dest).map_err(|e| format!("Không lưu được tệp: {e}")).map(|_| ())?;
            }
            Ok(Some((dest.to_string_lossy().to_string(), warn)))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e),
    };
    for _ in 0..6 {
        if std::fs::remove_dir_all(&tmp_dir).is_ok() || !tmp_dir.exists() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }
    moved
}

fn url_encode(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => o.push(b as char),
            _ => o.push_str(&format!("%{b:02X}")),
        }
    }
    o
}

fn has_other_audio(dir: &Path) -> bool {
    std::fs::read_dir(dir)
        .map(|rd| {
            rd.flatten().any(|e| {
                e.path()
                    .extension()
                    .map(|x| ["m4a", "opus", "webm", "ogg", "wav", "aac", "mp4"].iter().any(|k| x.eq_ignore_ascii_case(k)))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

/// Các cách tải thay thế khi gặp HTTP 403 (đổi client YouTube, ép IPv4, thêm Referer cho TikTok).
fn variants_for(target: &str) -> Vec<Vec<String>> {
    let v = |a: &[&str]| a.iter().map(|x| x.to_string()).collect::<Vec<String>>();
    if target.contains("youtube.com") || target.contains("youtu.be") || target.starts_with("ytsearch") {
        vec![
            vec![],
            v(&["--extractor-args", "youtube:player_client=android_vr"]),
            v(&["--extractor-args", "youtube:player_client=tv"]),
            v(&["--extractor-args", "youtube:player_client=ios"]),
            v(&["--extractor-args", "youtube:player_client=mweb", "--force-ipv4"]),
        ]
    } else if target.contains("tiktok.com") {
        vec![vec![], v(&["--force-ipv4", "--add-header", "Referer:https://www.tiktok.com/"])]
    } else {
        vec![vec![], v(&["--force-ipv4"])]
    }
}

async fn download_into(app: &AppHandle, req: &DownloadReq, tmp_dir: &Path, rx: &mut oneshot::Receiver<()>) -> Result<Option<(PathBuf, String)>, String> {
    let id = req.id.clone();
    let is_spotify = detect_source(&req.url) == "spotify";
    let tmp_str = tmp_dir.to_string_lossy().replace('%', "%%");

    // Spotify: DRM nên không tải trực tiếp → lấy metadata từ Spotify rồi tìm bản âm thanh khớp trên YouTube Music / YouTube.
    let mut spotify: Option<TrackInfo> = None;
    // (đối tượng tải, bộ lọc thời lượng)
    let mut attempts: Vec<(String, Option<String>)> = Vec::new();
    let out_tpl: String;
    if is_spotify {
        emit(app, &id, "downloading", 0.0, "", "", "Đang đọc thông tin từ Spotify…", None);
        let info = match req.info.clone() {
            Some(i) if !i.title.is_empty() => i,
            _ => match cancellable(rx, spotify_info(&req.url)).await {
                None => return Ok(None),
                Some(r) => r?,
            },
        };
        let plain = if info.artist.is_empty() { info.title.clone() } else { format!("{} {}", info.artist, info.title) };
        if info.duration > 20 {
            let filter = format!("duration>={} & duration<={}", info.duration - 10, info.duration + 10);
            attempts.push((format!("https://music.youtube.com/search?q={}", url_encode(&plain)), Some(filter.clone())));
            attempts.push((format!("ytsearch8:{plain} audio"), Some(filter)));
        }
        attempts.push((format!("ytsearch1:{plain} audio"), None));
        out_tpl = format!("{tmp_str}/{}.%(ext)s", file_stem_for(&info, true));
        spotify = Some(info);
    } else {
        // Đặt tên "Nghệ sĩ - Tên bài hát" nếu lấy được thông tin, nếu không thì dùng tiêu đề video
        let info = match req.info.clone() {
            Some(i) if !i.title.is_empty() => Some(i),
            _ => match cancellable(rx, load_info(app, &req.url)).await {
                None => return Ok(None),
                Some(r) => r.ok(),
            },
        };
        out_tpl = match info {
            Some(i) if !i.title.is_empty() => format!("{tmp_str}/{}.%(ext)s", file_stem_for(&i, false)),
            _ => format!("{tmp_str}/%(title).100s.%(ext)s"),
        };
        attempts.push((req.url.clone(), None));
    }

    let quality = match req.quality.as_str() {
        "320" | "256" | "192" | "128" => format!("{}K", req.quality),
        _ => "0".to_string(),
    };
    // Tuỳ chọn cốt lõi: chỉ cần tải và chuyển MP3
    let core: Vec<String> = vec![
        "-f".into(), "bestaudio/best".into(),
        "-x".into(), "--audio-format".into(), "mp3".into(),
        "--audio-quality".into(), quality,
        "--no-playlist".into(), "--no-warnings".into(),
        "--retries".into(), "10".into(), "--fragment-retries".into(), "10".into(),
        "--extractor-retries".into(), "3".into(),
        "-o".into(), out_tpl,
        "-q".into(), "--progress".into(), "--newline".into(),
        "--progress-template".into(),
        "download:[PROG]%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s".into(),
    ];
    // Tuỳ chọn thêm: metadata + ảnh bìa. Nếu phần này lỗi thì tải lại bản không có nó.
    let mut extras: Vec<String> = vec!["--embed-metadata".into()];
    if !is_spotify {
        extras.extend(["--embed-thumbnail".into(), "--convert-thumbnails".into(), "jpg".into()]);
        if req.crop_thumb {
            extras.extend([
                "--ppa".into(),
                r#"ThumbnailsConvertor+FFmpeg_o:-c:v mjpeg -vf crop="'if(gt(ih,iw),iw,ih)':'if(gt(iw,ih),ih,iw)'""#.into(),
            ]);
        }
    }

    let mut last_err = String::new();
    let mut file: Option<PathBuf> = None;
    'outer: for (target, filter) in &attempts {
        let variants = variants_for(target);
        let (mut vi, mut full) = (0usize, true);
        loop {
            if is_spotify && vi == 0 && full {
                emit(app, &id, "downloading", 0.0, "", "", "Đang tìm bản âm thanh trên YouTube…", None);
            } else if vi > 0 {
                emit(app, &id, "downloading", 0.0, "", "", "Đang thử cách tải khác…", None);
            }
            let mut args = core.clone();
            if full {
                args.extend(extras.clone());
            }
            args.extend(variants[vi].clone());
            if let Some(f) = filter {
                args.extend(["--match-filter".into(), f.clone(), "--max-downloads".into(), "1".into()]);
            }
            if target.contains("/search?") {
                args.extend(["--playlist-items".into(), "1-8".into()]);
            }
            args.push(target.clone());
            match exec_ytdlp(app, &id, &args, rx).await? {
                Exit::Cancelled => return Ok(None),
                Exit::Finished { ok: _, stderr } => {
                    // Có tệp MP3 là coi như thành công, kể cả khi yt-dlp báo lỗi ở bước gắn ảnh/metadata
                    if let Some(f) = find_mp3(tmp_dir) {
                        file = Some(f);
                        break 'outer;
                    }
                    if !stderr.trim().is_empty() {
                        last_err = clean_error(&stderr);
                    }
                    let low = stderr.to_lowercase();
                    let forbidden = low.contains("403") || low.contains("forbidden") || low.contains("unable to download video data");
                    let embed_problem = ["thumbnail", "metadata", "postprocess", "embed"].iter().any(|k| low.contains(k));
                    if full && embed_problem && !forbidden {
                        full = false;
                        continue;
                    }
                    if forbidden && vi + 1 < variants.len() {
                        vi += 1;
                        continue;
                    }
                    break;
                }
            }
        }
    }
    let file = file.ok_or_else(|| {
        if last_err.is_empty() {
            if has_other_audio(tmp_dir) {
                "Đã tải âm thanh nhưng không chuyển được sang MP3. Hãy kiểm tra ffmpeg trong Cài đặt.".to_string()
            } else if is_spotify {
                "Không tìm thấy bản âm thanh khớp trên YouTube cho bài này.".to_string()
            } else {
                "yt-dlp không tạo ra tệp MP3. Hãy cập nhật yt-dlp trong phần Cài đặt rồi thử lại.".to_string()
            }
        } else {
            last_err
        }
    })?;

    // Metadata Spotify: có thì gắn, lỗi thì bỏ qua (tệp vẫn được giữ, chỉ kèm ghi chú)
    let mut warn = String::new();
    if rx.try_recv().is_ok() {
        return Ok(None);
    }
    if let Some(info) = spotify {
        emit(app, &id, "tagging", 100.0, "", "", "Đang ghi thông tin bài hát và ảnh bìa…", None);
        let cover = if info.thumbnail.is_empty() { None } else { fetch_cover(&info.thumbnail, tmp_dir).await };
        if !info.thumbnail.is_empty() && cover.is_none() {
            warn = "không tải được ảnh bìa".into();
        }
        let mut r = tag_with_ffmpeg(app, &file, &info, cover.as_deref()).await;
        if r.is_err() && cover.is_some() {
            r = tag_with_ffmpeg(app, &file, &info, None).await;
            warn = "không gắn được ảnh bìa".into();
        }
        if r.is_err() {
            warn = "không ghi được thông tin bài hát".into();
        }
    }
    Ok(Some((file, warn)))
}

// ───────────────────────── Tiện ích ─────────────────────────

#[tauri::command]
fn default_output_dir(app: AppHandle) -> String {
    // Thư mục Downloads thật của người dùng (kể cả khi đã chuyển sang ổ khác)
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().audio_dir())
        .unwrap_or_else(|_| std::env::temp_dir());
    let _ = std::fs::create_dir_all(&dir);
    dir.to_string_lossy().to_string()
}

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    arboard::Clipboard::new().map_err(es)?.get_text().map_err(es)
}

#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(es)
}

#[tauri::command]
fn open_folder(app: AppHandle, path: String) -> Result<(), String> {
    app.opener().open_path(path, None::<&str>).map_err(es)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            check_tools,
            install_ytdlp,
            install_ffmpeg,
            install_deno,
            fetch_info,
            start_download,
            cancel_download,
            default_output_dir,
            reveal_file,
            open_folder,
            read_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("lỗi khi chạy ứng dụng Tauri");
}
