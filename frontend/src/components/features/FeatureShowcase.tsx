'use client';

import { useEffect, useRef, useState } from 'react';
import { useStepReveal } from '@/lib/use-step-reveal';
import { AskArt, CitedArt, EvidenceArt, RefusalArt, StatesArt, SummaryArt } from './FeatureArt';

const features = [
  {
    name: 'Ask from your notes',
    detail: 'Get revision answers based on indexed lecture materials and course documents.',
    art: AskArt,
  },
  {
    name: 'Revision summaries',
    detail: 'Generate concise summaries directly from your module content for faster review.',
    art: SummaryArt,
  },
  {
    name: 'Cited answers',
    detail: 'See where each answer came from using module, file, and page/slide references.',
    art: CitedArt,
  },
  {
    name: 'Safe refusal',
    detail: 'If your notes do not contain enough evidence, the assistant avoids guessing.',
    art: RefusalArt,
  },
  {
    name: 'Support states',
    detail: 'Each response is labelled as SUPPORTED, PARTIAL, or INSUFFICIENT for clarity.',
    art: StatesArt,
  },
  {
    name: 'Evidence panel',
    detail: 'Review source snippets used in the answer to study with more confidence.',
    art: EvidenceArt,
  },
];

const STEP_DELAY_MS = 380;
// Negative because each illustration has side padding inside its viewBox.
const LINE_GAP = -16;
const MIN_LINE_WIDTH = 40;
const WAVE_HEIGHT = 56;

type Connector = { start: number; d: string };

// Takes the art slots, which never transform, so reveals can't skew the measurements.
// Only links neighbours in the same row; a wrapped row would cut across the text.
function wavePath(from: HTMLElement, to: HTMLElement, index: number) {
  if (from.offsetTop !== to.offsetTop) return null;

  const startX = from.offsetLeft + from.offsetWidth + LINE_GAP;
  const endX = to.offsetLeft - LINE_GAP;
  const width = endX - startX;
  if (width < MIN_LINE_WIDTH) return null;

  const direction = index % 2 === 0 ? 1 : -1;
  const startY = from.offsetTop + from.offsetHeight * (direction > 0 ? 0.68 : 0.36);
  const endY = to.offsetTop + from.offsetHeight * (direction > 0 ? 0.36 : 0.68);
  return `M ${startX} ${startY} C ${startX + width * 0.5} ${startY + WAVE_HEIGHT * direction}, ${endX - width * 0.5} ${endY - WAVE_HEIGHT * direction}, ${endX} ${endY}`;
}

export function FeatureShowcase() {
  const listRef = useRef<HTMLUListElement>(null);
  const slotRefs = useRef<HTMLDivElement[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const reached = useStepReveal(slotRefs, STEP_DELAY_MS);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const slots = slotRefs.current;
      const next = slots.slice(0, -1).flatMap((slot, i) => {
        const d = wavePath(slot, slots[i + 1], i);
        return d ? [{ start: i, d }] : [];
      });
      setConnectors(next);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <ul ref={listRef} className="relative grid gap-x-8 gap-y-16 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-20">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {connectors.map(({ start, d }) => (
          <g key={start} data-drawn={reached >= start ? 'true' : 'false'} className="timeline-connector">
            <path d={d} pathLength={1} className="feature-line" />
            <path d={d} pathLength={1} className="timeline-pulse" style={{ animationDelay: `${start * 0.5}s` }} />
          </g>
        ))}
      </svg>

      {features.map((feature, i) => (
        <li key={feature.name} className="text-center">
          <div
            ref={(el) => {
              if (el) slotRefs.current[i] = el;
            }}
            className="mx-auto w-full max-w-[250px] 2xl:max-w-[300px]"
          >
            <div data-visible={reached >= i ? 'true' : 'false'} className="feature-reveal">
              <feature.art />
            </div>
          </div>
          <div data-visible={reached >= i ? 'true' : 'false'} className="feature-reveal mt-7">
            <h2 className="text-lg font-semibold text-white xl:text-xl">{feature.name}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-300">{feature.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
