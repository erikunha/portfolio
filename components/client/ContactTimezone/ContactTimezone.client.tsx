'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StatusDot } from '@/components/StatusDot';
import type { ContactContent } from '@/content/contact';
import { contactHoursPhrase, fillCopy } from '@/content/contact-rules';
import { ERIK_PIN, WORLD_MAP_GRID, WORLD_MAP_LAND } from '@/content/world-map';
import { HOURS_PER_DAY, MINUTES_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '@/lib/time';
import { buildLandPaths } from '@/lib/timezone/land-paths';
import { computeOverlap, erikAvailability, layoutPins, projectToMap } from '@/lib/timezone/overlap';
import {
  detectTimeZone,
  ERIK_TIME_ZONE,
  formatClock,
  zoneCity,
  zonePlace,
} from '@/lib/timezone/zones';
import { messageStore } from '../ContactForm/messageStore';
import { ContactTimezoneMap } from './ContactTimezoneMap';
import { useNow, usePanelActive } from './useClock';
import { ZoneCombobox } from './ZoneCombobox';

type TimezoneCopy = ContactContent['timezone'];
const ROW_KEYS = ['erik', 'you', 'both'] as const;
const HOURS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);

function ClockPair({ copy, active, zone }: { copy: TimezoneCopy; active: boolean; zone: string }) {
  const now = useNow(active, MS_PER_SECOND);
  return (
    <p className="ctz-clocks">
      <span className="ctz-clock">
        <span className="ctz-clock-caption">{copy.clocks.erik}</span>{' '}
        <span className="ctz-clock-time" data-tone="erik" data-testid="ctz-clock-erik">
          {formatClock(ERIK_TIME_ZONE, now, true)}
        </span>
      </span>
      <span className="ctz-clock-link" aria-hidden="true">
        {copy.clocks.link}
      </span>
      <span className="ctz-clock">
        <span className="ctz-clock-caption">{copy.clocks.you}</span>{' '}
        <span className="ctz-clock-time" data-testid="ctz-clock-you">
          {formatClock(zone, now, true)}
        </span>
      </span>
    </p>
  );
}

