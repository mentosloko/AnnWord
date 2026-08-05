import type { ClientEntryPath } from './clientEntryPath';
import type { AccountMode } from '../types';

// Keep the selected product path until the confirmed account has been created on the server.
const STORAGE_KEY = 'annword_registration_intent_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

type RegistrationIntent = { entryPath: 'practice' | 'kids' | 'teacher'; accountMode: AccountMode; createdAt: number };

const toMode = (entryPath: ClientEntryPath): AccountMode | null => entryPath === 'kids' ? 'parent' : entryPath === 'teacher' ? 'teacher' : entryPath === 'practice' ? 'player' : null;

export const rememberRegistrationIntent = (entryPath: ClientEntryPath): void => {
  const accountMode = toMode(entryPath);
  const registrationEntryPath = entryPath === 'practice' || entryPath === 'kids' || entryPath === 'teacher' ? entryPath : null;
  if (!accountMode || !registrationEntryPath || typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ entryPath: registrationEntryPath, accountMode, createdAt: Date.now() } satisfies RegistrationIntent)); } catch { /* optional preference */ }
};

export const readRegistrationIntent = (): RegistrationIntent | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<RegistrationIntent> : null;
    if (!parsed || !['practice', 'kids', 'teacher'].includes(String(parsed.entryPath)) || !['player', 'parent', 'teacher'].includes(String(parsed.accountMode)) || typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > TTL_MS) {
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

export const registrationEntryPathForMode = (mode?: AccountMode | null): ClientEntryPath => mode === 'parent' ? 'kids' : mode === 'teacher' ? 'teacher' : mode === 'player' ? 'practice' : 'home';
