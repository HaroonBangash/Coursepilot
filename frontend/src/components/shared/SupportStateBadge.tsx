import clsx from 'clsx';
import { ShieldCheck, AlertTriangle, ShieldX } from 'lucide-react';
import { SupportState } from '@/lib/types';

const styles: Record<SupportState, string> = {
  SUPPORTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  PARTIAL: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  INSUFFICIENT: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
};

const Icon = {
  SUPPORTED: ShieldCheck,
  PARTIAL: AlertTriangle,
  INSUFFICIENT: ShieldX,
};

export function SupportStateBadge({ state }: { state: SupportState }) {
  const StateIcon = Icon[state];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold', styles[state])}>
      <StateIcon className="h-3.5 w-3.5" />
      {state}
    </span>
  );
}
