console.log('main.ts loaded');

import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type ModelInfo = {
  id: string;
  display_name: string;
  provider: string;
};

const inputEl = document.querySelector<HTMLTextAreaElement>('#inputText')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model-select')!;
const pasteBtn = document.querySelector<HTMLButtonElement>('#pasteBtn')!;
const splitBtn = document.querySelector<HTMLButtonElement>('#splitBtn')!;
const analyzeBtn = document.querySelector<HTMLButtonElement>('#analyzeBtn')!;
const sentenceListEl =
  document.querySelector<HTMLTextAreaElement>('#sentenceList')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;

let currentSentences: string[] = [];

async function init() {
  const models: ModelInfo[] = await invoke<ModelInfo[]>('get_available_models');
  console.log('Available models:', models);

  // Populate model select options
  for (let i = 0; i < models.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = models[i].display_name;
    modelSelect.appendChild(option);
  }

  modelSelect.addEventListener('change', async () => {
    const selectedModel = models[modelSelect.selectedIndex];
    console.log('Selected model:', selectedModel.id);
    try {
      await invoke('set_current_model', { modelId: selectedModel.id });
    } catch (error) {
      console.error('Error setting model:', error);
    }
  });

  // Paste Handler: Reads text from the clipboard and sets it to the input textarea
  pasteBtn.addEventListener('click', async () => {
    const text = await navigator.clipboard.readText();
    inputEl.value = text;
  });

  // Split Handler: Sends the input text to the Rust backend for splitting and updates the sentence list textarea
  splitBtn.addEventListener('click', async () => {
    const text = inputEl.value;
    currentSentences = await invoke<string[]>('split_text', { text });
    sentenceListEl.value = currentSentences.join('\n\n');
  });

  // Analyze Handler: Sends the sentences to the Rust backend for analysis
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
}

init();
