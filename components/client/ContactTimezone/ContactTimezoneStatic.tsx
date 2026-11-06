import { ERIK_PIN, WORLD_MAP_GRID, WORLD_MAP_LAND } from '@/content/world-map';
import { buildLandPaths } from '@/lib/timezone/land-paths';
import { projectToMap } from '@/lib/timezone/overlap';
import { ContactTimezoneMap } from './ContactTimezoneMap';

const DIM_PATHS = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, null);
const ERIK_POINT = projectToMap(ERIK_PIN.lat, ERIK_PIN.lon);

export function ContactTimezoneStatic({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="ctz ctz-static" data-testid="contact-timezone-static">
      <p className="ctz-loading" role="status" data-testid="ctz-loading">
        {loadingLabel}
      </p>
      <ContactTimezoneMap paths={DIM_PATHS} erikPin={ERIK_POINT} />
    </div>
  );
}
