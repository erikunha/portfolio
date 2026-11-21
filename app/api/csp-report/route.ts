import { z } from 'zod';

import {
  blockedHost,
  cspDirective,
  cspDisposition,
  documentPath,
  isExtensionSource,
} from '@/lib/csp-violation';
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
const MAX_LOGGED_VIOLATIONS = 10;

const LEGACY_CONTENT_TYPE = 'application/csp-report';
const REPORTING_API_CONTENT_TYPE = 'application/reports+json';
const CSP_VIOLATION_TYPE = 'csp-violation';

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
      effectiveDirective: cspDirective(violation.effectiveDirective),
      blockedHost: blockedHost(violation.blocked),
      documentPath: documentPath(violation.documentUri),
      disposition: cspDisposition(violation.disposition),
    });
  }
  if (loggable.length > MAX_LOGGED_VIOLATIONS) {
    log.warn(TRUNCATED_MESSAGE, { dropped: loggable.length - MAX_LOGGED_VIOLATIONS });
  }
  return new Response(null, { status: HTTP_STATUS.noContent });
}

export const POST = withRateLimit(handleReport, getCspReportLimit, CSP_REPORT_RATE_LIMIT_MESSAGE);
