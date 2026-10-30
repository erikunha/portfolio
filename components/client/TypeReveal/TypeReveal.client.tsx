'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { readMotion } from '@/lib/motion';

const SELECTOR = '[data-type-reveal]';
const TYPED_CLASS = 'is-typed';
const STATIC_CLASS = 'is-static';
const READY_CLASS = 'type-reveal-ready';
const CHARS_PROPERTY = '--type-chars';
const MOTION_CHANGE_EVENT = 'motionchange';
const OBSERVER_OPTIONS: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '0px 0px -12% 0px',
};

type MotionChangeDetail = { on: boolean };

function revealAll(elements: HTMLElement[]) {
  for (const el of elements) {
    el.classList.add(TYPED_CLASS, STATIC_CLASS);
  }
}

export function TypeReveal() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a route change renders new marked elements that the DOM query must pick up
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter(
      (el) => !el.classList.contains(TYPED_CLASS),
    );
    for (const el of elements) {
      el.style.setProperty(
        CHARS_PROPERTY,
        String(Math.max(1, (el.textContent ?? '').trim().length)),
      );
    }

    if (!readMotion() || typeof IntersectionObserver === 'undefined') {
      revealAll(elements);
      document.documentElement.classList.add(READY_CLASS);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add(TYPED_CLASS);
        observer.unobserve(entry.target);
      }
    }, OBSERVER_OPTIONS);
    for (const el of elements) observer.observe(el);
    document.documentElement.classList.add(READY_CLASS);

    const onMotionChange = (event: Event) => {
      if ((event as CustomEvent<MotionChangeDetail>).detail?.on) return;
      revealAll(elements);
      observer.disconnect();
    };
    window.addEventListener(MOTION_CHANGE_EVENT, onMotionChange);

    return () => {
      window.removeEventListener(MOTION_CHANGE_EVENT, onMotionChange);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
