import { supabase } from '../supabase';
import { mapProfileFromDB } from './profileMapper';
import { UserProfile } from '../types';

export const PET_MOOD_CLOCK_ENDPOINT = 'pet-mood-decay';

export const runPetMoodClock = async (action: 'decay' | 'touch'): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase.functions.invoke(PET_MOOD_CLOCK_ENDPOINT, { body: { action } });
    if (error || !data?.profile) return null;
    return mapProfileFromDB(data.profile);
  } catch (error) {
    console.warn('Pet mood clock unavailable:', error);
    return null;
  }
};
