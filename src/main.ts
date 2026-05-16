import { invoke } from "@tauri-apps/api/core";

type SentenceAnalysis = {
  sentence: string;
  translation: string;
  summary: string;
};

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

    const result = await invoke<SentenceAnalysis[]>(
      "analyze_text",
      { text }
    );

    renderResults(result);

  } catch (err) {

    resultsEl.innerHTML =
      `<pre>${String(err)}</pre>`;
  }
});

function renderResults(results: SentenceAnalysis[]) {

  resultsEl.innerHTML = "";

  for (const item of results) {

    const div = document.createElement("div");

    div.className = "sentence-card";

    div.innerHTML = `
      <div class="sentence">
        ${escapeHtml(item.sentence)}
      </div>

      <div class="translation">
        ${escapeHtml(item.translation)}
      </div>

      <div class="summary">
        ${escapeHtml(item.summary)}
      </div>
    `;

    resultsEl.appendChild(div);
  }
}

function escapeHtml(s: string): string {

return s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");
}