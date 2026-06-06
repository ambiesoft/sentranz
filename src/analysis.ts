console.log('analysis.ts loaded');
import './analysis.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SentenceResult, AnalysisSession, State } from './type';
import { loadSession, saveSession } from './analysisStore';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';
import Mark from 'mark.js';

// marked.setOptions({
//   breaks: true,
// });
marked.use(markedKatex());

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

const sentencePaneEl = document.querySelector(
  '#sentence-pane',
) as HTMLDivElement;
const wordInfoEl = document.querySelector('#word-info') as HTMLDivElement;
const prevBtnEl = document.querySelector('#prev-btn') as HTMLButtonElement;
const nextBtnEl = document.querySelector('#next-btn') as HTMLButtonElement;
const retryThisBtnEl = document.querySelector(
  '#retry-this-btn',
) as HTMLButtonElement;
const retryFromHereBtnEl = document.querySelector(
  '#retry-from-here-btn',
) as HTMLButtonElement;

const sentenceSelectEl = document.querySelector(
  '#sentence-select',
) as HTMLSelectElement;
const errorBannerEl = document.getElementById('error-banner') as HTMLDivElement;
const errorMessageEl = document.getElementById(
  'error-message',
) as HTMLSpanElement;
const errorCloseBtnEl = document.getElementById(
  'error-close-btn',
) as HTMLButtonElement;
const askInputEl = document.querySelector('#ask-input') as HTMLTextAreaElement;
const askBtnEl = document.querySelector('#ask-btn') as HTMLButtonElement;
const askAnswerEl = document.querySelector('#ask-answer') as HTMLDivElement;

const toggleAnalysisEl = document.getElementById('toggle-analysis')!;
const toggleAskEl = document.getElementById('toggle-ask')!;

let analysisExpanded = true;
let askExpanded = false;

const appWindow = getCurrentWindow();
const label = appWindow.label;
let saveTimer: number;

let session: AnalysisSession;

let selectedWord = '';
const markInstanceSentence = new Mark(sentencePaneEl);
markInstanceSentence.unmark({
  done: () => {
    markInstanceSentence.mark(selectedWord);
  },
});
const markInstanceWordInfo = new Mark(wordInfoEl);
markInstanceWordInfo.unmark({
  done: () => {
    markInstanceWordInfo.mark(selectedWord);
  },
});
const markInstanceAskAnswer = new Mark(askAnswerEl);
markInstanceAskAnswer.unmark({
  done: () => {
    markInstanceAskAnswer.mark(selectedWord);
  },
});

function updatePanels() {
  wordInfoEl.classList.toggle('hidden', !analysisExpanded);
  askAnswerEl.classList.toggle('hidden', !askExpanded);

  document.body.classList.remove('both-open', 'analysis-open', 'ask-open');

  if (analysisExpanded && askExpanded) {
    document.body.classList.add('both-open');
  } else if (analysisExpanded) {
    document.body.classList.add('analysis-open');
  } else if (askExpanded) {
    document.body.classList.add('ask-open');
  }

  toggleAnalysisEl.textContent = `${analysisExpanded ? '▼' : '▶'} Analysis`;

  toggleAskEl.textContent = `${askExpanded ? '▼' : '▶'} Ask AI`;
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    await saveSession(session);
  }, 500);
}
function renderAnswer(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}
function showError(message: string) {
  errorMessageEl.textContent = message;
  errorBannerEl.classList.remove('hidden');
}
function hideError() {
  errorBannerEl.classList.add('hidden');
}

function getStartAnalysisParam(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('start_analysis') === 'true';
}

function renderCurrentData(index: number) {
  if (session.states.length === 0) {
    return;
  }

  if (index !== session.currentIndex) {
    saveCurrentQA();
    return;
  }
  sentenceSelectEl.value = String(session.currentIndex);
  sentencePaneEl.textContent = session.states[session.currentIndex].sentence;

  const result = session.states[session.currentIndex].sentenceResult;
  if (result) {
    const savedWordInfoScrollTop =
      session.states[session.currentIndex].wordInfoScrollTop ?? 0;
    wordInfoEl.innerHTML = renderAnswer(result.answer);
    requestAnimationFrame(() => {
      wordInfoEl.scrollTop = savedWordInfoScrollTop;
    });

    if (result.analysis_error) {
      showError(result.analysis_error);
    } else {
      hideError();
    }
  } else if (session.states[session.currentIndex].progressMessage) {
    wordInfoEl.innerHTML =
      session.states[session.currentIndex].progressMessage || '';
  } else {
    wordInfoEl.innerHTML = 'Waiting...';
  }

  const savedAskAnswerScrollTop =
    session.states[session.currentIndex].askAnswerScrollTop ?? 0;
  askAnswerEl.innerHTML = renderAnswer(
    session.states[session.currentIndex].askAnswer || '',
  );
  requestAnimationFrame(() => {
    askAnswerEl.scrollTop = savedAskAnswerScrollTop;
  });

  // Load user's question for this sentence, if any
  askInputEl.value = session.states[session.currentIndex].userQuestion || '';
}

