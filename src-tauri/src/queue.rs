use crate::commands::emit_remaining_task_count;
use crate::llm::openai::OpenAiProvider;
use crate::llm::types::Message;
use crate::models::{AskAiResponse, JobError, JobProgress, SentenceResult};
use crate::models::{LlmJob, LlmJobKind};
use crate::state::AppState;

use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

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
    state.running_ai_jobs.fetch_add(1, Ordering::SeqCst);
    emit_remaining_task_count(&app, &state);
    struct RunningGuard<'a> {
        counter: &'a AtomicUsize,
        app: &'a AppHandle,
        state: &'a AppState,
    }

    impl Drop for RunningGuard<'_> {
        fn drop(&mut self) {
            self.counter.fetch_sub(1, Ordering::SeqCst);
            emit_remaining_task_count(self.app, self.state);
        }
    }

    let _guard = RunningGuard {
        counter: &state.running_ai_jobs,
        app,
        state,
    };

    match job.kind {
        LlmJobKind::AnalyzeSentence {
            index,
            prev_sentences,
            sentence,
            after_sentences,
        } => {
            // eprint!(
            //     "Analyzing sentence with label {}: {}\n",
            //     job.window_label, sentence
            // );
            if let Some(window) = app.get_webview_window(&job.window_label) {
                // window found, continue processing

                let config = { state.current_model.lock().unwrap().clone() };
                if let Some(config) = config {
                    let provider = OpenAiProvider {
                        endpoint: config.endpoint,
                        model: config.id,
                        api_key: config.api_key,
                    };

                    let prompt = format!(
                        r#"
Context:

{}

=== TARGET SENTENCE ===
{}
=== END TARGET SENTENCE ===

{}

Translate and explain the TARGET SENTENCE. Also provide information that would be useful for Japanese learners of English.


Use the surrounding context when needed to resolve:
- pronouns (he, she, it, they)
- omitted information
- references to previous events
- ambiguous words

Answer in Japanese.
Please answer in Markdown.

Do not use LaTeX.
Do not use $...$ expressions.
Use plain text for variables such as x, y, and z.
"#,
                        prev_sentences.join("\n"),
                        sentence,
                        after_sentences.join("\n")
                    );

                    #[cfg(debug_assertions)]
                    eprintln!(
                        "Prompt starts---------->\n{}\n<----------Prompt ends",
                        prompt
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
                                    model: provider.model,
                                },
                            );
                            return;
                        }
                    };

                    #[cfg(debug_assertions)]
                    eprintln!(
                        "Model={} Prompt={} Completion={} Total={}",
                        response.model,
                        response.prompt_tokens,
                        response.completion_tokens,
                        response.total_tokens,
                    );

                    let result = SentenceResult {
                        index,
                        original: sentence,
                        answer: response.content,
                        analysis_error: "".into(),
                        model: response.model,
                        prompt_tokens: response.prompt_tokens,
                        completion_tokens: response.completion_tokens,
                        total_tokens: response.total_tokens,
                    };

                    let _ = window.emit_to(job.window_label.clone(), "sentence_ready", &result);
                } else {
                    // model config is None
                    let _ = window.emit_to(
                        job.window_label.clone(),
                        "analysis_error",
                        JobError {
                            index,
                            message: "Model config is empty".into(),
                            raw_response: None,
                            model: "".into(),
                        },
                    );
                    return;
                }
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
            #[cfg(debug_assertions)]
            eprint!(
                "Asking AI question with label {}: {}\n",
                job.window_label, sentence
            );
            if let Some(window) = app.get_webview_window(&job.window_label) {
                let config = { state.current_model.lock().unwrap().clone() };
                if let Some(config) = config {
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
                                    model: provider.model,
                                },
                            );
                            return;
                        }
                    };

                    let payload = AskAiResponse {
                        index,
                        response: response.content,
                        model: response.model,
                        total_tokens: response.total_tokens,
                    };
                    let _ = window.emit_to(job.window_label.clone(), "ask_ai_response", payload);
                } else {
                    // model config is None
                    let _ = window.emit_to(
                        job.window_label.clone(),
                        "analysis_error",
                        JobError {
                            index,
                            message: "Model config is empty".into(),
                            raw_response: None,
                            model: "".into(),
                        },
                    );
                    return;
                }
            } else {
                eprintln!("window not found: {}", job.window_label);
                return;
            }
        }
    }
}
