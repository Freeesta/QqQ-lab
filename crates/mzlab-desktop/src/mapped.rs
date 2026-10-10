//! Read-only memory map of a file picked by the user. This is the only place with `unsafe` in the crate.

use std::fs::File;
use std::path::Path;

use memmap2::Mmap;

pub struct Mapped {
    map: Option<Mmap>,
}

impl Mapped {
    /// Maps the file. An empty file has no map (mapping zero bytes fails on some systems).
    pub fn open(path: &Path) -> std::io::Result<Mapped> {
        let file = File::open(path)?;
        if file.metadata()?.len() == 0 {
            return Ok(Mapped { map: None });
        }
        // SAFETY: the map is read-only and lives as long as the parse of one file; if another program truncates the file meanwhile
        // the worst case is an I/O fault of this process, as for any program reading a file that changes under it.
        let map = unsafe { Mmap::map(&file)? };
        Ok(Mapped { map: Some(map) })
    }

    pub fn bytes(&self) -> &[u8] {
        self.map.as_deref().unwrap_or(&[])
    }
}
