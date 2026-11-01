'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { CHAT_STORAGE_KEY } from '@/lib/workspace';

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Storage can be blocked; the chat then was never saved.
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );
}
