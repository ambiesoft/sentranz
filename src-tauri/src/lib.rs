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
            current_model: std::sync::Mutex::new(state::ModelConfig {
                id: "google/gemma-4-26b-a4b".into(),
                endpoint: "http://localhost:1234/v1/chat/completions".into(),
                api_key: None,
            }),
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_analysis_window,
            commands::get_session_sentences,
            commands::analyze_text,
            commands::ask_ai,
            commands::split_text,
            commands::set_current_model,
            commands::get_available_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
