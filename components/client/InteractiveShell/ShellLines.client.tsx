'use client';

import { useEffect, useState } from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, SHELL_STATE_TOKEN, ShellLineKind, type ShellUi } from '@/content/shell-ui';
import { asciiBar } from '@/lib/ascii-bar';
import { MS_PER_SECOND } from '@/lib/time';
import { ConversationReceipt } from './ConversationReceipt.client';
import { ShellEmail } from './ShellEmail';
import { formatRemaining, type Line, type LineKind } from './useAskStream';
import { useElapsedSeconds } from './useElapsed.client';

const KIND_CLASS: Record<LineKind, string> = {
  [ShellLineKind.Prompt]: 'shell-line-prompt',
  [ShellLineKind.Output]: 'shell-line-output',
  [ShellLineKind.Error]: 'shell-line-error',
  [ShellLineKind.Info]: 'shell-line-info',
  [ShellLineKind.Loading]: 'shell-line-loading',
  [ShellLineKind.Reference]: 'shell-line-reference',
  [ShellLineKind.Hint]: 'shell-line-hint',
  [ShellLineKind.RateLimit]: 'shell-line-ratelimit',
};
const COUNTDOWN_TICK_MS = MS_PER_SECOND;

export function ThinkingLine({ template }: { template: string }) {
  return fillShellState(template, { seconds: useElapsedSeconds() });
}

export function StopElapsed({ template }: { template: string }) {
  const seconds = useElapsedSeconds();
  const [before, after = ''] = template.split(SHELL_STATE_TOKEN.seconds);
  return (
    <>
      {before}
      <span className="shell-stop-time">{seconds}</span>
      {after}
    </>
  );
}

export function LineText({ text, ui }: { text: string; ui: ShellUi }) {
  const at = text.indexOf(ui.email);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <ShellEmail ui={ui} />
      {text.slice(at + ui.email.length)}
    </>
  );
}

export function RateLimitCountdown({
  seconds,
  announcement,
  states,
}: {
  seconds: number;
  announcement: string;
  states: ShellStates;
}) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const deadline = Date.now() + seconds * MS_PER_SECOND;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / MS_PER_SECOND));
      setRemaining(left);
      if (left === 0) clearInterval(id);
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [seconds]);
  const headline =
    remaining === 0
      ? states.rateLimitReady
      : fillShellState(states.slowDown, { left: formatRemaining(remaining, states) });
  return (
    <>
      <span className="sr-only">{announcement}</span>
      <span aria-hidden="true">
        <strong className="shell-ratelimit-headline">{headline}</strong>
        <span className="shell-ratelimit-bar">[{asciiBar(1 - remaining / seconds)}]</span>
        <span>{states.localCommands}</span>
      </span>
    </>
  );
}

type ShellLineProps = {
  line: Line;
  ui: ShellUi;
  states: ShellStates;
  isMobile: boolean;
  announce: (text: string) => void;
  onRetry: (command: string) => void;
  busy: boolean;
  onConversationForgotten: (questions: number) => void;
};

function ShellLineBody({
  line,
  ui,
  states,
  isMobile,
  announce,
  onRetry,
  busy,
  onConversationForgotten,
}: ShellLineProps) {
  if (line.kind === ShellLineKind.Reference) {
    return (
      <ConversationReceipt
        ui={ui}
        states={states}
        requestId={line.text}
        busy={busy}
        announce={announce}
        onForgotten={onConversationForgotten}
      />
    );
  }
  if (line.kind === ShellLineKind.RateLimit && line.retryAfter) {
    return (
      <RateLimitCountdown seconds={line.retryAfter} announcement={line.text} states={states} />
    );
  }
  if (line.kind === ShellLineKind.Hint) {
    return (
      <>
        {states.tryPrefix} <code>{states.tryCommand}</code> {states.trySuffix}{' '}
        <ShellEmail ui={ui} />
      </>
    );
  }
  return (
    <>
      {line.ai ? <span className="shell-ai-label">{ui.aiLabel}: </span> : null}
      {line.prefix ? <strong className="shell-stderr-command">{line.prefix}</strong> : null}
      {line.prefix ? ' ' : null}
      <LineText text={line.welcome && isMobile ? ui.mobileWelcome : line.text} ui={ui} />
      {line.retry ? (
        <>
          {' '}
          <button
            type="button"
            className="shell-control"
            aria-label={states.retryLabel}
            onClick={() => onRetry(line.retry ?? '')}
          >
            {states.retry}
          </button>
        </>
      ) : null}
    </>
  );
}

export function ShellLine(props: ShellLineProps) {
  const { line, states } = props;
  if (line.kind === ShellLineKind.Loading) {
    return (
      <span
        className="shell-line shell-line-loading"
        aria-hidden="true"
        data-testid="shell-line-loading"
      >
        <span className="shell-stream-meta">
          <ThinkingLine template={states.thinkingElapsed} />
        </span>
      </span>
    );
  }
  return (
    <span className={`shell-line ${KIND_CLASS[line.kind]}`} data-kind={line.kind} lang={line.lang}>
      <ShellLineBody {...props} />
    </span>
  );
}
