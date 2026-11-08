'use client';

import { linksUi } from '@/content/links-ui';
import { COPY_STATUS, type CopyStatus, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { LineContent } from '../LineContent';
import { IconCopy } from '../LinkIcons';

type CopyLabels = {
  idleLabel: string;
  doneLabel: string;
  failedLabel: string;
  failedMessage: string;
};

type CopyView = {
  shown: keyof Omit<CopyLabels, 'failedMessage'>;
  spoken: keyof CopyLabels;
  prompt: string;
};

const IDLE_VIEW: CopyView = { shown: 'idleLabel', spoken: 'idleLabel', prompt: '' };
const DONE_VIEW: CopyView = {
  shown: 'doneLabel',
  spoken: 'doneLabel',
  prompt: linksUi.prompt,
};
const FAILED_VIEW: CopyView = {
  shown: 'failedLabel',
  spoken: 'failedMessage',
  prompt: linksUi.prompt,
};

const COPY_VIEW: Record<CopyStatus, CopyView> = {
  [COPY_STATUS.Idle]: IDLE_VIEW,
  [COPY_STATUS.Pending]: IDLE_VIEW,
  [COPY_STATUS.Copied]: DONE_VIEW,
  [COPY_STATUS.Failed]: FAILED_VIEW,
  [COPY_STATUS.Unavailable]: FAILED_VIEW,
};

export type CopyLinkButtonProps = CopyLabels & {
  url: string;
  hostLabel: string;
};

export function CopyLinkButton({ url, hostLabel, ...labels }: CopyLinkButtonProps) {
  const { status, copy } = useCopyFeedback({ resetOnFailure: true });
  const view = COPY_VIEW[status];

  return (
    <>
      <button type="button" onClick={() => void copy(url)} className="links-line">
        <LineContent
          glyph={<IconCopy />}
          label={`${view.prompt}${labels[view.shown]}`}
          host={hostLabel}
          arrow={linksUi.copyGlyph}
        />
      </button>
      <span className="sr-only" role="status">
        {labels[view.spoken]}
      </span>
    </>
  );
}
