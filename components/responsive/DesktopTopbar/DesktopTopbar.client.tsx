'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { ExternalLink } from '@/components/ExternalLink';
import { StatusDot } from '@/components/StatusDot';
import { LINKS_PATH } from '@/content/links.constants';
import { TOPBAR_MOTION_LABEL } from '@/content/nav';
import { cn } from '@/lib/cn';
import {
  LanguageSwitch,
  MenuTrigger,
  useCurrentSection,
  useMotionOn,
  useSectionNavigation,
} from '../SectionNavigation';

const SECTION_PATH_SEPARATOR = '/';

const HASH_MARK = '#';

const LINKS_PAGE_PATHS: readonly string[] = Object.values(LINKS_PATH);

function isCurrentPath(pathname: string | null, href: string): boolean {
  if (pathname === null || href.includes(HASH_MARK)) return false;
  if (LINKS_PAGE_PATHS.includes(href)) return LINKS_PAGE_PATHS.includes(pathname);
  return pathname === href || pathname.startsWith(`${href}${SECTION_PATH_SEPARATOR}`);
}

function hashTarget(href: string): string | null {
  const at = href.indexOf(HASH_MARK);
  return at < 0 ? null : href.slice(at + HASH_MARK.length);
}

function currentState(
  pathname: string | null,
  currentId: string,
  href: string,
): 'page' | 'location' | undefined {
  const target = hashTarget(href);
  if (target !== null) return target === currentId ? 'location' : undefined;
  return isCurrentPath(pathname, href) ? 'page' : undefined;
}

function TopbarLinks({ pathname }: { pathname: string | null }) {
  const { chrome, jump } = useSectionNavigation();
  const currentId = useCurrentSection();

  return chrome.topbarNav.map(({ label, href }) => (
    <a
      key={href}
      className="topbar-link hidden xl:inline"
      href={href}
      aria-current={currentState(pathname, currentId, href)}
      onClick={(event) => {
        const target = hashTarget(href);
        if (target !== null) jump(event, target);
      }}
    >
      {label}
    </a>
  ));
}

function CurrentTopbarLinks() {
  return <TopbarLinks pathname={usePathname()} />;
}

export function DesktopTopbar({ brand }: { brand: ReactNode }) {
  const { toggleMotion, chrome, copy, route } = useSectionNavigation();
  const motionOn = useMotionOn();

  return (
    <header className="desktop-topbar fixed top-0 left-0 right-0 bg-secondary-950 border-b border-primary-subtle hidden md:block">
      <div className="safe-zone flex items-center gap-3 min-h-11">
        <MenuTrigger />
        <nav className="flex gap-2 items-center flex-nowrap" aria-label={copy.siteNavLabel}>
          <Suspense fallback={<TopbarLinks pathname={route} />}>
            <CurrentTopbarLinks />
          </Suspense>
          <div className="flex gap-2 items-center flex-nowrap xl:ml-2">
            <button
              type="button"
              className="topbar-action topbar-action-toggle hidden xl:inline-flex"
              onClick={toggleMotion}
              data-motion={motionOn ? 'on' : 'off'}
              aria-pressed={motionOn}
            >
              <StatusDot blink className={cn(!motionOn && 'opacity-40')} />
              <span>{TOPBAR_MOTION_LABEL}</span>
            </button>
            <a
              className="topbar-action topbar-action-outline hidden lg:inline-flex"
              href={chrome.topbarReading.href}
            >
              {chrome.topbarReading.label}
            </a>
            <ExternalLink
              className="topbar-action topbar-action-solid hidden lg:inline-flex"
              href={chrome.topbarHire.href}
              aria-label={chrome.topbarHire.accessibleName}
            >
              {chrome.topbarHire.label}
            </ExternalLink>
          </div>
        </nav>
        <LanguageSwitch />
        <div className="flex items-center ml-auto pl-6">{brand}</div>
      </div>
    </header>
  );
}
