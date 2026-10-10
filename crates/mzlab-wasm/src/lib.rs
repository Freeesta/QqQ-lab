//! wasm-bindgen bridge. It runs only inside a Web Worker; the main thread gets ready-to-draw arrays.
//!
//! Every answer is written into a `Float64Array` the caller provides (the worker recycles them, so no allocation per frame):
//! `[rt(n), y(n)]` for chromatograms and `[n_total, count, (sid, rt, k, mz(k), y(k)) per scan]` for spectra. Errors are JSON
//! `{"error_key": ..., "params": {...}}` strings (the page translates the key), never a text.
use js_sys::{Function, Uint8Array};
use mzlab_core::{analysis, mzml};
use std::collections::HashMap;
use std::io::{BufReader, Read};
use wasm_bindgen::prelude::*;

/// Version of the engine (core crate), for the page to show and to check the loaded .wasm.
#[wasm_bindgen]
pub fn version() -> String {
    mzlab_core::version().to_string()
}

/// Reads a file in blocks asked to JS: `read(offset, length) -> Uint8Array` (a slice of the Blob read synchronously in the worker).
struct BlockReader {
    read: Function,
    pos: u64,
    size: u64,
}

impl Read for BlockReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let want = (buf.len() as u64).min(self.size.saturating_sub(self.pos));
        if want == 0 {
            return Ok(0);
        }
        let block = self
            .read
            .call2(
                &JsValue::NULL,
                &(self.pos as f64).into(),
                &(want as f64).into(),
            )
            .map_err(|_| std::io::Error::other("block read failed"))?;
        let block: Uint8Array = block
            .dyn_into()
            .map_err(|_| std::io::Error::other("block is not a Uint8Array"))?;
        let n = (block.length() as usize).min(buf.len());
        block.slice(0, n as u32).copy_to(&mut buf[..n]);
        self.pos += n as u64;
        Ok(n)
    }
}

fn error_json(e: &mzlab_core::Error) -> JsValue {
    let params: Vec<String> = e
        .params
        .iter()
        .map(|(k, v)| format!("\"{}\":{:?}", k, v))
        .collect();
    JsValue::from_str(&format!(
        "{{\"error_key\":\"{}\",\"params\":{{{}}}}}",
        e.key,
        params.join(",")
    ))
}

fn r1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
fn r3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}
fn r4(v: f64) -> f64 {
    (v * 10000.0).round() / 10000.0
}

/// The files opened in the worker, by slot (the index `k` of the session).
#[wasm_bindgen]
#[derive(Default)]
pub struct Engine {
    runs: HashMap<u32, mzml::Run>,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Engine {
        Engine::default()
    }

    /// Opens a file of `size` bytes read through `read(offset, length)`. Returns a JSON summary
    /// `{"spectra": n, "levels": {"1": [scans, profile scans], ...}, "unit": bool, "chromatograms": m}`.
    pub fn open(&mut self, slot: u32, size: f64, read: Function) -> Result<String, JsValue> {
        self.runs.remove(&slot);
        let reader = BufReader::with_capacity(
            1 << 20,
            BlockReader {
                read,
                pos: 0,
                size: size as u64,
            },
        );
        let run = mzml::read(reader).map_err(|e| error_json(&e))?;
        let mut levels: std::collections::BTreeMap<u8, (usize, usize)> = Default::default();
        for s in &run.spectra {
            let e = levels.entry(s.level).or_default();
            e.0 += 1;
            e.1 += s.profile as usize;
        }
        let lv: Vec<String> = levels
            .iter()
            .map(|(l, (n, p))| format!("\"{l}\":[{n},{p}]"))
            .collect();
        let out = format!(
            "{{\"spectra\":{},\"levels\":{{{}}},\"unit\":{},\"chromatograms\":{}}}",
            run.spectra.len(),
            lv.join(","),
            analysis::is_unit_resolution(&run.analyzers, &run.spectra),
            run.chromatograms.len()
        );
        self.runs.insert(slot, run);
        Ok(out)
    }

    pub fn close(&mut self, slot: u32) {
        self.runs.remove(&slot);
    }

    pub fn close_all(&mut self) {
        self.runs.clear();
    }

    /// Number of scans of one level (the capacity a trace needs).
    pub fn count(&self, slot: u32, level: u8) -> u32 {
        self.runs.get(&slot).map_or(0, |r| {
            r.spectra.iter().filter(|s| s.level == level).count() as u32
        })
    }

