import { Fragment } from 'react';

export const BREAK_AFTER = {
  email: '@',
  host: '/.',
  identifier: '_',
  dottedIdentifier: '_.',
  code: '_./:[>',
} as const;

const TEXT_RUNS = /\s+|\S+/g;
const NON_SPACE = /\S/;

type BreakAfterProps = {
  chars: string;
  children: string;
  pieceClassName?: string;
};

type Segment = { start: number; text: string; solid: boolean; breaks: boolean };

export function BreakAfter({ chars, children, pieceClassName }: BreakAfterProps) {
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
  const segments: Segment[] = pieces.flatMap((piece) => {
    const runs = [...piece.text.matchAll(TEXT_RUNS)];
    return runs.map((run, index) => ({
      start: piece.start + (run.index ?? 0),
      text: run[0],
      solid: NON_SPACE.test(run[0]),
      breaks: piece.breaks && index === runs.length - 1,
    }));
  });
  return (
    <span>
      {segments.map(({ start: offset, text, solid, breaks }) => (
        <Fragment key={offset}>
          {pieceClassName !== undefined && solid ? (
            <span className={pieceClassName}>{text}</span>
          ) : (
            text
          )}
          {breaks ? <wbr /> : null}
        </Fragment>
      ))}
    </span>
  );
}
