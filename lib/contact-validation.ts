export function isHoneypotTripped(body: { field_company?: unknown }): boolean {
  return typeof body.field_company === 'string' && body.field_company.trim().length > 0;
}
