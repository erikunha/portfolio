import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTENT_DIR = path.join(REPO_ROOT, 'content');

export const CONTENT_INFRA = /^(schemas|_.+)\.tsx?$/;

export const isPublishedSurface = (file: string) => {
  const name = path.basename(file);
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !CONTENT_INFRA.test(name);
};

export const readContentSurfaces = (): Array<[string, string]> =>
  readdirSync(CONTENT_DIR, { recursive: true })
    .map(String)
    .filter(isPublishedSurface)
    .map((file) => [`content/${file}`, readFileSync(path.join(CONTENT_DIR, file), 'utf-8')]);