async function init() {
  console.log('init() starts, Analysis init with label:', label);

  await registerDOMEvents();
  await registerWindowEvents();
  await registerListers();

  const loadedSession = await loadSession(label);
  if (!loadedSession) {
    throw new Error('Failed to load analysis session');
  }
  session = loadedSession;
  console.log('session loaded:', session);

  session.states.forEach((s)=>s.progressMessage='');

  // create option combobox
  for (let i = 0; i < session.states.length; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Sentence ${i + 1}`;
    sentenceSelectEl.appendChild(option);
  }

  updatePanels();
  renderCurrentData(session.currentIndex);

  const startAnalysis = getStartAnalysisParam();
  console.log('start_analysis', startAnalysis, 'from', window.location.href);
  if (startAnalysis) {
    startAnalyze(session.currentIndex, -1);
  }
} // End of init function

async function registerListers() {
  console.log('registerListers');

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
        answer: '',
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

    askBtnEl.disabled = false;
    askExpanded = true;
    updatePanels();
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
    askBtnEl.disabled = false;
  });
}

async function startAnalyze(startIndex: number, count: number) {
  retryThisBtnEl.disabled = true;
  retryFromHereBtnEl.disabled = true;
  try {
    let index = startIndex;
    count = count < 0 ? session.states.length : startIndex + count;

    function shouldAnalyze(state: State): boolean {
      if (!state.sentenceResult) {
        return true;
      }
      // SentenceResult exists
      if (state.sentenceResult.analysis_error) {
        return true; // Re-analyze if there was an error
      }
      // SentenceResult exists and no error
      if (!state.sentenceResult.answer) {
        return true; // Re-analyze if answer is empty
      }
      return false; // No need to re-analyze
    }

    for (; index < count; ++index) {
      if (!shouldAnalyze(session.states[index])) {
        continue;
      }

      if (index === 0) {
        // Set title
        function truncate(str: string, maxLength: number): string {
          if (str.length <= maxLength) {
            return str;
          }
          return str.slice(0, maxLength) + '...';
        }
        console.log(
          'Setting document title to:',
          session.states[index].sentence,
        );
        session.title = `${truncate(session.states[index].sentence, 100)} | Analysis`;
        await invoke('set_document_title', {
          label,
          title: session.title,
        });
      }
      // clear current
      session.states[index].sentenceResult = null;
      session.states[index].progressMessage = '';
      renderCurrentData(index);

      function getPreviousSentences(index: number, count: number): string[] {
        const sentences: string[] = [];
        for (let i = index - count; i < index; i++) {
          if (i >= 0) {
            sentences.push(session.states[i].sentence);
          } else {
            return sentences;
          }
        }
        return sentences;
      }
      function getAfterSentences(index: number, count: number): string[] {
        const sentences: string[] = [];
        for (let i = index + 1; i <= index + count; i++) {
          if (i < session.states.length) {
            sentences.push(session.states[i].sentence);
          } else {
            return sentences;
          }
        }        
        return sentences;
      }
      const contextPreviousSentenceCount = 10;
      const contextAfterSentenceCount = 5;
      console.log(
        'Invoking analyze_text with label:',
        label,
        'prevSentences:',
        getPreviousSentences(index, contextPreviousSentenceCount),
        'sentence:',
        session.states[index].sentence,
        'afterSentences:',
        getAfterSentences(index, contextAfterSentenceCount),
      );
      await invoke('analyze_text', {
        label,
        index,
        prevSentences: getPreviousSentences(index, contextPreviousSentenceCount),
        sentence: session.states[index].sentence,
        afterSentences: getAfterSentences(index, contextAfterSentenceCount),
      });
    }
  } catch (e) {
    console.error('Error invoking analyze_text:', e);
    alert('Analysis failed:\n\n' + String(e));
  } finally {
    retryThisBtnEl.disabled = false;
    retryFromHereBtnEl.disabled = false;
  }
}

function saveCurrentQA() {
  if (session.states.length === 0) {
    return;
  }
  const currentanswer = askAnswerEl.innerHTML?.trim() || '';
  session.states[session.currentIndex].askAnswer = currentanswer;

  const currentQuestion = askInputEl.value.trim();
  session.states[session.currentIndex].userQuestion = currentQuestion;
}

async function registerDOMEvents() {
  console.log('registerDOMEvents');

  toggleAnalysisEl.addEventListener('click', () => {
    analysisExpanded = !analysisExpanded;
    updatePanels();
  });

  toggleAskEl.addEventListener('click', () => {
    askExpanded = !askExpanded;
    updatePanels();
  });

  askInputEl.addEventListener('change', scheduleSave);
  wordInfoEl.addEventListener('change', scheduleSave);
  askAnswerEl.addEventListener('change', scheduleSave);

  prevBtnEl.addEventListener('click', () => {
    if (session.currentIndex > 0) {
      saveCurrentQA();
      session.currentIndex--;

      renderCurrentData(session.currentIndex);
      scheduleSave();
    }
  });

  nextBtnEl.addEventListener('click', () => {
    if (session.currentIndex < session.states.length - 1) {
      saveCurrentQA();

      session.currentIndex++;
      renderCurrentData(session.currentIndex);
      scheduleSave();
    }
  });

  sentenceSelectEl.addEventListener('change', () => {
    saveCurrentQA();
    session.currentIndex = Number(sentenceSelectEl.value);
    renderCurrentData(session.currentIndex);
  });

  retryThisBtnEl.addEventListener('click', () => {
    session.states[session.currentIndex].progressMessage = '';
    session.states[session.currentIndex].sentenceResult = null;
    startAnalyze(session.currentIndex, 1);
  });
  retryFromHereBtnEl.addEventListener('click', () => {
    startAnalyze(session.currentIndex, -1);
  });

  errorCloseBtnEl.addEventListener('click', () => {
    hideError();
  });

  askBtnEl.addEventListener('click', async () => {
    const question = askInputEl.value.trim();
    if (!question) {
      return;
    }

    session.states[session.currentIndex].userQuestion = '';
    askInputEl.value = '';

    const sentence = session.states[session.currentIndex].sentence;
    askAnswerEl.textContent = 'Waiting...';
    askBtnEl.disabled = true;

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
      if (indexSave === session.currentIndex && !askInputEl.value) {
        askInputEl.value = question;
      }
    }
  }); // End of askBtn click handler;

  wordInfoEl.addEventListener('scroll', () => {
    session.states[session.currentIndex].wordInfoScrollTop =
      wordInfoEl.scrollTop;
  });
  askAnswerEl.addEventListener('scroll', () => {
    session.states[session.currentIndex].askAnswerScrollTop =
      askAnswerEl.scrollTop;
  });

  document.addEventListener('mouseup', () => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      markInstanceSentence.unmark();
      markInstanceWordInfo.unmark();
      return;
    }

    selectedWord = selection.toString().trim();

    if (!selectedWord) {
      return;
    }
    const selectedContainer = selection?.anchorNode?.parentElement?.closest(
      '#sentence-pane, #word-info, #ask-answer',
    );
    if (!selectedContainer) {
      return;
    }
    if (selectedContainer.id === 'sentence-pane') {
      markInstanceWordInfo.mark(selectedWord);
      markInstanceAskAnswer.mark(selectedWord);
    } else if (selectedContainer.id === 'word-info') {
      markInstanceSentence.mark(selectedWord);
      markInstanceAskAnswer.mark(selectedWord);
    } else if (selectedContainer.id === 'ask-answer') {
      markInstanceSentence.mark(selectedWord);
      markInstanceWordInfo.mark(selectedWord);
    }
  });
} // End of registerDOMEvents function

async function registerWindowEvents() {
  console.log('registerWindowEvents');

  await appWindow.onFocusChanged(async ({ payload }) => {
    if (payload) {
      await invoke('window_focused', {
        label: appWindow.label,
      });
    }
  });

  await appWindow.onResized(async ({ payload }) => {
    const scale = await appWindow.scaleFactor();
    session.width = payload.width / scale;
    session.height = payload.height / scale;

    await invoke('set_default_analysis_size', {
      width: session.width,
      height: session.height,
    });

    scheduleSave();
  });
} // registerWindowEvents
init();
