import { brand } from '@/content/brand';
import { BrandIcon } from '@/design-system/components/BrandIcon';
import { cn } from '@/lib/cn';

export function BrandLink({ className }: { className?: string }) {
  return (
    <a
      className={cn('brand-link', className)}
      href={brand.homeHref}
      aria-label={brand.accessibleName}
    >
      <BrandIcon />
    </a>
  );
}
