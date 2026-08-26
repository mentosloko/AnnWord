import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { applyNotFoundMetadata, applyPageMetadata } from '../services/pageMetadata';

const read = (path: string) => readFileSync(path, 'utf8');

describe('security, SEO and routing contracts', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('ships canonical, social and referrer metadata with environment-aware CSP injection', () => {
    const html = read('index.html');
    const vite = read('vite.config.ts');
    expect(html).toContain('rel="canonical" href="https://annword.ru/"');
    expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"');
    expect(html).not.toContain('http-equiv="Content-Security-Policy"');
    expect(vite).toContain("name: 'annword-content-security-policy'");
    expect(vite).toContain("'http-equiv': 'Content-Security-Policy'");
    expect(vite).toContain("`connect-src ${connectSources.join(' ')}`");
    expect(vite).toContain("url.hostname !== '127.0.0.1' && url.hostname !== 'localhost'");
    expect(vite).toContain("...(e2eOrigin ? [] : ['upgrade-insecure-requests'])");
    expect(vite).toContain("https://cdn.jsdelivr.net");
    expect(vite).toContain("https://tessdata.projectnaptha.com");
    expect(vite).toContain("'wasm-unsafe-eval'");
    expect(vite).toContain("worker-src 'self' blob:");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('name="robots" content="index,follow"');
  });

  it('builds crawler-visible metadata into public route fallbacks and noindexes private fallbacks', () => {
    const vite = read('vite.config.ts');
    expect(vite).toContain('STATIC_PUBLIC_ENTRY_METADATA');
    expect(vite).toContain("title: 'AnnWord Kids — школьные английские слова играючи'");
    expect(vite).toContain("canonical: 'https://annword.ru/kids/'");
    expect(vite).toContain("canonical: 'https://annword.ru/teacher/'");
    expect(vite).toContain("canonical: 'https://annword.ru/practice/'");
    expect(vite).toContain("robots: 'noindex,nofollow'");
    expect(vite).toContain('rewriteStaticHtmlMetadata(indexHtml, staticMetadataForRoute(route))');
    expect(vite).toContain("title: 'Страница не найдена — AnnWord'");
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

  it('collects response-only blockers without hiding code-addressable production evidence', () => {
    const workflow = read('.github/workflows/production-security-seo-audit.yml');
    expect(workflow).toContain('CODE_EVIDENCE_READY=1');
    expect(workflow).toContain('HSTS_READY=0');
    expect(workflow).toContain('NOSNIFF_READY=0');
    expect(workflow).toContain('FRAME_ANCESTORS_READY=0');
    expect(workflow).toContain('WWW_REDIRECT_READY=0');
    expect(workflow).toContain('Response-only zeros are infrastructure/routing blockers');
    expect(workflow).toContain('test "${CODE_EVIDENCE_READY:-0}" = \'1\'');
    expect(workflow).not.toContain('test "${HSTS_READY:-0}" = \'1\'');
    expect(workflow).not.toContain('test "${NOSNIFF_READY:-0}" = \'1\'');
  });

  it('marks code evidence failed when a production document returns HTTP 4xx/5xx even with HTML content', () => {
    const workflow = read('.github/workflows/production-security-seo-audit.yml');
    expect(workflow).toContain('fetch_code_url()');
    expect(workflow).toContain('if curl -fsS "$url" > "$file"; then');
    expect(workflow).toContain('echo "FAIL: HTTP $label"');
    expect(workflow).toContain('CODE_EVIDENCE_READY=0');
    expect(workflow).toContain("fetch_code_url 'Kids route'");
    expect(workflow).toContain("fetch_code_url 'Teacher route'");
    expect(workflow).toContain("fetch_code_url 'Practice route'");
  });
});
