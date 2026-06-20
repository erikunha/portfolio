// Type declaration for the JS Stryker config so it can be imported in a typed test
// under the strict `allowJs: false` tsconfig (mirrors scripts/lib/transcript.d.mts).
// The test reads incremental/incrementalFile from the parsed object, not a string
// grep, so a commented-out config line cannot satisfy the assertion.
declare const config: Record<string, unknown>;
export default config;
