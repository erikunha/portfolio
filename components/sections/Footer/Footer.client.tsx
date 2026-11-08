'use client';

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { MAIN_CONTENT_ID } from '@/components/PageMain';
import type { FooterContent } from '@/content/schemas';
import { isRendered } from '@/lib/dom/is-rendered';
import { SHELL_COMMAND_EVENT } from '@/lib/events';
import { useLastRef } from '@/lib/request-refs.client';
import { NO_SECTION_ID, observeSections } from '@/lib/section-spy';
import { MS_PER_SECOND, pad2, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/lib/time';
import { RefCopyButton } from '../../client/RefChip/RefChip.client';

const EMPTY_SECTION_IDS: string[] = [];
const PERCENT = 100;
const SECTION_READING_BAND = '-40% 0px -40% 0px';
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const HEADING_SELECTOR = 'main h1, main [role="heading"][aria-level="1"]';
const FOOTER_SELECTOR = 'footer';
const SCROLL_BEHAVIOR = 'instant';
const HOME_SELECTOR = `#${MAIN_CONTENT_ID}`;
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
    .map(pad2)
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
        fields.uptime.textContent = formatUptime(Math.floor(performance.now() / MS_PER_SECOND));
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
    let scrollFrame: number | undefined;
    const onScrollFrame = () => {
      if (scrollFrame !== undefined) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = undefined;
        onScroll();
      });
    };
    let interval: ReturnType<typeof setInterval> | undefined;
    const onVisibility = () => {
      clearInterval(interval);
      if (!document.hidden) {
        tick();
        interval = setInterval(tick, MS_PER_SECOND);
      }
    };
    const stopSpy = observeSections(sectionIds, { rootMargin: SECTION_READING_BAND }, (entered) => {
      for (const sectionId of entered) if (sectionId !== NO_SECTION_ID) seen.add(sectionId);
      if (fields.seen) fields.seen.textContent = String(seen.size);
    });
    tick();
    onScroll();
    onVisibility();
    window.addEventListener(SHELL_COMMAND_EVENT, onCommand);
    window.addEventListener('scroll', onScrollFrame, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
      stopSpy();
      window.removeEventListener(SHELL_COMMAND_EVENT, onCommand);
      window.removeEventListener('scroll', onScrollFrame);
      document.removeEventListener('visibilitychange', onVisibility);
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
        .map(pad2)
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
  const reboot = useCallback((): boolean => {
    const heading = Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).find(
      isRendered,
    );
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
  }, [copy.announcement]);

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
    scope.addEventListener('keydown', onKeyDown);
    return () => scope.removeEventListener('keydown', onKeyDown);
  }, [copy.key, reboot]);

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

export function SessionReceipt({ copy }: { copy: FooterContent['receipt'] }) {
  const ref = useLastRef();
  if (ref === null) return null;
  return (
    <p className="footer-receipt" data-testid="footer-receipt">
      <span className="footer-receipt-id">
        {copy.label} <code>{ref}</code>
      </span>
      <RefCopyButton value={ref} feedback={copy.feedback} />
    </p>
  );
}
