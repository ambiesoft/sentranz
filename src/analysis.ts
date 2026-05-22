console.log('analysis.ts loaded');
import './analysis.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

type SentenceResult = {
  original: string;
  translation: string;
  summary_ja: string;
  summary_en: string;
  grammar_explanation: string;
};

const sentencePane = document.querySelector('#sentence-pane')!;
const wordInfo = document.querySelector('#word-info')!;

const prevBtn = document.querySelector('#prev-btn') as HTMLButtonElement;
const nextBtn = document.querySelector('#next-btn') as HTMLButtonElement;

const sentenceSelect = document.querySelector(
  '#sentence-select',
) as HTMLSelectElement;
const askInput = document.querySelector('#ask-input') as HTMLTextAreaElement;
const askBtn = document.querySelector('#ask-btn') as HTMLButtonElement;
const askAnswer = document.querySelector('#ask-answer') as HTMLDivElement;

const appWindow = getCurrentWindow();

const label = appWindow.label;

let currentIndex = 0;
let sentences: string[] = [];
let userQuestions: string[] = [];

const sentenceResults: (SentenceResult | null)[] = [];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCurrentData() {
  if (sentences.length === 0) {
    return;
  }

  const sentence = sentences[currentIndex];

  sentencePane.textContent = sentence;
  sentenceSelect.value = String(currentIndex);
  const result = sentenceResults[currentIndex];
  if (result) {
    wordInfo.innerHTML = `
      <div>
        <b>Translation</b>
      </div>

      <div>
        ${escapeHtml(result.translation)}
      </div>

      <br />

      <div>
        <b>Summary (Japanese)</b>
      </div>

      <div>
        ${escapeHtml(result.summary_ja)}
      </div>

      <br />

      <div>
        <b>Summary (English)</b>
      </div>

      <div>
        ${escapeHtml(result.summary_en)}
      </div>

      <br />
      
      <div>
        <b>Grammar Explanation</b>
      </div>

      <div>
        ${escapeHtml(result.grammar_explanation)}
      </div> 
    `;
  } else {
    wordInfo.innerHTML = 'Analyzing...';
  }

  // Load user's question for this sentence, if any
  askInput.value = userQuestions[currentIndex] || '';
}

async function init() {
  console.log('Invoking get_session_sentences with label:', label);
  sentences = await invoke<string[]>('get_session_sentences', { label });

  for (let i = 0; i < sentences.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Sentence ${i + 1}`;
    sentenceSelect.appendChild(option);
    sentenceResults.push(null);
  }

  renderCurrentData();

  await listen('sentence_ready', (event) => {
    console.log('Received sentence_ready event with payload:', event.payload);
    const result = event.payload as SentenceResult;
    const index = sentenceResults.findIndex((x) => x === null);

    if (index >= 0) {
      sentenceResults[index] = result;
    }

    renderCurrentData();
  });

  try {
    console.log('Invoking analyze_text with label:', label);
    await invoke('analyze_text', { label });
  } catch (e) {
    console.error('Error invoking analyze_text:', e);
    alert('Analysis failed:\n\n' + String(e));
  }
}

function saveCurrentQuestion() {
  if (sentences.length === 0) {
    return;
  }
  const currentQuestion = askInput.value.trim();
  userQuestions[currentIndex] = currentQuestion;
}
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    saveCurrentQuestion();
    currentIndex--;

    renderCurrentData();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < sentences.length - 1) {
    saveCurrentQuestion();

    currentIndex++;
    renderCurrentData();
  }
});

sentenceSelect.addEventListener('change', () => {
  saveCurrentQuestion();
  currentIndex = Number(sentenceSelect.value);
  renderCurrentData();
});

// Ask Handler: Sends the current sentence and the user's question to the Rust backend and displays the answer
askBtn.addEventListener('click', async () => {
  const question = askInput.value.trim();
  if (!question) {
    return;
  }

  const sentence = sentences[currentIndex];
  askAnswer.textContent = 'Thinking...';
  askBtn.disabled = true;

  try {
    const response = await invoke<string>('ask_ai', {
      sentence,
      question,
    });

    askAnswer.textContent = response;
  } catch (e) {
    askAnswer.textContent = String(e);
  } finally {
    askBtn.disabled = false;
  }
});

init();
