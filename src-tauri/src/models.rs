use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SentenceResult {
    pub original: String,
    pub translation: String,
    pub summary_ja: String,
    pub summary_en: String,
    pub grammar_explanation: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmSentenceResponse {
    pub translation: String,
    pub summary_ja: String,
    pub summary_en: String,
    pub grammar_explanation: String,    
}
