use crate::metadata::track::{read_track, TrackMetadata};
use rayon::prelude::*;
use std::path::Path;
use walkdir::WalkDir;

fn is_audio_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("mp3" | "flac" | "ogg" | "m4a" | "wav" | "aiff" | "ape" | "opus" | "wv")
    )
}

// Accepts a mix of file and directory paths dropped by the user.
// Directories are walked recursively with walkdir; individual files are
// checked directly. Paths are collected first, then tags are read in
// parallel with rayon. Unreadable files are silently skipped.
#[tauri::command]
pub fn load_tracks(paths: Vec<String>) -> Vec<TrackMetadata> {
    let mut candidates: Vec<String> = Vec::new();

    for path in paths {
        let p = Path::new(&path);
        if p.is_dir() {
            for entry in WalkDir::new(p).into_iter().flatten() {
                if is_audio_file(entry.path()) {
                    if let Some(s) = entry.path().to_str() {
                        candidates.push(s.to_string());
                    }
                }
            }
        } else if is_audio_file(p) {
            candidates.push(path);
        }
    }

    candidates
        .par_iter()
        .filter_map(|path| read_track(path))
        .collect()
}
