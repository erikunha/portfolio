'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/design-system';
import { IconYouTube } from '../LinkIcons';

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
  subscribedHref: string;
};

export function SubscribeCta({
  href,
  subscribeLabel,
  subscribedLabel,
  subscribedHref,
  outboundId,
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
      target="_blank"
      rel="noopener noreferrer"
      size="lg"
      variant="primary"
      className="gap-[9px]"
      data-outbound={outboundId}
      onClick={remember}
    >
      <IconYouTube size={17} />
      {subscribed ? subscribedLabel : subscribeLabel}
    </Button>
  );
}
