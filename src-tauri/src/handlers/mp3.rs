use super::{
    default::{apply_changes, apply_id3v2_number_fix, DefaultHandler},
    FileHandler,
};
use crate::metadata::track::TrackMetadata;
use lofty::config::ParseOptions;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::TagType;
use serde_json::Value;
use std::collections::HashMap;

pub struct Mp3Handler;

impl FileHandler for Mp3Handler {
    fn read_metadata(&self, path: &str) -> Option<TrackMetadata> {
        DefaultHandler.read_metadata(path)
    }

    fn save_metadata(&self, path: &str, changes: &HashMap<String, Value>) -> Result<(), String> {
        let mut tagged_file = Probe::open(path)
            .map_err(|e| e.to_string())?
            .options(ParseOptions::new().implicit_conversions(false))
            .read()
            .map_err(|e| e.to_string())?;

        // Strip ID3v1 before writing. Files with stacked ID3v1 + ID3v2 tags
        // cause save failures because lofty writes the ID3v2 region but can
        // leave the ID3v1 footer in place, resulting in a corrupt or ambiguous
        // file. Removing it here means save_to_path writes a clean ID3v2-only file.
        tagged_file.remove(TagType::Id3v1);

        if tagged_file.primary_tag().is_none() {
            tagged_file.insert_tag(lofty::tag::Tag::new(TagType::Id3v2));
        }

        {
            let tag = tagged_file
                .primary_tag_mut()
                .ok_or("Failed to initialize tag")?;

            apply_changes(tag, changes);
        }

        tagged_file
            .save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;

        apply_id3v2_number_fix(path, TagType::Id3v2, changes)?;

        Ok(())
    }
}
