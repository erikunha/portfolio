import { manPage } from '@/content/man-page';

// Desktop man-page: full pre with fixed-width columns. Plain RSC — rendered
// when ManPageContent detects a non-mobile UA via getIsMobile().
export function ManPageDesktop() {
  return (
    <div className="overflow-x-auto block">
      <pre className="m-0 font-mono text-sm max-md:text-xs leading-[1.65] text-tertiary-50 whitespace-pre">
        <span className="text-primary-500 font-bold tracking-[0.04em]">
          {`${manPage.name.toUpperCase()}(1)                    User Commands                    ${manPage.name.toUpperCase()}(1)`}
        </span>
        {'\n\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'NAME'}</span>
        {'\n       '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {` — ${manPage.tagline}\n\n`}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'SYNOPSIS'}</span>
        {'\n       '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {' ['}
        <span className="text-primary-400 opacity-70">{'--seniority'}</span>
        {' SENIOR|STAFF|PRINCIPAL]\n            ['}
        <span className="text-primary-400 opacity-70">{'--track'}</span>
        {' IC|LEAD]\n            ['}
        <span className="text-primary-400 opacity-70">{'--domain'}</span>
        {' FRONTEND|PAYMENTS|HEALTHCARE|AI-TOOLING]\n            ['}
        <span className="text-primary-400 opacity-70">{'--region'}</span>
        {' WORLDWIDE] ['}
        <span className="text-primary-400 opacity-70">{'--relocation'}</span>
        {']\n            ['}
        <span className="text-primary-400 opacity-70">{'--contract'}</span>
        {'|'}
        <span className="text-primary-400 opacity-70">{'--ft'}</span>
        {']\n            [<target-stack> ...]\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'DESCRIPTION'}</span>
        {'\n       '}
        {manPage.description}
        {'\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'OPTIONS'}</span>
        {'\n       '}
        <span className="text-primary-400 opacity-70">{'--seniority'}</span>
        {'    Senior → Staff/Principal\n       '}
        <span className="text-primary-400 opacity-70">{'--track'}</span>
        {'        Individual contributor or technical lead\n       '}
        <span className="text-primary-400 opacity-70">{'--domain'}</span>
        {
          '       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling); open to adjacent\n       '
        }
        <span className="text-primary-400 opacity-70">{'--region'}</span>
        {'       Worldwide; remote-first\n       '}
        <span className="text-primary-400 opacity-70">{'--relocation'}</span>
        {'   Open to relocating for the right role\n       '}
        <span className="text-primary-400 opacity-70">{'--regulated'}</span>
        {'    Specialty: PCI-DSS, healthcare, banking\n       '}
        <span className="text-primary-400 opacity-70">{'--contract'}</span>
        {'     Open to fixed-term or freelance\n       '}
        <span className="text-primary-400 opacity-70">{'--ft'}</span>
        {'           Open to full-time\n       '}
        <span className="text-primary-400 opacity-70">{'--hire'}</span>
        {'         Initiates handshake. See '}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'CONTACT'}</span>
        {'.\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'EXAMPLES'}</span>
        {'\n       '}
        <span className="text-primary-400">{'$'}</span>{' '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {' --seniority STAFF --domain FRONTEND --ft\n       '}
        <span className="text-primary-400">{'$'}</span>{' '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {
          ' --track LEAD --domain AI-TOOLING --stack "React, Node.js, TypeScript, agents, skills, MCPs, spec-driven" --ft\n       '
        }
        <span className="text-primary-400">{'$'}</span>{' '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation\n       '}
        <span className="text-primary-400">{'$'}</span>{' '}
        <span className="text-primary-500 font-bold">{manPage.name}</span>
        {' --contract --stack "React, Next.js, Angular, Node.js, TypeScript, AWS"\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'KNOWN BUGS'}</span>
        {`\n${manPage.knownBugs.map((b) => `       - ${b}`).join('\n')}\n\n`}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'AUTHOR'}</span>
        {'\n       Written by Erik Henrique Alves Cunha.\n       Report bugs to: '}
        <span className="text-primary-500 font-bold">{'erikhenriquealvescunha@gmail.com'}</span>
        {'\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.08em]">{'SEE ALSO'}</span>
        {'\n       cv(1), github(1), linkedin(1), calendar(1)\n\n\n'}
        <span className="text-primary-500 font-bold tracking-[0.04em]">
          {`${manPage.version}                       ${manPage.date}                       ${manPage.name.toUpperCase()}(1)`}
        </span>
      </pre>
    </div>
  );
}
