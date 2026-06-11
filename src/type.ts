export type SentenceResult = {
  index: number;
  original: string;
  answer: string;
  analysis_error: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};
export type State = {
  sentence: string;
  progressMessage?: string;
  sentenceResult: SentenceResult | null;
  userQuestion: string;
  askAnswer: string;
  wordInfoScrollTop?: number;
  askAnswerScrollTop?: number;
  askModel: string;
  askTokens: number;
};

export type AnalysisSession = {
  id: string;
  currentIndex: number;
  states: State[];
  isOpen: boolean;
  width?: number;
  height?: number;
  title?: string;
  created_at: string;
  updated_at?: string;
};
