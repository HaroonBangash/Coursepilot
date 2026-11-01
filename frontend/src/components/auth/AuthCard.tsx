import Link from 'next/link';
import { FormEventHandler } from 'react';

export function AuthCard({
  title,
  subtitle,
  button,
  footer,
  children,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  button: string;
  footer: React.ReactNode;
  children: React.ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <div className="nebula-panel w-full max-w-md rounded-2xl p-6 md:p-7">
      <h1 className="text-2xl font-semibold nebula-heading">{title}</h1>
      <p className="mt-2 text-sm nebula-muted">{subtitle}</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {children}
        <button type="submit" className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          {button}
        </button>
      </form>

      <p className="mt-5 text-center text-sm nebula-muted">{footer}</p>
    </div>
  );
}

export function InputField({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-slate-200">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-indigo-200/25 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-indigo-300/60"
      />
    </label>
  );
}

export function AuthFooterLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="font-medium text-indigo-300 hover:text-indigo-200">{label}</Link>;
}
