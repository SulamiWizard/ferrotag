// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    unsafe {
        // temporary fix for: https://github.com/tauri-apps/tauri/issues/5143
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
    ferrotag_lib::run()
}
