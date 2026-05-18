import type { DmesgLine } from './schemas';

export const dmesgLines: DmesgLine[] = [
  { off: 0.001, prefix: 'init: switching runlevel to 0', ok: false },
  { off: 0.142, prefix: 'systemd: stopping ', bold: 'matrix_rain.daemon', ok: true },
  { off: 0.213, prefix: 'systemd: stopping ', bold: 'crt_flicker.service', ok: true },
  { off: 0.288, prefix: 'kernel: tcp: closing ', bold: '3', suffix: ' connections', ok: true },
  { off: 0.401, prefix: 'systemd: reached target ', bold: 'Shutdown', suffix: '.', ok: false },
  { off: 0.502, prefix: 'systemd: reached target ', bold: 'Final Step', suffix: '.', ok: false },
  { off: 0.601, prefix: 'kernel: ', bold: 'Power down.', ok: false },
];
