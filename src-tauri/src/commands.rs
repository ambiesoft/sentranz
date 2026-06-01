use crate::llm::openai::OpenAiProvider;
use crate::llm::types::Message;
use crate::models::{
    AskAiResponse, JobError, JobProgress, ModelInfo, QueueProgress, SentenceResult,
};
use crate::models::{LlmJob, LlmJobKind};
use crate::state::AppState;
use crate::text::splitter::split_sentences;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::State;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<ModelInfo>, String> {
    Ok(vec![
        ModelInfo {
            id: "qwen/qwen3-vl-4b".into(),
            display_name: "Qwen3 VL 4B".into(),
            provider: "Alibaba".into(),
        },
        ModelInfo {
            id: "openai/gpt-oss-20b".into(),
            display_name: "GPT OSS 20B".into(),
            provider: "OpenAI".into(),
        },
        ModelInfo {
            id: "google/gemma-4-26b-a4b".into(),
            display_name: "Gemma 4 26B A4B".into(),
            provider: "Google".into(),
        },
        ModelInfo {
            id: "bullerwins/translategemma-12b-it-GGUF".into(),
            display_name: "TranslateGemma 12B IT GGUF".into(),
            provider: "Bullerwins".into(),
        },
        ModelInfo {
            id: "lmstudio-community/DeepSeek-R1-Distill-Qwen-14B-GGUF".into(),
            display_name: "DeepSeek R1 Distill Qwen 14B GGUF".into(),
            provider: "LM Studio Community".into(),
        },
    ])
}

#[tauri::command]
pub async fn set_current_model(state: State<'_, AppState>, model_id: String) -> Result<(), String> {
    let mut config = state.current_model.lock().unwrap();
    config.id = model_id;
    Ok(())
}

