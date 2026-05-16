use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SentenceAnalysis {
    pub sentence: String,
    pub translation: String,
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmSentenceResponse {
    pub translation: String,
    pub summary: String,
}
