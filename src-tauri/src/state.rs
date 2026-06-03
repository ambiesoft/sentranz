use crate::models::LlmJob;
// use std::collections::HashMap;
use std::collections::VecDeque;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::sync::Mutex;
#[derive(Clone)]
pub struct AppState {
    pub current_model: Arc<Mutex<ModelConfig>>,
    pub llm_analysis_queue: Arc<Mutex<VecDeque<LlmJob>>>,
    pub llm_ask_queue: Arc<Mutex<VecDeque<LlmJob>>>,
    pub ask_running: Arc<AtomicBool>,
    pub shutting_down: Arc<AtomicBool>,
    pub default_analysis_width: Arc<Mutex<u32>>,
    pub default_analysis_height: Arc<Mutex<u32>>,
    pub running_ai_jobs: Arc<AtomicUsize>,
}

#[derive(Clone)]
pub struct ModelConfig {
    pub id: String,
    pub endpoint: String,
    pub api_key: Option<String>,
}
