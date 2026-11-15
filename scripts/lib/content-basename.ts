import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'content',
);

export const isTypeScriptModule = (name: string): boolean => /\.tsx?$/.test(name);
export const isTestModule = (name: string): boolean => /\.test\.tsx?$/.test(name);
export const isSchemaModule = (name: string): boolean => /^schemas\.tsx?$/.test(name);
export const isInfraModule = (name: string): boolean => /^_.+\.tsx?$/.test(name);
