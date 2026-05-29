// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod llm;
mod models;
mod state;
mod text;

use crate::commands::{llm_analysis_loop, llm_ask_loop};
use state::AppState;
use tauri::{Manager, WindowEvent};

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            // sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            current_model: Arc::new(Mutex::new(state::ModelConfig {
                id: "".into(), //"google/gemma-4-26b-a4b".into(),
                endpoint: "http://localhost:1234/v1/chat/completions".into(),
                api_key: None,
            })),
            llm_analysis_queue: Arc::new(Mutex::new(std::collections::VecDeque::new())),
            llm_ask_queue: Arc::new(Mutex::new(std::collections::VecDeque::new())),
            ask_running: Arc::new(AtomicBool::new(false)),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>().inner().clone();
            let app_handle2 = app_handle.clone();
            let state2 = state.clone();
            tauri::async_runtime::spawn(async move {
                llm_analysis_loop(app_handle, state).await;
            });
            tauri::async_runtime::spawn(async move {
                llm_ask_loop(app_handle2, state2).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_analysis_window,
            // commands::get_session_sentences,
            commands::analyze_text,
            commands::ask_ai,
            commands::split_text,
            commands::set_current_model,
            commands::get_available_models,
            commands::window_focused,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                //
                // main closed?
                //
                if window.label() == "main" {
                    let app = window.app_handle();

                    //
                    // close all windows
                    //
                    // for (_, w) in app.webview_windows() {
                    //     let _ = w.close();
                    // }

                    //
                    // exit app
                    //

                    app.exit(0);
                }
            }
        })
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
