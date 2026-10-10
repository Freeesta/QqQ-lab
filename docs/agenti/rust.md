# Motore Rust (`crates/`)
Stato attuale; il Python in Pyodide resta il riferimento finché Rust non lo eguaglia sui dati d'oro. Decisioni complete: `ARCHITETTURA.md` nel repository privato dei dati (`scratchpad/`).

## Struttura
- `crates/mzlab-core`: lettura mzML, TIC/XIC, picchi; Rust puro, legge da `Read`/`&[u8]`. `crates/mzlab-wasm`: ponte `wasm-bindgen`, gira SOLO in un Web Worker. `mzlab-desktop` (Tauri) non esiste ancora.
- Toolchain fissata in `rust-toolchain.toml`, `Cargo.lock` nel repository. Il `.wasm` e `pkg/` non si committano: li costruisce `pages.yml` in `site/static/wasm/`.

## Vincoli (breve)
- Nel grafo WASM solo dipendenze pure Rust: `flate2` con `default-features = false, features = ["rust_backend"]`; `zstd` solo `cfg(not(target_arch = "wasm32"))` (su wasm `ruzstd`); `memmap2` solo nel desktop. `rust.yml` rifiuta `memmap2|zstd-sys|libz-sys|cc` in `cargo tree --target wasm32-unknown-unknown -p mzlab-wasm`.
- Memoria WASM 32 MB iniziali, 256 MB al massimo (`.cargo/config.toml`); grandi allocazioni con `try_reserve` e errore con chiave i18n; release con `panic = "abort"` (il panic non si cattura: la difesa è un supervisore JS).
- m/z `f64`, intensità `f32`; entropia in `f64`. Rust restituisce chiavi i18n e parametri, mai testi.

## Compilare e provare
- `cargo test` (nativo), `cargo build --release --target wasm32-unknown-unknown -p mzlab-wasm`, `cargo tree --target wasm32-unknown-unknown -p mzlab-wasm`. `cargo fmt --check` e `cargo clippy` avvisano soltanto.
- `rust.yml` gira solo su modifiche a `crates/**`, `Cargo.*`, toolchain e config; non è un controllo obbligatorio di «main protetto».
- Dati d'oro: `python3 tools/golden.py --controlla` (aree 1e-4, m/z 1e-6, entropia 1e-9, indici dei bordi identici); `--crea` solo se il riferimento Python cambia di proposito.
