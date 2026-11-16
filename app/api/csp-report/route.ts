import { z } from 'zod';

import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { getCspReportLimit } from '@/lib/rate-limit';
import { withRateLimit } from '@/lib/server/rate-limit-guard';
import { readBoundedBody } from '@/lib/server/read-body';
import { err } from '@/lib/server/route';

const MAX_CSP_REPORT_BODY_BYTES = 4096;
const CSP_REPORT_RATE_LIMIT_MESSAGE = 'too many reports';
const VIOLATION_MESSAGE = 'csp violation';
const TRUNCATED_MESSAGE = 'csp violations truncated';
const UNKNOWN = 'unknown';
const MAX_LOGGED_VIOLATIONS = 10;
const MAX_LOGGED_FIELD_CHARS = 256;
const WEB_PROTOCOLS = ['http:', 'https:'];

const LEGACY_CONTENT_TYPE = 'application/csp-report';
const REPORTING_API_CONTENT_TYPE = 'application/reports+json';
const CSP_VIOLATION_TYPE = 'csp-violation';

const EXTENSION_SCHEME = /^(?:[a-z]+-)*extension:/i;
const DIRECTIVE_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const SOURCE_KEYWORD = /^[a-z][a-z-]{0,31}$/;
const SCHEME_SUFFIX = /:$/;
const DISPOSITIONS = ['enforce', 'report'] as const;

type Disposition = (typeof DISPOSITIONS)[number] | typeof UNKNOWN;

const OptionalText = z.string().optional().catch(undefined);

const LegacyEnvelope = z.object({
  'csp-report': z.object({
    'effective-directive': OptionalText,
    'violated-directive': OptionalText,
    'blocked-uri': OptionalText,
    'source-file': OptionalText,
    'document-uri': OptionalText,
    disposition: OptionalText,
  }),
});

const ReportingApiEntry = z.object({
  type: z.string(),
  body: z.object({
    effectiveDirective: OptionalText,
    blockedURL: OptionalText,
    sourceFile: OptionalText,
    documentURL: OptionalText,
    disposition: OptionalText,
  }),
});

interface Violation {
  effectiveDirective?: string | undefined;
  blocked?: string | undefined;
  sourceFile?: string | undefined;
  documentUri?: string | undefined;
  disposition?: string | undefined;
}

function mediaType(req: Request): string {
  return (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function legacyViolations(raw: unknown): Violation[] {
  const parsed = LegacyEnvelope.safeParse(raw);
  if (!parsed.success) return [];
  const report = parsed.data['csp-report'];
  return [
    {
      effectiveDirective: report['effective-directive'] ?? report['violated-directive'],
      blocked: report['blocked-uri'],
      sourceFile: report['source-file'],
      documentUri: report['document-uri'],
      disposition: report.disposition,
    },
  ];
}

function reportingApiViolations(raw: unknown): Violation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): Violation[] => {
    const parsed = ReportingApiEntry.safeParse(entry);
    if (!parsed.success || parsed.data.type !== CSP_VIOLATION_TYPE) return [];
    const { body } = parsed.data;
    return [
      {
        effectiveDirective: body.effectiveDirective,
        blocked: body.blockedURL,
        sourceFile: body.sourceFile,
        documentUri: body.documentURL,
        disposition: body.disposition,
      },
    ];
  });
}

function isExtensionSource(value: string | undefined): boolean {
  return value !== undefined && EXTENSION_SCHEME.test(value.trim());
}

function parseUrl(value: string | undefined): URL | null {
  if (value === undefined) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function capField(value: string): string {
  return value.slice(0, MAX_LOGGED_FIELD_CHARS);
}

function blockedHost(blocked: string | undefined): string {
  const url = parseUrl(blocked);
  if (url) return capField(url.host || url.protocol.replace(SCHEME_SUFFIX, ''));
  return blocked !== undefined && SOURCE_KEYWORD.test(blocked) ? blocked : UNKNOWN;
}

function documentPath(documentUri: string | undefined): string {
  const url = parseUrl(documentUri);
  return url && WEB_PROTOCOLS.includes(url.protocol) ? capField(url.pathname) : UNKNOWN;
}

function directive(value: string | undefined): string {
  return value !== undefined && DIRECTIVE_NAME.test(value) ? value : UNKNOWN;
}

function disposition(value: string | undefined): Disposition {
  return DISPOSITIONS.find((known) => known === value) ?? UNKNOWN;
}

async function handleReport(req: Request): Promise<Response> {
  const type = mediaType(req);
  if (type !== LEGACY_CONTENT_TYPE && type !== REPORTING_API_CONTENT_TYPE) {
    return err({
      requestId: crypto.randomUUID(),
      status: HTTP_STATUS.badRequest,
      code: 'invalid_body',
      message: 'unsupported content type',
    });
  }

  const bounded = await readBoundedBody(req, MAX_CSP_REPORT_BODY_BYTES);
  if (!bounded.ok) {
    return err({
      requestId: crypto.randomUUID(),
      status: bounded.status,
      code: bounded.code,
      message: bounded.message,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bounded.bytes ?? new Uint8Array()));
  } catch {
    return err({
      requestId: crypto.randomUUID(),
      status: HTTP_STATUS.badRequest,
      code: 'invalid_json',
      message: 'invalid request body',
    });
  }

  const violations =
    type === LEGACY_CONTENT_TYPE ? legacyViolations(raw) : reportingApiViolations(raw);
  const loggable = violations.filter(
    (violation) =>
      violation.effectiveDirective !== undefined &&
      !isExtensionSource(violation.blocked) &&
      !isExtensionSource(violation.sourceFile),
  );
  for (const violation of loggable.slice(0, MAX_LOGGED_VIOLATIONS)) {
    log.warn(VIOLATION_MESSAGE, {
      effectiveDirective: directive(violation.effectiveDirective),
      blockedHost: blockedHost(violation.blocked),
      documentPath: documentPath(violation.documentUri),
      disposition: disposition(violation.disposition),
    });
  }
  if (loggable.length > MAX_LOGGED_VIOLATIONS) {
    log.warn(TRUNCATED_MESSAGE, { dropped: loggable.length - MAX_LOGGED_VIOLATIONS });
  }
  return new Response(null, { status: HTTP_STATUS.noContent });
}

export const POST = withRateLimit(handleReport, getCspReportLimit, CSP_REPORT_RATE_LIMIT_MESSAGE);
