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

        let res = builder.send().await.map_err(|e| e.to_string())?;

        #[cfg(debug_assertions)]
        println!("OpenAI response: {:?}", res);

        let body = res.text().await.map_err(|e| e.to_string())?;

        let json: ChatResponse = serde_json::from_str(&body)
            .map_err(|e| format!("JSON parse error: {}\n\nBODY:\n{}", e, body))?;

        Ok(json.choices[0].message.content.clone())
    }
}
