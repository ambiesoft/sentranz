console.log('analysis.ts loaded');
import './analysis.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SentenceResult, AnalysisSession } from './type';
import { loadSession, saveSession } from './analysisStore';

type AskAiResponse = {
  index: number;
  response: string;
};
type JobProgress = {
  index: number;
  message: string;
};
type JobError = {
  index: number;
  message: string;
  raw_response?: string;
};

const sentencePane = document.querySelector('#sentence-pane')!;
const wordInfo = document.querySelector('#word-info')!;

const prevBtn = document.querySelector('#prev-btn') as HTMLButtonElement;
const nextBtn = document.querySelector('#next-btn') as HTMLButtonElement;
const retryBtn = document.querySelector('#retry-btn') as HTMLButtonElement;
const retryAllErrorsBtn = document.querySelector(
  '#retry-all-error-btn',
) as HTMLButtonElement;

const sentenceSelect = document.querySelector(
  '#sentence-select',
) as HTMLSelectElement;
const errorBanner = document.getElementById('error-banner') as HTMLDivElement;
const errorMessage = document.getElementById(
  'error-message',
) as HTMLSpanElement;
const errorCloseBtn = document.getElementById(
  'error-close-btn',
) as HTMLButtonElement;
const askInput = document.querySelector('#ask-input') as HTMLTextAreaElement;
const askBtn = document.querySelector('#ask-btn') as HTMLButtonElement;
const askAnswer = document.querySelector('#ask-answer') as HTMLDivElement;

const appWindow = getCurrentWindow();
const label = appWindow.label;
console.log('Current window label:', label);

let saveTimer: number;

// let currentIndex = 0;
// let states: State[] = [];

let session: AnalysisSession;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    await saveSession(session);
  }, 500);
}
askInput.addEventListener('change', scheduleSave);
wordInfo.addEventListener('change', scheduleSave);
askAnswer.addEventListener('change', scheduleSave);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showError(message: string) {
  errorMessage.textContent = message;
  errorBanner.classList.remove('hidden');
}
function hideError() {
  errorBanner.classList.add('hidden');
}

function renderCurrentData(index: number) {
  if (session.states.length === 0) {
    return;
  }

  if (index !== session.currentIndex) {
    saveCurrentQA();
    return;
  }
  sentenceSelect.value = String(session.currentIndex);
  sentencePane.textContent = session.states[session.currentIndex].sentence;

  const result = session.states[session.currentIndex].sentenceResult;
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
    if (result.analysis_error) {
      showError(result.analysis_error);
    } else {
      hideError();
    }
  } else if (session.states[session.currentIndex].progressMessage) {
    wordInfo.innerHTML =
      session.states[session.currentIndex].progressMessage || '';
  } else {
    wordInfo.innerHTML = 'Waiting...';
  }

  askAnswer.textContent = session.states[session.currentIndex].askAnswer || '';

  // Load user's question for this sentence, if any
  askInput.value = session.states[session.currentIndex].userQuestion || '';
}

