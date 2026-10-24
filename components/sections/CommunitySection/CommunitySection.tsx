import type { ReactNode } from 'react';
import { communityEvent } from '@/content/community';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconCommunity } from '../../Icons';
import { Module } from '../../responsive/Module';

const EXTERNAL_REL = 'noopener noreferrer';

function ExternalLink({
  href,
  newTabLabel,
  children,
}: {
  href: string;
  newTabLabel: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className="underline decoration-primary-subtle underline-offset-2 hover:text-primary-500 focus-visible:outline-1 focus-visible:outline-primary-500"
    >
      {children}
      <span className="sr-only"> {newTabLabel}</span>
    </a>
  );
}

export function CommunitySection({ defer }: { defer?: boolean } = {}) {
  const e = communityEvent;
  const [eventLink, ...refs] = e.links;
  if (!eventLink) return null;
  return (
    <Module
      id="sec-community"
      header="CAT ~/.COMMUNITY"
      srLabel={SECTION_LABELS['sec-community']}
      icon={<IconCommunity />}
      defer={defer}
    >
      <div className="text-sm max-md:text-xs leading-[1.7]">
        <div className="text-primary-500 font-bold tracking-[0.06em] text-sm max-md:text-xs mb-3">
          <ExternalLink href={eventLink.href} newTabLabel={e.newTabLabel}>
            {e.name}
          </ExternalLink>{' '}
          · {e.year} · {e.role}
        </div>
        <ul className="list-none ml-1 p-0 mb-0">
          {e.bullets.map((b) => (
            <li
              key={b}
              className="text-tertiary-50 text-xs md:text-[15px] pl-[18px] relative mb-1 before:content-['-'] before:text-primary-500 before:absolute before:left-1 before:top-0"
            >
              {b}
            </li>
          ))}
        </ul>
        <p className="text-tertiary-50 text-xs md:text-[13px] mt-[10px] mb-0">
          <span className="text-primary-500 mr-1.5">{'>'}</span>
          {e.refsLabel}{' '}
          {refs.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ' · ' : null}
              <ExternalLink href={link.href} newTabLabel={e.newTabLabel}>
                {link.label}
              </ExternalLink>
            </span>
          ))}
        </p>
        <div className="text-primary-500 font-bold text-xs max-md:text-[10px] md:text-[11px] mt-[14px] border-t border-dashed border-primary-quiet pt-3">
          <span className="text-primary-500 mr-1.5">{'>'}</span>status: {e.statusLine}
        </div>
      </div>
    </Module>
  );
}
