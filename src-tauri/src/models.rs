use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SentenceResult {
    pub index: usize,
    pub original: String,
    pub translation: String,
    pub summary_ja: String,
    pub summary_en: String,
    pub grammar_explanation: String,
    pub analysis_error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmSentenceResponse {
    pub translation: String,
    pub summary_ja: String,
    pub summary_en: String,
    pub grammar_explanation: String,
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
        sentence: String,
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
}

#[derive(Serialize, Clone)]
pub struct JobProgress {
    pub index: usize,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct QueueProgress {
    pub total: usize,
}
