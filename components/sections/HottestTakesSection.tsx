import { hottestTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { IconHottestTakes } from '../Icons';
import { Module } from '../responsive/Module';

export function HottestTakesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-hottest-takes"
      header="CAT ~/HOTTEST_TAKES.MD"
      icon={<IconHottestTakes />}
      defaultOpen={false}
      defer={defer}
    >
      <div className="takes__preamble">
        <span className="gt">$</span>
        {'cat ~/hottest_takes.md  '}
        <span style={{ opacity: 0.55 }}>{hottestTakesConfig.preamble}</span>
      </div>
      <ol className="takes" start={1}>
        {hottestTakes.map((t) => (
          <li key={t.num} className="take">
            <span className="take__num">{t.num}</span>
            <div className="take__content">
              <p className="take__thesis">
                <span className="take__category">{t.category}</span>
                {t.thesis}
              </p>
              <p className="take__body">{t.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="takes__footer">
        <span className="gt">{'>'}</span>
        {hottestTakesConfig.footer}
      </div>
    </Module>
  );
}
