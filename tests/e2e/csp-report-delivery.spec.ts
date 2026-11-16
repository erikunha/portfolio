import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium, expect, test } from '@playwright/test';

const SINK_PATH = '/api/csp-report';
const REPORTING_API_CONTENT_TYPE = 'application/reports+json';
const BLOCKED_IMAGE = 'https://csp-probe.invalid/probe.png';
const BACKGROUND_SYNC_PERMISSION = 'background-sync';
const DELIVERED_STATUS = 'Success';
const CERT_DAYS = '1';
const CERT_SUBJECT = '/CN=localhost';
const CERT_ALT_NAME = 'subjectAltName=DNS:localhost';
const POLL_TIMEOUT_MS = 15_000;
const HTTP_REDIRECT_FLOOR = 300;
const LOOPBACK_HOST = '127.0.0.1';

interface SinkPost {
  contentType: string;
  status: number;
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

test.describe('csp violation reports', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Reporting API is Chromium only');

  test('a forced violation is delivered to the report endpoint the headers name', async ({
    baseURL,
  }) => {
    const upstream = new URL(baseURL ?? '');
    const sinkPosts: SinkPost[] = [];
    let directory: string | undefined;
    let front: https.Server | undefined;
    let browser: Browser | undefined;
    try {
      directory = mkdtempSync(join(tmpdir(), 'csp-report-'));
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
              });
            }
            outgoing.writeHead(answer.statusCode ?? 0, answer.headers);
            answer.pipe(outgoing);
          },
        );
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

      browser = await chromium.launch({
        args: [`--ignore-certificate-errors-spki-list=${spki}`],
      });
      const context = await browser.newContext();
      await context.grantPermissions([BACKGROUND_SYNC_PERMISSION], { origin });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const reportStatuses: string[] = [];
      cdp.on('Network.reportingApiReportUpdated', ({ report }) => {
        reportStatuses.push(`${report.destination}:${report.type}:${report.status}`);
      });
      await cdp.send('Network.enable');
      await cdp.send('Network.enableReportingApi', { enable: true });

      await page.goto(`${origin}/`);
      await page.evaluate((source) => {
        const image = document.createElement('img');
        image.src = source;
        document.body.append(image);
      }, BLOCKED_IMAGE);

      await expect
        .poll(() => reportStatuses, { timeout: POLL_TIMEOUT_MS })
        .toContain(`csp-endpoint:csp-violation:${DELIVERED_STATUS}`);
      expect(serverError).toBeUndefined();
      expect(sinkPosts.length).toBeGreaterThan(0);
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
