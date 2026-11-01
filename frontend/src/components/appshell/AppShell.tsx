import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { WorkspaceNav } from '@/components/appshell/WorkspaceNav';

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="grid max-w-none gap-6 px-4 py-6 lg:grid-cols-[260px_1fr] lg:px-6">
        <aside className="nebula-panel h-fit min-w-0 self-start rounded-2xl p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-auto">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold nebula-heading">CoursePilot</span>
              <span className="block text-xs nebula-muted">Your notes. Your revision.</span>
            </span>
          </Link>
          <WorkspaceNav />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="workspace-enter px-1 py-2">
            <h1 className="text-2xl font-semibold nebula-heading md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm nebula-muted md:text-base">{subtitle}</p> : null}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
