use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Clone)]
pub struct AnalysisSession {
    pub sentences: Vec<String>,
}

pub struct AppState {
    pub sessions: Mutex<HashMap<String, AnalysisSession>>,
    pub current_model: Mutex<ModelConfig>,
}

#[derive(Clone)]
pub struct ModelConfig {
    pub id: String,
    pub endpoint: String,
    pub api_key: Option<String>,
}
