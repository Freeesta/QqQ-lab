//! Errors carry an i18n key and parameters, never a text: the page translates them (as the Python engine does).

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct Error {
    pub key: &'static str,
    pub params: Vec<(&'static str, String)>,
}

impl Error {
    pub fn new(key: &'static str) -> Self {
        Error {
            key,
            params: Vec::new(),
        }
    }

    pub fn with(mut self, name: &'static str, value: impl ToString) -> Self {
        self.params.push((name, value.to_string()));
        self
    }

    /// A large allocation that could not be reserved (the WASM memory is limited): never a panic.
    pub fn memory_budget() -> Self {
        Error::new("error.memoryBudget")
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.key)?;
        for (k, v) in &self.params {
            write!(f, " {k}={v}")?;
        }
        Ok(())
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;