    /// TIC of one level into `out` as `[rt(n), y(n)]` (RT rounded to 4 decimals, y to 1, as the page gets them from Python);
    /// `px > 0` keeps at most two points per pixel column. Returns n (0 if the slot or `out` does not fit).
    pub fn tic(&self, slot: u32, level: u8, px: u32, out: &mut [f64]) -> u32 {
        match self.runs.get(&slot) {
            Some(r) => {
                let (rt, y) = analysis::tic(&r.spectra, level);
                write_trace(&rt, &y, px, out)
            }
            None => 0,
        }
    }

    /// XIC over `mz ± tol` of one level, same layout as `tic`.
    pub fn xic(&self, slot: u32, level: u8, mz: f64, tol: f64, px: u32, out: &mut [f64]) -> u32 {
        match self.runs.get(&slot) {
            Some(r) => {
                let (rt, y) = analysis::xic(&r.spectra, level, mz - tol, mz + tol);
                write_trace(&rt, &y, px, out)
            }
            None => 0,
        }
    }

    /// Length of the array `spectra` needs for the scans `i0..=i1` of one level (0 if out of range).
    pub fn spectra_len(&self, slot: u32, level: u8, i0: u32, i1: u32) -> u32 {
        let Some(r) = self.runs.get(&slot) else {
            return 0;
        };
        let mut len = 2usize;
        let mut pos = 0u32;
        for s in r.spectra.iter().filter(|s| s.level == level) {
            if pos >= i0 && pos <= i1 {
                len += 3 + 2 * s.mz.len();
            }
            pos += 1;
        }
        if i0 >= pos {
            0
        } else {
            len as u32
        }
    }

    /// Centroid scans `i0..=i1` of one level in bins of `bin_da` (unit resolution), into `out`:
    /// `[n_total, count, (sid, rt, k, mz(k), y(k)) per scan]`, m/z rounded to 3 decimals and y to 1 as Python does.
    /// Returns the length written (0 if out of range or `out` too short).
    pub fn spectra(
        &self,
        slot: u32,
        level: u8,
        i0: u32,
        i1: u32,
        bin_da: f64,
        out: &mut [f64],
    ) -> u32 {
        let Some(r) = self.runs.get(&slot) else {
            return 0;
        };
        let total = r.spectra.iter().filter(|s| s.level == level).count();
        if i0 as usize >= total || out.len() < 2 {
            return 0;
        }
        let mut w = 2usize;
        let mut count = 0.0;
        for (pos, s) in r.spectra.iter().filter(|s| s.level == level).enumerate() {
            if (pos as u32) < i0 || pos as u32 > i1 {
                continue;
            }
            let (mz, y) = if s.mz.is_empty() {
                (Vec::new(), Vec::new())
            } else {
                analysis::bin_centroids(&s.mz, &s.intensity, bin_da)
            };
            if w + 3 + 2 * mz.len() > out.len() {
                return 0;
            }
            out[w] = s.index as f64;
            out[w + 1] = r4(s.rt);
            out[w + 2] = mz.len() as f64;
            w += 3;
            for (i, v) in mz.iter().enumerate() {
                out[w + i] = r3(*v);
            }
            w += mz.len();
            for (i, v) in y.iter().enumerate() {
                out[w + i] = r1(*v);
            }
            w += y.len();
            count += 1.0;
        }
        out[0] = total as f64;
        out[1] = count;
        w as u32
    }

    /// Test hook: aborts the instance like a lost memory or a panic would (the worker supervisor must recover).
    pub fn crash(&self) {
        #[cfg(target_arch = "wasm32")]
        core::arch::wasm32::unreachable();
        #[cfg(not(target_arch = "wasm32"))]
        panic!("crash hook");
    }
}

fn write_trace(rt: &[f64], y: &[f64], px: u32, out: &mut [f64]) -> u32 {
    let keep = analysis::minmax_indices(rt, y, px as usize);
    let n = keep.len();
    if 2 * n > out.len() {
        return 0;
    }
    for (j, &i) in keep.iter().enumerate() {
        out[j] = r4(rt[i]);
        out[n + j] = r1(y[i]);
    }
    n as u32
}

#[cfg(test)]
mod tests {
    #[test]
    fn version_matches_core() {
        assert_eq!(super::version(), mzlab_core::version());
    }

    #[test]
    fn trace_is_rt_then_y_rounded() {
        let mut out = [0.0; 4];
        let n = super::write_trace(&[0.123456, 1.0], &[10.04, 20.06], 0, &mut out);
        assert_eq!(n, 2);
        assert_eq!(out, [0.1235, 1.0, 10.0, 20.1]);
        assert_eq!(
            super::write_trace(&[0.0, 1.0], &[1.0, 2.0], 0, &mut [0.0; 3]),
            0
        );
    }
}
