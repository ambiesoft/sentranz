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

splitBtn.addEventListener('click', async () => {
  const text = inputEl.value;
  currentSentences = await invoke<string[]>('split_text', { text });
  sentenceListEl.value = currentSentences.join('\n\n');
});

analyzeBtn.addEventListener('click', async () => {
  const text = sentenceListEl.value;
  const sentences = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  await invoke('open_analysis_window', { sentences });
});

listen('analysis_finished', () => {
  const div = document.createElement('div');

  div.className = 'analysis-finished';

  div.textContent = 'Analysis finished.';

  resultsEl.appendChild(div);
});
