import { supabase } from '../supabase';
import { AccountMode } from '../types';
export interface ChildSetupResult { childName: string; childShareCode: string; childSlotsLimit: number; }
const err = (e: any, f: string) => new Error(String(e?.message || f));
export const familyAccountService = {
  async selectAccountMode(mode: AccountMode): Promise<AccountMode> { const r = await supabase.rpc('select_account_mode', { p_mode: mode }); if (r.error) throw err(r.error, 'mode