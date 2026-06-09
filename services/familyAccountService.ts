import { supabase } from '../supabase';
export interface ChildSetupResult { childName: string; childShareCode: string; childSlotsLimit: number; }
const fail = (e: any) => { if (e) throw e; };
const k = (s: string) => s;
export const familyAccountService = {
  async selectAccountMode(mode: any): Promise<void> {
    const r = await supabase.rpc('set_account_mode', { [k('p_mode')]: mode });
    fail(r.error);
  },
  async createChild(name: string, code: string): Promise<ChildSetupResult> {
    const r = await supabase.rpc('create_single_child_profile', { [k('p_child_name')]: name, [k('p_parent_pin')]: code });
    fail(r.error);
    const