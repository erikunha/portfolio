import { manPage } from '@/content/man-page';
import { IconManPage } from '../Icons';
import { Module } from '../responsive/Module';

export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />} defaultOpen={false}>
      {/* Desktop: full pre with fixed-width columns */}
      <div className="manpage manpage--desktop">
        <pre>
          <span className="m-head">{`${manPage.name.toUpperCase()}(1)                    User Commands                    ${manPage.name.toUpperCase()}(1)`}</span>
          {'\n\n\n'}
          <span className="m-sec">{'NAME'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {` — ${manPage.tagline}\n\n`}
          <span className="m-sec">{'SYNOPSIS'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {' ['}
          <span className="m-dim">{'--seniority'}</span>
          {' SENIOR|STAFF|PRINCIPAL]\n            ['}
          <span className="m-dim">{'--track'}</span>
          {' IC|LEAD]\n            ['}
          <span className="m-dim">{'--domain'}</span>
          {' FRONTEND|PAYMENTS|HEALTHCARE|AI-TOOLING]\n            ['}
          <span className="m-dim">{'--region'}</span>
          {' WORLDWIDE] ['}
          <span className="m-dim">{'--relocation'}</span>
          {']\n            ['}
          <span className="m-dim">{'--contract'}</span>
          {'|'}
          <span className="m-dim">{'--ft'}</span>
          {']\n            [<target-stack> ...]\n\n'}
          <span className="m-sec">{'DESCRIPTION'}</span>
          {'\n       '}
          {manPage.description}
          {'\n\n'}
          <span className="m-sec">{'OPTIONS'}</span>
          {'\n       '}
          <span className="m-dim">{'--seniority'}</span>
          {'    Senior → Staff/Principal\n       '}
          <span className="m-dim">{'--track'}</span>
          {'        Individual contributor or technical lead\n       '}
          <span className="m-dim">{'--domain'}</span>
          {
            '       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling); open to adjacent\n       '
          }
          <span className="m-dim">{'--region'}</span>
          {'       Worldwide; remote-first\n       '}
          <span className="m-dim">{'--relocation'}</span>
          {'   Open to relocating for the right role\n       '}
          <span className="m-dim">{'--regulated'}</span>
          {'    Specialty: PCI-DSS, healthcare, banking\n       '}
          <span className="m-dim">{'--contract'}</span>
          {'     Open to fixed-term or freelance\n       '}
          <span className="m-dim">{'--ft'}</span>
          {'           Open to full-time\n       '}
          <span className="m-dim">{'--hire'}</span>
          {'         Initiates handshake. See '}
          <span className="m-sec">{'CONTACT'}</span>
          {'.\n\n'}
          <span className="m-sec">{'EXAMPLES'}</span>
          {'\n       '}
          <span className="m-mute">{'$'}</span> <span className="m-erik">{manPage.name}</span>
          {' --seniority STAFF --domain FRONTEND --ft\n       '}
          <span className="m-mute">{'$'}</span> <span className="m-erik">{manPage.name}</span>
          {' --track LEAD --domain AI-TOOLING --stack "Angular, LLM, RAG" --ft\n       '}
          <span className="m-mute">{'$'}</span> <span className="m-erik">{manPage.name}</span>
          {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation\n       '}
          <span className="m-mute">{'$'}</span> <span className="m-erik">{manPage.name}</span>
          {' --contract --regulated --stack "Angular, React, TypeScript"\n\n'}
          <span className="m-sec">{'KNOWN BUGS'}</span>
          {`\n       - Occasionally rewrites a working component for clarity.
       - Will not stop talking about bundle size.
       - Sometimes ships the test before the feature.\n\n`}
          <span className="m-sec">{'AUTHOR'}</span>
          {'\n       Written by Erik Henrique Alves Cunha.\n       Report bugs to: '}
          <span className="m-erik">{'erikhenriquealvescunha@gmail.com'}</span>
          {'\n\n'}
          <span className="m-sec">{'SEE ALSO'}</span>
          {'\n       cv(1), github(1), linkedin(1), calendar(1)\n\n\n'}
          <span className="m-head">{`${manPage.version}                       ${manPage.date}                       ${manPage.name.toUpperCase()}(1)`}</span>
        </pre>
      </div>

      {/* Mobile: semantic layout — avoids pre-wrap column fighting */}
      <div className="manpage--mobile">
        <span className="mp-head">{`${manPage.name.toUpperCase()}(1) - User Commands`}</span>

        <span className="mp-sec">NAME</span>
        <span className="mp-body">
          <span className="mp-name">{manPage.name}</span>
          {` — ${manPage.tagline}`}
        </span>

        <span className="mp-sec">DESCRIPTION</span>
        <span className="mp-body">{manPage.description}</span>

        <span className="mp-sec">OPTIONS</span>
        <div className="mp-opts">
          {manPage.options.flatMap((opt) => [
            <span key={`f-${opt.flag}`} className="mp-flag">
              {opt.flag}
            </span>,
            <span key={`d-${opt.flag}`} className="mp-desc">
              {opt.desc}
            </span>,
          ])}
        </div>

        <span className="mp-sec">EXAMPLES</span>
        <div className="mp-examples">
          <span className="mp-ex-line">
            <span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>
            {' --seniority STAFF --domain FRONTEND --ft'}
          </span>
          <span className="mp-ex-line">
            <span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>
            {' --track LEAD --domain AI-TOOLING --stack "Angular, LLM" --ft'}
          </span>
          <span className="mp-ex-line">
            <span className="mp-mute">$</span> <span className="mp-name">{manPage.name}</span>
            {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation'}
          </span>
        </div>

        <span className="mp-sec">KNOWN BUGS</span>
        <span className="mp-bugs">{manPage.knownBugs.map((b) => `- ${b}`).join('\n')}</span>

        <span className="mp-sec">AUTHOR</span>
        <span className="mp-body">{'Written by Erik Henrique Alves Cunha.'}</span>
      </div>
    </Module>
  );
}
