'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { TOPBAR_MOTION_LABEL } from '@/content/nav';
import { cn } from '@/lib/cn';
import { MenuTrigger, SearchTrigger, useSectionNavigation } from '../SectionNavigation';

const SECTION_PATH_SEPARATOR = '/';

function isCurrentPath(pathname: string | null, href: string): boolean {
  if (pathname === null || href.includes('#')) return false;
  return pathname === href || pathname.startsWith(`${href}${SECTION_PATH_SEPARATOR}`);
}

export function DesktopTopbar({ brand }: { brand: ReactNode }) {
  const { motionOn, toggleMotion, chrome } = useSectionNavigation();
  const pathname = usePathname();

  return (
    <div className="desktop-topbar fixed top-0 left-0 right-0 z-[110] bg-secondary-950 border-b border-primary-subtle hidden md:block">
      <div className="max-w-[var(--measure-page)] mx-auto px-[var(--space-gutter)] flex items-center gap-3 min-h-11">
        <MenuTrigger />
        <nav className="flex gap-2 items-center flex-nowrap" aria-label="Site navigation">
          <a
            className={cn(
              'border border-primary-500 text-primary-500 px-3 py-1.5 tracking-wider text-[length:var(--text-min)] items-center min-h-11 whitespace-nowrap',
              'transition-[box-shadow,background] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet hover:no-underline',
              'hidden lg:inline-flex',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href={chrome.topbarReading.href}
          >
            {chrome.topbarReading.label}
          </a>
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
              'bg-primary-500 text-black font-bold tracking-wider px-3 py-1.5 text-[length:var(--text-min)] border border-primary-500',
              'transition-[box-shadow] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-primary-500)] hover:no-underline',
              'items-center min-h-11 whitespace-nowrap',
              'hidden lg:inline-flex',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href={chrome.topbarHire.href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={chrome.topbarHire.accessibleName}
          >
            {chrome.topbarHire.label}
          </a>
          {chrome.topbarNav.map(({ label, href }) => (
            <a
              key={href}
              className="text-primary-500 text-[length:var(--text-min)] tracking-wider whitespace-nowrap py-3 leading-5 hover:text-shadow-[0_0_8px_var(--color-primary-500)] aria-[current=page]:underline aria-[current=page]:underline-offset-8 hidden xl:inline"
              href={href}
              aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center">{brand}</div>
      </div>
    </div>
  );
}
