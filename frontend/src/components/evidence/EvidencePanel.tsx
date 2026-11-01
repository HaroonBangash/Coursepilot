import { Citation } from '@/lib/types';

export function EvidencePanel({ citations }: { citations: Citation[] }) {
  return (
    <aside className="glass-card h-fit p-4">
      <h3 className="text-sm font-semibold text-white">Evidence & Sources</h3>
      <p className="mt-1 text-xs text-slate-300">Retrieved notes used to generate this answer.</p>

      <div className="mt-4 space-y-3">
        {citations.length === 0 ? (
          <p className="text-sm text-slate-400">No sources shown yet.</p>
        ) : (
          citations.map((c, i) => (
            <article key={`${c.file_name}-${i}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold text-slate-200">{c.module_name}</p>
              <p className="text-xs text-slate-300">{c.file_name} • Slide/Page {c.page_or_slide}</p>
              <p className="mt-2 line-clamp-4 text-xs text-slate-200">{c.snippet}</p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