export function ContactTimezone({ copy }: { copy: TimezoneCopy }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const active = usePanelActive(rootRef);
  const clockNow = useNow(active, MS_PER_MINUTE);
  const [autoZone] = useState(detectTimeZone);
  const [zone, setZone] = useState(autoZone);
  const [proposedLine, setProposedLine] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });

  const minute = Math.floor(clockNow.getTime() / MS_PER_MINUTE);
  const at = useMemo(() => new Date(minute * MS_PER_MINUTE), [minute]);

  const land = useMemo(
    () =>
      buildLandPaths(
        WORLD_MAP_LAND,
        WORLD_MAP_GRID,
        at.getUTCHours() + at.getUTCMinutes() / MINUTES_PER_HOUR,
      ),
    [at],
  );
  const availability = useMemo(() => erikAvailability(at), [at]);
  const overlap = useMemo(() => computeOverlap(zone, at), [zone, at]);
  const place = useMemo(() => zonePlace(zone, at), [zone, at]);
  const layout = useMemo(() => layoutPins(place), [place]);

  const erikTime = formatClock(ERIK_TIME_ZONE, at, false);
  const youTime = formatClock(zone, at, false);
  const overlapPhrase = contactHoursPhrase(copy.hours, overlap.hours);
  const slot = overlap.bestSlot;
  const slotLine = slot
    ? fillCopy(slot.you === slot.erik ? copy.propose.sameZoneLine : copy.propose.line, {
        you: slot.you,
        city: zoneCity(zone),
        erik: slot.erik,
      })
    : null;

  const lineInMessage = useSyncExternalStore(
    messageStore.subscribe,
    () => proposedLine !== null && messageStore.getSnapshot().includes(proposedLine),
    () => false,
  );
  const added = slotLine !== null && proposedLine === slotLine && lineInMessage;
  const messageFieldId = useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getFieldId,
    () => null,
  );

  function propose() {
    if (!slotLine) return;
    messageStore.append(slotLine);
    setProposedLine(slotLine);
  }

  return (
    <div className="ctz" ref={rootRef} data-testid="contact-timezone">
      <div className="ctz-status" data-online={availability.online} data-testid="ctz-status">
        <p className="ctz-banner">
          <StatusDot className="ctz-dot" blink={availability.online} />
          {availability.online
            ? copy.status.online
            : fillCopy(copy.status.offHours, { hours: availability.hoursUntilBack })}
        </p>
        <ClockPair copy={copy} active={active} zone={zone} />
      </div>

      <ContactTimezoneMap
        paths={land}
        erikPin={projectToMap(ERIK_PIN.lat, ERIK_PIN.lon)}
        live={{
          ariaLabel: fillCopy(copy.map.ariaLabel, {
            erikPlace: copy.map.erikPlace,
            place: place.name,
            overlap: overlapPhrase,
          }),
          layout,
          erik: {
            caption: fillCopy(copy.map.erikLabel, { code: ERIK_PIN.code }),
            time: erikTime,
          },
          you: { caption: fillCopy(copy.map.youLabel, { code: place.code }), time: youTime },
        }}
      />

      <div className="ctz-location">
        <p className="ctz-youare" data-testid="ctz-youare">
          {copy.location.youAre}{' '}
          <strong className="ctz-place" data-testid="ctz-place">
            {place.name}
          </strong>
        </p>
        <p className="ctz-detected" data-testid="ctz-detected">
          {fillCopy(zone === autoZone ? copy.location.detectedAuto : copy.location.detectedManual, {
            zone,
          })}
        </p>
        <ZoneCombobox
          copy={copy}
          now={at}
          onSelect={(picked) => {
            setZone(picked);
            setProposedLine(null);
            setAnnouncement((previous) => ({
              id: previous.id + 1,
              text: fillCopy(copy.announce, {
                place: zonePlace(picked, at).name,
                erik: erikTime,
                you: formatClock(picked, at, false),
              }),
            }));
          }}
        />
      </div>

      <div className="ctz-rows" aria-hidden="true" data-testid="ctz-rows">
        {ROW_KEYS.map((row) => (
          <div className="ctz-row" data-row={row} data-testid={`ctz-row-${row}`} key={row}>
            <span className="ctz-row-label">{copy.rows[row]}</span>
            <div className="ctz-cells">
              {HOURS.map((hour) => (
                <span
                  className="ctz-cell"
                  data-testid="ctz-cell"
                  data-on={overlap.cells[row][hour]}
                  data-now={hour === overlap.currentHour ? '' : undefined}
                  key={hour}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="ctz-axis" data-testid="ctz-axis">
          {copy.axis.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="ctz-slot" data-testid="ctz-slot">
        <div className="ctz-slot-body">
          <p className="ctz-slot-title">{copy.slot.title}</p>
          {overlap.bestSlot ? (
            <p className="ctz-slot-times">
              <span data-testid="ctz-slot-you">{overlap.bestSlot.you}</span>{' '}
              <span className="ctz-slot-who">{copy.slot.you}</span>
              {copy.slot.separator}
              <span className="ctz-slot-erik" data-testid="ctz-slot-erik">
                {overlap.bestSlot.erik}
              </span>{' '}
              <span className="ctz-slot-who">{copy.slot.erik}</span>
            </p>
          ) : (
            <p className="ctz-slot-none">{copy.slot.none}</p>
          )}
          <div className="ctz-proposed-row">
            <p className="ctz-proposed" role="status">
              {added ? <span data-testid="ctz-proposed">{copy.propose.added}</span> : null}
            </p>
            {added && messageFieldId ? (
              <a
                className="ctz-proposed-link"
                href={`#${messageFieldId}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(messageFieldId)?.focus();
                }}
              >
                {copy.propose.focusLink}
              </a>
            ) : null}
          </div>
        </div>
        {slotLine ? (
          <button type="button" className="ctz-propose" onClick={propose}>
            {copy.propose.label}
          </button>
        ) : null}
      </div>

      <p className="ctz-overlap" data-testid="ctz-overlap">
        {overlap.range ? (
          <>
            <strong className="ctz-overlap-hours">
              {fillCopy(copy.overlap.summary, { hours: overlapPhrase })}
            </strong>
            {copy.overlap.separator}
            {fillCopy(copy.overlap.range, { range: overlap.range })}
          </>
        ) : (
          copy.overlap.none
        )}
      </p>

      <p className="sr-only" role="status" data-testid="ctz-announce">
        <span key={announcement.id}>{announcement.text}</span>
      </p>
    </div>
  );
}
