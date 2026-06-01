import { npmStack } from '@/content/npm-stack';
import { IconNpmStack } from '../../Icons';
import { Module } from '../../responsive/Module';

export function NpmStackSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-npm-stack"
      header="NPM LIST --GLOBAL"
      icon={<IconNpmStack />}
      defer={defer}
      variant="green"
    >
      {/* Mobile-first: 2-col → 4-col (≥341px) → 3-col (≥901px) → 8-col (≥1025px, flatter tiles) */}
      <ul
        className={[
          'npm-stack-grid list-none m-0 p-0',
          'grid grid-cols-2 min-[341px]:grid-cols-4 gap-2',
          'min-[901px]:grid-cols-3 min-[901px]:gap-[10px]',
          'lg:grid-cols-8',
        ].join(' ')}
      >
        {npmStack.map((t) => (
          <li
            key={t.label}
            className={[
              'npm-stack-item border border-primary-subtle',
              // Content-driven height (icon + label) sized by padding/gap — no
              // aspect-ratio. Tune the box via px/py + gap per breakpoint.
              'flex flex-col items-center justify-center',
              'gap-1.5 px-2 py-3 max-md:gap-1 max-md:px-1 max-md:py-2.5',
              'text-primary-500 text-xs max-md:text-[9px]',
              // Tighter tracking on mobile keeps two-word labels (MODULE FED) on
              // one line, so content-driven tile heights stay uniform per row.
              'tracking-[0.1em] max-md:tracking-[0.04em]',
              'transition-[border-color,box-shadow] duration-200 ease-[ease]',
              'hover:border-primary-500 hover:shadow-[0_0_14px_var(--color-glow-18)]',
              'motion-reduce:transition-none',
              '[body[data-motion=reduce]_&]:transition-none',
            ].join(' ')}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="w-[26px] h-[26px] fill-none stroke-primary-500 stroke-[1.5] opacity-85"
            >
              <path d={t.path} />
            </svg>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
    </Module>
  );
}
