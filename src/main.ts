import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

type SentenceResult = {
  original: string;
  translation: string;
  summary: string;
};

function renderResults(results: SentenceResult[]) {

  const container =
    document.querySelector("#results");

  if (!container) return;

  container.innerHTML = "";

  for (const item of results) {

    const card = document.createElement("div");
    card.className = "sentence-card";

    card.innerHTML = `
      <div class="original">
        ${escapeHtml(item.original)}
      </div>

      <div class="translation">
        ${escapeHtml(item.translation)}
      </div>

      <div class="summary">
        ${escapeHtml(item.summary)}
      </div>

      <button class="ask-button">
        Ask AI
      </button>
    `;

    const askButton =
      card.querySelector(".ask-button");

    askButton?.addEventListener(
      "click",
      () => {
        openAskModal(item.original);
      }
    );
    container.appendChild(card);
  }
}  // renderResults()

const inputEl =
  document.querySelector<HTMLTextAreaElement>("#inputText")!;

const buttonEl =
  document.querySelector<HTMLButtonElement>("#analyzeBtn")!;

const resultsEl =
  document.querySelector<HTMLDivElement>("#results")!;

buttonEl.addEventListener("click", async () => {
  const text = inputEl.value;
  resultsEl.innerHTML = "Loading...";
  try {
    const result = await invoke<SentenceResult[]>(
      "analyze_text",
      { text }
    );
    renderResults(result);
  } catch (err) {
    resultsEl.innerHTML =
      `<pre>${String(err)}</pre>`;
  }
});  // click event listener


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const modal = document.querySelector("#ask-modal");
const modalSentence = document.querySelector("#modal-sentence");
const questionInput = document.querySelector("#question-input") as HTMLTextAreaElement;
const answerArea = document.querySelector("#answer-area");
const closeModalButton = document.querySelector("#close-modal");

let currentSentence = "";
function openAskModal(sentence: string) {

  currentSentence = sentence;

  if (modalSentence) {
    modalSentence.textContent = sentence;
  }

  if (answerArea) {
    answerArea.textContent = "";
  }

  questionInput.value = "";

  modal?.classList.remove("hidden");
}

closeModalButton?.addEventListener(
  "click",
  () => {
    modal?.classList.add("hidden");
  }
);

const sendButton =
  document.querySelector("#send-question");

sendButton?.addEventListener(
  "click",
  async () => {

    const question = questionInput.value;
    if (answerArea) {
      answerArea.textContent = "Thinking...";
    }

    try {
      const response = await invoke<string>(
        "ask_ai",
        {
          sentence: currentSentence,
          question,
        }
      );

      if (answerArea) {
        answerArea.textContent = response;
      }

    } catch (e) {
      if (answerArea) {
        answerArea.textContent = String(e);
      }
    }
  }
);