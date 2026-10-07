//! A tiny loopback HTTP file server (std only).
//!
//! The webview plays and decodes media straight from disk through
//! `http://127.0.0.1:<port>/m/<token>.<ext>` URLs. Files must be registered first, so only
//! files the user picked are reachable, and every URL carries an unguessable token.
//! It supports HTTP range requests (seeking), CORS (so the canvas and WebAudio are never tainted)
//! and streams in small chunks, so memory use stays flat for multi‑gigabyte videos.

use std::collections::hash_map::RandomState;
use std::collections::HashMap;
use std::fs::File;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const CHUNK: usize = 256 * 1024;

#[derive(Default)]
struct Registry {
    by_token: HashMap<String, PathBuf>,
    by_path: HashMap<PathBuf, String>,
}

pub struct MediaServer {
    port: u16,
    registry: Arc<Mutex<Registry>>,
    counter: AtomicU64,
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp4") | Some("m4v") => "video/mp4",
        Some("mov") => "video/quicktime",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        Some("avi") => "video/x-msvideo",
        Some("ogv") => "video/ogg",
        Some("3gp") => "video/3gpp",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") | Some("oga") | Some("opus") => "audio/ogg",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("flac") => "audio/flac",
        Some("weba") => "audio/webm",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

/// 128 random-ish bits as hex (RandomState is seeded from the OS).
fn make_token(salt: u64, path: &Path) -> String {
    let mut out = String::with_capacity(32);
    for round in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(salt.wrapping_add(round));
        h.write(path.to_string_lossy().as_bytes());
        if let Ok(d) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
            h.write_u128(d.as_nanos());
        }
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

impl MediaServer {
    pub fn start() -> std::io::Result<Self> {
        let listener = TcpListener::bind(("127.0.0.1", 0))?;
        let port = listener.local_addr()?.port();
        let registry = Arc::new(Mutex::new(Registry::default()));
        let reg = registry.clone();
        thread::Builder::new()
            .name("media-server".into())
            .spawn(move || {
                for conn in listener.incoming() {
                    let Ok(stream) = conn else { continue };
                    let reg = reg.clone();
                    let _ = thread::Builder::new()
                        .name("media-conn".into())
                        .spawn(move || {
                            let _ = handle(stream, &reg);
                        });
                }
            })?;
        Ok(Self { port, registry, counter: AtomicU64::new(1) })
    }

    /// Makes a file reachable and returns its URL.
    pub fn register(&self, path: PathBuf) -> String {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e.to_ascii_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>()))
            .unwrap_or_default();
        let mut reg = self.registry.lock().unwrap();
        let token = if let Some(t) = reg.by_path.get(&path) {
            t.clone()
        } else {
            let t = make_token(self.counter.fetch_add(2, Ordering::Relaxed), &path);
            reg.by_token.insert(t.clone(), path.clone());
            reg.by_path.insert(path, t.clone());
            t
        };
        format!("http://127.0.0.1:{}/m/{}{}", self.port, token, ext)
    }
}

fn cors(extra: &str) -> String {
    format!(
        "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range, Content-Type\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges, Content-Type\r\nCross-Origin-Resource-Policy: cross-origin\r\nConnection: close\r\n{extra}"
    )
}

fn simple(stream: &mut TcpStream, status: &str) -> std::io::Result<()> {
    let head = format!("HTTP/1.1 {status}\r\n{}Content-Length: 0\r\n\r\n", cors(""));
    stream.write_all(head.as_bytes())
}

/// Parses an HTTP `Range: bytes=...` header for a file of `len` bytes. `None` = unsatisfiable.
fn parse_range(v: &str, len: u64) -> Option<(u64, u64)> {
    let spec = v.trim().strip_prefix("bytes=")?;
    let first = spec.split(',').next()?.trim();
    let (a, b) = first.split_once('-')?;
    if len == 0 {
        return None;
    }
    if a.is_empty() {
        let n: u64 = b.parse().ok()?;
        if n == 0 {
            return None;
        }
        return Some((len.saturating_sub(n), len - 1));
    }
    let start: u64 = a.parse().ok()?;
    let end: u64 = if b.is_empty() { len - 1 } else { b.parse::<u64>().ok()?.min(len - 1) };
    if start >= len || start > end {
        return None;
    }
    Some((start, end))
}

