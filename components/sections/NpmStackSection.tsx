import { npmStack } from '@/content/npm-stack';
import { IconNpmStack } from '../Icons';
import { Module } from '../responsive/Module';

export function NpmStackSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-npm-stack" header="NPM LIST --GLOBAL" icon={<IconNpmStack />} defer={defer}>
      <ul className="npm-stack">
        {npmStack.map((t) => (
          <li key={t.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.path} />
            </svg>
            <span>{t.label}</span>
          </li>
        ))}
      </ul>
    </Module>
  );
}
