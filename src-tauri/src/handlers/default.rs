use std::collections::HashMap;
use lofty::config::ParseOptions;
use lofty::file::TaggedFile;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use serde_json::Value;
use crate::metadata::track::TrackMetadata;
use super::FileHandler;

pub struct DefaultHandler;

impl FileHandler for DefaultHandler {
    fn read_metadata(&self, path: &str) -> Option<TrackMetadata> {
        let tagged = Probe::open(path)
            .ok()?
            .options(ParseOptions::new().implicit_conversions(false))
            .read()
            .ok()?;

        let date_tagged: Option<TaggedFile> = if tagged.primary_tag_type() == TagType::Id3v2 {
            Probe::open(path).ok().and_then(|p| p.read().ok())
        } else {
            None
        };

        let tag = tagged.primary_tag();
        let date_tag = date_tagged.as_ref().and_then(|tf| tf.primary_tag()).or(tag);

        Some(TrackMetadata {
            path: path.to_string(),
            size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
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
                    t.get_strings(ItemKey::AlbumArtist)
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_default(),
            year: date_tag.and_then(|t| t.get_string(ItemKey::Year).map(|s| s.to_string())),
            release_date: date_tag
                .and_then(|t| t.get_string(ItemKey::ReleaseDate).map(|s| s.to_string())),
            recording_date: date_tag
                .and_then(|t| t.get_string(ItemKey::RecordingDate).map(|s| s.to_string())),
            original_release_date: date_tag.and_then(|t| {
                t.get_string(ItemKey::OriginalReleaseDate)
                    .map(|s| s.to_string())
            }),
            track_number: tag
                .and_then(|t| t.get_string(ItemKey::TrackNumber).map(|s| s.to_string())),
            disc_number: tag
                .and_then(|t| t.get_string(ItemKey::DiscNumber).map(|s| s.to_string())),
            genre: tag.and_then(|t| t.genre().map(|s| s.to_string())),
            composer: tag.and_then(|t| t.get_string(ItemKey::Composer).map(|s| s.to_string())),
            bpm: tag.and_then(|t| t.get_string(ItemKey::Bpm).map(|s| s.to_string())),
            comment: tag.and_then(|t| t.get_string(ItemKey::Comment).map(|s| s.to_string())),
            description: tag
                .and_then(|t| t.get_string(ItemKey::Description).map(|s| s.to_string())),
            lyricist: tag.and_then(|t| t.get_string(ItemKey::Lyricist).map(|s| s.to_string())),
            conductor: tag
                .and_then(|t| t.get_string(ItemKey::Conductor).map(|s| s.to_string())),
            arranger: tag.and_then(|t| t.get_string(ItemKey::Arranger).map(|s| s.to_string())),
            remixer: tag.and_then(|t| t.get_string(ItemKey::Remixer).map(|s| s.to_string())),
            copyright: tag.and_then(|t| {
                t.get_string(ItemKey::CopyrightMessage)
                    .map(|s| s.to_string())
            }),
            encoded_by: tag
                .and_then(|t| t.get_string(ItemKey::EncodedBy).map(|s| s.to_string())),
            sort_title: tag.and_then(|t| {
                t.get_string(ItemKey::TrackTitleSortOrder)
                    .map(|s| s.to_string())
            }),
            sort_artist: tag.and_then(|t| {
                t.get_string(ItemKey::TrackArtistSortOrder)
                    .map(|s| s.to_string())
            }),
            sort_album: tag.and_then(|t| {
                t.get_string(ItemKey::AlbumTitleSortOrder)
                    .map(|s| s.to_string())
            }),
            sort_album_artist: tag.and_then(|t| {
                t.get_string(ItemKey::AlbumArtistSortOrder)
                    .map(|s| s.to_string())
            }),
        })
    }

    fn save_metadata(&self, path: &str, changes: &HashMap<String, Value>) -> Result<(), String> {
        let mut tagged_file = Probe::open(path)
            .map_err(|e| e.to_string())?
            .options(ParseOptions::new().implicit_conversions(false))
            .read()
            .map_err(|e| e.to_string())?;

        if tagged_file.primary_tag().is_none() {
            let tag_type = tagged_file.primary_tag_type();
            tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
        }

        let tag_type = {
            let tag = tagged_file
                .primary_tag_mut()
                .ok_or("Failed to initialize tag")?;

            apply_changes(tag, changes);

            tag.tag_type()
        };

        tagged_file
            .save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;

        apply_id3v2_number_fix(path, tag_type, changes)?;

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
                    let album_artists: Vec<&str> =
                        arr.iter().filter_map(|v| v.as_str()).collect();
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

// Re-writes TRCK/TPOS frames verbatim via the native Id3v2Tag API to prevent
// lofty from stripping leading zeros when it converts them to u32 internally.
//
// Re-reads from disk after the first save so every frame written by lofty is
// preserved exactly — using the pre-save generic-tag snapshot risks losing
// frames that didn't survive the generic-Tag → Id3v2Tag round-trip (e.g. TYER
// in an ID3v2.4 file, which has no ItemKey mapping and lives only in the
// companion tag).
pub(super) fn apply_id3v2_number_fix(
    path: &str,
    tag_type: TagType,
    changes: &HashMap<String, Value>,
) -> Result<(), String> {
    if tag_type != TagType::Id3v2 {
        return Ok(());
    }

    let fixes: Vec<(&'static str, String)> =
        [("track_number", "TRCK"), ("disc_number", "TPOS")]
            .iter()
            .filter_map(|(change_key, frame_id)| {
                let v = changes.get(*change_key)?.as_str()?;
                if v.is_empty() {
                    None
                } else {
                    Some((*frame_id, v.to_string()))
                }
            })
            .collect();

    if fixes.is_empty() {
        return Ok(());
    }

    use lofty::id3::v2::{Frame, FrameId, Id3v2Tag, TextInformationFrame};
    use lofty::prelude::TagExt;
    use lofty::TextEncoding;
    use std::borrow::Cow;

    let tagged = Probe::open(path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;
    let tag = tagged
        .primary_tag()
        .ok_or("No tag found after save")?
        .clone();
    let mut id3v2 = Id3v2Tag::from(tag);

    for (frame_id, value) in fixes {
        id3v2.insert(Frame::Text(TextInformationFrame::new(
            FrameId::Valid(Cow::Owned(frame_id.to_string())),
            TextEncoding::UTF8,
            value,
        )));
    }

    id3v2
        .save_to_path(path, lofty::config::WriteOptions::default())
        .map_err(|e| e.to_string())?;

    Ok(())
}
