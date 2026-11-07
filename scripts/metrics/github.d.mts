export interface GithubClient {
  request(path: string, options?: RequestOptions): Promise<Response>;
  json<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  paginate<T = unknown>(
    path: string,
    options?: {
      params?: Record<string, string | number>;
      pick?: (body: never) => T[];
      stopWhen?: (page: T[]) => boolean;
    },
  ): Promise<T[]>;
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  text(path: string): Promise<string>;
}

export interface RequestOptions {
  params?: Record<string, string | number>;
  method?: string;
  body?: unknown;
  accept?: string;
  redirect?: 'manual' | 'follow';
}

export declare function parseNextLink(header: string | null | undefined): string | null;
export declare function createGithubClient(options: {
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
}): GithubClient;
export declare function resolveToken(options?: {
  env?: Record<string, string | undefined>;
  execFile?: (file: string, args: string[]) => string;
}): string;
export declare function parseRemoteUrl(url: string): string | null;
export declare function resolveRepo(options?: {
  arg?: string;
  env?: Record<string, string | undefined>;
  execFile?: (file: string, args: string[]) => string;
}): string;
