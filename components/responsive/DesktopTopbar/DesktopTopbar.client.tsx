'use client';

import {
  TOPBAR_HIRE_LINK,
  TOPBAR_MOTION_LABEL,
  TOPBAR_NAV,
  TOPBAR_READING_LINK,
} from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import { topbarChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { cn } from '@/lib/cn';
import { IndexTrigger, SearchTrigger, useSectionNavigation } from '../SectionNavigation';

export function DesktopTopbar() {
  const { motionOn, toggleMotion } = useSectionNavigation();
  const { copy } = NAVIGATION;

  return (
    <div className="desktop-topbar fixed top-0 left-0 right-0 z-[110] bg-secondary-950 border-b border-primary-subtle hidden md:block">
      <div className="max-w-[var(--measure-page)] mx-auto px-[var(--space-gutter)] flex items-center gap-3 min-h-11">
        <WindowChrome size={12} style={{ gap: '8px' }} />
        <IndexTrigger />
        <div
          className={cn(
            'inline-flex items-center gap-1.5 h-[26px] px-2 text-[length:var(--text-min)] tracking-wider text-tertiary-50 border border-transparent',
            'text-primary-500 border-primary-subtle bg-glow-04',
          )}
        >
          <span>{topbarChrome.brandMark}</span>
          <span>{topbarChrome.brandLabel}</span>
          <span className="text-tertiary-50 ml-1 opacity-80">{topbarChrome.brandClose}</span>
        </div>
        <nav className="ml-auto flex gap-2 items-center flex-nowrap" aria-label="Site navigation">
          {TOPBAR_NAV.map(({ label, href }) => (
            <a
              key={href}
              className="text-primary-500 text-[length:var(--text-min)] tracking-wider whitespace-nowrap py-3 leading-5 hover:text-shadow-[0_0_8px_var(--color-primary-500)] hidden xl:inline"
              href={href}
            >
              {label}
            </a>
          ))}
          <SearchTrigger className="topbar-search" />
          <button
            type="button"
            className={cn(
              'items-center gap-1.5 text-primary-400 text-[length:var(--text-min)] tracking-wider',
              'border border-primary-subtle px-3 py-1.5 min-h-11 cursor-pointer bg-transparent whitespace-nowrap',
              'transition-[box-shadow,background,border-color] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet hover:border-primary-500',
              'hidden xl:inline-flex',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            onClick={toggleMotion}
            data-motion={motionOn ? 'on' : 'off'}
            aria-pressed={motionOn}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full bg-primary-500 block',
                !motionOn && 'bg-primary-400 opacity-40',
              )}
              aria-hidden="true"
            />
            <span>{TOPBAR_MOTION_LABEL}</span>
          </button>
          <a
            className={cn(
              'border border-primary-500 text-primary-500 px-3 py-1.5 tracking-wider text-[length:var(--text-min)] inline-flex items-center min-h-11 whitespace-nowrap',
              'transition-[box-shadow,background] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet hover:no-underline',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href={TOPBAR_READING_LINK.href}
          >
            {TOPBAR_READING_LINK.label}
          </a>
          <a
            className={cn(
              'bg-primary-500 text-black font-bold tracking-wider px-3 py-1.5 text-[length:var(--text-min)] border border-primary-500',
              'transition-[box-shadow] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-primary-500)] hover:no-underline',
              'inline-flex items-center min-h-11 whitespace-nowrap',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href={TOPBAR_HIRE_LINK.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {TOPBAR_HIRE_LINK.label}
            <span className="sr-only">{copy.newTabSuffix}</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
