console.log('main.ts loaded');

import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const inputEl = document.querySelector<HTMLTextAreaElement>('#inputText')!;
const splitBtn = document.querySelector<HTMLButtonElement>('#splitBtn')!;
const analyzeBtn = document.querySelector<HTMLButtonElement>('#analyzeBtn')!;
const sentenceListEl =
  document.querySelector<HTMLTextAreaElement>('#sentenceList')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;

let currentSentences: string[] = [];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

splitBtn.addEventListener('click', () => {
  const text = inputEl.value;
  currentSentences = splitSentences(text);
  sentenceListEl.value = currentSentences.join('\n\n');
});

analyzeBtn.addEventListener('click', async () => {
  const text = inputEl.value;

  const sentences = splitSentences(text);

  await invoke('open_analysis_window', { sentences });
});

listen('analysis_finished', () => {
  const div = document.createElement('div');

  div.className = 'analysis-finished';

  div.textContent = 'Analysis finished.';

  resultsEl.appendChild(div);
});

// function appendProgress(result: SentenceResult) {
//   const div = document.createElement('div');

//   div.className = 'progress-item';

//   div.textContent = `✓ ${result.original}`;

//   resultsEl.appendChild(div);
// }

// function escapeHtml(s: string): string {
//   return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// }
