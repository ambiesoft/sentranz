// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod llm;
mod models;
mod state;
mod text;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: std::sync::Mutex::new(std::collections::HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_analysis_window,
            commands::get_session_sentences,
            commands::analyze_text,
            commands::ask_ai,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
