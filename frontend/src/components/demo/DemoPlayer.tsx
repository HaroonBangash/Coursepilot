'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Check, FileText, Pause, Play, RotateCcw } from 'lucide-react';
import { SupportStateBadge } from '@/components/shared/SupportStateBadge';
import { SupportState } from '@/lib/types';
import { useStepReveal } from '@/lib/use-step-reveal';

export type DemoExample = {
  title: string;
  mode: 'Answer' | 'Summary';
  state: SupportState;
  question: string;
  answer: string;
  sources: { module: string; file: string; location: string }[];
};

const TICK_MS = 50;
const TYPE_MS = 26;
const SEARCH_MS = 2200;
const CHECK_MS = 800;
const WORD_MS = 70;
const HOLD_MS = 4200;

const STAGES = ['Question', 'Search notes', 'Check evidence', 'Answer'];

// Cumulative end time of each stage. The whole playback is derived from one elapsed value.
function stageEnds(example: DemoExample) {
  const typed = example.question.length * TYPE_MS;
  const searched = typed + SEARCH_MS;
  const checked = searched + CHECK_MS;
  const answered = checked + example.answer.split(' ').length * WORD_MS;
  return { typed, searched, checked, answered, total: answered + HOLD_MS };
}

function longest(values: string[]) {
  return values.reduce((a, b) => (b.length > a.length ? b : a), '');
}

// Holds the height of the longest example so switching never moves the page.
function Reserve({ text, className, children }: { text: string; className: string; children: ReactNode }) {
  return (
    <div className="grid">
      <p className={clsx('invisible col-start-1 row-start-1', className)} aria-hidden="true">
        {text}
      </p>
      <div className={clsx('col-start-1 row-start-1', className)}>{children}</div>
    </div>
  );
}