fn handle(mut stream: TcpStream, reg: &Arc<Mutex<Registry>>) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(15)))?;
    stream.set_write_timeout(Some(Duration::from_secs(60)))?;
    let _ = stream.set_nodelay(true);

    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    if reader.read_line(&mut line)? == 0 {
        return Ok(());
    }
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_ascii_uppercase();
    let target = parts.next().unwrap_or("").to_string();

    let mut range: Option<String> = None;
    let mut total = 0usize;
    loop {
        let mut h = String::new();
        let n = reader.read_line(&mut h)?;
        total += n;
        if n == 0 || h == "\r\n" || h == "\n" || total > 32 * 1024 {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            if k.trim().eq_ignore_ascii_case("range") {
                range = Some(v.trim().to_string());
            }
        }
    }

    if method == "OPTIONS" {
        return simple(&mut stream, "204 No Content");
    }
    if method != "GET" && method != "HEAD" {
        return simple(&mut stream, "405 Method Not Allowed");
    }

    // /m/<token>[.ext][?query]
    let path_part = target.split('?').next().unwrap_or("");
    let Some(rest) = path_part.strip_prefix("/m/") else {
        return simple(&mut stream, "404 Not Found");
    };
    let token = rest.split('.').next().unwrap_or("");
    let file_path = { reg.lock().unwrap().by_token.get(token).cloned() };
    let Some(file_path) = file_path else {
        return simple(&mut stream, "404 Not Found");
    };
    let Ok(mut file) = File::open(&file_path) else {
        return simple(&mut stream, "404 Not Found");
    };
    let len = file.metadata()?.len();
    let mime = mime_for(&file_path);

    let (status, start, end, extra) = match range.as_deref().map(|r| parse_range(r, len)) {
        Some(Some((s, e))) => (
            "206 Partial Content",
            s,
            e,
            format!("Content-Range: bytes {s}-{e}/{len}\r\n"),
        ),
        Some(None) => {
            let head = format!(
                "HTTP/1.1 416 Range Not Satisfiable\r\n{}Content-Range: bytes */{len}\r\nContent-Length: 0\r\n\r\n",
                cors("")
            );
            return stream.write_all(head.as_bytes());
        }
        None => ("200 OK", 0, len.saturating_sub(1), String::new()),
    };
    let body_len = if len == 0 { 0 } else { end - start + 1 };
    let head = format!(
        "HTTP/1.1 {status}\r\n{}Content-Type: {mime}\r\nContent-Length: {body_len}\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\n{extra}\r\n",
        cors("")
    );
    stream.write_all(head.as_bytes())?;
    if method == "HEAD" || body_len == 0 {
        return Ok(());
    }

    file.seek(SeekFrom::Start(start))?;
    let mut remaining = body_len;
    let mut buf = vec![0u8; CHUNK];
    while remaining > 0 {
        let want = remaining.min(CHUNK as u64) as usize;
        let n = file.read(&mut buf[..want])?;
        if n == 0 {
            break;
        }
        if stream.write_all(&buf[..n]).is_err() {
            break; // the player closed the connection (seek / unload)
        }
        remaining -= n as u64;
    }
    let _ = stream.shutdown(Shutdown::Both);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranges() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=500-", 1000), Some((500, 999)));
        assert_eq!(parse_range("bytes=-100", 1000), Some((900, 999)));
        assert_eq!(parse_range("bytes=0-5000", 1000), Some((0, 999)));
        assert_eq!(parse_range("bytes=2000-", 1000), None);
        assert_eq!(parse_range("bytes=5-2", 1000), None);
    }
}
