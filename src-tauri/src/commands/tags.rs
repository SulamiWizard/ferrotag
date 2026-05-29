use crate::metadata::track::TrackMetadata;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use std::collections::HashMap;

#[tauri::command]
pub fn save_track(path: String, changes: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let mut tagged_file = Probe::open(&path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

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
            "artists" => {
                if let Some(arr) = value.as_array() {
                    let artists: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();

                    tag.remove_key(ItemKey::TrackArtist);

                    match tag.tag_type() {
                        TagType::VorbisComments => {
                            // FLAC — true multiple tags
                            for artist in artists {
                                tag.push(lofty::tag::TagItem::new(
                                    ItemKey::TrackArtist,
                                    lofty::tag::ItemValue::Text(artist.to_string()),
                                ));
                            }
                        }
                        _ => {
                            // MP3 and others — join with delimiter
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

    tagged_file
        .save_to_path(&path, lofty::config::WriteOptions::default())
        .map_err(|e| e.to_string())?;

    Ok(())
}
