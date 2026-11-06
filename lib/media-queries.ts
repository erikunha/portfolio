import { MOBILE_BREAKPOINT_PX } from './breakpoint';

const MAX_WIDTH_STEP_PX = 0.02;
const MAX_WIDTH_DECIMALS = 2;

export const MOBILE_QUERY = `(max-width: ${(MOBILE_BREAKPOINT_PX - MAX_WIDTH_STEP_PX).toFixed(MAX_WIDTH_DECIMALS)}px)`;
