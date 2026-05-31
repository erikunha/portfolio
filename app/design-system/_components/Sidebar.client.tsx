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
      className="ds-sidebar flex flex-col gap-0.5 p-6 border-r border-primary-border min-w-[180px] max-md:flex-row max-md:flex-wrap max-md:border-r-0 max-md:border-b max-md:min-w-0 max-md:p-3"
    >
      <a
        href="/"
        className="font-mono text-xs tracking-widest px-2.5 py-1.5 text-primary-300 no-underline uppercase hover:text-tertiary-50 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
      >
        ← HOME
      </a>
      <hr className="border-none border-t border-primary-border my-2" />
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className={cn(
            'font-mono text-xs tracking-widest px-2.5 py-1.5 no-underline uppercase border focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
            pathname === href
              ? 'text-primary-500 border-primary-border'
              : 'text-primary-400 border-transparent hover:text-tertiary-50',
          )}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
