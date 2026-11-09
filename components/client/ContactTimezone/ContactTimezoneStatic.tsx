import { ERIK_PIN, WORLD_MAP_GRID, WORLD_MAP_LAND } from '@/content/world-map';
import { buildLandPaths } from '@/lib/timezone/land-paths';
import { projectToMap } from '@/lib/timezone/overlap';
import { ContactTimezoneMap } from './ContactTimezoneMap';

const SPINNER_FRAMES = ['|', '/', '-', '\\'] as const;
const DIM_PATHS = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, null);
const ERIK_POINT = projectToMap(ERIK_PIN.lat, ERIK_PIN.lon);

export function ContactTimezoneStatic({
  loadingLabel,
  placeholderRows = [],
}: {
  loadingLabel: string;
  placeholderRows?: readonly string[];
}) {
  return (
    <div className="ctz ctz-static" data-testid="contact-timezone-static">
      <div className="ctz-sync">
        <span className="ctz-spin" aria-hidden="true" data-testid="ctz-spin">
          {'[ '}
          <span className="ctz-spin-frames">
            {SPINNER_FRAMES.map((frame) => (
              <span key={frame} className="ctz-spin-frame">
                {frame}
              </span>
            ))}
          </span>
          {' ]'}
        </span>
        <p className="ctz-loading" role="status" data-testid="ctz-loading">
          {loadingLabel}
        </p>
      </div>
      {placeholderRows.map((row) => (
        <p key={row} className="ctz-sync-row">
          {row}
        </p>
      ))}
      <ContactTimezoneMap paths={DIM_PATHS} erikPin={ERIK_POINT} />
    </div>
  );
}
