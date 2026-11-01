import { SiteNav } from '@/components/shared/SiteNav';
import { FeatureShowcase } from '@/components/features/FeatureShowcase';

export default function FeaturesPage() {
  return (
    <main className="academic-shell min-h-screen">
      <div className="site-container py-10 md:py-14">
        <SiteNav />

        <section className="mx-auto max-w-3xl py-10 text-center lg:py-14">
          <span className="inline-block rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-slate-950">Features</span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">Everything you need to revise with confidence</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 md:text-base">
            Everything in CoursePilot is designed to support practical revision with trustworthy answers from your own materials.
          </p>
        </section>

        <FeatureShowcase />
      </div>
    </main>
  );
}
