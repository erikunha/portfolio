import { DmesgLineSchema } from './schemas';

export const dmesgStatus = { ok: 'OK' } as const;

export const dmesgLines = DmesgLineSchema.array().parse([
  { off: 0.349, prefix: 'init: switching runlevel to 0', ok: false },
  { off: 0.49, prefix: 'systemd: stopping ', bold: 'matrix_rain.daemon', ok: true },
  { off: 0.561, prefix: 'systemd: stopping ', bold: 'crt_flicker.service', ok: true },
  { off: 0.636, prefix: 'kernel: tcp: closing ', bold: '3', suffix: ' connections', ok: true },
  { off: 0.749, prefix: 'systemd: reached target ', bold: 'Shutdown', suffix: '.', ok: false },
  { off: 0.85, prefix: 'systemd: reached target ', bold: 'Final Step', suffix: '.', ok: false },
  { off: 0.949, prefix: 'kernel: ', bold: 'Power down.', ok: false },
]);
