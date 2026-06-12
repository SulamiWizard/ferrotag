use lofty::config::ParseOptions;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use std::collections::HashMap;

fn parse_opts() -> ParseOptions {
    ParseOptions::new().implicit_conversions(false)
}

// Writes a set of field changes to a single audio file.
// `changes` is a map of field name → new value, containing only the fields the
// user actually edited (omitted fields are left untouched).
// An empty string value clears the tag. Fields not in the match arms are ignored.
#[tauri::command]
pub fn save_track(path: String, changes: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let mut tagged_file = Probe::open(&path)
        .map_err(|e| e.to_string())?
        .options(parse_opts())
        .read()
        .map_err(|e| e.to_string())?;

    // primary_tag_mut() returns the main tag for the format (ID3v2 for MP3,
    // VorbisComments for FLAC, etc.). If the file has no tag yet, create one.
    if tagged_file.primary_tag().is_none() {
        let tag_type = tagged_file.primary_tag_type();
        tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
    }

    // Modify the tag inside a block so the mutable borrow ends before
    // save_to_path. We also capture what we need for the ID3v2 post-fix.
    let (tag_type, id3v2_tag_snapshot) = {
        let tag = tagged_file
            .primary_tag_mut()
            .ok_or("Failed to initialize tag")?;

        for (field, value) in &changes {
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
                // Artists require special handling because tag formats differ:
                // FLAC (VorbisComments) supports multiple separate ARTIST tags.
                // MP3/M4A store artists as a single string joined with "/".
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

        let tt = tag.tag_type();
        // Only clone when we actually need the snapshot for post-processing.
        let snapshot = if tt == TagType::Id3v2 {
            Some(tag.clone())
        } else {
            None
        };
        (tt, snapshot)
    }; // mutable borrow of tagged_file ends here

    tagged_file
        .save_to_path(&path, lofty::config::WriteOptions::default())
        .map_err(|e| e.to_string())?;

    // ID3v2 (MP3) converts track/disc numbers to u32 during save, stripping
    // leading zeros ("03" → "3"). Fix by re-writing just those frames via the
    // native Id3v2Tag API, which writes frame text verbatim without conversion.
    if tag_type == TagType::Id3v2 {
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

        if !fixes.is_empty() {
            use lofty::id3::v2::{Frame, FrameId, Id3v2Tag, TextInformationFrame};
            use lofty::TextEncoding;
            use std::borrow::Cow;

            // Convert the in-memory tag snapshot (which has all our changes
            // applied) to an Id3v2Tag, then overwrite just the TRCK/TPOS frames
            // with their raw text values, bypassing the u32 normalisation.
            let mut id3v2 = Id3v2Tag::from(id3v2_tag_snapshot.unwrap());

            for (frame_id, value) in fixes {
                id3v2.insert(Frame::Text(TextInformationFrame::new(
                    FrameId::Valid(Cow::Owned(frame_id.to_string())),
                    TextEncoding::UTF8,
                    value,
                )));
            }

            id3v2
                .save_to_path(&path, lofty::config::WriteOptions::default())
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