async function init() {
  console.log('Analysis init with label:', label);
  const loadedSession = await loadSession(label);
  if (!loadedSession) {
    throw new Error('Failed to load analysis session');
  }
  session = loadedSession;
  console.log('session loaded:', session);

  // create option combobox
  for (let i = 0; i < session.states.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Sentence ${i + 1}`;
    sentenceSelect.appendChild(option);
    // states.push({
    //   sentence: session.states[i].sentence,
    //   sentenceResult: null,
    //   userQuestion: '',
    //   askAnswer: '',
    // });
  }

  renderCurrentData(session.currentIndex);

  await appWindow.listen('sentence_ready', (event) => {
    console.log('Received sentence_ready event with payload:', event.payload);
    const result = event.payload as SentenceResult;
    const index = result.index;

    if (index >= 0) {
      session.states[index].sentenceResult = result;
    }
    renderCurrentData(index);
    scheduleSave();
  });

  await appWindow.listen('analysis_progress', (event) => {
    console.log(
      'Received analysis_progress event with payload:',
      event.payload,
    );
    const progress = event.payload as JobProgress;
    session.states[progress.index].progressMessage = progress.message;

    renderCurrentData(progress.index);
  });

  await appWindow.listen('analysis_error', (event) => {
    console.log('Received analysis_error event with payload:', event.payload);
    const error = event.payload as JobError;
    console.log(
      'Received analysis_error event with payload:',
      event.payload,
      'currentIndex:',
      session.currentIndex,
      'error.index:',
      error.index,
    );
    if (error.raw_response) {
      console.error('Raw response from backend:', error.raw_response);
    }
    const sentenceResult = session.states[error.index].sentenceResult;
    if (sentenceResult) {
      sentenceResult.index = error.index;
      sentenceResult.analysis_error = `Error: ${error.message}\n\n${error.raw_response || ''}`;
    } else {
      session.states[error.index].sentenceResult = {
        index: error.index,
        original: session.states[error.index].sentence,
        translation: '',
        summary_ja: '',
        summary_en: '',
        grammar_explanation: '',
        analysis_error: `Error: ${error.message}\n\n${error.raw_response || ''}`,
      };
    }
    renderCurrentData(error.index);
  });

  await appWindow.listen('ask_ai_response', (event) => {
    console.log('Received ask_ai_response event with payload:', event.payload);
    const response = event.payload as AskAiResponse;
    const index = response.index;
    session.states[index].askAnswer = response.response;
    renderCurrentData(index);

    askBtn.disabled = false;
    scheduleSave();
  });

  await appWindow.listen('ask_ai_progress', (event) => {
    console.log('Received ask_ai_progress event with payload:', event.payload);
    const progress = event.payload as JobProgress;
    session.states[progress.index].askAnswer = progress.message;
    renderCurrentData(progress.index);
  });

  await appWindow.listen('ask_ai_error', (event) => {
    const error = event.payload as JobError;
    if (error.raw_response) {
      console.error('Raw response from backend:', error.raw_response);
    }
    console.log(
      'Received ask_ai_error event with payload:',
      event.payload,
      'currentIndex:',
      session.currentIndex,
      'error.index:',
      error.index,
    );
    session.states[error.index].askAnswer =
      `Error: ${error.message}\n\n${error.raw_response || ''}`;
    renderCurrentData(error.index);
    askBtn.disabled = false;
  });

  startAnalyze(0, -1, false);
} // End of init function

async function startAnalyze(
  startIndex: number,
  count: number,
  isOnlyError: boolean,
) {
  retryBtn.disabled = true;
  retryAllErrorsBtn.disabled = true;
  count = count < 0 ? session.states.length : startIndex + count;
  try {
    let index = startIndex;
    for (index = 0; index < count; ++index) {
      if (!isOnlyError) {
        if (session.states[index].sentenceResult) {
          continue;
        }
      } else {
        // isOnlyError
        if (!session.states[index].sentenceResult) {
          continue;
        } else {
          if (!session.states[index].sentenceResult?.analysis_error) {
            continue;
          }
        }
      }

      // clear current
      session.states[index].sentenceResult = null;
      session.states[index].progressMessage = '';
      renderCurrentData(index);

      console.log(
        'Invoking analyze_text with label:',
        label,
        'sentence:',
        session.states[index].sentence,
      );
      await invoke('analyze_text', {
        label,
        index,
        sentence: session.states[index].sentence,
      });
    }
  } catch (e) {
    console.error('Error invoking analyze_text:', e);
    alert('Analysis failed:\n\n' + String(e));
  } finally {
    retryBtn.disabled = false;
    retryAllErrorsBtn.disabled = false;
  }
}

function saveCurrentQA() {
  if (session.states.length === 0) {
    return;
  }
  const currentanswer = askAnswer.textContent?.trim() || '';
  session.states[session.currentIndex].askAnswer = currentanswer;

  const currentQuestion = askInput.value.trim();
  session.states[session.currentIndex].userQuestion = currentQuestion;
}
prevBtn.addEventListener('click', () => {
  if (session.currentIndex > 0) {
    saveCurrentQA();
    session.currentIndex--;

    renderCurrentData(session.currentIndex);
    scheduleSave();
  }
});

nextBtn.addEventListener('click', () => {
  if (session.currentIndex < session.states.length - 1) {
    saveCurrentQA();

    session.currentIndex++;
    renderCurrentData(session.currentIndex);
    scheduleSave();
  }
});

sentenceSelect.addEventListener('change', () => {
  saveCurrentQA();
  session.currentIndex = Number(sentenceSelect.value);
  renderCurrentData(session.currentIndex);
});

retryBtn.addEventListener('click', () => {
  session.states[session.currentIndex].progressMessage = '';
  session.states[session.currentIndex].sentenceResult = null;
  startAnalyze(session.currentIndex, 1, false);
});
retryAllErrorsBtn.addEventListener('click', () => {
  startAnalyze(0, -1, true);
});

// Ask Handler: Sends the current sentence and the user's question to the Rust backend and displays the answer
askBtn.addEventListener('click', async () => {
  const question = askInput.value.trim();
  if (!question) {
    return;
  }

  session.states[session.currentIndex].userQuestion = '';
  askInput.value = '';

  const sentence = session.states[session.currentIndex].sentence;
  askAnswer.textContent = 'Waiting...';
  askBtn.disabled = true;

  const indexSave = session.currentIndex;

  try {
    await invoke<AskAiResponse>('ask_ai', {
      label,
      index: session.currentIndex,
      sentence,
      question,
    });
  } catch (e) {
    alert('Failed to get answer:\n\n' + String(e));
    session.states[indexSave].userQuestion = question;
    if (indexSave === session.currentIndex && !askInput.value) {
      askInput.value = question;
    }
  }
}); // End of askBtn click handler;

appWindow.onFocusChanged(async ({ payload }) => {
  if (payload) {
    await invoke('window_focused', {
      label: appWindow.label,
    });
  }

  appWindow.onCloseRequested(async () => {
    session.isOpen = false;

    await saveSession(session);
  });

  errorCloseBtn.addEventListener('click', () => {
    hideError();
  });
});
init();
