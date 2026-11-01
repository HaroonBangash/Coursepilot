'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard, AuthFooterLink, InputField } from '@/components/auth/AuthCard';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not sign up.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not sign up right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 inline-block text-sm nebula-muted hover:text-slate-100">← Back to home</Link>
        <AuthCard
          title="Create your student account"
          subtitle="Start building your personal revision workspace from your own course notes."
          button={loading ? 'Creating account...' : 'Create account'}
          footer={<>Already have an account? <AuthFooterLink href="/login" label="Log in" /></>}
          onSubmit={onSubmit}
        >
          <InputField label="Full name" placeholder="Your name" value={name} onChange={setName} />
          <InputField label="University email" type="email" placeholder="you@university.edu" value={email} onChange={setEmail} />
          <InputField label="Password" type="password" placeholder="Create a password" value={password} onChange={setPassword} />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </AuthCard>
      </div>
    </main>
  );
}
