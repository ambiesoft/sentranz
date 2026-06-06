// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod aimodels;
mod commands;
mod llm;
mod models;
mod queue;
mod state;
mod text;

use state::AppState;
use tauri::{Emitter, Manager, WindowEvent};

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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
            shutting_down: Arc::new(AtomicBool::new(false)),
            default_analysis_width: Arc::new(Mutex::new(800)),
            default_analysis_height: Arc::new(Mutex::new(600)),
            running_ai_jobs: Arc::new(AtomicUsize::new(0)),
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>().inner().clone();
            let app_handle2 = app_handle.clone();
            let state2 = state.clone();
            tauri::async_runtime::spawn(async move {
                queue::llm_analysis_loop(app_handle, state).await;
            });
            tauri::async_runtime::spawn(async move {
                queue::llm_ask_loop(app_handle2, state2).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_analysis_window,
            commands::analyze_text,
            commands::set_document_title,
            commands::ask_ai,
            commands::split_text,
            aimodels::set_current_model,
            aimodels::get_available_models,
            commands::window_focused,
            commands::is_shutting_down,
            commands::exit_app,
            commands::get_default_analysis_size,
            commands::set_default_analysis_size,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                //
                // main closed?
                //
                if window.label() == "main" {
                    // hide all windows
                    state.shutting_down.store(true, Ordering::SeqCst);
                    for (_, w) in app.webview_windows() {
                        let _ = w.hide();
                    }
                    let _ = window.hide();

                    let _ = app.emit("will_close", ());
                } else {
                    // analysis window
                    let _ = app.emit("analysys_closed", window.label());
                }
            }
        })
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
