import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
);

export const isTypeScriptModule = (name) => /\.tsx?$/.test(name);
export const isTestModule = (name) => /\.test\.tsx?$/.test(name);
export const isSchemaModule = (name) => /^schemas\.tsx?$/.test(name);
export const isInfraModule = (name) => /^_.+\.tsx?$/.test(name);
