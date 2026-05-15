
import { manPage } from '@/content/man-page';
import { IconManPage } from '../Icons';
import { Module } from '../responsive/Module';

export function ManPageSection() {
  return (
    <Module id="sec-man-page" header="MAN ERIK(1)" icon={<IconManPage />} defaultOpen={false}>
      <div className="manpage">
        <pre>
          <span className="m-head">{`${manPage.name.toUpperCase()}(1)                    User Commands                    ${manPage.name.toUpperCase()}(1)`}</span>
          {'\n\n\n'}
          <span className="m-sec">{'NAME'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {` \u2014 ${manPage.tagline}\n\n`}
          <span className="m-sec">{'SYNOPSIS'}</span>
          {'\n       '}
          <span className="m-erik">{manPage.name}</span>
          {' ['}
          <span className="m-dim">{'--seniority'}</span>
          {' SENIOR|STAFF|PRINCIPAL]\n            ['}
          <span className="m-dim">{'--track'}</span>
          {' IC|LEAD]\n            ['}
          <span className="m-dim">{'--domain'}</span>
          {' PAYMENTS|HEALTHCARE|AI-TOOLING|E-COMMERCE]\n            ['}
          <span className="m-dim">{'--region'}</span>
          {' WORLDWIDE] ['}
          <span className="m-dim">{'--relocation'}</span>
          {']\n            ['}
          <span className="m-dim">{'--contract'}</span>
          {'|'}
          <span className="m-dim">{'--ft'}</span>
          {']\n            [<target-stack> ...]\n\n'}
          <span className="m-sec">{'DESCRIPTION'}</span>
          {`\n       Senior software engineer, 8+ years. Started full-stack,
       evolved into frontend architecture. Shipped production
       systems across payments (PCI-DSS), healthcare, banking,
       e-commerce, and ed-tech — Angular, React/Next.js, and
       Stencil micro-frontends powering €1B+ in revenue.
       Ranges across web, mobile (Ionic), and desktop (Electron).
       Recently built a 12-agent AI engineering platform in
       production. Currently embedded at Betsson (Malta, EU).
       Senior/Staff/Principal track.\n\n`}
          <span className="m-sec">{'OPTIONS'}</span>
          {'\n       '}
          <span className="m-dim">{'--seniority'}</span>
          {'    Senior through Principal\n       '}
          <span className="m-dim">{'--track'}</span>
          {'        Individual contributor or technical lead\n       '}
          <span className="m-dim">{'--domain'}</span>
          {'       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling); open to adjacent\n       '}
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
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --seniority STAFF --domain PAYMENTS --ft\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --track LEAD --domain AI-TOOLING --ft\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --seniority PRINCIPAL --region WORLDWIDE --relocation\n       '}
          <span className="m-mute">{'$'}</span>
          {' '}
          <span className="m-erik">{manPage.name}</span>
          {' --contract --stack "TypeScript, micro-frontends, AI"\n\n'}
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
    </Module>
  );
}
