import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getKnownClientPaths } from '../services/clientRoute';

const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const routes = Array.from(new Set(getKnownClientPaths())).filter(route => route !== '/');

for (const route of routes) {
  const safeSegments = route
    .split('/')
    .filter(Boolean)
    .filter(segment => segment !== '.' && segment !== '..');
  if (!safeSegments.length) continue;
  const routeDir = join(distDir, ...safeSegments);
  await mkdir(routeDir, { recursive: true });
  await writeFile(join(routeDir, 'index.html'), indexHtml, 'utf8');
}

console.log(`Generated ${routes.length} SPA route entry files for Yandex Object Storage.`);
