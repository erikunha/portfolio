import { EQ_TEMPLATE_TOKENS, type EqBand, type EqSpectrum } from '@/content/schemas';

export const EQ_VIEWBOX_WIDTH = 1000;
export const EQ_VIEWBOX_HEIGHT = 132;

const HIGHPASS_SLOPE_DB_PER_OCTAVE = 12;
const LOWPASS_SLOPE_DB_PER_OCTAVE = 9;
const GAIN_FLOOR_DB = -14;
const GAIN_CEILING_DB = 12;
const CURVE_SAMPLES = 100;
const CURVE_CENTER_Y = 72;
const CURVE_PX_PER_DB = 4;
const GRID_ROW_OFFSETS = [-1, 0, 1];
const GRID_ROW_STEP = 30;
const INSET_FRACTION = 0.05;
const PERCENT = 100;
const SECONDS_PER_MINUTE = 60;

const BAR_MIN_PX = 8;
const BAR_BASE_PX = 26;
const BAR_PX_PER_DB = 5;
const BAR_HEADROOM_DB = 6;
const BAR_RIPPLE_PX = 12;
const BAR_RIPPLE_STEP = 1.7;
const BAR_DELAY_STEP_SECONDS = 0.11;
const BAR_DELAY_SLOTS = 11;
const BAR_DELAY_STRIDE = 37;
const BAR_CYCLE_VARIANTS = 3;

const HZ_PER_KHZ = 1000;
const HZ_UNIT = 'Hz';
const KHZ_UNIT = 'kHz';
const NUMBER_DECIMALS = 2;

export interface EqBar {
  key: number;
  heightPct: number;
  delaySeconds: number;
  cycleBeats: number;
}

export interface EqAxisTick {
  key: number;
  label: string;
  leftPct: number;
}

export interface EqSpectrumGeometry {
  bars: EqBar[];
  curvePath: string;
  gridPath: string;
  axis: EqAxisTick[];
  axisTracks: string;
  insetPct: number;
  beatSeconds: number;
  ariaLabel: string;
}

function bandGainDb(band: EqBand, freqHz: number): number {
  if (band.kind === 'highpass') {
    return freqHz < band.freqHz
      ? -HIGHPASS_SLOPE_DB_PER_OCTAVE * Math.log2(band.freqHz / freqHz)
      : 0;
  }
  if (band.kind === 'lowpass') {
    return freqHz > band.freqHz
      ? -LOWPASS_SLOPE_DB_PER_OCTAVE * Math.log2(freqHz / band.freqHz)
      : 0;
  }
  return band.gainDb * Math.exp(-((Math.log2(freqHz / band.freqHz) / band.q) ** 2));
}

export function eqGainDb(bands: readonly EqBand[], freqHz: number): number {
  const total = bands.reduce((sum, band) => sum + bandGainDb(band, freqHz), 0);
  return Math.max(GAIN_FLOOR_DB, Math.min(GAIN_CEILING_DB, total));
}

function formatHz(freqHz: number): string {
  if (freqHz < HZ_PER_KHZ) return `${freqHz} ${HZ_UNIT}`;
  return `${Number((freqHz / HZ_PER_KHZ).toFixed(NUMBER_DECIMALS))} ${KHZ_UNIT}`;
}

function describeBand(band: EqBand, templates: EqSpectrum['ariaLabel']): string {
  const freq = formatHz(band.freqHz);
  if (band.kind === 'highpass') return templates.highpass.replace(EQ_TEMPLATE_TOKENS.freq, freq);
  if (band.kind === 'lowpass') return templates.lowpass.replace(EQ_TEMPLATE_TOKENS.freq, freq);
  const template = band.gainDb < 0 ? templates.cut : templates.boost;
  return template
    .replace(EQ_TEMPLATE_TOKENS.gain, String(Math.abs(band.gainDb)))
    .replace(EQ_TEMPLATE_TOKENS.freq, freq);
}

export function buildEqSpectrum(spectrum: EqSpectrum): EqSpectrumGeometry {
  const { freqRange, bands, barCount, bpm, axis, ariaLabel } = spectrum;
  const octaveSpan = Math.log(freqRange.maxHz / freqRange.minHz);
  const unitAt = (freqHz: number) => Math.log(freqHz / freqRange.minHz) / octaveSpan;
  const freqAt = (unit: number) => freqRange.minHz * Math.exp(unit * octaveSpan);
  const leftPctAt = (unit: number) => (INSET_FRACTION + (1 - 2 * INSET_FRACTION) * unit) * PERCENT;
  const xAt = (unit: number) => (leftPctAt(unit) / PERCENT) * EQ_VIEWBOX_WIDTH;

  const bars = Array.from({ length: barCount }, (_, index): EqBar => {
    const gain = eqGainDb(bands, freqAt((index + 0.5) / barCount));
    const heightPx = Math.max(
      BAR_MIN_PX,
      (BAR_HEADROOM_DB + gain) * BAR_PX_PER_DB +
        BAR_BASE_PX +
        BAR_RIPPLE_PX * Math.abs(Math.sin(index * BAR_RIPPLE_STEP)),
    );
    return {
      key: index,
      heightPct: Number(((heightPx / EQ_VIEWBOX_HEIGHT) * PERCENT).toFixed(NUMBER_DECIMALS)),
      delaySeconds: Number(
        (((index * BAR_DELAY_STRIDE) % BAR_DELAY_SLOTS) * BAR_DELAY_STEP_SECONDS).toFixed(
          NUMBER_DECIMALS,
        ),
      ),
      cycleBeats: 1 + (index % BAR_CYCLE_VARIANTS),
    };
  });

  const curvePath = Array.from({ length: CURVE_SAMPLES + 1 }, (_, step) => {
    const unit = step / CURVE_SAMPLES;
    const y = CURVE_CENTER_Y - eqGainDb(bands, freqAt(unit)) * CURVE_PX_PER_DB;
    return `${step === 0 ? 'M' : 'L'}${xAt(unit).toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const gridColumns = axis.map(
    (tick) => `M${xAt(unitAt(tick.freqHz)).toFixed(1)} 0 V${EQ_VIEWBOX_HEIGHT}`,
  );
  const gridRows = GRID_ROW_OFFSETS.map(
    (offset) => `M0 ${CURVE_CENTER_Y + offset * GRID_ROW_STEP} H${EQ_VIEWBOX_WIDTH}`,
  );

  const axisLefts = axis.map((tick) => leftPctAt(unitAt(tick.freqHz)));
  const trackWidths = [
    axisLefts[0] ?? 0,
    ...axisLefts.slice(1).map((left, index) => left - (axisLefts[index] ?? 0)),
    PERCENT - (axisLefts.at(-1) ?? PERCENT),
  ];

  const description = bands.map((band) => describeBand(band, ariaLabel)).join(', ');

  return {
    bars,
    curvePath,
    gridPath: [...gridColumns, ...gridRows].join(' '),
    axis: axis.map((tick, index) => ({
      key: index,
      label: tick.label,
      leftPct: Number(leftPctAt(unitAt(tick.freqHz)).toFixed(NUMBER_DECIMALS)),
    })),
    axisTracks: trackWidths.map((width) => `${width.toFixed(NUMBER_DECIMALS)}fr`).join(' '),
    insetPct: INSET_FRACTION * PERCENT,
    beatSeconds: SECONDS_PER_MINUTE / bpm,
    ariaLabel: `${ariaLabel.prefix}: ${description}.`,
  };
}
