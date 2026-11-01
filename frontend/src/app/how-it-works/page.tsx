import { SiteNav } from '@/components/shared/SiteNav';
import { StepTimeline } from '@/components/how-it-works/StepTimeline';

export default function HowItWorksPage() {
  return (
    <main className="academic-shell min-h-screen">
      <div className="site-container py-10 md:py-14">
        <SiteNav />

        <section className="flex flex-wrap items-end justify-between gap-6 py-10 lg:py-14">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-slate-950">How it works</span>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">From your notes to an answer you can trust</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 md:text-base">
              A simple, student-friendly workflow designed to keep revision reliable and grounded in your own course notes.
            </p>
          </div>

          <div className="flex items-end text-xs font-medium">
            <span className="rounded-l-lg bg-white/10 px-3 py-3 text-slate-200">Your notes</span>
            <span className="rounded-lg rounded-bl-none bg-brand-400 px-3 pb-3 pt-7 text-slate-950">Cited answer</span>
          </div>
        </section>

        <StepTimeline />
      </div>
    </main>
  );
}
