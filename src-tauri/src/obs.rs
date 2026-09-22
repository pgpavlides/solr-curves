//! Overlays for OBS: one web page per axis, on localhost.
//!
//! OBS can't show a Tauri window, but it can show a web page (Browser
//! Source). So the app serves one: `http://127.0.0.1:8799/roll` draws the roll
//! curve with the live dot on it, on a transparent background, and the same
//! for pitch, yaw and throttle. `/row` puts roll, pitch and yaw side by side
//! in one source, so OBS needs one browser source instead of three.
//!
//! It is a tiny HTTP server of its own - no crates, no outside access: it
//! binds 127.0.0.1 only. Three routes:
//!
//!   GET /                 the links, for a quick look in a browser
//!   GET /<axis>?options   one axis
//!   GET /row              roll, pitch and yaw side by side in one source
//!   GET /all              those and the throttle
//!   GET /live             server-sent events: the look, the curve, and where
//!                         each axis is 30 times a second - as the stick
//!                         reports it and as the curve answers (the same
//!                         table the game gets)
//!
//! The look is set in the app, not in the link: it is saved to obs_style.json
//! and pushed to every open overlay the moment it changes, so OBS never has to
//! be touched again. A query parameter still wins over it, for a one-off.
//!
//! The curve comes from C:\SolR\hotas_curves.txt (what the script reads) and
//! which input each axis uses from hotas_curves.json, both re-read when they
//! change, so the overlay follows the app without being told.

use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::{Duration, SystemTime};

/// The page, with its drawing code (assets/obs/overlay.html).
const PAGE: &str = include_str!("../assets/obs/overlay.html");

pub const AXES: [&str; 4] = ["roll", "pitch", "yaw", "throttle"];
/// pages holding more than one axis, so OBS needs only one source for them
const ROWS: [(&str, &[&str]); 2] = [("row", &["roll", "pitch", "yaw"]), ("all", &["roll", "pitch", "yaw", "throttle"])];
const NSAMP: usize = 257;
/// tried in turn, so a busy port doesn't stop the overlays working
const PORTS: [u16; 6] = [8799, 8800, 8801, 8802, 8803, 8804];
static PORT: AtomicU16 = AtomicU16::new(0);

/// The port the overlays are served on, 0 while it isn't running.
pub fn port() -> u16 {
    PORT.load(Ordering::Relaxed)
}

pub fn start() {
    let Some(listener) = PORTS.iter().find_map(|p| TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, *p)).ok()) else {
        eprintln!("OBS overlays: no free port");
        return;
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    PORT.store(port, Ordering::Relaxed);
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || serve(stream));
        }
    });
}

fn serve(mut stream: TcpStream) {
    let mut line = String::new();
    if BufReader::new(&stream).read_line(&mut line).is_err() {
        return;
    }
    let path = line.split_whitespace().nth(1).unwrap_or("/").to_string();
    let route = path.split('?').next().unwrap_or("/").trim_end_matches('/');
    match route {
        "" => send(&mut stream, "text/html; charset=utf-8", index().as_bytes()),
        "/live" => live(stream),
        r => {
            let name = r.trim_start_matches('/');
            // one axis, or one of the rows: the page draws a panel per axis
            let axes: Option<Vec<&str>> = if AXES.contains(&name) {
                Some(vec![name])
            } else {
                ROWS.iter().find(|(n, _)| *n == name).map(|(_, list)| list.to_vec())
            };
            match axes {
                Some(list) => {
                    let json = format!("[{}]", list.iter().map(|a| format!("\"{a}\"")).collect::<Vec<_>>().join(","));
                    send(&mut stream, "text/html; charset=utf-8", PAGE.replace("__AXES__", &json).as_bytes());
                }
                None => {
                    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                }
            }
        }
    }
}

fn send(stream: &mut TcpStream, mime: &str, body: &[u8]) {
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
}

fn index() -> String {
    let port = port();
    let links: String = ROWS
        .iter()
        .map(|(n, list)| ((*n).to_string(), list.join(", ")))
        .chain(AXES.iter().map(|a| ((*a).to_string(), (*a).to_string())))
        .map(|(name, what)| format!("<li><a href=\"/{name}\">{name}</a> &mdash; {what} &mdash; <code>http://127.0.0.1:{port}/{name}</code></li>"))
        .collect();
    format!(
        "<!doctype html><meta charset=utf-8><title>Sol-R Curves overlays</title>         <body style=\"font:14px system-ui;background:#0e1813;color:#e6eee5;padding:24px\">         <h1>Sol-R Curves overlays</h1><p>Add one of these as a Browser Source in OBS:</p><ul>{links}</ul>         <p style=\"color:#8ea396\">The app's OBS page copies these links, and holds the look they use.</p>"
    )
}

// ---------------------------------------------------------------- live values

/// The curve tables as the script reads them, re-read when the file changes.
struct Tables {
    when: Option<SystemTime>,
    table: Vec<i32>,
    /// which raw axis each of the four reads
    input: [usize; 4],
}
static TABLES: std::sync::Mutex<Tables> = std::sync::Mutex::new(Tables { when: None, table: Vec::new(), input: [0, 1, 5, 2] });

fn refresh_tables() {
    let path = crate::dir().join("hotas_curves.txt");
    let when = std::fs::metadata(&path).and_then(|m| m.modified()).ok();
    let mut t = TABLES.lock().unwrap();
    if when.is_some() && when == t.when {
        return;
    }
    if let Ok(text) = std::fs::read_to_string(&path) {
        let nums: Vec<i32> = text
            .lines()
            .skip(1)
            .flat_map(|l| l.split_whitespace())
            .filter_map(|w| w.parse::<i32>().ok())
            .take(AXES.len() * NSAMP)
            .collect();
        if nums.len() == AXES.len() * NSAMP {
            t.table = nums;
            t.when = when;
        }
    }
    // which input axis each control reads (hotas_curves.json, written with the curves)
    if let Ok(state) = std::fs::read_to_string(crate::dir().join("hotas_curves.json")) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&state) {
            for (i, a) in AXES.iter().enumerate() {
                if let Some(n) = v["input"][a].as_u64() {
                    t.input[i] = n as usize;
                }
            }
        }
    }
}

