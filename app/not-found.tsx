import type { Metadata } from 'next';
import { ErrorChrome, ErrorHeading } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { errorsContent } from '@/content/errors';
import { Button, CmdLine, TerminalPanel } from '@/design-system';

const { chrome, notFound } = errorsContent;

export const metadata: Metadata = { title: notFound.metaTitle };

export default function NotFound() {
  return (
    <>
      <ErrorChrome chrome={chrome} />
      <main className="err-main" id="main-content" tabIndex={-1}>
        <ErrorHeading>{notFound.code}</ErrorHeading>
        <TerminalPanel header={notFound.panelHeader}>
          <div className="p-[14px]">
            <CmdLine
              user=""
              prompt={notFound.prompt}
              command={notFound.command}
              output={notFound.output}
            />
          </div>
        </TerminalPanel>
        <nav aria-label={notFound.suggestionsNavLabel}>
          <p className="err-label">{notFound.suggestionsLabel}</p>
          <ul className="err-suggest">
            {notFound.suggestions.map((item) => (
              <li key={item.href}>
                <a className="err-bar-link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="err-actions">
          <Button as="a" variant="primary" href={notFound.home.href}>
            {notFound.home.label}
          </Button>
        </div>
      </main>
    </>
  );
}
