import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const MAX_ROUTE_TOTAL_KB = 175;

const FRAMEWORK_FLOOR_KB = 142.2;
const FRAMEWORK_FLOOR_TOLERANCE_KB = 2;

const MANIFEST = '.next/diagnostics/route-bundle-stats.json';

const BYTES_PER_KB = 1024;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!existsSync(MANIFEST)) {
  fail(
    `${MANIFEST} does not exist. Run \`pnpm build\` first — this gate reads the build's own route stats, and a missing manifest must never read as a pass.`,
  );
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));

if (!Array.isArray(manifest) || manifest.length === 0) {
  fail(`${MANIFEST} lists no routes. The build emitted no route stats — refusing to pass.`);
}

const gzipKb = (files) => {
  let bytes = 0;
  for (const file of files) {
    if (!existsSync(file)) {
      fail(
        `${MANIFEST} names a chunk that is not on disk: ${file}\n` +
          'The manifest and .next/static are out of sync — rebuild rather than trust this reading.',
      );
    }
    bytes += gzipSync(readFileSync(file)).length;
  }
  return bytes / BYTES_PER_KB;
};

const routes = manifest.map((row) => ({
  route: row.route,
  total: gzipKb((row.firstLoadChunkPaths ?? []).filter((file) => file.endsWith('.js'))),
}));

const lightest = Math.min(...routes.map((row) => row.total));

if (lightest < FRAMEWORK_FLOOR_KB - FRAMEWORK_FLOOR_TOLERANCE_KB) {
  fail(
    `The lightest route ships ${lightest.toFixed(1)} KB, below the ${FRAMEWORK_FLOOR_KB} KB framework floor this gate subtracts.\n` +
      'FRAMEWORK_FLOOR_KB is stale: Next or React got smaller, so every app-owned figure this gate prints is inflated\n' +
      `and the ${(MAX_ROUTE_TOTAL_KB - FRAMEWORK_FLOOR_KB).toFixed(1)} KB of app-owned headroom is being read against the wrong baseline. Re-measure it (build a bare\n` +
      'hello-world app on the current Next + React and take its shared first-load JS) rather than lowering the constant\n' +
      'to whatever passes.',
  );
}

console.log(
  `framework floor (measured, hello-world Next + React): ${FRAMEWORK_FLOOR_KB} KB gzipped`,
);
console.log('');

const failures = [];

const appHeadroomKb = (MAX_ROUTE_TOTAL_KB - FRAMEWORK_FLOOR_KB).toFixed(1);

for (const { route, total } of routes) {
  const appOwned = total - FRAMEWORK_FLOOR_KB;
  const over = total > MAX_ROUTE_TOTAL_KB;
  console.log(
    `${(over ? 'FAIL' : 'ok').padEnd(5)} ${route.padEnd(28)} ${total.toFixed(1).padStart(6)} KB total  (${appOwned.toFixed(1)} KB app-owned)`,
  );
  if (over) failures.push({ route, total, appOwned });
}

if (failures.length === 0) {
  console.log(
    `\nOK  every route under ${MAX_ROUTE_TOTAL_KB} KB total (${appHeadroomKb} KB of app-owned headroom above the floor)`,
  );
  process.exit(0);
}

const lines = [''];
for (const { route, total, appOwned } of failures) {
  lines.push(
    `FAIL: ${route} ships ${total.toFixed(1)} KB total, over the ${MAX_ROUTE_TOTAL_KB} KB budget.`,
    `      ${FRAMEWORK_FLOOR_KB} KB of that is the framework floor you do not control; ${appOwned.toFixed(1)} KB is app-owned,`,
    `      against ${appHeadroomKb} KB of headroom. Cut app-owned JS — the floor is not yours to shrink.`,
  );
}
lines.push(
  '',
  'check-bundle-size.mjs cannot catch this: it sums every chunk in .next/static/chunks globally, so a route',
  'reusing chunks that already exist for / adds ~0 new bytes and that gate stays green regardless.',
  '',
  `The ${MAX_ROUTE_TOTAL_KB} KB total is the ONLY assertion here. App-owned is reported, never gated: it is`,
  'total minus a constant, so an app-owned threshold would be a second threshold on the same axis and could',
  `never fire on its own. If a route is over, ${appHeadroomKb} KB is the app-owned budget that actually binds.`,
);
fail(lines.join('\n'));
