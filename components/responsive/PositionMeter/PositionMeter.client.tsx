'use client';

import { useEffect, useRef } from 'react';
import { formatSectionPosition, NAVIGATION } from '@/content/navigation';
import { useSectionNavigation } from '../SectionNavigation';

const POSITION_TARGETS = '[data-position-target]';
const PERCENT = 100;

export function PositionMeter() {
  const { currentId } = useSectionNavigation();
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let last = -1;
    const written = new Set<HTMLElement>();
    const apply = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        scrollable > 0
          ? Math.max(0, Math.min(PERCENT, Math.round((window.scrollY / scrollable) * PERCENT)))
          : 0;
      if (percent === last) return;
      last = percent;
      barRef.current?.setAttribute('aria-valuenow', String(percent));
      for (const target of document.querySelectorAll<HTMLElement>(POSITION_TARGETS)) {
        target.style.setProperty('--posf', String(percent / PERCENT));
        written.add(target);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    resizeObserver?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resizeObserver?.disconnect();
      for (const target of written) target.style.removeProperty('--posf');
    };
  }, []);

  return (
    <div className="pos-meter">
      <div
        ref={barRef}
        className="pos-line"
        role="progressbar"
        aria-label={NAVIGATION.copy.positionLabel}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={0}
        data-position-target=""
      >
        <i />
      </div>
      <p className="pos-text">{formatSectionPosition(currentId)}</p>
    </div>
  );
}
