import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  CONTENT_DIR,
  isSchemaModule,
  isTestModule,
  isTypeScriptModule,
} from './content-basename.ts';

export function listContentFiles(root: string = CONTENT_DIR): string[] {
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((file) => {
      const name = path.basename(file);
      return isTypeScriptModule(name) && !isTestModule(name) && !isSchemaModule(name);
    })
    .map((file) => path.join(root, file))
    .sort();
}
