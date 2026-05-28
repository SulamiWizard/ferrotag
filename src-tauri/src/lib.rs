use tauri::menu::{MenuBuilder, SubmenuBuilder};

mod commands;
mod metadata;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // TODO:
        // get a working menu bar setup
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
        .invoke_handler(tauri::generate_handler![
            commands::scan::load_tracks,
            commands::art::load_album_art,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
