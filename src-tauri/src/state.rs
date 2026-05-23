use crate::models::LlmJob;
use std::collections::HashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Clone)]
pub struct AnalysisSession {
    pub sentences: Vec<String>,
}

#[derive(Clone)]

pub struct AppState {
    pub sessions: Arc<Mutex<HashMap<String, AnalysisSession>>>,
    pub current_model: Arc<Mutex<ModelConfig>>,
    pub llm_queue: Arc<Mutex<VecDeque<LlmJob>>>,
}

#[derive(Clone)]
pub struct ModelConfig {
    pub id: String,
    pub endpoint: String,
    pub api_key: Option<String>,
}
