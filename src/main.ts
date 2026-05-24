console.log('main.ts loaded');

import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';

type ModelInfo = {
  id: string;
  display_name: string;
  provider: string;
};

const inputEl = document.querySelector<HTMLTextAreaElement>('#inputText')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model-select')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clearBtn')!;
const pasteBtn = document.querySelector<HTMLButtonElement>('#pasteBtn')!;
const splitBtn = document.querySelector<HTMLButtonElement>('#splitBtn')!;
const analyzeBtn = document.querySelector<HTMLButtonElement>('#analyzeBtn')!;
const sentenceListEl =
  document.querySelector<HTMLTextAreaElement>('#sentenceList')!;

let currentSentences: string[] = [];

async function setCurrentModel(modelId: string) {
  try {
    await invoke('set_current_model', { modelId });
    console.log('Model set successfully:', modelId);
  } catch (error) {
    console.error('Error setting model:', error);
  }
}

async function init() {
  const store = await Store.load('settings.json');

  const models: ModelInfo[] = await invoke<ModelInfo[]>('get_available_models');
  console.log('Available models:', models);

  // Populate model select options
  for (let i = 0; i < models.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = models[i].display_name;
    modelSelect.appendChild(option);
  }
  const savedModel = await store.get<string>('current_model');
  if (savedModel) {
    const idx = models.findIndex((x) => x.id === savedModel);

    if (idx >= 0) {
      modelSelect.selectedIndex = idx;

      await invoke('set_current_model', {
        modelId: savedModel,
      });
    }
  } else {
    setCurrentModel(models[0].id); // Set initial model
  }

  modelSelect.addEventListener('change', async () => {
    const selectedModel = models[modelSelect.selectedIndex];
    setCurrentModel(selectedModel.id);
    await store.set('current_model', selectedModel.id);

    await store.save();
  });

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
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
}

init();
