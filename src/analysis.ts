console.log('analysis.ts loaded');
import './analysis.css';

import { invoke } from '@tauri-apps/api/core';

import { getCurrentWindow } from '@tauri-apps/api/window';

import { listen } from '@tauri-apps/api/event';

type SentenceResult = {
  original: string;

  translation: string;

  summary: string;
};

const sentencePane = document.querySelector('#sentence-pane')!;

const wordInfo = document.querySelector('#word-info')!;

const prevBtn = document.querySelector('#prev-btn') as HTMLButtonElement;

const nextBtn = document.querySelector('#next-btn') as HTMLButtonElement;

const select = document.querySelector('#sentence-select') as HTMLSelectElement;
const askInput = document.querySelector('#ask-input') as HTMLTextAreaElement;
const askBtn = document.querySelector('#ask-btn') as HTMLButtonElement;
const askAnswer = document.querySelector('#ask-answer') as HTMLDivElement;
const appWindow = getCurrentWindow();

const label = appWindow.label;

let currentIndex = 0;

let sentences: string[] = [];

const sentenceResults: (SentenceResult | null)[] = [];

function escapeHtml(s: string): string {
  return s

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;');
}

function renderCurrentSentence() {
  if (sentences.length === 0) {
    return;
  }

  const sentence = sentences[currentIndex];

  sentencePane.textContent = sentence;

  select.value = String(currentIndex);

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
        <b>Summary</b>
      </div>

      <div>
        ${escapeHtml(result.summary)}
      </div>
    `;
  } else {
    wordInfo.innerHTML = 'Analyzing...';
  }
}

async function init() {
  console.log('Invoking get_session_sentences with label:', label);
  sentences = await invoke<string[]>('get_session_sentences', { label });

  for (let i = 0; i < sentences.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Sentence ${i + 1}`;
    select.appendChild(option);
    sentenceResults.push(null);
  }

  renderCurrentSentence();

  await listen(
    'sentence_ready',

    (event) => {
      const result = event.payload as SentenceResult;

      const index = sentenceResults.findIndex((x) => x === null);

      if (index >= 0) {
        sentenceResults[index] = result;
      }

      renderCurrentSentence();
    },
  );

  console.log('Invoking analyze_text with label:', label);
  invoke('analyze_text', { label });
}

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;

    renderCurrentSentence();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < sentences.length - 1) {
    currentIndex++;

    renderCurrentSentence();
  }
});

select.addEventListener('change', () => {
  currentIndex = Number(select.value);

  renderCurrentSentence();
});

askBtn.addEventListener(
  'click',

  async () => {
    const question = askInput.value.trim();

    if (!question) {
      return;
    }

    const sentence = sentences[currentIndex];

    askAnswer.textContent = 'Thinking...';

    askBtn.disabled = true;

    try {
      const response = await invoke<string>(
        'ask_ai',

        {
          sentence,
          question,
        },
      );

      askAnswer.textContent = response;
    } catch (e) {
      askAnswer.textContent = String(e);
    } finally {
      askBtn.disabled = false;
    }
  },
);

init();
