use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub repetition_penalty: Option<f32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}
#[derive(Deserialize, Default)]
pub struct ChatResponse {
    #[serde(default)]
    pub model: String,

    pub choices: Vec<Choice>,

    #[serde(default)]
    pub usage: Usage,
}
#[derive(Debug)]
pub struct ChatResult {
    pub content: String,
    pub model: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct Choice {
    pub message: AssistantMessage,
}
#[derive(Deserialize)]
pub struct AssistantMessage {
    pub content: String,
}
#[derive(Deserialize, Default)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}
