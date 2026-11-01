export type FileStatus = 'uploaded' | 'processing' | 'indexed' | 'failed';

export type WorkspaceFile = {
  id: string;
  name: string;
  module: string;
  type: string;
  size?: number;
  uploadedAt: string;
  lastIndexedAt?: string;
  status: FileStatus;
};

export type AskMode = 'answer' | 'summary';

export const CHAT_STORAGE_KEY = 'coursepilot-chat';

export function isBusy(status: FileStatus) {
  return status === 'uploaded' || status === 'processing';
}

export function askHref(question: string, mode: AskMode = 'answer') {
  return `/ask?q=${encodeURIComponent(question)}&mode=${mode}`;
}

export function summaryPrompt(subject: string) {
  return `Summarize the key ideas in ${subject}`;
}

export function cleanFileName(name: string) {
  return String(name || '').replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');
}

export function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
