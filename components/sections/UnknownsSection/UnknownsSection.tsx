import { unknowns } from '@/content/unknowns';
import { IconUnknowns } from '../../Icons';
import { Module } from '../../responsive/Module';

export function UnknownsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-unknowns" header="CAT ~/.UNKNOWNS" icon={<IconUnknowns />} defer={defer}>
      <div>
        <pre className="m-0 font-mono text-sm max-md:text-xs leading-[1.75] text-tertiary-50 whitespace-pre-wrap max-[768px]:whitespace-pre-wrap max-[768px]:break-words">
          <span className="text-primary-400 tracking-[0.02em]">
            {"# things i'm actively learning"}
          </span>
          {'\n\n'}
          {unknowns.learning.map((item) => (
            <span key={item.claim}>
              <span className="text-primary-500">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="text-primary-400 opacity-85">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="text-primary-400 tracking-[0.02em]">
            {"# things i've chosen not to specialize in (yet)"}
          </span>
          {'\n\n'}
          {unknowns.notSpecializing.map((item) => (
            <span key={item.claim}>
              <span className="text-primary-500">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="text-primary-400 opacity-85">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="text-primary-500 font-bold max-[768px]:text-xs">{unknowns.footer}</span>
        </pre>
      </div>
    </Module>
  );
}
