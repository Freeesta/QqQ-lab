//! Update of the web part of the program without downloading everything again. The site publishes `static/manifest.json` (path →
//! SHA-256 and size of every file, `version` = commit, `desktop_min` = oldest native app that can run this web part). The app compares
//! it with the manifest of its copy, downloads ONLY the files that differ, checks every SHA-256 and builds the new folder `web.new`
//! next to `web`; at the next start the folder is swapped in (`Store::start`). `mzlab://localhost/web/...` serves `web` first and the
//! copy inside the program second, so a missing or corrupt file never breaks the window. Pure functions plus a `Fetch` trait: the
//! tests need no network and no window.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// The only host the program talks to.
pub const BASE_URL: &str = "https://freeesta.github.io/mzlab/";
pub const MANIFEST_PATH: &str = "static/manifest.json";
pub const NATIVE_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Where a too old app sends the user.
pub const RELEASES_URL: &str = "https://github.com/Freeesta/mzlab/actions/workflows/desktop.yml";

/// Files of the web part that the program supplies itself (they belong to the native version, see `prepare.py`).
pub const WORKER_JS: &str = include_str!("../shim/desktop-worker.js");
pub const SHIM_JS: &str = include_str!("../shim/desktop-shim.js");
const WORKER_PATH: &str = "static/rust-worker.js";
const SHIM_PATH: &str = "static/desktop-shim.js";
const SW_PATH: &str = "sw.js";
/// Same edits as `prepare.py` (a test compares the two).
pub const CSP_EXTRA: &str = " mzlab: http://mzlab.localhost ipc: http://ipc.localhost";
const BROWSER_TAG: &str = r#"<script src="static/browser.js"></script>"#;
const SHIM_TAG: &str = r#"<script src="static/desktop-shim.js"></script>"#;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateError {
    pub key: &'static str,
    pub detail: String,
}

impl UpdateError {
    fn new(key: &'static str, detail: impl Into<String>) -> Self {
        Self {
            key,
            detail: detail.into(),
        }
    }
}

impl std::fmt::Display for UpdateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.key, self.detail)
    }
}

type Res<T> = Result<T, UpdateError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub desktop_min: String,
    pub files: BTreeMap<String, Entry>,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// A path of the manifest: relative, forward slashes, nothing that climbs out of the folder.
fn safe_path(p: &str) -> bool {
    !p.is_empty()
        && !p.starts_with('/')
        && !p.contains('\\')
        && !p.contains(':')
        && p.split('/').all(|c| !c.is_empty() && c != "." && c != "..")
}

pub fn parse_manifest(bytes: &[u8]) -> Res<Manifest> {
    let m: Manifest = serde_json::from_slice(bytes)
        .map_err(|e| UpdateError::new("manifest_invalid", e.to_string()))?;
    if m.files.is_empty() || !m.files.keys().all(|p| safe_path(p)) {
        return Err(UpdateError::new("manifest_invalid", "paths"));
    }
    if m.files.values().any(|e| e.sha256.len() != 64) || parse_version(&m.desktop_min).is_none() {
        return Err(UpdateError::new("manifest_invalid", "fields"));
    }
    Ok(m)
}

fn parse_version(v: &str) -> Option<Vec<u64>> {
    v.split('.').map(|c| c.parse().ok()).collect()
}

/// `a < b` for dotted numeric versions (`0.1.0` < `0.2`).
pub fn version_lt(a: &str, b: &str) -> bool {
    let (mut x, mut y) = (
        parse_version(a).unwrap_or_default(),
        parse_version(b).unwrap_or_default(),
    );
    let n = x.len().max(y.len());
    x.resize(n, 0);
    y.resize(n, 0);
    x < y
}

/// Does this web part need a newer native app than the installed one?
pub fn needs_newer_app(remote: &Manifest) -> bool {
    version_lt(NATIVE_VERSION, &remote.desktop_min)
}

