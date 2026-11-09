import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveServerPort } from '../lib/free-port';

const held: Server[] = [];

function occupy(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    held.push(server);
    server.listen(0, () => resolve((server.address() as { port: number }).port));
  });
}

afterEach(() => {
  for (const server of held.splice(0)) server.close();
});

describe('resolveServerPort', () => {
  it('uses PORT when it is free', async () => {
    const port = await occupy();
    await new Promise<void>((resolve) => held.shift()?.close(() => resolve()));
    expect(await resolveServerPort({ PORT: String(port) })).toBe(port);
  });

  it('falls back to another free port when PORT is taken, never reusing the taken one', async () => {
    const taken = await occupy();
    const chosen = await resolveServerPort({ PORT: String(taken) });
    expect(chosen).not.toBe(taken);
    expect(chosen).toBeGreaterThan(0);
  });

  it('ignores an unparseable PORT and still returns a bindable port', async () => {
    const chosen = await resolveServerPort({ PORT: 'not-a-port' });
    expect(Number.isInteger(chosen)).toBe(true);
  });
});
