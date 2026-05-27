import Image from 'next/image';
import { Suspense } from 'react';
import { guitarRig } from '@/content/guitar-rig';
import type { GuitarRig } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconGuitar } from '../../Icons';
import { Module } from '../../responsive/Module';
import s from './GuitarSection.module.css';

type Block = NonNullable<GuitarRig['signalChain'][number]['blocks']>[number];
type Influence = GuitarRig['influences'][number];

function StrengthDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div role="img" className={s.dots} aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional dots — no stable id exists
        <span key={i} className={i < filled ? s.dotFilled : s.dotEmpty} />
      ))}
    </div>
  );
}

function FxGrid({ blocks }: { blocks: Block[] }) {
  return (
    <div className={s.fxGrid}>
      {blocks.map((b) => (
        <div key={b.name} className={b.active ? s.fxActive : s.fxInactive}>
          {b.name}
          {b.active && (
            <span className={s.fxBullet} aria-hidden="true">
              ●
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function FxList({ blocks }: { blocks: Block[] }) {
  return (
    <div className={s.fxList}>
      {blocks.map((b) => (
        <div key={b.name} className={b.active ? s.fxRowActive : s.fxRowInactive}>
          <span aria-hidden="true">{b.active ? '●' : '○'}</span>
          <span>{b.name}</span>
        </div>
      ))}
    </div>
  );
}

function InfluencesList({
  influences,
  nowObsessing,
}: {
  influences: Influence[];
  nowObsessing: string;
}) {
  return (
    <div className={s.influences}>
      <div className={s.influencesHeader}>
        <span>INFLUENCES.QUEUE · {influences.length} LOADED</span>
        <span>{'// SHUFFLE OFF'}</span>
      </div>
      {influences.map((inf) => (
        <div key={inf.rank} className={inf.active ? s.infActive : s.infItem}>
          <span className={s.infName}>
            <span aria-hidden="true">{inf.active ? '▶' : '  '}</span>
            {String(inf.rank).padStart(2, '0')}
            {'  '}
            {inf.name}
          </span>
          <StrengthDots filled={inf.strength} total={5} />
        </div>
      ))}
      <div className={s.nowObsessing}>
        <strong>now obsessing:</strong> {nowObsessing}
      </div>
    </div>
  );
}

function LiveCam({ liveCam }: { liveCam: GuitarRig['liveCam'] }) {
  return (
    <div className={s.liveCam}>
      <div className={s.camHeader}>
        <span>▶ REC · LIVE</span>
        <span>CAM/01 · STAGE</span>
      </div>
      <div className={s.camPhoto}>
        <Image
          src={liveCam.photo}
          alt="Erik playing guitar on stage, live show"
          fill
          className={s.camImg}
          sizes="(max-width: 768px) 100vw, 220px"
        />
        <div className={s.camOverlay} aria-hidden="true" />
        <div className={s.scanLines} aria-hidden="true" />
        <div className={s.scanBeam} aria-hidden="true" />
      </div>
      <div className={s.camCaption}>{liveCam.caption}</div>
    </div>
  );
}

export function GuitarDesktop() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div className={s.root} data-testid="guitar-desktop">
      <div className={s.panel}>
        <div className={s.statusBar}>
          <span>
            <span className={s.statusDot} aria-hidden="true">
              ●
            </span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </span>
          <span>TAIL -F ~/.RIG</span>
        </div>
        <div className={s.chainGrid}>
          {signalChain.map((node, i) => (
            <div key={node.role} className={s.chainEntry}>
              {i > 0 && (
                <span className={s.arrow} aria-hidden="true">
                  →
                </span>
              )}
              <div
                className={node.role === 'FX' ? s.nodeFx : s.node}
                data-testid={`signal-node-${node.role}`}
              >
                <div className={s.nodeLabel}>
                  {'// '}
                  {node.role}
                </div>
                <div className={s.nodeName}>{node.name}</div>
                <div className={s.nodeSub}>{node.subtitle}</div>
                {node.blocks ? (
                  <FxGrid blocks={node.blocks} />
                ) : (
                  <StrengthDots filled={node.strengthDots ?? 0} total={8} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={s.twoCol}>
        <InfluencesList influences={influences} nowObsessing={nowObsessing} />
        <LiveCam liveCam={liveCam} />
      </div>
      <div className={s.statsGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={s.statCell} data-testid={`stat-${stat.label}`}>
            <div className={s.statLabel}>
              {'// '}
              {stat.label}
            </div>
            <div className={s.statValue}>{stat.value}</div>
            <div className={s.statSub}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuitarMobile() {
  const { signalChain, influences, nowObsessing, stats, liveCam } = guitarRig;
  return (
    <div className={s.rootMobile} data-testid="guitar-mobile">
      <div className={s.panelMobile}>
        <div className={s.statusBarMobile}>
          <div>
            <span className={s.statusDot} aria-hidden="true">
              ●
            </span>
            {' SIGNAL_CHAIN.LIVE · SIGNAL OK'}
          </div>
          <div>TAIL -F ~/.RIG</div>
        </div>
        {signalChain.map((node, i) => (
          <div key={node.role}>
            {i > 0 && (
              <div className={s.arrowDown} aria-hidden="true">
                ▼
              </div>
            )}
            <div className={s.nodeMobile} data-testid={`signal-node-mobile-${node.role}`}>
              <div className={s.nodeLabel}>
                {'// '}
                {node.role}
              </div>
              <div className={s.nodeName}>{node.name}</div>
              <div className={s.nodeSub}>{node.subtitle}</div>
              {node.blocks ? (
                <FxList blocks={node.blocks} />
              ) : (
                <StrengthDots filled={node.strengthDots ?? 0} total={8} />
              )}
            </div>
          </div>
        ))}
      </div>
      <InfluencesList influences={influences} nowObsessing={nowObsessing} />
      <LiveCam liveCam={liveCam} />
      <div className={s.statsGridMobile}>
        {stats.map((stat) => (
          <div key={stat.label} className={s.statCell} data-testid={`stat-mobile-${stat.label}`}>
            <div className={s.statLabel}>
              {'// '}
              {stat.label}
            </div>
            <div className={s.statValue}>{stat.value}</div>
            <div className={s.statSub}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function GuitarContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <GuitarMobile /> : <GuitarDesktop />;
}

export function GuitarSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module id="sec-guitar" header="CAT ~/.GUITAR_RIG" icon={<IconGuitar />} defer={defer}>
      <Suspense fallback={<GuitarDesktop />}>
        <GuitarContent />
      </Suspense>
    </Module>
  );
}
