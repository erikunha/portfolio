export declare function rewriteText(source: string): string;
export declare function findFiction(text: string): string | null;
export declare function referencedMirrorPaths(text: string): string[];
export declare function referencedHookSiblings(text: string): string[];
export declare function insertNote(text: string, note: string): string;

export interface UnresolvedRefsInput {
  to: string;
  text: string;
  present: Set<string>;
  exists: (path: string) => boolean;
}
export declare function unresolvedRefs(input: UnresolvedRefsInput): string[];

export interface MirrorSource {
  from: string;
  to: string;
  mode: 'text' | 'binary';
  prepend?: string;
}
export declare function collectSources(): MirrorSource[];

export declare function run(opts: { check: boolean }): void;
