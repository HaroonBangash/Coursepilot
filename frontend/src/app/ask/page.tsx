'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { BookOpen, Check, ChevronDown, Copy, FileText, GraduationCap, Lightbulb, RefreshCw, Send, Sparkles, SquarePen } from 'lucide-react';
import { SupportStateBadge } from '@/components/shared/SupportStateBadge';
import { AppShell } from '@/components/appshell/AppShell';
import { AskMode, CHAT_STORAGE_KEY, cleanFileName } from '@/lib/workspace';

type Citation = { module: string; file: string; location: string; snippet: string };

type AssistantTurn = {
  role: 'assistant';
  answer: string;
  mode: AskMode;
  supportState: 'SUPPORTED' | 'PARTIAL' | 'INSUFFICIENT';
  citations: Citation[];
};

type UserTurn = { role: 'user'; text: string; mode: AskMode };
type ChatTurn = UserTurn | AssistantTurn;

const FOLLOW_UPS = ['Explain that more simply', 'Give me an example from my notes', 'Quiz me on this'];

function starterPrompts(subjects: string[]) {
  const [first = 'my notes', second = first, third = first] = subjects;
  return [
    { label: 'Summarize', text: `Summarize the key ideas in ${first}`, mode: 'summary' as const, icon: BookOpen },
    { label: 'Explain', text: `What are the most important concepts in ${second}?`, mode: 'answer' as const, icon: Lightbulb },
    { label: 'Quiz me', text: `Write 5 exam-style questions from ${third}`, mode: 'answer' as const, icon: GraduationCap },
  ];
}

function Source({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-white/10 bg-blue-950/50 text-xs">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2.5 p-3 text-left">
        <FileText className="h-4 w-4 shrink-0 text-brand-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-100">{citation.module}</span>
          <span className="block truncate text-slate-300">{`${cleanFileName(citation.file)} • ${citation.location}`}</span>
        </span>
        {citation.snippet ? <ChevronDown className={clsx('h-4 w-4 shrink-0 text-slate-300 transition-transform', open && 'rotate-180')} /> : null}
      </button>
      {open && citation.snippet ? <p className="border-t border-white/10 p-3 leading-relaxed text-slate-200">{citation.snippet}</p> : null}
    </li>
  );
}

