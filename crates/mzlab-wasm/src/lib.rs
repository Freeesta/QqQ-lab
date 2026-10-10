//! wasm-bindgen bridge. It runs only inside a Web Worker; the main thread gets ready-to-draw arrays.
use wasm_bindgen::prelude::*;

/// Version of the engine (core crate), for the page to show and to check the loaded .wasm.
#[wasm_bindgen]
pub fn version() -> String {
    mzlab_core::version().to_string()
}

#[cfg(test)]
mod tests {
    #[test]
    fn version_matches_core() {
        assert_eq!(super::version(), mzlab_core::version());
    }
}
