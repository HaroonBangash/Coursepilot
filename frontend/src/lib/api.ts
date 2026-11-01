import { ChatResponse } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_RAG_API_URL || 'http://localhost:8000';

export async function askRag(question: string, mode: 'answer' | 'summary'): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question, mode }),
  });

  if (!res.ok) {
    throw new Error(`RAG API error: ${res.status}`);
  }

  return res.json();
}
