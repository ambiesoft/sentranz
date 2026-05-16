use reqwest::Client;

use crate::llm::types::*;

pub struct OpenAiProvider {
    pub endpoint: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl OpenAiProvider {
    pub async fn chat(&self, messages: Vec<Message>) -> Result<String, String> {
        let client = Client::new();

        let req = ChatRequest {
            model: self.model.clone(),
            messages,
            temperature: 0.0,
        };

        let mut builder = client.post(&self.endpoint).json(&req);

        if let Some(key) = &self.api_key {
            builder = builder.bearer_auth(key);
        }

        let res = builder
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json: ChatResponse = res
            .json()
            .await
            .map_err(|e| e.to_string())?;

        Ok(json.choices[0].message.content.clone())
    }
}