use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILE: &str = "rules.json";

// The built-in default rules, embedded at compile time from a real (lintable,
// syntax-highlighted) JSON file. These ship inside the binary so "Apply Rules"
// works out of the box — users never have to create rules.json. The file on
// disk is optional and only exists if the user chooses to customize it.
const DEFAULT_CONFIG: &str = include_str!("../../resources/default-rules.json");

// Resolves the rules.json path inside a "ferrotag" folder in the OS config
// directory (Windows: %APPDATA%\ferrotag, macOS: ~/Library/Application Support/ferrotag,
// Linux: ~/.config/ferrotag), creating the directory (but not the file) if needed.
fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .config_dir()
        .map_err(|e| e.to_string())?
        .join("ferrotag");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(CONFIG_FILE))
}

// Returns the rules JSON. If the user has a rules.json it's used; otherwise the
// built-in defaults are returned WITHOUT touching disk — the file is optional,
// so the feature works with zero setup. Parsing happens on the frontend.
#[tauri::command]
pub fn read_rules(app: tauri::AppHandle) -> Result<String, String> {
    let path = config_path(&app)?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(DEFAULT_CONFIG.to_string())
    }
}

// Returns the absolute path to rules.json for display purposes (e.g. tooltips).
// Does not create the file.
#[tauri::command]
pub fn get_rules_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(config_path(&app)?.to_string_lossy().to_string())
}
