'use client';

import { useEffect, useState } from 'react';
import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { Button } from '@/design-system';
import { IconYouTube } from '../LinkIcons';
import { NewTabHint } from '../NewTabHint';

const SUBSCRIBED_KEY = 'links.subscribed';
const SUBSCRIBED_VALUE = '1';

function readSubscribed(): boolean {
  try {
    return localStorage.getItem(SUBSCRIBED_KEY) === SUBSCRIBED_VALUE;
  } catch {
    return false;
  }
}

export type SubscribeCtaProps = {
  href: string;
  subscribeLabel: string;
  subscribedLabel: string;
  outboundId: string;
  newTabHint: string;
  subscribedHref: string;
};

export function SubscribeCta({
  href,
  subscribeLabel,
  subscribedLabel,
  subscribedHref,
  outboundId,
  newTabHint,
}: SubscribeCtaProps) {
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setSubscribed(readSubscribed());
  }, []);

  function remember() {
    try {
      localStorage.setItem(SUBSCRIBED_KEY, SUBSCRIBED_VALUE);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: a blocked storage write must not stop the navigation this click exists for
    } catch {}
    setSubscribed(true);
  }

  return (
    <Button
      as="a"
      href={subscribed ? subscribedHref : href}
      {...EXTERNAL_LINK_PROPS}
      size="lg"
      variant="primary"
      className="gap-[9px]"
      data-outbound={outboundId}
      onClick={remember}
    >
      <IconYouTube size={17} />
      {subscribed ? subscribedLabel : subscribeLabel}
      <NewTabHint text={newTabHint} />
    </Button>
  );
}
