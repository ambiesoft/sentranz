use crate::llm::openai::OpenAiProvider;
use crate::llm::types::Message;
use crate::models::{LlmSentenceResponse, SentenceResult};
use crate::state::{AnalysisSession, AppState};
use tauri::State;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

#[tauri::command]
pub async fn analyze_text(
    app: AppHandle,
    state: State<'_, AppState>,
    label: String,
) -> Result<(), String> {
    let provider = OpenAiProvider {
        endpoint: "http://localhost:1234/v1/chat/completions".into(),
        model: "qwen/qwen3-vl-4b".into(),
        api_key: None,
    };

    let sentences = {
        let sessions = state.sessions.lock().unwrap();

        let session = sessions.get(&label).ok_or("session not found")?;

        session.sentences.clone()
    };

    let window = app.get_webview_window(&label).ok_or("window not found")?;

    for sentence in sentences {
        let prompt = format!(
            r#"
Translate the sentence into Japanese and summarize briefly.

Return ONLY valid JSON.

{{
  "translation": "...",
  "summary": "..."
}}

Sentence:
{}
"#,
            sentence
        );

        let messages = vec![Message {
            role: "user".into(),
            content: prompt,
        }];

        let response = provider.chat(messages).await?;

        let parsed: LlmSentenceResponse =
            serde_json::from_str(&response).map_err(|e| e.to_string())?;

        let result = SentenceResult {
            original: sentence,

            translation: parsed.translation,

            summary: parsed.summary,
        };

        window
            .emit("sentence_ready", &result)
            .map_err(|e| e.to_string())?;
    }

    window
        .emit("analysis_finished", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ask_ai(sentence: String, question: String) -> Result<String, String> {
    let provider = OpenAiProvider {
        endpoint: "http://localhost:1234/v1/chat/completions".into(),
        model: "qwen/qwen3-vl-4b".into(),
        api_key: None,
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

    let response = provider.chat(messages).await?;

    Ok(response)
}

#[tauri::command]
pub async fn open_analysis_window(
    app: AppHandle,
    state: State<'_, AppState>,
    sentences: Vec<String>,
) -> Result<(), String> {
    let label = format!("analysis-{}", uuid::Uuid::new_v4());

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(label.clone(), AnalysisSession { sentences });
    }

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("analysis.html".into()))
        .title("Analysis")
        .devtools(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_session_sentences(state: State<AppState>, label: String) -> Result<Vec<String>, String> {
    let sessions = state.sessions.lock().unwrap();

    let session = sessions.get(&label).ok_or("session not found")?;

    Ok(session.sentences.clone())
}
