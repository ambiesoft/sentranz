use crate::models::QueueProgress;
use crate::models::{LlmJob, LlmJobKind};
use crate::state::AppState;
use crate::text::splitter::split_sentences;

use std::sync::atomic::Ordering;

use tauri::State;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

#[tauri::command]
pub async fn analyze_text(
    app: AppHandle,
    state: State<'_, AppState>,
    label: String,
    index: usize,
    prev_sentences: Vec<String>,
    sentence: String,
    after_sentences: Vec<String>,
) -> Result<(), String> {
    let job = LlmJob {
        _id: Uuid::new_v4(),
        window_label: label.clone(),
        _priority: 100,
        kind: LlmJobKind::AnalyzeSentence {
            index,
            prev_sentences,
            sentence,
            after_sentences,
        },
    };
    {
        let mut queue = state.llm_analysis_queue.lock().unwrap();
        queue.push_back(job);
    }
    emit_remaining_task_count(&app, &state);
    Ok(())
}

#[tauri::command]
pub async fn set_document_title(
    app: AppHandle,
    label: String,
    title: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.set_title(&title).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("window not found".into())
    }
}

pub fn emit_remaining_task_count(app: &AppHandle, state: &AppState) {
    let remaining: usize;
    let running: usize;
    {
        let queue_analysis = state.llm_analysis_queue.lock().unwrap();
        let queue_ask = state.llm_ask_queue.lock().unwrap();

        remaining = queue_analysis.len() + queue_ask.len();
        running = state.running_ai_jobs.load(Ordering::SeqCst);
    }

    let progress = QueueProgress {
        running,
        total: remaining,
    };
    let _ = app.emit("queue_progress", progress);
}
#[tauri::command]
pub async fn ask_ai(
    app: AppHandle,
    state: State<'_, AppState>,
    label: String,
    index: usize,
    sentence: String,
    question: String,
) -> Result<(), String> {
    let job = LlmJob {
        _id: Uuid::new_v4(),
        window_label: label,
        _priority: 0,
        kind: LlmJobKind::AskAi {
            index,
            sentence,
            question,
        },
    };

    {
        let mut queue = state.llm_ask_queue.lock().unwrap();
        queue.push_front(job);
    }
    emit_remaining_task_count(&app, &state);
    Ok(())
}

#[tauri::command]
pub async fn open_analysis_window(
    app: AppHandle,
    // state: State<'_, AppState>,
    session_id: String,
    width: f64,
    height: f64,
    start_analysis: bool,
) -> Result<(), String> {
    // Already exist?
    if let Some(window) = app.get_webview_window(&session_id) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();

        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        session_id.clone(),
        WebviewUrl::App(format!("analysis.html?start_analysis={}", start_analysis).into()),
    )
    .title("Analysis")
    .inner_size(width, height)
    .devtools(true)
    .build()
    .map_err(|e| e.to_string())?;

    let state = app.state::<AppState>().inner().clone();

    // Clean up session and pending jobs when window is closed
    // clone session_id for the closure so we don't move the original
    let session_for_cleanup = session_id.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            {
                let mut queue_analysis = state.llm_analysis_queue.lock().unwrap();
                queue_analysis.retain(|job| job.window_label != session_for_cleanup.clone());

                let mut queue_ask = state.llm_ask_queue.lock().unwrap();
                queue_ask.retain(|job| job.window_label != session_for_cleanup.clone());
                println!("cleaned queue for {}", session_for_cleanup.clone());
            }
            emit_remaining_task_count(&app, &state);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn split_text(text: String) -> Vec<String> {
    split_sentences(&text)
}

#[tauri::command]
pub fn window_focused(state: State<AppState>, label: String) {
    let mut queue = state.llm_analysis_queue.lock().unwrap();

    //
    // focused window jobs first
    //
    let mut focused = vec![];
    let mut others = vec![];

    while let Some(job) = queue.pop_front() {
        if job.window_label == label {
            focused.push(job);
        } else {
            others.push(job);
        }
    }

    //
    // rebuild
    //
    for job in focused {
        queue.push_back(job);
    }

    for job in others {
        queue.push_back(job);
    }
}

#[tauri::command]
pub fn is_shutting_down(state: State<AppState>) -> bool {
    state.shutting_down.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn get_default_analysis_size(state: State<AppState>) -> (u32, u32) {
    let width = state.default_analysis_width.lock().unwrap();
    let height = state.default_analysis_height.lock().unwrap();

    (width.clone(), height.clone())
}
#[tauri::command]
pub fn set_default_analysis_size(state: State<AppState>, width: u32, height: u32) {
    *state.default_analysis_width.lock().unwrap() = width;
    *state.default_analysis_height.lock().unwrap() = height;
}
