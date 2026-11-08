export const RAIN_HEAD_COLOR = '#1d6a2a';
export const RAIN_BODY_COLOR = '#072810';
export const RAIN_TAIL_FADE = 'rgba(0,0,0,0.10)';
export const RAIN_CANVAS_BLACK = '#000';
export const RAIN_FONT_FAMILY = '"JetBrains Mono", monospace';

export const RAIN_DESKTOP_PROFILE = { fontSize: 16, speed: 0.7, opacity: 0.28 } as const;
export const RAIN_MOBILE_PROFILE = { fontSize: 14, speed: 0.6, opacity: 0.22 } as const;

export const rainFont = (fontSize: number) => `${fontSize}px ${RAIN_FONT_FAMILY}`;
