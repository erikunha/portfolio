import { type KeyboardEvent, useId, useMemo, useState } from 'react';
import type { ContactContent } from '@/content/contact';
import { fillCopy } from '@/content/contact-rules';
import {
  filterZones,
  formatUtcOffset,
  supportedZones,
  zoneLabel,
  zoneOffsetMinutes,
} from '@/lib/timezone/zones';

const RESULT_LIMIT = 8;
const NO_ACTIVE_OPTION = -1;
const FIRST_OPTION = 0;
const STEP = 1;

const KEY = {
  DOWN: 'ArrowDown',
  UP: 'ArrowUp',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
} as const;

export function ZoneCombobox({
  copy,
  now,
  onSelect,
}: {
  copy: ContactContent['timezone'];
  now: Date;
  onSelect: (zone: string) => void;
}) {
  const { search } = copy;
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const zones = useMemo(() => supportedZones(), []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(NO_ACTIVE_OPTION);

  const result = useMemo(() => filterZones(zones, query, RESULT_LIMIT), [zones, query]);
  const offsets = useMemo(
    () => result.zones.map((zone) => formatUtcOffset(zoneOffsetMinutes(zone, now))),
    [result.zones, now],
  );

  function close() {
    setOpen(false);
    setActive(NO_ACTIVE_OPTION);
  }

  function choose(zone: string) {
    setQuery('');
    close();
    onSelect(zone);
  }

  function move(delta: number) {
    const last = result.zones.length - STEP;
    if (last < FIRST_OPTION) return;
    setOpen(true);
    setActive((current) => {
      if (current === NO_ACTIVE_OPTION) return delta > 0 ? FIRST_OPTION : last;
      return Math.min(last, Math.max(FIRST_OPTION, current + delta));
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === KEY.DOWN) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(result.zones.length > 0 ? FIRST_OPTION : NO_ACTIVE_OPTION);
        return;
      }
      move(STEP);
    } else if (event.key === KEY.UP) {
      event.preventDefault();
      move(-STEP);
    } else if (event.key === KEY.ENTER) {
      const chosen = result.zones[active];
      if (open && chosen) {
        event.preventDefault();
        choose(chosen);
      }
    } else if (event.key === KEY.ESCAPE) {
      if (open) event.preventDefault();
      else setQuery('');
      close();
    }
  }

  const countText = fillCopy(search.count, { matches: result.total, total: zones.length });
  const activeId =
    open && active >= FIRST_OPTION && result.zones[active] ? optionId(active) : undefined;

  return (
    <div className="ctz-combobox">
      <input
        className="ctz-input"
        type="text"
        role="combobox"
        aria-label={search.label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        placeholder={search.placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(FIRST_OPTION);
        }}
        onClick={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      <div className="ctz-popup" hidden={!open}>
        <div
          className="ctz-list"
          id={listId}
          role="listbox"
          aria-label={search.listLabel}
          hidden={!open}
        >
          {result.zones.map((zone, index) => (
            <div
              key={zone}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className="ctz-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(zone)}
            >
              <span>{zoneLabel(zone)}</span>
              <span className="ctz-option-offset">{offsets[index]}</span>
            </div>
          ))}
        </div>
        <p className="ctz-count" data-testid="ctz-count" aria-hidden="true">
          {countText}
        </p>
      </div>
      <p className="sr-only" role="status" data-testid="ctz-count-live">
        {open ? countText : ''}
      </p>
    </div>
  );
}
