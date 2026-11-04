import { homeTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import { IconHottestTakes } from '../../Icons';
import { Module } from '../../responsive/Module';
import { UnknownsSection } from '../UnknownsSection';

const TAKE_NUMBER_WIDTH = 2;
const TAKE_NUMBER_PAD = '0';

export function HottestTakesSection({
  locale,
  defer,
}: {
  locale: SiteLocale;
  defer?: boolean;
} = {}) {
  const { docsLink } = hottestTakesConfig[locale];
  return (
    <Module
      id="sec-hottest-takes"
      header={hottestTakesConfig[locale].header}
      name={SECTION_LABELS[locale]['sec-hottest-takes']}
      icon={<IconHottestTakes />}
      defer={defer}
    >
      <div className="opinions-preamble">
        <span aria-hidden>{'$'}</span> {hottestTakesConfig[locale].command}
        {'  '}
        <span className="opinions-comment">{hottestTakesConfig[locale].preamble}</span>
      </div>
      <ol className="opinions-list" data-testid="hottest-takes-list">
        {homeTakes(locale).map((take) => (
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
        {hottestTakesConfig[locale].footer}
      </div>
      <UnknownsSection locale={locale} />
      <a className="opinions-more" href={docsLink.href}>
        <span aria-hidden>{docsLink.marker}</span>
        <span>
          {docsLink.label} <span aria-hidden>{docsLink.arrow}</span>
        </span>
      </a>
    </Module>
  );
}
