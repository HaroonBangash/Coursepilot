'use client';

import Link from 'next/link';
import { DragEvent, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CloudUpload, Loader2, Settings } from 'lucide-react';
import { AppShell } from '@/components/appshell/AppShell';
import { FileCard } from '@/components/workspace/FileCard';
import { WorkspaceFile } from '@/lib/workspace';

type Profile = {
  degreeLevel: string;
  programName: string;
  subjects: string[];
};

const ALLOWED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt'];

export default function UploadNotesPage() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [queued, setQueued] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [subject, setSubject] = useState<string>('');

  const ref = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    const r = await fetch('/api/files');
    if (!r.ok) return;
    const d = await r.json();
    setFiles(d.files || []);
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    const r = await fetch('/api/profile');
    if (!r.ok) {
      setLoadingProfile(false);
      return;
    }
    const d = await r.json();
    const p: Profile | null = d.profile || null;
    setProfile(p);
    if (p?.subjects?.length) setSubject(p.subjects[0]);
    setLoadingProfile(false);
  };

  useEffect(() => {
    loadFiles();
    loadProfile();
    const timer = setInterval(loadFiles, 2500);
    return () => clearInterval(timer);
  }, []);

  const uploadOne = (file: File) =>
    new Promise<string | null>((resolve) => {
      const form = new FormData();
      form.append('file', file);
      form.append('module', subject);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files');
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        setProgress(Math.round((evt.loaded / evt.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText).error || 'Upload failed');
        } catch {
          resolve('Upload failed');
        }
      };
      xhr.onerror = () => resolve('Upload failed');
      xhr.send(form);
    });

  const uploadAll = async (selected: File[]) => {
    if (busy || !selected.length) return;
    if (!subject) {
      setError('Please select a subject first.');
      return;
    }

    const allowed = selected.filter((f) => ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)));
    const problems: string[] = [];
    if (allowed.length < selected.length) problems.push(`Skipped ${selected.length - allowed.length} unsupported ${selected.length - allowed.length === 1 ? 'file' : 'files'}.`);

    setBusy(true);
    setError(problems.join(' ') || null);

    for (let i = 0; i < allowed.length; i += 1) {
      setCurrentName(allowed[i].name);
      setQueued(allowed.length - i - 1);
      setProgress(0);
      const failure = await uploadOne(allowed[i]);
      if (failure) problems.push(`${allowed[i].name}: ${failure}`);
      await loadFiles();
    }

    setError(problems.join(' ') || null);
    setBusy(false);
    setCurrentName('');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    uploadAll(Array.from(e.dataTransfer.files));
  };

  const hasProfileSubjects = !!profile?.subjects?.length;
  const sending = progress < 100;

  return (
    <AppShell title="Upload Notes" subtitle="Add slides and notes, and CoursePilot makes them searchable for revision.">
      {loadingProfile ? (
        <div className="skeleton h-64" />
      ) : !hasProfileSubjects ? (
        <section className="workspace-enter nebula-panel rounded-2xl p-10 text-center">
          <h2 className="text-lg font-semibold text-white">Add your subjects first</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-300">Your notes are organised by subject, so set up your degree, program, and subjects before uploading.</p>
          <Link href="/settings" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            <Settings className="h-4 w-4" />
            Go to Settings
          </Link>
        </section>
      ) : (
        <>
          <section className="workspace-enter nebula-panel rounded-2xl p-5 md:p-6">
            <p className="text-sm font-semibold text-white">1. Choose a subject</p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Subject folder">
              {(profile?.subjects || []).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  aria-pressed={subject === s}
                  className={clsx('rounded-full px-3 py-1.5 text-sm transition-colors', subject === s ? 'bg-brand-500 font-medium text-white' : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10')}
                >
                  {s}
                </button>
              ))}
            </div>

            <p className="mt-6 text-sm font-semibold text-white">2. Add your files</p>
            <input
              ref={ref}
              type="file"
              multiple
              accept={ALLOWED_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => {
                uploadAll(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />

            <div
              data-dragging={dragging ? 'true' : 'false'}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={onDrop}
              className="drop-zone mt-3 rounded-2xl border-2 border-dashed border-white/20 bg-blue-950/40 px-6 py-10 text-center"
            >
              {busy ? (
                <div className="mx-auto max-w-md" role="status">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-400" />
                  <p className="mt-3 truncate text-sm font-semibold text-white">{currentName}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    {sending ? `Uploading ${progress}%` : 'Indexing your notes. This can take a minute.'}
                    {queued ? ` · ${queued} more waiting` : ''}
                  </p>
                </div>
              ) : (
                <>
                  <CloudUpload className="mx-auto h-10 w-10 text-brand-400" />
                  <p className="mt-3 text-base font-semibold text-white">{dragging ? `Drop to add to ${subject}` : 'Drag and drop your files here'}</p>
                  <p className="mt-1 text-sm text-slate-300">PDF, PPT, PPTX, DOC, DOCX, or TXT</p>
                  <button onClick={() => ref.current?.click()} className="mt-4 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
                    Browse files
                  </button>
                </>
              )}
            </div>
            {error ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
          </section>

          {files.length ? (
            <section>
              <h2 className="mb-3 px-1 text-base font-semibold text-white">Your uploads</h2>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {files.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
