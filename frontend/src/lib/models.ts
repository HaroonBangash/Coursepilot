export type FileStatus = 'uploaded' | 'processing' | 'indexed' | 'failed';

export type UserFile = {
  id: string;
  userId: string;
  name: string;
  module: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: FileStatus;
  storagePath: string;
  lastIndexedAt?: string;
  error?: string;
};

export type Citation = {
  module: string;
  file: string;
  location: string;
  snippet: string;
};

export type QuestionRecord = {
  id: string;
  userId: string;
  mode: 'answer' | 'summary';
  query: string;
  answer: string;
  supportState: 'SUPPORTED' | 'PARTIAL' | 'INSUFFICIENT';
  citations: Citation[];
  createdAt: string;
};

export type StoreShape = {
  files: UserFile[];
  questions: QuestionRecord[];
};
