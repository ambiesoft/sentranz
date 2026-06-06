use crate::models::ModelInfo;
use crate::state::AppState;
use tauri::State;

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
