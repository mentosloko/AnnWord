import {
  PRODUCT_ENTRY_URLS,
  getProductEntryPathFromPathname,
  type ProductEntryPath,
} from './productEntry';

export type ClientEntryPath = ProductEntryPath;

export const getEntryPathUrl = (entryPath: ClientEntryPath): string => PRODUCT_ENTRY_URLS[entryPath];

export const getEntryPathFromPathname = (pathname: string): ClientEntryPath => getProductEntryPathFromPathname(pathname);

export const getInitialEntryPath = (): ClientEntryPath => {
  if (typeof window === 'undefined') return 'home';
  return getEntryPathFromPathname(window.location.pathname);
};
