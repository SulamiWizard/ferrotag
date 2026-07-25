use crate::handlers::get_handler;
use crate::metadata::track::TrackMetadata;
use jwalk::WalkDir;
use rayon::prelude::*;
use std::path::Path;
use std::sync::mpsc;
use tauri::ipc::Channel;

fn is_audio_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("mp3" | "flac" | "ogg" | "m4a" | "wav" | "aiff" | "ape" | "opus" | "wv")
    )
}

fn collect_paths(paths: Vec<String>) -> Vec<String> {
    let mut candidates = Vec::new();
    for path in paths {
        let p = Path::new(&path);
        if p.is_dir() {
            for entry in WalkDir::new(p).into_iter().flatten() {
                if is_audio_file(&entry.path()) {
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
}

// Reads audio metadata for all given paths and streams results to the frontend
// via a Channel in batches of 25. The invoke promise resolves only after all
// batches have been delivered, so the caller needs no separate "done" signal.
#[tauri::command]
pub async fn load_tracks(on_batch: Channel<Vec<TrackMetadata>>, paths: Vec<String>) {
    tauri::async_runtime::spawn_blocking(move || {
        let candidates = collect_paths(paths);
        let (tx, rx) = mpsc::channel::<TrackMetadata>();

        std::thread::spawn(move || {
            candidates.par_iter().for_each_with(tx, |tx, path| {
                // TODO: change to handler instead of track.rs read_track
                let handler = get_handler(path);

                if let Some(track) = handler.read_metadata(path) {
                    let _ = tx.send(track);
                }

                // if let Some(track) = read_track(path) {
                //     let _ = tx.send(track);
                // }
            });
            // dropping tx closes the channel, ending the rx loop below
        });

        const BATCH: usize = 25;
        let mut batch = Vec::with_capacity(BATCH);
        for track in rx {
            batch.push(track);
            if batch.len() >= BATCH {
                let _ = on_batch.send(std::mem::take(&mut batch));
            }
        }
        if !batch.is_empty() {
            let _ = on_batch.send(batch);
        }
    })
    .await
    .ok();
}
