import Image from 'next/image';
import { Fragment } from 'react';
import { guitarPresentation, guitarRig } from '@/content/guitar-rig';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';

const SIGNAL_BAR_COUNT = 8;
const SIGNAL_BARS = Array.from({ length: SIGNAL_BAR_COUNT }, (_, position) => ({ position }));
const FIRST_NODE_INDEX = 0;
const SECTION_ID = 'sec-guitar';
const PHOTO_SIZES = '(max-width: 699px) 100vw, 320px';

export function GuitarContent() {
  const { signalChain, influences, nowPlaying, stats, photo } = guitarPresentation;
  const { liveCam } = guitarRig;
  return (
    <div className="guitar-presentation">
      <div className="guitar-signal-panel">
        <div className="guitar-chain">
          {signalChain.map((node, index) => (
            <Fragment key={node.role}>
              {index > FIRST_NODE_INDEX && (
                <span className="signal-chain-arrow guitar-arrow" aria-hidden="true" />
              )}
              <div className="guitar-node" data-testid={`signal-node-${node.role}`}>
                <div className="guitar-label">{node.role}</div>
                <h3 className="guitar-node-heading">{node.name}</h3>
                <div className="guitar-node-subtitle">{node.subtitle}</div>
                <div className="guitar-bars" aria-hidden="true">
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
      <div className="guitar-pair">
        <div className="guitar-details">
          <p className="guitar-influences">
            <strong>{influences.label}</strong> {influences.text}{' '}
            <strong>{nowPlaying.label}</strong> {nowPlaying.text}
          </p>
          <div className="guitar-stats">
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
      header={SECTION_LABELS[SECTION_ID]}
      icon={<IconGuitar />}
      defer={defer}
      variant="green"
    >
      <GuitarContent />
    </Module>
  );
}
