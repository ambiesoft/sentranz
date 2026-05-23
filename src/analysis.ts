console.log('analysis.ts loaded');
import './analysis.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

type SentenceResult = {
  index: number;
  original: string;
  translation: string;
  summary_ja: string;
  summary_en: string;
  grammar_explanation: string;
};
type AskAiResponse = {
  index: number;
  response: string;
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
type State = {
  sentence: string;
  sentenceResult: SentenceResult | null;
  userQuestion: string;
  askAnswer: string;
};
let states: State[] = [];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCurrentData() {
  if (states.length === 0) {
    return;
  }

  sentenceSelect.value = String(currentIndex);
  sentencePane.textContent = states[currentIndex].sentence;

  const result = states[currentIndex].sentenceResult;
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

  askAnswer.textContent = states[currentIndex].askAnswer || '';

  // Load user's question for this sentence, if any
  askInput.value = states[currentIndex].userQuestion || '';
}

async function init() {
  console.log('Invoking get_session_sentences with label:', label);
  let sentences = await invoke<string[]>('get_session_sentences', { label });

  for (let i = 0; i < sentences.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Sentence ${i + 1}`;
    sentenceSelect.appendChild(option);
    states.push({
      sentence: sentences[i],
      sentenceResult: null,
      userQuestion: '',
      askAnswer: '',
    });
  }

  renderCurrentData();

  await listen('sentence_ready', (event) => {
    console.log('Received sentence_ready event with payload:', event.payload);
    const result = event.payload as SentenceResult;
    const index = result.index;

    if (index >= 0) {
      states[index].sentenceResult = result;
    }
    if (index === currentIndex) {
      saveCurrentQA();
      renderCurrentData();
    }
  });

  await listen('ask_ai_response', (event) => {
    console.log('Received ask_ai_response event with payload:', event.payload);
    const response = event.payload as AskAiResponse;
    const index = response.index;
    states[index].askAnswer = response.response;
    if (index === currentIndex) {
      renderCurrentData();
    }
    askBtn.disabled = false;
  });

  try {
    console.log('Invoking analyze_text with label:', label);
    await invoke('analyze_text', { label });
  } catch (e) {
    console.error('Error invoking analyze_text:', e);
    alert('Analysis failed:\n\n' + String(e));
  }
} // End of init function

function saveCurrentQA() {
  if (states.length === 0) {
    return;
  }
  const currentanswer = askAnswer.textContent?.trim() || '';
  states[currentIndex].askAnswer = currentanswer;

  const currentQuestion = askInput.value.trim();
  states[currentIndex].userQuestion = currentQuestion;
}
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    saveCurrentQA();
    currentIndex--;

    renderCurrentData();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < states.length - 1) {
    saveCurrentQA();

    currentIndex++;
    renderCurrentData();
  }
});

sentenceSelect.addEventListener('change', () => {
  saveCurrentQA();
  currentIndex = Number(sentenceSelect.value);
  renderCurrentData();
});

// Ask Handler: Sends the current sentence and the user's question to the Rust backend and displays the answer
askBtn.addEventListener('click', async () => {
  const question = askInput.value.trim();
  if (!question) {
    return;
  }

  const sentence = states[currentIndex].sentence;
  askAnswer.textContent = 'Thinking...';
  askBtn.disabled = true;

  try {
    await invoke<AskAiResponse>('ask_ai', {
      label,
      index: currentIndex,
      sentence,
      question,
    });
  } catch (e) {
    alert('Failed to get answer:\n\n' + String(e));
  }
}); // End of askBtn click handler;

init();
