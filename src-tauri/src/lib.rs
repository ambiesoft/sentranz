// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod llm;
mod models;
mod text;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::analyze_text,
            commands::ask_ai
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
