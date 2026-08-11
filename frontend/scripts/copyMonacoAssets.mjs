import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(
  new URL('../../node_modules/monaco-editor/min/vs/', import.meta.url),
);
const destination = fileURLToPath(
  new URL('../public/monaco/vs/', import.meta.url),
);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
