import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const previewPath = 'public/social/annword-og.png';

describe('launch social preview', () => {
  it('publishes a large Open Graph and Twitter preview', () => {
    expect(html).toContain('<meta property="og:image" content="https://annword.ru/social/annword-og.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:image:type" content="image/png" />');
    expect(html).toContain('<meta property="og:image:alt"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="twitter:image" content="https://annword.ru/social/annword-og.png" />');
    expect(html).toContain('<meta name="twitter:image:alt"');
  });

  it('keeps the committed preview at exactly 1200x630 PNG', () => {
    const png = readFileSync(previewPath);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.byteLength).toBeGreaterThan(50_000);
  });
});
