
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
          {`\n       Senior frontend engineer, 8+ years. Started full-stack,
       evolved into frontend architecture. Shipped production
       systems across payments (PCI-DSS), healthcare, banking,
       e-commerce, and ed-tech — Angular, React/Next.js, and
       Stencil micro-frontends powering €1B+ in revenue.
       Ranges across web, mobile (Ionic), and desktop (Electron).
       Recently built a 12-agent AI engineering platform in
       production. Currently embedded at Betsson (Malta, EU).\n\n`}
          <span className="m-sec">{'OPTIONS'}</span>
          {'\n       '}
          <span className="m-dim">{'--seniority'}</span>
          {'    Senior → Staff/Principal\n       '}
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

      {/* Mobile: semantic layout — avoids pre-wrap column fighting */}
      <div className="manpage--mobile">
        <span className="mp-head">{`${manPage.name.toUpperCase()}(1) — User Commands`}</span>

        <span className="mp-sec">NAME</span>
        <span className="mp-body">
          <span className="mp-name">{manPage.name}</span>
          {` — ${manPage.tagline}`}
        </span>

        <span className="mp-sec">DESCRIPTION</span>
        <span className="mp-body">{'Senior frontend engineer, 8+ years. Shipped production systems across payments (PCI-DSS), healthcare, e-commerce, and ed-tech. Angular, React/Next.js, Stencil micro-frontends powering €1B+ in revenue. 12-agent AI platform in production. Currently at Betsson (Malta, EU).'}</span>

        <span className="mp-sec">OPTIONS</span>
        <div className="mp-opts">
          <span className="mp-flag">--seniority</span>
          <span className="mp-desc">Senior → Staff/Principal</span>
          <span className="mp-flag">--track</span>
          <span className="mp-desc">IC or technical lead</span>
          <span className="mp-flag">--domain</span>
          <span className="mp-desc">Payments, healthcare, AI tooling</span>
          <span className="mp-flag">--region</span>
          <span className="mp-desc">Worldwide; remote-first</span>
          <span className="mp-flag">--relocation</span>
          <span className="mp-desc">Open to relocating</span>
          <span className="mp-flag">--regulated</span>
          <span className="mp-desc">PCI-DSS, healthcare, banking</span>
          <span className="mp-flag">--contract</span>
          <span className="mp-desc">Fixed-term or freelance</span>
          <span className="mp-flag">--ft</span>
          <span className="mp-desc">Full-time</span>
          <span className="mp-flag">--hire</span>
          <span className="mp-desc">Initiates handshake. See CONTACT.</span>
        </div>

        <span className="mp-sec">EXAMPLES</span>
        <div className="mp-examples">
          <span className="mp-ex-line"><span className="mp-mute">$</span>{' '}<span className="mp-name">{manPage.name}</span>{' --seniority STAFF --domain PAYMENTS --ft'}</span>
          <span className="mp-ex-line"><span className="mp-mute">$</span>{' '}<span className="mp-name">{manPage.name}</span>{' --track LEAD --domain AI-TOOLING --ft'}</span>
          <span className="mp-ex-line"><span className="mp-mute">$</span>{' '}<span className="mp-name">{manPage.name}</span>{' --seniority PRINCIPAL --region WORLDWIDE --relocation'}</span>
        </div>

        <span className="mp-sec">KNOWN BUGS</span>
        <span className="mp-bugs">{'- Occasionally rewrites a working component for clarity.\n- Will not stop talking about bundle size.\n- Sometimes ships the test before the feature.'}</span>

        <span className="mp-sec">AUTHOR</span>
        <span className="mp-body">{'Written by Erik Henrique Alves Cunha.'}</span>
      </div>
    </Module>
  );
}
