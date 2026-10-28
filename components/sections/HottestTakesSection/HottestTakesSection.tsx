import { homeTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconHottestTakes } from '../../Icons';
import { Module } from '../../responsive/Module';
import { UnknownsSection } from '../UnknownsSection';

const TAKE_NUMBER_WIDTH = 2;
const TAKE_NUMBER_PAD = '0';

export function HottestTakesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-hottest-takes"
      header={hottestTakesConfig.header}
      name={SECTION_LABELS['sec-hottest-takes']}
      icon={<IconHottestTakes />}
      defer={defer}
    >
      <div className="opinions-preamble">
        <span aria-hidden>{'$'}</span> {hottestTakesConfig.command}
        {'  '}
        <span className="opinions-comment">{hottestTakesConfig.preamble}</span>
      </div>
      <ol className="opinions-list" data-testid="hottest-takes-list">
        {homeTakes.map((take) => (
          <li key={take.num}>
            <span className="opinions-number" aria-hidden>
              {String(take.order).padStart(TAKE_NUMBER_WIDTH, TAKE_NUMBER_PAD)}.
            </span>
            <div className="opinions-take">
              <h3>
                <span>{take.category}</span>
                {take.thesis}
              </h3>
              <p>{take.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="opinions-footer">
        <span aria-hidden>{'>'}</span>
        {hottestTakesConfig.footer}
      </div>
      <UnknownsSection />
    </Module>
  );
}
