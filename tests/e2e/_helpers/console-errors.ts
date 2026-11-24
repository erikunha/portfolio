const INSECURE_PREFETCH_DENIAL = /^Prefetch request denied: URL must be secure \(HTTPS\)$/;
const TEST_SERVER_PROTOCOL = 'http:';

function protocolOf(pageUrl: string): string | undefined {
  try {
    return new URL(pageUrl).protocol;
  } catch {
    return undefined;
  }
}

/**
 * WebKit honours the `Speculation-Rules` header but refuses a prefetch from an
 * origin that is not secure, and logs that refusal as a console error. The e2e
 * server is plain http, production is https, so the refusal is a property of
 * the test origin and not of the page. The match is the exact message on an
 * http page only: the same message from an https page is a real defect and is
 * still reported, and so is any other prefetch failure.
 */
export function isExpectedConsoleError(text: string, pageUrl: string): boolean {
  return INSECURE_PREFETCH_DENIAL.test(text) && protocolOf(pageUrl) === TEST_SERVER_PROTOCOL;
}
