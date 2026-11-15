'use client';

import { useState, useSyncExternalStore } from 'react';
import type { ContactContent } from '@/content/contact';
import { messageStore } from '../ContactForm/messageStore';

type TimezoneCopy = ContactContent['timezone'];

export type ProposeSlotTimes = { you: string; erik: string };

export function ProposeSlot({
  copy,
  slot,
  slotLine,
}: {
  copy: TimezoneCopy;
  slot: ProposeSlotTimes | null;
  slotLine: string | null;
}) {
  const [proposedLine, setProposedLine] = useState<string | null>(null);

  const lineInMessage = useSyncExternalStore(
    messageStore.subscribe,
    () => proposedLine !== null && messageStore.getSnapshot().includes(proposedLine),
    () => false,
  );
  const added = slotLine !== null && proposedLine === slotLine && lineInMessage;
  const messageFieldId = useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getFieldId,
    () => null,
  );

  function propose() {
    if (!slotLine) return;
    messageStore.append(slotLine);
    setProposedLine(slotLine);
  }

  return (
    <div className="ctz-slot" data-testid="ctz-slot">
      <div className="ctz-slot-body">
        <p className="ctz-slot-title">{copy.slot.title}</p>
        {slot ? (
          <p className="ctz-slot-times">
            <span data-testid="ctz-slot-you">{slot.you}</span>{' '}
            <span className="ctz-slot-who">{copy.slot.you}</span>
            {copy.slot.separator}
            <span className="ctz-slot-erik" data-testid="ctz-slot-erik">
              {slot.erik}
            </span>{' '}
            <span className="ctz-slot-who">{copy.slot.erik}</span>
          </p>
        ) : (
          <p className="ctz-slot-none">{copy.slot.none}</p>
        )}
        <div className="ctz-proposed-row">
          <p className="ctz-proposed" role="status">
            {added ? <span data-testid="ctz-proposed">{copy.propose.added}</span> : null}
          </p>
          {added && messageFieldId ? (
            <a
              className="ctz-proposed-link"
              href={`#${messageFieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(messageFieldId)?.focus();
              }}
            >
              {copy.propose.focusLink}
            </a>
          ) : null}
        </div>
      </div>
      {slotLine ? (
        <button type="button" className="ctz-propose" onClick={propose}>
          {copy.propose.label}
        </button>
      ) : null}
    </div>
  );
}
