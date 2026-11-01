import type { ReactNode } from 'react';

const DEVICE = '#171e2e';
const SCREEN = '#0d1320';
const EDGE = 'rgba(255, 255, 255, 0.13)';
const BAR = 'rgba(255, 255, 255, 0.24)';
const BRAND = '#2563eb';

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 170" className="h-auto w-full overflow-visible" aria-hidden="true">
      {children}
    </svg>
  );
}

function Bar({ x, y, width, className }: { x: number; y: number; width: number; className?: string }) {
  return <rect x={x} y={y} width={width} height={4} rx={2} fill={BAR} className={className} />;
}

export function AskArt() {
  return (
    <Art>
      <rect x={62} y={6} width={116} height={124} rx={14} fill={DEVICE} stroke={EDGE} />
      <Bar x={78} y={24} width={60} />
      <Bar x={78} y={36} width={84} />
      <Bar x={78} y={48} width={48} />
      <g className="art-float">
        <rect x={46} y={86} width={148} height={72} rx={14} fill={BRAND} />
        <path d="M 94 106 h 52 a 8 8 0 0 1 8 8 v 12 a 8 8 0 0 1 -8 8 h -38 l -10 8 v -8 h -4 a 8 8 0 0 1 -8 -8 v -12 a 8 8 0 0 1 8 -8 z" fill="#fff" />
        {[105, 120, 135].map((cx, i) => (
          <circle key={cx} cx={cx} cy={120} r={3.5} fill={BRAND} className="art-dot" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </g>
    </Art>
  );
}

export function SummaryArt() {
  return (
    <Art>
      <rect x={42} y={12} width={156} height={112} rx={8} fill={DEVICE} stroke={EDGE} />
      <rect x={50} y={20} width={140} height={96} rx={4} fill={SCREEN} />
      <g className="art-pulse">
        <circle cx={120} cy={50} r={17} fill={BRAND} />
        <path d="M 112 44 h 16 M 112 50 h 16 M 112 56 h 10" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <Bar x={82} y={80} width={76} className="art-condense" />
      <Bar x={82} y={90} width={76} className="art-condense art-delay-1" />
      <Bar x={82} y={100} width={76} className="art-condense art-delay-2" />
      <path d="M 26 128 h 188 l -6 8 a 6 6 0 0 1 -5 2 h -166 a 6 6 0 0 1 -5 -2 z" fill={DEVICE} stroke={EDGE} />
    </Art>
  );
}

export function CitedArt() {
  return (
    <Art>
      <rect x={80} y={2} width={80} height={164} rx={17} fill={DEVICE} stroke={EDGE} />
      <rect x={86} y={8} width={68} height={152} rx={12} fill={SCREEN} />
      <rect x={106} y={14} width={28} height={7} rx={3.5} fill={DEVICE} />
      <g className="art-pulse">
        <circle cx={120} cy={56} r={18} fill={BRAND} />
        <path d="M 112 56 l 6 6 l 11 -12" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Bar x={98} y={86} width={44} />
      <Bar x={104} y={96} width={32} />
      <rect x={96} y={112} width={48} height={18} rx={9} fill={BRAND} className="art-pulse" />
      <text x={120} y={124.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
        Slide 11
      </text>
    </Art>
  );
}

export function RefusalArt() {
  const shield = 'M 120 22 l 48 16 v 44 c 0 34 -22 52 -48 64 c -26 -12 -48 -30 -48 -64 v -44 z';
  return (
    <Art>
      <path d={shield} fill="none" stroke={BRAND} strokeWidth={2} className="art-ripple" />
      <path d={shield} fill="none" stroke={BRAND} strokeWidth={2} className="art-ripple art-delay-2" />
      <path d={shield} fill={DEVICE} stroke={EDGE} />
      <g className="art-pulse">
        <circle cx={120} cy={80} r={22} fill={BRAND} />
        <path d="M 111 71 l 18 18 M 129 71 l -18 18" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
      </g>
    </Art>
  );
}

const states = [
  { label: 'SUPPORTED', color: '#6ee7b7', tint: 'rgba(16, 185, 129, 0.16)' },
  { label: 'PARTIAL', color: '#fcd34d', tint: 'rgba(245, 158, 11, 0.16)' },
  { label: 'INSUFFICIENT', color: '#fda4af', tint: 'rgba(244, 63, 94, 0.16)' },
];

export function StatesArt() {
  return (
    <Art>
      <rect x={38} y={6} width={164} height={156} rx={14} fill={DEVICE} stroke={EDGE} />
      {states.map((state, i) => (
        <g key={state.label} className="art-cycle" style={{ animationDelay: `${i * 2}s` }}>
          <rect x={56} y={22 + i * 44} width={128} height={36} rx={18} fill={state.tint} stroke={state.color} strokeOpacity={0.5} />
          <circle cx={76} cy={40 + i * 44} r={4.5} fill={state.color} />
          <text x={90} y={44 + i * 44} fontSize={11} fontWeight={700} fill={state.color}>
            {state.label}
          </text>
        </g>
      ))}
    </Art>
  );
}

export function EvidenceArt() {
  return (
    <Art>
      <rect x={58} y={6} width={124} height={156} rx={12} fill={DEVICE} stroke={EDGE} />
      <Bar x={74} y={26} width={92} />
      <Bar x={74} y={40} width={70} />
      <rect x={70} y={52} width={100} height={22} rx={5} fill="rgba(37, 99, 235, 0.3)" />
      <Bar x={76} y={57} width={84} />
      <Bar x={76} y={65} width={58} />
      <Bar x={74} y={86} width={92} />
      <Bar x={74} y={100} width={64} />
      <Bar x={74} y={114} width={84} />
      <g className="art-scan">
        <circle cx={120} cy={84} r={22} fill="rgba(13, 19, 32, 0.45)" stroke="#fff" strokeWidth={3.5} />
        <path d="M 136 100 l 16 16" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      </g>
    </Art>
  );
}
