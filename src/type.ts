export type SentenceResult = {
  index: number;
  original: string;
  translation: string;
  summary_ja: string;
  summary_en: string;
  grammar_explanation: string;
};
export type State = {
  sentence: string;
  progressMessage?: string;
  sentenceResult: SentenceResult | null;
  userQuestion: string;
  askAnswer: string;
};

export type AnalysisSession = {
  id: string;
  currentIndex: number;
  states: State[];
  isOpen: boolean;
};
