use crate::metadata::track::TrackMetadata;
use lofty::config::ParseOptions;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::Tag;
use serde_json::Value;
use std::{collections::HashMap, ffi::OsStr, path::Path};

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
        .unwrap_or("");

    match ext.to_ascii_lowercase().as_str() {
        "mp3" => Box::new(mp3::Mp3Handler),
        _ => Box::new(default::DefaultHandler),
    }
}

// Single-parse metadata read shared by every handler. Audio properties are
// skipped (TrackMetadata carries none), which avoids scanning the audio stream.
// A single parse populates every field: `implicit_conversions` was verified to
// make no difference to any field read here, so the previous second parse was
// pure overhead.
pub(crate) fn read_metadata(path: &str) -> Option<TrackMetadata> {
    let tagged = Probe::open(path)
        .ok()?
        .options(
            ParseOptions::new()
                .implicit_conversions(false)
                .read_properties(false),
        )
        .read()
        .ok()?;

    // Primary tag first, then any others (e.g. a trailing ID3v1) so a field the
    // primary tag lacks can be filled from a secondary tag.
    let primary_type = tagged.primary_tag_type();
    let tags: Vec<&Tag> = tagged
        .primary_tag()
        .into_iter()
        .chain(tagged.tags().iter().filter(|t| t.tag_type() != primary_type))
        .collect();

    Some(build_metadata(path, &tags))
}

// Maps the given tags onto the TrackMetadata DTO. Tags are consulted in order,
// so the first (primary) tag wins and later tags only fill gaps it left empty.
pub(crate) fn build_metadata(path: &str, tags: &[&Tag]) -> TrackMetadata {
    let string = |key: ItemKey| {
        tags.iter()
            .find_map(|t| t.get_string(key).map(str::to_string))
    };
    let strings = |key: ItemKey| {
        tags.iter()
            .map(|t| t.get_strings(key).map(str::to_string).collect::<Vec<_>>())
            .find(|v| !v.is_empty())
            .unwrap_or_default()
    };

    TrackMetadata {
        path: path.to_string(),
        size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
        title: string(ItemKey::TrackTitle),
        artists: strings(ItemKey::TrackArtist),
        album: string(ItemKey::AlbumTitle),
        album_artists: strings(ItemKey::AlbumArtist),
        year: string(ItemKey::Year),
        release_date: string(ItemKey::ReleaseDate),
        recording_date: string(ItemKey::RecordingDate),
        original_release_date: string(ItemKey::OriginalReleaseDate),
        track_number: string(ItemKey::TrackNumber),
        disc_number: string(ItemKey::DiscNumber),
        genre: string(ItemKey::Genre),
        composer: string(ItemKey::Composer),
        bpm: string(ItemKey::Bpm),
        comment: string(ItemKey::Comment),
        description: string(ItemKey::Description),
        lyricist: string(ItemKey::Lyricist),
        conductor: string(ItemKey::Conductor),
        arranger: string(ItemKey::Arranger),
        remixer: string(ItemKey::Remixer),
        copyright: string(ItemKey::CopyrightMessage),
        encoded_by: string(ItemKey::EncodedBy),
        sort_title: string(ItemKey::TrackTitleSortOrder),
        sort_artist: string(ItemKey::TrackArtistSortOrder),
        sort_album: string(ItemKey::AlbumTitleSortOrder),
        sort_album_artist: string(ItemKey::AlbumArtistSortOrder),
    }
}
