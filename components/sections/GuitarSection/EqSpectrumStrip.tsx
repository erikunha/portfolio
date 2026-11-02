import type { CSSProperties } from 'react';
import type { EqSpectrum } from '@/content/schemas';
import { buildEqSpectrum, EQ_VIEWBOX_HEIGHT, EQ_VIEWBOX_WIDTH } from '@/lib/eq-spectrum';

const VIEW_BOX = `0 0 ${EQ_VIEWBOX_WIDTH} ${EQ_VIEWBOX_HEIGHT}`;

function barStyle(heightPct: number, delaySeconds: number, cycleBeats: number): CSSProperties {
  return {
    '--eq-bar-height': `${heightPct}%`,
    '--eq-bar-delay': `${delaySeconds}s`,
    '--eq-bar-cycle': cycleBeats,
  } as CSSProperties;
}

export function EqSpectrumStrip({ spectrum }: { spectrum: EqSpectrum }) {
  const { bars, curvePath, gridPath, axis, insetPct, beatSeconds, ariaLabel } =
    buildEqSpectrum(spectrum);
  return (
    <div
      className="eq-strip"
      data-testid="eq-spectrum"
      style={
        { '--eq-beat': `${beatSeconds.toFixed(3)}s`, '--eq-inset': `${insetPct}%` } as CSSProperties
      }
    >
      <p className="eq-label">{spectrum.label}</p>
      <div className="eq-plot" role="img" aria-label={ariaLabel}>
        <svg
          className="eq-grid"
          viewBox={VIEW_BOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d={gridPath} />
        </svg>
        <div className="eq-bars" aria-hidden="true">
          {bars.map((bar) => (
            <span
              key={bar.key}
              className="eq-bar"
              style={barStyle(bar.heightPct, bar.delaySeconds, bar.cycleBeats)}
            />
          ))}
        </div>
        <svg
          className="eq-curve"
          viewBox={VIEW_BOX}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d={curvePath} />
        </svg>
      </div>
      <div className="eq-axis" aria-hidden="true">
        {axis.map((tick) => (
          <span key={tick.key} className="eq-axis-tick" style={{ left: `${tick.leftPct}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
