use super::FileHandler;
use crate::metadata::track::TrackMetadata;
use lofty::config::ParseOptions;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use serde_json::Value;
use std::collections::HashMap;

pub struct DefaultHandler;

impl FileHandler for DefaultHandler {
    fn read_metadata(&self, path: &str) -> Option<TrackMetadata> {
        super::read_metadata(path)
    }

    fn save_metadata(&self, path: &str, changes: &HashMap<String, Value>) -> Result<(), String> {
        let mut tagged_file = Probe::open(path)
            .map_err(|e| e.to_string())?
            .options(
                ParseOptions::new()
                    .implicit_conversions(false)
                    .read_properties(false),
            )
            .read()
            .map_err(|e| e.to_string())?;

        if tagged_file.primary_tag().is_none() {
            let tag_type = tagged_file.primary_tag_type();
            tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
        }

        tagged_file
            .save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

// Applies the changes HashMap to an open mutable tag.
pub(super) fn apply_changes(tag: &mut lofty::tag::Tag, changes: &HashMap<String, Value>) {
    for (field, value) in changes {
        match field.as_str() {
            "title" => {
                if let Some(v) = value.as_str() {
                    tag.set_title(v.to_string());
                }
            }
            "album" => {
                if let Some(v) = value.as_str() {
                    tag.set_album(v.to_string());
                }
            }
            "year" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Year, v.to_string());
                }
            }
            "release_date" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::ReleaseDate, v.to_string());
                }
            }
            "recording_date" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::RecordingDate, v.to_string());
                }
            }
            "original_release_date" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::OriginalReleaseDate, v.to_string());
                }
            }
            "track_number" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::TrackNumber, v.to_string());
                }
            }
            "disc_number" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::DiscNumber, v.to_string());
                }
            }
            "genre" => {
                if let Some(v) = value.as_str() {
                    tag.set_genre(v.to_string());
                }
            }
            "composer" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Composer, v.to_string());
                }
            }
            "bpm" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Bpm, v.to_string());
                }
            }
            "comment" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Comment, v.to_string());
                }
            }
            "description" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Description, v.to_string());
                }
            }
            "lyricist" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Lyricist, v.to_string());
                }
            }
            "conductor" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Conductor, v.to_string());
                }
            }
            "arranger" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Arranger, v.to_string());
                }
            }
            "remixer" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::Remixer, v.to_string());
                }
            }
            "copyright" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::CopyrightMessage, v.to_string());
                }
            }
            "encoded_by" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::EncodedBy, v.to_string());
                }
            }
            "sort_title" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::TrackTitleSortOrder, v.to_string());
                }
            }
            "sort_artist" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::TrackArtistSortOrder, v.to_string());
                }
            }
            "sort_album" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::AlbumTitleSortOrder, v.to_string());
                }
            }
            "sort_album_artist" => {
                if let Some(v) = value.as_str() {
                    tag.insert_text(ItemKey::AlbumArtistSortOrder, v.to_string());
                }
            }
            "artists" => {
                if let Some(arr) = value.as_array() {
                    let artists: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
                    tag.remove_key(ItemKey::TrackArtist);
                    match tag.tag_type() {
                        TagType::VorbisComments => {
                            for artist in artists {
                                tag.push(lofty::tag::TagItem::new(
                                    ItemKey::TrackArtist,
                                    lofty::tag::ItemValue::Text(artist.to_string()),
                                ));
                            }
                        }
                        _ => {
                            tag.set_artist(artists.join("/"));
                        }
                    }
                }
            }
            "album_artists" => {
                if let Some(arr) = value.as_array() {
                    let album_artists: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
                    tag.remove_key(ItemKey::AlbumArtist);
                    match tag.tag_type() {
                        TagType::VorbisComments => {
                            for artist in album_artists {
                                tag.push(lofty::tag::TagItem::new(
                                    ItemKey::AlbumArtist,
                                    lofty::tag::ItemValue::Text(artist.to_string()),
                                ));
                            }
                        }
                        _ => {
                            tag.insert_text(ItemKey::AlbumArtist, album_artists.join("/"));
                        }
                    }
                }
            }
            _ => {}
        }
    }
}
