import { Fragment } from 'react';

export const BREAK_AFTER = {
  email: '@',
  host: '/.',
  identifier: '_',
  dottedIdentifier: '_.',
} as const;

type BreakAfterProps = {
  chars: string;
  children: string;
};

export function BreakAfter({ chars, children }: BreakAfterProps) {
  const pieces: { start: number; text: string; breaks: boolean }[] = [];
  let start = 0;
  const lastIndex = children.length - 1;
  for (let position = 0; position < lastIndex; position += 1) {
    if (chars.includes(children.charAt(position))) {
      pieces.push({ start, text: children.slice(start, position + 1), breaks: true });
      start = position + 1;
    }
  }
  pieces.push({ start, text: children.slice(start), breaks: false });
  return pieces.map(({ start: offset, text, breaks }) => (
    <Fragment key={offset}>
      {text}
      {breaks ? <wbr /> : null}
    </Fragment>
  ));
}
