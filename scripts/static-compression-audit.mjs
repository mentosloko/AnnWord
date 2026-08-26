import fs from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const DIST_DIR = path.resolve(process.argv[2] || 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const COMPRESSIBLE_EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg']);

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Static compression audit: ${DIST_DIR} does not exist. Build the frontend first.`);
  process.exit(1);
}

const files = [];
const visit = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (COMPRESSIBLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
};
visit(DIST_DIR);

const rows = files.map(file => {
  const input = fs.readFileSync(file);
  const gzip = gzipSync(input, { level: 9 });
  const brotli = brotliCompressSync(input, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    },
  });
  return {
    file: path.relative(DIST_DIR, file).replaceAll(path.sep, '/'),
    rawBytes: input.byteLength,
    gzipBytes: gzip.byteLength,
    brotliBytes: brotli.byteLength,
  };
});

const totals = rows.reduce((sum, row) => ({
  rawBytes: sum.rawBytes + row.rawBytes,
  gzipBytes: sum.gzipBytes + row.gzipBytes,
  brotliBytes: sum.brotliBytes + row.brotliBytes,
}), { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 });

const percentSaved = (compressed, raw) => raw > 0 ? Number(((1 - compressed / raw) * 100).toFixed(1)) : 0;
const report = {
  files: rows.length,
  assetDirectoryPresent: fs.existsSync(ASSETS_DIR),
  ...totals,
  gzipSavingsPct: percentSaved(totals.gzipBytes, totals.rawBytes),
  brotliSavingsPct: percentSaved(totals.brotliBytes, totals.rawBytes),
  largest: rows.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10),
};

console.log(`STATIC_COMPRESSION_REPORT ${JSON.stringify(report)}`);

if (rows.length === 0) {
  console.error('Static compression audit found no compressible frontend assets.');
  process.exit(1);
}