function Answer({ turn }: { turn: AssistantTurn }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(turn.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article data-state={turn.supportState} className="answer-card workspace-enter nebula-panel rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="mr-auto text-sm font-semibold text-white">{turn.mode === 'summary' ? 'Summary' : 'Answer'}</p>
        <SupportStateBadge state={turn.supportState} />
        <button onClick={copy} aria-label="Copy answer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
          {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100 md:text-[15px]">{turn.answer}</p>

      <div className="mt-4 border-t border-white/10 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">References</h3>
        {turn.citations.length === 0 ? (
          <p className="mt-2 text-xs text-slate-300">No references available for this response.</p>
        ) : (
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {turn.citations.map((citation, i) => (
              <Source key={i} citation={citation} />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function AskPage() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AskMode>('answer');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [restored, setRestored] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hasReadyFiles, setHasReadyFiles] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) setChat(JSON.parse(saved));
    } catch {
      // A blocked or corrupt store just means starting a new chat.
    }
    setRestored(true);

    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('q');
    if (prefill) {
      setQuery(prefill);
      setMode(params.get('mode') === 'summary' ? 'summary' : 'answer');
      window.history.replaceState(null, '', '/ask');
      inputRef.current?.focus();
    }

    const load = async () => {
      const [profileRes, filesRes] = await Promise.all([fetch('/api/profile'), fetch('/api/files')]);
      if (profileRes.ok) setSubjects((await profileRes.json()).profile?.subjects || []);
      if (filesRes.ok) {
        const files: { status: string }[] = (await filesRes.json()).files || [];
        setHasReadyFiles(files.some((f) => f.status === 'indexed'));
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chat));
    } catch {
      // The chat still works for this visit without storage.
    }
  }, [chat, restored]);

  useEffect(() => {
    if (chat.length || loading) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, loading]);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const send = async (text: string, sendMode: AskMode, base: ChatTurn[]) => {
    setLoading(true);
    setError(null);

    const nextChat: ChatTurn[] = [...base, { role: 'user', text, mode: sendMode }];
    setChat(nextChat);
    setQuery('');

    const chatHistory = nextChat.slice(-8).map((t) => (t.role === 'user' ? { role: 'user', content: t.text } : { role: 'assistant', content: t.answer }));

    try {
      const r = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, mode: sendMode, chatHistory }),
      });
      const d = await r.json();

      if (!r.ok) {
        setError(d?.error || d?.message || (d?.errorType ? `Request failed: ${d.errorType}` : 'Failed to get answer'));
        return;
      }

      setChat((prev) => [...prev, { role: 'assistant', answer: d.answer, mode: sendMode, supportState: d.supportState, citations: d.citations || [] }]);
    } catch {
      setError('Could not reach CoursePilot. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = query.trim();
    if (text && !loading) send(text, mode, chat);
  };

  const retry = () => {
    const last = chat[chat.length - 1];
    if (last?.role === 'user') send(last.text, last.mode, chat.slice(0, -1));
  };

  const resetChat = () => {
    setChat([]);
    setError(null);
  };

  const useStarter = (text: string, starterMode: AskMode) => {
    setQuery(text);
    setMode(starterMode);
    inputRef.current?.focus();
  };

  const lastTurn = chat[chat.length - 1];

  return (
    <AppShell title="Ask from your notes" subtitle="Ask follow-ups and continue the same grounded conversation.">
      <div className="space-y-4 pb-2">
        {chat.length === 0 && !loading ? (
          <section className="workspace-enter nebula-panel rounded-2xl p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white md:text-xl">Where do you want to start?</h2>
            {hasReadyFiles ? (
              <p className="mt-1 text-sm text-slate-300">Pick a starting point, edit it if you like, then send it.</p>
            ) : (
              <p className="mt-1 text-sm text-slate-300">
                You have no searchable notes yet.{' '}
                <Link href="/upload-notes" className="font-medium text-brand-200 hover:text-white">
                  Upload some notes
                </Link>{' '}
                so CoursePilot has something to answer from.
              </p>
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {starterPrompts(subjects).map((starter) => (
                <button key={starter.label} onClick={() => useStarter(starter.text, starter.mode)} className="workspace-tile rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
                  <starter.icon className="h-5 w-5 text-brand-400" />
                  <p className="mt-3 text-sm font-semibold text-white">{starter.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{starter.text}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {chat.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="workspace-enter flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-sm text-white md:max-w-[70%]">{t.text}</p>
            </div>
          ) : (
            <Answer key={i} turn={t} />
          ),
        )}

        {loading ? (
          <div className="workspace-enter nebula-panel rounded-2xl p-5" role="status">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <Sparkles className="h-4 w-4 text-brand-400" />
              Searching your notes and writing a grounded answer
              <span className="text-slate-300">· {elapsed}s</span>
            </p>
            <div className="mt-4 space-y-2.5">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-11/12" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3" role="alert">
            <p className="mr-auto text-sm text-rose-200">{error}</p>
            {lastTurn?.role === 'user' ? (
              <button onClick={retry} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {lastTurn?.role === 'assistant' && !loading ? (
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UPS.map((text) => (
              <button key={text} onClick={() => send(text, 'answer', chat)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
                {text}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={endRef} />

        <form onSubmit={submit} className="nebula-panel sticky bottom-4 z-10 rounded-2xl p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-white/5 p-0.5" role="group" aria-label="Response type">
              {(['answer', 'summary'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={clsx('rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors', mode === value ? 'bg-brand-500 text-white' : 'text-slate-300 hover:text-white')}
                >
                  {value}
                </button>
              ))}
            </div>
            {chat.length > 0 ? (
              <button type="button" onClick={resetChat} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white">
                <SquarePen className="h-3.5 w-3.5" />
                New chat
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Your question"
              placeholder={mode === 'summary' ? 'What should I summarize from your notes?' : 'Ask a question or follow-up...'}
              className="field"
            />
            <button type="submit" aria-label="Send" disabled={loading || !query.trim()} className="grid w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
