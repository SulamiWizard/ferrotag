use tauri::menu::{MenuBuilder, SubmenuBuilder};

mod commands;
mod metadata;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // TODO: wire up menu events to the frontend (open folder, save, select all, clear)
        .setup(|app| {
            let menu = MenuBuilder::new(app)
                .item(
                    &SubmenuBuilder::new(app, "File")
                        .text("open", "Open Folder")
                        .separator()
                        .text("save", "Save Changes")
                        .separator()
                        .text("quit", "Quit")
                        .build()?,
                )
                .item(
                    &SubmenuBuilder::new(app, "Edit")
                        .text("select_all", "Select All")
                        .text("clear", "Clear List")
                        .build()?,
                )
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open" => {}
                "save" => {}
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // All Tauri commands callable from the frontend via invoke() must be
        // registered here. Adding a #[tauri::command] function without registering
        // it here will cause invoke() to return an error at runtime.
        .invoke_handler(tauri::generate_handler![
            commands::scan::load_tracks,
            commands::art::load_album_art,
            commands::art::read_image,
            commands::art::set_album_art,
            commands::art::extract_album_art,
            commands::tags::save_track,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
