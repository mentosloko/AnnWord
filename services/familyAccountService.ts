import { supabase } from '../supabase';
import { AccountMode } from '../types';

export interface ChildSetupResult {
  childName: string;
  childShareCode: string;
  childSlotsLimit: number;
}

type ChildRpcResponse = {
  child_name?: string;
  childName?: string;
  child_share_code?: string;
  childShareCode?: string;
  child_slots_limit?: number;
  childSlotsLimit?: number;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
};

const normalizeChildSetupResult = (data: ChildRpcResponse | null): ChildSetupResult => {
  if (!data) {
    throw new Error('Не удалось создать профиль ребёнка.');
  }

  const childName = data.child_name ?? data.childName ?? '';
  const childShareCode = data.child_share_code ?? data.childShareCode ?? '';
  const childSlotsLimit = data.child_slots_limit ?? data.childSlotsLimit ?? 1;

  if (!childName) {
    throw new Error('Сервер не вернул имя ребёнка.');
  }

  return {
    childName,
    childShareCode,
    childSlotsLimit
  };
};

const validateChildName = (childName: string): string => {
  const normalized = childName.trim();

  if (!normalized) {
    throw new Error('Укажите имя ребёнка.');
  }

  if (normalized.length > 40) {
    throw new Error('Имя ребёнка должно быть не длиннее 40 символов.');
  }

  return normalized;
};

const validateParentPin = (pin: string): string => {
  const normalized = pin.trim();

  if (!/^\d{4}$/.test(normalized)) {
    throw new Error('PIN должен состоять из 4 цифр.');
  }

  return normalized;
};

export const familyAccountService = {
  async selectAccountMode(mode: AccountMode): Promise<void> {
    const role = mode === 'parent' ? 'parent' : mode === 'teacher' ? 'teacher' : 'user';
    const featureFlags = mode === 'player' ? {} : { adultRoom: true };

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        account_mode: mode,
        feature_flags: featureFlags
      })
      .eq('id', (await supabase.auth.getSession()).data.session?.user.id);

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось выбрать тип аккаунта.'));
    }
  },

  async createChild(childName: string, pin: string): Promise<ChildSetupResult> {
    const normalizedName = validateChildName(childName);
    const normalizedPin = validateParentPin(pin);

    const { data, error } = await supabase.rpc('create_single_child_profile', {
      p_child_name: normalizedName,
      p_parent_pin: normalizedPin
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось создать профиль ребёнка.'));
    }

    return normalizeChildSetupResult(data as ChildRpcResponse | null);
  },

  async verifyParentPin(pin: string): Promise<boolean> {
    const normalizedPin = validateParentPin(pin);

    const { data, error } = await supabase.rpc('verify_parent_pin', {
      p_pin: normalizedPin
    });

    if (error) {
      throw new Error(getErrorMessage(error, 'Не удалось проверить PIN.'));
    }

    return data === true;
  }
};

export default familyAccountService;
