//! Test aid: the `mzlab://` protocol over plain HTTP on 127.0.0.1 (no Tauri), so that `tests/e2e_shim.py` can drive the page, the
//! shim and the worker in Chromium against the real native engine. `serve PORT FILE...` registers the files, prints one line
//! `FILE <id> <name> <size>` per file and then serves until it is killed.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::Arc;

use mzlab_desktop::{handle, State};

fn main() {
    let mut args = std::env::args().skip(1);
    let port: u16 = args
        .next()
        .and_then(|p| p.parse().ok())
        .expect("usage: serve PORT FILE...");
    let state = Arc::new(State::new());
    for f in args {
        let (id, p) = state.pick(f.into()).expect("file");
        println!("FILE {id} {} {}", p.name, p.size);
    }
    let listener = TcpListener::bind(("127.0.0.1", port)).expect("port");
    println!("READY");
    std::io::stdout().flush().ok();
    for stream in listener.incoming().flatten() {
        let state = state.clone();
        std::thread::spawn(move || {
            let mut line = String::new();
            let mut reader = BufReader::new(&stream);
            if reader.read_line(&mut line).is_err() {
                return;
            }
            let target = line.split(' ').nth(1).unwrap_or("/");
            let (path, query) = target.split_once('?').unwrap_or((target, ""));
            let r = handle(&state, path, query);
            let head = format!(
                "HTTP/1.1 {} X\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                r.status,
                r.content_type,
                r.body.len()
            );
            let mut out = &stream;
            let _ = out.write_all(head.as_bytes());
            let _ = out.write_all(&r.body);
        });
    }
}
