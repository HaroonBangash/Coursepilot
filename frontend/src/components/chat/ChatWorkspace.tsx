'use client';

import { useMemo, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { AnswerCard } from '@/components/chat/AnswerCard';
import { PromptChips } from '@/components/chat/PromptChips';
import { ChatResponse } from '@/lib/types';

const demoResponse: ChatResponse = {
  mode: 'answer',
  support_state: 'SUPPORTED',
  answer:
    'Reinforcement learning is a learning setup where an agent interacts with an environment, takes actions, and receives rewards. Over time, the agent learns a policy that maximizes cumulative reward based on feedback from those interactions.',
  citations: [
    {
      module_name: 'AI Foundations in Practice',
      file_name: 'Reinforcementlearning.pptx',
      page_or_slide: 7,
      snippet: 'An RL agent observes state, takes action, and receives reward signal to update policy toward long-term return.',
    },
    {
      module_name: 'AI Foundations in Practice',
      file_name: 'Reinforcementlearning.pptx',
      page_or_slide: 9,
      snippet: 'Objective: maximize expected cumulative reward through repeated environment interaction.',
    },
  ],
};

export function ChatWorkspace() {
  const [query, setQuery] = useState('');
  const [summaryMode, setSummaryMode] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(demoResponse);

  const placeholder = useMemo(
    () => (summaryMode ? 'e.g., Summarize MapReduce from week 1 notes...' : 'Ask a question from your course notes...'),
    [summaryMode],
  );

  const handleSend = () => {
    if (!query.trim()) return;

    // TODO: wire to backend endpoint. Keeping demo behavior for now.
    setResponse({
      ...demoResponse,
      mode: summaryMode ? 'summary' : 'answer',
      answer: summaryMode
        ? `Grounded summary for: "${query}"\n\n${demoResponse.answer}`
        : `Answer for: "${query}"\n\n${demoResponse.answer}`,
    });
    setQuery('');
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Academic Assistant Chat</h2>
          <button
            onClick={() => setSummaryMode((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              summaryMode ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Summary Mode
          </button>
        </div>

        <PromptChips onSelect={setQuery} />

        <div className="mt-4 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none ring-brand-200 transition focus:ring"
          />
          <button onClick={handleSend} className="rounded-xl bg-brand-600 px-4 py-2.5 text-white transition hover:bg-brand-700">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {response ? <AnswerCard data={response} /> : null}
    </div>
  );
}
