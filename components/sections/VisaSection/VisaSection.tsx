/* biome-ignore-all lint/a11y/noRedundantRoles: CSS card layouts need explicit table roles to preserve table navigation. */
import { profileLanguageLine } from '@/content/profile';
import { SECTION_LABELS } from '@/content/section-labels';
import { visaRows, visaUi } from '@/content/visa';
import { IconVisa } from '../../Icons';
import { Module } from '../../responsive/Module';

export function VisaContent() {
  return (
    <div className="visa-content">
      <table className="visa-table" role="table">
        <caption>
          {visaUi.title}
          <span className="visa-command" aria-hidden="true">
            {visaUi.command}
          </span>
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              {visaUi.jurisdictionLabel}
            </th>
            <th scope="col" role="columnheader">
              {visaUi.statusLabel}
            </th>
            <th scope="col" role="columnheader">
              {visaUi.evidenceLabel}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {visaRows.map((row) => (
            <tr key={row.jurisdiction} role="row">
              <th scope="row" role="rowheader">
                {row.jurisdiction}
              </th>
              <td role="cell" data-label={visaUi.statusLabel}>
                {row.status}
              </td>
              <td role="cell" data-label={visaUi.evidenceLabel}>
                {row.evidence}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="visa-languages">{profileLanguageLine}</p>
    </div>
  );
}

export function VisaSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-visa"
      header={visaUi.command}
      mobileHeader={visaUi.command}
      srLabel={SECTION_LABELS['sec-visa']}
      icon={<IconVisa />}
      defer={defer}
    >
      <VisaContent />
    </Module>
  );
}
