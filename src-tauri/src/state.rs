use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Clone)]
pub struct AnalysisSession {
    pub sentences: Vec<String>,
}

pub struct AppState {
    pub sessions: Mutex<HashMap<String, AnalysisSession>>,
}
