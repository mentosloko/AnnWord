import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { applyNotFoundMetadata, applyPageMetadata } from '../services/pageMetadata';

const read = (path: string) => readFileSync(path, 'utf8');

describe('security, SEO and routing contracts', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('ships canonical, social, referrer and browser CSP metadata', () => {
    const html = read('index.html');
    expect(html).toContain('rel="canonical" href="https://annword.ru/"');
    expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('name="robots" content="index,follow"');
  });

  it('publishes robots and sitemap with the canonical host', () => {
    const robots = read('public/robots.txt');
    const sitemap = read('public/sitemap.xml');
    expect(robots).toContain('Sitemap: https://annword.ru/sitemap.xml');
    expect(robots).toContain('Disallow: /admin');
    expect(sitemap).toContain('<loc>https://annword.ru/</loc>');
    expect(sitemap).toContain('<loc>https://annword.ru/kids/</loc>');
  });

  it('renders a dedicated client 404 instead of silently falling back to landing', () => {
    const entry = read('index.tsx');
    expect(entry).toContain('isKnownClientPath(pathname)');
    expect(entry).toContain('<NotFoundScreen />');
    expect(entry).toContain('Такой страницы нет');
    expect(entry).toContain('Ошибка 404');
  });

  it('uses route-specific titles and noindexes authenticated screens', () => {
    document.head.innerHTML = '<meta name="robots" content="index,follow"><meta property="og:title"><meta name="twitter:title"><meta property="og:url"><link rel="canonical">';
    applyPageMetadata('profile');
    expect(document.title).toBe('Прогресс и аккаунт — AnnWord');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    applyNotFoundMetadata();
    expect(document.title).toBe('Страница не найдена — AnnWord');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
  });

  it('gives public audience landing pages distinct titles and canonicals', () => {
    document.head.innerHTML = '<meta name="robots" content="index,follow"><meta property="og:title"><meta name="twitter:title"><meta property="og:url"><link rel="canonical">';
    window.history.replaceState({}, '', '/kids/');
    applyPageMetadata('landing');
    expect(document.title).toContain('AnnWord Kids');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://annword.ru/kids/');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow');
  });
});
