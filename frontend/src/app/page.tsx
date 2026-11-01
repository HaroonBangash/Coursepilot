import Link from 'next/link';
import { SiteNav } from '@/components/shared/SiteNav';
import { SupportStateBadge } from '@/components/shared/SupportStateBadge';
import { TestimonialDeck } from '@/components/landing/TestimonialDeck';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="site-container flex min-h-screen flex-col py-8 md:py-10">
        <SiteNav />

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] xl:gap-16 2xl:gap-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] nebula-accent xl:text-sm">CoursePilot Study Companion</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight nebula-heading md:text-5xl xl:text-6xl 2xl:text-7xl 2xl:leading-[1.1]">
              Revise from your course materials with more clarity and confidence.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed nebula-muted md:text-lg xl:mt-7 2xl:text-xl">
              CoursePilot helps students ask questions, build summaries, and check exactly where answers came from in their own notes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
                Open demo
              </Link>
              <Link href="/signup" className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
                Sign up
              </Link>
              <Link href="/login" className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
                Login
              </Link>
            </div>

            <p className="mt-6 text-sm nebula-muted">Built for revision, not generic web answers.</p>
          </div>

          <div className="nebula-panel rounded-2xl p-5 md:p-6 2xl:p-8">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-sm font-semibold text-slate-100 2xl:text-base">Live preview</p>
              <SupportStateBadge state="SUPPORTED" />
            </div>

            <div className="space-y-4 text-sm 2xl:space-y-6 2xl:text-lg">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Question</p>
                <p className="mt-1 text-slate-200">Explain transfer learning in computer vision and when it is useful.</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Answer</p>
                <p className="mt-1 leading-relaxed text-slate-200">
                  Transfer learning reuses a pre-trained model and fine-tunes it for a related task. In the notes, it is recommended when labelled data is limited,
                  so you can adapt existing visual features instead of training from scratch.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-blue-950/50 p-3 2xl:p-4">
                <p className="text-xs font-semibold text-white 2xl:text-sm">Sources</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-100 2xl:text-sm">
                  <li>AI Foundations in Practice • Computervision_transferlearning.pptx • Slide 11</li>
                  <li>AI Foundations in Practice • Computervision_transferlearning.pptx • Slide 16</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      <TestimonialDeck />
    </main>
  );
}
