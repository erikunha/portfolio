import Image from 'next/image';
import { Fragment } from 'react';
import { GUITAR_MODULE_HEADER, guitarPresentation, guitarRig } from '@/content/guitar-rig';
import { GUITAR_SIGNAL_BAR_COUNT, GUITAR_SIGNAL_LABEL_TOKENS } from '@/content/schemas';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';

const SIGNAL_BARS = Array.from({ length: GUITAR_SIGNAL_BAR_COUNT }, (_, position) => ({
  position,
}));
const FIRST_NODE_INDEX = 0;
const SECTION_ID = 'sec-guitar';
const STACKED_MAX_WIDTH_PX = 767;
const PHOTO_SIZES = `(max-width: ${STACKED_MAX_WIDTH_PX}px) 100vw, 320px`;

export function GuitarContent() {
  const { signalChain, signalStrengthLabelTemplate, influences, nowPlaying, stats, photo } =
    guitarPresentation;
  const { liveCam } = guitarRig;
  return (
    <div className="guitar-presentation">
      <div className="guitar-signal-panel">
        <div className="guitar-chain max-md:grid-cols-1">
          {signalChain.map((node, index) => (
            <Fragment key={node.role}>
              {index > FIRST_NODE_INDEX && (
                <span
                  className="signal-chain-arrow guitar-arrow min-guitar:max-md:rotate-90"
                  aria-hidden="true"
                />
              )}
              <div className="guitar-node" data-testid={`signal-node-${node.role}`}>
                <div className="guitar-label">{node.role}</div>
                <h3 className="guitar-node-heading">{node.name}</h3>
                <div className="guitar-node-subtitle">{node.subtitle}</div>
                <div
                  className="guitar-bars"
                  role="img"
                  aria-label={signalStrengthLabelTemplate
                    .replace(GUITAR_SIGNAL_LABEL_TOKENS.strength, String(node.strengthDots))
                    .replace(GUITAR_SIGNAL_LABEL_TOKENS.total, String(GUITAR_SIGNAL_BAR_COUNT))}
                >
                  {SIGNAL_BARS.map(({ position }) => (
                    <span
                      key={position}
                      className="guitar-bar"
                      data-filled={position < node.strengthDots}
                    />
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="guitar-pair max-md:grid-cols-1">
        <div className="guitar-details">
          <p className="guitar-influences">
            <strong>{influences.label}</strong> {influences.text}{' '}
            <strong>{nowPlaying.label}</strong> {nowPlaying.text}
          </p>
          <div className="guitar-stats max-md:grid-cols-1">
            {stats.map((stat) => (
              <div className="guitar-stat" key={stat.label} data-testid={`stat-${stat.label}`}>
                <div className="guitar-label">{stat.label}</div>
                <div className="guitar-stat-value">{stat.value}</div>
                <div>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <figure className="guitar-photo">
          <div className="guitar-camera-labels">
            <span>{liveCam.status}</span>
            <span>{liveCam.cameraLabel}</span>
          </div>
          <div className="guitar-photo-frame">
            <Image {...photo} className="guitar-photo-image" sizes={PHOTO_SIZES} />
            <div className="guitar-photo-tint" aria-hidden="true" />
            <div className="guitar-photo-scanlines" aria-hidden="true" />
            <div className="guitar-scan-beam" aria-hidden="true" />
            <div className="cam-corners" aria-hidden="true">
              <i />
            </div>
          </div>
          <figcaption className="guitar-camera-caption">{liveCam.caption}</figcaption>
        </figure>
      </div>
    </div>
  );
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id={SECTION_ID}
      header={GUITAR_MODULE_HEADER}
      srLabel={SECTION_LABELS[SECTION_ID]}
      icon={<IconGuitar />}
      defer={defer}
      variant="green"
    >
      <GuitarContent />
    </Module>
  );
}
