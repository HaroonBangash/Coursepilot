import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/demo', label: 'Demo' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
];

export function SiteNav() {
  return (
    <header className="nebula-panel rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-slate-200">
          <GraduationCap className="h-5 w-5 text-brand-400" />
          <span className="text-sm font-semibold tracking-wide">CoursePilot</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-300 transition hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Login
          </Link>
          <Link href="/signup" className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
