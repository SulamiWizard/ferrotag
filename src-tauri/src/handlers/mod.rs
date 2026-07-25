use crate::metadata::track::TrackMetadata;
use serde_json::Value;
use std::{
    collections::HashMap,
    ffi::OsStr,
    path::{self, Path},
};

pub mod default;
pub mod mp3;

pub trait FileHandler {
    fn read_metadata(&self, path: &str) -> Option<TrackMetadata>;
    fn save_metadata(&self, path: &str, changes: &HashMap<String, Value>) -> Result<(), String>;
}

pub fn get_handler(path_str: &str) -> Box<dyn FileHandler> {
    let ext = Path::new(path_str)
        .extension()
        .and_then(OsStr::to_str)
        .unwrap();

    match ext.to_ascii_lowercase().as_str() {
        "mp3" => Box::new(mp3::Mp3Handler),
        _ => Box::new(default::DefaultHandler),
    }
}
