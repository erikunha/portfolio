import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CONTENT_DIR,
  isInfraModule,
  isSchemaModule,
  isTestModule,
  isTypeScriptModule,
} from '../../scripts/content-basename.mjs';

export const isPublishedSurface = (file: string) => {
  const name = path.basename(file);
  return (
    isTypeScriptModule(name) && !isTestModule(name) && !isSchemaModule(name) && !isInfraModule(name)
  );
};

export const readContentSurfaces = (): Array<[string, string]> =>
  readdirSync(CONTENT_DIR, { recursive: true })
    .map(String)
    .filter(isPublishedSurface)
    .map((file) => [`content/${file}`, readFileSync(path.join(CONTENT_DIR, file), 'utf-8')]);
