import { PrintButton } from '@/components/client/PrintButton';
import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { readingViews } from '@/content/reading-views';
import type { SiteLocale } from '@/content/site-locale';
import { Button } from '@/design-system';
import { cn } from '@/lib/cn';

export function ReadingActions({
  locale,
  secondary,
  className,
}: {
  locale: SiteLocale;
  secondary: { href: string; label: string };
  className?: string;
}) {
  const { shared, cv } = readingViews[locale];
  return (
    <div className={cn('reading-actions', className)}>
      <Button
        as="a"
        variant="primary"
        href={shared.hire.href}
        {...EXTERNAL_LINK_PROPS}
        aria-label={shared.hire.ariaLabel}
      >
        {shared.hire.label}
      </Button>
      <Button as="a" variant="secondary" href={secondary.href}>
        {secondary.label}
      </Button>
      <Button as="a" variant="secondary" href={cv.pdf.href} download>
        {cv.pdf.label}
      </Button>
      <PrintButton label={shared.printLabel} />
    </div>
  );
}
