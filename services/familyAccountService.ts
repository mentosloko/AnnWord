import { supabase as s } from '../supabase';
export type ChildSetupResult = any;
export const familyAccountService = {
 async selectAccountMode(mode:any){ const r=await s.rpc('select_account_mode',{p_mode:mode}); if(r.error) throw r.error; return r.data||mode; },
 async createChild(n:string,p:string){ const r=await s.rpc('create_single_child_profile',{p_child_name:n.trim(),p_parent_pin:p}); if(r.error) throw r.error; const d