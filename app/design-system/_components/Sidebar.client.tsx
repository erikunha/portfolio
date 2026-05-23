'use client';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

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
    <nav aria-label="Design system" className={styles.root}>
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className={pathname === href ? styles.active : styles.link}
          aria-current={pathname === href ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
