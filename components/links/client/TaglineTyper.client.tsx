'use client';

import { useEffect, useRef } from 'react';
import { splitTail } from '@/lib/keep-tail';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';

const TYPE_MS = 70;
const HOLD_MS = 1_540;
const BACK_MS = 40;
const INTER_MS = 280;
const ACCESSIBLE_SEPARATOR = ' · ';
const SPACE = ' ';

function leadingText(phrase: string): string {
  const { head, tail } = splitTail(phrase);
  if (tail === '') return phrase;
  return head === '' ? '' : `${head}${SPACE}`;
}

function write(lead: HTMLElement, tail: HTMLElement, phrase: string, chars: number) {
  const shown = phrase.slice(0, Math.max(chars, 0));
  const leadLength = leadingText(phrase).length;
  lead.textContent = shown.slice(0, leadLength);
  tail.textContent = shown.slice(leadLength);
}

export function TaglineTyper({ phrases }: { phrases: readonly string[] }) {
  const leadRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const first = phrases[0] ?? '';
  const firstLead = leadingText(first);

  useEffect(() => {
    const leadEl = leadRef.current;
    const tailEl = tailRef.current;
    if (!leadEl || !tailEl || phrases.length === 0) return;
    const leadNode: HTMLSpanElement = leadEl;
    const tailNode: HTMLSpanElement = tailEl;
    const firstPhrase = phrases[0] ?? '';

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';

    function tick() {
      if (cancelled) return;
      const phrase = phrases[phraseIdx % phrases.length] ?? '';
      if (phase === 'type') {
        charIdx++;
        write(leadNode, tailNode, phrase, charIdx);
        if (charIdx >= phrase.length) {
          phase = 'hold';
          timerId = setTimeout(tick, HOLD_MS);
        } else {
          timerId = setTimeout(tick, TYPE_MS);
        }
      } else if (phase === 'hold') {
        phase = 'back';
        timerId = setTimeout(tick, BACK_MS);
      } else {
        charIdx--;
        write(leadNode, tailNode, phrase, charIdx);
        if (charIdx <= 0) {
          phraseIdx++;
          charIdx = 0;
          phase = 'type';
          timerId = setTimeout(tick, INTER_MS);
        } else {
          timerId = setTimeout(tick, BACK_MS);
        }
      }
    }

    function start() {
      charIdx = 0;
      phase = 'type';
      write(leadNode, tailNode, firstPhrase, 0);
      tick();
    }

    if (readMotion()) start();

    const unsubscribe = subscribeMotion((on) => {
      clearTimeout(timerId);
      if (on) {
        cancelled = false;
        start();
        return;
      }
      cancelled = true;
      write(leadNode, tailNode, firstPhrase, firstPhrase.length);
    });

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      unsubscribe();
    };
  }, [phrases]);

  return (
    <>
      <span aria-hidden="true">
        <span ref={leadRef}>{firstLead}</span>
        <span ref={tailRef} className="keep-together">
          {first.slice(firstLead.length)}
        </span>
      </span>
      <span className="sr-only">{phrases.join(ACCESSIBLE_SEPARATOR)}</span>
    </>
  );
}
