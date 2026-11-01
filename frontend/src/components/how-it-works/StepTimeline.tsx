'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { BookMarked, FileStack, MessageCircleQuestion, Search, ShieldAlert, Sparkles } from 'lucide-react';
import { useStepReveal } from '@/lib/use-step-reveal';

const steps = [
  {
    stage: 'Index',
    icon: FileStack,
    title: 'Your course materials are prepared',
    text: 'Lecture slides and notes are indexed so the assistant can search them quickly during revision.',
  },
  {
    stage: 'Ask',
    icon: MessageCircleQuestion,
    title: 'You ask a revision question',
    text: 'Ask naturally, just like you would while studying before an exam or assignment.',
  },
  {
    stage: 'Retrieve',
    icon: Search,
    title: 'Relevant notes are retrieved',
    text: 'The system finds the most relevant sections from your own materials before generating a response.',
  },
  {
    stage: 'Generate',
    icon: Sparkles,
    title: 'Answer is built from those notes',
    text: 'The response is produced using retrieved course content, not generic open-web text.',
  },
  {
    stage: 'Cite',
    icon: BookMarked,
    title: 'Sources are shown clearly',
    text: 'You can see module, file, and page/slide references used for the answer.',
  },
  {
    stage: 'Check',
    icon: ShieldAlert,
    title: 'If evidence is weak, it says so',
    text: 'Instead of guessing, CoursePilot marks responses as partial or insufficient when needed.',
  },
];

const STEP_DELAY_MS = 550;
const CURVE_RADIUS = 28;
const LINE_INSET = 56;

// Takes the list items, not the cards: their offsets are relative to the list and ignore the reveal transform.
function connectorPath(from: HTMLElement, to: HTMLElement) {
  const stacked = Math.abs(to.offsetLeft - from.offsetLeft) < 1;
  if (stacked) {
    const x = from.offsetLeft + LINE_INSET;
    return `M ${x} ${from.offsetTop + from.offsetHeight} V ${to.offsetTop}`;
  }

  const movingRight = to.offsetLeft > from.offsetLeft;
  const startX = movingRight ? from.offsetLeft + from.offsetWidth : from.offsetLeft;
  const startY = from.offsetTop + from.offsetHeight / 2;
  const endX = movingRight ? to.offsetLeft + LINE_INSET : to.offsetLeft + to.offsetWidth - LINE_INSET;
  const curveStartX = movingRight ? endX - CURVE_RADIUS : endX + CURVE_RADIUS;
  return `M ${startX} ${startY} H ${curveStartX} Q ${endX} ${startY} ${endX} ${startY + CURVE_RADIUS} V ${to.offsetTop}`;
}

export function StepTimeline() {
  const listRef = useRef<HTMLOListElement>(null);
  const stepRefs = useRef<HTMLLIElement[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reached = useStepReveal(stepRefs, STEP_DELAY_MS);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const items = stepRefs.current;
      setSize({ width: list.offsetWidth, height: list.offsetHeight });
      setPaths(items.slice(0, -1).map((item, i) => connectorPath(item, items[i + 1])));
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <ol ref={listRef} className="relative space-y-10 lg:space-y-12">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {paths.map((d, i) => (
          <g key={i} data-drawn={reached >= i ? 'true' : 'false'} className="timeline-connector">
            <mask id={`timeline-mask-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={size.width} height={size.height}>
              <path d={d} pathLength={1} className="timeline-reveal" />
            </mask>
            <path d={d} mask={`url(#timeline-mask-${i})`} className="timeline-line" />
            <path d={d} pathLength={1} className="timeline-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
          </g>
        ))}
      </svg>

      {steps.map((step, i) => {
        const fromRight = i % 2 === 1;
        return (
          <li
            key={step.stage}
            ref={(el) => {
              if (el) stepRefs.current[i] = el;
            }}
            className={clsx('relative lg:w-[44%]', fromRight && 'lg:ml-auto')}
          >
            <div
              data-visible={reached >= i ? 'true' : 'false'}
              data-side={fromRight ? 'right' : 'left'}
              className="timeline-card nebula-panel flex gap-4 rounded-3xl p-4 md:gap-5 md:p-5"
            >
              <span
                className={clsx(
                  'timeline-stage flex w-9 shrink-0 items-center justify-center rounded-full px-1 py-4 text-xs font-semibold tracking-wide',
                  fromRight ? 'bg-white text-slate-900' : 'bg-brand-500 text-white',
                )}
              >
                {step.stage}
              </span>
              <div className="py-1">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white md:text-lg">
                  <step.icon className="h-4 w-4 shrink-0 text-brand-400" />
                  <span>
                    {i + 1} {step.title}
                  </span>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 md:text-[15px]">{step.text}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
