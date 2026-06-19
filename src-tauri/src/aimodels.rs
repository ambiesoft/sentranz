use crate::state::{AppState, ModelConfig};
use tauri::State;

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<ModelConfig>, String> {
    Ok(vec![
        ModelConfig {
            id: "qwen/qwen3-vl-4b".into(),
            endpoint: "http://localhost:1234/v1/chat/completions".into(),
            api_key: None,
        },
        ModelConfig {
            id: "openai/gpt-oss-20b".into(),
            endpoint: "http://localhost:1234/v1/chat/completions".into(),
            api_key: None,
        },
        ModelConfig {
            id: "google/gemma-4-26b-a4b".into(),
            endpoint: "http://localhost:1234/v1/chat/completions".into(),
            api_key: None,
        },
        ModelConfig {
            id: "qwen3.5-27b".into(),
            endpoint: "http://localhost:1234/v1/chat/completions".into(),
            api_key: None,
        },
    ])
}

#[tauri::command]
pub async fn set_current_model(
    state: State<'_, AppState>,
    model_config: ModelConfig,
) -> Result<(), String> {
    *state.current_model.lock().unwrap() = Some(model_config);
    Ok(())
}
