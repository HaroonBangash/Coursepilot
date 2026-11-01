import { SiteNav } from '@/components/shared/SiteNav';

export default function AboutPage() {
  return (
    <main className="academic-shell min-h-screen">
      <div className="site-container py-10 md:py-14">
        <SiteNav />

        <section className="py-10">
          <h1 className="text-3xl font-semibold text-white md:text-4xl">About CoursePilot</h1>
          <div className="mt-5 max-w-3xl space-y-4 text-sm leading-relaxed text-slate-300 md:text-base">
            <p>
              CoursePilot is built as an MSc revision companion that works with course notes, lecture slides, and module materials.
            </p>
            <p>
              It is designed to help students study with confidence by showing where answers came from and by being transparent when evidence is incomplete.
            </p>
            <p>
              The goal is simple: support clearer, more trustworthy revision using the materials students already rely on.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
