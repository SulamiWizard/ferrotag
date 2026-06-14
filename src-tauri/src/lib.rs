use std::sync::Mutex;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::Emitter;

mod commands;
mod metadata;

// Holds the folder path passed as a CLI argument (e.g. from the Windows
// context menu). Consumed once by get_startup_path so it only fires once.
struct StartupPath(Option<String>);

#[tauri::command]
fn get_startup_path(state: tauri::State<Mutex<StartupPath>>) -> Option<String> {
    state.lock().unwrap().0.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Capture a folder path passed as the first CLI argument before the
    // Tauri runtime consumes argv.
    let startup_path = std::env::args().nth(1).filter(|a| !a.starts_with('-'));

    tauri::Builder::default()
        .manage(Mutex::new(StartupPath(startup_path)))
        .setup(|app| {
            let mut file_sub = SubmenuBuilder::new(app, "File")
                .text("open", "Open Folder")
                .separator()
                .text("save", "Save Changes")
                .separator();

            #[cfg(target_os = "windows")]
            {
                file_sub = file_sub
                    .text("register_ctx_menu", "Register \"Open folder in Ferrotag\"")
                    .text("unregister_ctx_menu", "Unregister context menu")
                    .separator();
            }

            let file_menu = file_sub.text("quit", "Quit").build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(
                    &SubmenuBuilder::new(app, "Edit")
                        .text("select_all", "Select All")
                        .text("clear", "Clear List")
                        .separator()
                        .text("apply_rules", "Apply Rules to All")
                        .build()?,
                )
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open" => {
                    let _ = app.emit("menu-open", ());
                }
                "save" => {
                    let _ = app.emit("menu-save", ());
                }
                "select_all" => {
                    let _ = app.emit("menu-select-all", ());
                }
                "clear" => {
                    let _ = app.emit("menu-clear", ());
                }
                "apply_rules" => {
                    let _ = app.emit("menu-apply-rules", ());
                }
                "quit" => {
                    app.exit(0);
                }
                #[cfg(target_os = "windows")]
                "register_ctx_menu" => {
                    let ok = commands::context_menu::register_context_menu().is_ok();
                    let _ = app.emit("context-menu-registered", ok);
                }
                #[cfg(target_os = "windows")]
                "unregister_ctx_menu" => {
                    let ok = commands::context_menu::unregister_context_menu().is_ok();
                    let _ = app.emit("context-menu-unregistered", ok);
                }
                _ => {}
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_startup_path,
            commands::scan::load_tracks,
            commands::art::load_album_art,
            commands::art::load_all_album_art,
            commands::art::read_image,
            commands::art::set_album_art,
            commands::art::remove_album_art,
            commands::art::extract_album_art,
            commands::tags::save_track,
            commands::rename::rename_file,
            commands::config::get_rules_path,
            commands::config::read_rules,
            commands::context_menu::register_context_menu,
            commands::context_menu::unregister_context_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
