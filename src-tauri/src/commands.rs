use crate::llm::openai::OpenAiProvider;
use crate::llm::types::Message;
use crate::models::{LlmSentenceResponse, SentenceAnalysis};
use crate::text::splitter::split_sentences;

#[tauri::command]
pub async fn analyze_text(text: String) -> Result<Vec<SentenceAnalysis>, String> {
    let provider = OpenAiProvider {
        endpoint: "http://localhost:1234/v1/chat/completions".into(),
        model: "gpt-oss-20b".into(),
        api_key: None,
    };

    let sentences = split_sentences(&text);

    let mut results = Vec::new();

    for sentence in sentences {
        let prompt = format!(
            r#"
Translate the sentence into Japanese and summarize briefly.

Return ONLY valid JSON.

Example:

{{
  "translation": "...",
  "summary": "..."
}}

Sentence:
{}
"#,
            sentence
        );

        let messages = vec![Message {
            role: "user".into(),
            content: prompt,
        }];

        let response = provider.chat(messages).await?;
        let parsed: LlmSentenceResponse =
            serde_json::from_str(&response).map_err(|e| e.to_string())?;

        results.push(SentenceAnalysis {
            sentence,
            translation: parsed.translation,
            summary: parsed.summary,
        });
    }

    Ok(results)
}
