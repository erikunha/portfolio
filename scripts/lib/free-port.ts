import { createServer } from 'node:net';

const DEFAULT_PORT = 3000;
const ANY_PORT = 0;

function listen(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(null));
    probe.listen(port, () => {
      const address = probe.address();
      const bound = typeof address === 'object' && address ? address.port : null;
      probe.close(() => resolve(bound));
    });
  });
}

export async function resolveServerPort(
  env: Record<string, string | undefined> = process.env,
): Promise<number> {
  const requested = Number.parseInt(env.PORT ?? '', 10);
  const preferred = Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_PORT;
  const free = await listen(preferred);
  if (free !== null) return free;
  const fallback = await listen(ANY_PORT);
  if (fallback === null) throw new Error('no free TCP port available for the gates server');
  return fallback;
}
