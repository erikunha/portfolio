import { BREAK_AFTER, BreakAfter } from '@/components/BreakAfter';
import type { ShellUi } from '@/content/shell-ui';

export function ShellEmail({ ui }: { ui: Pick<ShellUi, 'email' | 'emailHref'> }) {
  return (
    <a className="shell-email" href={ui.emailHref}>
      <BreakAfter chars={BREAK_AFTER.email}>{ui.email}</BreakAfter>
    </a>
  );
}
