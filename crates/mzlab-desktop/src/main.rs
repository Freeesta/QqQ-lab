//! The window: the web app of `mzlab/web` as it is, a Tauri webview. Files come from the system dialog (or from a drop on the window)
//! as paths and are memory-mapped by the native engine; the page asks for TIC, XIC and scans through `mzlab://` (see `protocol.rs`
//! and `shim/`). The page itself is served by the same protocol under `/web/`: first the data copy (`update.rs`), then the copy inside
//! the program. The only network code is the update of the web part (`update_*` commands), which talks to the published site only.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use mzlab_desktop::update::{self, Check, Http, Store};
use mzlab_desktop::{handle, State};
use serde::Serialize;
use tauri::http::{header, Response};
use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
struct PickedFile {
    id: u32,
    name: String,
    size: u64,
}

fn register(state: &State, paths: Vec<PathBuf>) -> Vec<PickedFile> {
    paths
        .into_iter()
        .filter_map(|p| {
            let (id, f) = state.pick(p).ok()?;
            Some(PickedFile {
                id,
                name: f.name,
                size: f.size,
            })
        })
        .collect()
}

/// System file dialog (`dam`: only `.dam` files; otherwise mzML and Thermo `.raw`).
#[tauri::command]
async fn pick_files(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<State>>,
    dam: bool,
) -> Result<Vec<PickedFile>, String> {
    let dlg = app.dialog().file();
    let dlg = if dam {
        dlg.add_filter("DAM", &["dam", "DAM"])
    } else {
        dlg.add_filter("mzML / RAW", &["mzML", "mzml", "raw", "RAW"])
    };
    let picked = tauri::async_runtime::spawn_blocking(move || dlg.blocking_pick_files())
        .await
        .map_err(|e| e.to_string())?;
    let paths = picked
        .unwrap_or_default()
        .into_iter()
        .filter_map(|f| f.into_path().ok())
        .collect();
    Ok(register(&state, paths))
}

/// Files dropped on the window (the webview gives paths, not `File` objects).
#[tauri::command]
fn register_paths(state: tauri::State<'_, Arc<State>>, paths: Vec<String>) -> Vec<PickedFile> {
    register(&state, paths.into_iter().map(PathBuf::from).collect())
}

/// Update of the web part: the store (folder in the application data) and a flag against two downloads at once.
struct Updater {
    store: Arc<Store>,
    busy: AtomicBool,
}

fn embedded(app: &tauri::AppHandle) -> impl Fn(&str) -> Option<Vec<u8>> + '_ {
    move |p| app.asset_resolver().get(p.to_string()).map(|a| a.bytes)
}

/// Compares the published site with the copy in use (silent: no internet is the state `offline`, not an error).
#[tauri::command]
async fn update_check(
    app: tauri::AppHandle,
    upd: tauri::State<'_, Arc<Updater>>,
) -> Result<Check, String> {
    let store = upd.store.clone();
    tauri::async_runtime::spawn_blocking(move || {
        update::check(&store, &Http, &embedded(&app))
            .map(|(c, _)| c)
            .map_err(|e| e.key.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Downloads the changed files into `web.new` (events `mzlab-update-progress`); applied at the next start.
#[tauri::command]
async fn update_download(
    app: tauri::AppHandle,
    upd: tauri::State<'_, Arc<Updater>>,
) -> Result<Check, String> {
    if upd.busy.swap(true, Ordering::SeqCst) {
        return Err("busy".into());
    }
    let upd = upd.inner().clone();
    let again = upd.clone();
    let r = tauri::async_runtime::spawn_blocking(move || {
        let emb = embedded(&app);
        let (state, plan) =
            update::check(&upd.store, &Http, &emb).map_err(|e| e.key.to_string())?;
        if let Some((bytes, remote, local)) = plan {
            upd.store
                .download(&bytes, &remote, &local, &Http, &emb, &mut |p| {
                    let _ = app.emit("mzlab-update-progress", p);
                })
                .map_err(|e| e.key.to_string())?;
            return Ok(Check::Ready {
                version: remote.version,
            });
        }
        Ok(state)
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    again.busy.store(false, Ordering::SeqCst);
    r
}

#[tauri::command]
fn update_restart(app: tauri::AppHandle) {
    app.restart();
}

fn mime(rel: &str) -> &'static str {
    match rel.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "webmanifest" => "application/json",
        "wasm" => "application/wasm",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "woff2" => "font/woff2",
        "zip" => "application/zip",
        "mzml" | "xml" => "application/xml",
        _ => "application/octet-stream",
    }
}

/// `/web/<rel>`: the data copy if it has the file, otherwise the copy inside the program.
fn serve_web(app: &tauri::AppHandle, store: &Store, path: &str) -> Response<Vec<u8>> {
    let rel = path.trim_start_matches("/web/").trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    let (body, ctype) = match store.read_web(rel) {
        Some(b) => (Some(b), mime(rel).to_string()),
        None => match app.asset_resolver().get(rel.to_string()) {
            Some(a) => (Some(a.bytes), a.mime_type),
            None => (None, String::new()),
        },
    };
    let ok = body.is_some();
    Response::builder()
        .status(if ok { 200 } else { 404 })
        .header(header::CONTENT_TYPE, ctype)
        .body(body.unwrap_or_default())
        .unwrap_or_default()
}

fn main() {
    let state = Arc::new(State::new());
    let for_protocol = state.clone();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![
            pick_files,
            register_paths,
            update_check,
            update_download,
            update_restart
        ])
        .setup(|app| {
            // before the window: swap in a downloaded update (or drop a corrupt copy); the page then comes from `/web/`
            let store = Arc::new(Store::new(app.path().app_data_dir()?));
            store.start();
            app.manage(Arc::new(Updater {
                store,
                busy: AtomicBool::new(false),
            }));
            let base = if cfg!(windows) {
                "http://mzlab.localhost"
            } else {
                "mzlab://localhost"
            };
            let url = format!("{base}/web/index.html")
                .parse()
                .map_err(|_| "url")?;
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("mzlab")
                .inner_size(1400.0, 900.0)
                .min_inner_size(900.0, 600.0)
                .build()?;
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("mzlab", move |ctx, request, responder| {
            let state = for_protocol.clone();
            let app = ctx.app_handle().clone();
            // the engine can take long on a big file: never on the thread of the webview
            std::thread::spawn(move || {
                let uri = request.uri();
                if uri.path().starts_with("/web/") {
                    let store = app.state::<Arc<Updater>>().store.clone();
                    responder.respond(serve_web(&app, &store, uri.path()));
                    return;
                }
                let r = handle(&state, uri.path(), uri.query().unwrap_or(""));
                responder.respond(
                    Response::builder()
                        .status(r.status)
                        .header(header::CONTENT_TYPE, r.content_type)
                        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                        .body(r.body)
                        .unwrap_or_default(),
                );
            });
        })
        .build(tauri::generate_context!())
        .expect("mzlab: the window could not start");
    app.run(move |_handle, event| {
        if let RunEvent::Exit = event {
            state.cleanup();
        }
    });
}