export function DemoPlayer({ examples }: { examples: DemoExample[] }) {
  const windowRefs = useRef<HTMLDivElement[]>([]);
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const started = useStepReveal(windowRefs, 0) >= 0;

  const example = examples[active];
  const ends = stageEnds(example);
  const time = reducedMotion ? ends.total : elapsed;
  const finished = reducedMotion || time >= ends.answered;

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!started || paused || reducedMotion) return;
    // Measures real time because browsers slow timers down in background tabs.
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setElapsed((current) => current + delta);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [started, paused, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || elapsed < ends.total) return;
    setActive((current) => (current + 1) % examples.length);
    setElapsed(0);
  }, [elapsed, ends.total, examples.length, reducedMotion]);

  const select = (index: number) => {
    setActive(index);
    setElapsed(0);
    setPaused(false);
  };

  const words = example.answer.split(' ');
  const typedChars = Math.min(Math.floor(time / TYPE_MS), example.question.length);
  const shownWords = Math.max(0, Math.min(Math.ceil((time - ends.checked) / WORD_MS), words.length));
  const searchProgress = Math.max(0, Math.min((time - ends.typed) / SEARCH_MS, 1));
  const stage = time < ends.typed ? 0 : time < ends.searched ? 1 : time < ends.checked ? 2 : 3;
  const searching = stage === 1;
  const verdictShown = time >= ends.searched;
  const typing = started && stage === 0 && !reducedMotion;
  const streaming = stage === 3 && !finished;

  const matchedFiles = new Set(example.sources.map((s) => s.file));
  const corpus = Array.from(new Set(examples.flatMap((e) => e.sources.map((s) => s.file))));
  const sourceCount = example.sources.length;

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          {examples.map((item, i) => {
            const isActive = i === active;
            return (
              <button
                key={item.title}
                onClick={() => select(i)}
                aria-pressed={isActive}
                className={clsx(
                  'nebula-panel relative overflow-hidden rounded-2xl p-4 text-left transition',
                  isActive ? 'demo-tab-active' : 'opacity-70 hover:opacity-100',
                )}
              >
                <p className="text-xs font-medium text-slate-400">Example {i + 1}</p>
                <p className="mt-1 text-sm font-semibold text-white">{item.title}</p>
                <div className="mt-3">
                  <SupportStateBadge state={item.state} />
                </div>
                {isActive ? (
                  <span
                    className="absolute bottom-0 left-0 h-[3px] bg-brand-400"
                    style={{ width: `${Math.min((time / ends.total) * 100, 100)}%` }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Try it with your notes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        ref={(el) => {
          if (el) windowRefs.current[0] = el;
        }}
        data-verdict={verdictShown ? example.state : undefined}
        className="demo-window nebula-panel min-w-0 overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs text-slate-300">CoursePilot · {example.mode} mode</p>
          <button
            onClick={() => setPaused((current) => !current)}
            disabled={reducedMotion}
            aria-label={paused ? 'Play demo' : 'Pause demo'}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={() => select(active)}
            disabled={reducedMotion}
            aria-label="Replay this example"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <ol className="grid grid-cols-4 gap-2 border-b border-white/10 px-4 py-3">
          {STAGES.map((label, i) => (
            <li key={label}>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className={clsx('h-full bg-brand-400 transition-all duration-300', i <= stage ? 'w-full' : 'w-0')} />
              </div>
              <p className={clsx('mt-1.5 truncate text-[11px] font-medium', i === stage ? 'text-white' : 'text-slate-400')}>{label}</p>
            </li>
          ))}
        </ol>

        <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Question</p>
              <Reserve text={longest(examples.map((e) => e.question))} className="mt-2 rounded-2xl rounded-tl-sm bg-brand-500/25 px-4 py-3 text-sm text-white md:text-base">
                {example.question.slice(0, typedChars)}
                {typing ? <span className="demo-caret" /> : null}
                <span className="opacity-0">{example.question.slice(typedChars)}</span>
              </Reserve>
            </div>

            <div>
              <div className="flex min-h-7 items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">{example.mode}</p>
                {verdictShown ? (
                  <span key={`${active}-verdict`} className="demo-pop">
                    <SupportStateBadge state={example.state} />
                  </span>
                ) : null}
              </div>
              <Reserve text={longest(examples.map((e) => e.answer))} className="mt-2 text-sm leading-relaxed text-slate-100 md:text-base">
                {words.slice(0, shownWords).join(' ')}
                {streaming ? <span className="demo-caret" /> : null}
                <span className="opacity-0"> {words.slice(shownWords).join(' ')}</span>
              </Reserve>
            </div>
          </div>

          <div className="min-w-0 space-y-4 rounded-xl bg-white/5 p-4">
            <div>
              <p className="text-xs font-semibold text-slate-200">Searching your notes</p>
              <ul className={clsx('demo-scan relative mt-3 space-y-2 overflow-hidden rounded-lg', searching && 'demo-scan-active')}>
                {corpus.map((file, i) => {
                  const scanned = searchProgress >= (i + 1) / corpus.length;
                  const matched = scanned && matchedFiles.has(file);
                  return (
                    <li
                      key={file}
                      className={clsx(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors duration-300',
                        matched ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' : 'border-white/10 text-slate-300',
                        scanned && !matched && 'opacity-50',
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{file}</span>
                      {matched ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 min-h-4 text-xs text-slate-300">
                {verdictShown ? (sourceCount > 0 ? `${sourceCount} ${sourceCount > 1 ? 'passages' : 'passage'} matched` : 'No matching evidence') : null}
              </p>
            </div>

            <div className="min-h-[136px] border-t border-white/10 pt-3">
              <p className="text-xs font-semibold text-slate-200">Sources used</p>
              {finished ? (
                sourceCount === 0 ? (
                  <p key={`${active}-none`} className="demo-pop mt-2 text-xs text-slate-300">
                    No reliable source found for this query.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {example.sources.map((source, i) => (
                      <li
                        key={`${active}-${source.location}`}
                        className="demo-pop rounded-lg border border-white/10 bg-blue-950/50 px-2.5 py-2 text-xs"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      >
                        <p className="truncate font-semibold text-white">{source.module}</p>
                        <p className="truncate text-slate-300">
                          {source.file} • {source.location}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
