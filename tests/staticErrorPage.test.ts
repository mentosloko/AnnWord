import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('static hosting error page', () => {
  it('keeps a noindex AnnWord fallback for Object Storage ErrorDocument', () => {
    const html = readFileSync('public/error.html', 'utf8');
    expect(html).toContain('<title>Страница не найдена — AnnWord</title>');
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('href="/"');
    expect(html).toContain('>На главную</a>');
  });
});