/// Files to download: new in `remote` or with another hash (sorted by path). The files the program supplies itself are never listed.
pub fn changed(local: &Manifest, remote: &Manifest) -> Vec<String> {
    remote
        .files
        .iter()
        .filter(|(p, e)| {
            !is_native(p) && local.files.get(*p).map(|l| l.sha256 != e.sha256) != Some(false)
        })
        .map(|(p, _)| p.clone())
        .collect()
}

fn is_native(rel: &str) -> bool {
    rel == SW_PATH || rel == WORKER_PATH || rel == SHIM_PATH
}

/// What the desktop folder holds for a file of the site (`prepare.py` does the same on the embedded copy).
fn desktop_form(rel: &str, bytes: Vec<u8>) -> Res<Vec<u8>> {
    if rel != "index.html" {
        return Ok(bytes);
    }
    let html = String::from_utf8(bytes).map_err(|_| UpdateError::new("html_invalid", rel))?;
    let at = html
        .find("connect-src 'self'")
        .ok_or_else(|| UpdateError::new("html_invalid", "csp"))?
        + "connect-src 'self'".len();
    let mut out = html;
    out.insert_str(at, CSP_EXTRA);
    if !out.contains(BROWSER_TAG) {
        return Err(UpdateError::new("html_invalid", "browser.js"));
    }
    Ok(out
        .replacen(BROWSER_TAG, &format!("{SHIM_TAG}\n{BROWSER_TAG}"), 1)
        .into_bytes())
}

