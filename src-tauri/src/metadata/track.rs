use lofty::prelude::*;
use lofty::probe::Probe;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct TrackMetadata {
    pub path: String,
    pub title: Option<String>,
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub album_artists: Vec<String>,
    pub year: Option<String>,
    pub track_number: Option<String>,
    pub disc_number: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
}

fn get_year(tag: &lofty::tag::Tag) -> Option<String> {
    tag.get_string(ItemKey::Year)
        .or_else(|| tag.get_string(ItemKey::ReleaseDate))
        .or_else(|| tag.get_string(ItemKey::RecordingDate))
        .or_else(|| tag.get_string(ItemKey::OriginalReleaseDate))
        .map(|s| s.to_string())
}

pub fn read_track(path: &str) -> Option<TrackMetadata> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag();

    Some(TrackMetadata {
        path: path.to_string(),
        title: tag.and_then(|t| t.title().map(|s| s.to_string())),
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
                t.get_strings(ItemKey::AlbumArtists)
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default(),
        year: tag.and_then(get_year),
        track_number: tag.and_then(|t| t.get_string(ItemKey::TrackNumber).map(|s| s.to_string())),
        disc_number: tag.and_then(|t| t.get_string(ItemKey::DiscNumber).map(|s| s.to_string())),
        genre: tag.and_then(|t| t.genre().map(|s| s.to_string())),
        comment: tag.and_then(|t| t.get_string(ItemKey::Comment).map(|s| s.to_string())),
    })
}
