'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';

const SELECTOR = '[data-type-reveal]';
const MAIN_SELECTOR = 'main';
const TYPED_CLASS = 'is-typed';
const STATIC_CLASS = 'is-static';
const READY_CLASS = 'type-reveal-ready';
const CHARS_PROPERTY = '--type-chars';
const REVEAL_ROOT_MARGIN = '0px';
const OBSERVER_OPTIONS: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: REVEAL_ROOT_MARGIN,
};

function revealAll(elements: Iterable<HTMLElement>) {
  for (const el of elements) {
    el.classList.add(TYPED_CLASS, STATIC_CLASS);
  }
}

export function TypeReveal() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a route change renders new marked elements that the DOM query must pick up
  useEffect(() => {
    const elements = new Set<HTMLElement>();
    const track = (candidates: Iterable<HTMLElement>) => {
      const fresh: HTMLElement[] = [];
      for (const el of candidates) {
        if (el.classList.contains(TYPED_CLASS) || elements.has(el)) continue;
        el.style.setProperty(
          CHARS_PROPERTY,
          String(Math.max(1, (el.textContent ?? '').trim().length)),
        );
        elements.add(el);
        fresh.push(el);
      }
      return fresh;
    };
    const marked = (node: Node): HTMLElement[] => {
      if (!(node instanceof HTMLElement)) return [];
      const inside = Array.from(node.querySelectorAll<HTMLElement>(SELECTOR));
      return node.matches(SELECTOR) ? [node, ...inside] : inside;
    };

    track(document.querySelectorAll<HTMLElement>(SELECTOR));
    const animate = readMotion() && typeof IntersectionObserver !== 'undefined';
    const observer = animate
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add(TYPED_CLASS);
            observer?.unobserve(entry.target);
          }
        }, OBSERVER_OPTIONS)
      : null;
    const handle = (fresh: HTMLElement[]) => {
      if (observer) for (const el of fresh) observer.observe(el);
      else revealAll(fresh);
    };
    handle(Array.from(elements));
    document.documentElement.classList.add(READY_CLASS);

    const mutations = new MutationObserver((records) => {
      const added = records.flatMap((record) => Array.from(record.addedNodes).flatMap(marked));
      if (added.length > 0) handle(track(added));
    });
    mutations.observe(document.querySelector(MAIN_SELECTOR) ?? document.body, {
      childList: true,
      subtree: true,
    });

    const unsubscribe = subscribeMotion((on) => {
      if (on) return;
      revealAll(elements);
      observer?.disconnect();
      mutations.disconnect();
    });

    return () => {
      unsubscribe();
      observer?.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);

  return null;
}
