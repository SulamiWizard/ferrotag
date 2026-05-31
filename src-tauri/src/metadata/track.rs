use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::picture::PictureType;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::{Deserialize, Serialize};

// Mirrors the TypeScript Track interface in src/types/track.ts.
// Tauri serializes this to JSON when returning it to the frontend, so field
// names must stay in snake_case and match exactly. If you add a field here,
// add it to the TypeScript interface too.
#[derive(Serialize, Deserialize, Clone)]
pub struct TrackMetadata {
    pub path: String,
    pub title: Option<String>,
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub album_artists: Vec<String>,
    pub year: Option<String>,
    pub release_date: Option<String>,
    pub recording_date: Option<String>,
    pub original_release_date: Option<String>,
    pub track_number: Option<String>,
    pub disc_number: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub description: Option<String>,
}

// Reads the embedded CoverFront picture and returns it as a base64 data URI
// (e.g. "data:image/jpeg;base64,...") so it can be used directly in an <img> src.
pub fn get_album_art(path: &str) -> Option<String> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag()?;

    let picture = tag
        .pictures()
        .iter()
        .find(|p| p.pic_type() == PictureType::CoverFront)
        .or_else(|| tag.pictures().first())?;

    let mime = picture.mime_type()?.as_str();
    let b64 = STANDARD.encode(picture.data());

    Some(format!("data:{};base64,{}", mime, b64))
}

// Opens an audio file with lofty and reads all supported metadata fields into
// a TrackMetadata struct. Returns None if the file can't be opened or parsed.
// Fields missing from the file's tags are returned as None/empty vec.
pub fn read_track(path: &str) -> Option<TrackMetadata> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag();

    Some(TrackMetadata {
        path: path.to_string(),
        title: tag.and_then(|t| t.title().map(|s| s.to_string())),
        // get_strings returns all values for the key (important for FLAC which
        // can have multiple ARTIST tags).
        artists: tag
            .map(|t| {
                t.get_strings(ItemKey::TrackArtist)
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default(),
        album: tag.and_then(|t| t.album().map(|s| s.to_string())),
        album_artists: tag
            .map(|t| {
                t.get_strings(ItemKey::AlbumArtist)
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default(),
        year: tag.and_then(|t| t.get_string(ItemKey::Year).map(|s| s.to_string())),
        release_date: tag.and_then(|t| t.get_string(ItemKey::ReleaseDate).map(|s| s.to_string())),
        recording_date: tag.and_then(|t| t.get_string(ItemKey::RecordingDate).map(|s| s.to_string())),
        original_release_date: tag.and_then(|t| t.get_string(ItemKey::OriginalReleaseDate).map(|s| s.to_string())),
        track_number: tag.and_then(|t| t.get_string(ItemKey::TrackNumber).map(|s| s.to_string())),
        disc_number: tag.and_then(|t| t.get_string(ItemKey::DiscNumber).map(|s| s.to_string())),
        genre: tag.and_then(|t| t.genre().map(|s| s.to_string())),
        comment: tag.and_then(|t| t.get_string(ItemKey::Comment).map(|s| s.to_string())),
        description: tag.and_then(|t| t.get_string(ItemKey::Description).map(|s| s.to_string())),
    })
}
