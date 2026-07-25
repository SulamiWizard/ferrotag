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
    pub size_bytes: u64,
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
    pub composer: Option<String>,
    pub bpm: Option<String>,
    pub comment: Option<String>,
    pub description: Option<String>,
    pub lyricist: Option<String>,
    pub conductor: Option<String>,
    pub arranger: Option<String>,
    pub remixer: Option<String>,
    pub copyright: Option<String>,
    pub encoded_by: Option<String>,
    pub sort_title: Option<String>,
    pub sort_artist: Option<String>,
    pub sort_album: Option<String>,
    pub sort_album_artist: Option<String>,
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
