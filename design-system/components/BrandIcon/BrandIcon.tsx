import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';
import { BRAND_ICON_CROP, BRAND_ICON_PATH, BRAND_ICON_VIEWBOX } from './brand-icon-path';

export type BrandIconProps = Omit<ComponentPropsWithoutRef<'svg'>, 'children'> & {
  size?: number;
};

const DEFAULT_WIDTH_PX = 60;

export function BrandIcon({ size = DEFAULT_WIDTH_PX, className, ...rest }: BrandIconProps) {
  return (
    <svg
      viewBox={BRAND_ICON_VIEWBOX}
      width={size}
      height={Math.round((size * BRAND_ICON_CROP.height) / BRAND_ICON_CROP.width)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('brand-icon', className)}
      {...rest}
    >
      <path d={BRAND_ICON_PATH} />
    </svg>
  );
}
