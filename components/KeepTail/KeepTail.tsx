import { splitTail } from '@/lib/keep-tail';

const SPACE = ' ';

export function KeepTail({ children }: { children: string }) {
  const { head, tail } = splitTail(children);
  if (tail === '') return children;
  return (
    <>
      {head === '' ? null : `${head}${SPACE}`}
      <span className="keep-together">{tail}</span>
    </>
  );
}
