import Image from 'next/image';
import {
  GUITAR_MODULE_HEADER,
  GUITAR_MODULE_MOBILE_HEADER,
  guitarPresentation,
  guitarRig,
} from '@/content/guitar-rig';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';
import { EqSpectrumStrip } from './EqSpectrumStrip';

const SECTION_ID = 'sec-guitar';
const PHOTO_SIZES = '(min-width: 1024px) 38vw, 100vw';

export function GuitarContent() {
  const { signalStrip, eqSpectrum, influences, nowPlaying, stats, photo } = guitarPresentation;
  const { liveCam } = guitarRig;
  return (
    <div className="guitar-presentation">
      <div className="guitar-signal-strip">
        <span className="guitar-signal-strip-live">{signalStrip.live}</span>
        <span className="guitar-signal-strip-tail">{signalStrip.tail}</span>
      </div>
      <p className="guitar-chain-label">{eqSpectrum.label}</p>
      <div className="guitar-signal-panel">
        <EqSpectrumStrip spectrum={eqSpectrum} />
      </div>
      <figure className="guitar-photo">
        <div className="guitar-photo-frame">
          <Image {...photo} className="guitar-photo-image" sizes={PHOTO_SIZES} />
          <div className="guitar-photo-tint" aria-hidden="true" />
          <div className="guitar-photo-scanlines" aria-hidden="true" />
          <div className="guitar-scan-beam" aria-hidden="true" />
          <div className="cam-corners" aria-hidden="true">
            <i />
          </div>
          <div className="guitar-photo-hud-topleft">{liveCam.hudTopLeft}</div>
          <div className="guitar-photo-rec">{liveCam.status}</div>
          <div className="guitar-photo-telemetry">
            <span className="guitar-photo-telemetry-line">{liveCam.telemetry}</span>
            <span className="guitar-photo-telemetry-camera">{liveCam.cameraLabel}</span>
          </div>
        </div>
        <figcaption className="guitar-camera-caption">{liveCam.caption}</figcaption>
      </figure>
      <div className="guitar-facts">
        {stats.map((stat) => (
          <div className="guitar-stat" key={stat.label} data-testid={`stat-${stat.label}`}>
            <div className="guitar-label">{stat.label}</div>
            <div className="guitar-stat-value">{stat.value}</div>
            <div>{stat.sub}</div>
          </div>
        ))}
        <div className="guitar-stat guitar-influences" data-testid="influences">
          <div className="guitar-label">{influences.label}</div>
          <div>{influences.text}</div>
          <div>
            <strong>{nowPlaying.label}</strong> {nowPlaying.text}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id={SECTION_ID}
      header={GUITAR_MODULE_HEADER}
      mobileHeader={GUITAR_MODULE_MOBILE_HEADER}
      name={SECTION_LABELS[SECTION_ID]}
      icon={<IconGuitar />}
      defer={defer}
      variant="green"
    >
      <GuitarContent />
    </Module>
  );
}
