//! Update of the web part: comparison of manifests, SHA-256 check, atomic swap and fallback (temporary folders, fake network).

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use mzlab_desktop::update::*;

fn entry(b: &[u8]) -> Entry {
    Entry {
        sha256: sha256_hex(b),
        size: b.len() as u64,
    }
}

const INDEX: &str = "<html><meta content=\"default-src 'self'; connect-src 'self'; img-src 'self'\"><script src=\"static/browser.js\"></script></html>";

/// A tiny site: (path → bytes).
fn site(extra: &[(&str, &str)]) -> BTreeMap<String, Vec<u8>> {
    let mut m: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    m.insert("index.html".into(), INDEX.as_bytes().to_vec());
    m.insert("static/app.js".into(), b"app v1".to_vec());
    m.insert("static/pyodide/pyodide.asm.wasm".into(), vec![7u8; 5000]);
    m.insert("sw.js".into(), b"sw".to_vec());
    for (k, v) in extra {
        m.insert((*k).into(), v.as_bytes().to_vec());
    }
    m
}

fn manifest_of(site: &BTreeMap<String, Vec<u8>>, version: &str, min: &str) -> (Vec<u8>, Manifest) {
    let m = Manifest {
        version: version.into(),
        desktop_min: min.into(),
        files: site.iter().map(|(k, v)| (k.clone(), entry(v))).collect(),
    };
    (serde_json::to_vec(&m).unwrap(), m)
}

struct Fake {
    site: BTreeMap<String, Vec<u8>>,
    manifest: Vec<u8>,
    asked: std::cell::RefCell<Vec<String>>,
    offline: bool,
}

impl Fetch for Fake {
    fn get(&self, rel: &str) -> Result<Vec<u8>, UpdateError> {
        if self.offline {
            return Err(UpdateError {
                key: "offline",
                detail: String::new(),
            });
        }
        self.asked.borrow_mut().push(rel.to_string());
        if rel == MANIFEST_PATH {
            return Ok(self.manifest.clone());
        }
        self.site.get(rel).cloned().ok_or(UpdateError {
            key: "http",
            detail: "404".into(),
        })
    }
}

/// The "embedded" copy as prepare.py would leave it: transformed index.html, native files, own manifest.
fn embedded_of(site: &BTreeMap<String, Vec<u8>>, manifest: &[u8]) -> BTreeMap<String, Vec<u8>> {
    let mut e = site.clone();
    e.remove("sw.js");
    let html = INDEX
        .replacen(
            "connect-src 'self'",
            &format!("connect-src 'self'{CSP_EXTRA}"),
            1,
        )
        .replacen(
            "<script src=\"static/browser.js\">",
            "<script src=\"static/desktop-shim.js\"></script>\n<script src=\"static/browser.js\">",
            1,
        );
    e.insert("index.html".into(), html.into_bytes());
    e.insert(MANIFEST_PATH.into(), manifest.to_vec());
    e
}

fn fake(site: BTreeMap<String, Vec<u8>>, version: &str, min: &str) -> Fake {
    let (manifest, _) = manifest_of(&site, version, min);
    Fake {
        site,
        manifest,
        asked: Default::default(),
        offline: false,
    }
}

fn run_download(
    store: &Store,
    f: &Fake,
    emb: &BTreeMap<String, Vec<u8>>,
) -> Result<Vec<Progress>, UpdateError> {
    let embedded = |p: &str| emb.get(p).cloned();
    let (state, plan) = check(store, f, &embedded)?;
    assert!(matches!(state, Check::Available { .. }), "{state:?}");
    let (bytes, remote, local) = plan.unwrap();
    let mut seen = vec![];
    store.download(&bytes, &remote, &local, f, &embedded, &mut |p| seen.push(p))?;
    Ok(seen)
}

#[test]
fn only_the_changed_files_are_listed() {
    let v1 = site(&[]);
    let v2 = site(&[("static/app.js", "app v2"), ("static/new.js", "n")]);
    let (_, a) = manifest_of(&v1, "a", "0.1.0");
    let (_, b) = manifest_of(&v2, "b", "0.1.0");
    assert_eq!(changed(&a, &b), vec!["static/app.js", "static/new.js"]);
    assert!(changed(&a, &a).is_empty());
}

#[test]
fn versions_compare_as_numbers() {
    assert!(version_lt("0.1.0", "0.2.0"));
    assert!(version_lt("0.9", "0.10.0"));
    assert!(!version_lt("1.0.0", "1.0"));
    assert!(!version_lt("0.1.0", "0.1.0"));
}

#[test]
fn manifest_with_a_path_that_climbs_is_refused() {
    let mut s = site(&[]);
    s.insert("../evil".into(), b"x".to_vec());
    let (bytes, _) = manifest_of(&s, "v", "0.1.0");
    assert_eq!(parse_manifest(&bytes).unwrap_err().key, "manifest_invalid");
    assert!(parse_manifest(b"not json").is_err());
}

