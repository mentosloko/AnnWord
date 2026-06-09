import { supabase } from '../supabase';
export interface ChildSetupResult { childName:string; childShareCode:string; childSlotsLimit:number }
const fail=(e:any)=>{ if(e) throw e; };
export const familyAccountService={
 async selectAccountMode(mode:any){ const { error }=await supabase.rpc('set_account_mode',{ p_mode:mode }); fail(error); },
 async createChild(childName:string,parentPin:string):