'use client';

import { type ComponentPropsWithoutRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

const TAB_INDEX_ATTRIBUTE = 'tabindex';
const OVERFLOW_TAB_INDEX = '0';

type MixerScrollProps = Omit<ComponentPropsWithoutRef<'section'>, 'role' | 'tabIndex'> & {
  'aria-label': string;
};

export function MixerScroll({ children, className, ...props }: MixerScrollProps) {
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const updateOverflow = () => {
      if (scroll.scrollWidth > scroll.clientWidth) {
        scroll.setAttribute(TAB_INDEX_ATTRIBUTE, OVERFLOW_TAB_INDEX);
      } else {
        scroll.removeAttribute(TAB_INDEX_ATTRIBUTE);
      }
    };

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(scroll);
    if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
    updateOverflow();
    return () => observer.disconnect();
  }, []);

  return (
    <section {...props} ref={scrollRef} role="region" className={cn('mx-scroll', className)}>
      {children}
    </section>
  );
}
