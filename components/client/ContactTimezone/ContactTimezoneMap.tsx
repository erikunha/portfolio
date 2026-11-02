import type { CSSProperties } from 'react';
import { DOT_GAP_PX, DOT_PX, type LandPaths } from '@/lib/timezone/land-paths';
import { MAP_HEIGHT, MAP_WIDTH, type MapPoint, type PinLayout } from '@/lib/timezone/overlap';

const PERCENT = 100;
const VIEW_BOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;
const DOT_DASH = `${DOT_PX} ${DOT_GAP_PX}`;

export type MapLabel = { caption: string; time: string };
export type LiveMap = {
  ariaLabel: string;
  layout: PinLayout;
  erik: MapLabel;
  you: MapLabel;
};

const percentX = (point: MapPoint) => `${(point.x / MAP_WIDTH) * PERCENT}%`;
const percentY = (point: MapPoint) => `${(point.y / MAP_HEIGHT) * PERCENT}%`;

const pinStyle = (point: MapPoint): CSSProperties => ({
  left: percentX(point),
  top: percentY(point),
});

const labelStyle = (point: MapPoint): CSSProperties =>
  ({ '--ctz-x': percentX(point), '--ctz-y': percentY(point) }) as CSSProperties;

function Label({
  id,
  tone,
  side,
  place,
  point,
  label,
}: {
  id: string;
  tone: string;
  side: 'left' | 'right';
  place: 'above' | 'below';
  point: MapPoint;
  label: MapLabel;
}) {
  return (
    <div
      className="ctz-label"
      data-tone={tone}
      data-side={side}
      data-place={place}
      data-testid={id}
      style={labelStyle(point)}
    >
      <span className="ctz-label-caption">{label.caption}</span>
      <span className="ctz-label-time">{label.time}</span>
    </div>
  );
}

export function ContactTimezoneMap({
  paths,
  erikPin,
  live,
}: {
  paths: LandPaths;
  erikPin: MapPoint;
  live?: LiveMap;
}) {
  return (
    <div className="ctz-map">
      <svg
        className="ctz-map-svg"
        viewBox={VIEW_BOX}
        role={live ? 'img' : undefined}
        aria-label={live?.ariaLabel}
        aria-hidden={live ? undefined : true}
        focusable="false"
      >
        <path
          className="ctz-land-dim"
          data-testid="ctz-land-dim"
          d={paths.dim}
          strokeWidth={DOT_PX}
          strokeDasharray={DOT_DASH}
        />
        <path
          className="ctz-land-lit"
          data-testid="ctz-land-lit"
          d={paths.lit}
          strokeWidth={DOT_PX}
          strokeDasharray={DOT_DASH}
        />
        {live?.layout.route ? (
          <path className="ctz-route" data-testid="ctz-route" d={live.layout.route} />
        ) : null}
      </svg>
      <div className="ctz-overlay" aria-hidden="true">
        <span
          className="ctz-pin"
          data-tone="erik"
          data-testid="ctz-pin-erik"
          style={pinStyle(live ? live.layout.erik : erikPin)}
        />
        {live ? (
          <span
            className="ctz-pin"
            data-tone="you"
            data-testid="ctz-pin-you"
            style={pinStyle(live.layout.visitor)}
          >
            <span className="ctz-pulse" />
          </span>
        ) : null}
      </div>
      {live ? (
        <div className="ctz-labels" aria-hidden="true">
          <Label
            id="ctz-label-erik"
            tone="erik"
            side="right"
            place="below"
            point={live.layout.erik}
            label={live.erik}
          />
          <Label
            id="ctz-label-you"
            tone="you"
            side={live.layout.near ? 'left' : 'right'}
            place="above"
            point={live.layout.visitor}
            label={live.you}
          />
        </div>
      ) : null}
    </div>
  );
}
