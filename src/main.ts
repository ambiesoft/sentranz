console.log('main.ts loaded');

import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { loadSessions, saveSession } from './analysisStore';

type ModelInfo = {
  id: string;
  display_name: string;
  provider: string;
};

const inputEl = document.querySelector<HTMLTextAreaElement>('#input-text')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model-select')!;
const clearBtn = document.querySelector<HTMLButtonElement>('#clear-btn')!;
const pasteHtmlBtn =
  document.querySelector<HTMLButtonElement>('#paste-html-btn')!;
const pasteTextBtn =
  document.querySelector<HTMLButtonElement>('#paste-text-btn')!;
const splitBtn = document.querySelector<HTMLButtonElement>('#split-btn')!;
const analyzeBtn = document.querySelector<HTMLButtonElement>('#analyze-btn')!;
const sentenceListEl =
  document.querySelector<HTMLTextAreaElement>('#sentence-list')!;

const appWindow = getCurrentWindow();

let currentSentences: string[] = [];

let storeMain: Store;
let saveTimer: number;

async function saveState() {
  await storeMain.set('inputText', inputEl.value);
  await storeMain.set('sentenceList', sentenceListEl.value);

  await storeMain.save();
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 1000);
}

async function setCurrentModel(modelId: string) {
  try {
    await invoke('set_current_model', { modelId });
    console.log('Model set successfully:', modelId);
  } catch (error) {
    console.error('Error setting model:', error);
  }
}

async function init() {
  const storeSettings = await Store.load('settings.json');
  storeMain = await Store.load('main.json');

  const models: ModelInfo[] = await invoke<ModelInfo[]>('get_available_models');
  console.log('Available models:', models);

  // Populate model select options
  for (let i = 0; i < models.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = models[i].display_name;
    modelSelect.appendChild(option);
  }
  const savedModel = await storeSettings.get<string>('current_model');
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

  // load analyses
  const sessions = await loadSessions();
  const openSessions = sessions.filter((s) => s.isOpen).reverse();
  for (let session of openSessions) {
    let width = session.width ?? 1200.0;
    let height = session.height ?? 800.0;
    console.log('eee', width, height);
    await invoke('open_analysis_window', {
      sessionId: session.id,
      width,
      height,
    });
  }

  modelSelect.addEventListener('change', async () => {
    const selectedModel = models[modelSelect.selectedIndex];
    setCurrentModel(selectedModel.id);
    await storeSettings.set('current_model', selectedModel.id);

    await storeSettings.save();
  });

  // load
  const savedInput = await storeMain.get<string>('inputText');
  if (savedInput) {
    inputEl.value = savedInput;
  }

  const savedSentences = await storeMain.get<string>('sentenceList');
  if (savedSentences) {
    sentenceListEl.value = savedSentences;
  }

  // scheduled save
  inputEl.addEventListener('input', scheduleSave);
  sentenceListEl.addEventListener('input', scheduleSave);

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
  });

  // Paste Handler: Reads text from the clipboard and sets it to the input textarea
  pasteHtmlBtn.addEventListener(
    'click',

    async () => {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        console.log(item.types);

        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          inputEl.value = html;
          return;
        }
      }
      alert('No HTML content found in clipboard.');
    },
  );

  pasteTextBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        alert('No text content found in clipboard.');
        return;
      }
      inputEl.value = text;
    } catch (error) {
      console.error('Failed to read clipboard contents: ', error);
    }
  });

  // Split Handler: Sends the input text to the Rust backend for splitting and updates the sentence list textarea
  splitBtn.addEventListener('click', async () => {
    let text = inputEl.value.trim();
    if (!text) {
      alert('Please enter some text to split.');
      return;
    }
    let doneHtmlParsing = false;
    do {
      try {
        if (!text) {
          alert('Please enter some text to split.');
          return;
        }
        // check if first letter is "<" and last letter is ">"
        if (!text.trim().startsWith('<') || !text.trim().endsWith('>')) {
          console.log('Text does not appear to be HTML, skipping HTML parsing');
          break;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        // sanitize the text by extracting text content from common block-level elements
        doc.querySelectorAll('script, style').forEach((x) => x.remove());

        const BLOCK_SELECTOR = 'p, div, li, h1, h2';
        const paragraphs = doc.querySelectorAll(BLOCK_SELECTOR);
        const blocks: string[] = [];

        for (const el of paragraphs) {
          //
          // child block exists?
          //
          const childBlocks = el.querySelector(BLOCK_SELECTOR);

          //
          // skip container blocks
          //
          if (childBlocks) {
            continue;
          }

          const text = el.textContent?.trim();

          if (text) {
            blocks.push(text);
          }
        }

        if (blocks.length !== 0) {
          sentenceListEl.value = blocks.join('\n\n');
          doneHtmlParsing = true;
        }
      } catch (e) {
        console.error('Error parsing HTML:', e);
      }
    } while (false);

    if (!doneHtmlParsing) {
      const text = inputEl.value.trim();
      try {
        let t = await invoke<string[]>('split_text', { text });
        sentenceListEl.value = t.join('\n\n');
      } catch (e) {
        console.error('Error invoking split_text:', e);
        alert('Failed to split text:\n\n' + String(e));
      }
    }
  });

  // Analyze Handler: Sends the sentences to the Rust backend for analysis
  analyzeBtn.addEventListener('click', async () => {
    const text = sentenceListEl.value;
    currentSentences = text
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const sessionId = 'analysis-' + crypto.randomUUID();
    const session = {
      id: sessionId,

      currentIndex: 0,

      states: currentSentences.map((s) => ({
        sentence: s,
        sentenceResult: null,
        userQuestion: '',
        askAnswer: '',
      })),
      isOpen: true,
    };

    saveSession(session);

    await invoke('open_analysis_window', {
      sessionId,
      width: 800,
      height: 600,
    });
  });

  appWindow.onCloseRequested(async () => {
    await saveState();
  });

  appWindow.listen('queue_progress', async (event) => {
    const { total } = event.payload as {
      total: number;
    };

    const title =
      total === 0 ? 'Sentranz' : `${total} jobs remaining | Sentranz`;
    await getCurrentWindow().setTitle(title);
  });
}
init();
