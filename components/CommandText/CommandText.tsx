import { Fragment } from 'react';

const WORD_BREAK = ' ';

export function CommandText({ children }: { children: string }) {
  return children.split(WORD_BREAK).map((word, position) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the words come from one fixed string and never reorder
    <Fragment key={position}>
      {position > 0 ? WORD_BREAK : null}
      <span className="cmd-word">{word}</span>
    </Fragment>
  ));
}
