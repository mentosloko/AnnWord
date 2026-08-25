import type { AccountMode, UserProfile } from '../types';
import { backendApiRequest } from './backendApiClient';
import { legalConsentService } from './legalConsentService';
import { mentorRoomService, normalizeMentorRoomResult, type MentorRoomLoadResult } from './mentorRoomService';

export interface ChildSetupResult {
  childName: string;
  childShareCode: string;
  childSlotsLimit: number;
}

export interface TeacherConnection {
  teacherId: string;
  name: string;
  email: string;
  connectedAt: string;
}

type ChildRpcResponse = {
  child_name?: string;
  childName?: string;
  child_share_code?: string;
  childShareCode?: string;
  child_slots_limit?: number;
  childSlotsLimit?: number;
};

type AccessCheckResponse = {
  ok?: boolean;
};

type AdultRoomResponse = {
  ok?: boolean;
  learners?: unknown[];
  backendReady?: boolean;
};

type TeacherInviteResponse = {
  ok?: boolean;
  code?: string;
  expiresIn?: number;
};

type TeacherConnectionsResponse = {
  connections?: TeacherConnection[];
};

const normalizeChildSetupResult = (data: ChildRpcResponse | null): ChildSetupResult => {
  if (!data) throw new Error('Не удалось создать профиль ребёнка.');

  const childName = data.child_name ?? data.childName ?? '';
  const childShareCode = data.child_share_code ?? data.childShareCode ?? '';
  const childSlotsLimit = data.child_slots_limit ?? data.childSlotsLimit ?? 1;
  if (!childName) throw new Error('Сервер не вернул имя ребёнка.');

  return { childName, childShareCode, childSlotsLimit };
};

const validateChildName = (childName: string): string => {
  const normalized = childName.trim();
  if (!normalized) throw new Error('Укажите имя ребёнка.');
  if (normalized.length > 40) throw new Error('Имя ребёнка должно быть не длиннее 40 символов.');
  return normalized;
};

const validateParentPin = (pin: string): string => {
  const normalized = pin.trim();
  if (!/^\d{4}$/.test(normalized)) throw new Error('PIN должен состоять из 4 цифр.');
  return normalized;
};

export const familyAccountService = {
  async selectAccountMode(mode: AccountMode): Promise<UserProfile | null> {
    const result = await backendApiRequest<{ ok: boolean; profile?: UserProfile }>('/api/family/account-mode', {
      method: 'POST',
      body: { mode },
    });
    return result.profile || null;
  },

  async createChild(childName: string, pin: string): Promise<ChildSetupResult> {
    const normalizedName = validateChildName(childName);
    const normalizedPin = validateParentPin(pin);
    const consent = legalConsentService.consumeChildConsent();

    if (!consent?.legalRepresentativeConfirmed || !consent.childPersonalDataAccepted) {
      throw new Error('Необходимо подтвердить полномочия законного представителя и согласие на обработку данных ребёнка.');
    }

    const data = await backendApiRequest<ChildRpcResponse>('/api/family/child', {
      method: 'POST',
      body: {
        childName: normalizedName,
        accessCode: normalizedPin,
        consent,
      },
    });
    return normalizeChildSetupResult(data);
  },

  async openAdultRoom(pin: string): Promise<MentorRoomLoadResult> {
    const normalizedPin = validateParentPin(pin);
    const data = await backendApiRequest<AdultRoomResponse>('/api/family/adult-room', {
      method: 'POST',
      body: { accessCode: normalizedPin },
    });
    const result = normalizeMentorRoomResult(data);
    return mentorRoomService.primeLearners(result);
  },

  async verifyParentPin(pin: string): Promise<boolean> {
    const normalizedPin = validateParentPin(pin);
    const data = await backendApiRequest<AccessCheckResponse>('/api/family/access-check', {
      method: 'POST',
      body: { accessCode: normalizedPin },
    });
    return data.ok === true;
  },

  async createTeacherInvite(): Promise<string> {
    const result = await backendApiRequest<TeacherInviteResponse>('/api/family/teacher-invite', {
      method: 'POST',
      body: {},
    });
    if (!result.code) throw new Error('Сервер не вернул код преподавателя.');
    return result.code;
  },

  async loadTeacherConnections(): Promise<TeacherConnection[]> {
    const result = await backendApiRequest<TeacherConnectionsResponse>('/api/family/teacher-connections');
    return Array.isArray(result.connections) ? result.connections : [];
  },

  async revokeTeacherConnection(teacherId: string): Promise<void> {
    await backendApiRequest(`/api/family/teacher-connections/${encodeURIComponent(teacherId)}/revoke`, {
      method: 'POST',
      body: {},
    });
  },
};

export default familyAccountService;
