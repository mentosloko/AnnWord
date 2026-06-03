import { supabase } from '../supabase';
import { AccountMode } from '../types';

export interface ChildSetupResult {
  childName: string;
  childShareCode: string;
  childSlotsLimit: number;
}

const readableError = (error: any, fallback: string): Error => {
  const message = String(error?.message || '');
  if (/one child|один ребёнок/i.test(message)) return new Error('В тестовой версии доступен один ребёнок.');
  if (/pin/i.test(message)) return new Error('PIN должен состоять из 4 цифр.');
  if (/already selected/i.test(message)) return new Error('Тип аккаунта уже выбран.');
  return new Error(message || fallback);
};

export const familyAccountService = {
  async selectAccountMode(mode: AccountMode): Promise<AccountMode> {
    const { data, error } = await supabase.rpc('select_account_mode', { p_mode: mode });
    if (error) throw readableError(error, 'Не удалось сохранить тип аккаунта.');
    return String(data) as AccountMode;
  },

  async createChild(childName: string, parentPin: string): Promise<ChildSetupResult> {
    const normalizedName = childName.trim();
    if (!normalizedName) throw new Error('Укажите имя ребёнка.');
    if (!/^\d{4}$/.test(parentPin)) throw new Error('PIN должен состоять из 4 цифр.');
    const { data, error } = await supabase.rpc('create_single_child_profile', {
      p_child_name: normalizedName,
      p_parent_pin: parentPin,
    });
    if (error) throw readableError(error, 'Не удалось создать профиль ребёнка.');
    return {
      childName: String(data?.child_name || normalizedName),
      childShareCode: String(data?.child_share_code || ''),
      childSlotsLimit: Number(data?.child_slots_limit || 1),
    };
  },

  async verifyParentPin(pin: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_parent_pin', { p_pin: pin });
    if (error) throw readableError(error, 'Не удалось проверить PIN.');
    return data === true;
  },
};
