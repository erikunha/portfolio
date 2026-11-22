import { splitPeriods, splitTail } from '@/lib/keep-tail';

const SPACE = ' ';

function Tail({ children }: { children: string }) {
  const { head, tail } = splitTail(children);
  if (tail === '') return children;
  return (
    <>
      {head === '' ? null : `${head}${SPACE}`}
      <span className="keep-together">{tail}</span>
    </>
  );
}

export function KeepTail({ children }: { children: string }) {
  const spans = splitPeriods(children);
  const last = spans.at(-1);
  if (!spans.some((span) => span.period) || last === undefined) return <Tail>{children}</Tail>;
  return (
    <>
      {spans.map((span, index) => {
        const key = `${index}-${span.text}`;
        if (span.period)
          return (
            <span key={key} className="keep-together">
              {span.text}
            </span>
          );
        return span === last ? <Tail key={key}>{span.text}</Tail> : span.text;
      })}
    </>
  );
}
