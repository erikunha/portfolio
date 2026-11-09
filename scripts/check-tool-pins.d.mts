export interface Pin {
  name: string;
  file: string;
  pattern: RegExp;
  latest: () => Promise<string>;
  bumpHint: string;
}

export interface PinStatus {
  name: string;
  current: string;
  latest: string;
  behind: boolean;
}

export declare function parseVersion(raw: string): [number, number, number];
export declare function isBehind(current: string, latest: string): boolean;
export declare function readPin(fileText: string, pattern: RegExp, name: string): string;
export declare const PINS: Pin[];
export declare function buildHeaders(
  url: string,
  token: string | undefined,
): Record<string, string>;
