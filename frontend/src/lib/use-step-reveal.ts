import { RefObject, useEffect, useState } from 'react';

// Returns the highest item index revealed so far. Walks one item at a time so
// anything skipped by a fast scroll still appears in order.
export function useStepReveal(items: RefObject<HTMLElement[]>, delayMs: number) {
  const [target, setTarget] = useState(-1);
  const [reached, setReached] = useState(-1);

  useEffect(() => {
    const elements = items.current ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = elements.indexOf(entry.target as HTMLElement);
          setTarget((current) => Math.max(current, index));
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (reached >= target) return;
    const timer = setTimeout(() => setReached((current) => current + 1), reached < 0 ? 0 : delayMs);
    return () => clearTimeout(timer);
  }, [reached, target, delayMs]);

  return reached;
}
