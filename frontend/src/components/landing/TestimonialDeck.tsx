'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { useStepReveal } from '@/lib/use-step-reveal';

type Testimonial = {
  name: string;
  age: number;
  studying: string;
  quote: string;
  image: string;
  // Prototype content: fictional student and quote. Set to false once a real student has agreed to be shown.
  illustrative: boolean;
};

const testimonials: Testimonial[] = [
  {
    name: 'Aisha Khan',
    age: 24,
    studying: 'MSc Artificial Intelligence',
    quote: 'Asking questions from my own slides beats searching through every lecture deck the night before an exam.',
    image: '/testimonials/laptop-and-notebook.jpg',
    illustrative: true,
  },
  {
    name: 'Daniel Osei',
    age: 26,
    studying: 'MSc Data Science',
    quote: 'I like seeing the module, file, and slide behind each answer. It makes checking my revision much faster.',
    image: '/testimonials/library-shelves.jpg',
    illustrative: true,
  },
  {
    name: 'Mei Lin',
    age: 23,
    studying: 'MSc Cyber Security',
    quote: 'When my notes do not cover something, it says so instead of guessing. That is why I trust the rest.',
    image: '/testimonials/open-books.jpg',
    illustrative: true,
  },
  {
    name: 'Omar Farouk',
    age: 22,
    studying: 'BSc Computer Science',
    quote: 'Module summaries give me a quick way to review before I go back to the full notes.',
    image: '/testimonials/writing-notes.jpg',
    illustrative: true,
  },
  {
    name: 'Sofia Rossi',
    age: 25,
    studying: 'MSc Machine Learning',
    quote: 'Uploading a new lecture and asking follow-up questions straight away fits how I actually study.',
    image: '/testimonials/study-desk.jpg',
    illustrative: true,
  },
];

const AUTO_ADVANCE_MS = 5500;
const SIDE_CARDS = 2;

export function TestimonialDeck() {
  const deckRefs = useRef<HTMLDivElement[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const spread = useStepReveal(deckRefs, 0) >= 0;
  const hasIllustrative = testimonials.some((t) => t.illustrative);

  useEffect(() => {
    if (!spread || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setActive((current) => (current + 1) % testimonials.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [spread, paused]);

  return (
    <section className="overflow-x-clip pb-20 pt-10">
      <div className="site-container text-center">
        <span className="inline-block rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-slate-950">Student feedback</span>
        <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">Made for the way students revise</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
          How CoursePilot fits into exam prep, coursework, and late-night revision.
        </p>
      </div>

      <div
        ref={(el) => {
          if (el) deckRefs.current[0] = el;
        }}
        data-spread={spread ? 'true' : 'false'}
        className="testimonial-deck relative mx-auto mt-12 h-[390px] w-full"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {testimonials.map((testimonial, i) => {
          const count = testimonials.length;
          const offset = ((i - active + count + SIDE_CARDS) % count) - SIDE_CARDS;
          return (
            <article
              key={testimonial.name}
              onClick={() => setActive(i)}
              aria-current={offset === 0 ? 'true' : undefined}
              className="testimonial-card flex flex-col p-2.5"
              style={{ '--o': offset, '--abs': Math.abs(offset) } as CSSProperties}
            >
              <div className="relative h-40 shrink-0 overflow-hidden rounded-2xl">
                <Image src={testimonial.image} alt="" fill sizes="270px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-10">
                  <p className="text-left text-sm font-semibold text-white">
                    {testimonial.name} · {testimonial.age}
                  </p>
                </div>
              </div>
              <div className="px-2 pt-3 text-left">
                <p className="text-xs text-slate-400">
                  Studying: <span className="font-semibold text-slate-100">{testimonial.studying}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{testimonial.quote}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-2 flex justify-center">
        {testimonials.map((testimonial, i) => (
          <button
            key={testimonial.name}
            onClick={() => setActive(i)}
            aria-label={`Show feedback from ${testimonial.name}`}
            aria-current={i === active ? 'true' : undefined}
            className="grid h-8 w-8 place-items-center"
          >
            <span className={clsx('h-2 rounded-full transition-all', i === active ? 'w-6 bg-white' : 'w-2 bg-white/40')} />
          </button>
        ))}
      </div>

      {hasIllustrative ? <p className="mt-2 text-center text-xs text-slate-300">Prototype: students and feedback are illustrative.</p> : null}
    </section>
  );
}
