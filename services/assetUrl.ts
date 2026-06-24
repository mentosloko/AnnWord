/// <reference types="vite/client" />

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const rawAssetsBaseUrl = viteEnv.VITE_ASSETS_BASE_URL || '';

export const assetsBaseUrl = rawAssetsBaseUrl.replace(/\/+$/, '');

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:');

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (!assetsBaseUrl || isAbsoluteUrl(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${assetsBaseUrl}${normalizedPath}`;
}
