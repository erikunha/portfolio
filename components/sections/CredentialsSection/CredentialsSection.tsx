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
        <div className="flex flex-col gap-1 mt-[0.5em] font-mono text-sm max-[768px]:gap-3">
          {credentials.map((cred) => (
            <div
              key={cred.label}
              className="flex items-baseline max-[768px]:flex-col max-[768px]:gap-0.5"
            >
              {/* 14ch wide label, auto on mobile */}
              <span className="w-[14ch] shrink-0 text-text-body font-bold tracking-[0.04em] max-[768px]:w-auto">
                {cred.label}
              </span>
              {/* 25ch wide badge, auto on mobile */}
              <span className="w-[25ch] shrink-0 text-signal font-bold max-[768px]:w-auto">
                {cred.badge}
              </span>
              <span className="flex-1 text-text-body max-[768px]:text-text-muted max-[768px]:text-xs">
                {cred.evidence}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Module>
  );
}
