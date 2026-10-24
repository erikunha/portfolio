'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import type { FooterContent } from '@/content/schemas';

const EMPTY_SECTION_IDS: string[] = [];
const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * SECONDS_PER_MINUTE;
const CLOCK_DIGITS = 2;
const CLOCK_ZERO = '0';
const PERCENT = 100;
const SECTION_THRESHOLD = 0.25;
const COMMAND_EVENT = 'shell-cmd-run';
const SCROLL_EVENT = 'scroll';
const VISIBILITY_EVENT = 'visibilitychange';
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const HEADING_SELECTOR = 'main h1';
const FOOTER_SELECTOR = 'footer';
const KEYDOWN_EVENT = 'keydown';
const SCROLL_BEHAVIOR = 'instant';
const HOME_SELECTOR = '#main-content';
const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
const HOME_SECTION_ID = 'bio';
const SESSION_FIELDS = {
  uptime: '[data-sess="uptime"]',
  depth: '[data-sess="depth"]',
  seen: '[data-sess="seen"]',
  commands: '[data-sess="commands"]',
  meter: 'meter',
} as const;

function formatUptime(seconds: number) {
  return [
    Math.floor(seconds / SECONDS_PER_HOUR),
    Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds % SECONDS_PER_MINUTE,
  ]
    .map((part) => String(part).padStart(CLOCK_DIGITS, CLOCK_ZERO))
    .join(':');
}

export function SessionCounters({
  children,
  sectionIds = EMPTY_SECTION_IDS,
}: {
  children?: ReactNode;
  sectionIds?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let commands = 0;
    let depth = 0;
    const seen = new Set<string>();
    const fields = Object.fromEntries(
      Object.entries(SESSION_FIELDS).map(([key, selector]) => [key, root.querySelector(selector)]),
    );
    const tick = () => {
      if (fields.uptime)
        fields.uptime.textContent = formatUptime(Math.floor(performance.now() / SECOND_MS));
    };
    const onCommand = () => {
      commands += 1;
      if (fields.commands) fields.commands.textContent = String(commands);
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const next = Math.max(
        depth,
        total > 0 ? Math.min(PERCENT, Math.round((window.scrollY / total) * PERCENT)) : 0,
      );
      if (next === depth) return;
      depth = next;
      if (fields.depth) fields.depth.textContent = `${depth}%`;
      if (fields.meter instanceof HTMLMeterElement) fields.meter.value = depth;
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const onVisibility = () => {
      clearInterval(interval);
      if (!document.hidden) {
        tick();
        interval = setInterval(tick, SECOND_MS);
      }
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  const sectionId = entry.target.id || HOME_SECTION_ID;
                  seen.add(sectionId);
                }
              }
              if (fields.seen) fields.seen.textContent = String(seen.size);
            },
            { threshold: SECTION_THRESHOLD },
          );
    for (const id of sectionIds) {
      const section = document.getElementById(id);
      if (section) observer?.observe(section);
    }
    const mobileHero = document.querySelector(MOBILE_HERO_SELECTOR);
    if (mobileHero) observer?.observe(mobileHero);
    tick();
    onScroll();
    onVisibility();
    window.addEventListener(COMMAND_EVENT, onCommand);
    window.addEventListener(SCROLL_EVENT, onScroll, { passive: true });
    document.addEventListener(VISIBILITY_EVENT, onVisibility);
    return () => {
      clearInterval(interval);
      observer?.disconnect();
      window.removeEventListener(COMMAND_EVENT, onCommand);
      window.removeEventListener(SCROLL_EVENT, onScroll);
      document.removeEventListener(VISIBILITY_EVENT, onVisibility);
    };
  }, [sectionIds]);

  return <div ref={ref}>{children}</div>;
}

export function HaltClock({ label }: { label: string }) {
  const clock = useRef<HTMLElement>(null);
  useEffect(() => {
    const now = new Date();
    if (clock.current)
      clock.current.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((part) => String(part).padStart(CLOCK_DIGITS, CLOCK_ZERO))
        .join(':');
  }, []);
  return (
    <span className="footer-halted-at">
      {label} <b ref={clock} data-sess="halt" data-volatile />
    </span>
  );
}

export function RebootControl({ copy }: { copy: FooterContent['reboot'] }) {
  const status = useRef<HTMLParagraphElement>(null);
  const announcementFrame = useRef<number | undefined>(undefined);
  const link = useRef<HTMLAnchorElement>(null);
  function reboot(): boolean {
    const heading = document.querySelector<HTMLElement>(HEADING_SELECTOR);
    if (!heading) return false;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: SCROLL_BEHAVIOR });
    if (status.current) status.current.textContent = '';
    if (announcementFrame.current !== undefined) cancelAnimationFrame(announcementFrame.current);
    announcementFrame.current = requestAnimationFrame(() => {
      if (status.current) status.current.textContent = copy.announcement;
    });
    return true;
  }

  useEffect(
    () => () => {
      if (announcementFrame.current !== undefined) cancelAnimationFrame(announcementFrame.current);
    },
    [],
  );

  useEffect(() => {
    const scope = link.current?.closest(FOOTER_SELECTOR);
    if (!scope) return;
    const onKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.target instanceof Element && event.target.closest(EDITABLE_SELECTOR)) return;
      if (event.key.toLowerCase() !== copy.key.toLowerCase()) return;
      if (reboot()) event.preventDefault();
    };
    scope.addEventListener(KEYDOWN_EVENT, onKeyDown);
    return () => scope.removeEventListener(KEYDOWN_EVENT, onKeyDown);
  });

  return (
    <>
      <a
        className="footer-reboot"
        href={HOME_SELECTOR}
        aria-label={copy.label}
        aria-keyshortcuts={copy.key}
        ref={link}
        onClick={(event) => {
          if (reboot()) event.preventDefault();
        }}
      >
        {copy.before} <kbd>{copy.key}</kbd> {copy.after}
      </a>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        ref={status}
        data-testid="footer-reboot-status"
      />
    </>
  );
}
