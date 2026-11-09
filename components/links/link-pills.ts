import type { LinksPill } from '@/content/schemas';

type LinkedPill = LinksPill & { href: string };

const MAIL_PROTOCOL = 'mailto:';

export function isMail(pill: LinkedPill): boolean {
  return pill.href.startsWith(MAIL_PROTOCOL);
}

function isLinked(pill: LinksPill): pill is LinkedPill {
  return typeof pill.href === 'string' && pill.href.length > 0;
}

export function isLinkedProfile(pill: LinksPill): pill is LinkedPill {
  return isLinked(pill) && !isMail(pill);
}

export function isLinkedMail(pill: LinksPill): pill is LinkedPill {
  return isLinked(pill) && isMail(pill);
}
