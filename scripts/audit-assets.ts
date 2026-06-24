import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md', '.yml', '.yaml']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', '.vercel']);
const ASSET_PATTERN = /['"`]((?:\/assets\/|assets\/)[^'"`\s)]+)['"`]/g;
const EXTERNAL_URL_PATTERN = /https?:\/\/[^'"`\s)]+/g;

type Finding = { file: string; value: string; line: number };

function walk(dir: string, files: string[] = []): string[] {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!IGNORED_DIRS.has(item.name)) walk(path.join(dir, item.name), files);
      continue;
    }
    if (item.isFile() && TEXT_EXTENSIONS.has(path.extname(item.name))) files.push(path.join(dir, item.name));
  }
  return files;
}

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function collect(pattern: RegExp, content: string, relativePath: string, captureGroup = 0): Finding[] {
  const findings: Finding[] = [];
  for (const match of content.matchAll(pattern)) {
    const value = match[captureGroup] || match[0];
    findings.push({ file: relativePath, value, line: lineNumber(content, match.index || 0) });
  }
  return findings;
}

const files = walk(ROOT);
const assetReferences: Finding[] = [];
const externalUrls: Finding[] = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(ROOT, file).replace(/\\/g, '/');
  assetReferences.push(...collect(ASSET_PATTERN, content, relativePath, 1));
  externalUrls.push(...collect(EXTERNAL_URL_PATTERN, content, relativePath));
}

const uniqueAssets = Array.from(new Set(assetReferences.map(item => item.value))).sort();
const uniqueExternalUrls = Array.from(new Set(externalUrls.map(item => item.value))).sort();

const report = {
  scannedFiles: files.length,
  assetReferenceCount: assetReferences.length,
  uniqueAssetCount: uniqueAssets.length,
  externalUrlCount: externalUrls.length,
  uniqueExternalUrlCount: uniqueExternalUrls.length,
  uniqueAssets,
  uniqueExternalUrls,
  assetReferences,
  externalUrls,
};

console.log(JSON.stringify(report, null, 2));
