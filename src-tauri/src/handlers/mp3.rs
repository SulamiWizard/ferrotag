use super::default::apply_changes;
use crate::handlers::FileHandler;
use crate::metadata::track::TrackMetadata;
use lofty::config::ParseOptions;
use lofty::file::AudioFile;
use lofty::id3::v2::{Frame, FrameId, Id3v2Tag, TextInformationFrame};
use lofty::mpeg::MpegFile;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::{Tag, TagType};
use lofty::TextEncoding;
use serde_json::Value;
use std::borrow::Cow;
use std::collections::HashMap;
use std::fs::File;

pub struct Mp3Handler;

impl FileHandler for Mp3Handler {
    fn read_metadata(&self, path: &str) -> Option<TrackMetadata> {
        let mut file = File::open(path).ok()?;
        let mpeg = MpegFile::read_from(
            &mut file,
            ParseOptions::new()
                .implicit_conversions(false)
                .read_properties(false),
        )
        .ok()?;

        // Prefer the ID3v2 tag, falling back to the trailing ID3v1 tag for any
        // field it lacks — commonly the year, which some taggers only write to
        // ID3v1.
        let id3v2 = mpeg.id3v2().map(|t| Tag::from(t.clone()));
        let id3v1 = mpeg.id3v1().map(|t| Tag::from(t.clone()));
        let tags: Vec<&Tag> = id3v2.iter().chain(id3v1.iter()).collect();

        let mut meta = super::build_metadata(path, &tags);

        // Non-conformant files sometimes keep the pre-2.4 TYER/TORY date frames
        // inside an ID3v2.4 tag (they were replaced by TDRC/TDRL in 2.4), so
        // lofty maps them to no field. Read them verbatim as a last resort.
        if let Some(v2) = mpeg.id3v2() {
            if meta.year.is_none() {
                meta.year = id3v2_text(v2, "TYER");
            }
            if meta.original_release_date.is_none() {
                meta.original_release_date = id3v2_text(v2, "TORY");
            }
        }

        Some(meta)
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

        // Strip ID3v1 before writing. Files with stacked ID3v1 + ID3v2 tags
        // cause save failures because lofty writes the ID3v2 region but can
        // leave the ID3v1 footer in place, resulting in a corrupt or ambiguous
        // file. Removing it here means we write a clean ID3v2-only file.
        tagged_file.remove(TagType::Id3v1);

        if tagged_file.primary_tag().is_none() {
            tagged_file.insert_tag(lofty::tag::Tag::new(TagType::Id3v2));
        }

        let tag = tagged_file
            .primary_tag_mut()
            .ok_or("Failed to initialize tag")?;
        apply_changes(tag, changes);

        // Write once via the native ID3v2 tag so TRCK/TPOS can be stored
        // verbatim. Saving through the generic Tag would store those numbers as
        // u32 and strip any leading zeros or "number/total" formatting
        // ("01/12" -> "1/12"), so we override those two frames before saving.
        let mut id3v2 = Id3v2Tag::from(tag.clone());
        apply_id3v2_number_overrides(&mut id3v2, changes);

        id3v2
            .save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

// Reads a text frame by its raw ID3v2 frame ID, used for legacy frames that
// lofty doesn't map to a field on its own.
fn id3v2_text(tag: &Id3v2Tag, frame_id: &'static str) -> Option<String> {
    tag.get_text(&FrameId::Valid(Cow::Borrowed(frame_id)))
        .map(|s| s.to_string())
}

// Overwrites the TRCK/TPOS frames with the exact strings supplied by the caller,
// preserving formatting (leading zeros, the "number/total" form) that lofty's
// generic Tag would normalize away. Empty values are left untouched.
fn apply_id3v2_number_overrides(tag: &mut Id3v2Tag, changes: &HashMap<String, Value>) {
    for (change_key, frame_id) in [("track_number", "TRCK"), ("disc_number", "TPOS")] {
        let Some(value) = changes.get(change_key).and_then(Value::as_str) else {
            continue;
        };
        if value.is_empty() {
            continue;
        }

        tag.insert(Frame::Text(TextInformationFrame::new(
            FrameId::Valid(Cow::Borrowed(frame_id)),
            TextEncoding::UTF8,
            value.to_string(),
        )));
    }
}
