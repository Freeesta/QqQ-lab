//! The window: the web app of `mzlab/web` as it is, a Tauri webview. Files come from the system dialog (or from a drop on the window)
//! as paths and are memory-mapped by the native engine; the page asks for TIC, XIC and scans through `mzlab://` (see `protocol.rs`
//! and `shim/`). Nothing is sent anywhere: no network code, no updater.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::sync::Arc;

use mzlab_desktop::{handle, State};
use serde::Serialize;
use tauri::http::{header, Response};
use tauri::RunEvent;
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

fn main() {
    let state = Arc::new(State::new());
    let for_protocol = state.clone();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state.clone())
        .invoke_handler(tauri::generate_handler![pick_files, register_paths])
        .register_asynchronous_uri_scheme_protocol("mzlab", move |_ctx, request, responder| {
            let state = for_protocol.clone();
            // the engine can take long on a big file: never on the thread of the webview
            std::thread::spawn(move || {
                let uri = request.uri();
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
