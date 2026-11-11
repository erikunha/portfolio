import { exec } from 'node:child_process';

// The sink the vendored rule names. The command interpolates a value, so the
// shell receives whatever that value carries.
export function listDirectory(directory: string): void {
  exec(`ls ${directory}`, () => undefined);
}
