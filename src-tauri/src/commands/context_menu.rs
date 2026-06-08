#[cfg(target_os = "windows")]
mod imp {
    use winreg::enums::*;
    use winreg::RegKey;

    const SHELL_DIR: &str = r"Software\Classes\Directory\shell\Open with Ferrotag";
    const SHELL_BG: &str = r"Software\Classes\Directory\Background\shell\Open with Ferrotag";

    fn exe_path() -> Result<String, String> {
        std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_str()
            .ok_or_else(|| "Executable path contains invalid characters".to_string())
            .map(str::to_string)
    }

    pub fn register() -> Result<(), String> {
        let exe = exe_path()?;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        for (shell_key, path_arg) in [
            (SHELL_DIR, "\"%1\""),
            (SHELL_BG,  "\"%V\""),
        ] {
            let (key, _) = hkcu
                .create_subkey(shell_key)
                .map_err(|e| e.to_string())?;
            key.set_value("", &"Open with Ferrotag")
                .map_err(|e| e.to_string())?;
            key.set_value("Icon", &exe)
                .map_err(|e| e.to_string())?;

            let (cmd, _) = hkcu
                .create_subkey(format!("{shell_key}\\command"))
                .map_err(|e| e.to_string())?;
            cmd.set_value("", &format!("\"{exe}\" {path_arg}"))
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn unregister() -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        for key in [SHELL_DIR, SHELL_BG] {
            let _ = hkcu.delete_subkey_all(key);
        }
        Ok(())
    }
}

#[tauri::command]
pub fn register_context_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return imp::register();
    #[cfg(not(target_os = "windows"))]
    Err("Context menu registration is only supported on Windows".to_string())
}

#[tauri::command]
pub fn unregister_context_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return imp::unregister();
    #[cfg(not(target_os = "windows"))]
    Err("Context menu registration is only supported on Windows".to_string())
}
