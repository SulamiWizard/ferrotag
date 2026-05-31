use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use std::collections::HashMap;

// Writes a set of field changes to a single audio file.
// `changes` is a map of field name → new value, containing only the fields the
// user actually edited (omitted fields are left untouched).
// An empty string value clears the tag. Fields not in the match arms are ignored.
#[tauri::command]
pub fn save_track(path: String, changes: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let mut tagged_file = Probe::open(&path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

    // primary_tag_mut() returns the main tag for the format (ID3v2 for MP3,
    // VorbisComments for FLAC, etc.). If a file has no tag at all this will fail.
    let tag = tagged_file.primary_tag_mut().ok_or("No tag found")?;

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

    tagged_file
        .save_to_path(&path, lofty::config::WriteOptions::default())
        .map_err(|e| e.to_string())?;

    Ok(())
}
