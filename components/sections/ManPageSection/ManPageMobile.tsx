import { manPage } from '@/content/man-page';

export function ManPageMobile() {
  return (
    <div
      id="sec-man-page-body"
      className="flex font-mono text-sm max-md:text-xs leading-[1.7] text-tertiary-50 flex-col gap-0.5"
      data-testid="manpage-mobile"
    >
      <span className="text-primary-500 font-bold tracking-[0.04em] text-xs mb-2.5 break-all">
        {`${manPage.name.toUpperCase()}(1) - User Commands`}
      </span>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">NAME</span>
      <span className="text-tertiary-50 whitespace-pre-wrap break-words text-xs leading-[1.6]">
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {` — ${manPage.tagline}`}
      </span>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">DESCRIPTION</span>
      <span className="text-tertiary-50 whitespace-pre-wrap break-words text-xs leading-[1.6]">
        {manPage.description}
      </span>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">OPTIONS</span>
      <div className="grid grid-cols-[108px_1fr] gap-x-2 gap-y-px mt-0.5">
        {manPage.options.flatMap((opt) => [
          <span
            key={`f-${opt.flag}`}
            className="text-primary-400 opacity-85 text-xs py-px whitespace-nowrap"
          >
            {opt.flag}
          </span>,
          <span key={`d-${opt.flag}`} className="text-tertiary-50 text-xs py-px leading-[1.5]">
            {opt.desc}
          </span>,
        ])}
      </div>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">EXAMPLES</span>
      <div className="flex flex-col gap-0.5 mt-0.5">
        <span className="block text-tertiary-50 text-xs whitespace-pre-wrap break-all">
          <span className="text-primary-400">$</span>{' '}
          <span className="text-primary-500 font-bold">{manPage.name}</span>
          {' --seniority STAFF --domain FRONTEND --ft'}
        </span>
        <span className="block text-tertiary-50 text-xs whitespace-pre-wrap break-all">
          <span className="text-primary-400">$</span>{' '}
          <span className="text-primary-500 font-bold">{manPage.name}</span>
          {
            ' --track LEAD --domain AI-TOOLING --stack "React, Node.js, TypeScript, agents, skills, MCPs, spec-driven" --ft'
          }
        </span>
        <span className="block text-tertiary-50 text-xs whitespace-pre-wrap break-all">
          <span className="text-primary-400">$</span>{' '}
          <span className="text-primary-500 font-bold">{manPage.name}</span>
          {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation'}
        </span>
      </div>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">KNOWN BUGS</span>
      <span className="text-tertiary-50 text-xs whitespace-pre-wrap break-words leading-[1.6]">
        {manPage.knownBugs.map((b) => `- ${b}`).join('\n')}
      </span>

      <span className="text-primary-500 font-bold tracking-[0.08em] mt-3 mb-1">AUTHOR</span>
      <span className="text-tertiary-50 whitespace-pre-wrap break-words text-xs leading-[1.6]">
        {'Written by Erik Henrique Alves Cunha.'}
      </span>
    </div>
  );
}
