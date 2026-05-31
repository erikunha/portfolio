'use client';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/design-system', label: 'OVERVIEW' },
  { href: '/design-system/tokens', label: 'TOKENS' },
  { href: '/design-system/components', label: 'COMPONENTS' },
  { href: '/design-system/enforcement', label: 'ENFORCEMENT' },
  { href: '/design-system/changelog', label: 'CHANGELOG' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Design system"
      className="flex flex-col gap-0.5 p-6 border-r border-border-default min-w-[180px] max-md:flex-row max-md:flex-wrap max-md:border-r-0 max-md:border-b max-md:min-w-0 max-md:p-3"
    >
      <a
        href="/"
        className="font-mono text-xs tracking-widest px-2.5 py-1.5 text-text-faint no-underline uppercase hover:text-text-body focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2"
      >
        ← HOME
      </a>
      <hr className="border-none border-t border-border-default my-2" />
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className={cn(
            'font-mono text-xs tracking-widest px-2.5 py-1.5 no-underline uppercase border focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2',
            pathname === href
              ? 'text-signal border-border-default'
              : 'text-text-muted border-transparent hover:text-text-body',
          )}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
