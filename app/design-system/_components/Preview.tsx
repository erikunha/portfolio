import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';
import { PREVIEW_SOURCE_ARIA_LABEL, PREVIEW_SOURCE_LABEL } from './preview.constants';

type PreviewProps = {
  id?: string;
  source?: string;
  children: ReactNode;
};

export function Preview({ id, source, children }: PreviewProps) {
  return (
    <div id={id} className="ds-preview" data-testid="ds-preview">
      <TerminalPanel className="my-4">
        <div className="p-6 flex flex-wrap gap-3 items-start">{children}</div>
        {source != null && (
          <div className="border-t border-primary-border">
            <p className="px-6 py-1.5 m-0 font-mono text-xs tracking-widest text-primary-400 uppercase">
              {PREVIEW_SOURCE_LABEL}
            </p>
            {/* biome-ignore lint/a11y/useSemanticElements: fieldset is a form-control grouping element with implicit role=group; this pre is a non-form scrollable code region, not a form, so the suggested native element is semantically wrong here */}
            <pre
              // biome-ignore lint/a11y/noNoninteractiveTabindex: axe scrollable-region-focusable (WCAG 2.1.1) requires this overflow-x-auto pre to be keyboard-focusable
              tabIndex={0}
              role="group"
              aria-label={PREVIEW_SOURCE_ARIA_LABEL}
              className="m-0 px-6 py-4 overflow-x-auto font-mono text-xs text-tertiary-50 border-t border-dashed border-primary-border"
            >
              <code>{source}</code>
            </pre>
          </div>
        )}
      </TerminalPanel>
    </div>
  );
}
