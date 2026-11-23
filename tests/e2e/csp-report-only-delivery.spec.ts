import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium, expect, guardBrowser, test } from './_helpers/test';

const SINK_PATH = '/api/csp-report';
const REPORTING_API_CONTENT_TYPE = 'application/reports+json';
const CONNECT_SRC_DIRECTIVE = 'connect-src';
const TRUSTED_TYPES_DIRECTIVE = 'require-trusted-types-for';
const ENFORCED_ONLY_HOST_URL = 'https://vitals.vercel-insights.com/';
const ROUTE_ALL_PATTERN = '**/*';
const REPORT_ONLY_DISPOSITION = 'report';
const CSP_VIOLATION_TYPE = 'csp-violation';
const BACKGROUND_SYNC_PERMISSION = 'background-sync';
const CERT_DAYS = '1';
const CERT_SUBJECT = '/CN=localhost';
const CERT_ALT_NAME = 'subjectAltName=DNS:localhost';
const POLL_TIMEOUT_MS = 15_000;
const HTTP_REDIRECT_FLOOR = 300;
const LOOPBACK_HOST = '127.0.0.1';

interface SinkPost {
  contentType: string;
  status: number;
  body: string;
}

interface ReportEntry {
  type?: string;
  body?: { disposition?: string; effectiveDirective?: string };
}

function reportEntries(post: SinkPost): ReportEntry[] {
  try {
    const parsed: unknown = JSON.parse(post.body);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selfSignedCertificate(directory: string): { key: Buffer; cert: Buffer; spki: string } {
  const keyFile = join(directory, 'key.pem');
  const certFile = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-days',
      CERT_DAYS,
      '-subj',
      CERT_SUBJECT,
      '-addext',
      CERT_ALT_NAME,
    ],
    { stdio: 'ignore' },
  );
  const cert = readFileSync(certFile);
  const spkiDer = new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' });
  return {
    key: readFileSync(keyFile),
    cert,
    spki: createHash('sha256').update(spkiDer).digest('base64'),
  };
}

test.describe('csp report-only probe', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Reporting API is Chromium only');

  test('a probe violation reaches the sink with disposition report', async ({ baseURL }) => {
    const upstream = new URL(baseURL ?? '');
    const sinkPosts: SinkPost[] = [];
    let directory: string | undefined;
    let front: https.Server | undefined;
    let browser: Browser | undefined;
    try {
      directory = mkdtempSync(join(tmpdir(), 'csp-report-only-'));
      const { key, cert, spki } = selfSignedCertificate(directory);
      const server = https.createServer({ key, cert }, (incoming, outgoing) => {
        const forwarded = http.request(
          {
            host: upstream.hostname,
            port: upstream.port,
            method: incoming.method,
            path: incoming.url,
            headers: { ...incoming.headers, host: upstream.host },
          },
          (answer) => {
            if (incoming.method === 'POST' && incoming.url === SINK_PATH) {
              sinkPosts.push({
                contentType: incoming.headers['content-type'] ?? '',
                status: answer.statusCode ?? 0,
                body: Buffer.concat(requestChunks).toString('utf8'),
              });
            }
            outgoing.writeHead(answer.statusCode ?? 0, answer.headers);
            answer.pipe(outgoing);
          },
        );
        const requestChunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => requestChunks.push(chunk));
        forwarded.on('error', () => outgoing.destroy());
        incoming.pipe(forwarded);
      });
      front = server;
      let serverError: Error | undefined;
      await new Promise<void>((resolve, reject) => {
        server.on('error', (error) => {
          serverError = error;
          reject(error);
        });
        server.listen(0, LOOPBACK_HOST, resolve);
      });
      const origin = `https://localhost:${(server.address() as AddressInfo).port}`;

      browser = guardBrowser(
        await chromium.launch({
          args: [`--ignore-certificate-errors-spki-list=${spki}`],
        }),
      );
      const context = await browser.newContext();
      await context.grantPermissions([BACKGROUND_SYNC_PERMISSION], { origin });
      await context.route(ENFORCED_ONLY_HOST_URL + ROUTE_ALL_PATTERN, (route) => route.abort());
      const page = await context.newPage();

      const response = await page.goto(`${origin}/`);
      const headers = response?.headers() ?? {};
      expect(headers['content-security-policy-report-only']).toContain(CONNECT_SRC_DIRECTIVE);
      expect(headers['content-security-policy-report-only']).not.toContain(TRUSTED_TYPES_DIRECTIVE);

      await page.evaluate(async (target) => {
        await fetch(target, { mode: 'no-cors' }).catch(() => undefined);
      }, ENFORCED_ONLY_HOST_URL);

      await expect
        .poll(
          () =>
            sinkPosts
              .flatMap(reportEntries)
              .filter(
                (entry) =>
                  entry.type === CSP_VIOLATION_TYPE &&
                  entry.body?.disposition === REPORT_ONLY_DISPOSITION &&
                  entry.body.effectiveDirective === CONNECT_SRC_DIRECTIVE,
              ).length,
          { timeout: POLL_TIMEOUT_MS },
        )
        .toBeGreaterThan(0);
      expect(serverError).toBeUndefined();
      for (const post of sinkPosts) {
        expect(post.contentType).toContain(REPORTING_API_CONTENT_TYPE);
        expect(post.status).toBeLessThan(HTTP_REDIRECT_FLOOR);
      }
    } finally {
      await browser?.close();
      if (front?.listening) {
        await new Promise<void>((resolve) => {
          front?.close(() => resolve());
          front?.closeAllConnections();
        });
      }
      if (directory) rmSync(directory, { recursive: true, force: true });
    }
  });
});