fn quote_path(rel: &str) -> String {
    let mut out = String::new();
    for b in rel.bytes() {
        if b.is_ascii_alphanumeric() || b"-._~/".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Network access, as a trait so that the tests use a fake.
pub trait Fetch {
    /// Bytes of `rel` under the site root, or `Err(offline)` / `Err(http)`.
    fn get(&self, rel: &str) -> Res<Vec<u8>>;
}

pub struct Http;

impl Fetch for Http {
    fn get(&self, rel: &str) -> Res<Vec<u8>> {
        let url = format!("{BASE_URL}{}", quote_path(rel));
        let agent = ureq::AgentBuilder::new()
            .redirects(0)
            .timeout_connect(std::time::Duration::from_secs(10))
            .timeout_read(std::time::Duration::from_secs(60))
            .build();
        match agent.get(&url).call() {
            Ok(r) => {
                let mut buf = Vec::new();
                std::io::Read::read_to_end(&mut r.into_reader(), &mut buf)
                    .map_err(|e| UpdateError::new("offline", e.to_string()))?;
                Ok(buf)
            }
            Err(ureq::Error::Status(c, _)) => Err(UpdateError::new("http", c.to_string())),
            Err(e) => Err(UpdateError::new("offline", e.to_string())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Progress {
    pub file: usize,
    pub files: usize,
    pub bytes: u64,
    pub total: u64,
}

/// The folders of the program inside the application data folder.
pub struct Store {
    pub root: PathBuf,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Start {
    Nothing,
    /// A downloaded update was swapped in.
    Applied,
    /// `web` was corrupt and was removed: the copy inside the program is used.
    FellBack,
}

fn is_ok_dir(dir: &Path) -> bool {
    let Ok(stored) = fs::read(dir.join("stored.json")) else {
        return false;
    };
    let Ok(stored) = serde_json::from_slice::<BTreeMap<String, String>>(&stored) else {
        return false;
    };
    let manifest_ok = fs::read(dir.join(MANIFEST_PATH))
        .map(|b| parse_manifest(&b).is_ok())
        .unwrap_or(false);
    manifest_ok
        && !stored.is_empty()
        && stored.iter().all(|(rel, sha)| {
            safe_path(rel)
                && fs::read(dir.join(rel))
                    .map(|b| &sha256_hex(&b) == sha)
                    .unwrap_or(false)
        })
}

fn write_file(dir: &Path, rel: &str, bytes: &[u8]) -> Res<()> {
    let p = dir.join(rel);
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| UpdateError::new("disk", e.to_string()))?;
    }
    fs::write(&p, bytes).map_err(|e| UpdateError::new("disk", e.to_string()))
}

impl Store {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
    pub fn web(&self) -> PathBuf {
        self.root.join("web")
    }
    fn staging(&self) -> PathBuf {
        self.root.join("web.new")
    }
    fn old(&self) -> PathBuf {
        self.root.join("web.old")
    }

    /// At every start, before the window: finish or undo an interrupted swap, swap in a downloaded update, drop a corrupt copy.
    pub fn start(&self) -> Start {
        let (web, new, old) = (self.web(), self.staging(), self.old());
        if old.exists() {
            if web.exists() {
                let _ = fs::remove_dir_all(&old);
            } else {
                let _ = fs::rename(&old, &web);
            }
        }
        let mut result = Start::Nothing;
        if new.join("READY").is_file() && is_ok_dir(&new) {
            let had = web.exists();
            if had && fs::rename(&web, &old).is_err() {
                return result;
            }
            if fs::rename(&new, &web).is_ok() {
                let _ = fs::remove_dir_all(&old);
                result = Start::Applied;
            } else if had {
                let _ = fs::rename(&old, &web);
            }
        }
        if new.exists() {
            let _ = fs::remove_dir_all(&new);
        }
        if web.exists() && !is_ok_dir(&web) {
            let _ = fs::remove_dir_all(&web);
            result = Start::FellBack;
        }
        result
    }

    /// A file of the data copy (`rel` as in the URL after `/web/`); `None` → the copy inside the program.
    pub fn read_web(&self, rel: &str) -> Option<Vec<u8>> {
        if !safe_path(rel) {
            return None;
        }
        fs::read(self.web().join(rel)).ok()
    }

    /// Manifest of the copy in use: the data copy if it exists, otherwise what the embedded copy says.
    pub fn local_manifest(&self, embedded: &dyn Fn(&str) -> Option<Vec<u8>>) -> Option<Manifest> {
        let bytes = self
            .read_web(MANIFEST_PATH)
            .or_else(|| embedded(MANIFEST_PATH))?;
        parse_manifest(&bytes).ok()
    }

    /// Version of an update already downloaded and waiting for the restart.
    pub fn pending(&self) -> Option<Manifest> {
        let new = self.staging();
        if !new.join("READY").is_file() {
            return None;
        }
        parse_manifest(&fs::read(new.join(MANIFEST_PATH)).ok()?).ok()
    }

    /// Builds `web.new` from the remote manifest: downloads (and checks) only the files that differ, copies the others from the copy
    /// in use, then marks the folder READY. Nothing visible changes until the next start.
    pub fn download(
        &self,
        remote_bytes: &[u8],
        remote: &Manifest,
        local: &Manifest,
        fetch: &dyn Fetch,
        current: &dyn Fn(&str) -> Option<Vec<u8>>,
        progress: &mut dyn FnMut(Progress),
    ) -> Res<()> {
        let new = self.staging();
        let _ = fs::remove_dir_all(&new);
        fs::create_dir_all(&new).map_err(|e| UpdateError::new("disk", e.to_string()))?;
        let r = self.build(&new, remote_bytes, remote, local, fetch, current, progress);
        if r.is_err() {
            let _ = fs::remove_dir_all(&new);
        }
        r
    }

    #[allow(clippy::too_many_arguments)]
    fn build(
        &self,
        new: &Path,
        remote_bytes: &[u8],
        remote: &Manifest,
        local: &Manifest,
        fetch: &dyn Fetch,
        current: &dyn Fn(&str) -> Option<Vec<u8>>,
        progress: &mut dyn FnMut(Progress),
    ) -> Res<()> {
        let todo = changed(local, remote);
        let total: u64 = todo.iter().map(|p| remote.files[p].size).sum();
        let mut stored: BTreeMap<String, String> = BTreeMap::new();
        let (mut done, mut bytes) = (0usize, 0u64);
        for (rel, entry) in &remote.files {
            if is_native(rel) {
                continue;
            }
            let kept = if todo.contains(rel) {
                None
            } else {
                current(rel)
            };
            let data = match kept {
                Some(b) => b,
                None => {
                    let raw = fetch.get(rel)?;
                    if raw.len() as u64 != entry.size || sha256_hex(&raw) != entry.sha256 {
                        return Err(UpdateError::new("hash_mismatch", rel.clone()));
                    }
                    done += 1;
                    bytes += entry.size;
                    progress(Progress {
                        file: done,
                        files: todo.len().max(done),
                        bytes,
                        total,
                    });
                    desktop_form(rel, raw)?
                }
            };
            stored.insert(rel.clone(), sha256_hex(&data));
            write_file(new, rel, &data)?;
        }
        for (rel, text) in [(WORKER_PATH, WORKER_JS), (SHIM_PATH, SHIM_JS)] {
            stored.insert(rel.to_string(), sha256_hex(text.as_bytes()));
            write_file(new, rel, text.as_bytes())?;
        }
        write_file(new, MANIFEST_PATH, remote_bytes)?;
        let s = serde_json::to_vec(&stored).map_err(|e| UpdateError::new("disk", e.to_string()))?;
        write_file(new, "stored.json", &s)?;
        if !is_ok_dir(new) {
            return Err(UpdateError::new("verify_failed", "web.new"));
        }
        write_file(new, "READY", b"")
    }
}

/// Outcome of the comparison with the published site.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum Check {
    /// The copy in use is the published one.
    Current,
    /// Files to download.
    Available {
        version: String,
        files: usize,
        bytes: u64,
    },
    /// Downloaded; restart to apply.
    Ready { version: String },
    /// The web part needs a newer native app.
    NeedsApp { min: String, url: &'static str },
    /// No internet (or the site does not answer): not an error for the user.
    Offline,
}

/// What `download` needs after a `check`: the remote manifest (raw bytes and parsed) and the local one.
pub type Plan = (Vec<u8>, Manifest, Manifest);

/// Downloads `manifest.json` and says what there is to do. The remote bytes are returned too (they are saved with the update).
pub fn check(
    store: &Store,
    fetch: &dyn Fetch,
    embedded: &dyn Fn(&str) -> Option<Vec<u8>>,
) -> Res<(Check, Option<Plan>)> {
    let bytes = match fetch.get(MANIFEST_PATH) {
        Ok(b) => b,
        Err(e) if e.key == "offline" || e.key == "http" => return Ok((Check::Offline, None)),
        Err(e) => return Err(e),
    };
    let remote = parse_manifest(&bytes)?;
    if needs_newer_app(&remote) {
        return Ok((
            Check::NeedsApp {
                min: remote.desktop_min.clone(),
                url: RELEASES_URL,
            },
            None,
        ));
    }
    if store.pending().map(|p| p.files == remote.files) == Some(true) {
        return Ok((
            Check::Ready {
                version: remote.version,
            },
            None,
        ));
    }
    let local = store
        .local_manifest(embedded)
        .ok_or_else(|| UpdateError::new("manifest_invalid", "local"))?;
    let todo = changed(&local, &remote);
    let removed = local
        .files
        .keys()
        .any(|p| !remote.files.contains_key(p) && !is_native(p));
    if todo.is_empty() && !removed {
        return Ok((Check::Current, None));
    }
    let size = todo.iter().map(|p| remote.files[p].size).sum();
    Ok((
        Check::Available {
            version: remote.version.clone(),
            files: todo.len(),
            bytes: size,
        },
        Some((bytes, remote, local)),
    ))
}
