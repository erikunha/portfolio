import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CAPTURE_SCALE = 'css' as const;

export const HIDE_DECORATIVE_CANVAS_PATH = join(
  process.cwd(),
  'tests',
  'e2e',
  '_helpers',
  'hide-decorative-canvas.css',
);

export function hideDecorativeCanvasCss(): string {
  return readFileSync(HIDE_DECORATIVE_CANVAS_PATH, 'utf8');
}
