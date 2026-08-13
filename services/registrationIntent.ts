import type { ClientEntryPath } from './clientEntryPath';
import type { AccountMode } from '../types';
import {
  getAccountModeForRegistrationEntry,
  getCanonicalEntryPathForAccountMode,
  getRegistrationEntryPath,
  isRegistrationEntryPath,
  type RegistrationEntryPath,
} from './productEntry';

// Keep the selected product path until the confirmed account and its server profile have been created.
const STORAGE_KEY = 'annword_registration_intent_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

type RegistrationIntent = { entryPath: RegistrationEntryPath; accountMode: AccountMode; createdAt: number };

export const rememberRegistrationIntent = (entryPath: ClientEntryPath): void => {
  if (typeof window === 'undefined') return;
  const registrationEntryPath = getRegistrationEntryPath(entryPath);
  const accountMode = getAccountModeForRegistrationEntry(registrationEntryPath);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ entryPath: registrationEntryPath, accountMode, createdAt: Date.now() } satisfies RegistrationIntent)); } catch { /* optional preference */ }
};

export const readRegistrationIntent = (): RegistrationIntent | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<RegistrationIntent> : null;
    const validEntry = isRegistrationEntryPath(parsed?.entryPath);
    const expectedMode = validEntry ? getAccountModeForRegistrationEntry(parsed.entryPath) : null;
    if (!parsed || !validEntry || parsed.accountMode !== expectedMode || typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as RegistrationIntent;
  } catch { return null; }
};

export const clearRegistrationIntent = (): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};

export const registrationEntryPathForMode = (mode?: AccountMode | null): ClientEntryPath => getCanonicalEntryPathForAccountMode(mode);
