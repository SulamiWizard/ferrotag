use crate::metadata::track::get_album_art;

#[tauri::command]
pub fn load_album_art(path: String) -> Option<String> {
    get_album_art(&path)
}
