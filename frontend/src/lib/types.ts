export type SupportState = 'SUPPORTED' | 'PARTIAL' | 'INSUFFICIENT';

export interface Citation {
  module_name: string;
  file_name: string;
  page_or_slide: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  support_state: SupportState;
  citations: Citation[];
  mode: 'answer' | 'summary';
}
