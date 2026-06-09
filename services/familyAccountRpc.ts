import { supabase } from './supabaseClient';

export interface ChildSetupResult {
  childName: string;
  childShareCode: string;
  childSlotsLimit: number;
}

type ChildPayload = {
  child_name?: string;
  child_share_code?: string;
  child_slots_limit?: number;
};

export async function createChildViaRpc(childName: string, parentPin: string): Promise<ChildSetupResult> {
  const { data, error } = await supabase.rpc('create_single_child_profile', {
    p_child_name: childName,
    p_parent_pin: parentPin