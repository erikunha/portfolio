import { unknowns } from '@/content/unknowns';
import { IconUnknowns } from '../Icons';
import { Module } from '../responsive/Module';

export function UnknownsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-unknowns"
      header="CAT ~/.UNKNOWNS"
      icon={<IconUnknowns />}
      defaultOpen={false}
      defer={defer}
    >
      <div className="unknowns">
        <pre>
          <span className="uk-cmd">
            <span className="gt">$</span>
            {' cat ~/.unknowns'}
          </span>
          {'\n\n'}
          <span className="uk-h">{"# things i'm actively learning"}</span>
          {'\n\n'}
          {unknowns.learning.map((item) => (
            <span key={item.claim}>
              <span className="uk-bul">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="uk-mute">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="uk-h">{"# things i've chosen not to specialize in (yet)"}</span>
          {'\n\n'}
          {unknowns.notSpecializing.map((item) => (
            <span key={item.claim}>
              <span className="uk-bul">{'-'}</span>
              {` ${item.claim}\n`}
              <span className="uk-mute">{`  (${item.context})`}</span>
              {'\n\n'}
            </span>
          ))}
          <span className="uk-open">{unknowns.footer}</span>
        </pre>
      </div>
    </Module>
  );
}
