'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard, AuthFooterLink, InputField } from '@/components/auth/AuthCard';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials.');
        return;
      }
      const nextPath = new URLSearchParams(window.location.search).get('next') || '/dashboard';
      router.push(nextPath);
      router.refresh();
    } catch {
      setError('Could not log in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 inline-block text-sm nebula-muted hover:text-slate-100">← Back to home</Link>
        <AuthCard
          title="Welcome back"
          subtitle="Log in to continue revising from your own uploaded materials."
          button={loading ? 'Logging in...' : 'Log in'}
          footer={<>New student? <AuthFooterLink href="/signup" label="Create an account" /></>}
          onSubmit={onSubmit}
        >
          <InputField label="University email" type="email" placeholder="you@university.edu" value={email} onChange={setEmail} />
          <InputField label="Password" type="password" placeholder="Enter your password" value={password} onChange={setPassword} />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </AuthCard>
      </div>
    </main>
  );
}