#[test]
fn download_takes_only_the_changed_files_and_the_swap_happens_at_the_next_start() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let v1 = site(&[]);
    let (m1, _) = manifest_of(&v1, "v1", "0.1.0");
    let emb = embedded_of(&v1, &m1);
    let f = fake(site(&[("static/app.js", "app v2")]), "v2", "0.1.0");
    let seen = run_download(&store, &f, &emb).unwrap();
    // the big wasm is NOT downloaded again; neither is sw.js (the program has none)
    assert_eq!(
        *f.asked.borrow(),
        vec![MANIFEST_PATH.to_string(), "static/app.js".to_string()]
    );
    assert_eq!(seen.len(), 1);
    assert_eq!((seen[0].file, seen[0].files), (1, 1));
    // nothing is served from the data folder before the restart
    assert!(store.read_web("static/app.js").is_none());
    assert!(matches!(
        check(&store, &f, &|p| emb.get(p).cloned()).unwrap().0,
        Check::Ready { .. }
    ));
    assert_eq!(store.start(), Start::Applied);
    assert_eq!(store.read_web("static/app.js").unwrap(), b"app v2");
    assert_eq!(
        store.read_web("static/pyodide/pyodide.asm.wasm").unwrap(),
        vec![7u8; 5000]
    );
    let html = String::from_utf8(store.read_web("index.html").unwrap()).unwrap();
    assert!(html.contains(CSP_EXTRA) && html.contains("desktop-shim.js"));
    assert_eq!(
        store.read_web("static/rust-worker.js").unwrap(),
        WORKER_JS.as_bytes()
    );
    assert!(store.read_web("sw.js").is_none());
    // now the data copy is the local one: the same site is current
    let f2 = fake(site(&[("static/app.js", "app v2")]), "v2", "0.1.0");
    assert_eq!(
        check(&store, &f2, &|p| emb.get(p).cloned()).unwrap().0,
        Check::Current
    );
    assert_eq!(store.start(), Start::Nothing);
}

#[test]
fn a_file_with_a_wrong_hash_stops_everything_and_leaves_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let v1 = site(&[]);
    let (m1, _) = manifest_of(&v1, "v1", "0.1.0");
    let emb = embedded_of(&v1, &m1);
    let mut f = fake(site(&[("static/app.js", "app v2")]), "v2", "0.1.0");
    f.site.insert("static/app.js".into(), b"tampered".to_vec()); // manifest says another hash
    let e = run_download(&store, &f, &emb).unwrap_err();
    assert_eq!(e.key, "hash_mismatch");
    assert!(!dir.path().join("web.new").exists());
    assert_eq!(store.start(), Start::Nothing);
    assert!(store.read_web("static/app.js").is_none());
}

#[test]
fn a_corrupt_data_copy_falls_back_to_the_embedded_one() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let v1 = site(&[]);
    let (m1, _) = manifest_of(&v1, "v1", "0.1.0");
    let emb = embedded_of(&v1, &m1);
    run_download(
        &store,
        &fake(site(&[("static/app.js", "app v2")]), "v2", "0.1.0"),
        &emb,
    )
    .unwrap();
    assert_eq!(store.start(), Start::Applied);
    fs::write(dir.path().join("web/static/app.js"), b"corrupted on disk").unwrap();
    assert_eq!(store.start(), Start::FellBack);
    assert!(!dir.path().join("web").exists());
    assert!(store.read_web("static/app.js").is_none()); // the caller serves the embedded file
}

#[test]
fn an_interrupted_swap_is_undone_and_a_half_download_is_dropped() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let v1 = site(&[]);
    let (m1, _) = manifest_of(&v1, "v1", "0.1.0");
    let emb = embedded_of(&v1, &m1);
    run_download(
        &store,
        &fake(site(&[("static/app.js", "app v2")]), "v2", "0.1.0"),
        &emb,
    )
    .unwrap();
    store.start();
    // crash between "web → web.old" and "web.new → web": only web.old is left
    fs::rename(dir.path().join("web"), dir.path().join("web.old")).unwrap();
    // and a download that never got READY
    fs::create_dir_all(dir.path().join("web.new/static")).unwrap();
    fs::write(dir.path().join("web.new/static/app.js"), b"half").unwrap();
    assert_eq!(store.start(), Start::Nothing);
    assert_eq!(store.read_web("static/app.js").unwrap(), b"app v2");
    assert!(!dir.path().join("web.new").exists() && !dir.path().join("web.old").exists());
}

#[test]
fn removed_files_disappear_and_new_ones_come() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let v1 = site(&[("static/old.js", "o")]);
    let (m1, _) = manifest_of(&v1, "v1", "0.1.0");
    let emb = embedded_of(&v1, &m1);
    run_download(
        &store,
        &fake(site(&[("static/new.js", "n")]), "v2", "0.1.0"),
        &emb,
    )
    .unwrap();
    store.start();
    assert!(store.read_web("static/old.js").is_none());
    assert_eq!(store.read_web("static/new.js").unwrap(), b"n");
}

#[test]
fn no_internet_is_a_state_not_an_error() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let mut f = fake(site(&[]), "v", "0.1.0");
    f.offline = true;
    assert_eq!(check(&store, &f, &|_| None).unwrap().0, Check::Offline);
}

#[test]
fn a_web_part_that_needs_a_newer_app_is_not_downloaded() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::new(dir.path().to_path_buf());
    let f = fake(site(&[]), "v", "99.0.0");
    let (state, plan) = check(&store, &f, &|_| None).unwrap();
    assert!(matches!(state, Check::NeedsApp { ref min, .. } if min == "99.0.0"));
    assert!(plan.is_none());
}

#[test]
fn path_traversal_is_not_served() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("secret"), b"s").unwrap();
    let store = Store::new(dir.path().join("data"));
    fs::create_dir_all(store.web()).unwrap();
    assert!(store.read_web("../secret").is_none());
    assert!(Path::new(&dir.path().join("secret")).exists());
}
