import { hottestTakes, hottestTakesConfig } from '@/content/hottest-takes';
import { IconHottestTakes } from '../../Icons';
import { Module } from '../../responsive/Module';

export function HottestTakesSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-hottest-takes"
      header="CAT ~/HOTTEST_TAKES.MD"
      icon={<IconHottestTakes />}
      defer={defer}
    >
      <div className="text-primary-400 text-sm tracking-[0.06em] mb-[18px] pb-3 border-b border-dashed border-primary-quiet max-md:text-[11px]">
        <span className="text-primary-500 mr-1.5">$</span>
        {'cat ~/hottest_takes.md  '}
        <span style={{ color: 'var(--color-primary-300)' }}>{hottestTakesConfig.preamble}</span>
      </div>
      <ol className="list-none m-0 p-0" start={1} data-testid="hottest-takes-list">
        {hottestTakes.map((t) => (
          <li
            key={t.num}
            className="grid grid-cols-[44px_1fr] gap-2.5 py-[14px] border-b border-dashed border-primary-quiet last:border-b-0 last:pb-1 first:pt-1 max-[900px]:grid-cols-[36px_1fr] max-[900px]:gap-2 max-[768px]:grid-cols-[28px_1fr] max-[768px]:py-2.5"
          >
            <span className="text-primary-400 font-mono text-sm font-bold tracking-[0.04em] pt-0.5 max-md:text-[10px]">
              {t.num}
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="text-primary-500 font-bold tracking-[0.02em] m-0 leading-[1.5] max-md:text-xs">
                <span className="inline-block text-primary-400 border border-primary-quiet px-1.5 mr-2 text-xs tracking-[0.14em] align-[1px] font-medium bg-transparent max-md:text-[10px]">
                  {t.category}
                </span>
                {t.thesis}
              </p>
              <p className="text-tertiary-50 text-sm leading-[1.65] m-0 max-w-[740px] max-md:text-xs">
                {t.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="text-primary-500 font-bold text-xs tracking-[0.06em] mt-[14px] pt-3 border-t border-primary-quiet max-[768px]:text-xs">
        <span className="text-primary-500 mr-1.5">{'>'}</span>
        {hottestTakesConfig.footer}
      </div>
    </Module>
  );
}
