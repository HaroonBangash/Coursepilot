'use client';

import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import clsx from 'clsx';
import { GraduationCap, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { AppShell } from '@/components/appshell/AppShell';

const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300';

function Section({ icon: Icon, title, children, index }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode; index: number }) {
  return (
    <section className="workspace-enter nebula-panel space-y-4 rounded-2xl p-5 md:p-6" style={{ '--i': index } as React.CSSProperties}>
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-white">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/25 text-brand-200">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-slate-200">
      <span className={clsx('relative h-6 w-10 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-white/15')}>
        <span className={clsx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
      </span>
      {label}
    </button>
  );
}

type Profile = {
  degreeLevel: string;
  programName: string;
  subjects: string[];
  displayName?: string;
  timezone?: string;
  language?: string;
  notificationsEmail?: boolean;
  notificationsProduct?: boolean;
  defaultAnswerMode?: 'concise' | 'balanced' | 'detailed';
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState('');

  const [degreeLevel, setDegreeLevel] = useState('Master');
  const [programName, setProgramName] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);

  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [language, setLanguage] = useState('English');
  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationsProduct, setNotificationsProduct] = useState(true);
  const [defaultAnswerMode, setDefaultAnswerMode] = useState<'concise' | 'balanced' | 'detailed'>('balanced');

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    const [pRes, meRes] = await Promise.all([fetch('/api/profile'), fetch('/api/auth/me')]);

    if (meRes.ok) {
      const me = await meRes.json();
      setEmail(me?.user?.email || '');
      setDisplayName((v) => v || me?.user?.name || '');
    }

    if (pRes.ok) {
      const d = await pRes.json();
      const p: Profile | null = d.profile || null;
      if (p) {
        setDegreeLevel(p.degreeLevel || 'Master');
        setProgramName(p.programName || '');
        setSubjects(p.subjects || []);
        setDisplayName(p.displayName || '');
        setTimezone(p.timezone || 'Asia/Karachi');
        setLanguage(p.language || 'English');
        setNotificationsEmail(typeof p.notificationsEmail === 'boolean' ? p.notificationsEmail : true);
        setNotificationsProduct(typeof p.notificationsProduct === 'boolean' ? p.notificationsProduct : true);
        setDefaultAnswerMode(p.defaultAnswerMode || 'balanced');
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const addSubject = () => {
    const s = subjectInput.trim();
    if (!s) return;
    if (!subjects.includes(s)) setSubjects((prev) => [...prev, s]);
    setSubjectInput('');
  };

  const removeSubject = (s: string) => {
    setSubjects((prev) => prev.filter((x) => x !== s));
  };

  const save = async () => {
    setError(null);
    setSuccess(null);

    if (!programName.trim()) {
      setError('Program is required.');
      return;
    }
    if (!subjects.length) {
      setError('Please add at least one subject.');
      return;
    }

    setSaving(true);
    const r = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        degreeLevel,
        programName,
        subjects,
        displayName,
        timezone,
        language,
        notificationsEmail,
        notificationsProduct,
        defaultAnswerMode,
      }),
    });

    const d = await r.json();
    setSaving(false);

    if (!r.ok) {
      setError(d.error || 'Failed to save profile.');
      return;
    }

    setSuccess('Settings updated successfully.');
  };

  return (
    <AppShell title="Account Settings" subtitle="Manage account, academic profile, and app preferences.">
      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="space-y-4">
          <Section icon={UserRound} title="Account" index={0}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="display-name" className={LABEL}>Display name</label>
                <input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="email" className={LABEL}>Email</label>
                <input id="email" value={email} disabled className="field" />
              </div>
            </div>
          </Section>

          <Section icon={GraduationCap} title="Academic profile" index={1}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="degree-level" className={LABEL}>Degree level</label>
                <select id="degree-level" value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)} className="field">
                  <option>Bachelor</option>
                  <option>Master</option>
                  <option>PhD</option>
                  <option>Diploma</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="program" className={LABEL}>Program</label>
                <input id="program" value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="e.g., Artificial Intelligence" className="field" />
              </div>
            </div>

            <div>
              <label htmlFor="subject-input" className={LABEL}>Subjects for RAG</label>
              <div className="flex gap-2">
                <input
                  id="subject-input"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubject();
                  }}
                  placeholder="Add subject"
                  className="field"
                />
                <button onClick={addSubject} className="rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">Add</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pl-3 pr-1.5 text-sm text-slate-100">
                    {s}
                    <button onClick={() => removeSubject(s)} aria-label={`Remove ${s}`} className="grid h-5 w-5 place-items-center rounded-full text-slate-300 hover:bg-rose-500/20 hover:text-rose-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Section icon={SlidersHorizontal} title="Preferences" index={2}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="timezone" className={LABEL}>Timezone</label>
                <input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="language" className={LABEL}>Language</label>
                <input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="field" />
              </div>
            </div>

            <div>
              <p className={LABEL}>Default answer mode</p>
              <div className="inline-flex rounded-xl bg-white/5 p-1" role="group" aria-label="Default answer mode">
                {(['concise', 'balanced', 'detailed'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDefaultAnswerMode(value)}
                    aria-pressed={defaultAnswerMode === value}
                    className={clsx('rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition-colors', defaultAnswerMode === value ? 'bg-brand-500 text-white' : 'text-slate-300 hover:text-white')}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <Switch label="Email notifications" checked={notificationsEmail} onChange={setNotificationsEmail} />
              <Switch label="Product updates" checked={notificationsProduct} onChange={setNotificationsProduct} />
            </div>
          </Section>

          <div className="nebula-panel sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <button onClick={save} disabled={saving} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-70">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            {error ? <p className="text-sm text-rose-300" role="alert">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300" role="status">{success}</p> : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
