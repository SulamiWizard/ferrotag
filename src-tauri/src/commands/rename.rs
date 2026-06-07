use std::path::Path;

#[tauri::command]
pub fn rename_file(from: String, to: String) -> Result<String, String> {
    let src = Path::new(&from);
    let dst = Path::new(&to);

    if !src.exists() {
        return Err(format!("Source file not found: {from}"));
    }
    if dst.exists() {
        return Err(format!("Destination already exists: {to}"));
    }

    std::fs::rename(src, dst).map_err(|e| e.to_string())?;
    Ok(to)
}
