'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { ArrowRight, BookOpen, Check, FileText, Layers, MessageSquare, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { AppShell } from '@/components/appshell/AppShell';
import { CountUp } from '@/components/workspace/CountUp';
import { SupportStateBadge } from '@/components/shared/SupportStateBadge';
import { SupportState } from '@/lib/types';
import { askHref, isBusy, summaryPrompt, timeAgo, WorkspaceFile } from '@/lib/workspace';

type Stats = { filesUploaded: number; modulesIndexed: number; recentQuestions: number };
type RecentQ = { id: string; query: string; createdAt: string; supportState: SupportState; mode: 'answer' | 'summary' };
type Profile = { programName?: string; subjects?: string[]; displayName?: string };

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function SetupRing({ done, total }: { done: number; total: number }) {
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${done} of ${total} steps complete`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx={32} cy={32} r={RING_RADIUS} fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth={6} />
        <circle
          cx={32}
          cy={32}
          r={RING_RADIUS}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - done / total)}
          className="progress-ring"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-white">
        {done}/{total}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ filesUploaded: 0, modulesIndexed: 0, recentQuestions: 0 });
  const [recent, setRecent] = useState<RecentQ[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('Welcome back');
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));

    const load = async () => {
      const [dashboardRes, filesRes, profileRes, meRes] = await Promise.all([fetch('/api/dashboard'), fetch('/api/files'), fetch('/api/profile'), fetch('/api/auth/me')]);

      if (dashboardRes.ok) {
        const d = await dashboardRes.json();
        setStats(d.stats);
        setRecent(d.recentQuestions || []);
      }
      if (filesRes.ok) setFiles((await filesRes.json()).files || []);

      const p: Profile | null = profileRes.ok ? (await profileRes.json()).profile || null : null;
      setProfile(p);
      const me = meRes.ok ? await meRes.json() : null;
      setName(p?.displayName || me?.user?.name || '');
      setLoaded(true);
    };
    load();
  }, []);

  const subjects = useMemo(() => {
    const names = Array.from(new Set([...(profile?.subjects || []), ...files.map((f) => f.module)]));
    return names.map((subject) => {
      const own = files.filter((f) => f.module === subject);
      return {
        name: subject,
        total: own.length,
        indexed: own.filter((f) => f.status === 'indexed').length,
        working: own.filter((f) => isBusy(f.status)).length,
        failed: own.filter((f) => f.status === 'failed').length,
      };
    });
  }, [files, profile]);

  const setupSteps = [
    { label: 'Add your subjects', done: !!profile?.subjects?.length, href: '/settings', icon: Layers },
    { label: 'Upload your first notes', done: files.length > 0, href: '/upload-notes', icon: Upload },
    { label: 'Ask your first question', done: recent.length > 0, href: '/ask', icon: MessageSquare },
  ];
  const stepsDone = setupSteps.filter((s) => s.done).length;

  const supported = recent.filter((q) => q.supportState === 'SUPPORTED').length;
  const tiles = [
    { label: 'Files uploaded', value: stats.filesUploaded, href: '/library', icon: FileText },
    { label: 'Subjects ready', value: stats.modulesIndexed, href: '/library', icon: Layers },
    { label: 'Recent questions', value: stats.recentQuestions, href: '/ask', icon: MessageSquare },
    { label: 'Recent answers fully supported', value: supported, href: '/ask', icon: ShieldCheck },
  ];

  const quickPrompts = (profile?.subjects || []).slice(0, 3).map((subject) => ({ subject, href: askHref(summaryPrompt(subject), 'summary') }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim()) router.push(askHref(question.trim()));
  };

  return (
    <AppShell title={name ? `${greeting}, ${name.split(' ')[0]}` : greeting} subtitle={profile?.programName ? `${profile.programName} · Pick up where you left off.` : 'Pick up where you left off.'}>
      <form onSubmit={submit} className="workspace-enter nebula-panel rounded-2xl p-5 md:p-6">
        <label htmlFor="quick-ask" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-brand-400" />
          What are you revising today?
        </label>
        <div className="mt-3 flex gap-2">
          <input id="quick-ask" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything from your notes..." className="field" />
          <button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            Ask
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {quickPrompts.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickPrompts.map((p) => (
              <Link key={p.subject} href={p.href} className="max-w-full truncate rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
                Summarize {p.subject}
              </Link>
            ))}
          </div>
        ) : null}
      </form>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((tile, i) => (
          <Link key={tile.label} href={tile.href} className="workspace-enter workspace-tile nebula-panel rounded-2xl p-5" style={{ '--i': i + 1 } as React.CSSProperties}>
            <tile.icon className="h-5 w-5 text-brand-400" />
            <p className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              <CountUp value={tile.value} />
            </p>
            <p className="mt-1 text-sm text-slate-300">{tile.label}</p>
          </Link>
        ))}
      </div>

      {loaded && stepsDone < setupSteps.length ? (
        <section className="workspace-enter nebula-panel rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-4">
            <SetupRing done={stepsDone} total={setupSteps.length} />
            <div>
              <h2 className="text-lg font-semibold text-white">Get set up</h2>
              <p className="text-sm text-slate-300">Finish these to start revising from your own notes.</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {setupSteps.map((step) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={clsx('flex items-center gap-3 rounded-xl border px-3 py-3 text-sm', step.done ? 'border-emerald-400/30 bg-emerald-500/10 text-slate-200' : 'border-white/15 bg-white/5 text-white hover:bg-white/10')}
                >
                  {step.done ? <Check className="h-4 w-4 shrink-0 text-emerald-300" /> : <step.icon className="h-4 w-4 shrink-0 text-brand-400" />}
                  {step.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="workspace-enter nebula-panel min-w-0 rounded-2xl p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <BookOpen className="h-5 w-5 text-brand-400" />
            Your subjects
          </h2>
          {subjects.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">
              Add your subjects in{' '}
              <Link href="/settings" className="font-medium text-brand-200 hover:text-white">
                Settings
              </Link>{' '}
              to see them here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {subjects.map((subject) => (
                <li key={subject.name}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-100" title={subject.name}>
                      {subject.name}
                    </p>
                    {subject.indexed > 0 ? (
                      <Link href={askHref(summaryPrompt(subject.name), 'summary')} className="shrink-0 text-xs font-semibold text-brand-200 hover:text-white">
                        Revise
                      </Link>
                    ) : (
                      <Link href="/upload-notes" className="shrink-0 text-xs font-semibold text-brand-200 hover:text-white">
                        Add notes
                      </Link>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="progress-fill h-full rounded-full bg-brand-400" style={{ width: subject.total ? `${(subject.indexed / subject.total) * 100}%` : '0%' }} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300">
                    {subject.total === 0 ? 'No notes yet' : `${subject.indexed} of ${subject.total} ${subject.total === 1 ? 'file' : 'files'} ready`}
                    {subject.working ? ` · ${subject.working} indexing` : ''}
                    {subject.failed ? ` · ${subject.failed} failed` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="workspace-enter nebula-panel min-w-0 rounded-2xl p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <MessageSquare className="h-5 w-5 text-brand-400" />
            Recent questions
          </h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">Your questions will appear here so you can return to them.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {recent.map((q) => (
                <li key={q.id}>
                  <Link href={askHref(q.query, q.mode)} className="group flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100 group-hover:text-white">{q.query}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {q.mode === 'summary' ? 'Summary' : 'Answer'} · {timeAgo(q.createdAt)}
                      </span>
                    </span>
                    <SupportStateBadge state={q.supportState} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
