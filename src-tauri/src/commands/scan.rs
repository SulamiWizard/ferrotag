use crate::metadata::track::{read_track, TrackMetadata};
use std::path::Path;
use walkdir::WalkDir;

fn is_audio_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("mp3" | "flac" | "ogg" | "m4a" | "wav" | "aiff")
    )
}

#[tauri::command]
pub fn load_tracks(paths: Vec<String>) -> Vec<TrackMetadata> {
    let mut tracks = Vec::new();

    for path in paths {
        let p = Path::new(&path);

        if p.is_dir() {
            // recursively walk directories
            for entry in WalkDir::new(p).into_iter().flatten() {
                if is_audio_file(entry.path()) {
                    if let Some(track) = read_track(entry.path().to_str().unwrap()) {
                        tracks.push(track);
                    }
                }
            }
        } else if is_audio_file(p) {
            if let Some(track) = read_track(&path) {
                tracks.push(track);
            }
        }
    }

    tracks
}
