use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SentenceResult {
    pub index: usize,
    pub original: String,
    pub answer: String,
    pub analysis_error: String,
    pub model: String,
    pub total_tokens: u32,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq, Hash)]
pub struct ModelInfo {
    pub id: String,
    pub display_name: String,
    pub provider: String,
}

#[derive(Serialize, Clone)]
pub struct AskAiResponse {
    pub index: usize,
    pub response: String,
    pub model: String,
    pub total_tokens: u32,
}

#[derive(Clone)]
pub struct LlmJob {
    pub _id: Uuid,
    pub window_label: String,
    pub _priority: u32,
    pub kind: LlmJobKind,
}

#[derive(Clone)]
pub enum LlmJobKind {
    AnalyzeSentence {
        index: usize,
        prev_sentences: Vec<String>,
        sentence: String,
        after_sentences: Vec<String>,
    },
    AskAi {
        index: usize,
        sentence: String,
        question: String,
    },
}

#[derive(Serialize, Clone)]
pub struct JobError {
    pub index: usize,
    pub message: String,
    pub raw_response: Option<String>,
    pub model: String,
}

#[derive(Serialize, Clone)]
pub struct JobProgress {
    pub index: usize,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct QueueProgress {
    pub running: usize,
    pub total: usize,
}
