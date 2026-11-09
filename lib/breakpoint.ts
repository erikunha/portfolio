const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

export const MOBILE_BREAKPOINT_PX = 768;

export function detectMobileFromUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return MOBILE_REGEX.test(userAgent);
}
