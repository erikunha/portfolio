import { z } from 'zod';

const DawMixerPluginSchema = z.object({
  name: z.string().min(1),
  active: z.boolean(),
  strength: z.number().int().min(0).max(5),
});

const DawMixerKnobSchema = z.object({
  label: z.string().min(1),
  angleDeg: z.number().min(-150).max(150),
});

const DawMixerChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desktopName: z.string().optional(),
  desc: z.string().min(1),
  focused: z.boolean().optional(),
  plugins: z.array(DawMixerPluginSchema).min(1).max(5),
  faderPct: z.number().min(0).max(100),
  meterPct: z.number().min(0).max(100),
  meterClipping: z.boolean().optional(),
  knob1: DawMixerKnobSchema,
  knob2: DawMixerKnobSchema,
  buttons: z.array(z.string().min(1)),
  activeButtons: z.array(z.string().min(1)),
  footer: z.object({ lufs: z.string(), pk: z.string() }).optional(),
  terminalLines: z.array(z.string().min(1)).optional(),
});

export const DawMixerSchema = z.object({
  sessionName: z.string().min(1),
  loadingLabel: z.string().min(1),
  bpm: z.number().int(),
  timeSignature: z.string().min(1),
  status: z.string().min(1),
  transportTime: z.string().min(1),
  channels: z
    .array(DawMixerChannelSchema)
    .length(3)
    .refine((chs) => chs[chs.length - 1]?.id === 'MASTER', {
      message: 'Last channel must be MASTER',
    }),
});

const DawMixerCopyTextSchema = z.string().min(1);

export const DawMixerCopySchema = z.object({
  sessionLabel: DawMixerCopyTextSchema,
  tracksLabel: DawMixerCopyTextSchema,
  skipLabel: DawMixerCopyTextSchema,
  separator: DawMixerCopyTextSchema,
  transportSeparator: DawMixerCopyTextSchema,
  playGlyph: DawMixerCopyTextSchema,
  bpmUnit: DawMixerCopyTextSchema,
  signalFlow: DawMixerCopyTextSchema,
  leadSuffix: DawMixerCopyTextSchema,
  loudnessLabel: DawMixerCopyTextSchema,
  peakLabel: DawMixerCopyTextSchema,
  decibelUnit: DawMixerCopyTextSchema,
  columns: z.object({
    id: DawMixerCopyTextSchema,
    track: DawMixerCopyTextSchema,
    io: DawMixerCopyTextSchema,
    toggles: DawMixerCopyTextSchema,
    pluginChain: DawMixerCopyTextSchema,
    meter: DawMixerCopyTextSchema,
    fader: DawMixerCopyTextSchema,
  }),
  controls: z.object({
    vuMeter: DawMixerCopyTextSchema,
    fader: DawMixerCopyTextSchema,
    degrees: DawMixerCopyTextSchema,
    knobHint: DawMixerCopyTextSchema,
    buttons: z.object({
      R: DawMixerCopyTextSchema,
      M: DawMixerCopyTextSchema,
      S: DawMixerCopyTextSchema,
    }),
  }),
});

export type DawMixer = z.infer<typeof DawMixerSchema>;
export type DawMixerCopy = z.infer<typeof DawMixerCopySchema>;
export type DawMixerChannel = z.infer<typeof DawMixerChannelSchema>;
export type DawMixerPlugin = z.infer<typeof DawMixerPluginSchema>;