/// Where each axis is: `x` the stick (-1..1) and `y` what the curve answers.
fn values() -> String {
    refresh_tables();
    let t = TABLES.lock().unwrap();
    let stick = crate::hidraw::snapshot();
    let throttle = crate::hidraw::snapshot_throttle();
    let parts: Vec<String> = AXES
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let pad = if *a == "throttle" { throttle.as_ref() } else { stick.as_ref() };
            let x = pad.and_then(|p| p.axes.get(t.input[i]).copied()).unwrap_or(0.0).clamp(-1.0, 1.0);
            let y = if t.table.len() == AXES.len() * NSAMP {
                let k = (((x + 1.0) * 128.0).round() as usize).min(NSAMP - 1);
                t.table[i * NSAMP + k] as f32 / 32767.0
            } else {
                x
            };
            format!("\"{a}\":{{\"x\":{x:.4},\"y\":{y:.4},\"live\":{}}}", pad.is_some())
        })
        .collect();
    format!("{{{}}}", parts.join(","))
}

/// The curve itself, as 257 points per axis, so the page can draw it.
fn curves() -> String {
    refresh_tables();
    let t = TABLES.lock().unwrap();
    if t.table.len() != AXES.len() * NSAMP {
        return "{}".into();
    }
    let parts: Vec<String> = AXES
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let pts: Vec<String> = t.table[i * NSAMP..(i + 1) * NSAMP].iter().map(|v| format!("{:.3}", *v as f32 / 32767.0)).collect();
            format!("\"{a}\":[{}]", pts.join(","))
        })
        .collect();
    format!("{{{}}}", parts.join(","))
}

/// The look, as the app last saved it (obs_style.json next to the curves),
/// on one line: an event carries "data: " per line, so a pretty-printed file
/// would reach the page as nothing but its first brace.
fn style() -> String {
    std::fs::read_to_string(crate::dir().join("obs_style.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .map_or_else(|| "{}".into(), |v| v.to_string())
}

/// Server-sent events: the look and the curve when they change, then the live
/// values 30 times a second.
fn live(mut stream: TcpStream) {
    let head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: keep-alive\r\n\r\n";
    if stream.write_all(head.as_bytes()).is_err() {
        return;
    }
    let (mut sent_curve, mut sent_style) = (String::new(), String::new());
    let mut checked = std::time::Instant::now() - Duration::from_secs(1);
    loop {
        // the look is a small file: look at it a few times a second, not 30
        if checked.elapsed() >= Duration::from_millis(300) {
            checked = std::time::Instant::now();
            let style = style();
            if style != sent_style {
                if stream.write_all(format!("event: style
data: {style}

").as_bytes()).is_err() {
                    return;
                }
                sent_style = style;
            }
        }
        let curve = curves();
        if curve != sent_curve {
            if stream.write_all(format!("event: curve\ndata: {curve}\n\n").as_bytes()).is_err() {
                return;
            }
            sent_curve = curve;
        }
        if stream.write_all(format!("data: {}\n\n", values()).as_bytes()).is_err() {
            return; // OBS closed the source
        }
        std::thread::sleep(Duration::from_millis(33));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn get(path: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port())).unwrap();
        s.write_all(format!("GET {path} HTTP/1.1
Host: localhost

").as_bytes()).unwrap();
        s.set_read_timeout(Some(Duration::from_millis(1500))).unwrap();
        let mut out = Vec::new();
        let mut buf = [0u8; 4096];
        // read until the server closes (or the stream goes quiet, for /live)
        while let Ok(n) = s.read(&mut buf) {
            if n == 0 || out.len() > 200_000 {
                break;
            }
            out.extend_from_slice(&buf[..n]);
            // the live route never ends: stop once the values have arrived
            if path.starts_with("/live") && out.windows(9).any(|w| w == b"\"roll\":{\"x\"") {
                break;
            }
        }
        String::from_utf8_lossy(&out).into_owned()
    }

    #[test]
    fn serves_a_page_per_axis_and_a_live_stream() {
        start();
        assert!(port() > 0, "it found a port");

        for axis in AXES {
            let page = get(&format!("/{axis}"));
            assert!(page.starts_with("HTTP/1.1 200 OK"), "{axis}: {}", &page[..40.min(page.len())]);
            assert!(page.contains(&format!(": [\"{axis}\"];")), "{axis}: the page is for that axis alone");
            assert!(page.contains("EventSource(\"/live\")"), "{axis}: it listens for the live values");
        }
        // one source, several axes side by side
        assert!(get("/row").contains(": [\"roll\",\"pitch\",\"yaw\"];"), "the row is roll, pitch, yaw");
        assert!(get("/all").contains(": [\"roll\",\"pitch\",\"yaw\",\"throttle\"];"), "and /all adds the throttle");
        let index = get("/");
        assert!(index.contains("/throttle") && index.contains("/row") && index.contains("/all"), "the index lists them all");
        assert!(get("/nope").starts_with("HTTP/1.1 404"), "anything else is 404");

        let live = get("/live");
        assert!(live.contains("text/event-stream"), "the live route streams");
        assert!(live.contains("event: curve"), "the curve comes first");
        assert!(live.contains("\"roll\":{\"x\":"), "then where each axis is: {live:.400}");
    }
}
