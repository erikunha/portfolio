import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import {
  NAVIGATION_STALL_WINDOW_MS,
  STALL_PRONE_BROWSER,
  WEBKIT_COOP_STALL_ANNOTATION,
} from './_helpers/navigation-stall';
import { errors, expect, test } from './_helpers/test';

const LOOPBACK_HOST = '127.0.0.1';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const SERVER_ERROR_STATUS = 500;
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const SHORT_NAVIGATION_TIMEOUT_MS = 1_500;
const PAST_WINDOW_MARGIN_MS = 1_500;
const PAST_WINDOW_NAVIGATION_TIMEOUT_MS = NAVIGATION_STALL_WINDOW_MS + PAST_WINDOW_MARGIN_MS;
const PAGE_ERROR_MESSAGE = 'deliberate page error';
const HEALTHY_PATH = '/healthy';
const SERVER_ERROR_PATH = '/server-error';
const MISSING_PATH = '/missing';
const HUNG_AFTER_HEADERS_PATH = '/hung-after-headers';
const SILENT_PATH = '/silent';
const PAGE_ERROR_PATH = '/page-error';
const PARTIAL_DOCUMENT = '<!doctype html><title>partial</title><p>the body never finishes';
const PAGE_ERROR_DOCUMENT = `<!doctype html><title>page error</title><script>throw new Error(${JSON.stringify(PAGE_ERROR_MESSAGE)});</script>`;

interface ControlServer {
  readonly origin: string;
  readonly hits: Map<string, number>;
  readonly close: () => Promise<void>;
}

async function startControlServer(): Promise<ControlServer> {
  const hits = new Map<string, number>();
  const sockets = new Set<Socket>();
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`).pathname;
    hits.set(path, (hits.get(path) ?? 0) + 1);
    if (path === SERVER_ERROR_PATH) {
      response.writeHead(SERVER_ERROR_STATUS, { 'content-type': HTML_CONTENT_TYPE });
      response.end('<!doctype html><title>server error</title>');
      return;
    }
    if (path === HUNG_AFTER_HEADERS_PATH) {
      response.writeHead(OK_STATUS, { 'content-type': HTML_CONTENT_TYPE });
      response.write(PARTIAL_DOCUMENT);
      return;
    }
    if (path === SILENT_PATH) return;
    if (path === PAGE_ERROR_PATH) {
      response.writeHead(OK_STATUS, { 'content-type': HTML_CONTENT_TYPE });
      response.end(PAGE_ERROR_DOCUMENT);
      return;
    }
    if (path === HEALTHY_PATH) {
      response.writeHead(OK_STATUS, { 'content-type': HTML_CONTENT_TYPE });
      response.end('<!doctype html><title>healthy</title><p>healthy');
      return;
    }
    response.writeHead(NOT_FOUND_STATUS, { 'content-type': HTML_CONTENT_TYPE });
    response.end('<!doctype html><title>not found</title>');
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, LOOPBACK_HOST, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://${LOOPBACK_HOST}:${port}`,
    hits,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

test.describe('the navigation stall guard leaves real failures alone', {
  tag: '@cross-browser',
}, () => {
  let control: ControlServer;

  test.beforeAll(async () => {
    control = await startControlServer();
  });

  test.afterAll(async () => {
    await control.close();
  });

  test.afterEach(() => {
    const recoveries = test
      .info()
      .annotations.filter((annotation) => annotation.type === WEBKIT_COOP_STALL_ANNOTATION);
    expect(recoveries, 'a control must never need the stall recovery').toEqual([]);
  });

  test('goto is wrapped on WebKit and is the unwrapped original elsewhere', async ({
    page,
    browserName,
  }) => {
    const original = Object.getPrototypeOf(page).goto;
    const wrapped = browserName === STALL_PRONE_BROWSER;
    expect(Object.hasOwn(page, 'goto')).toBe(wrapped);
    expect(page.goto === original).toBe(!wrapped);
  });

  test('a healthy page resolves with its status', async ({ page }) => {
    const response = await page.goto(`${control.origin}${HEALTHY_PATH}`);
    expect(response?.status()).toBe(OK_STATUS);
  });

  test('an HTTP 500 resolves goto with status 500', async ({ page }) => {
    const response = await page.goto(`${control.origin}${SERVER_ERROR_PATH}`);
    expect(response?.status()).toBe(SERVER_ERROR_STATUS);
  });

  test('an HTTP 404 resolves goto with status 404', async ({ page }) => {
    const response = await page.goto(`${control.origin}${MISSING_PATH}`);
    expect(response?.status()).toBe(NOT_FOUND_STATUS);
  });

  test('a page script error still fires pageerror', async ({ page }) => {
    const pageError = page.waitForEvent('pageerror');
    const response = await page.goto(`${control.origin}${PAGE_ERROR_PATH}`);
    expect(response?.status()).toBe(OK_STATUS);
    expect((await pageError).message).toContain(PAGE_ERROR_MESSAGE);
  });

  test('a response hung after its headers rejects with a TimeoutError', async ({ page }) => {
    control.hits.delete(HUNG_AFTER_HEADERS_PATH);
    await expect(
      page.goto(`${control.origin}${HUNG_AFTER_HEADERS_PATH}`, {
        timeout: SHORT_NAVIGATION_TIMEOUT_MS,
      }),
    ).rejects.toBeInstanceOf(errors.TimeoutError);
    expect(control.hits.get(HUNG_AFTER_HEADERS_PATH)).toBe(1);
  });

  test('a response hung after its headers is not retried past the stall window', async ({
    page,
  }) => {
    control.hits.delete(HUNG_AFTER_HEADERS_PATH);
    await expect(
      page.goto(`${control.origin}${HUNG_AFTER_HEADERS_PATH}`, {
        timeout: PAST_WINDOW_NAVIGATION_TIMEOUT_MS,
      }),
    ).rejects.toBeInstanceOf(errors.TimeoutError);
    expect(control.hits.get(HUNG_AFTER_HEADERS_PATH)).toBe(1);
  });

  test('a server that never answers rejects with a TimeoutError', async ({ page }) => {
    control.hits.delete(SILENT_PATH);
    await expect(
      page.goto(`${control.origin}${SILENT_PATH}`, { timeout: SHORT_NAVIGATION_TIMEOUT_MS }),
    ).rejects.toBeInstanceOf(errors.TimeoutError);
    expect(control.hits.get(SILENT_PATH)).toBe(1);
  });
});
