import { ChatResponse } from '@/lib/types';
import { SupportStateBadge } from '@/components/shared/SupportStateBadge';

function formatInlineCitationText(citations: ChatResponse['citations']) {
  if (!citations?.length) return '';
  const refs = citations.slice(0, 3).map((_, i) => `Ref ${i + 1}`).join('; ');
  return ` (${refs})`;
}

export function AnswerCard({ data }: { data: ChatResponse }) {
  const inlineRefs = formatInlineCitationText(data.citations);

  return (
    <section className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{data.mode === 'summary' ? 'Summary Mode' : 'Answer Mode'}</p>
        <SupportStateBadge state={data.support_state} />
      </div>

      <div className="prose prose-sm max-w-none text-slate-100">
        <p className="whitespace-pre-wrap leading-relaxed">{`${data.answer}${inlineRefs}`}</p>
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">References</p>
        {data.citations.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No references available for this response.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {data.citations.map((c, i) => (
              <li key={`${c.file_name}-${i}`}>
                {`[Ref ${i + 1}] ${c.module_name}, ${c.file_name}, Slide/Page ${c.page_or_slide}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
