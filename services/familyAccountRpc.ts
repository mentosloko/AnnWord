import { supabase } from '../supabase';
export interface ChildSetupResult { childName: string; childShareCode: string; childSlotsLimit: number; }
export async function createChildViaRpc(childName: string): Promise<ChildSetupResult> { return { childName, childShareCode: '', childSlotsLimit: 1 }; }
export async function verifyParentPinViaRpc(pin: string): Promise<boolean> { const r = await supabase.rpc('verify_parent_pin', { p_pin: pin }); if (r.error) return