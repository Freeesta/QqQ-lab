//! Converts a Thermo `.raw` to mzML: `cargo run --release --example raw2mzml -- IN.raw OUT.mzML`.
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let name = std::path::Path::new(&a[1])
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let src = std::io::BufReader::new(std::fs::File::open(&a[1]).expect("open .raw"));
    let mut out = std::io::BufWriter::new(std::fs::File::create(&a[2]).expect("create mzML"));
    mzlab_core::raw::to_mzml(src, &mut out, &name).expect("convert");
}
