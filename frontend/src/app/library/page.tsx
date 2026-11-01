'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Files, Search, Upload } from 'lucide-react';
import { AppShell } from '@/components/appshell/AppShell';
import { FileCard } from '@/components/workspace/FileCard';
import { isBusy, WorkspaceFile } from '@/lib/workspace';

const POLL_MS = 3000;
const ALL = 'All subjects';

export default function LibraryPage() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState(ALL);

  const load = useCallback(async () => {
    const r = await fetch('/api/files');
    if (!r.ok) return;
    const d = await r.json();
    setFiles(d.files || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const working = files.some((f) => isBusy(f.status));

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [working, load]);

  const remove = async (id: string) => {
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    load();
  };

  const reprocess = async (id: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'processing' } : f)));
    await fetch(`/api/files/${id}/reprocess`, { method: 'POST' });
    load();
  };

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    files.forEach((f) => counts.set(f.module, (counts.get(f.module) || 0) + 1));
    return [[ALL, files.length] as const, ...Array.from(counts.entries())];
  }, [files]);

  const term = search.trim().toLowerCase();
  const shown = files.filter((f) => (subject === ALL || f.module === subject) && (!term || `${f.name} ${f.module}`.toLowerCase().includes(term)));
  const ready = files.filter((f) => f.status === 'indexed').length;

  return (
    <AppShell title="My Library" subtitle={files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${ready} ready to search` : 'Browse your uploaded materials by module, file type, and status.'}>
      {loaded && files.length === 0 ? (
        <section className="workspace-enter nebula-panel rounded-2xl p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/25 text-brand-200">
            <Files className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-white">Your library is empty</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-300">Upload lecture slides or notes and they will appear here, ready to search and revise from.</p>
          <Link href="/upload-notes" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            <Upload className="h-4 w-4" />
            Upload notes
          </Link>
        </section>
      ) : (
        <>
          <div className="workspace-enter nebula-panel space-y-3 rounded-2xl p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search your files" placeholder="Search files or subjects..." className="field field-with-icon" />
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setSubject(name)}
                  aria-pressed={subject === name}
                  className={clsx('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', subject === name ? 'bg-brand-500 text-white' : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10')}
                >
                  {name} · {count}
                </button>
              ))}
            </div>
          </div>

          {!loaded ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-32" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="nebula-panel rounded-2xl p-6 text-center text-sm text-slate-300">No files match your search.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((file, i) => (
                <FileCard key={file.id} file={file} index={i} onDelete={remove} onReprocess={reprocess} />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
