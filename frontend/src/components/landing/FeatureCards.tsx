const sections = [
  {
    title: 'Built for revision',
    points: [
      'Ask direct questions from your module notes before exams.',
      'Turn dense lecture content into focused revision summaries.',
      'Use one place for quick recall, concept checks, and recap sessions.',
    ],
  },
  {
    title: 'Why students can trust it',
    points: [
      'Each response can show where it came from in your notes.',
      'You can see whether an answer is fully supported or only partial.',
      'When evidence is missing, it says so instead of filling in guesses.',
    ],
  },
  {
    title: 'Designed around real course materials',
    points: [
      'Works with course slides and teaching notes, not open-web noise.',
      'Keeps answers aligned with module context and terminology.',
      'Helps revision stay consistent with what you were actually taught.',
    ],
  },
];

export function FeatureCards() {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <section key={section.title} className="glass-card p-6 md:p-7">
          <div className="grid gap-5 md:grid-cols-[220px_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">0{index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{section.title}</h3>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-slate-200">
              {section.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400/80" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
