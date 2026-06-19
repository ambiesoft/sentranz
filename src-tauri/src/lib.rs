// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod aimodels;
mod commands;
mod llm;
mod models;
mod queue;
mod state;
mod text;

use state::{AppState, MainWindowState};
use tauri::{Emitter, Manager, WindowEvent};

use std::fs;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            // sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            // current_model: Arc::new(Mutex::new(state::ModelConfig {
            //     id: "".into(), //"google/gemma-4-26b-a4b".into(),
            //     endpoint: "http://localhost:1234/v1/chat/completions".into(),
            //     api_key: None,
            // })),
            current_model: Arc::new(Mutex::new(None)),
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

            let path = app.path().app_data_dir()?.join("main_back.json");
            let size_state = match fs::read_to_string(&path) {
                Ok(s) => match serde_json::from_str::<MainWindowState>(&s) {
                    Ok(state) => state,
                    Err(e) => {
                        eprintln!("Failed to parse {:?}: {}", path, e);

                        MainWindowState {
                            width: 1200.0,
                            height: 800.0,
                        }
                    }
                },
                Err(e) => {
                    eprintln!("Failed to read {:?}: {}", path, e);

                    MainWindowState {
                        width: 1200.0,
                        height: 800.0,
                    }
                }
            };

            let mut builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("sentranz");

            if size_state.width > 0.0 && size_state.height > 0.0 {
                builder = builder.inner_size(size_state.width, size_state.height)
            }
            builder.build()?;

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
                    // save size
                    if !window.is_minimized().unwrap_or(false)
                        && !window.is_maximized().unwrap_or(false)
                    {
                        if let Ok(size) = window.inner_size() {
                            let scale = window.scale_factor().unwrap_or(1.0);

                            let logical_width = size.width as f64 / scale;
                            let logical_height = size.height as f64 / scale;

                            let state = MainWindowState {
                                width: logical_width,
                                height: logical_height,
                            };

                            if let Ok(app_data_dir) = window.app_handle().path().app_data_dir() {
                                let _ = fs::create_dir_all(&app_data_dir);
                                let path = app_data_dir.join("main_back.json");

                                if let Ok(json) = serde_json::to_string_pretty(&state) {
                                    let _ = fs::write(path, json);
                                }
                            }
                        }
                    }

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
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
