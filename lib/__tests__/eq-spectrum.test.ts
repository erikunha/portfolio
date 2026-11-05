import { describe, expect, it } from 'vitest';
import { guitarRig } from '@/content/guitar-rig';
import { SITE_LOCALE } from '@/content/site-locale';
import { buildEqSpectrum, eqGainDb } from '../eq-spectrum';

const spectrum = buildEqSpectrum(guitarRig[SITE_LOCALE.en].eqSpectrum);
const { bands, freqRange } = guitarRig[SITE_LOCALE.en].eqSpectrum;
const FLAT_TOLERANCE_DB = 0.05;
const POINT_PATTERN = /[ML]\s*[\d.]+\s+[\d.]+/g;

describe('eqGainDb', () => {
  it('cuts below the high-pass corner and below the low-pass roll-off', () => {
    expect(eqGainDb(bands, freqRange.minHz)).toBeLessThan(eqGainDb(bands, 1000));
    expect(eqGainDb(bands, freqRange.maxHz)).toBeLessThan(eqGainDb(bands, 1000));
  });

  it('boosts at the presence peak and cuts at the low-mid notch', () => {
    expect(eqGainDb(bands, 2800)).toBeGreaterThan(0);
    expect(eqGainDb(bands, 400)).toBeLessThan(0);
  });

  it('stays flat in the passband with no band in reach', () => {
    expect(Math.abs(eqGainDb([], 1000))).toBeLessThan(FLAT_TOLERANCE_DB);
  });
});

describe('buildEqSpectrum', () => {
  it('builds one bar per configured spectrum bin', () => {
    expect(spectrum.bars).toHaveLength(guitarRig[SITE_LOCALE.en].eqSpectrum.barCount);
    for (const bar of spectrum.bars) {
      expect(bar.heightPct).toBeGreaterThan(0);
      expect(bar.heightPct).toBeLessThanOrEqual(100);
      expect(bar.cycleBeats).toBeGreaterThanOrEqual(1);
    }
  });

  it('shapes the bars with the EQ: presence region is taller than the sub region', () => {
    const { bars } = spectrum;
    const subHeights = bars.slice(0, 4).map((bar) => bar.heightPct);
    const presenceIndex = Math.round(
      bars.length *
        (Math.log(2800 / freqRange.minHz) / Math.log(freqRange.maxHz / freqRange.minHz)),
    );
    const presenceHeights = bars
      .slice(presenceIndex - 1, presenceIndex + 2)
      .map((bar) => bar.heightPct);
    expect(Math.min(...presenceHeights)).toBeGreaterThan(Math.max(...subHeights));
  });

  it('derives the groove from the BPM and desynchronises the bars', () => {
    expect(spectrum.beatSeconds).toBeCloseTo(60 / guitarRig[SITE_LOCALE.en].eqSpectrum.bpm, 5);
    expect(new Set(spectrum.bars.map((bar) => bar.delaySeconds)).size).toBeGreaterThan(3);
  });

  it('draws the curve as one polyline whose y falls where gain rises', () => {
    const points = spectrum.curvePath.match(POINT_PATTERN) ?? [];
    expect(points.length).toBeGreaterThan(50);
    const yAt = (index: number) => Number(points[index]?.trim().split(/\s+/).pop());
    const low = Math.round(points.length * 0.3);
    const presence = Math.round(points.length * 0.68);
    expect(yAt(presence)).toBeLessThan(yAt(low));
  });

  it('places axis labels in frequency order inside the plot', () => {
    const lefts = spectrum.axis.map((tick) => tick.leftPct);
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(lefts[0]).toBeCloseTo(spectrum.insetPct, 5);
    expect(lefts.at(-1)).toBeCloseTo(100 - spectrum.insetPct, 5);
    expect(spectrum.axis.map((tick) => tick.label)).toEqual(
      guitarRig[SITE_LOCALE.en].eqSpectrum.axis.map((tick) => tick.label),
    );
  });

  it('sizes one axis track per tick plus the closing track so ticks sit on their frequency', () => {
    const widths = spectrum.axisTracks.split(' ').map((track) => Number.parseFloat(track));
    expect(spectrum.axisTracks.split(' ').every((track) => track.endsWith('fr'))).toBe(true);
    expect(widths).toHaveLength(spectrum.axis.length + 1);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 0);
    let boundary = 0;
    for (const [index, tick] of spectrum.axis.entries()) {
      boundary += widths[index] ?? 0;
      expect(boundary).toBeCloseTo(tick.leftPct, 0);
    }
  });

  it('describes every band in the accessible name', () => {
    expect(spectrum.ariaLabel).toContain(guitarRig[SITE_LOCALE.en].eqSpectrum.ariaLabel.prefix);
    expect(spectrum.ariaLabel).toContain('140 Hz');
    expect(spectrum.ariaLabel).toContain('400 Hz');
    expect(spectrum.ariaLabel).toContain('2.8 kHz');
    expect(spectrum.ariaLabel).toContain('9 kHz');
  });
});
