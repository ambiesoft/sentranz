// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod llm;
mod models;
mod state;
mod text;

use crate::commands::llm_worker_loop;
use state::AppState;
use tauri::Manager;

use std::sync::Arc;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            current_model: Arc::new(Mutex::new(state::ModelConfig {
                id: "".into(), //"google/gemma-4-26b-a4b".into(),
                endpoint: "http://localhost:1234/v1/chat/completions".into(),
                api_key: None,
            })),
            llm_queue: Arc::new(Mutex::new(std::collections::VecDeque::new())),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>().inner().clone();
            tauri::async_runtime::spawn(async move {
                llm_worker_loop(app_handle, state).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_analysis_window,
            commands::get_session_sentences,
            commands::analyze_text,
            commands::ask_ai,
            commands::split_text,
            commands::set_current_model,
            commands::get_available_models,
            commands::window_focused,
        ])
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
