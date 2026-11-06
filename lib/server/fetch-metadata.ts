const FETCH_SITE_HEADER = 'sec-fetch-site';
const OWN_PAGE_FETCH_SITES: ReadonlySet<string> = new Set(['same-origin', 'none']);

export function isCrossSiteRequest(req: Request): boolean {
  const site = req.headers.get(FETCH_SITE_HEADER);
  return site !== null && !OWN_PAGE_FETCH_SITES.has(site);
}
