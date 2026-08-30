import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { qrMatrix, qrSvgPath } from '@/lib/links/qr';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-qr-heading';
const QUIET_ZONE = 3;
const RENDER_PX = 116;

export function QrPanel({ locale, url }: { locale: LinksLocale; url: string }) {
  const { copy, siteLabel } = linksContent;
  const matrix = qrMatrix(url);
  const span = matrix.size + QUIET_ZONE * 2;

  return (
    <section className="links-col px-[18px] pt-[18px]" data-col="qr" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.qrHeading[locale]}</SectionHeading>

      <div className="border border-primary-border bg-[var(--color-glow-03)] p-[14px] flex gap-[14px] items-center">
        <svg
          viewBox={`0 0 ${span} ${span}`}
          width={RENDER_PX}
          height={RENDER_PX}
          role="img"
          aria-label={`QR code: ${url}`}
          className="block flex-none border border-primary-border"
          shapeRendering="crispEdges"
        >
          <rect width={span} height={span} fill="var(--color-tertiary-50)" />
          <path d={qrSvgPath(matrix, QUIET_ZONE)} fill="var(--color-secondary-950)" />
        </svg>
        <div>
          <p className="m-0 text-primary-400 text-[11px]">
            <span aria-hidden="true">$ </span>
            {copy.qrCommand}
          </p>
          <p className="mt-[7px] mb-0 text-tertiary-50 text-[11.5px] leading-[1.6] text-pretty">
            {copy.qrBody[locale]}
          </p>
          <p className="mt-2 mb-0 text-tertiary-400 text-[10.5px]">{siteLabel}</p>
        </div>
      </div>
    </section>
  );
}
