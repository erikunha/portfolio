import { manPage } from '@/content/man-page';

// Mobile man-page: semantic layout — avoids pre-wrap column fighting. Plain
// RSC — CSS (`.manpage--mobile`) toggles visibility against the desktop variant.
export function ManPageMobile() {
  return (
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
          {
            ' --track LEAD --domain AI-TOOLING --stack "LLMs, RAG, AI Agents, Harness, and GenAI with Spec-Driven flow" --ft'
          }
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
  );
}
