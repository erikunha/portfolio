'use client';

import { useEffect, useState } from 'react';
import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { Button } from '@/design-system';
import { longestCopy } from '@/lib/longest-copy';
import { IconYouTube } from '../LinkIcons';
import { NewTabHint } from '../NewTabHint';

const SUBSCRIBED_KEY = 'links.subscribed';
const SUBSCRIBED_VALUE = '1';

const SUBSCRIBE_STATE = { Idle: 'idle', Subscribed: 'subscribed' } as const;

type SubscribeState = (typeof SUBSCRIBE_STATE)[keyof typeof SUBSCRIBE_STATE];

const SUB_VIEW = {
  [SUBSCRIBE_STATE.Idle]: { hrefProp: 'href', labelProp: 'subscribeLabel' },
  [SUBSCRIBE_STATE.Subscribed]: { hrefProp: 'subscribedHref', labelProp: 'subscribedLabel' },
} as const satisfies Record<
  SubscribeState,
  { hrefProp: keyof SubscribeCtaProps; labelProp: keyof SubscribeCtaProps }
>;

function readSubscribed(): SubscribeState {
  try {
    return localStorage.getItem(SUBSCRIBED_KEY) === SUBSCRIBED_VALUE
      ? SUBSCRIBE_STATE.Subscribed
      : SUBSCRIBE_STATE.Idle;
  } catch {
    return SUBSCRIBE_STATE.Idle;
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

export function SubscribeCta(props: SubscribeCtaProps) {
  const { outboundId, newTabHint } = props;
  const [state, setState] = useState<SubscribeState>(SUBSCRIBE_STATE.Idle);
  const view = SUB_VIEW[state];

  useEffect(() => {
    setState(readSubscribed());
  }, []);

  function remember() {
    try {
      localStorage.setItem(SUBSCRIBED_KEY, SUBSCRIBED_VALUE);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: a blocked storage write must not stop the navigation this click exists for
    } catch {}
    setState(SUBSCRIBE_STATE.Subscribed);
  }

  return (
    <Button
      as="a"
      href={props[view.hrefProp]}
      {...EXTERNAL_LINK_PROPS}
      size="lg"
      variant="primary"
      className="gap-[9px]"
      data-outbound={outboundId}
      onClick={remember}
    >
      <IconYouTube size={17} />
      <span
        className="links-cta-label"
        data-reserve={longestCopy([props.subscribeLabel, props.subscribedLabel])}
      >
        <span>{props[view.labelProp]}</span>
      </span>
      <NewTabHint text={newTabHint} />
    </Button>
  );
}
