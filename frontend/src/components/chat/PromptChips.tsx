const defaultPrompts = [
  'Summarize reinforcement learning from the notes',
  'Explain MapReduce step by step',
  'Compare clustering and classification',
  'What is overfitting and how is it controlled?',
];

export function PromptChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {defaultPrompts.map((p) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
