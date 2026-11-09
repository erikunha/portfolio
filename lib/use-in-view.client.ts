'use client';

import { type RefObject, useEffect, useState } from 'react';
import { observeInView, WHEN_UNSUPPORTED } from './in-view';

const DEFAULT_ROOT_MARGIN = '0px';

type UseInViewOptions = {
  rootMargin?: string;
  once?: boolean;
};

export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin = DEFAULT_ROOT_MARGIN, once = false }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      setInView(true);
      return undefined;
    }
    return observeInView(
      node,
      (entries, stop) => {
        if (once) {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setInView(true);
          stop();
          return;
        }
        const latest = entries[entries.length - 1];
        if (latest) setInView(latest.isIntersecting);
      },
      { rootMargin, whenUnsupported: WHEN_UNSUPPORTED.Intersecting },
    );
  }, [ref, rootMargin, once]);

  return inView;
}
