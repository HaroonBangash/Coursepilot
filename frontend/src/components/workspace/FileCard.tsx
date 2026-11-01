'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { askHref, FileStatus, formatSize, isBusy, timeAgo, WorkspaceFile } from '@/lib/workspace';

const statusStyles: Record<FileStatus, string> = {
  uploaded: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  processing: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  indexed: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
  failed: 'border-rose-400/30 bg-rose-500/15 text-rose-300',
};

const statusLabels: Record<FileStatus, string> = {
  uploaded: 'Queued',
  processing: 'Indexing',
  indexed: 'Ready',
  failed: 'Failed',
};

function StatusPill({ status }: { status: FileStatus }) {
  const Icon = isBusy(status) ? Loader2 : status === 'failed' ? AlertTriangle : CheckCircle2;
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', statusStyles[status])}>
      <Icon className={clsx('h-3 w-3', isBusy(status) && 'animate-spin')} />
      {statusLabels[status]}
    </span>
  );
}

export function FileCard({
  file,
  index = 0,
  onDelete,
  onReprocess,
}: {
  file: WorkspaceFile;
  index?: number;
  onDelete?: (id: string) => void;
  onReprocess?: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const details = [file.module, formatSize(file.size), timeAgo(file.uploadedAt)].filter(Boolean).join(' · ');

  return (
    <article className="workspace-enter workspace-tile nebula-panel flex min-w-0 flex-col rounded-2xl p-4" style={{ '--i': index } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/25 text-[11px] font-bold tracking-wide text-brand-200">{file.type}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-300" title={details}>
            {details}
          </p>
        </div>
        <StatusPill status={file.status} />
      </div>

      {file.status === 'failed' ? <p className="mt-3 text-xs text-rose-300">Indexing failed, so this file cannot be searched yet. Try reprocessing it.</p> : null}

      {onDelete && onReprocess ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <p className="mr-auto text-xs text-slate-200">Delete this file?</p>
              <button onClick={() => setConfirming(false)} className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10">
                Keep
              </button>
              <button onClick={() => onDelete(file.id)} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">
                Delete
              </button>
            </>
          ) : (
            <>
              {file.status === 'indexed' ? (
                <Link
                  href={askHref(`Summarize the key points from ${file.name} in ${file.module}`, 'summary')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask about this
                </Link>
              ) : null}
              <button
                onClick={() => onReprocess(file.id)}
                disabled={isBusy(file.status)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reprocess
              </button>
              <button
                onClick={() => setConfirming(true)}
                aria-label={`Delete ${file.name}`}
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-rose-500/15 hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
