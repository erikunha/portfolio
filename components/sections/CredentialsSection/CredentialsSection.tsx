import { credentials } from '@/content/credentials';
import { IconCredentials } from '../../Icons';
import { Module } from '../../responsive/Module';

export function CredentialsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-credentials"
      header="CAT ~/.CREDENTIALS"
      icon={<IconCredentials />}
      defer={defer}
    >
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-1 mt-[0.5em] font-mono text-sm max-md:text-xs max-[768px]:gap-3">
          {credentials.map((cred) => (
            <div
              key={cred.label}
              className="flex items-baseline max-[768px]:flex-col max-[768px]:gap-0.5"
            >
              {/* 14ch wide label, auto on mobile */}
              <span className="w-[14ch] shrink-0 text-tertiary-50 font-bold tracking-[0.04em] max-[768px]:w-auto">
                {cred.label}
              </span>
              {/* 25ch wide badge, auto on mobile */}
              <span className="w-[25ch] shrink-0 text-primary-500 font-bold max-[768px]:w-auto">
                {cred.badge}
              </span>
              <span className="flex-1 text-tertiary-50 max-[768px]:text-primary-400 max-md:text-[10px]">
                {cred.evidence}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Module>
  );
}
