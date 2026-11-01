'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Files, Home, MessageSquare, Settings, Upload } from 'lucide-react';
import { LogoutButton } from '@/components/appshell/LogoutButton';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/ask', label: 'Ask / Chat', icon: MessageSquare },
  { href: '/upload-notes', label: 'Upload Notes', icon: Upload },
  { href: '/library', label: 'My Library', icon: Files },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function WorkspaceNav() {
  const pathname = usePathname();
  const [name, setName] = useState('');

  useEffect(() => {
    const load = async () => {
      const r = await fetch('/api/auth/me');
      if (!r.ok) return;
      const d = await r.json();
      setName(d?.user?.name || '');
    };
    load();
  }, []);

  return (
    <>
      <nav className="mt-5 flex gap-1 overflow-x-auto lg:block lg:space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors',
                active ? 'bg-brand-500 font-semibold text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-white/10 pt-3 lg:mt-4 lg:pt-4">
        {name ? (
          <div className="mb-2 hidden items-center gap-2.5 px-3 lg:flex">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-400 text-sm font-semibold text-slate-950">{name.charAt(0).toUpperCase()}</span>
            <p className="min-w-0 truncate text-sm font-medium text-slate-100">{name}</p>
          </div>
        ) : null}
        <LogoutButton />
      </div>
    </>
  );
}
