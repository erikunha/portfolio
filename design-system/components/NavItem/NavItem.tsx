import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { joinClassNames } from '@/lib/join-class-names';

export type NavItemProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  href: string;
  label: ReactNode;
  index?: string;
  current?: boolean;
};

export function NavItem({ label, index, current = false, className, ...rest }: NavItemProps) {
  return (
    <a
      className={joinClassNames('nav-item', className)}
      aria-current={current ? 'location' : undefined}
      {...rest}
    >
      <span className="nav-label">{label}</span>
      {index ? (
        <span className="nav-num" aria-hidden="true">
          {index}
        </span>
      ) : null}
    </a>
  );
}
