//! TIC and XIC over parsed spectra, as `Item.total` / `PeakTable.xic` of the Python engine (the sums are done in `f64`).

use crate::mzml::Spectrum;

/// (RT in minutes, summed intensity) of the scans of one MS level; scans without peaks count 0.
pub fn tic<'a>(spectra: impl IntoIterator<Item = &'a Spectrum>, level: u8) -> (Vec<f64>, Vec<f64>) {
    spectra
        .into_iter()
        .filter(|s| s.level == level)
        .map(|s| (s.rt, s.intensity.iter().map(|&v| v as f64).sum::<f64>()))
        .unzip()
}

/// Sum of the intensities with `lo <= m/z <= hi` in every scan of one level (the peaks of a scan are sorted by m/z or not: both work).
pub fn xic<'a>(
    spectra: impl IntoIterator<Item = &'a Spectrum>,
    level: u8,
    lo: f64,
    hi: f64,
) -> (Vec<f64>, Vec<f64>) {
    spectra
        .into_iter()
        .filter(|s| s.level == level)
        .map(|s| {
            let y: f64 =
                s.mz.iter()
                    .zip(&s.intensity)
                    .filter(|(m, _)| **m >= lo && **m <= hi)
                    .map(|(_, &i)| i as f64)
                    .sum();
            (s.rt, y)
        })
        .unzip()
}
