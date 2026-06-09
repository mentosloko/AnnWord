import { supabase } from '../supabase';
import { AccountMode } from '../types';

export interface ChildSetupResult {
  childName: string;
  childShareCode: string;
  childSlotsLimit: number;
}

const readableError = (error: any, fallback: string): Error => {
  const message = String(error?.message || '');
  if (/one child/i.test(message)) return new Error('One Premium seat covers one child. Add another child