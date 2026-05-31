import { communityEvent } from '@/content/community';
import { IconCommunity } from '../../Icons';
import { Module } from '../../responsive/Module';

export function CommunitySection({ defer }: { defer?: boolean } = {}) {
  const e = communityEvent;
  return (
    <Module id="sec-community" header="CAT ~/.COMMUNITY" icon={<IconCommunity />} defer={defer}>
      <div className="text-sm leading-[1.7]">
        <div className="text-signal font-bold tracking-[0.06em] text-sm mb-3">
          {e.name} · {e.year} · {e.role}
        </div>
        <ul className="list-none ml-1 p-0 mb-0">
          {e.bullets.map((b) => (
            <li
              key={b}
              className="text-text-body pl-[18px] relative mb-1 before:content-['-'] before:text-signal before:absolute before:left-1 before:top-0"
            >
              {b}
            </li>
          ))}
        </ul>
        <div className="text-signal font-bold text-xs mt-[14px] border-t border-dashed border-signal-quiet pt-3">
          <span className="text-signal mr-1.5">{'>'}</span>status: {e.statusLine}
        </div>
      </div>
    </Module>
  );
}
