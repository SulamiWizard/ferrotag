use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::probe::Probe;

use crate::metadata::track::get_album_art;

#[tauri::command]
pub fn load_album_art(path: String) -> Option<String> {
    get_album_art(&path)
}

#[tauri::command]
pub fn read_image(path: String) -> Option<String> {
    let data = std::fs::read(&path).ok()?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    Some(format!("data:{};base64,{}", mime, STANDARD.encode(&data)))
}

#[tauri::command]
pub fn set_album_art(audio_paths: Vec<String>, image_path: String) -> Result<(), String> {
    let image_data = std::fs::read(&image_path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&image_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime_type = match ext.as_str() {
        "png" => MimeType::Png,
        "gif" => MimeType::Gif,
        "webp" => MimeType::Unknown("image/webp".to_string()),
        "bmp" => MimeType::Bmp,
        _ => MimeType::Jpeg,
    };

    for path in &audio_paths {
        let mut tagged_file = Probe::open(path)
            .map_err(|e| e.to_string())?
            .read()
            .map_err(|e| e.to_string())?;
        let tag = tagged_file.primary_tag_mut().ok_or("No tag found")?;

        let picture = Picture::unchecked(image_data.clone())
            .pic_type(PictureType::CoverFront)
            .mime_type(mime_type.clone())
            .build();

        tag.remove_picture_type(PictureType::CoverFront);
        tag.push_picture(picture);

        tagged_file
            .save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn extract_album_art(audio_path: String, dest_path: String) -> Result<(), String> {
    let tagged_file = Probe::open(&audio_path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;
    let tag = tagged_file.primary_tag().ok_or("No tag found")?;

    let picture = tag
        .pictures()
        .iter()
        .find(|p| p.pic_type() == PictureType::CoverFront)
        .or_else(|| tag.pictures().first())
        .ok_or("No album art found")?;

    std::fs::write(&dest_path, picture.data()).map_err(|e| e.to_string())
}
