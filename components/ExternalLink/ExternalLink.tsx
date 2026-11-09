import type { ComponentPropsWithoutRef } from 'react';

export const EXTERNAL_LINK_PROPS = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function externalLinkProps(external: boolean) {
  return external ? EXTERNAL_LINK_PROPS : {};
}

export function ExternalLink(props: Omit<ComponentPropsWithoutRef<'a'>, 'target' | 'rel'>) {
  return <a {...props} {...EXTERNAL_LINK_PROPS} />;
}
