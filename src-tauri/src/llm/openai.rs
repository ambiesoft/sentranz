use reqwest::Client;

use crate::llm::types::*;

pub struct OpenAiProvider {
    pub endpoint: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl OpenAiProvider {
    pub async fn chat(&self, messages: Vec<Message>) -> Result<ChatResult, String> {
        let client = Client::new();

        let (temperature, repetition_penalty, max_tokens) = if self.model.contains("qwen3-vl-4b") {
            (0.7, Some(1.15), Some(2500))
        } else {
            (0.0, None, Some(2500))
        };

        let req = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature,
            repetition_penalty,
            max_tokens,
        };

        let mut builder = client.post(&self.endpoint).json(&req);

        if let Some(key) = &self.api_key {
            builder = builder.bearer_auth(key);
        }

        let res = builder.send().await.map_err(|e| e.to_string())?;

        #[cfg(debug_assertions)]
        eprintln!("OpenAI response: {:?}", res);

        let body = res.text().await.map_err(|e| e.to_string())?;

        let json: ChatResponse = serde_json::from_str(&body)
            .map_err(|e| format!("JSON parse error: {}\n\nBODY:\n{}", e, body))?;

        Ok(ChatResult {
            content: json.choices[0].message.content.clone(),
            model: json.model,
            prompt_tokens: json.usage.prompt_tokens,
            completion_tokens: json.usage.completion_tokens,
            total_tokens: json.usage.total_tokens,
        })
    }
}
