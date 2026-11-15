import { type RefObject, useEffect } from 'react';
import { SHELL_COMMAND_EVENT } from '@/lib/events';
import { NO_SECTION_ID, observeSections } from '@/lib/section-spy';
import { MS_PER_SECOND, pad2, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/lib/time';

const PERCENT = 100;
const SECTION_READING_BAND = '-40% 0px -40% 0px';
const SESSION_FIELDS = {
  uptime: '[data-sess="uptime"]',
  depth: '[data-sess="depth"]',
  seen: '[data-sess="seen"]',
  commands: '[data-sess="commands"]',
  meter: 'meter',
} as const;

type SessionRoot = RefObject<HTMLElement | null>;

function formatUptime(seconds: number) {
  return [
    Math.floor(seconds / SECONDS_PER_HOUR),
    Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds % SECONDS_PER_MINUTE,
  ]
    .map(pad2)
    .join(':');
}

export function useUptime(root: SessionRoot) {
  useEffect(() => {
    const field = root.current?.querySelector(SESSION_FIELDS.uptime);
    if (!field) return;
    const tick = () => {
      field.textContent = formatUptime(Math.floor(performance.now() / MS_PER_SECOND));
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const onVisibility = () => {
      clearInterval(interval);
      if (!document.hidden) {
        tick();
        interval = setInterval(tick, MS_PER_SECOND);
      }
    };
    tick();
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [root]);
}

export function useScrollDepth(root: SessionRoot) {
  useEffect(() => {
    const label = root.current?.querySelector(SESSION_FIELDS.depth);
    const meter = root.current?.querySelector(SESSION_FIELDS.meter);
    let depth = 0;
    const measure = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const next = Math.max(
        depth,
        total > 0 ? Math.min(PERCENT, Math.round((window.scrollY / total) * PERCENT)) : 0,
      );
      if (next === depth) return;
      depth = next;
      if (label) label.textContent = `${depth}%`;
      if (meter instanceof HTMLMeterElement) meter.value = depth;
    };
    let scrollFrame: number | undefined;
    const onScrollFrame = () => {
      if (scrollFrame !== undefined) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = undefined;
        measure();
      });
    };
    onScrollFrame();
    window.addEventListener('scroll', onScrollFrame, { passive: true });
    return () => {
      if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', onScrollFrame);
    };
  }, [root]);
}

export function useCommandCount(root: SessionRoot) {
  useEffect(() => {
    const field = root.current?.querySelector(SESSION_FIELDS.commands);
    let commands = 0;
    const onCommand = () => {
      commands += 1;
      if (field) field.textContent = String(commands);
    };
    window.addEventListener(SHELL_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(SHELL_COMMAND_EVENT, onCommand);
  }, [root]);
}

export function useSeenSections(root: SessionRoot, sectionIds: string[]) {
  useEffect(() => {
    const field = root.current?.querySelector(SESSION_FIELDS.seen);
    const seen = new Set<string>();
    return observeSections(sectionIds, { rootMargin: SECTION_READING_BAND }, (entered) => {
      for (const sectionId of entered) if (sectionId !== NO_SECTION_ID) seen.add(sectionId);
      if (field) field.textContent = String(seen.size);
    });
  }, [root, sectionIds]);
}