pub async fn llm_analysis_loop(app: AppHandle, state: AppState) {
    loop {
        if state.ask_running.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_millis(1000)).await;
            continue;
        }
        let job = {
            let mut queue = state.llm_analysis_queue.lock().unwrap();
            queue.pop_front()
        };

        match job {
            Some(job) => {
                emit_remaining_task_count(&app, &state);
                process_job(&app, &state, job).await;
            }

            None => {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
}
pub async fn llm_ask_loop(app: AppHandle, state: AppState) {
    loop {
        let job = {
            let mut queue = state.llm_ask_queue.lock().unwrap();
            queue.pop_front()
        };

        match job {
            Some(job) => {
                emit_remaining_task_count(&app, &state);
                state.ask_running.store(true, Ordering::SeqCst);
                process_job(&app, &state, job).await;
                state.ask_running.store(false, Ordering::SeqCst);
            }

            None => {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
}

async fn process_job(app: &AppHandle, state: &AppState, job: LlmJob) {
    match job.kind {
        LlmJobKind::AnalyzeSentence { index, sentence } => {
            eprint!(
                "Analyzing sentence with label {}: {}\n",
                job.window_label, sentence
            );
            if let Some(window) = app.get_webview_window(&job.window_label) {
                // window found, continue processing

                let config = { state.current_model.lock().unwrap().clone() };

                let provider = OpenAiProvider {
                    endpoint: "http://localhost:1234/v1/chat/completions".into(),
                    model: config.id,
                    api_key: None,
                };

                let prompt = format!(
                    r#"
Please translate the following English sentence into Japanese and explain in Japanese any difficult vocabulary or helpful information for Japanese learners of English.

Sentence:
{}
"#,
                    sentence
                );

                let messages = vec![Message {
                    role: "user".into(),
                    content: prompt,
                }];

                let _ = window.emit_to(
                    job.window_label.clone(),
                    "analysis_progress",
                    JobProgress {
                        index,
                        message: "Thinking...".into(),
                    },
                );

                let response = match provider.chat(messages).await {
                    Ok(x) => x,

                    Err(e) => {
                        eprintln!("CHAT ERROR: {:?}", e);
                        let _ = window.emit_to(
                            job.window_label.clone(),
                            "analysis_error",
                            JobError {
                                index,
                                message: format!("LLM request error: {}", e),
                                raw_response: None,
                            },
                        );
                        return;
                    }
                };

                #[cfg(debug_assertions)]
                println!("RAW:\n{}", response);

                // let json_text = match extract_json(&response) {
                //     Some(x) => x,

                //     None => {
                //         let _ = window.emit_to(
                //             job.window_label.clone(),
                //             "analysis_error",
                //             JobError {
                //                 index,
                //                 message: format!("JSON parse error"),
                //                 raw_response: Some(response),
                //             },
                //         );
                //         return;
                //     }
                // };

                // let parsed: LlmSentenceResponse = match serde_json::from_str(&json_text) {
                //     Ok(x) => x,

                //     Err(e) => {
                //         let _ = window.emit_to(
                //             job.window_label.clone(),
                //             "analysis_error",
                //             JobError {
                //                 index,
                //                 message: format!("JSON format error: {}", e),
                //                 raw_response: Some(response),
                //             },
                //         );
                //         return;
                //     }
                // };

                let result = SentenceResult {
                    index,
                    original: sentence,
                    answer: response,
                    analysis_error: "".into(),
                };

                let _ = window.emit_to(job.window_label.clone(), "sentence_ready", &result);
            } else {
                eprintln!("window not found: {}", job.window_label);
                return;
            }
        }

        LlmJobKind::AskAi {
            index,
            sentence,
            question,
        } => {
            eprint!(
                "Asking AI question with label {}: {}\n",
                job.window_label, sentence
            );
            if let Some(window) = app.get_webview_window(&job.window_label) {
                let config = { state.current_model.lock().unwrap().clone() };

                let provider = OpenAiProvider {
                    endpoint: config.endpoint,
                    model: config.id,
                    api_key: config.api_key,
                };

                let prompt = format!(
                    r#"You are an English reading tutor.

Sentence:
{}

User question:
{}

Answer in Japanese.
Explain clearly and briefly."#,
                    sentence, question
                );

                let messages = vec![Message {
                    role: "user".into(),
                    content: prompt,
                }];

                let _ = window.emit_to(
                    job.window_label.clone(),
                    "ask_ai_progress",
                    JobProgress {
                        index,
                        message: "Thinking...".into(),
                    },
                );

                let response = match provider.chat(messages).await {
                    Ok(x) => x,
                    Err(e) => {
                        let _ = window.emit_to(
                            job.window_label.clone(),
                            "ask_ai_error",
                            JobError {
                                index,
                                message: format!("LLM request error: {}", e),
                                raw_response: None,
                            },
                        );
                        return;
                    }
                };

                let payload = AskAiResponse { index, response };
                let _ = window.emit_to(job.window_label.clone(), "ask_ai_response", payload);
            } else {
                eprintln!("window not found: {}", job.window_label);
                return;
            }
        }
    }
}

#[tauri::command]
pub async fn analyze_text(
    app: AppHandle,
    state: State<'_, AppState>,
    label: String,
    index: usize,
    sentence: String,
) -> Result<(), String> {
    let job = LlmJob {
        _id: Uuid::new_v4(),
        window_label: label.clone(),
        _priority: 100,
        kind: LlmJobKind::AnalyzeSentence { index, sentence },
    };

    let mut queue = state.llm_analysis_queue.lock().unwrap();
    queue.push_back(job);

    let remaining = { queue.len() };
    let progress = QueueProgress { total: remaining };
    let _ = app.emit("queue_progress", progress);

    Ok(())
}

fn emit_remaining_task_count(app: &AppHandle, state: &AppState) {
    let queue_analysis = state.llm_analysis_queue.lock().unwrap();
    let queue_ask = state.llm_ask_queue.lock().unwrap();

    let remaining = { queue_analysis.len() + queue_ask.len() };

    let progress = QueueProgress { total: remaining };
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

    let mut queue = state.llm_ask_queue.lock().unwrap();
    queue.push_front(job);

    let remaining = { queue.len() };

    let progress = QueueProgress { total: remaining };
    let _ = app.emit("queue_progress", progress);
    Ok(())
}

#[tauri::command]
pub async fn open_analysis_window(
    app: AppHandle,
    // state: State<'_, AppState>,
    session_id: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = WebviewWindowBuilder::new(
        &app,
        session_id.clone(),
        WebviewUrl::App("analysis.html".into()),
    )
    .title(session_id.clone())
    .inner_size(width, height)
    // .devtools(true)
    .build()
    .map_err(|e| e.to_string())?;

    let state = app.state::<AppState>().inner().clone();

    // Clean up session and pending jobs when window is closed
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            let mut queue_analysis = state.llm_analysis_queue.lock().unwrap();
            queue_analysis.retain(|job| job.window_label != session_id.clone());

            let mut queue_ask = state.llm_ask_queue.lock().unwrap();
            queue_ask.retain(|job| job.window_label != session_id.clone());
            println!("cleaned queue for {}", session_id);
        }
    });

    Ok(())
}

// #[tauri::command]
// pub fn get_session_sentences(state: State<AppState>, label: String) -> Result<Vec<String>, String> {
//     let sessions = state.sessions.lock().unwrap();
//     let session = sessions.get(&label).ok_or("session not found")?;

//     Ok(session.sentences.clone())
// }

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
